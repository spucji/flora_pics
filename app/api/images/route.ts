import { getOwner } from "../../../lib/owner-auth";
import { MAX_IMAGE_BYTES, readStoredImage, storeImage } from "../../../lib/image-storage";

export async function GET(request: Request) {
  const filename = new URL(request.url).searchParams.get("file");
  const image = await readStoredImage(filename);
  if (!image) return new Response("Not found", { status:404 });
  return new Response(image.bytes, { headers:{ "Content-Type":image.mimeType, "Cache-Control":"public, max-age=31536000, immutable", "X-Content-Type-Options":"nosniff" } });
}

export async function POST(request: Request) {
  const owner = await getOwner();
  if (!owner.authorized) return Response.json({ error:"请先登录店主账号。" }, { status:401 });
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_IMAGE_BYTES + 1_000_000) return Response.json({ error:"图片请控制在 8MB 以内。" }, { status:413 });
  try {
    const form = await request.formData();
    const file = form.get("image");
    if (!(file instanceof File)) return Response.json({ error:"请选择需要上传的图片。" }, { status:400 });
    const stored = await storeImage(new Uint8Array(await file.arrayBuffer()));
    return Response.json({ url:stored.url, filename:stored.filename }, { status:201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "图片上传失败。";
    return Response.json({ error:message }, { status:400 });
  }
}
