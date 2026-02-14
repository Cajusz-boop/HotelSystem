/**
 * Telefonia – klient do integracji z centralą (Asterisk, 3CX).
 * CDR (Call Detail Record) – import z API lub webhook.
 */

import { prisma } from "@/lib/db";

export interface CdrRecord {
  externalId: string;
  startedAt: Date;
  durationSec: number;
  cost?: number;
  /** Numer/extension źródłowy (np. pokój 101 → rozszerzenie 2101) – do mapowania na Room */
  sourceChannel?: string;
  /** Numer docelowy */
  destinationChannel?: string;
}

/** Tworzy wpis PhoneCallLog w bazie. roomId i reservationId opcjonalne – można uzupełnić po dopasowaniu. Zwraca skipped: true gdy wpis o tym externalId już istniał. */
export async function createPhoneCallLogFromCdr(
  cdr: CdrRecord,
  options: { roomId?: string | null; reservationId?: string | null } = {}
): Promise<{ id: string; skipped: boolean }> {
  const existing = await prisma.phoneCallLog.findFirst({
    where: { externalId: cdr.externalId },
    select: { id: true },
  });
  if (existing) {
    return { id: existing.id, skipped: true };
  }

  const log = await prisma.phoneCallLog.create({
    data: {
      roomId: options.roomId ?? undefined,
      reservationId: options.reservationId ?? undefined,
      externalId: cdr.externalId,
      startedAt: cdr.startedAt,
      durationSec: cdr.durationSec,
      cost: cdr.cost != null ? cdr.cost : undefined,
    },
  });
  return { id: log.id, skipped: false };
}

/** Format typowy dla webhooka Asterisk AMI / CDR (np. zdarzenie Cdr). */
export function parseAsteriskCdrWebhook(body: unknown): CdrRecord | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const uniqueId = o.Uniqueid ?? o.uniqueid ?? o.id;
  const start = o.Start ?? o.start ?? o.StartTime ?? o.Calldate;
  const duration = o.Duration ?? o.duration ?? o.billableseconds;
  const bill = o.BillableSeconds ?? o.billableseconds;
  const channel = o.Channel ?? o.channel;
  const destChannel = o.DestChannel ?? o.destchannel ?? o.Destination;

  const externalId = typeof uniqueId === "string" ? uniqueId : String(uniqueId ?? `ast-${Date.now()}`);
  const startedAt = parseDate(start);
  if (!startedAt) return null;
  const durationSec = Math.max(0, Number(duration ?? bill ?? 0) || 0);
  const cost = typeof o.cost === "number" ? o.cost : typeof o.Cost === "number" ? o.Cost : undefined;

  return {
    externalId,
    startedAt,
    durationSec: Math.round(durationSec),
    cost,
    sourceChannel: typeof channel === "string" ? channel : undefined,
    destinationChannel: typeof destChannel === "string" ? destChannel : undefined,
  };
}

/** Format typowy dla 3CX CDR / webhook (np. CallEnded). */
export function parse3cxCdrWebhook(body: unknown): CdrRecord | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const callId = o.CallId ?? o.callId ?? o.Id ?? o.id;
  const start = o.StartTime ?? o.startTime ?? o.Created ?? o.Time;
  const duration = o.Duration ?? o.duration ?? o.TalkTimeSeconds;
  const from = o.From ?? o.from ?? o.CallerNumber;
  const to = o.To ?? o.to ?? o.CalledNumber;

  const externalId = typeof callId === "string" ? callId : String(callId ?? `3cx-${Date.now()}`);
  const startedAt = parseDate(start);
  if (!startedAt) return null;
  const durationSec = Math.max(0, Number(duration ?? 0) || 0);

  return {
    externalId,
    startedAt,
    durationSec: Math.round(durationSec),
    sourceChannel: typeof from === "string" ? from : undefined,
    destinationChannel: typeof to === "string" ? to : undefined,
  };
}

function parseDate(v: unknown): Date | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
  if (typeof v === "number" && Number.isFinite(v)) return new Date(v);
  if (typeof v === "string") {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

/**
 * Mapowanie extension → Room (np. 2101 → pokój 101).
 * Konfiguracja: extension prefix + numer pokoju, lub osobna tabela ExtensionToRoom.
 * Domyślna konwencja: ostatnie 3 znaki kanału to numer pokoju (Asterisk SIP/room).
 */
export async function findRoomIdByChannel(channel: string): Promise<string | null> {
  if (!channel || typeof channel !== "string") return null;
  // Typowo: SIP/101-00000xxx lub PJSIP/2101 – szukamy numeru pokoju w channel
  const match = channel.match(/(?:^|\D)(\d{2,4})(?:\D|$)/);
  const possibleNumber = match ? match[1] : channel.replace(/\D/g, "").slice(-3) || channel;
  const room = await prisma.room.findFirst({
    where: { number: possibleNumber },
    select: { id: true },
  });
  return room?.id ?? null;
}

/**
 * Dla podanego roomId szuka aktywnej rezerwacji (CHECKED_IN) w dniu startedAt.
 */
export async function findReservationIdByRoomAndDate(
  roomId: string,
  startedAt: Date
): Promise<string | null> {
  const dayStart = new Date(startedAt);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const res = await prisma.reservation.findFirst({
    where: {
      roomId,
      status: "CHECKED_IN",
      checkIn: { lt: dayEnd },
      checkOut: { gte: dayStart },
    },
    select: { id: true },
    orderBy: { checkIn: "desc" },
  });
  return res?.id ?? null;
}

/**
 * Pobiera CDR z zewnętrznego API (Asterisk/3CX lub middleware).
 * GET apiUrl?from=ISO8601&to=ISO8601 – oczekiwana odpowiedź: tablica obiektów CDR.
 * apiKey – opcjonalny klucz (np. Bearer lub X-API-Key).
 */
export async function fetchCdrsFromCdrApi(
  apiUrl: string,
  dateFrom: Date,
  dateTo: Date,
  apiKey?: string | null
): Promise<CdrRecord[]> {
  const fromStr = dateFrom.toISOString();
  const toStr = dateTo.toISOString();
  const url = new URL(apiUrl);
  url.searchParams.set("from", fromStr);
  url.searchParams.set("to", toStr);

  const headers: Record<string, string> = { Accept: "application/json" };
  if (apiKey?.trim()) {
    headers["Authorization"] = apiKey.trim().startsWith("Bearer ") ? apiKey.trim() : `Bearer ${apiKey.trim()}`;
  }

  const res = await fetch(url.toString(), { method: "GET", headers });
  if (!res.ok) {
    throw new Error(`CDR API error: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as unknown;
  const rawList = Array.isArray(data) ? data : typeof data === "object" && data !== null && "records" in data ? (data as { records: unknown[] }).records : [];
  const out: CdrRecord[] = [];
  for (const raw of rawList) {
    const parsed = parseAsteriskCdrWebhook(raw) ?? parse3cxCdrWebhook(raw);
    if (parsed) out.push(parsed);
  }
  return out;
}

/**
 * Blokada telefonu w pokoju po wymeldowaniu – wywołanie API centrali (Asterisk/3CX).
 * Wymaga TELEPHONY_BLOCK_EXTENSION_URL w .env. POST body: { "roomNumber": "101" } lub { "extension": "2101" }.
 */
export async function blockRoomExtensionAfterCheckout(roomId: string): Promise<void> {
  const url = process.env.TELEPHONY_BLOCK_EXTENSION_URL?.trim();
  if (!url) return;

  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { number: true },
  });
  if (!room) return;

  const body = { roomNumber: room.number };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Blokada telefonu: ${res.status} ${res.statusText}`);
  }
}
