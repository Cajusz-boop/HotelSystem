import { prisma } from "@/lib/db";

/**
 * Resolve dish IDs to names. Returns array of names in the same order as ids.
 * Missing IDs yield empty string.
 */
export async function resolveDishIdsToNames(ids: string[]): Promise<string[]> {
  if (!ids?.length) return [];
  const uniq = [...new Set(ids)];
  const dishes = await prisma.dish.findMany({
    where: { id: { in: uniq } },
    select: { id: true, name: true },
  });
  const map = new Map(dishes.map((d) => [d.id, d.name]));
  return ids.map((id) => map.get(id) ?? "");
}
