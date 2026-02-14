import { getMyPermissions } from "@/app/actions/permissions";
import { ReportsPageClient } from "./reports-page-client";

export default async function ReportsPage() {
  const permissions = await getMyPermissions();
  return <ReportsPageClient permissions={permissions} />;
}
