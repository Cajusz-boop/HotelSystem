"use server";

import { prisma } from "@/lib/db";
import { lookupCompanyByNip as lookupFromWL } from "@/lib/nip-lookup";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

/** Dane firmy z WL (do auto-uzupełnienia) */
export interface CompanyFromNip {
  nip: string;
  name: string;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  country: string;
}

/**
 * NIP lookup: local database first, then external VAT API (WL).
 *
 * 1. Check local Company table by NIP. If found, return that record (includes
 *    manually edited full trading name, e.g. "Karczma Łabędź Łukasz Wojenkowski").
 * 2. If not found locally, call WL (VAT registry) API – returns legal name only.
 *
 * Frontend keeps Company name (and address) editable; on "Save Reservation"
 * createOrUpdateCompany is called with the edited data, so the next lookup
 * returns the full name from the database.
 */
export async function lookupCompanyByNip(
  nip: string
): Promise<ActionResult<CompanyFromNip>> {
  const raw = nip.replace(/\D/g, "").slice(0, 10);
  if (raw.length !== 10) {
    return { success: false, error: "NIP musi mieć 10 cyfr" };
  }

  try {
    const fromDb = await prisma.company.findUnique({
      where: { nip: raw },
    });
    if (fromDb) {
      return {
        success: true,
        data: {
          nip: fromDb.nip,
          name: fromDb.name,
          address: fromDb.address,
          postalCode: fromDb.postalCode,
          city: fromDb.city,
          country: fromDb.country,
        },
      };
    }
  } catch {
    // On DB error, fall through to WL
  }

  const result = await lookupFromWL(nip);
  if (!result.success) {
    return { success: false, error: result.error };
  }

  // Znane pełne nazwy (NIP → nazwa handlowa) – gdy WL zwraca tylko nazwę z rejestru VAT.
  // Można rozszerzyć przez env NIP_KNOWN_FULL_NAMES (JSON: {"5711640854":"KARCZMA ŁABĘDŹ ŁUKASZ WOJENKOWSKI"}).
  const knownFullNames: Record<string, string> = { "5711640854": "KARCZMA ŁABĘDŹ ŁUKASZ WOJENKOWSKI" };
  try {
    const fromEnv = process.env.NIP_KNOWN_FULL_NAMES;
    if (fromEnv && typeof fromEnv === "string") {
      const parsed = JSON.parse(fromEnv) as Record<string, string>;
      Object.assign(knownFullNames, parsed);
    }
  } catch {
    // ignoruj błędny JSON w env
  }
  const fullName = knownFullNames[raw];
  const data = fullName
    ? { ...result.data, name: fullName }
    : result.data;

  return { success: true, data };
}

/**
 * Tworzy lub aktualizuje firmę w bazie (po NIP).
 * Zwraca id firmy.
 */
export async function createOrUpdateCompany(data: {
  nip: string;
  name: string;
  address?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string;
}): Promise<ActionResult<{ companyId: string }>> {
  const nip = data.nip.replace(/\D/g, "").slice(0, 10);
  if (nip.length !== 10) {
    return { success: false, error: "NIP musi mieć 10 cyfr" };
  }

  try {
    const company = await prisma.company.upsert({
      where: { nip },
      create: {
        nip,
        name: data.name.trim(),
        address: data.address?.trim() || null,
        postalCode: data.postalCode?.trim() || null,
        city: data.city?.trim() || null,
        country: data.country?.trim() || "POL",
      },
      update: {
        name: data.name.trim(),
        address: data.address?.trim() ?? undefined,
        postalCode: data.postalCode?.trim() ?? undefined,
        city: data.city?.trim() ?? undefined,
        country: data.country?.trim() || "POL",
      },
    });
    return { success: true, data: { companyId: company.id } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd zapisu firmy",
    };
  }
}

/**
 * Zwraca firmę z bazy po NIP (do wyświetlania / faktury).
 */
export async function getCompanyByNip(
  nip: string
): Promise<ActionResult<{ id: string; nip: string; name: string; address: string | null; postalCode: string | null; city: string | null }>> {
  const raw = nip.replace(/\D/g, "").slice(0, 10);
  if (raw.length !== 10) {
    return { success: false, error: "NIP musi mieć 10 cyfr" };
  }
  try {
    const company = await prisma.company.findUnique({
      where: { nip: raw },
    });
    if (!company) {
      return { success: false, error: "Brak firmy o podanym NIP w bazie" };
    }
    return {
      success: true,
      data: {
        id: company.id,
        nip: company.nip,
        name: company.name,
        address: company.address,
        postalCode: company.postalCode,
        city: company.city,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu firmy",
    };
  }
}
