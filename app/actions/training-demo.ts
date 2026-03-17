"use server";

import { prisma } from "@/lib/db";
import { getEffectivePropertyId } from "./properties";
import { revalidatePath } from "next/cache";

const DEMO_PREFIX = "[DEMO-SZKOLENIE]";

/** Generuje unikalny numer potwierdzenia dla rezerwacji demo */
function genConfNum(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "TRN-";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

/** Tworzy dane demo szkoleniowe: goście, rezerwacje, statusy pokoi, płatności */
export async function setupTrainingDemo(): Promise<
  { success: true; created: { guests: number; reservations: number; transactions: number } } | { success: false; error: string }
> {
  try {
    const propertyId = await getEffectivePropertyId();
    if (!propertyId) {
      return { success: false, error: "Brak obiektu. Skonfiguruj obiekt w ustawieniach." };
    }

    const rooms = await prisma.room.findMany({
      where: { propertyId, isDeleted: false },
      orderBy: { number: "asc" },
      take: 20,
    });
    if (rooms.length === 0) {
      return { success: false, error: "Brak pokoi. Uruchom seed (npm run db:seed) lub dodaj pokoje." };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const toDate = (d: Date) => d.toISOString().slice(0, 10);

    // 1. Goście demo
    const guestData = [
      { name: "Maria Nowak-Szkolenie", email: "maria.nowak@demo.pl", phone: "+48 501 111 001", isVip: true },
      { name: "Piotr Kowalczyk-Szkolenie", email: "piotr.kowalczyk@demo.pl", phone: "+48 502 222 002", isVip: false },
      { name: "Anna Wiśniewska-Szkolenie", email: "anna.wisniewska@demo.pl", phone: "+48 503 333 003", isVip: true },
      { name: "Jan Zieliński-Szkolenie", email: "jan.zielinski@demo.pl", phone: "+48 504 444 004", isVip: false },
      { name: "Katarzyna Dąbrowska-Szkolenie", email: "katarzyna.dabrowska@demo.pl", phone: "+48 505 555 005", isVip: false },
      { name: "Tomasz Lewandowski-Szkolenie", email: "tomasz.lewandowski@demo.pl", phone: "+48 506 666 006", isVip: false },
      { name: "Ewa Wójcik-Szkolenie", email: "ewa.wojcik@demo.pl", phone: "+48 507 777 007", isVip: true },
      { name: "Michał Kamiński-Szkolenie", email: "michal.kaminski@demo.pl", phone: "+48 508 888 008", isVip: false },
      { name: "Agnieszka Kaczmarek-Szkolenie", email: "agnieszka.kaczmarek@demo.pl", phone: "+48 509 999 009", isVip: false },
      { name: "Andrzej Czarny-Szkolenie", email: "andrzej.czarny@demo.pl", phone: "+48 510 000 010", isVip: false, isBlacklisted: true },
    ];

    const createdGuests: { id: string }[] = [];
    for (const g of guestData) {
      const existing = await prisma.guest.findFirst({
        where: { name: g.name },
        select: { id: true },
      });
      if (existing) {
        createdGuests.push(existing);
      } else {
        const guest = await prisma.guest.create({
          data: {
            name: g.name,
            email: g.email,
            phone: g.phone,
            isVip: g.isVip ?? false,
            isBlacklisted: g.isBlacklisted ?? false,
            segment: "LEISURE",
            staffNotes: DEMO_PREFIX,
          },
        });
        createdGuests.push(guest);
      }
    }

    // 2. Rezerwacje demo (bez nakładania się w tym samym pokoju)
    const d = (n: number) => {
      const x = new Date(today);
      x.setDate(x.getDate() + n);
      return toDate(x);
    };

    type ResDef = { guestIdx: number; roomNum: string; checkIn: string; checkOut: string; status: string; pax: number; source?: string; paymentStatus?: string };
    const resDefs: ResDef[] = [
      { guestIdx: 0, roomNum: rooms[0]?.number ?? "1", checkIn: d(-2), checkOut: d(1), status: "CHECKED_IN", pax: 2, source: "PHONE", paymentStatus: "PAID" },
      { guestIdx: 1, roomNum: rooms[1]?.number ?? "2", checkIn: d(0), checkOut: d(2), status: "CONFIRMED", pax: 2, source: "BOOKING_ENGINE", paymentStatus: "PARTIAL" },
      { guestIdx: 2, roomNum: rooms[2]?.number ?? "3", checkIn: d(1), checkOut: d(4), status: "CONFIRMED", pax: 1, source: "EMAIL", paymentStatus: "UNPAID" },
      { guestIdx: 3, roomNum: rooms[3]?.number ?? "4", checkIn: d(2), checkOut: d(5), status: "PENDING", pax: 2, source: "WEBSITE", paymentStatus: "UNPAID" },
      { guestIdx: 4, roomNum: rooms[4]?.number ?? "5", checkIn: d(-3), checkOut: d(-1), status: "CHECKED_OUT", pax: 2, source: "WALK_IN", paymentStatus: "PAID" },
      { guestIdx: 5, roomNum: rooms[5]?.number ?? "6", checkIn: d(3), checkOut: d(6), status: "CONFIRMED", pax: 3, source: "OTA", paymentStatus: "UNPAID" },
      { guestIdx: 6, roomNum: rooms[6]?.number ?? "7", checkIn: d(0), checkOut: d(3), status: "CHECKED_IN", pax: 1, source: "PHONE", paymentStatus: "PARTIAL" },
      { guestIdx: 7, roomNum: rooms[7]?.number ?? "8", checkIn: d(-5), checkOut: d(-3), status: "CHECKED_OUT", pax: 2, source: "DIRECT", paymentStatus: "PAID" },
      { guestIdx: 8, roomNum: rooms[8]?.number ?? "9", checkIn: d(-1), checkOut: d(0), status: "NO_SHOW", pax: 2, source: "BOOKING_ENGINE", paymentStatus: "UNPAID" },
      { guestIdx: 9, roomNum: rooms[9]?.number ?? "10", checkIn: d(4), checkOut: d(7), status: "CANCELLED", pax: 2, source: "PHONE", paymentStatus: "UNPAID" },
      { guestIdx: 0, roomNum: rooms[10]?.number ?? "11", checkIn: d(5), checkOut: d(8), status: "CONFIRMED", pax: 2, source: "PHONE", paymentStatus: "UNPAID" },
      { guestIdx: 1, roomNum: rooms[11]?.number ?? "12", checkIn: d(6), checkOut: d(9), status: "CONFIRMED", pax: 1, source: "WALK_IN", paymentStatus: "UNPAID" },
      // Konflikt: ta sama sala co powyżej (room 2), nakładające się daty — do screenshotu konfliktów
      { guestIdx: 2, roomNum: rooms[1]?.number ?? "2", checkIn: d(1), checkOut: d(3), status: "CONFIRMED", pax: 2, source: "PHONE", paymentStatus: "UNPAID" },
    ];

    const roomByNum = new Map(rooms.map((r) => [r.number, r.id]));
    let reservationsCreated = 0;

    for (const r of resDefs) {
      const roomId = roomByNum.get(r.roomNum);
      const guest = createdGuests[r.guestIdx];
      if (!roomId || !guest) continue;

      const confNum = `TRN-${Date.now().toString(36).slice(-6).toUpperCase()}-${reservationsCreated}`;
      const existingByConf = await prisma.reservation.findUnique({ where: { confirmationNumber: confNum } });
      const finalConf = existingByConf ? genConfNum() : confNum;

      await prisma.reservation.create({
        data: {
          guestId: guest.id,
          roomId,
          checkIn: new Date(r.checkIn),
          checkOut: new Date(r.checkOut),
          status: r.status as "PENDING" | "CONFIRMED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED" | "NO_SHOW",
          pax: r.pax,
          source: r.source ?? "PHONE",
          channel: "DIRECT",
          paymentStatus: r.paymentStatus ?? "UNPAID",
          confirmationNumber: finalConf,
          internalNotes: DEMO_PREFIX,
          rateCodePrice: 280,
        },
      });
      reservationsCreated++;
    }

    // 3. Statusy pokoi — różnorodne
    const roomStatusUpdates: Array<{ number: string; status: string; reason?: string }> = [
      { number: rooms[0]?.number ?? "1", status: "DIRTY" },
      { number: rooms[1]?.number ?? "2", status: "INSPECTION" },
      { number: rooms[2]?.number ?? "3", status: "CLEAN" },
      { number: rooms[3]?.number ?? "4", status: "CHECKOUT_PENDING" },
      { number: rooms[12]?.number ?? "13", status: "OOO", reason: "Remont — demo szkoleniowe" },
      { number: rooms[13]?.number ?? "14", status: "MAINTENANCE", reason: "Konserwacja klimatyzacji — demo" },
    ];

    for (const u of roomStatusUpdates) {
      const room = rooms.find((r) => r.number === u.number);
      if (room) {
        await prisma.room.update({
          where: { id: room.id },
          data: {
            status: u.status as "CLEAN" | "DIRTY" | "OOO" | "INSPECTION" | "INSPECTED" | "CHECKOUT_PENDING" | "MAINTENANCE",
            reason: u.reason ?? undefined,
          },
        });
      }
    }

    // 4. Transakcje (płatności) dla rezerwacji CHECKED_IN i CHECKED_OUT
    const demoReservations = await prisma.reservation.findMany({
      where: { internalNotes: { contains: DEMO_PREFIX } },
      select: { id: true, status: true, paymentStatus: true },
    });

    let transactionsCreated = 0;
    for (const res of demoReservations) {
      if (res.status !== "CHECKED_IN" && res.status !== "CHECKED_OUT") continue;

      const existingTx = await prisma.transaction.count({
        where: { reservationId: res.id },
      });
      if (existingTx > 0) continue;

      const roomCharge = 560;
      const deposit = 200;

      await prisma.transaction.create({
        data: {
          reservationId: res.id,
          amount: roomCharge,
          type: "ROOM",
          description: "Usługa hotelowa — demo szkoleniowe",
          folioNumber: 1,
          status: "ACTIVE",
          category: "ACCOMMODATION",
        },
      });
      transactionsCreated++;

      if (res.paymentStatus === "PAID" || res.paymentStatus === "PARTIAL") {
        await prisma.transaction.create({
          data: {
            reservationId: res.id,
            amount: res.paymentStatus === "PAID" ? roomCharge : deposit,
            type: "PAYMENT",
            paymentMethod: res.paymentStatus === "PAID" ? "CARD" : "CASH",
            folioNumber: 1,
            status: "ACTIVE",
          },
        });
        transactionsCreated++;
      }

      if (res.status === "CHECKED_IN") {
        await prisma.transaction.create({
          data: {
            reservationId: res.id,
            amount: 35,
            type: "MINIBAR",
            description: "Minibar — demo",
            folioNumber: 1,
            status: "ACTIVE",
            category: "F_B",
            subcategory: "MINIBAR",
          },
        });
        transactionsCreated++;
      }
    }

    revalidatePath("/training");
    revalidatePath("/front-office");
    revalidatePath("/dashboard");
    revalidatePath("/kontrahenci");
    revalidatePath("/housekeeping");
    revalidatePath("/ksiega-meldunkowa");

    return {
      success: true,
      created: {
        guests: createdGuests.length,
        reservations: reservationsCreated,
        transactions: transactionsCreated,
      },
    };
  } catch (e) {
    console.error("[setupTrainingDemo]", e);
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd tworzenia danych demo",
    };
  }
}

/** Usuwa dane demo (rezerwacje z internalNotes zawierającym DEMO_PREFIX; goście z staffNotes; przywraca statusy pokoi) */
export async function cleanupTrainingDemo(): Promise<
  { success: true; removed: { reservations: number; transactions: number } } | { success: false; error: string }
> {
  try {
    const demoReservations = await prisma.reservation.findMany({
      where: { internalNotes: { contains: DEMO_PREFIX } },
      select: { id: true },
    });

    const resIds = demoReservations.map((r) => r.id);
    const txCount = await prisma.transaction.count({
      where: { reservationId: { in: resIds } },
    });

    await prisma.reservation.deleteMany({
      where: { id: { in: resIds } },
    });

    // Opcjonalnie: usuń gości demo (tylko jeśli nie mają innych rezerwacji)
    const demoGuests = await prisma.guest.findMany({
      where: { staffNotes: { contains: DEMO_PREFIX } },
      select: { id: true },
    });
    for (const g of demoGuests) {
      const otherRes = await prisma.reservation.count({
        where: { guestId: g.id },
      });
      if (otherRes === 0) {
        await prisma.guest.delete({ where: { id: g.id } });
      }
    }

    // Przywróć statusy pokoi do CLEAN (opcjonalnie)
    await prisma.room.updateMany({
      where: { reason: { contains: "demo" } },
      data: { status: "CLEAN", reason: null },
    });

    revalidatePath("/training");
    revalidatePath("/front-office");
    revalidatePath("/dashboard");
    revalidatePath("/kontrahenci");
    revalidatePath("/housekeeping");

    return {
      success: true,
      removed: { reservations: demoReservations.length, transactions: txCount },
    };
  } catch (e) {
    console.error("[cleanupTrainingDemo]", e);
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd usuwania danych demo",
    };
  }
}
