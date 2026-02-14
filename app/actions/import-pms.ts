"use server";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { createReservation } from "@/app/actions/reservations";

export type ImportGuestRow = {
  name: string;
  email?: string | null;
  phone?: string | null;
};

export type ImportRoomRow = {
  number: string;
  type: string; // RoomType name
  status?: string;
  price?: number | null;
};

export type ImportReservationRow = {
  guestName: string;
  roomNumber: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string;
  status?: string;
};

export type ImportPmsPayload = {
  guests?: ImportGuestRow[];
  rooms?: ImportRoomRow[];
  reservations?: ImportReservationRow[];
};

export type ImportResult = {
  guestsCreated: number;
  guestsSkipped: number;
  guestsErrors: string[];
  roomsCreated: number;
  roomsSkipped: number;
  roomsErrors: string[];
  reservationsCreated: number;
  reservationsSkipped: number;
  reservationsErrors: string[];
};

export async function parseImportPmsFile(content: string): Promise<
  { success: true; data: ImportPmsPayload } | { success: false; error: string }
> {
  try {
    const data = JSON.parse(content) as unknown;
    if (!data || typeof data !== "object") {
      return { success: false, error: "Nieprawidłowy format JSON" };
    }
    const payload: ImportPmsPayload = {};
    if (Array.isArray((data as Record<string, unknown>).guests)) {
      payload.guests = ((data as Record<string, unknown>).guests as unknown[]).map((row) => {
        const r = row as Record<string, unknown>;
        return {
          name: String(r?.name ?? "").trim(),
          email: r?.email != null ? String(r.email).trim() || null : null,
          phone: r?.phone != null ? String(r.phone).trim() || null : null,
        };
      }).filter((g) => g.name.length > 0);
    }
    if (Array.isArray((data as Record<string, unknown>).rooms)) {
      payload.rooms = ((data as Record<string, unknown>).rooms as unknown[]).map((row) => {
        const r = row as Record<string, unknown>;
        return {
          number: String(r?.number ?? "").trim(),
          type: String(r?.type ?? "Standard").trim(),
          status: r?.status != null ? String(r.status) : undefined,
          price: typeof r?.price === "number" ? r.price : null,
        };
      }).filter((room) => room.number.length > 0 && room.type.length > 0);
    }
    return { success: true, data: payload };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd parsowania JSON",
    };
  }
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (inQuotes) {
      cur += c;
    } else if (c === "," || c === ";") {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur.trim());
  return out;
}

function findColumnIndex(headers: string[], ...names: string[]): number {
  const lower = headers.map((h) => h.trim().toLowerCase());
  for (const name of names) {
    const idx = lower.indexOf(name.toLowerCase());
    if (idx >= 0) return idx;
  }
  return -1;
}

/** Parsuje CSV (przeglądarka może wysłać Excel jako CSV). Zwraca payload do importu. */
export async function parseImportCsv(
  content: string,
  mode: "guests" | "rooms" | "reservations"
): Promise<{ success: true; data: ImportPmsPayload } | { success: false; error: string }> {
  // Usuń BOM (UTF-8 / UTF-16 BE) na początku – Excel i inne programy często go dodają
  const trimmed = content.replace(/^\uFEFF/, "").trim();
  const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return { success: false, error: "Plik CSV jest pusty (brak wierszy)." };
  if (lines.length < 2) return { success: false, error: "CSV musi zawierać nagłówek i co najmniej jeden wiersz danych." };
  const headers = parseCsvLine(lines[0]!);
  const payload: ImportPmsPayload = {};

  if (mode === "guests") {
    const nameIdx = findColumnIndex(headers, "name", "imię i nazwisko", "imie i nazwisko", "nazwisko", "guest");
    if (nameIdx < 0) return { success: false, error: "Brak kolumny z nazwiskiem (name, imię i nazwisko, nazwisko)" };
    const emailIdx = findColumnIndex(headers, "email", "e-mail", "mail");
    const phoneIdx = findColumnIndex(headers, "phone", "telefon", "tel");
    payload.guests = [];
    for (let i = 1; i < lines.length; i++) {
      const cells = parseCsvLine(lines[i]!);
      const name = (cells[nameIdx] ?? "").trim();
      if (!name) continue;
      payload.guests.push({
        name,
        email: emailIdx >= 0 ? (cells[emailIdx] ?? "").trim() || null : null,
        phone: phoneIdx >= 0 ? (cells[phoneIdx] ?? "").trim() || null : null,
      });
    }
  } else if (mode === "rooms") {
    const numberIdx = findColumnIndex(headers, "number", "numer", "pokój", "pokoj", "room", "nr");
    const typeIdx = findColumnIndex(headers, "type", "typ", "type of room");
    if (numberIdx < 0 || typeIdx < 0) {
      return { success: false, error: "Brak kolumn: numer pokoju (number, numer, pokój) i typ (type, typ)" };
    }
    const priceIdx = findColumnIndex(headers, "price", "cena", "price");
    const statusIdx = findColumnIndex(headers, "status", "status");
    payload.rooms = [];
    for (let i = 1; i < lines.length; i++) {
      const cells = parseCsvLine(lines[i]!);
      const number = (cells[numberIdx] ?? "").trim();
      const type = (cells[typeIdx] ?? "").trim() || "Standard";
      if (!number) continue;
      const priceStr = priceIdx >= 0 ? (cells[priceIdx] ?? "").trim() : "";
      const price = priceStr ? parseFloat(priceStr.replace(",", ".")) : null;
      const status = statusIdx >= 0 ? (cells[statusIdx] ?? "").trim() : undefined;
      payload.rooms.push({
        number,
        type,
        status: status || undefined,
        price: Number.isNaN(price as number) ? null : (price as number),
      });
    }
  } else {
    const guestIdx = findColumnIndex(headers, "guestname", "guest", "gość", "gosc", "name", "imię i nazwisko", "nazwisko");
    const roomIdx = findColumnIndex(headers, "roomnumber", "room", "pokój", "pokoj", "numer pokoju", "number");
    const checkInIdx = findColumnIndex(headers, "checkin", "check-in", "zameldowanie", "od", "from");
    const checkOutIdx = findColumnIndex(headers, "checkout", "check-out", "wymeldowanie", "do", "to");
    const statusIdx = findColumnIndex(headers, "status", "status rezerwacji");
    if (guestIdx < 0 || roomIdx < 0 || checkInIdx < 0 || checkOutIdx < 0) {
      return { success: false, error: "Brak kolumn: gość (guestName, guest), pokój (roomNumber, room), checkIn, checkOut" };
    }
    payload.reservations = [];
    for (let i = 1; i < lines.length; i++) {
      const cells = parseCsvLine(lines[i]!);
      const guestName = (cells[guestIdx] ?? "").trim();
      const roomNumber = (cells[roomIdx] ?? "").trim();
      const checkIn = (cells[checkInIdx] ?? "").trim();
      const checkOut = (cells[checkOutIdx] ?? "").trim();
      if (!guestName || !roomNumber || !checkIn || !checkOut) continue;
      payload.reservations.push({
        guestName,
        roomNumber,
        checkIn,
        checkOut,
        status: statusIdx >= 0 ? (cells[statusIdx] ?? "").trim() || undefined : undefined,
      });
    }
  }

  return { success: true, data: payload };
}

export async function executeImportPms(payload: ImportPmsPayload): Promise<
  { success: true; result: ImportResult } | { success: false; error: string }
> {
  const session = await getSession();
  if (!session) return { success: false, error: "Zaloguj się" };
  const allowed = await can(session.role, "admin.settings");
  if (!allowed) return { success: false, error: "Brak uprawnień" };

  const result: ImportResult = {
    guestsCreated: 0,
    guestsSkipped: 0,
    guestsErrors: [],
    roomsCreated: 0,
    roomsSkipped: 0,
    roomsErrors: [],
    reservationsCreated: 0,
    reservationsSkipped: 0,
    reservationsErrors: [],
  };

  try {
    if (payload.guests?.length) {
      const existingNames = new Set(
        (await prisma.guest.findMany({ select: { name: true } })).map((g) => g.name)
      );
      for (let i = 0; i < payload.guests.length; i++) {
        const g = payload.guests[i]!;
        if (existingNames.has(g.name)) {
          result.guestsSkipped++;
          continue;
        }
        try {
          await prisma.guest.create({
            data: {
              name: g.name,
              email: g.email ?? null,
              phone: g.phone ?? null,
            },
          });
          result.guestsCreated++;
          existingNames.add(g.name);
        } catch (err) {
          result.guestsErrors.push(`Wiersz ${i + 1} (${g.name}): ${err instanceof Error ? err.message : "błąd"}`);
        }
      }
    }

    if (payload.rooms?.length) {
      const roomTypeNames = new Set(
        (await prisma.roomType.findMany({ select: { name: true } })).map((t) => t.name)
      );
      const existingRooms = new Set(
        (await prisma.room.findMany({ select: { number: true } })).map((r) => r.number)
      );
      for (let i = 0; i < payload.rooms.length; i++) {
        const r = payload.rooms[i]!;
        if (existingRooms.has(r.number)) {
          result.roomsSkipped++;
          continue;
        }
        if (!roomTypeNames.has(r.type)) {
          try {
            await prisma.roomType.create({
              data: { name: r.type },
            });
            roomTypeNames.add(r.type);
          } catch {
            result.roomsErrors.push(`Pokój ${r.number}: brak typu "${r.type}" i nie udało się go utworzyć`);
            continue;
          }
        }
        const status = r.status === "DIRTY" || r.status === "OOO" ? r.status : "CLEAN";
        try {
          await prisma.room.create({
            data: {
              number: r.number,
              type: r.type,
              status,
              price: r.price != null ? r.price : null,
              activeForSale: true,
            },
          });
          result.roomsCreated++;
          existingRooms.add(r.number);
        } catch (err) {
          result.roomsErrors.push(`Pokój ${r.number}: ${err instanceof Error ? err.message : "błąd"}`);
        }
      }
    }

    if (payload.reservations?.length) {
      for (let i = 0; i < payload.reservations.length; i++) {
        const row = payload.reservations[i]!;
        try {
          const res = await createReservation({
            guestName: row.guestName,
            room: row.roomNumber,
            checkIn: row.checkIn,
            checkOut: row.checkOut,
            status: (row.status === "CHECKED_IN" || row.status === "CHECKED_OUT" || row.status === "CANCELLED" || row.status === "NO_SHOW" ? row.status : "CONFIRMED") as "CONFIRMED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED" | "NO_SHOW",
          });
          if (res.success) result.reservationsCreated++;
          else {
            result.reservationsErrors.push(`Wiersz ${i + 1} (${row.guestName}, ${row.roomNumber}): ${res.error}`);
          }
        } catch (err) {
          result.reservationsErrors.push(`Wiersz ${i + 1}: ${err instanceof Error ? err.message : "błąd"}`);
        }
      }
    }

    return { success: true, result };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd importu",
    };
  }
}
