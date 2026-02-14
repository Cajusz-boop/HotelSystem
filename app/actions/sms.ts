"use server";

import { prisma } from "@/lib/db";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

// Typy SMS
export type SmsType = "DOOR_CODE" | "ROOM_READY" | "REMINDER" | "CONFIRMATION" | "CUSTOM";
export type SmsStatus = "SENT" | "FAILED" | "PENDING";
export type SmsProvider = "TWILIO" | "SMSAPI" | "MOCK";

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID ?? "";
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN ?? "";
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER ?? "";

/** Normalizuje numer do formatu E.164 (np. +48123456789). */
function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 9 && digits.startsWith("4")) return `+48${digits}`;
  if (digits.length === 11 && digits.startsWith("48")) return `+${digits}`;
  if (digits.length === 9) return `+48${digits}`;
  return phone.startsWith("+") ? phone : `+${digits}`;
}

/**
 * Loguje SMS do bazy danych dla audytu.
 */
async function logSms(data: {
  type: SmsType;
  recipientPhone: string;
  recipientName?: string | null;
  messageBody: string;
  status: SmsStatus;
  errorMessage?: string | null;
  reservationId?: string | null;
  guestId?: string | null;
  provider?: SmsProvider;
  providerMsgId?: string | null;
  sentByUserId?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    await prisma.smsLog.create({
      data: {
        type: data.type,
        recipientPhone: data.recipientPhone,
        recipientName: data.recipientName ?? null,
        messageBody: data.messageBody,
        status: data.status,
        errorMessage: data.errorMessage ?? null,
        reservationId: data.reservationId ?? null,
        guestId: data.guestId ?? null,
        provider: data.provider ?? "TWILIO",
        providerMsgId: data.providerMsgId ?? null,
        sentByUserId: data.sentByUserId ?? null,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      },
    });
    
    // Log do konsoli dla developerów
    console.log(`[SMS LOG] ${data.status}: ${data.type} -> ${data.recipientPhone}`);
    if (data.status === "FAILED") {
      console.error(`[SMS ERROR] ${data.errorMessage}`);
    }
  } catch (e) {
    // Nie przerywaj wysyłki jeśli logowanie się nie powiedzie
    console.error("[SMS LOG ERROR] Nie udało się zapisać logu SMS:", e);
  }
}

/**
 * Wysyła SMS przez Twilio (Messages API).
 * Wymaga: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER.
 * Zwraca success + sid lub error.
 */
async function sendSmsViaTwilio(
  to: string,
  body: string
): Promise<{ success: boolean; sid?: string; error?: string }> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    return {
      success: false,
      error:
        "Skonfiguruj TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN i TWILIO_PHONE_NUMBER.",
    };
  }
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`, "utf8").toString("base64");
  const params = new URLSearchParams();
  params.set("To", toE164(to));
  params.set("From", TWILIO_PHONE_NUMBER);
  params.set("Body", body);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    const data = (await res.json().catch(() => ({}))) as { sid?: string; message?: string; error_message?: string };
    if (!res.ok) {
      return {
        success: false,
        error: data.error_message ?? data.message ?? `Twilio HTTP ${res.status}`,
      };
    }
    return { success: true, sid: data.sid };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd połączenia z Twilio",
    };
  }
}

/**
 * Wysyła SMS z kodem do drzwi (bramka Twilio).
 * Kod: przekazany w _code lub 6-cyfrowy losowy.
 */
export async function sendDoorCodeSms(
  reservationId: string,
  code?: string
): Promise<ActionResult<{ sentTo: string }>> {
  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { guest: true },
    });
    if (!reservation) return { success: false, error: "Rezerwacja nie istnieje" };
    const phone = reservation.guest.phone?.trim();
    if (!phone) return { success: false, error: "Brak numeru telefonu u gościa" };

    const doorCode = code ?? String(Math.floor(100000 + Math.random() * 900000));
    const body = `Kod do drzwi: ${doorCode}. Rezerwacja ${reservationId.slice(0, 8)}.`;
    const normalizedPhone = toE164(phone);

    const result = await sendSmsViaTwilio(phone, body);
    
    // Logowanie SMS dla audytu
    await logSms({
      type: "DOOR_CODE",
      recipientPhone: normalizedPhone,
      recipientName: `${reservation.guest.firstName} ${reservation.guest.lastName}`,
      messageBody: body,
      status: result.success ? "SENT" : "FAILED",
      errorMessage: result.error,
      reservationId: reservationId,
      guestId: reservation.guest.id,
      provider: "TWILIO",
      providerMsgId: result.sid,
      metadata: { doorCode },  // przechowujemy kod do drzwi dla audytu
    });
    
    if (!result.success) {
      return { success: false, error: result.error ?? "Błąd wysyłania SMS" };
    }
    return { success: true, data: { sentTo: phone } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd wysyłania SMS",
    };
  }
}

/**
 * Wysyła SMS „Twój pokój jest już gotowy” (bramka Twilio).
 */
export async function sendRoomReadySms(
  reservationId: string
): Promise<ActionResult<{ sentTo: string }>> {
  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { guest: true, room: true },
    });
    if (!reservation) return { success: false, error: "Rezerwacja nie istnieje" };
    const phone = reservation.guest.phone?.trim();
    if (!phone) return { success: false, error: "Brak numeru telefonu u gościa" };

    const body = `Twój pokój nr ${reservation.room.number} jest już gotowy. Do zobaczenia!`;
    const normalizedPhone = toE164(phone);

    const result = await sendSmsViaTwilio(phone, body);
    
    // Logowanie SMS dla audytu
    await logSms({
      type: "ROOM_READY",
      recipientPhone: normalizedPhone,
      recipientName: `${reservation.guest.firstName} ${reservation.guest.lastName}`,
      messageBody: body,
      status: result.success ? "SENT" : "FAILED",
      errorMessage: result.error,
      reservationId: reservationId,
      guestId: reservation.guest.id,
      provider: "TWILIO",
      providerMsgId: result.sid,
      metadata: { roomNumber: reservation.room.number },
    });
    
    if (!result.success) {
      return { success: false, error: result.error ?? "Błąd wysyłania SMS" };
    }
    return { success: true, data: { sentTo: phone } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd wysyłania SMS",
    };
  }
}

// ============================================
// FUNKCJE DO PRZEGLĄDANIA LOGÓW SMS (AUDYT)
// ============================================

export interface SmsLogEntry {
  id: string;
  type: SmsType;
  recipientPhone: string;
  recipientName: string | null;
  messageBody: string;
  status: SmsStatus;
  errorMessage: string | null;
  reservationId: string | null;
  guestId: string | null;
  provider: string;
  providerMsgId: string | null;
  createdAt: Date;
}

export interface SmsLogFilters {
  type?: SmsType;
  status?: SmsStatus;
  reservationId?: string;
  guestId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;  // szukaj w numerze telefonu lub nazwie odbiorcy
}

/**
 * Pobiera logi SMS z filtrowaniem i paginacją.
 */
export async function getSmsLogs(
  filters: SmsLogFilters = {},
  page: number = 1,
  pageSize: number = 50
): Promise<ActionResult<{ logs: SmsLogEntry[]; total: number; pages: number }>> {
  try {
    const where: Record<string, unknown> = {};
    
    if (filters.type) {
      where.type = filters.type;
    }
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.reservationId) {
      where.reservationId = filters.reservationId;
    }
    if (filters.guestId) {
      where.guestId = filters.guestId;
    }
    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) {
        (where.createdAt as Record<string, Date>).gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        (where.createdAt as Record<string, Date>).lte = filters.dateTo;
      }
    }
    if (filters.search) {
      where.OR = [
        { recipientPhone: { contains: filters.search } },
        { recipientName: { contains: filters.search } },
      ];
    }
    
    const [logs, total] = await Promise.all([
      prisma.smsLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.smsLog.count({ where }),
    ]);
    
    return {
      success: true,
      data: {
        logs: logs.map((log) => ({
          id: log.id,
          type: log.type as SmsType,
          recipientPhone: log.recipientPhone,
          recipientName: log.recipientName,
          messageBody: log.messageBody,
          status: log.status as SmsStatus,
          errorMessage: log.errorMessage,
          reservationId: log.reservationId,
          guestId: log.guestId,
          provider: log.provider,
          providerMsgId: log.providerMsgId,
          createdAt: log.createdAt,
        })),
        total,
        pages: Math.ceil(total / pageSize),
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania logów SMS",
    };
  }
}

/**
 * Pobiera pojedynczy log SMS po ID.
 */
export async function getSmsLogById(
  logId: string
): Promise<ActionResult<SmsLogEntry & { metadata: Record<string, unknown> | null }>> {
  try {
    const log = await prisma.smsLog.findUnique({
      where: { id: logId },
    });
    
    if (!log) {
      return { success: false, error: "Log SMS nie istnieje" };
    }
    
    let metadata: Record<string, unknown> | null = null;
    if (log.metadata) {
      try {
        metadata = JSON.parse(log.metadata);
      } catch {
        metadata = null;
      }
    }
    
    return {
      success: true,
      data: {
        id: log.id,
        type: log.type as SmsType,
        recipientPhone: log.recipientPhone,
        recipientName: log.recipientName,
        messageBody: log.messageBody,
        status: log.status as SmsStatus,
        errorMessage: log.errorMessage,
        reservationId: log.reservationId,
        guestId: log.guestId,
        provider: log.provider,
        providerMsgId: log.providerMsgId,
        createdAt: log.createdAt,
        metadata,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania logu SMS",
    };
  }
}

/**
 * Statystyki SMS (do dashboardu lub raportów).
 */
export async function getSmsStats(
  dateFrom?: Date,
  dateTo?: Date
): Promise<ActionResult<{
  total: number;
  sent: number;
  failed: number;
  byType: Record<SmsType, number>;
  failureRate: number;
}>> {
  try {
    const where: Record<string, unknown> = {};
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        (where.createdAt as Record<string, Date>).gte = dateFrom;
      }
      if (dateTo) {
        (where.createdAt as Record<string, Date>).lte = dateTo;
      }
    }
    
    const [total, sent, failed, byTypeRaw] = await Promise.all([
      prisma.smsLog.count({ where }),
      prisma.smsLog.count({ where: { ...where, status: "SENT" } }),
      prisma.smsLog.count({ where: { ...where, status: "FAILED" } }),
      prisma.smsLog.groupBy({
        by: ["type"],
        where,
        _count: true,
      }),
    ]);
    
    const byType: Record<SmsType, number> = {
      DOOR_CODE: 0,
      ROOM_READY: 0,
      REMINDER: 0,
      CONFIRMATION: 0,
      CUSTOM: 0,
    };
    
    for (const row of byTypeRaw) {
      byType[row.type as SmsType] = row._count;
    }
    
    return {
      success: true,
      data: {
        total,
        sent,
        failed,
        byType,
        failureRate: total > 0 ? (failed / total) * 100 : 0,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania statystyk SMS",
    };
  }
}

/**
 * Pobiera logi SMS dla konkretnej rezerwacji.
 */
export async function getSmsLogsForReservation(
  reservationId: string
): Promise<ActionResult<SmsLogEntry[]>> {
  try {
    const logs = await prisma.smsLog.findMany({
      where: { reservationId },
      orderBy: { createdAt: "desc" },
    });
    
    return {
      success: true,
      data: logs.map((log) => ({
        id: log.id,
        type: log.type as SmsType,
        recipientPhone: log.recipientPhone,
        recipientName: log.recipientName,
        messageBody: log.messageBody,
        status: log.status as SmsStatus,
        errorMessage: log.errorMessage,
        reservationId: log.reservationId,
        guestId: log.guestId,
        provider: log.provider,
        providerMsgId: log.providerMsgId,
        createdAt: log.createdAt,
      })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania logów SMS",
    };
  }
}

/**
 * Pobiera logi SMS dla konkretnego gościa.
 */
export async function getSmsLogsForGuest(
  guestId: string
): Promise<ActionResult<SmsLogEntry[]>> {
  try {
    const logs = await prisma.smsLog.findMany({
      where: { guestId },
      orderBy: { createdAt: "desc" },
    });
    
    return {
      success: true,
      data: logs.map((log) => ({
        id: log.id,
        type: log.type as SmsType,
        recipientPhone: log.recipientPhone,
        recipientName: log.recipientName,
        messageBody: log.messageBody,
        status: log.status as SmsStatus,
        errorMessage: log.errorMessage,
        reservationId: log.reservationId,
        guestId: log.guestId,
        provider: log.provider,
        providerMsgId: log.providerMsgId,
        createdAt: log.createdAt,
      })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania logów SMS",
    };
  }
}

// ============================================
// KONFIGURACJA BRAMKI SMS
// ============================================

export interface SmsGatewayConfig {
  provider: string;
  isConfigured: boolean;
  phoneNumber: string | null;  // zamaskowany numer nadawcy
  accountSidMasked: string | null;  // zamaskowane Account SID
}

/**
 * Sprawdza konfigurację bramki SMS (Twilio).
 * Nie zwraca pełnych danych uwierzytelniających, tylko status.
 */
export async function getSmsGatewayConfig(): Promise<ActionResult<SmsGatewayConfig>> {
  const hasAccountSid = !!TWILIO_ACCOUNT_SID;
  const hasAuthToken = !!TWILIO_AUTH_TOKEN;
  const hasPhoneNumber = !!TWILIO_PHONE_NUMBER;
  
  const isConfigured = hasAccountSid && hasAuthToken && hasPhoneNumber;
  
  return {
    success: true,
    data: {
      provider: "TWILIO",
      isConfigured,
      phoneNumber: hasPhoneNumber
        ? `${TWILIO_PHONE_NUMBER.slice(0, 4)}****${TWILIO_PHONE_NUMBER.slice(-2)}`
        : null,
      accountSidMasked: hasAccountSid
        ? `${TWILIO_ACCOUNT_SID.slice(0, 4)}****${TWILIO_ACCOUNT_SID.slice(-4)}`
        : null,
    },
  };
}

/**
 * Wysyła testowy SMS na podany numer.
 * Służy do weryfikacji konfiguracji bramki.
 */
export async function sendTestSms(
  phone: string
): Promise<ActionResult<{ sentTo: string }>> {
  try {
    // Walidacja numeru telefonu
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length < 9) {
      return { success: false, error: "Nieprawidłowy numer telefonu" };
    }
    
    const normalizedPhone = toE164(phone);
    const body = `Test SMS z systemu hotelowego. Data: ${new Date().toLocaleString("pl-PL")}`;
    
    const result = await sendSmsViaTwilio(phone, body);
    
    // Logowanie testowego SMS
    await logSms({
      type: "CUSTOM",
      recipientPhone: normalizedPhone,
      recipientName: "Test",
      messageBody: body,
      status: result.success ? "SENT" : "FAILED",
      errorMessage: result.error,
      reservationId: null,
      guestId: null,
      provider: "TWILIO",
      providerMsgId: result.sid,
      metadata: { isTest: true },
    });
    
    if (!result.success) {
      return { success: false, error: result.error ?? "Błąd wysyłania SMS" };
    }
    
    return { success: true, data: { sentTo: normalizedPhone } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd wysyłania testowego SMS",
    };
  }
}

/**
 * Wysyła niestandardowy SMS (dla administratorów).
 */
export async function sendCustomSms(
  phone: string,
  message: string,
  reservationId?: string | null,
  guestId?: string | null
): Promise<ActionResult<{ sentTo: string }>> {
  try {
    // Walidacja
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length < 9) {
      return { success: false, error: "Nieprawidłowy numer telefonu" };
    }
    if (!message.trim()) {
      return { success: false, error: "Treść wiadomości nie może być pusta" };
    }
    if (message.length > 160) {
      return { success: false, error: "Wiadomość SMS nie może przekraczać 160 znaków" };
    }
    
    const normalizedPhone = toE164(phone);
    
    const result = await sendSmsViaTwilio(phone, message);
    
    // Logowanie
    await logSms({
      type: "CUSTOM",
      recipientPhone: normalizedPhone,
      recipientName: null,
      messageBody: message,
      status: result.success ? "SENT" : "FAILED",
      errorMessage: result.error,
      reservationId: reservationId ?? null,
      guestId: guestId ?? null,
      provider: "TWILIO",
      providerMsgId: result.sid,
    });
    
    if (!result.success) {
      return { success: false, error: result.error ?? "Błąd wysyłania SMS" };
    }
    
    return { success: true, data: { sentTo: normalizedPhone } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd wysyłania SMS",
    };
  }
}

// ============================================
// AUTOMATYCZNE PRZYPOMNIENIA SMS PRZED PRZYJAZDEM
// ============================================

/**
 * Wysyła przypomnienie SMS przed przyjazdem dla pojedynczej rezerwacji.
 */
export async function sendPreArrivalReminderSms(
  reservationId: string
): Promise<ActionResult<{ sentTo: string }>> {
  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        guest: true,
        room: true,
      },
    });
    
    if (!reservation) {
      return { success: false, error: "Rezerwacja nie istnieje" };
    }
    
    const phone = reservation.guest.phone?.trim();
    if (!phone) {
      return { success: false, error: "Brak numeru telefonu u gościa" };
    }
    
    // Sprawdź czy już wysłano przypomnienie dla tej rezerwacji
    const existingReminder = await prisma.smsLog.findFirst({
      where: {
        reservationId: reservationId,
        type: "REMINDER",
        status: "SENT",
      },
    });
    
    if (existingReminder) {
      return { success: false, error: "Przypomnienie SMS już zostało wysłane dla tej rezerwacji" };
    }
    
    // Formatuj datę przyjazdu
    const checkInDate = new Date(reservation.checkIn);
    const formattedDate = checkInDate.toLocaleDateString("pl-PL", {
      day: "numeric",
      month: "long",
    });
    
    // Treść przypomnienia (max 160 znaków)
    const guestName = reservation.guest.firstName || "Gość";
    const roomNumber = reservation.room.number;
    const body = `${guestName}, przypominamy o rezerwacji w naszym hotelu na ${formattedDate}. Pokój: ${roomNumber}. Do zobaczenia!`;
    
    const normalizedPhone = toE164(phone);
    
    const result = await sendSmsViaTwilio(phone, body);
    
    // Logowanie
    await logSms({
      type: "REMINDER",
      recipientPhone: normalizedPhone,
      recipientName: `${reservation.guest.firstName} ${reservation.guest.lastName}`,
      messageBody: body,
      status: result.success ? "SENT" : "FAILED",
      errorMessage: result.error,
      reservationId: reservationId,
      guestId: reservation.guest.id,
      provider: "TWILIO",
      providerMsgId: result.sid,
      metadata: {
        checkIn: reservation.checkIn,
        roomNumber: reservation.room.number,
      },
    });
    
    if (!result.success) {
      return { success: false, error: result.error ?? "Błąd wysyłania SMS" };
    }
    
    return { success: true, data: { sentTo: normalizedPhone } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd wysyłania przypomnienia SMS",
    };
  }
}

export interface BatchReminderResult {
  sent: number;
  failed: number;
  skipped: number;
  details: Array<{
    reservationId: string;
    guestName: string;
    phone: string | null;
    status: "SENT" | "FAILED" | "SKIPPED";
    error?: string;
  }>;
}

/**
 * Wysyła przypomnienia SMS dla wszystkich rezerwacji z check-in jutro.
 * Pomija rezerwacje bez numeru telefonu lub z już wysłanym przypomnieniem.
 * 
 * @param daysBeforeArrival - ile dni przed przyjazdem wysłać (domyślnie 1 = jutro)
 */
export async function sendBatchPreArrivalReminders(
  daysBeforeArrival: number = 1
): Promise<ActionResult<BatchReminderResult>> {
  try {
    // Oblicz datę check-in dla przypomnień
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + daysBeforeArrival);
    
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);
    
    // Znajdź wszystkie rezerwacje z check-in w docelowym dniu
    // Status: Potwierdzona lub Nowa (nie anulowane, nie checked-in)
    const reservations = await prisma.reservation.findMany({
      where: {
        checkIn: {
          gte: targetDate,
          lt: nextDay,
        },
        status: {
          in: ["CONFIRMED", "PENDING"],
        },
      },
      include: {
        guest: true,
        room: true,
      },
    });
    
    const result: BatchReminderResult = {
      sent: 0,
      failed: 0,
      skipped: 0,
      details: [],
    };
    
    for (const reservation of reservations) {
      const guestName = `${reservation.guest.firstName} ${reservation.guest.lastName}`;
      const phone = reservation.guest.phone?.trim();
      
      // Sprawdź czy gość ma numer telefonu
      if (!phone) {
        result.skipped++;
        result.details.push({
          reservationId: reservation.id,
          guestName,
          phone: null,
          status: "SKIPPED",
          error: "Brak numeru telefonu",
        });
        continue;
      }
      
      // Sprawdź czy już wysłano przypomnienie
      const existingReminder = await prisma.smsLog.findFirst({
        where: {
          reservationId: reservation.id,
          type: "REMINDER",
          status: "SENT",
        },
      });
      
      if (existingReminder) {
        result.skipped++;
        result.details.push({
          reservationId: reservation.id,
          guestName,
          phone,
          status: "SKIPPED",
          error: "Przypomnienie już wysłane",
        });
        continue;
      }
      
      // Wysyłanie przypomnienia
      const sendResult = await sendPreArrivalReminderSms(reservation.id);
      
      if (sendResult.success) {
        result.sent++;
        result.details.push({
          reservationId: reservation.id,
          guestName,
          phone,
          status: "SENT",
        });
      } else {
        result.failed++;
        result.details.push({
          reservationId: reservation.id,
          guestName,
          phone,
          status: "FAILED",
          error: sendResult.error,
        });
      }
    }
    
    console.log(`[SMS BATCH REMINDERS] Wysłano: ${result.sent}, Błędy: ${result.failed}, Pominięto: ${result.skipped}`);
    
    return { success: true, data: result };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd wysyłania przypomnień SMS",
    };
  }
}

/**
 * Pobiera listę rezerwacji kwalifikujących się do przypomnienia SMS.
 * Używane do podglądu przed uruchomieniem batch.
 */
export async function getReservationsForReminder(
  daysBeforeArrival: number = 1
): Promise<ActionResult<Array<{
  reservationId: string;
  guestName: string;
  phone: string | null;
  checkIn: Date;
  roomNumber: string;
  reminderAlreadySent: boolean;
}>>> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + daysBeforeArrival);
    
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);
    
    const reservations = await prisma.reservation.findMany({
      where: {
        checkIn: {
          gte: targetDate,
          lt: nextDay,
        },
        status: {
          in: ["CONFIRMED", "PENDING"],
        },
      },
      include: {
        guest: true,
        room: true,
      },
    });
    
    const results = await Promise.all(
      reservations.map(async (r) => {
        const existingReminder = await prisma.smsLog.findFirst({
          where: {
            reservationId: r.id,
            type: "REMINDER",
            status: "SENT",
          },
        });
        
        return {
          reservationId: r.id,
          guestName: `${r.guest.firstName} ${r.guest.lastName}`,
          phone: r.guest.phone?.trim() ?? null,
          checkIn: r.checkIn,
          roomNumber: r.room.number,
          reminderAlreadySent: !!existingReminder,
        };
      })
    );
    
    return { success: true, data: results };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania rezerwacji",
    };
  }
}
