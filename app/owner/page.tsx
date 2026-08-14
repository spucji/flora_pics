import { requireChatGPTUser, chatGPTSignOutPath } from "../chatgpt-auth";
import { configuredOwnerEmails } from "../../lib/owner-auth";
import OwnerDashboard from "./owner-dashboard";
import Link from "next/link";
import "./owner.css";

export const dynamic = "force-dynamic";

async function OwnerGate() {
  const user = await requireChatGPTUser("/owner");
  const owners = configuredOwnerEmails();
  if (!owners.includes(user.email.toLowerCase())) {
    return <main className="owner-access"><div><span>OWNER ACCESS</span><h1>这个账号还不是店主</h1><p>{owners.length ? "请让网站管理员把下面的邮箱加入店主白名单。" : "网站尚未配置店主邮箱白名单。配置 OWNER_EMAILS 后即可进入。"}</p><code>{user.email}</code><a href={chatGPTSignOutPath("/")}>退出并更换账号</a><Link className="secondary" href="/">返回顾客页</Link></div></main>;
  }
  return <OwnerDashboard email={user.email} signOutPath={chatGPTSignOutPath("/")} />;
}

export default function OwnerPage() { return <OwnerGate />; }
