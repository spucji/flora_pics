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
    const input = await request.json() as { id?: number; status?: string; purchaseAmount?: number };
    const allowed = ["pending", "contacted", "purchased", "cancelled"];
    if (!Number.isInteger(input.id) || !input.status || !allowed.includes(input.status)) {
      return Response.json({ error: "状态信息无效。" }, { status: 400 });
    }
    const db = await getDb();
    const [current] = await db.select().from(consultations).where(eq(consultations.id, input.id as number)).limit(1);
    if (!current) return Response.json({ error: "咨询单不存在。" }, { status: 404 });
    const purchaseAmount = Number.isFinite(input.purchaseAmount) ? Math.max(0, Math.round(input.purchaseAmount as number)) : current.purchaseAmount;
    const [referrer] = current.referralCode ? await db.select().from(members).where(eq(members.code, current.referralCode)).limit(1) : [];
    const shouldGrant = input.status === "purchased" && Boolean(referrer);
    const rewardChanged = shouldGrant !== current.rewardGranted;
    const update = db.update(consultations).set({ status: input.status, purchaseAmount, rewardGranted: shouldGrant }).where(eq(consultations.id, current.id));
    if (rewardChanged && referrer) {
      const amount = shouldGrant ? 10 : -10;
      await db.batch([update, db.insert(memberLedger).values({ memberId: referrer.id, amount, type: shouldGrant ? "referral" : "reversal", reason: shouldGrant ? `推荐顾客 ${current.reference} 成交` : `订单 ${current.reference} 取消，撤回推荐金`, consultationId: current.id })]);
    } else {
      await update;
    }
    return Response.json({ ok: true, rewardGranted: shouldGrant });
  } catch (error) {
    console.error("Owner consultation update failed", error);
    return Response.json({ error: "状态更新失败。" }, { status: 500 });
  }
}
