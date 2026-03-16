import { getMyPermissions } from "@/app/actions/permissions";
import { Kt1ReportPageClient } from "./kt1-report-page-client";

export default async function Kt1ReportPage() {
  const permissions = await getMyPermissions();
  return <Kt1ReportPageClient permissions={permissions} />;
}
