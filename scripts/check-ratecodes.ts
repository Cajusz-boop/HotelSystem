#!/usr/bin/env node
/**
 * Listuje wszystkie stawki (RateCode) w bazie.
 */
import "dotenv/config";
import { prisma } from "../lib/db";

async function main() {
  const codes = await prisma.rateCode.findMany({
    select: { id: true, code: true, basePrice: true, pricePerPerson: true },
    orderBy: { code: "asc" },
  });
  console.log("RateCode (stawki):");
  codes.forEach((c) => console.log(`  ${c.code}: base=${c.basePrice} PLN, +${c.pricePerPerson} PLN/os`));
  console.log("\nAby przypisać stawkę do typu pokoju: Ustawienia → Pokoje → edycja typu pokoju → pole 'Domyślna stawka'");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
