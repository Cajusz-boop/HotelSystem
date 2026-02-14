import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { redirect } from "next/navigation";

export default async function FinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (session) {
    const allowed = await can(session.role, "module.finance");
    if (!allowed) redirect("/?forbidden=1");
  }
  return <>{children}</>;
}
