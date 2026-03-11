#!/usr/bin/env node
/**
 * Przypisuje domyślne stawki (RateCode) do typów pokoi (RoomType).
 * Mapowanie na podstawie nazwy typu (np. "COMFORT - z widokiem" → COMF.WID).
 *
 * Uruchom: npx tsx scripts/assign-ratecodes-to-roomtypes.ts
 * Dry-run: ASSIGN_DRY_RUN=1 npx tsx scripts/assign-ratecodes-to-roomtypes.ts
 */
import "dotenv/config";
import { prisma } from "../lib/db";

const DRY_RUN = process.env.ASSIGN_DRY_RUN === "1";

function mapRoomTypeToRateCode(roomTypeName: string): string | null {
  const n = roomTypeName.toUpperCase().replace(/\s+/g, " ");
  const hasWidok = /WIDOK|WID\.|WID/.test(n);

  // COMFORT variants
  if (/COMFORT|COMF/.test(n)) {
    return hasWidok ? "COMF.WID" : "COMF.BEZ";
  }
  // SIELSKI variants
  if (/SIELSKI|SIEL/.test(n)) {
    return hasWidok ? "SIEL.WID" : "SIEL.BEZ";
  }
  // Fallback dla pozostałych (Standard, Queen, Twin, Suite, Deluxe, Apartament, Studio, Biuro)
  return "STAŁY";
}

async function main() {
  const codes = await prisma.rateCode.findMany({
    select: { id: true, code: true },
  });
  const codeByCode = Object.fromEntries(codes.map((c) => [c.code, c.id]));

  const types = await prisma.roomType.findMany({
    select: { id: true, name: true, rateCodeId: true },
  });

  let updated = 0;
  for (const t of types) {
    const rateCode = mapRoomTypeToRateCode(t.name);
    if (!rateCode || !codeByCode[rateCode]) {
      console.log(`  ⏭ ${t.name} → brak stawki (${rateCode ?? "?"})`);
      continue;
    }
    const newId = codeByCode[rateCode];
    if (t.rateCodeId === newId) {
      console.log(`  ✓ ${t.name} → ${rateCode} (bez zmian)`);
      continue;
    }
    if (!DRY_RUN) {
      await prisma.roomType.update({
        where: { id: t.id },
        data: { rateCodeId: newId },
      });
    }
    console.log(`  ${DRY_RUN ? "[DRY] " : ""}✏ ${t.name} → ${rateCode}`);
    updated++;
  }

  console.log(`\n${DRY_RUN ? "[DRY-RUN] " : ""}Zaktualizowano: ${updated} typów pokoi`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
