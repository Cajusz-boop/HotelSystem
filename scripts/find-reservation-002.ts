/**
 * Szuka rezerwacji lub blokad dla pokoju 002 w okolicy 2026-03-27 – 2026-03-28.
 */
import "dotenv/config";
import { prisma } from "../lib/db";

async function main() {
  const rooms = await prisma.room.findMany({
    where: { number: { in: ["002", "2", " 002", "002 "] } },
    select: { id: true, number: true },
  });
  console.log("Pokoje pasujące do 002:", rooms);

  const roomIds = rooms.map((r) => r.id);
  if (roomIds.length === 0) {
    const allRooms = await prisma.room.findMany({ select: { number: true }, orderBy: { number: "asc" }, take: 30 });
    console.log("Przykładowe numery pokoi:", allRooms.map((r) => r.number).join(", "));
  }

  const checkInStart = new Date("2026-03-26");
  const checkOutEnd = new Date("2026-03-30");

  const reservations = await prisma.reservation.findMany({
    where: {
      roomId: roomIds.length ? { in: roomIds } : undefined,
      OR: [
        { checkIn: { gte: checkInStart, lt: checkOutEnd } },
        { checkOut: { gt: checkInStart, lte: checkOutEnd } },
      ],
    },
    include: { guest: { select: { name: true } }, room: { select: { number: true } } },
    orderBy: { checkIn: "asc" },
  });
  console.log("\nRezerwacje w tym okresie (pokój 002/2):", reservations.length);
  reservations.forEach((r) => {
    console.log("  ", r.id, "|", r.room.number, "|", r.guest.name, "|", r.checkIn.toISOString().slice(0, 10), "–", r.checkOut.toISOString().slice(0, 10), "|", r.status);
  });

  const blocks = await prisma.roomBlock.findMany({
    where: {
      roomId: roomIds.length ? { in: roomIds } : undefined,
      OR: [
        { startDate: { gte: checkInStart, lt: checkOutEnd } },
        { endDate: { gt: checkInStart, lte: checkOutEnd } },
      ],
    },
    include: { room: { select: { number: true } } },
  });
  console.log("\nBlokady pokoi (RoomBlock) w tym okresie:", blocks.length);
  blocks.forEach((b) => {
    console.log("  ", b.id, "|", b.room.number, "|", b.startDate.toISOString().slice(0, 10), "–", b.endDate.toISOString().slice(0, 10));
  });

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
