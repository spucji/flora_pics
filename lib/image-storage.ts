import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

type ImageKind = { extension: "jpg" | "png" | "webp" | "gif" | "avif"; mimeType: string };

const dataRoot = dirname(resolve(process.env.DATABASE_PATH || "data/flora.sqlite"));
const uploadRoot = resolve(process.env.UPLOAD_DIR || join(dataRoot, "uploads"));

function detectImage(bytes: Uint8Array): ImageKind | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { extension:"jpg", mimeType:"image/jpeg" };
  if (bytes.length >= 8 && [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a].every((value, index) => bytes[index] === value)) return { extension:"png", mimeType:"image/png" };
  const prefix = Buffer.from(bytes.subarray(0, 12)).toString("ascii");
  if (prefix.startsWith("RIFF") && prefix.slice(8, 12) === "WEBP") return { extension:"webp", mimeType:"image/webp" };
  if (prefix.startsWith("GIF87a") || prefix.startsWith("GIF89a")) return { extension:"gif", mimeType:"image/gif" };
  if (bytes.length >= 12 && prefix.slice(4, 8) === "ftyp" && ["avif", "avis"].includes(prefix.slice(8, 12))) return { extension:"avif", mimeType:"image/avif" };
  return null;
}

export async function storeImage(bytes: Uint8Array) {
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new Error("图片请控制在 8MB 以内。");
  const kind = detectImage(bytes);
  if (!kind) throw new Error("仅支持 JPG、PNG、WebP、GIF 或 AVIF 图片。");
  await mkdir(uploadRoot, { recursive:true });
  const filename = `${crypto.randomUUID()}.${kind.extension}`;
  await writeFile(join(uploadRoot, filename), bytes, { flag:"wx" });
  return { filename, mimeType:kind.mimeType, url:`/api/images?file=${encodeURIComponent(filename)}` };
}

export async function storeDataUrl(value: string) {
  const match = /^data:image\/[a-z0-9.+-]+;base64,([a-z0-9+/=\r\n]+)$/i.exec(value);
  if (!match) throw new Error("图片数据格式无效。");
  return storeImage(Buffer.from(match[1], "base64"));
}

function safeFilename(value: string | null) {
  if (!value || !/^[0-9a-f-]+\.(?:jpg|png|webp|gif|avif)$/i.test(value)) return null;
  return value;
}

export async function readStoredImage(filenameValue: string | null) {
  const filename = safeFilename(filenameValue);
  if (!filename) return null;
  try {
    const bytes = await readFile(join(uploadRoot, filename));
    const kind = detectImage(bytes);
    return kind ? { bytes, mimeType:kind.mimeType } : null;
  } catch {
    return null;
  }
}

export async function imageAsDataUrl(value: string) {
  if (value.startsWith("data:image/")) return value;
  if (value.startsWith("/api/images?")) {
    const filename = new URL(value, "http://localhost").searchParams.get("file");
    const stored = await readStoredImage(filename);
    if (!stored) throw new Error("已上传图片不存在，请重新上传。");
    return `data:${stored.mimeType};base64,${stored.bytes.toString("base64")}`;
  }
  if (value.startsWith("/demo/")) {
    const publicRoot = resolve("public");
    const path = resolve(publicRoot, `.${value}`);
    if (!path.startsWith(`${publicRoot}/`)) throw new Error("图片路径无效。");
    const bytes = await readFile(path);
    const kind = detectImage(bytes);
    if (!kind) throw new Error("演示图片格式不受支持。");
    return `data:${kind.mimeType};base64,${bytes.toString("base64")}`;
  }
  throw new Error("请先上传一张花束图片，再使用 AI 识别。");
}
