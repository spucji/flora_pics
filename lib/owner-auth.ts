import { getChatGPTUser } from "../app/chatgpt-auth";

export function configuredOwnerEmails() {
  return (process.env.OWNER_EMAILS || "")
    .split(",")
    .map(email => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function getOwner() {
  const user = await getChatGPTUser();
  if (!user) return { user: null, authorized: false, configured: configuredOwnerEmails().length > 0 };
  const owners = configuredOwnerEmails();
  return { user, authorized: owners.includes(user.email.toLowerCase()), configured: owners.length > 0 };
}
