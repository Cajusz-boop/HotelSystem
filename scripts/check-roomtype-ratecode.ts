#!/usr/bin/env node
/**
 * Szybki skrypt: sprawdza czy RoomType ma przypisany rateCodeId.
 * Uruchom: npx tsx scripts/check-roomtype-ratecode.ts
 */
import "dotenv/config";
import { prisma } from "../lib/db";

async function main() {
  const types = await prisma.roomType.findMany({
    select: {
      name: true,
      rateCodeId: true,
      rateCode: { select: { code: true, basePrice: true } },
    },
  });
  console.log("RoomType -> rateCode:");
  types.forEach((t) => {
    const rc = t.rateCodeId ? `${t.rateCode?.code ?? t.rateCodeId} (base: ${t.rateCode?.basePrice ?? "?"})` : "BRAK";
    console.log(`  ${t.name}: ${rc}`);
  });
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
