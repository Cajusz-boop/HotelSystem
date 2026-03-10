/**
 * Dopasowuje dania ze słownika do sekcji pakietów menu (legacy → dishIds)
 * Uruchom: npx tsx scripts/match-dishes-to-packages.ts
 */
import "dotenv/config";
import { prisma } from "../lib/db";

function parseDishNames(dishes: unknown): string[] {
  if (!dishes) return [];
  if (Array.isArray(dishes)) {
    return dishes.flatMap((s) =>
      String(s)
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
    );
  }
  return String(dishes)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function ensureDish(name: string): Promise<{ id: string; name: string }> {
  let dish = await prisma.dish.findFirst({ where: { name } });
  if (!dish) {
    dish = await prisma.dish.create({
      data: {
        name,
        defaultPrice: 0,
        vatRate: 0.08,
        isActive: true,
      },
    });
  }
  return { id: dish.id, name: dish.name };
}

async function main() {
  console.log("Dopasowywanie dań do pakietów menu...\n");

  const sections = await prisma.menuPackageSection.findMany({
    include: { package: true },
    orderBy: [{ packageId: "asc" }, { sortOrder: "asc" }],
  });

  let updated = 0;
  for (const sec of sections) {
    const dishIds = Array.isArray(sec.dishIds) ? (sec.dishIds as string[]) : [];
    if (dishIds.length > 0) {
      continue; // już dopasowane
    }

    const names = parseDishNames(sec.dishes);
    if (names.length === 0) continue;

    const items: { id: string; name: string }[] = [];
    for (const n of names) {
      const d = await ensureDish(n);
      items.push(d);
    }

    const newDishIds = items.map((x) => x.id);
    const newDishes = items.map((x) => x.name);

    await prisma.menuPackageSection.update({
      where: { id: sec.id },
      data: {
        dishIds: newDishIds,
        dishes: newDishes,
      },
    });

    console.log(`  [${sec.package.name}] ${sec.label}: ${names.join(", ")}`);
    updated++;
  }

  console.log(`\nZakończono: zaktualizowano ${updated} sekcji.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
