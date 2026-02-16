"use server";

import { getSession } from "@/lib/auth";
import { getPermissionsForRole } from "@/lib/permissions";
import { unstable_cache } from "next/cache";

const getCachedPermissionsForRole = unstable_cache(
  async (role: string) => getPermissionsForRole(role),
  ["permissions-by-role"],
  { revalidate: 120 }
);

/**
 * Zwraca listę kodów uprawnień dla zalogowanego użytkownika (jego roli).
 * Dla niezalogowanego zwraca pustą tablicę.
 */
export async function getMyPermissions(): Promise<string[]> {
  const session = await getSession();
  if (!session?.role) return [];
  return getCachedPermissionsForRole(session.role);
}
