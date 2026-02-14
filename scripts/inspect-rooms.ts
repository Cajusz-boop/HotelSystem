import { prisma } from "../lib/db";

async function main() {
  const rooms = await prisma.room.findMany({
    select: { id: true, number: true, status: true, activeForSale: true },
    orderBy: { number: "asc" },
  });
  const reservations = await prisma.reservation.findMany({
    select: { roomId: true, checkIn: true, checkOut: true, status: true },
    orderBy: { checkIn: "asc" },
  });
  console.log("Rooms:", rooms);
  console.log(
    "Reservations:",
    reservations.map((r) => ({
      ...r,
      checkIn: r.checkIn.toISOString().slice(0, 10),
      checkOut: r.checkOut.toISOString().slice(0, 10),
    }))
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
