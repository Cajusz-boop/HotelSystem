/**
 * Matryca uprawnień – sprawdzanie uprawnień per akcja (nie tylko rola).
 */

import { prisma } from "@/lib/db";

const cache = new Map<string, Set<string>>();
const CACHE_TTL_MS = 60_000;
let cacheExpiry = 0;

async function getRolePermissions(role: string): Promise<Set<string>> {
  const key = `role:${role}`;
  if (cache.has(key) && Date.now() < cacheExpiry) {
    return cache.get(key)!;
  }
  const group = await prisma.roleGroup.findUnique({
    where: { code: role },
    include: { permissions: { include: { permission: true } } },
  });
  if (group?.permissions?.length) {
    const codes = new Set(group.permissions.map((p) => p.permission.code));
    cache.set(key, codes);
    cacheExpiry = Date.now() + CACHE_TTL_MS;
    return codes;
  }
  const list = await prisma.rolePermission.findMany({
    where: { role },
    select: { permission: { select: { code: true } } },
  });
  const codes = new Set(list.map((r) => r.permission.code));
  cache.set(key, codes);
  cacheExpiry = Date.now() + CACHE_TTL_MS;
  return codes;
}

/**
 * Sprawdza, czy rola ma dane uprawnienie (po kodzie).
 */
export async function can(role: string, permissionCode: string): Promise<boolean> {
  const permissions = await getRolePermissions(role);
  return permissions.has(permissionCode);
}

/**
 * Zwraca listę kodów uprawnień dla roli.
 */
export async function getPermissionsForRole(role: string): Promise<string[]> {
  const set = await getRolePermissions(role);
  return Array.from(set);
}

/**
 * Czyści cache (np. po zapisie nowych RolePermission).
 */
export function clearPermissionsCache(): void {
  cache.clear();
}

export const PERMISSION_CODES = [
  "reservation.create",
  "reservation.edit",
  "reservation.cancel",
  "reservation.check_in",
  "reservation.check_out",
  "finance.view",
  "finance.post",
  "finance.void",
  "finance.refund",
  "rates.view",
  "rates.edit",
  "reports.view",
  "reports.export",
  "reports.management",
  "reports.kpi",
  "reports.meals",
  "reports.official",
  "housekeeping.view",
  "housekeeping.update_status",
  "admin.users",
  "admin.settings",
  "owner.portal",
  "module.dashboard",
  "module.front_office",
  "module.check_in",
  "module.guests",
  "module.companies",
  "module.travel_agents",
  "module.rooms",
  "module.rates",
  "module.housekeeping",
  "module.finance",
  "module.reports",
  "module.channel_manager",
  "module.parking",
  "module.mice",
] as const;
