import CatalogClient from "../../catalog-client";
import { requireChatGPTUser } from "../../chatgpt-auth";
import { configuredOwnerEmails } from "../../../lib/owner-auth";

export const dynamic = "force-dynamic";

export default async function OwnerEditorPage() {
  const user = await requireChatGPTUser("/owner/editor");
  if (!configuredOwnerEmails().includes(user.email.toLowerCase())) return <main style={{padding:40}}>当前账号没有店主权限。<br/><a href="/owner">返回店主首页</a></main>;
  return <CatalogClient ownerMode />;
}
