#!/usr/bin/env npx tsx
/**
 * Migracja: ustaw eventDate = dateFrom gdzie eventDate IS NULL.
 * Uruchom: npx tsx scripts/fix-eventdate-null.ts
 */
import { prisma } from "../lib/db";

async function main() {
  const result = await prisma.$executeRaw`
    UPDATE EventOrder
    SET eventDate = dateFrom
    WHERE eventDate IS NULL AND dateFrom IS NOT NULL
  `;
  console.log(`Zaktualizowano ${result} rekordów (eventDate = dateFrom).`);

  const stillNull = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) as count FROM EventOrder WHERE eventDate IS NULL
  `;
  const count = Number(stillNull[0]?.count ?? 0);
  if (count === 0) {
    console.log("✅ Weryfikacja: 0 rekordów z eventDate IS NULL.");
  } else {
    console.log(`⚠️ Uwaga: ${count} rekordów nadal ma eventDate IS NULL.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
