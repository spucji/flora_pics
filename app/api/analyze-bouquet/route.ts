const schema = {
  type: "object",
  additionalProperties: false,
  required: ["nameCandidates", "colorTag", "subtitle", "description", "recommendedScenes", "flowerHints", "confidenceNote"],
  properties: {
    nameCandidates: { type: "array", minItems: 3, maxItems: 3, items: { type: "string" } },
    colorTag: { type: "string" },
    subtitle: { type: "string" },
    description: { type: "string" },
    recommendedScenes: { type: "array", items: { type: "string" } },
    flowerHints: { type: "array", items: { type: "string" } },
    confidenceNote: { type: "string" },
  },
};

type ResponsePayload = { output?: Array<{ content?: Array<{ type?: string; text?: string }> }>; error?: { message?: string } };

function outputText(payload: ResponsePayload) {
  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && content.text) return content.text;
    }
  }
  return "";
}

export async function POST(request: Request) {
  try {
    const { image, scenes } = await request.json() as { image?: string; scenes?: string[] };
    if (!image?.startsWith("data:image/")) {
      return Response.json({ error: "请先上传一张本地花束图片，再使用 AI 识别。" }, { status: 400 });
    }
    if (image.length > 11_000_000) {
      return Response.json({ error: "图片过大，请压缩至 8MB 以内。" }, { status: 413 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "AI 服务尚未配置。页面功能已就绪，配置 OpenAI API 密钥后即可使用。", code: "AI_NOT_CONFIGURED" }, { status: 503 });
    }

    const sceneList = Array.isArray(scenes) ? scenes.slice(0, 30).join("、") : "";
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-5.4-nano",
        store: false,
        input: [{
          role: "user",
          content: [
            { type: "input_text", text: `你是高端花店的资深花艺编辑。请观察图片，为店主生成可编辑的中文商品草稿。可选场景仅限：${sceneList}。名称要克制、有画面感，每个 2–6 个汉字；色系标签简洁；一句话描述不超过 28 字；详细介绍 55–90 字。不要把不能确认的花材写成确定事实，flowerHints 中对不确定项加“疑似”。recommendedScenes 必须完全照抄可选场景中的名称。confidenceNote 用一句话提醒店主人工核对花材、色彩和使用场景。` },
            { type: "input_image", image_url: image, detail: "high" },
          ],
        }],
        text: { format: { type: "json_schema", name: "bouquet_copy", strict: true, schema } },
      }),
    });

    const payload = await response.json() as ResponsePayload;
    if (!response.ok) {
      const message = payload?.error?.message || "AI 识别暂时不可用，请稍后重试。";
      return Response.json({ error: message }, { status: response.status });
    }

    const text = outputText(payload);
    if (!text) return Response.json({ error: "AI 未返回可用文案，请换一张更清晰的图片重试。" }, { status: 502 });
    return Response.json(JSON.parse(text));
  } catch {
    return Response.json({ error: "图片分析失败，请检查图片后重试。" }, { status: 500 });
  }
}
