import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/db";

/**
 * POST /api/admin/reseed-rooms
 *
 * Re-seeds rooms and test reservations to match the canonical seed data.
 * Deletes rooms that don't belong to the seed (e.g. old 101-202 rooms),
 * upserts the correct 29 rooms (Karczma 1-16, Sielska Izba 20-32),
 * and recreates the test reservations.
 *
 * Requires admin.settings permission.
 */
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const allowed = await can(session.role, "admin.settings");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const logs: string[] = [];

    // 1. Upsert default property
    const defaultProperty = await prisma.property.upsert({
      where: { code: "default" },
      update: {},
      create: { name: "Obiekt główny", code: "default" },
    });
    logs.push(`Property: ${defaultProperty.id} (${defaultProperty.name})`);

    // 2. Define canonical room data
    const roomBedConfig = (num: number) => {
      if (num === 2) return { beds: 1, bedTypes: ["double"], maxOccupancy: 2 };
      if (num === 11) return { beds: 3, bedTypes: ["single", "single", "single", "sofa-bed"], maxOccupancy: 5 };
      return { beds: 2, bedTypes: ["single", "single", "sofa-bed"], maxOccupancy: 4 };
    };

    const roomData: Array<{
      number: string; type: string; status: "CLEAN"; price: number;
      building: string; floor: string; beds: number; bedTypes: string[]; maxOccupancy: number;
    }> = [
      // Karczma (rooms 1-16)
      ...Array.from({ length: 16 }, (_, i) => {
        const num = i + 1;
        const cfg = roomBedConfig(num);
        return {
          number: String(num), type: "Standard", status: "CLEAN" as const,
          price: 300, building: "Karczma", floor: i < 8 ? "Parter" : "Piętro", ...cfg,
        };
      }),
      // Sielska Izba - Parter (rooms 20-26)
      ...Array.from({ length: 7 }, (_, i) => {
        const num = 20 + i;
        const cfg = roomBedConfig(num);
        return {
          number: String(num), type: "Standard", status: "CLEAN" as const,
          price: 280, building: "Sielska Izba", floor: "Parter", ...cfg,
        };
      }),
      // Sielska Izba - Piętro (rooms 27-32)
      ...Array.from({ length: 6 }, (_, i) => {
        const num = 27 + i;
        const cfg = roomBedConfig(num);
        return {
          number: String(num), type: "Standard", status: "CLEAN" as const,
          price: 280, building: "Sielska Izba", floor: "Piętro", ...cfg,
        };
      }),
    ];

    const validNumbers = new Set(roomData.map((r) => r.number));

    // 3. Delete rooms that are NOT in the canonical set (e.g. old 101, 102, 103, ...)
    // First delete reservations referencing those rooms, then the rooms themselves
    const oldRooms = await prisma.room.findMany({
      where: { number: { notIn: [...validNumbers] } },
      select: { id: true, number: true },
    });

    if (oldRooms.length > 0) {
      const oldRoomIds = oldRooms.map((r) => r.id);
      // Delete dependent records
      const delReservations = await prisma.reservation.deleteMany({ where: { roomId: { in: oldRoomIds } } });
      logs.push(`Deleted ${delReservations.count} reservations from old rooms`);

      const delBlocks = await prisma.roomBlock.deleteMany({ where: { roomId: { in: oldRoomIds } } });
      logs.push(`Deleted ${delBlocks.count} room blocks from old rooms`);

      // Delete cleaning schedules, maintenance issues, etc.
      try { await prisma.cleaningSchedule.deleteMany({ where: { roomId: { in: oldRoomIds } } }); } catch { /* ignore */ }
      try { await prisma.maintenanceIssue.deleteMany({ where: { roomId: { in: oldRoomIds } } }); } catch { /* ignore */ }
      try { await prisma.roomGroupRoom.deleteMany({ where: { roomId: { in: oldRoomIds } } }); } catch { /* ignore */ }

      const delRooms = await prisma.room.deleteMany({ where: { id: { in: oldRoomIds } } });
      logs.push(`Deleted ${delRooms.count} old rooms: ${oldRooms.map((r) => r.number).join(", ")}`);
    } else {
      logs.push("No old rooms to delete");
    }

    // 4. Upsert canonical rooms
    let created = 0;
    let updated = 0;
    for (const r of roomData) {
      const existing = await prisma.room.findUnique({ where: { number: r.number } });
      if (existing) {
        await prisma.room.update({
          where: { number: r.number },
          data: {
            propertyId: defaultProperty.id,
            type: r.type,
            price: r.price,
            building: r.building,
            floor: r.floor,
            beds: r.beds,
            bedTypes: r.bedTypes,
            maxOccupancy: r.maxOccupancy,
          },
        });
        updated++;
      } else {
        await prisma.room.create({
          data: {
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
          },
        });
        created++;
      }
    }
    logs.push(`Rooms: ${created} created, ${updated} updated (total: ${roomData.length})`);

    // 5. Re-create test guests
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
          data: { name: g.name, email: g.email, phone: g.phone, dateOfBirth: new Date(g.dateOfBirth) },
        });
      } else {
        guest = await prisma.guest.update({
          where: { id: guest.id },
          data: { email: g.email, phone: g.phone, dateOfBirth: new Date(g.dateOfBirth) },
        });
      }
      createdGuests.push(guest);
    }
    logs.push(`Guests: ${createdGuests.length} upserted`);

    // 6. Delete ALL existing reservations and re-create test ones
    const delAll = await prisma.reservation.deleteMany({});
    logs.push(`Deleted ${delAll.count} existing reservations`);

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

    let resCreated = 0;
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
      resCreated++;
    }
    logs.push(`Reservations: ${resCreated} created`);

    // 7. Verify final state
    const finalRooms = await prisma.room.count();
    const finalRes = await prisma.reservation.count();
    logs.push(`Final state: ${finalRooms} rooms, ${finalRes} reservations`);

    return NextResponse.json({ success: true, logs });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Re-seed failed", detail: msg }, { status: 500 });
  }
}
