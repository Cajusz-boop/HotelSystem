import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { can } from "@/lib/permissions";
import HousekeepingLayoutClient from "./housekeeping-layout-client";

export default async function HousekeepingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  const isAdmin = session.role === "ADMIN";
  const allowed = isAdmin || (await can(session.role, "module.housekeeping"));
  if (!allowed) {
    redirect("/?forbidden=1");
  }
  return (
    <HousekeepingLayoutClient role={session.role}>
      {children}
    </HousekeepingLayoutClient>
  );
}
