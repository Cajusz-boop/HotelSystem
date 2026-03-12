"use server";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { setAuthDisabledCache, invalidateAuthDisabledCache } from "@/lib/auth-disabled-cache";
import { autoExportConfigSnapshot } from "@/lib/config-snapshot";
import type {
  HotelConfigData,
  BookingTransferInfo,
  FormType,
  FormFieldsConfig,
  CustomFormField,
  CustomFormFieldType,
} from "@/lib/hotel-config-types";

export async function getHotelConfig(): Promise<
  { success: true; data: HotelConfigData } | { success: false; error: string }
> {
  const session = await getSession();
  if (!session) return { success: false, error: "Zaloguj się" };
  const allowed = await can(session.role, "admin.settings");
  if (!allowed) return { success: false, error: "Brak uprawnień" };

  let row = await prisma.hotelConfig.findUnique({ where: { id: "default" } });
  if (!row) {
    row = await prisma.hotelConfig.create({
      data: { id: "default", name: "" },
    });
  }
  return {
    success: true,
    data: {
      name: row.name,
      address: row.address,
      postalCode: row.postalCode,
      city: row.city,
      nip: row.nip,
      krs: row.krs,
      logoUrl: row.logoUrl,
      phone: row.phone,
      email: row.email,
      website: row.website,
      defaultCheckInTime: row.defaultCheckInTime,
      defaultCheckOutTime: row.defaultCheckOutTime,
      floors: Array.isArray(row.floors) ? (row.floors as string[]) : [],
      authDisabled: row.authDisabled ?? false,
      bankAccount: row.bankAccount ?? null,
      bankName: row.bankName ?? null,
      bookingNotificationEmail: row.bookingNotificationEmail ?? null,
    },
  };
}

export async function updateHotelConfig(data: Partial<HotelConfigData>): Promise<
  { success: true } | { success: false; error: string }
> {
  const session = await getSession();
  if (!session) return { success: false, error: "Zaloguj się" };
  const allowed = await can(session.role, "admin.settings");
  if (!allowed) return { success: false, error: "Brak uprawnień" };

  await prisma.hotelConfig.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      name: data.name ?? "",
      address: data.address ?? null,
      postalCode: data.postalCode ?? null,
      city: data.city ?? null,
      nip: data.nip ?? null,
      krs: data.krs ?? null,
      logoUrl: data.logoUrl ?? null,
      phone: data.phone ?? null,
      email: data.email ?? null,
      website: data.website ?? null,
      defaultCheckInTime: data.defaultCheckInTime ?? null,
      defaultCheckOutTime: data.defaultCheckOutTime ?? null,
      floors: data.floors ?? [],
      authDisabled: data.authDisabled ?? false,
      bankAccount: data.bankAccount ?? null,
      bankName: data.bankName ?? null,
      bookingNotificationEmail: data.bookingNotificationEmail ?? null,
    },
    update: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.address !== undefined && { address: data.address }),
      ...(data.postalCode !== undefined && { postalCode: data.postalCode }),
      ...(data.city !== undefined && { city: data.city }),
      ...(data.nip !== undefined && { nip: data.nip }),
      ...(data.krs !== undefined && { krs: data.krs }),
      ...(data.logoUrl !== undefined && { logoUrl: data.logoUrl }),
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(data.email !== undefined && { email: data.email }),
      ...(data.website !== undefined && { website: data.website }),
      ...(data.defaultCheckInTime !== undefined && { defaultCheckInTime: data.defaultCheckInTime }),
      ...(data.defaultCheckOutTime !== undefined && { defaultCheckOutTime: data.defaultCheckOutTime }),
      ...(data.floors !== undefined && { floors: data.floors }),
      ...(data.authDisabled !== undefined && { authDisabled: data.authDisabled }),
      ...(data.bankAccount !== undefined && { bankAccount: data.bankAccount ?? null }),
      ...(data.bankName !== undefined && { bankName: data.bankName ?? null }),
      ...(data.bookingNotificationEmail !== undefined && { bookingNotificationEmail: data.bookingNotificationEmail ?? null }),
    },
  });
  autoExportConfigSnapshot();
  return { success: true };
}

// --- Konfiguracja dodatkowych pól formularzy ---
export async function getFormFieldsConfig(): Promise<
  { success: true; data: FormFieldsConfig } | { success: false; error: string }
> {
  const session = await getSession();
  if (!session) return { success: false, error: "Zaloguj się" };
  const allowed = await can(session.role, "admin.settings");
  if (!allowed) return { success: false, error: "Brak uprawnień" };

  const row = await prisma.hotelConfig.findUnique({ where: { id: "default" } });
  const raw = (row?.customFormFields ?? {}) as FormFieldsConfig;
  const data: FormFieldsConfig = {};
  for (const formType of ["CHECK_IN", "RESERVATION", "GUEST"] as FormType[]) {
    const arr = raw[formType];
    data[formType] = Array.isArray(arr)
      ? arr
          .filter(
            (f): f is CustomFormField =>
              f && typeof f === "object" && typeof f.key === "string" && typeof f.label === "string"
          )
          .map((f) => ({
            id: f.id ?? `f-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            key: f.key,
            label: f.label,
            type: (f.type ?? "text") as CustomFormFieldType,
            required: Boolean(f.required),
            order: typeof f.order === "number" ? f.order : 0,
            options: Array.isArray(f.options) ? f.options : undefined,
          }))
          .sort((a, b) => a.order - b.order)
      : [];
  }
  return { success: true, data };
}

/** Odczyt konfiguracji pól dla danego formularza (np. do renderu) – bez wymagania admin.settings. */
export async function getFormFieldsForForm(formType: FormType): Promise<CustomFormField[]> {
  const row = await prisma.hotelConfig.findUnique({ where: { id: "default" } });
  const raw = (row?.customFormFields ?? {}) as FormFieldsConfig;
  const arr = raw[formType];
  if (!Array.isArray(arr)) return [];
  return arr
    .filter(
      (f): f is CustomFormField =>
        f && typeof f === "object" && typeof f.key === "string" && typeof f.label === "string"
    )
    .map((f) => ({
      id: f.id ?? `f-${f.key}`,
      key: f.key,
      label: f.label,
      type: (f.type ?? "text") as CustomFormFieldType,
      required: Boolean(f.required),
      order: typeof f.order === "number" ? f.order : 0,
      options: Array.isArray(f.options) ? f.options : undefined,
    }))
    .sort((a, b) => a.order - b.order);
}

export async function updateFormFieldsConfig(data: FormFieldsConfig): Promise<
  { success: true } | { success: false; error: string }
> {
  const session = await getSession();
  if (!session) return { success: false, error: "Zaloguj się" };
  const allowed = await can(session.role, "admin.settings");
  if (!allowed) return { success: false, error: "Brak uprawnień" };

  const normalized: FormFieldsConfig = {};
  for (const formType of ["CHECK_IN", "RESERVATION", "GUEST"] as FormType[]) {
    const arr = data[formType];
    if (!Array.isArray(arr)) {
      normalized[formType] = [];
      continue;
    }
    normalized[formType] = arr
      .map((f, i) => ({
        id: f?.id ?? `f-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 9)}`,
        key: String(f?.key ?? "").trim() || `pole_${i}`,
        label: String(f?.label ?? "").trim() || `Pole ${i + 1}`,
        type: (f?.type ?? "text") as CustomFormFieldType,
        required: Boolean(f?.required),
        order: i,
        options: Array.isArray(f?.options) ? f.options : undefined,
      }))
      .filter((f) => f.key.length > 0);
  }

  await prisma.hotelConfig.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      name: "",
      customFormFields: normalized as object,
    },
    update: {
      customFormFields: normalized as object,
    },
  });
  autoExportConfigSnapshot();
  return { success: true };
}

// --- Konfiguracja pól formularza imprez (typ imprezy → widoczność pól) ---
const DEFAULT_EVENT_TYPE_FIELDS_CONFIG: Record<string, Record<string, boolean>> = {
  WESELE: {
    clientName: true, clientPhone: true, clientEmail: true, eventDate: true,
    roomName: true, addPoprawiny: true, depositAmount: true, depositDueDate: true, depositPaid: true,
    timeStart: true, timeEnd: true, churchTime: true, adultsCount: true,
    children03: true, children47: true, orchestraCount: true, cameramanCount: true, photographerCount: true,
    cakesAndDesserts: true, cakeOrderedAt: true, cakeArrivalTime: true, cakeServedAt: true,
    drinksArrival: true, drinksStorage: true, champagneStorage: true, firstBottlesBy: true, alcoholAtTeamTable: true,
    cakesSwedishTable: true, fruitsSwedishTable: true, ownFlowers: true, ownVases: true,
    placeCards: true, placeCardsLayout: true, decorationColor: true, tableLayout: true,
    brideGroomTable: true, orchestraTable: true, breadWelcomeBy: true, extraAttractions: true,
    specialRequests: true, facebookConsent: true, ownNapkins: true, dutyPerson: true,
    assignedTo: true, afterpartyEnabled: true, afterpartyTimeFrom: true, afterpartyTimeTo: true,
    afterpartyGuests: true, afterpartyMenu: true, afterpartyMusic: true, notes: true,
  },
  KOMUNIA: {
    clientName: true, clientPhone: true, clientEmail: true, eventDate: true,
    roomName: true, addPoprawiny: false, depositAmount: true, depositDueDate: true, depositPaid: true,
    timeStart: true, timeEnd: true, churchTime: false, adultsCount: true,
    children03: true, children47: true, orchestraCount: true, cameramanCount: true, photographerCount: true,
    cakesAndDesserts: true, cakeOrderedAt: true, cakeArrivalTime: true, cakeServedAt: true,
    drinksArrival: true, drinksStorage: true, champagneStorage: true, firstBottlesBy: true, alcoholAtTeamTable: true,
    cakesSwedishTable: true, fruitsSwedishTable: true, ownFlowers: true, ownVases: true,
    placeCards: true, placeCardsLayout: true, decorationColor: true, tableLayout: true,
    brideGroomTable: false, orchestraTable: false, breadWelcomeBy: true, extraAttractions: true,
    specialRequests: true, facebookConsent: true, ownNapkins: true, dutyPerson: true,
    assignedTo: true, afterpartyEnabled: false, afterpartyTimeFrom: false, afterpartyTimeTo: false,
    afterpartyGuests: false, afterpartyMenu: false, afterpartyMusic: false, notes: true,
  },
  CHRZCINY: {
    clientName: true, clientPhone: true, clientEmail: true, eventDate: true,
    roomName: true, addPoprawiny: false, depositAmount: true, depositDueDate: true, depositPaid: true,
    timeStart: true, timeEnd: true, churchTime: false, adultsCount: true,
    children03: true, children47: true, orchestraCount: false, cameramanCount: false, photographerCount: false,
    cakesAndDesserts: true, cakeOrderedAt: true, cakeArrivalTime: true, cakeServedAt: true,
    drinksArrival: true, drinksStorage: true, champagneStorage: false, firstBottlesBy: false, alcoholAtTeamTable: false,
    cakesSwedishTable: true, fruitsSwedishTable: true, ownFlowers: true, ownVases: true,
    placeCards: false, placeCardsLayout: false, decorationColor: false, tableLayout: true,
    brideGroomTable: false, orchestraTable: false, breadWelcomeBy: true, extraAttractions: true,
    specialRequests: true, facebookConsent: true, ownNapkins: false, dutyPerson: true,
    assignedTo: true, afterpartyEnabled: false, afterpartyTimeFrom: false, afterpartyTimeTo: false,
    afterpartyGuests: false, afterpartyMenu: false, afterpartyMusic: false, notes: true,
  },
  URODZINY: {
    clientName: true, clientPhone: true, clientEmail: true, eventDate: true,
    roomName: true, addPoprawiny: false, depositAmount: true, depositDueDate: true, depositPaid: true,
    timeStart: true, timeEnd: true, churchTime: false, adultsCount: true,
    children03: true, children47: true, orchestraCount: true, cameramanCount: true, photographerCount: true,
    cakesAndDesserts: true, cakeOrderedAt: true, cakeArrivalTime: true, cakeServedAt: true,
    drinksArrival: true, drinksStorage: true, champagneStorage: true, firstBottlesBy: true, alcoholAtTeamTable: true,
    cakesSwedishTable: true, fruitsSwedishTable: true, ownFlowers: true, ownVases: true,
    placeCards: true, placeCardsLayout: true, decorationColor: true, tableLayout: true,
    brideGroomTable: false, orchestraTable: false, breadWelcomeBy: true, extraAttractions: true,
    specialRequests: true, facebookConsent: true, ownNapkins: true, dutyPerson: true,
    assignedTo: true, afterpartyEnabled: true, afterpartyTimeFrom: true, afterpartyTimeTo: true,
    afterpartyGuests: true, afterpartyMenu: true, afterpartyMusic: true, notes: true,
  },
  STYPA: {
    clientName: true, clientPhone: true, clientEmail: true, eventDate: true,
    roomName: true, addPoprawiny: false, depositAmount: true, depositDueDate: true, depositPaid: true,
    timeStart: true, timeEnd: true, churchTime: false, adultsCount: true,
    children03: false, children47: false, orchestraCount: false, cameramanCount: false, photographerCount: false,
    cakesAndDesserts: false, cakeOrderedAt: false, cakeArrivalTime: false, cakeServedAt: false,
    drinksArrival: false, drinksStorage: false, champagneStorage: false, firstBottlesBy: false, alcoholAtTeamTable: false,
    cakesSwedishTable: false, fruitsSwedishTable: false, ownFlowers: false, ownVases: false,
    placeCards: false, placeCardsLayout: false, decorationColor: false, tableLayout: true,
    brideGroomTable: false, orchestraTable: false, breadWelcomeBy: false, extraAttractions: false,
    specialRequests: true, facebookConsent: false, ownNapkins: false, dutyPerson: true,
    assignedTo: true, afterpartyEnabled: false, afterpartyTimeFrom: false, afterpartyTimeTo: false,
    afterpartyGuests: false, afterpartyMenu: false, afterpartyMusic: false, notes: true,
  },
  FIRMOWA: {
    clientName: true, clientPhone: true, clientEmail: true, eventDate: true,
    roomName: true, addPoprawiny: false, depositAmount: true, depositDueDate: true, depositPaid: true,
    timeStart: true, timeEnd: true, churchTime: false, adultsCount: true,
    children03: false, children47: false, orchestraCount: true, cameramanCount: true, photographerCount: true,
    cakesAndDesserts: true, cakeOrderedAt: false, cakeArrivalTime: false, cakeServedAt: false,
    drinksArrival: true, drinksStorage: true, champagneStorage: false, firstBottlesBy: false, alcoholAtTeamTable: true,
    cakesSwedishTable: true, fruitsSwedishTable: true, ownFlowers: false, ownVases: false,
    placeCards: false, placeCardsLayout: false, decorationColor: false, tableLayout: true,
    brideGroomTable: false, orchestraTable: false, breadWelcomeBy: false, extraAttractions: true,
    specialRequests: true, facebookConsent: false, ownNapkins: false, dutyPerson: true,
    assignedTo: true, afterpartyEnabled: false, afterpartyTimeFrom: false, afterpartyTimeTo: false,
    afterpartyGuests: false, afterpartyMenu: false, afterpartyMusic: false, notes: true,
  },
  SYLWESTER: {
    clientName: true, clientPhone: true, clientEmail: true, eventDate: true,
    roomName: true, addPoprawiny: false, depositAmount: true, depositDueDate: true, depositPaid: true,
    timeStart: true, timeEnd: true, churchTime: false, adultsCount: true,
    children03: true, children47: true, orchestraCount: true, cameramanCount: true, photographerCount: true,
    cakesAndDesserts: true, cakeOrderedAt: false, cakeArrivalTime: false, cakeServedAt: false,
    drinksArrival: true, drinksStorage: true, champagneStorage: true, firstBottlesBy: true, alcoholAtTeamTable: true,
    cakesSwedishTable: true, fruitsSwedishTable: true, ownFlowers: true, ownVases: true,
    placeCards: true, placeCardsLayout: true, decorationColor: true, tableLayout: true,
    brideGroomTable: false, orchestraTable: false, breadWelcomeBy: true, extraAttractions: true,
    specialRequests: true, facebookConsent: true, ownNapkins: true, dutyPerson: true,
    assignedTo: true, afterpartyEnabled: true, afterpartyTimeFrom: true, afterpartyTimeTo: true,
    afterpartyGuests: true, afterpartyMenu: true, afterpartyMusic: true, notes: true,
  },
  INNE: {
    clientName: true, clientPhone: true, clientEmail: true, eventDate: true,
    roomName: true, addPoprawiny: false, depositAmount: true, depositDueDate: true, depositPaid: true,
    timeStart: true, timeEnd: true, churchTime: false, adultsCount: true,
    children03: true, children47: true, orchestraCount: true, cameramanCount: true, photographerCount: true,
    cakesAndDesserts: true, cakeOrderedAt: true, cakeArrivalTime: true, cakeServedAt: true,
    drinksArrival: true, drinksStorage: true, champagneStorage: true, firstBottlesBy: true, alcoholAtTeamTable: true,
    cakesSwedishTable: true, fruitsSwedishTable: true, ownFlowers: true, ownVases: true,
    placeCards: true, placeCardsLayout: true, decorationColor: true, tableLayout: true,
    brideGroomTable: false, orchestraTable: false, breadWelcomeBy: true, extraAttractions: true,
    specialRequests: true, facebookConsent: true, ownNapkins: true, dutyPerson: true,
    assignedTo: true, afterpartyEnabled: false, afterpartyTimeFrom: false, afterpartyTimeTo: false,
    afterpartyGuests: false, afterpartyMenu: false, afterpartyMusic: false, notes: true,
  },
};

const NEW_FORMAT_KEYS = ["clientName", "eventDate", "roomName"];
function isNewFormatConfig(cfg: Record<string, unknown> | null): boolean {
  if (!cfg || typeof cfg !== "object") return false;
  const keys = Object.keys(cfg);
  return keys.length > 0 && NEW_FORMAT_KEYS.some((k) => k in cfg);
}

/** Odczyt konfiguracji pól dla typów imprez – bez wymagania admin (używane w formularzach). */
export async function getEventTypeFieldsConfig(): Promise<{
  success: boolean;
  data?: Record<string, Record<string, boolean>>;
  error?: string;
}> {
  try {
    const config = await prisma.hotelConfig.findUnique({ where: { id: "default" } });
    const raw = config?.eventTypeFieldsConfig as Record<string, Record<string, boolean>> | null | undefined;
    if (raw && typeof raw === "object") {
      const first = Object.values(raw)[0];
      if (isNewFormatConfig(first)) {
        return { success: true, data: raw };
      }
    }
    return { success: true, data: DEFAULT_EVENT_TYPE_FIELDS_CONFIG };
  } catch (error) {
    console.error("getEventTypeFieldsConfig error:", error);
    return { success: false, error: "Błąd pobierania konfiguracji" };
  }
}

export async function updateEventTypeFieldsConfig(
  config: Record<string, Record<string, boolean>>
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: "Zaloguj się" };
  const allowed = await can(session.role, "admin.settings");
  if (!allowed) return { success: false, error: "Brak uprawnień" };

  try {
    await prisma.hotelConfig.upsert({
      where: { id: "default" },
      update: { eventTypeFieldsConfig: config },
      create: { id: "default", name: "", eventTypeFieldsConfig: config },
    });
    autoExportConfigSnapshot();
    return { success: true };
  } catch (error) {
    console.error("updateEventTypeFieldsConfig error:", error);
    return { success: false, error: "Błąd zapisu konfiguracji" };
  }
}

// --- Przełączanie wymogu logowania (AUTH_DISABLED) ---

export async function toggleAuthDisabled(disabled: boolean): Promise<
  { success: true } | { success: false; error: string }
> {
  const session = await getSession();
  if (!session) return { success: false, error: "Zaloguj się" };
  const allowed = await can(session.role, "admin.settings");
  if (!allowed) return { success: false, error: "Brak uprawnień" };

  // Zapisz do bazy
  await prisma.hotelConfig.upsert({
    where: { id: "default" },
    create: { id: "default", name: "", authDisabled: disabled },
    update: { authDisabled: disabled },
  });

  invalidateAuthDisabledCache();
  setAuthDisabledCache(disabled);
  autoExportConfigSnapshot();

  return { success: true };
}

/** Odczyt statusu auth (bez wymagania sesji — potrzebne gdy auth jest wyłączone) */
export async function getAuthDisabledStatus(): Promise<boolean> {
  try {
    const row = await prisma.hotelConfig.findUnique({ where: { id: "default" } });
    return row?.authDisabled ?? false;
  } catch {
    return false;
  }
}

/**
 * E-mail na powiadomienia o zapytaniach rezerwacyjnych (Booking Engine).
 * Używane tylko po stronie serwera (mailing). Preferowany: bookingNotificationEmail, fallback: email.
 */
export async function getReceptionEmailForBooking(): Promise<string | null> {
  try {
    const row = await prisma.hotelConfig.findUnique({
      where: { id: "default" },
      select: { bookingNotificationEmail: true, email: true },
    });
    const email = (row?.bookingNotificationEmail ?? row?.email)?.trim();
    return email && /^[^@]+@[^@]+\./.test(email) ? email : null;
  } catch {
    return null;
  }
}

/**
 * Dane do przelewu tradycyjnego – publiczne (strona /booking, krok płatności).
 * Bez wymagania logowania.
 */
export async function getBookingTransferInfo(): Promise<BookingTransferInfo> {
  try {
    const row = await prisma.hotelConfig.findUnique({
      where: { id: "default" },
      select: { name: true, bankAccount: true, bankName: true },
    });
    return {
      name: row?.name?.trim() ?? "Karczma Łabędź",
      bankAccount: (row?.bankAccount ?? null)?.trim() || null,
      bankName: (row?.bankName ?? null)?.trim() || null,
    };
  } catch {
    return { name: "Karczma Łabędź", bankAccount: null, bankName: null };
  }
}
