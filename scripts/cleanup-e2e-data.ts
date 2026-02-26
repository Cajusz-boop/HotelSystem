#!/usr/bin/env npx tsx
/**
 * FAZA 12: Sprzątanie danych testowych (prefix E2E_)
 * Usuwa rezerwacje, gości, obciążenia, płatności, dokumenty z prefixem E2E_ w nazwisku/opisie.
 *
 * Uruchom: npx tsx scripts/cleanup-e2e-data.ts
 */
import "dotenv/config";
import { prisma } from "../lib/db";

const E2E_PREFIX = "E2E";

async function main() {
  console.log("=== Sprzątanie danych E2E_ ===");

  const guests = await prisma.guest.findMany({
    where: { name: { contains: E2E_PREFIX } },
    select: { id: true },
  });
  const guestIds = guests.map((g) => g.id);

  if (guestIds.length === 0) {
    console.log("Brak gości z prefixem E2E_.");
    return;
  }

  const reservations = await prisma.reservation.findMany({
    where: { guestId: { in: guestIds } },
    select: { id: true },
  });
  const reservationIds = reservations.map((r) => r.id);

  let deleted = 0;

  if (reservationIds.length > 0) {
    const tx = prisma.transaction.deleteMany({ where: { reservationId: { in: reservationIds } } });
    const r = await tx;
    deleted += r.count;
  }

  await prisma.invoice.deleteMany({ where: { reservationId: { in: reservationIds } } });
  await prisma.receipt.deleteMany({ where: { reservationId: { in: reservationIds } } });

  await prisma.reservation.deleteMany({ where: { id: { in: reservationIds } } });
  deleted += reservationIds.length;

  await prisma.guest.deleteMany({ where: { id: { in: guestIds } } });
  deleted += guestIds.length;

  console.log(`Usunięto: ${reservations.length} rezerwacji, ${guests.length} gości`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
