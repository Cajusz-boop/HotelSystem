import { getSession } from "@/lib/auth";
import HousekeepingPageClient from "./housekeeping-page-client";

export default async function HousekeepingPage() {
  const session = await getSession();
  return <HousekeepingPageClient role={session?.role ?? null} />;
}
