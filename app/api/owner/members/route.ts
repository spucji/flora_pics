import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { memberLedger, members } from "../../../../db/schema";
import { getOwner } from "../../../../lib/owner-auth";

async function denied() {
  const owner = await getOwner();
  if (!owner.user) return Response.json({ error: "请先登录店主账号。" }, { status: 401 });
  if (!owner.authorized) return Response.json({ error: "店主登录已失效。" }, { status: 403 });
  return null;
}

function clean(value: unknown, max: number) { return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function makeCode() { return `F${crypto.randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase()}`; }

export async function GET() {
  const blocked = await denied(); if (blocked) return blocked;
  try {
    const db = await getDb();
    const memberRows = await db.select().from(members).orderBy(desc(members.createdAt));
    const ledgerRows = await db.select().from(memberLedger).orderBy(desc(memberLedger.createdAt)).limit(200);
    const result = memberRows.map(member => ({ ...member, balance: ledgerRows.filter(row => row.memberId === member.id).reduce((sum, row) => sum + row.amount, 0), ledger: ledgerRows.filter(row => row.memberId === member.id).slice(0, 12) }));
    return Response.json({ members: result });
  } catch { return Response.json({ error: "暂时无法读取会员资料。" }, { status: 500 }); }
}

export async function POST(request: Request) {
  const blocked = await denied(); if (blocked) return blocked;
  try {
    const input = await request.json() as { action?: string; name?: string; contact?: string; note?: string; memberId?: number; amount?: number; reason?: string };
    const db = await getDb();
    if (input.action === "create") {
      const name = clean(input.name, 60); if (!name) return Response.json({ error: "请填写会员称呼。" }, { status: 400 });
      const [member] = await db.insert(members).values({ code: makeCode(), name, contact: clean(input.contact, 120), note: clean(input.note, 300) }).returning();
      return Response.json({ member }, { status: 201 });
    }
    if (input.action === "redeem") {
      const memberId = Number(input.memberId); const amount = Math.round(Number(input.amount));
      if (!Number.isInteger(memberId) || !Number.isInteger(amount) || amount <= 0) return Response.json({ error: "抵扣金额无效。" }, { status: 400 });
      const rows = await db.select().from(memberLedger).where(eq(memberLedger.memberId, memberId));
      const balance = rows.reduce((sum, row) => sum + row.amount, 0);
      if (amount > balance) return Response.json({ error: `当前可用推荐金为 ${balance} 元。` }, { status: 400 });
      await db.insert(memberLedger).values({ memberId, amount: -amount, type: "redeem", reason: clean(input.reason, 160) || "购花抵扣" });
      return Response.json({ ok: true });
    }
    return Response.json({ error: "不支持的操作。" }, { status: 400 });
  } catch (error) { console.error("Owner member operation failed", error); return Response.json({ error: "会员操作失败，请稍后重试。" }, { status: 500 }); }
}
