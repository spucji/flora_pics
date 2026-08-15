import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { catalogState } from "../../../db/schema";
import { getOwner } from "../../../lib/owner-auth";
import { initialCatalog, isCatalogState } from "../../../lib/catalog-data";

export async function GET() {
  try {
    const db = await getDb();
    const [stored] = await db.select().from(catalogState).where(eq(catalogState.id, 1)).limit(1);
    if (!stored) return Response.json(initialCatalog);
    const parsed = JSON.parse(stored.payload) as unknown;
    return Response.json(isCatalogState(parsed) ? parsed : initialCatalog);
  } catch (error) {
    console.error("Unable to read catalog", error);
    return Response.json({ error: "暂时无法读取花礼目录。" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const owner = await getOwner();
  if (!owner.authorized) return Response.json({ error: "请先登录店主账号。" }, { status: 401 });
  try {
    const input = await request.json() as unknown;
    if (!isCatalogState(input)) return Response.json({ error: "花礼或场景数据格式不完整。" }, { status: 400 });
    const payload = JSON.stringify(input);
    if (payload.length > 12_000_000) return Response.json({ error: "图片数据过大，请压缩后再保存。" }, { status: 413 });
    const db = await getDb();
    await db.insert(catalogState).values({ id: 1, payload }).onConflictDoUpdate({ target: catalogState.id, set: { payload, updatedAt: new Date().toISOString() } });
    return Response.json({ ok: true, updatedAt: new Date().toISOString() });
  } catch (error) {
    console.error("Unable to save catalog", error);
    return Response.json({ error: "花礼目录保存失败，请稍后重试。" }, { status: 500 });
  }
}
