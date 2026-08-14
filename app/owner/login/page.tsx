import { redirect } from "next/navigation";
import { getOwner } from "../../../lib/owner-auth";
import LoginForm from "./login-form";
import "../owner.css";

export const dynamic = "force-dynamic";

export default async function OwnerLoginPage() {
  const owner = await getOwner();
  if (owner.authorized) redirect("/owner");
  return <LoginForm configured={owner.configured} />;
}
