import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const r = await p.reservation.findMany({ include: { guest: true, room: true } });
const rooms = await p.room.findMany();
console.log("Reservations:", r.length);
console.log("Rooms:", rooms.length);
if (r.length > 0) {
  const sample = r[0];
  console.log("Sample reservation:", { id: sample.id, room: sample.room?.number, checkIn: sample.checkIn });
}
await p.$disconnect();
