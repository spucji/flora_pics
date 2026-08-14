import { createOwnerSessionToken, OWNER_COOKIE, OWNER_SESSION_SECONDS, ownerConfigured, verifyOwnerCredentials } from "../../../../lib/owner-auth";

function safeReturnTo(value: unknown) {
  return typeof value === "string" && (value === "/owner" || value === "/owner/editor") ? value : "/owner";
}

export async function POST(request: Request) {
  if (!ownerConfigured()) return Response.json({ error: "店主账号尚未在服务器中配置。" }, { status: 503 });
  const input = await request.json().catch(() => ({})) as { username?: string; password?: string; returnTo?: string };
  if (!await verifyOwnerCredentials(input.username || "", input.password || "")) {
    await new Promise(resolve => setTimeout(resolve, 650));
    return Response.json({ error: "账号或密码不正确。" }, { status: 401 });
  }
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  const headers = new Headers({ "Content-Type": "application/json" });
  headers.append("Set-Cookie", `${OWNER_COOKIE}=${await createOwnerSessionToken()}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${OWNER_SESSION_SECONDS}${secure}`);
  return new Response(JSON.stringify({ ok: true, redirect: safeReturnTo(input.returnTo) }), { status: 200, headers });
}
