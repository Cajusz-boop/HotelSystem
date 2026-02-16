import "dotenv/config";
import { prisma } from "../lib/db";

async function main() {
  const resCount = await prisma.reservation.count();
  console.log("Rezerwacje w bazie:", resCount);

  const rooms = await prisma.room.findMany({ select: { id: true, number: true }, orderBy: { number: "asc" } });
  console.log("Pokoje:", rooms.length, "->", rooms.map(r => r.number).join(", "));

  if (resCount > 0) {
    const sample = await prisma.reservation.findMany({
      take: 10,
      include: { room: { select: { number: true } }, guest: { select: { name: true } } },
      orderBy: { checkIn: "desc" },
    });
    console.log("\nOstatnie rezerwacje:");
    for (const r of sample) {
      console.log(`  ${r.room.number} | ${r.guest.name} | ${r.checkIn.toISOString().slice(0, 10)} -> ${r.checkOut.toISOString().slice(0, 10)} | ${r.status}`);
    }
  }

  // Check if any reservation has a roomId that doesn't match any room
  const orphanedRes = await prisma.reservation.findMany({
    where: { room: { is: undefined } },
  }).catch(() => []);
  console.log("\nOsierocone rezerwacje (brak pokoju):", orphanedRes.length);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
