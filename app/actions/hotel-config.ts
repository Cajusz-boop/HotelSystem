"use server";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { setAuthDisabledCache } from "@/lib/auth-disabled-cache";
import { autoExportConfigSnapshot } from "@/lib/config-snapshot";
import type {
  HotelConfigData,
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
