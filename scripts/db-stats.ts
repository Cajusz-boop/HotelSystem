#!/usr/bin/env npx tsx
/** Wypisuje statystyki bazy: rezerwacje, goście, pokoje. Uruchom: npx tsx scripts/db-stats.ts */
import "dotenv/config";
import { prisma } from "../lib/db";

async function main() {
  const [reservations, guests, rooms, invoices] = await Promise.all([
    prisma.reservation.count(),
    prisma.guest.count(),
    prisma.room.count(),
    prisma.invoice.count(),
  ]);
  console.log("=== STATYSTYKI BAZY ===");
  console.log(`Rezerwacje: ${reservations}`);
  console.log(`Goście:     ${guests}`);
  console.log(`Pokoje:     ${rooms}`);
  console.log(`Faktury:    ${invoices}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
