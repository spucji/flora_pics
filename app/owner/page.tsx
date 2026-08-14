import { requireOwner } from "../../lib/owner-auth";
import OwnerDashboard from "./owner-dashboard";
import "./owner.css";
import "./owner-members.css";

export const dynamic = "force-dynamic";

export default async function OwnerPage() {
  const owner = await requireOwner("/owner");
  return <OwnerDashboard account={owner.username} signOutPath="/api/owner/logout?return_to=/" />;
}
