import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { consultations, memberLedger, members } from "../../../../db/schema";
import { getOwner } from "../../../../lib/owner-auth";

async function authorize() {
  const owner = await getOwner();
  if (!owner.user) return Response.json({ error: "请先登录店主账号。" }, { status: 401 });
  if (!owner.authorized) return Response.json({ error: "店主登录已失效。" }, { status: 403 });
  return null;
}

export async function GET() {
  const denied = await authorize();
  if (denied) return denied;
  try {
    const db = await getDb();
    const rows = await db.select().from(consultations).orderBy(desc(consultations.createdAt)).limit(100);
    return Response.json({ consultations: rows });
  } catch {
    return Response.json({ error: "暂时无法读取咨询单。" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const denied = await authorize();
  if (denied) return denied;
  try {
    const input = await request.json() as { id?: number; status?: string; purchaseAmount?: number; referrerMemberId?: number | null };
    const allowed = ["pending", "contacted", "purchased", "cancelled"];
    if (!Number.isInteger(input.id) || !input.status || !allowed.includes(input.status)) {
      return Response.json({ error: "状态信息无效。" }, { status: 400 });
    }
    const db = await getDb();
    const [current] = await db.select().from(consultations).where(eq(consultations.id, input.id as number)).limit(1);
    if (!current) return Response.json({ error: "咨询单不存在。" }, { status: 404 });
    const purchaseAmount = Number.isFinite(input.purchaseAmount) ? Math.max(0, Math.round(input.purchaseAmount as number)) : current.purchaseAmount;
    const [legacyReferrer] = !current.referrerMemberId && current.referralCode ? await db.select().from(members).where(eq(members.code, current.referralCode)).limit(1) : [];
    const currentReferrerId = current.referrerMemberId ?? legacyReferrer?.id ?? null;
    const referrerWasProvided = Object.prototype.hasOwnProperty.call(input, "referrerMemberId");
    const requestedReferrerId = referrerWasProvided ? (input.referrerMemberId === null ? null : Number(input.referrerMemberId)) : currentReferrerId;
    if (requestedReferrerId !== null && !Number.isInteger(requestedReferrerId)) return Response.json({ error:"推荐会员信息无效。" }, { status:400 });
    const [nextReferrer] = requestedReferrerId === null ? [] : await db.select().from(members).where(eq(members.id, requestedReferrerId)).limit(1);
    if (requestedReferrerId !== null && !nextReferrer) return Response.json({ error:"所选推荐会员不存在，请刷新后重试。" }, { status:404 });

    const shouldReward = input.status === "purchased" && Boolean(nextReferrer);
    const shouldRevoke = current.rewardGranted && Boolean(currentReferrerId) && (!shouldReward || currentReferrerId !== requestedReferrerId);
    const shouldGrant = shouldReward && (!current.rewardGranted || currentReferrerId !== requestedReferrerId);
    const update = db.update(consultations).set({ status:input.status, purchaseAmount, rewardGranted:shouldReward, referrerMemberId:requestedReferrerId, referralCode:"" }).where(eq(consultations.id, current.id));
    const revoke = currentReferrerId ? db.insert(memberLedger).values({ memberId:currentReferrerId, amount:-10, type:"reversal", reason:`订单 ${current.reference} 取消或更换推荐人，撤回推荐金`, consultationId:current.id }) : null;
    const grant = nextReferrer ? db.insert(memberLedger).values({ memberId:nextReferrer.id, amount:10, type:"referral", reason:`推荐顾客 ${current.reference} 成交`, consultationId:current.id }) : null;
    if (shouldRevoke && shouldGrant && revoke && grant) await db.batch([update, revoke, grant]);
    else if (shouldRevoke && revoke) await db.batch([update, revoke]);
    else if (shouldGrant && grant) await db.batch([update, grant]);
    else await update;
    return Response.json({ ok:true, rewardGranted:shouldReward, referrerMemberId:requestedReferrerId });
  } catch (error) {
    console.error("Owner consultation update failed", error);
    return Response.json({ error: "状态更新失败。" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const denied = await authorize();
  if (denied) return denied;
  try {
    const input = await request.json() as { id?: number };
    if (!Number.isInteger(input.id)) return Response.json({ error: "订单编号无效。" }, { status: 400 });
    const db = await getDb();
    const [current] = await db.select().from(consultations).where(eq(consultations.id, input.id as number)).limit(1);
    if (!current) return Response.json({ error: "咨询单不存在或已被删除。" }, { status: 404 });
    const [legacyReferrer] = !current.referrerMemberId && current.referralCode ? await db.select().from(members).where(eq(members.code, current.referralCode)).limit(1) : [];
    const referrerId = current.referrerMemberId ?? legacyReferrer?.id ?? null;
    const detachLedger = db.update(memberLedger).set({ consultationId:null }).where(eq(memberLedger.consultationId, current.id));
    const removeOrder = db.delete(consultations).where(eq(consultations.id, current.id));
    if (current.rewardGranted && referrerId) {
      await db.batch([
        detachLedger,
        db.insert(memberLedger).values({ memberId:referrerId, amount:-10, type:"reversal", reason:`删除订单 ${current.reference}，撤回推荐金` }),
        removeOrder,
      ]);
    } else {
      await db.batch([detachLedger, removeOrder]);
    }
    return Response.json({ ok:true, reversedReward:Boolean(current.rewardGranted && referrerId) });
  } catch (error) {
    console.error("Owner consultation deletion failed", error);
    return Response.json({ error: "订单删除失败，请稍后重试。" }, { status: 500 });
  }
}
