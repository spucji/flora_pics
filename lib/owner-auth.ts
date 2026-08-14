import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const OWNER_COOKIE = "flora_owner_session";
export const OWNER_SESSION_SECONDS = 60 * 60 * 12;

const encoder = new TextEncoder();
const username = () => (process.env.OWNER_USERNAME || "flora-owner").trim();
const password = () => process.env.OWNER_PASSWORD || "";
const secret = () => process.env.OWNER_SESSION_SECRET || "";

export function ownerConfigured() {
  return Boolean(username() && password() && secret());
}

async function digest(value: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

async function secureEqual(left: string, right: string) {
  const [a, b] = await Promise.all([digest(left), digest(right)]);
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
}

async function sign(value: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
  return [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function verifyOwnerCredentials(candidateUsername: string, candidatePassword: string) {
  if (!ownerConfigured()) return false;
  const [usernameMatches, passwordMatches] = await Promise.all([
    secureEqual(candidateUsername.trim(), username()),
    secureEqual(candidatePassword, password()),
  ]);
  return usernameMatches && passwordMatches;
}

export async function createOwnerSessionToken() {
  const expiresAt = Math.floor(Date.now() / 1000) + OWNER_SESSION_SECONDS;
  return `${expiresAt}.${await sign(`owner:${expiresAt}`)}`;
}

async function validSessionToken(token: string | undefined) {
  if (!token || !ownerConfigured()) return false;
  const [expiresRaw, providedSignature, extra] = token.split(".");
  const expiresAt = Number(expiresRaw);
  if (extra || !providedSignature || !Number.isInteger(expiresAt) || expiresAt <= Date.now() / 1000) return false;
  return secureEqual(providedSignature, await sign(`owner:${expiresAt}`));
}

export async function getOwner() {
  const cookieStore = await cookies();
  const authorized = await validSessionToken(cookieStore.get(OWNER_COOKIE)?.value);
  return { user: authorized ? { username: username() } : null, authorized, configured: ownerConfigured() };
}

export async function requireOwner(returnTo: string) {
  const owner = await getOwner();
  if (!owner.authorized || !owner.user) redirect(`/owner/login?return_to=${encodeURIComponent(returnTo)}`);
  return owner.user;
}
