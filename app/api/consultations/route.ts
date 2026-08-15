import { getDb } from "../../../db";
import { consultations } from "../../../db/schema";

type Submission = {
  bouquetId?: string; bouquetName?: string; size?: string; materialPlan?: string;
  priceRange?: string; scene?: string; deliveryDate?: string; budget?: string;
  customerName?: string; contact?: string; note?: string; referralCode?: string; website?: string;
};

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function makeReference() {
  const date = new Date();
  const day = `${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  return `FL-${day}-${crypto.randomUUID().slice(0, 5).toUpperCase()}`;
}

export async function POST(request: Request) {
  try {
    const input = await request.json() as Submission;
    if (input.website) return Response.json({ error: "提交失败" }, { status: 400 });
    const bouquetId = clean(input.bouquetId, 30);
    const bouquetName = clean(input.bouquetName, 80);
    const size = clean(input.size, 10);
    const materialPlan = clean(input.materialPlan, 80);
    const priceRange = clean(input.priceRange, 40);
    if (!bouquetId || !bouquetName || !size || !materialPlan || !priceRange) {
      return Response.json({ error: "花礼信息不完整，请返回重新选择。" }, { status: 400 });
    }

    const reference = makeReference();
    const values = {
      reference, bouquetId, bouquetName, size, materialPlan, priceRange,
      scene: clean(input.scene, 80), deliveryDate: clean(input.deliveryDate, 20),
      budget: clean(input.budget, 40), customerName: clean(input.customerName, 60),
      contact: clean(input.contact, 120), note: clean(input.note, 500),
      referralCode: clean(input.referralCode, 30).toUpperCase(),
    };
    const db = await getDb();
    await db.insert(consultations).values(values);
    const summary = [
      `花礼咨询单 ${reference}`, `款式：${bouquetName}（${bouquetId}）`, `体量：${size}`,
      `花材方案：${materialPlan}`, `参考价：¥${priceRange}`,
      values.scene && `场景：${values.scene}`, values.deliveryDate && `用花日期：${values.deliveryDate}`,
      values.budget && `预算：${values.budget}`, values.customerName && `称呼：${values.customerName}`,
      values.contact && `联系方式：${values.contact}`, values.note && `备注：${values.note}`,
      values.referralCode && `推荐码：${values.referralCode}`,
      "最终花材与价格以门店花艺师确认为准。",
    ].filter(Boolean).join("\n");
    return Response.json({ reference, summary }, { status: 201 });
  } catch (error) {
    console.error("Unable to create consultation", error);
    return Response.json({ error: "咨询单暂时无法保存，请稍后重试。" }, { status: 500 });
  }
}
