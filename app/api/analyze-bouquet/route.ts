import { getOwner } from "../../../lib/owner-auth";
import { imageAsDataUrl } from "../../../lib/image-storage";

type ChatPayload = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
};

type VisionResult = {
  dominantColors: string[];
  style: string;
  shapeAndScale: string;
  packaging: string;
  flowerHints: string[];
  mood: string;
  uncertainties: string[];
};

type BouquetDraft = {
  nameCandidates: string[];
  colorTag: string;
  subtitle: string;
  description: string;
  recommendedScenes: string[];
  flowerHints: string[];
  confidenceNote: string;
};

function assistantText(payload: ChatPayload) {
  return payload.choices?.[0]?.message?.content?.trim() ?? "";
}

function parseJson<T>(text: string): T {
  const cleaned = text.replace(/^```json\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(cleaned) as T;
}

function validDraft(value: BouquetDraft) {
  return Array.isArray(value.nameCandidates) && value.nameCandidates.length === 3 &&
    typeof value.colorTag === "string" && typeof value.subtitle === "string" &&
    typeof value.description === "string" && Array.isArray(value.recommendedScenes) &&
    Array.isArray(value.flowerHints) && typeof value.confidenceNote === "string";
}

async function analyzeWithQwen(image: string, apiKey: string) {
  const baseUrl = (process.env.DASHSCOPE_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.DASHSCOPE_VISION_MODEL || "qwen3-vl-plus",
      stream: false,
      enable_thinking: false,
      response_format: { type: "json_object" },
      messages: [{
        role: "user",
        content: [
          { type: "text", text: "请分析这张花束或花礼照片，并只输出 JSON。字段必须为：dominantColors（主要颜色数组）、style（整体风格）、shapeAndScale（造型和体量）、packaging（包装特征）、flowerHints（可能的花材数组，不确定时写‘疑似…’）、mood（氛围）、uncertainties（需要花艺师人工核对的项目数组）。不要臆测图片中看不清的品种。" },
          { type: "image_url", image_url: { url: image } },
        ],
      }],
    }),
  });
  const payload = await response.json() as ChatPayload;
  if (!response.ok) throw new Error(`Qwen-VL：${payload.error?.message || "图片识别失败"}`);
  const text = assistantText(payload);
  if (!text) throw new Error("Qwen-VL：没有返回图片分析结果");
  return parseJson<VisionResult>(text);
}

async function writeWithDeepSeek(vision: VisionResult, scenes: string[], apiKey: string) {
  const sceneList = scenes.slice(0, 30);
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
      stream: false,
      thinking: { type: "disabled" },
      max_tokens: 1000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "你是高端花店的资深中文花艺编辑。你会根据视觉模型提供的观察生成克制、自然、可编辑的商品文案，并只输出 JSON。不得把不确定花材写成确定事实。" },
        { role: "user", content: `视觉分析：${JSON.stringify(vision)}\n可选场景：${JSON.stringify(sceneList)}\n请输出以下 JSON：{"nameCandidates":["名称一","名称二","名称三"],"colorTag":"简洁色系标签","subtitle":"不超过28字的一句话描述","description":"55至90字的详细介绍","recommendedScenes":["只能逐字选择可选场景中的名称"],"flowerHints":["沿用视觉分析并保留疑似措辞"],"confidenceNote":"提醒店主核对花材、颜色与场景的一句话"}。名称每个2至6个汉字、有画面感但不过度诗化；recommendedScenes 不得创造新场景。` },
      ],
    }),
  });
  const payload = await response.json() as ChatPayload;
  if (!response.ok) throw new Error(`DeepSeek：${payload.error?.message || "文案生成失败"}`);
  const text = assistantText(payload);
  if (!text) throw new Error("DeepSeek：没有返回文案草稿");
  return parseJson<BouquetDraft>(text);
}

export async function POST(request: Request) {
  const owner = await getOwner();
  if (!owner.authorized) return Response.json({ error: "请先登录店主账号。" }, { status: 401 });
  try {
    const { image, scenes } = await request.json() as { image?: string; scenes?: string[] };
    if (!image) return Response.json({ error: "请先上传一张花束图片，再使用 AI 识别。" }, { status: 400 });
    const imageData = await imageAsDataUrl(image);
    if (imageData.length > 11_000_000) {
      return Response.json({ error: "图片过大，请压缩至 8MB 以内。" }, { status: 413 });
    }

    const dashscopeKey = process.env.DASHSCOPE_API_KEY;
    const deepseekKey = process.env.DEEPSEEK_API_KEY;
    const missing = [!dashscopeKey && "DASHSCOPE_API_KEY", !deepseekKey && "DEEPSEEK_API_KEY"].filter(Boolean);
    if (missing.length) {
      return Response.json({ error: `AI 服务尚未配置完整：缺少 ${missing.join("、")}。`, code: "AI_NOT_CONFIGURED" }, { status: 503 });
    }

    const vision = await analyzeWithQwen(imageData, dashscopeKey as string);
    const draft = await writeWithDeepSeek(vision, Array.isArray(scenes) ? scenes : [], deepseekKey as string);
    if (!validDraft(draft)) throw new Error("生成结果格式不完整，请重试");
    return Response.json(draft);
  } catch (error) {
    const message = error instanceof Error ? error.message : "图片分析失败，请检查图片后重试。";
    return Response.json({ error: message }, { status: 502 });
  }
}
