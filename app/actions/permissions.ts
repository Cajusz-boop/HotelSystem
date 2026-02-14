"use server";

import { getSession } from "@/lib/auth";
import { getPermissionsForRole } from "@/lib/permissions";

/**
 * Zwraca listę kodów uprawnień dla zalogowanego użytkownika (jego roli).
 * Dla niezalogowanego zwraca pustą tablicę.
 */
export async function getMyPermissions(): Promise<string[]> {
  const session = await getSession();
  if (!session?.role) return [];
  return getPermissionsForRole(session.role);
}
