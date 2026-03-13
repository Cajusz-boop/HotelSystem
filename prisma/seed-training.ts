/**
 * Seed danych treningowych dla hotel_training.
 * Uruchom: DATABASE_URL="mysql://hotel:PASS@localhost:3306/hotel_training" npx tsx prisma/seed-training.ts
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/db";
import type { RoomStatus } from "@prisma/client";
const d = (n: number) => {
  const x = new Date();
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() + n);
  return x;
};

export async function seedTraining(): Promise<void> {
  const today = d(0);

  // 1. Czyszczenie (kolejność ze względu na FK)
  await prisma.transaction.deleteMany({});
  await prisma.reservation.deleteMany({});
  await prisma.guest.deleteMany({});
  await prisma.company.deleteMany({});

  // 2. Property + Pokoje (jak w seed.ts, wszystkie CLEAN)
  const property = await prisma.property.upsert({
    where: { code: "default" },
    update: {},
    create: { name: "Obiekt treningowy", code: "default" },
  });

  function roomBedConfig(num: number) {
    if (num === 2) return { beds: 1, bedTypes: ["double" as const], maxOccupancy: 2 };
    if (num === 11) return { beds: 3, bedTypes: ["single", "single", "single", "sofa-bed"], maxOccupancy: 5 };
    return { beds: 2, bedTypes: ["single", "single", "sofa-bed"], maxOccupancy: 4 };
  }

  const roomData: Array<{
    number: string;
    type: string;
    status: RoomStatus;
    price: number;
    building: string;
    floor: string;
    beds: number;
    bedTypes: string[];
    maxOccupancy: number;
  }> = [
    ...Array.from({ length: 16 }, (_, i) => {
      const num = i + 1;
      const cfg = roomBedConfig(num);
      return {
        number: String(num),
        type: "Standard",
        status: "CLEAN" as RoomStatus,
        price: 300,
        building: "Karczma",
        floor: i < 8 ? "Parter" : "Piętro",
        ...cfg,
      };
    }),
    ...Array.from({ length: 7 }, (_, i) => {
      const num = 20 + i;
      const cfg = roomBedConfig(num);
      return {
        number: String(num),
        type: "Standard",
        status: "CLEAN" as RoomStatus,
        price: 280,
        building: "Sielska Izba",
        floor: "Parter",
        ...cfg,
      };
    }),
    ...Array.from({ length: 6 }, (_, i) => {
      const num = 27 + i;
      const cfg = roomBedConfig(num);
      return {
        number: String(num),
        type: "Standard",
        status: "CLEAN" as RoomStatus,
        price: 280,
        building: "Sielska Izba",
        floor: "Piętro",
        ...cfg,
      };
    }),
  ];

  for (const r of roomData) {
    await prisma.room.upsert({
      where: { number: r.number },
      update: {
        status: r.status,
        propertyId: property.id,
        building: r.building,
        floor: r.floor,
        beds: r.beds,
        bedTypes: r.bedTypes,
        maxOccupancy: r.maxOccupancy,
      },
      create: {
        propertyId: property.id,
        number: r.number,
        type: r.type,
        status: r.status,
        price: r.price,
        building: r.building,
        floor: r.floor,
        beds: r.beds,
        bedTypes: r.bedTypes,
        maxOccupancy: r.maxOccupancy,
      },
    });
  }

  const rooms = await prisma.room.findMany({ orderBy: { number: "asc" } });
  const roomByNum = new Map(rooms.map((r) => [r.number, r.id]));

  // 3. Goście (15)
  const guestNames = [
    "Anna Kowalska",
    "Jan Nowak",
    "Maria Wiśniewska",
    "Piotr Zając",
    "Katarzyna Dąbrowska",
    "Tomasz Wróbel",
    "Agnieszka Kaczmarek",
    "Robert Lewandowski",
    "Zofia Majewska",
    "Marek Kowalczyk",
    "Ewa Jabłońska",
    "Paweł Woźniak",
    "Magdalena Szymańska",
    "Krzysztof Wiśniewski",
    "Joanna Kamińska",
  ];
  const guests: { id: string; name: string }[] = [];
  for (let i = 0; i < guestNames.length; i++) {
    const name = guestNames[i];
    const email = name.toLowerCase().replace(/\s+/g, ".").replace(/ą/g, "a").replace(/ć/g, "c").replace(/ę/g, "e").replace(/ł/g, "l").replace(/ń/g, "n").replace(/ó/g, "o").replace(/ś/g, "s").replace(/ź|ż/g, "z") + "@training.test";
    const phone = `000-000-${String(i + 1).padStart(3, "0")}`;
    const g = await prisma.guest.create({
      data: { name, email, phone },
    });
    guests.push({ id: g.id, name });
  }

  // 4. Firma ABC
  const company = await prisma.company.create({
    data: {
      nip: "0000000000",
      name: "ABC Sp. z o.o.",
      address: "ul. Testowa 1",
      postalCode: "00-001",
      city: "Warszawa",
      country: "POL",
    },
  });

  // 5. Użytkownicy: recepcja (RECEPTION) + admin (MANAGER — do resetu danych)
  const recepHash = await bcrypt.hash("Trening2024!", 10);
  const pinHash = await bcrypt.hash("1234", 10);
  await prisma.user.upsert({
    where: { email: "recepcja@training.test" },
    update: { passwordHash: recepHash, pin: pinHash, name: "Recepcjonistka Testowa", role: "RECEPTION", isActive: true },
    create: {
      email: "recepcja@training.test",
      name: "Recepcjonistka Testowa",
      passwordHash: recepHash,
      pin: pinHash,
      role: "RECEPTION",
    },
  });
  const adminHash = await bcrypt.hash("Admin1234!", 10);
  await prisma.user.upsert({
    where: { email: "admin@training.test" },
    update: { passwordHash: adminHash, pin: pinHash, name: "Admin Testowy", role: "MANAGER", isActive: true },
    create: {
      email: "admin@training.test",
      name: "Admin Testowy",
      passwordHash: adminHash,
      pin: pinHash,
      role: "MANAGER",
    },
  });

  // 6. Rezerwacje
  const conf = (i: number) => `TRN-${String(i + 1).padStart(4, "0")}`;

  // 1. Anna Kowalska — CONFIRMED, przyjazd za 2 dni
  await prisma.reservation.create({
    data: {
      guestId: guests[0].id,
      roomId: roomByNum.get("3")!,
      checkIn: d(2),
      checkOut: d(4),
      status: "CONFIRMED",
      confirmationNumber: conf(1),
      pax: 2,
      rateCodePrice: 280,
    },
  });

  // 2. Jan Nowak — CHECKED_IN, przyjazd wczoraj, brak transakcji (ćwiczenie: rozlicz i wymelduj)
  const res2 = await prisma.reservation.create({
    data: {
      guestId: guests[1].id,
      roomId: roomByNum.get("4")!,
      checkIn: d(-1),
      checkOut: d(2),
      status: "CHECKED_IN",
      confirmationNumber: conf(2),
      pax: 2,
      rateCodePrice: 280,
    },
  });
  await prisma.transaction.create({
    data: {
      reservationId: res2.id,
      amount: 560,
      type: "ROOM",
      description: "Nocleg 2 noce",
      folioNumber: 1,
      status: "ACTIVE",
      category: "ACCOMMODATION",
    },
  });

  // 3. Maria Wiśniewska — CHECKED_IN, przyjazd 3 dni temu, transakcja GASTRONOMY 120 PLN
  const res3 = await prisma.reservation.create({
    data: {
      guestId: guests[2].id,
      roomId: roomByNum.get("5")!,
      checkIn: d(-3),
      checkOut: d(1),
      status: "CHECKED_IN",
      confirmationNumber: conf(3),
      pax: 2,
      rateCodePrice: 280,
    },
  });
  await prisma.transaction.createMany({
    data: [
      { reservationId: res3.id, amount: 840, type: "ROOM", description: "Nocleg 3 noce", folioNumber: 1, status: "ACTIVE", category: "ACCOMMODATION" },
      { reservationId: res3.id, amount: 120, type: "GASTRONOMY", description: "Restauracja", folioNumber: 1, status: "ACTIVE", category: "F_B", subcategory: "RESTAURANT" },
    ],
  });

  // 4. Piotr Zając — CHECKED_IN, saldo ujemne (obciążenie 350, wpłata 200)
  const res4 = await prisma.reservation.create({
    data: {
      guestId: guests[3].id,
      roomId: roomByNum.get("6")!,
      checkIn: d(-1),
      checkOut: d(2),
      status: "CHECKED_IN",
      confirmationNumber: conf(4),
      pax: 1,
      rateCodePrice: 350,
      paymentStatus: "PARTIAL",
    },
  });
  await prisma.transaction.createMany({
    data: [
      { reservationId: res4.id, amount: 350, type: "ROOM", description: "Nocleg", folioNumber: 1, status: "ACTIVE", category: "ACCOMMODATION" },
      { reservationId: res4.id, amount: -200, type: "DEPOSIT", paymentMethod: "CASH", folioNumber: 1, status: "ACTIVE" },
    ],
  });

  // 5, 6. Katarzyna Dąbrowska, Tomasz Wróbel — CHECKED_OUT wczoraj, firma ABC (faktura zbiorcza)
  const res5 = await prisma.reservation.create({
    data: {
      guestId: guests[4].id,
      roomId: roomByNum.get("7")!,
      companyId: company.id,
      checkIn: d(-3),
      checkOut: d(-1),
      status: "CHECKED_OUT",
      confirmationNumber: conf(5),
      pax: 2,
      rateCodePrice: 280,
      paymentStatus: "UNPAID",
    },
  });
  const res6 = await prisma.reservation.create({
    data: {
      guestId: guests[5].id,
      roomId: roomByNum.get("8")!,
      companyId: company.id,
      checkIn: d(-3),
      checkOut: d(-1),
      status: "CHECKED_OUT",
      confirmationNumber: conf(6),
      pax: 2,
      rateCodePrice: 280,
      paymentStatus: "UNPAID",
    },
  });
  await prisma.transaction.createMany({
    data: [
      { reservationId: res5.id, amount: 560, type: "ROOM", description: "Nocleg 2 noce", folioNumber: 1, status: "ACTIVE", category: "ACCOMMODATION" },
      { reservationId: res6.id, amount: 560, type: "ROOM", description: "Nocleg 2 noce", folioNumber: 1, status: "ACTIVE", category: "ACCOMMODATION" },
    ],
  });

  // 7. Agnieszka Kaczmarek — CONFIRMED, przyjazd dziś, pokój DIRTY
  const room7 = rooms.find((r) => r.number === "9");
  if (room7) {
    await prisma.room.update({ where: { id: room7.id }, data: { status: "DIRTY" } });
  }
  await prisma.reservation.create({
    data: {
      guestId: guests[6].id,
      roomId: roomByNum.get("9")!,
      checkIn: today,
      checkOut: d(2),
      status: "CONFIRMED",
      confirmationNumber: conf(7),
      pax: 2,
      rateCodePrice: 280,
    },
  });

  // 8. Robert Lewandowski — CHECKED_IN, VIP, MINIBAR 45 PLN
  const res8 = await prisma.reservation.create({
    data: {
      guestId: guests[7].id,
      roomId: roomByNum.get("10")!,
      checkIn: d(-2),
      checkOut: d(1),
      status: "CHECKED_IN",
      confirmationNumber: conf(8),
      pax: 1,
      rateCodePrice: 350,
      extraStatus: "VIP",
    },
  });
  await prisma.guest.update({
    where: { id: guests[7].id },
    data: { isVip: true, vipLevel: "GOLD" },
  });
  await prisma.transaction.createMany({
    data: [
      { reservationId: res8.id, amount: 1050, type: "ROOM", description: "Nocleg 3 noce VIP", folioNumber: 1, status: "ACTIVE", category: "ACCOMMODATION" },
      { reservationId: res8.id, amount: 45, type: "MINIBAR", description: "Minibar", folioNumber: 1, status: "ACTIVE", category: "F_B", subcategory: "MINIBAR" },
    ],
  });

  console.log("Seed treningowy zakończony. Użytkownicy: recepcja@training.test/Trening2024!, admin@training.test/Admin1234! (reset)");
}

async function main() {
  await seedTraining();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
