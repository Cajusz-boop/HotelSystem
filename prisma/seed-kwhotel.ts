import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/db";

async function main() {
  console.log("⏳ Resetting data for KWHotel demo seed…");

  await prisma.$transaction([
    prisma.parkingBooking.deleteMany(),
    prisma.parkingSpot.deleteMany(),
    prisma.roomBlock.deleteMany(),
    prisma.reservationGroup.deleteMany(),
    prisma.reservation.deleteMany(),
    prisma.guest.deleteMany(),
    prisma.room.deleteMany(),
    prisma.auditLog.deleteMany(),
  ]);

  const defaultProperty = await prisma.property.upsert({
    where: { code: "default" },
    update: { overbookingLimitPercent: 100 },
    create: {
      name: "Obiekt główny",
      code: "default",
      overbookingLimitPercent: 100,
    },
  });

  await prisma.parkingSpot.createMany({
    data: [
      { propertyId: defaultProperty.id, number: "P-01" },
      { propertyId: defaultProperty.id, number: "P-02" },
      { propertyId: defaultProperty.id, number: "P-03" },
      { propertyId: defaultProperty.id, number: "P-04" },
      { propertyId: defaultProperty.id, number: "P-05" },
    ],
  });

  // Firma testowa – dla E2E auto-uzupełnienia NIP (bez wywołania API WL)
  const testNip = "5711640854";
  await prisma.company.upsert({
    where: { nip: testNip },
    update: { name: "KARCZMA ŁABĘDŹ ŁUKASZ WOJENKOWSKI", address: "ul. Przykładowa 1", postalCode: "00-001", city: "WARSZAWA", country: "POL" },
    create: {
      nip: testNip,
      name: "KARCZMA ŁABĘDŹ ŁUKASZ WOJENKOWSKI",
      address: "ul. Przykładowa 1",
      postalCode: "00-001",
      city: "WARSZAWA",
      country: "POL",
    },
  });

  const adminEmail = "admin@hotel.local";
  const adminPassword = "admin123";
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const now = new Date();
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash, name: "Administrator", role: "MANAGER", passwordChangedAt: now },
    create: {
      email: adminEmail,
      name: "Administrator",
      passwordHash,
      role: "MANAGER",
      passwordChangedAt: now,
    },
  });
  console.log(`✔ Admin user ready: ${adminEmail} / ${adminPassword}`);

  const rooms: Array<{
    number: string;
    type: string;
    status: "CLEAN" | "DIRTY" | "OOO";
    price: number;
    reason?: string;
    roomFeatures?: string[];
  }> = [
    { number: "101", type: "Standard 2P", status: "CLEAN", price: 320, roomFeatures: ["balkon"] },
    { number: "102", type: "Standard 2P", status: "CLEAN", price: 320 },
    { number: "103", type: "Deluxe", status: "DIRTY", price: 420, roomFeatures: ["widok"] },
    { number: "104", type: "Deluxe", status: "CLEAN", price: 430, roomFeatures: ["balkon", "widok"] },
    { number: "105", type: "Suite", status: "OOO", reason: "Renowacja łazienki", price: 650, roomFeatures: ["balkon"] },
    { number: "201", type: "Suite", status: "CLEAN", price: 680, roomFeatures: ["widok"] },
    { number: "202", type: "Apartament", status: "CLEAN", price: 720, roomFeatures: ["balkon", "widok"] },
    { number: "203", type: "Apartament", status: "CLEAN", price: 720, roomFeatures: ["balkon"] },
    { number: "204", type: "Studio 3P", status: "CLEAN", price: 380 },
  ];

  await prisma.$transaction(
    rooms.map((room) =>
      prisma.room.create({
        data: {
          propertyId: defaultProperty.id,
          number: room.number,
          type: room.type,
          status: room.status,
          price: room.price,
          reason: room.reason,
          activeForSale: room.status !== "OOO",
          roomFeatures: room.roomFeatures ?? undefined,
        },
      })
    )
  );

  const guests = await prisma.$transaction(
    [
      "Adam Nowak",
      "Ewa Kowalska",
      "Piotr Zieliński",
      "Maria Konferencyjna",
      "Konferencja Liderzy 2026",
      "Anna Weekend",
      "Jan Biznes",
    ].map((name) => prisma.guest.create({ data: { name } }))
  );

  const roomMap = new Map(
    (await prisma.room.findMany({ select: { id: true, number: true } })).map((room) => [room.number, room.id])
  );

  const conferenceGroup = await prisma.reservationGroup.create({
    data: {
      name: "Konferencja Future Travel",
      note: "Pobyt grupowy: prezentacja KWHotel",
    },
  });

  const today = new Date("2026-02-11T00:00:00.000Z");
  const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86400000);

  const reservationsData = [
    {
      guest: guests[0],
      room: "101",
      checkIn: addDays(today, -1),
      checkOut: addDays(today, 2),
      status: "CHECKED_IN" as const,
      pax: 2,
    },
    {
      guest: guests[1],
      room: "102",
      checkIn: addDays(today, 1),
      checkOut: addDays(today, 4),
      status: "CONFIRMED" as const,
      pax: 1,
    },
    {
      guest: guests[2],
      room: "104",
      checkIn: addDays(today, -2),
      checkOut: addDays(today, 1),
      status: "CHECKED_IN" as const,
      pax: 1,
    },
    {
      guest: guests[3],
      room: "201",
      checkIn: addDays(today, 3),
      checkOut: addDays(today, 6),
      status: "CONFIRMED" as const,
      pax: 2,
      groupId: conferenceGroup.id,
    },
    {
      guest: guests[4],
      room: "202",
      checkIn: addDays(today, 3),
      checkOut: addDays(today, 6),
      status: "CONFIRMED" as const,
      pax: 1,
      groupId: conferenceGroup.id,
    },
    {
      guest: guests[4],
      room: "203",
      checkIn: addDays(today, 3),
      checkOut: addDays(today, 6),
      status: "CONFIRMED" as const,
      pax: 2,
      groupId: conferenceGroup.id,
    },
    {
      guest: guests[5],
      room: "204",
      checkIn: addDays(today, 2),
      checkOut: addDays(today, 5),
      status: "CONFIRMED" as const,
      pax: 3,
    },
    {
      guest: guests[6],
      room: "103",
      checkIn: addDays(today, 5),
      checkOut: addDays(today, 8),
      status: "CONFIRMED" as const,
      pax: 1,
    },
  ];

  await prisma.$transaction(
    reservationsData.map((data) =>
      prisma.reservation.create({
        data: {
          guestId: data.guest.id,
          roomId: roomMap.get(data.room)!,
          checkIn: data.checkIn,
          checkOut: data.checkOut,
          status: data.status,
          pax: data.pax,
          groupId: data.groupId ?? null,
        },
      })
    )
  );

  const blocks = [
    { room: "105", start: addDays(today, 0), end: addDays(today, 7), reason: "Remont łazienki" },
    { room: "103", start: addDays(today, 0), end: addDays(today, 1), reason: "Sprzątanie generalne" },
  ];

  await prisma.$transaction(
    blocks.map((block) =>
      prisma.roomBlock.create({
        data: {
          roomId: roomMap.get(block.room)!,
          startDate: block.start,
          endDate: block.end,
          reason: block.reason,
        },
      })
    )
  );

  console.log("✔ KWHotel demo seed completed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
