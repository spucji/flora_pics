import CatalogClient from "../../catalog-client";
import { requireOwner } from "../../../lib/owner-auth";

export const dynamic = "force-dynamic";

export default async function OwnerEditorPage() {
  await requireOwner("/owner/editor");
  return <CatalogClient ownerMode />;
}
