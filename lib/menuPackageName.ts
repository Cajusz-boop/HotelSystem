import { prisma } from "@/lib/db";

/**
 * Rozwiązuje packageId (z EventOrder) do nazwy pakietu.
 * packageId może być:
 * - code z MenuPackage (imprezy, np. "stypa_58", "wesele_290")
 * - id z Package (rezerwacje hotelowe/SPA)
 */
export async function resolvePackageName(packageId: string | null): Promise<string | null> {
  if (!packageId) return null;
  const menuPkg = await prisma.menuPackage.findFirst({ where: { code: packageId }, select: { name: true } });
  if (menuPkg) return menuPkg.name;
  const resPkg = await prisma.package.findUnique({ where: { id: packageId }, select: { name: true } });
  return resPkg?.name ?? null;
}
