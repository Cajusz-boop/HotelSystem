/**
 * Jednorazowy skrypt: usuwa rezerwację pokój 002, 2026-03-27 – 2026-03-28, gość "szef".
 * Uruchom: npx tsx scripts/delete-reservation-002-szef.ts
 */
import "dotenv/config";
import { prisma } from "../lib/db";

async function main() {
  const reservationId = "cmlpf1xbe1iobv0vzltagpqfc";
  const r = await prisma.reservation.findUnique({
    where: { id: reservationId },
    include: { guest: { select: { name: true } }, room: { select: { number: true } } },
  });
  if (!r) {
    console.error("Rezerwacja nie istnieje:", reservationId);
    process.exit(1);
  }
  console.log("Usuwam rezerwację:", r.room.number, "|", r.guest.name, "|", r.checkIn.toISOString().slice(0, 10), "–", r.checkOut.toISOString().slice(0, 10));
  await prisma.reservation.delete({ where: { id: reservationId } });
  console.log("Usunięto.");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
