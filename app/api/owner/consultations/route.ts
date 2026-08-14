import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { consultations } from "../../../../db/schema";
import { getOwner } from "../../../../lib/owner-auth";

async function authorize() {
  const owner = await getOwner();
  if (!owner.user) return Response.json({ error: "请先登录店主账号。" }, { status: 401 });
  if (!owner.authorized) return Response.json({ error: "当前账号不在店主白名单中。" }, { status: 403 });
  return null;
}

export async function GET() {
  const denied = await authorize();
  if (denied) return denied;
  try {
    const rows = await getDb().select().from(consultations).orderBy(desc(consultations.createdAt)).limit(100);
    return Response.json({ consultations: rows });
  } catch {
    return Response.json({ error: "暂时无法读取咨询单。" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const denied = await authorize();
  if (denied) return denied;
  try {
    const input = await request.json() as { id?: number; status?: string };
    const allowed = ["pending", "contacted", "completed"];
    if (!Number.isInteger(input.id) || !input.status || !allowed.includes(input.status)) {
      return Response.json({ error: "状态信息无效。" }, { status: 400 });
    }
    await getDb().update(consultations).set({ status: input.status }).where(eq(consultations.id, input.id as number));
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "状态更新失败。" }, { status: 500 });
  }
}
