import "dotenv/config";
import bcrypt from "bcryptjs";
import { existsSync } from "fs";
import { join } from "path";
import { prisma } from "../lib/db";
import { clearPermissionsCache } from "../lib/permissions";

async function importConfigSnapshot() {
  const snapshotPath = join(__dirname, "config-snapshot.json");
  if (!existsSync(snapshotPath)) {
    console.log("Brak config-snapshot.json — pomijam import konfiguracji.");
    return;
  }
  console.log("Importuję konfigurację z config-snapshot.json...");
  const { execSync } = await import("child_process");
  execSync("npx tsx prisma/config-import.ts", { stdio: "inherit", cwd: join(__dirname, "..") });
}

async function main() {
  const defaultEmail = "admin@hotel.local";
  const existingUser = await prisma.user.findUnique({ where: { email: defaultEmail } }).catch(() => null);
  if (!existingUser) {
    const hash = await bcrypt.hash("Admin1234#", 10);
    const pinHash = await bcrypt.hash("1234", 10);
    await prisma.user.create({
      data: {
        email: defaultEmail,
        name: "Administrator",
        passwordHash: hash,
        pin: pinHash,
        role: "MANAGER",
      },
    });
    console.log("Utworzono użytkownika:", defaultEmail, "(hasło: Admin1234#, PIN: 1234)");
  } else if (!existingUser.pin) {
    const pinHash = await bcrypt.hash("1234", 10);
    await prisma.user.update({
      where: { email: defaultEmail },
      data: { pin: pinHash },
    });
    console.log("Ustawiono PIN dla:", defaultEmail, "(PIN: 1234)");
  }

  // Użytkownik Google OAuth (logowanie przez Google Workspace)
  const googleEmail = "lukasz.wojenkowski@labedzhotel.pl";
  const existingGoogleUser = await prisma.user.findUnique({ where: { email: googleEmail } }).catch(() => null);
  if (!existingGoogleUser) {
    const hash = await bcrypt.hash(crypto.randomUUID(), 10);
    await prisma.user.create({
      data: {
        email: googleEmail,
        name: "Łukasz Wojenkowski",
        passwordHash: hash,
        role: "MANAGER",
        passwordChangedAt: new Date(),
      },
    });
    console.log("Utworzono użytkownika Google:", googleEmail);
  }

  const defaultProperty = await prisma.property.upsert({
    where: { code: "default" },
    update: {},
    create: {
      name: "Obiekt główny",
      code: "default",
    },
  });

  // Karczma – 16 pokoi (nr 1–16)
  // Sielska Izba – 12 pokoi (nr 20–26 parter, nr 27–32 piętro)
  //
  // Domyślnie: 2 łóżka + kanapa rozsuwana 2-os. (maxOcc 4)
  // Wyjątki:
  //   pok. 2  – tylko łóżko małżeńskie (maxOcc 2)
  //   pok. 11 – 3 łóżka + kanapa 2-os. (maxOcc 5)

  function roomBedConfig(num: number) {
    if (num === 2) {
      return { beds: 1, bedTypes: ["double"], maxOccupancy: 2 };
    }
    if (num === 11) {
      return { beds: 3, bedTypes: ["single", "single", "single", "sofa-bed"], maxOccupancy: 5 };
    }
    return { beds: 2, bedTypes: ["single", "single", "sofa-bed"], maxOccupancy: 4 };
  }

  const roomData: Array<{
    number: string;
    type: string;
    status: "CLEAN" | "DIRTY" | "OOO";
    price: number;
    building: string;
    floor: string;
    beds: number;
    bedTypes: string[];
    maxOccupancy: number;
    reason?: string;
  }> = [
    // ── Karczma (pokoje 1–16) ──
    ...Array.from({ length: 16 }, (_, i) => {
      const num = i + 1;
      const cfg = roomBedConfig(num);
      return {
        number: String(num),
        type: "Standard",
        status: "CLEAN" as const,
        price: 300,
        building: "Karczma",
        floor: i < 8 ? "Parter" : "Piętro",
        ...cfg,
      };
    }),
    // ── Sielska Izba – parter (pokoje 20–26) ──
    ...Array.from({ length: 7 }, (_, i) => {
      const num = 20 + i;
      const cfg = roomBedConfig(num);
      return {
        number: String(num),
        type: "Standard",
        status: "CLEAN" as const,
        price: 280,
        building: "Sielska Izba",
        floor: "Parter",
        ...cfg,
      };
    }),
    // ── Sielska Izba – piętro (pokoje 27–32) ──
    ...Array.from({ length: 6 }, (_, i) => {
      const num = 27 + i;
      const cfg = roomBedConfig(num);
      return {
        number: String(num),
        type: "Standard",
        status: "CLEAN" as const,
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
        propertyId: defaultProperty.id,
        building: r.building,
        floor: r.floor,
        beds: r.beds,
        bedTypes: r.bedTypes,
        maxOccupancy: r.maxOccupancy,
      },
      create: {
        propertyId: defaultProperty.id,
        number: r.number,
        type: r.type,
        status: r.status,
        price: r.price,
        building: r.building,
        floor: r.floor,
        beds: r.beds,
        bedTypes: r.bedTypes,
        maxOccupancy: r.maxOccupancy,
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

  const guestTestData = [
    { name: "Jan Kowalski", email: "jan.kowalski@example.com", phone: "+48 123 456 789", dateOfBirth: "1985-03-15" },
    { name: "Anna Nowak", email: "anna.nowak@example.com", phone: "+48 987 654 321", dateOfBirth: "1990-07-22" },
    { name: "Thomas Smith", email: "thomas.smith@example.com", phone: "+48 555 123 456", dateOfBirth: "1978-11-08" },
    { name: "Smith, J.", email: "john.smith@test.pl", phone: "601234567", dateOfBirth: "1982-01-20" },
    { name: "Doe, A.", email: "anna.doe@test.pl", phone: "602345678", dateOfBirth: "1995-05-12" },
    { name: "Kowalski, P.", email: "piotr.kowalski@test.pl", phone: "603456789", dateOfBirth: "1988-09-30" },
  ];
  const createdGuests: { id: string }[] = [];
  for (const g of guestTestData) {
    let guest = await prisma.guest.findFirst({ where: { name: g.name } });
    if (!guest) {
      guest = await prisma.guest.create({
        data: {
          name: g.name,
          email: g.email,
          phone: g.phone,
          dateOfBirth: new Date(g.dateOfBirth),
        },
      });
    } else {
      guest = await prisma.guest.update({
        where: { id: guest.id },
        data: { email: g.email, phone: g.phone, dateOfBirth: new Date(g.dateOfBirth) },
      });
    }
    createdGuests.push(guest);
  }

  // Ochrona produkcji: NIGDY nie usuwaj rezerwacji, chyba że jawnie SEED_RESET_RESERVATIONS=1
  const allowReset = process.env.SEED_RESET_RESERVATIONS === "1";
  const reservationCount = await prisma.reservation.count();

  if (reservationCount > 0 && !allowReset) {
    console.log(`Pomijam rezerwacje: w bazie jest ${reservationCount} rezerwacji (ochrona produkcji). Aby zresetować: SEED_RESET_RESERVATIONS=1 npm run db:seed`);
  } else if (allowReset || reservationCount === 0) {
    if (allowReset && reservationCount > 0) {
      await prisma.reservation.deleteMany({});
      console.log(`Usunięto ${reservationCount} rezerwacji (SEED_RESET_RESERVATIONS=1)`);
    }

  const rooms = await prisma.room.findMany();
  const roomByNumber = new Map(rooms.map((r) => [r.number, r]));

  const reservations = [
    { guestIdx: 0, roomNum: "1", checkIn: "2026-02-07", checkOut: "2026-02-09", status: "CHECKED_IN" as const, pax: 2 },
    { guestIdx: 1, roomNum: "2", checkIn: "2026-02-09", checkOut: "2026-02-11", status: "CONFIRMED" as const, pax: 1 },
    { guestIdx: 2, roomNum: "4", checkIn: "2026-02-11", checkOut: "2026-02-14", status: "CONFIRMED" as const, pax: 1 },
    { guestIdx: 3, roomNum: "1", checkIn: "2026-02-10", checkOut: "2026-02-13", status: "CONFIRMED" as const, pax: 2 },
    { guestIdx: 4, roomNum: "20", checkIn: "2026-02-08", checkOut: "2026-02-12", status: "CONFIRMED" as const, pax: 2 },
    { guestIdx: 5, roomNum: "21", checkIn: "2026-02-07", checkOut: "2026-02-10", status: "CHECKED_IN" as const, pax: 1 },
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
  }

  await importConfigSnapshot();

  // Nadaj roli RECEPTION dostęp do modułów (w tym Finanse) — config-snapshot ma tylko MANAGER
  const receptionModules = [
    "module.dashboard",
    "module.front_office",
    "module.check_in",
    "module.guests",
    "module.companies",
    "module.rooms",
    "module.rates",
    "module.finance",
    "module.reports",
    "module.housekeeping",
  ];
  const permissions = await prisma.permission.findMany({
    where: { code: { in: receptionModules } },
    select: { id: true },
  });
  if (permissions.length > 0) {
    const { count } = await prisma.rolePermission.createMany({
      data: permissions.map((p) => ({ role: "RECEPTION", permissionId: p.id })),
      skipDuplicates: true,
    });
    if (count > 0) {
      clearPermissionsCache();
      console.log(`Przypisano ${count} uprawnień do roli RECEPTION (module.finance itd.)`);
    }
  }

  console.log("Seed completed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
