import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/db";

async function main() {
  const defaultEmail = "admin@hotel.local";
  const existingUser = await prisma.user.findUnique({ where: { email: defaultEmail } }).catch(() => null);
  if (!existingUser) {
    const hash = await bcrypt.hash("admin123", 10);
    await prisma.user.create({
      data: {
        email: defaultEmail,
        name: "Administrator",
        passwordHash: hash,
        role: "MANAGER",
      },
    });
    console.log("Utworzono użytkownika:", defaultEmail, "(hasło: admin123)");
  }

  const defaultProperty = await prisma.property.upsert({
    where: { code: "default" },
    update: {},
    create: {
      name: "Obiekt główny",
      code: "default",
    },
  });

  const roomData = [
    { number: "101", type: "Queen", status: "CLEAN" as const, price: 300 },
    { number: "102", type: "Twin", status: "DIRTY" as const, price: 280 },
    { number: "103", type: "Suite", status: "OOO" as const, reason: "Broken AC", price: 550 },
    { number: "104", type: "Twin", status: "CLEAN" as const, price: 280 },
    { number: "105", type: "Queen", status: "OOO" as const, price: 300 },
    { number: "106", type: "Twin", status: "CLEAN" as const, price: 280 },
    { number: "201", type: "Suite", status: "OOO" as const, reason: "Renovation", price: 550 },
    { number: "202", type: "Queen", status: "CLEAN" as const, price: 300 },
  ];

  for (const r of roomData) {
    await prisma.room.upsert({
      where: { number: r.number },
      update: { propertyId: defaultProperty.id },
      create: {
        propertyId: defaultProperty.id,
        number: r.number,
        type: r.type,
        status: r.status,
        price: r.price,
        reason: r.reason,
      },
    });
  }

  // Firma testowa – dla auto-uzupełnienia NIP w formularzu meldunku
  await prisma.company.upsert({
    where: { nip: "5711640854" },
    update: {},
    create: {
      nip: "5711640854",
      name: "KARCZMA ŁABĘDŹ ŁUKASZ WOJENKOWSKI",
      address: "ul. Przykładowa 1",
      postalCode: "00-001",
      city: "WARSZAWA",
      country: "POL",
    },
  });

  const guestNames = ["Smith, J.", "Doe, A.", "Kowalski, P.", "Jan Kowalski", "Anna Nowak", "Thomas Smith"];
  const createdGuests = [];
  for (const name of guestNames) {
    let guest = await prisma.guest.findFirst({ where: { name } });
    if (!guest) {
      guest = await prisma.guest.create({ data: { name } });
    }
    createdGuests.push(guest);
  }

  await prisma.reservation.deleteMany({});

  const rooms = await prisma.room.findMany();
  const roomByNumber = new Map(rooms.map((r) => [r.number, r]));

  const reservations = [
    { guestIdx: 0, roomNum: "101", checkIn: "2026-02-07", checkOut: "2026-02-09", status: "CHECKED_IN" as const, pax: 2 },
    { guestIdx: 1, roomNum: "102", checkIn: "2026-02-09", checkOut: "2026-02-11", status: "CONFIRMED" as const, pax: 1 },
    { guestIdx: 2, roomNum: "104", checkIn: "2026-02-11", checkOut: "2026-02-14", status: "CONFIRMED" as const, pax: 1 },
    { guestIdx: 3, roomNum: "101", checkIn: "2026-02-10", checkOut: "2026-02-13", status: "CONFIRMED" as const, pax: 2 },
    { guestIdx: 4, roomNum: "202", checkIn: "2026-02-08", checkOut: "2026-02-12", status: "CONFIRMED" as const, pax: 2 },
    { guestIdx: 5, roomNum: "201", checkIn: "2026-02-07", checkOut: "2026-02-10", status: "CHECKED_IN" as const, pax: 1 },
  ];

  for (const r of reservations) {
    const room = roomByNumber.get(r.roomNum);
    const guest = createdGuests[r.guestIdx];
    if (!room || !guest) continue;
    await prisma.reservation.create({
      data: {
        guestId: guest.id,
        roomId: room.id,
        checkIn: new Date(r.checkIn),
        checkOut: new Date(r.checkOut),
        status: r.status,
        pax: r.pax,
      },
    });
  }

  console.log("Seed completed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
