"use server";

import { prisma } from "@/lib/db";
import { lookupCompanyByNip as lookupFromWL } from "@/lib/nip-lookup";
import { generateNextDocumentNumber } from "@/app/actions/finance";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

// ===== TYPY =====

export interface CompanyForList {
  id: string;
  nip: string;
  name: string;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  country: string;
  // Osoba kontaktowa
  contactPerson: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactPosition: string | null;
  // Warunki płatności
  paymentTermDays: number;
  creditLimit: number | null;
  billingEmail: string | null;
  billingNotes: string | null;
  // Opiekun handlowy
  accountManagerId: string | null;
  accountManagerName: string | null;
  createdAt: Date;
  updatedAt: Date;
  reservationCount: number;
}

export interface CompanyDetails extends CompanyForList {
  reservations: Array<{
    id: string;
    confirmationNumber: string | null;
    guestName: string;
    roomNumber: string;
    checkIn: Date;
    checkOut: Date;
    status: string;
    totalAmount: number;
  }>;
  contracts: CorporateContractForList[];
}

// ===== KONTRAKTY KORPORACYJNE =====

export interface CorporateContractForList {
  id: string;
  name: string | null;
  discountPercent: number | null;
  fixedPricePerNight: number | null;
  validFrom: Date;
  validTo: Date;
  minNightsPerYear: number | null;
  paymentTermDays: number;
  contactPerson: string | null;
  isActive: boolean;
  rateCode: { id: string; code: string; name: string } | null;
  createdAt: Date;
}

export interface CorporateContractDetails extends CorporateContractForList {
  minRevenuePerYear: number | null;
  commissionPercent: number | null;
  contactEmail: string | null;
  contactPhone: string | null;
  notes: string | null;
  companyId: string;
  companyName: string;
  companyNip: string;
}

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
  const raw = nip.replace(/\D/g, "");
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
  const nip = data.nip.replace(/\D/g, "");
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
  const raw = nip.replace(/\D/g, "");
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

// ===== ZARZĄDZANIE FIRMAMI =====

/**
 * Pobiera listę wszystkich firm z opcjonalnym wyszukiwaniem i paginacją.
 */
export async function getAllCompanies(options?: {
  query?: string;
  limit?: number;
  offset?: number;
  sortBy?: "name" | "nip" | "city" | "createdAt" | "reservationCount";
  sortOrder?: "asc" | "desc";
}): Promise<ActionResult<{ companies: CompanyForList[]; total: number }>> {
  try {
    const {
      query = "",
      limit = 50,
      offset = 0,
      sortBy = "name",
      sortOrder = "asc",
    } = options ?? {};

    const searchQuery = query.trim();
    const where = searchQuery
      ? {
          OR: [
            { name: { contains: searchQuery } },
            { nip: { contains: searchQuery.replace(/\D/g, "") } },
            { city: { contains: searchQuery } },
            { address: { contains: searchQuery } },
          ],
        }
      : {};

    // Zlicz wszystkie firmy pasujące do zapytania
    const total = await prisma.company.count({ where });

    // Pobierz firmy z liczbą rezerwacji i opiekunem handlowym
    const companies = await prisma.company.findMany({
      where,
      include: {
        _count: {
          select: { reservations: true },
        },
        accountManager: {
          select: { id: true, name: true },
        },
      },
      orderBy:
        sortBy === "reservationCount"
          ? { reservations: { _count: sortOrder } }
          : { [sortBy]: sortOrder },
      take: limit,
      skip: offset,
    });

    const result: CompanyForList[] = companies.map((c) => ({
      id: c.id,
      nip: c.nip,
      name: c.name,
      address: c.address,
      postalCode: c.postalCode,
      city: c.city,
      country: c.country,
      contactPerson: c.contactPerson,
      contactEmail: c.contactEmail,
      contactPhone: c.contactPhone,
      contactPosition: c.contactPosition,
      paymentTermDays: c.paymentTermDays,
      creditLimit: c.creditLimit?.toNumber() ?? null,
      billingEmail: c.billingEmail,
      billingNotes: c.billingNotes,
      accountManagerId: c.accountManagerId,
      accountManagerName: c.accountManager?.name ?? null,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      reservationCount: c._count.reservations,
    }));

    return { success: true, data: { companies: result, total } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania firm",
    };
  }
}

/**
 * Pobiera szczegóły firmy wraz z rezerwacjami.
 */
export async function getCompanyById(
  companyId: string
): Promise<ActionResult<CompanyDetails>> {
  try {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
        reservations: {
          include: {
            guest: { select: { name: true } },
            room: { select: { number: true } },
          },
          orderBy: { checkIn: "desc" },
          take: 100,
        },
        corporateContracts: {
          include: {
            rateCode: { select: { id: true, code: true, name: true } },
          },
          orderBy: { validFrom: "desc" },
        },
        accountManager: {
          select: { id: true, name: true },
        },
        _count: {
          select: { reservations: true },
        },
      },
    });

    if (!company) {
      return { success: false, error: "Firma nie istnieje" };
    }

    const result: CompanyDetails = {
      id: company.id,
      nip: company.nip,
      name: company.name,
      address: company.address,
      postalCode: company.postalCode,
      city: company.city,
      country: company.country,
      contactPerson: company.contactPerson,
      contactEmail: company.contactEmail,
      contactPhone: company.contactPhone,
      contactPosition: company.contactPosition,
      paymentTermDays: company.paymentTermDays,
      creditLimit: company.creditLimit?.toNumber() ?? null,
      billingEmail: company.billingEmail,
      billingNotes: company.billingNotes,
      accountManagerId: company.accountManagerId,
      accountManagerName: company.accountManager?.name ?? null,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
      reservationCount: company._count.reservations,
      reservations: company.reservations.map((r) => ({
        id: r.id,
        confirmationNumber: r.confirmationNumber,
        guestName: r.guest.name,
        roomNumber: r.room.number,
        checkIn: r.checkIn,
        checkOut: r.checkOut,
        status: r.status,
        totalAmount: 0, // TODO: Reservation nie ma totalAmount – obliczyć z Transaction/ReservationFolio gdy potrzebne
      })),
      contracts: company.corporateContracts.map((c) => ({
        id: c.id,
        name: c.name,
        discountPercent: c.discountPercent?.toNumber() ?? null,
        fixedPricePerNight: c.fixedPricePerNight?.toNumber() ?? null,
        validFrom: c.validFrom,
        validTo: c.validTo,
        minNightsPerYear: c.minNightsPerYear,
        paymentTermDays: c.paymentTermDays,
        contactPerson: c.contactPerson,
        isActive: c.isActive,
        rateCode: c.rateCode,
        createdAt: c.createdAt,
      })),
    };

    return { success: true, data: result };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania danych firmy",
    };
  }
}

/**
 * Aktualizuje dane firmy.
 */
export async function updateCompany(
  companyId: string,
  data: {
    name?: string;
    address?: string | null;
    postalCode?: string | null;
    city?: string | null;
    country?: string;
    contactPerson?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    contactPosition?: string | null;
    paymentTermDays?: number;
    creditLimit?: number | null;
    billingEmail?: string | null;
    billingNotes?: string | null;
    accountManagerId?: string | null;
  }
): Promise<ActionResult<{ companyId: string }>> {
  try {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });
    if (!company) {
      return { success: false, error: "Firma nie istnieje" };
    }

    // Walidacja
    if (data.paymentTermDays !== undefined && data.paymentTermDays < 0) {
      return { success: false, error: "Termin płatności nie może być ujemny" };
    }
    if (data.creditLimit !== undefined && data.creditLimit !== null && data.creditLimit < 0) {
      return { success: false, error: "Limit kredytowy nie może być ujemny" };
    }

    // Walidacja opiekuna handlowego
    if (data.accountManagerId !== undefined && data.accountManagerId !== null) {
      const user = await prisma.user.findUnique({
        where: { id: data.accountManagerId },
      });
      if (!user) {
        return { success: false, error: "Wybrany pracownik nie istnieje" };
      }
    }

    await prisma.company.update({
      where: { id: companyId },
      data: {
        name: data.name?.trim() ?? company.name,
        address: data.address !== undefined ? data.address?.trim() || null : company.address,
        postalCode: data.postalCode !== undefined ? data.postalCode?.trim() || null : company.postalCode,
        city: data.city !== undefined ? data.city?.trim() || null : company.city,
        country: data.country?.trim() || company.country,
        contactPerson: data.contactPerson !== undefined ? data.contactPerson?.trim() || null : company.contactPerson,
        contactEmail: data.contactEmail !== undefined ? data.contactEmail?.trim() || null : company.contactEmail,
        contactPhone: data.contactPhone !== undefined ? data.contactPhone?.trim() || null : company.contactPhone,
        contactPosition: data.contactPosition !== undefined ? data.contactPosition?.trim() || null : company.contactPosition,
        paymentTermDays: data.paymentTermDays !== undefined ? data.paymentTermDays : company.paymentTermDays,
        creditLimit: data.creditLimit !== undefined ? data.creditLimit : undefined,
        billingEmail: data.billingEmail !== undefined ? data.billingEmail?.trim() || null : company.billingEmail,
        billingNotes: data.billingNotes !== undefined ? data.billingNotes?.trim() || null : company.billingNotes,
        accountManagerId: data.accountManagerId !== undefined ? data.accountManagerId : company.accountManagerId,
      },
    });

    return { success: true, data: { companyId } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd aktualizacji firmy",
    };
  }
}

/**
 * Usuwa firmę z bazy (tylko jeśli nie ma powiązanych rezerwacji).
 */
export async function deleteCompany(
  companyId: string
): Promise<ActionResult<void>> {
  try {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
        _count: {
          select: { reservations: true },
        },
      },
    });

    if (!company) {
      return { success: false, error: "Firma nie istnieje" };
    }

    if (company._count.reservations > 0) {
      return {
        success: false,
        error: `Nie można usunąć firmy – ma ${company._count.reservations} powiązanych rezerwacji. Usuń najpierw powiązania lub zmień firmę w rezerwacjach.`,
      };
    }

    await prisma.company.delete({
      where: { id: companyId },
    });

    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd usuwania firmy",
    };
  }
}

/**
 * Wyszukuje firmy po fragmencie nazwy lub NIP (do autocomplete).
 */
export async function searchCompanies(
  query: string,
  limit = 10
): Promise<ActionResult<Array<{ id: string; nip: string; name: string; city: string | null }>>> {
  try {
    const searchQuery = query.trim();
    if (searchQuery.length < 2) {
      return { success: true, data: [] };
    }

    const companies = await prisma.company.findMany({
      where: {
        OR: [
          { name: { contains: searchQuery } },
          { nip: { contains: searchQuery.replace(/\D/g, "") } },
        ],
      },
      select: {
        id: true,
        nip: true,
        name: true,
        city: true,
      },
      take: limit,
      orderBy: { name: "asc" },
    });

    return { success: true, data: companies };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd wyszukiwania firm",
    };
  }
}

/**
 * Pobiera statystyki firm dla widoku podsumowania.
 */
export async function getCompanyStats(): Promise<
  ActionResult<{
    totalCompanies: number;
    companiesWithReservations: number;
    topCompaniesByReservations: Array<{ id: string; name: string; nip: string; reservationCount: number }>;
    recentlyAdded: Array<{ id: string; name: string; nip: string; createdAt: Date }>;
  }>
> {
  try {
    const totalCompanies = await prisma.company.count();

    const companiesWithRes = await prisma.company.count({
      where: {
        reservations: {
          some: {},
        },
      },
    });

    const topCompanies = await prisma.company.findMany({
      include: {
        _count: { select: { reservations: true } },
      },
      orderBy: {
        reservations: { _count: "desc" },
      },
      take: 5,
    });

    const recentCompanies = await prisma.company.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        name: true,
        nip: true,
        createdAt: true,
      },
    });

    return {
      success: true,
      data: {
        totalCompanies,
        companiesWithReservations: companiesWithRes,
        topCompaniesByReservations: topCompanies.map((c) => ({
          id: c.id,
          name: c.name,
          nip: c.nip,
          reservationCount: c._count.reservations,
        })),
        recentlyAdded: recentCompanies,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania statystyk firm",
    };
  }
}

// ===== KONTRAKTY KORPORACYJNE =====

/**
 * Pobiera wszystkie kontrakty korporacyjne dla firmy.
 */
export async function getCompanyContracts(
  companyId: string
): Promise<ActionResult<CorporateContractForList[]>> {
  try {
    const contracts = await prisma.corporateContract.findMany({
      where: { companyId },
      include: {
        rateCode: {
          select: { id: true, code: true, name: true },
        },
      },
      orderBy: { validFrom: "desc" },
    });

    return {
      success: true,
      data: contracts.map((c) => ({
        id: c.id,
        name: c.name,
        discountPercent: c.discountPercent?.toNumber() ?? null,
        fixedPricePerNight: c.fixedPricePerNight?.toNumber() ?? null,
        validFrom: c.validFrom,
        validTo: c.validTo,
        minNightsPerYear: c.minNightsPerYear,
        paymentTermDays: c.paymentTermDays,
        contactPerson: c.contactPerson,
        isActive: c.isActive,
        rateCode: c.rateCode,
        createdAt: c.createdAt,
      })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania kontraktów",
    };
  }
}

/**
 * Pobiera szczegóły kontraktu korporacyjnego.
 */
export async function getContractById(
  contractId: string
): Promise<ActionResult<CorporateContractDetails>> {
  try {
    const contract = await prisma.corporateContract.findUnique({
      where: { id: contractId },
      include: {
        company: {
          select: { id: true, name: true, nip: true },
        },
        rateCode: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    if (!contract) {
      return { success: false, error: "Kontrakt nie istnieje" };
    }

    return {
      success: true,
      data: {
        id: contract.id,
        name: contract.name,
        discountPercent: contract.discountPercent?.toNumber() ?? null,
        fixedPricePerNight: contract.fixedPricePerNight?.toNumber() ?? null,
        validFrom: contract.validFrom,
        validTo: contract.validTo,
        minNightsPerYear: contract.minNightsPerYear,
        minRevenuePerYear: contract.minRevenuePerYear?.toNumber() ?? null,
        paymentTermDays: contract.paymentTermDays,
        commissionPercent: contract.commissionPercent?.toNumber() ?? null,
        contactPerson: contract.contactPerson,
        contactEmail: contract.contactEmail,
        contactPhone: contract.contactPhone,
        notes: contract.notes,
        isActive: contract.isActive,
        rateCode: contract.rateCode,
        createdAt: contract.createdAt,
        companyId: contract.companyId,
        companyName: contract.company.name,
        companyNip: contract.company.nip,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania kontraktu",
    };
  }
}

/**
 * Tworzy nowy kontrakt korporacyjny.
 */
export async function createCorporateContract(data: {
  companyId: string;
  name?: string;
  rateCodeId?: string | null;
  discountPercent?: number | null;
  fixedPricePerNight?: number | null;
  validFrom: Date | string;
  validTo: Date | string;
  minNightsPerYear?: number | null;
  minRevenuePerYear?: number | null;
  paymentTermDays?: number;
  commissionPercent?: number | null;
  contactPerson?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  notes?: string | null;
  isActive?: boolean;
}): Promise<ActionResult<{ contractId: string }>> {
  try {
    // Walidacja
    const validFrom = new Date(data.validFrom);
    const validTo = new Date(data.validTo);

    if (validTo <= validFrom) {
      return { success: false, error: "Data końca musi być późniejsza niż data początku" };
    }

    if (data.discountPercent !== null && data.discountPercent !== undefined) {
      if (data.discountPercent < 0 || data.discountPercent > 100) {
        return { success: false, error: "Rabat musi być między 0 a 100%" };
      }
    }

    // Sprawdź czy firma istnieje
    const company = await prisma.company.findUnique({
      where: { id: data.companyId },
    });
    if (!company) {
      return { success: false, error: "Firma nie istnieje" };
    }

    // Sprawdź czy rateCode istnieje (jeśli podano)
    if (data.rateCodeId) {
      const rateCode = await prisma.rateCode.findUnique({
        where: { id: data.rateCodeId },
      });
      if (!rateCode) {
        return { success: false, error: "Wybrany kod cenowy nie istnieje" };
      }
    }

    const contract = await prisma.corporateContract.create({
      data: {
        companyId: data.companyId,
        name: data.name?.trim() || null,
        rateCodeId: data.rateCodeId || null,
        discountPercent: data.discountPercent ?? null,
        fixedPricePerNight: data.fixedPricePerNight ?? null,
        validFrom,
        validTo,
        minNightsPerYear: data.minNightsPerYear ?? null,
        minRevenuePerYear: data.minRevenuePerYear ?? null,
        paymentTermDays: data.paymentTermDays ?? 14,
        commissionPercent: data.commissionPercent ?? null,
        contactPerson: data.contactPerson?.trim() || null,
        contactEmail: data.contactEmail?.trim() || null,
        contactPhone: data.contactPhone?.trim() || null,
        notes: data.notes?.trim() || null,
        isActive: data.isActive ?? true,
      },
    });

    return { success: true, data: { contractId: contract.id } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd tworzenia kontraktu",
    };
  }
}

/**
 * Aktualizuje kontrakt korporacyjny.
 */
export async function updateCorporateContract(
  contractId: string,
  data: {
    name?: string | null;
    rateCodeId?: string | null;
    discountPercent?: number | null;
    fixedPricePerNight?: number | null;
    validFrom?: Date | string;
    validTo?: Date | string;
    minNightsPerYear?: number | null;
    minRevenuePerYear?: number | null;
    paymentTermDays?: number;
    commissionPercent?: number | null;
    contactPerson?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    notes?: string | null;
    isActive?: boolean;
  }
): Promise<ActionResult<{ contractId: string }>> {
  try {
    const existing = await prisma.corporateContract.findUnique({
      where: { id: contractId },
    });
    if (!existing) {
      return { success: false, error: "Kontrakt nie istnieje" };
    }

    // Walidacja dat
    const validFrom = data.validFrom ? new Date(data.validFrom) : existing.validFrom;
    const validTo = data.validTo ? new Date(data.validTo) : existing.validTo;

    if (validTo <= validFrom) {
      return { success: false, error: "Data końca musi być późniejsza niż data początku" };
    }

    if (data.discountPercent !== undefined && data.discountPercent !== null) {
      if (data.discountPercent < 0 || data.discountPercent > 100) {
        return { success: false, error: "Rabat musi być między 0 a 100%" };
      }
    }

    await prisma.corporateContract.update({
      where: { id: contractId },
      data: {
        name: data.name !== undefined ? (data.name?.trim() || null) : undefined,
        rateCodeId: data.rateCodeId !== undefined ? (data.rateCodeId || null) : undefined,
        discountPercent: data.discountPercent !== undefined ? data.discountPercent : undefined,
        fixedPricePerNight: data.fixedPricePerNight !== undefined ? data.fixedPricePerNight : undefined,
        validFrom: data.validFrom ? validFrom : undefined,
        validTo: data.validTo ? validTo : undefined,
        minNightsPerYear: data.minNightsPerYear !== undefined ? data.minNightsPerYear : undefined,
        minRevenuePerYear: data.minRevenuePerYear !== undefined ? data.minRevenuePerYear : undefined,
        paymentTermDays: data.paymentTermDays !== undefined ? data.paymentTermDays : undefined,
        commissionPercent: data.commissionPercent !== undefined ? data.commissionPercent : undefined,
        contactPerson: data.contactPerson !== undefined ? (data.contactPerson?.trim() || null) : undefined,
        contactEmail: data.contactEmail !== undefined ? (data.contactEmail?.trim() || null) : undefined,
        contactPhone: data.contactPhone !== undefined ? (data.contactPhone?.trim() || null) : undefined,
        notes: data.notes !== undefined ? (data.notes?.trim() || null) : undefined,
        isActive: data.isActive !== undefined ? data.isActive : undefined,
      },
    });

    return { success: true, data: { contractId } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd aktualizacji kontraktu",
    };
  }
}

/**
 * Usuwa kontrakt korporacyjny.
 */
export async function deleteCorporateContract(
  contractId: string
): Promise<ActionResult<void>> {
  try {
    const existing = await prisma.corporateContract.findUnique({
      where: { id: contractId },
    });
    if (!existing) {
      return { success: false, error: "Kontrakt nie istnieje" };
    }

    await prisma.corporateContract.delete({
      where: { id: contractId },
    });

    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd usuwania kontraktu",
    };
  }
}

/**
 * Pobiera aktywny kontrakt dla firmy (jeśli istnieje).
 * Używane przy tworzeniu rezerwacji – automatyczne zastosowanie rabatu korporacyjnego.
 */
export async function getActiveContractForCompany(
  companyId: string
): Promise<ActionResult<CorporateContractForList | null>> {
  try {
    const now = new Date();

    const contract = await prisma.corporateContract.findFirst({
      where: {
        companyId,
        isActive: true,
        validFrom: { lte: now },
        validTo: { gte: now },
      },
      include: {
        rateCode: {
          select: { id: true, code: true, name: true },
        },
      },
      orderBy: { createdAt: "desc" }, // Najnowszy kontrakt
    });

    if (!contract) {
      return { success: true, data: null };
    }

    return {
      success: true,
      data: {
        id: contract.id,
        name: contract.name,
        discountPercent: contract.discountPercent?.toNumber() ?? null,
        fixedPricePerNight: contract.fixedPricePerNight?.toNumber() ?? null,
        validFrom: contract.validFrom,
        validTo: contract.validTo,
        minNightsPerYear: contract.minNightsPerYear,
        paymentTermDays: contract.paymentTermDays,
        contactPerson: contract.contactPerson,
        isActive: contract.isActive,
        rateCode: contract.rateCode,
        createdAt: contract.createdAt,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania kontraktu",
    };
  }
}

/**
 * Pobiera listę dostępnych kodów cenowych (do wyboru w kontrakcie).
 */
export async function getRateCodes(): Promise<
  ActionResult<Array<{ id: string; code: string; name: string; price: number | null }>>
> {
  try {
    const rateCodes = await prisma.rateCode.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        price: true,
      },
      orderBy: { code: "asc" },
    });

    return {
      success: true,
      data: rateCodes.map((rc) => ({
        id: rc.id,
        code: rc.code,
        name: rc.name,
        price: rc.price?.toNumber() ?? null,
      })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania kodów cenowych",
    };
  }
}

// ===== ROZRACHUNKI Z FIRMĄ =====

export interface CompanyBalance {
  // Podsumowanie ogólne
  totalReservations: number;
  totalRevenue: number;      // łączna wartość rezerwacji
  totalPaid: number;         // kwota już opłacona
  totalOutstanding: number;  // saldo do zapłaty
  
  // Podział wg statusu
  confirmedAmount: number;   // oczekujące rezerwacje
  checkedInAmount: number;   // aktywne pobyty
  checkedOutAmount: number;  // zakończone pobyty
  cancelledAmount: number;   // anulowane (np. kary za anulację)
  
  // Analiza kredytu
  creditLimit: number | null;
  creditUsed: number;        // wykorzystany kredyt (niezapłacone faktury)
  creditAvailable: number | null;  // dostępny kredyt
  isOverLimit: boolean;
  
  // Ostatnie transakcje
  recentReservations: Array<{
    id: string;
    confirmationNumber: string | null;
    guestName: string;
    checkIn: Date;
    checkOut: Date;
    totalAmount: number;
    paidAmount: number;
    status: string;
  }>;
}

/**
 * Pobiera rozrachunki (saldo należności) dla firmy.
 */
export async function getCompanyBalance(
  companyId: string
): Promise<ActionResult<CompanyBalance>> {
  try {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
        reservations: {
          include: {
            guest: { select: { name: true } },
            transactions: {
              select: {
                id: true,
                amount: true,
                type: true,
              },
            },
          },
          orderBy: { checkIn: "desc" },
        },
      },
    });

    if (!company) {
      return { success: false, error: "Firma nie istnieje" };
    }

    // Oblicz sumy dla każdego statusu
    let totalRevenue = 0;
    let totalPaid = 0;
    let confirmedAmount = 0;
    let checkedInAmount = 0;
    let checkedOutAmount = 0;
    let cancelledAmount = 0;

    const recentReservations: CompanyBalance["recentReservations"] = [];

    for (const res of company.reservations) {
      // Reservation nie ma totalAmount – suma obciążeń z transakcji (CHARGE) lub 0
      const resAmount =
        res.transactions
          ?.filter((t) => t.type === "CHARGE" || t.type === "CHARGE_ADJUSTMENT")
          .reduce((s, t) => s + (t.amount?.toNumber() ?? 0), 0) ?? 0;

      // Oblicz sumę płatności dla tej rezerwacji
      const paidForRes = res.transactions
        .filter((t) => t.type === "PAYMENT" || t.type === "DEPOSIT")
        .reduce((sum, t) => sum + (t.amount?.toNumber() ?? 0), 0);

      totalRevenue += resAmount;
      totalPaid += paidForRes;

      // Kategoryzuj wg statusu
      switch (res.status) {
        case "CONFIRMED":
          confirmedAmount += resAmount;
          break;
        case "CHECKED_IN":
          checkedInAmount += resAmount;
          break;
        case "CHECKED_OUT":
          checkedOutAmount += resAmount;
          break;
        case "CANCELLED":
        case "NO_SHOW":
          // Ewentualna kara za anulację
          cancelledAmount += resAmount;
          break;
      }

      // Dodaj do ostatnich rezerwacji (max 10)
      if (recentReservations.length < 10) {
        recentReservations.push({
          id: res.id,
          confirmationNumber: res.confirmationNumber,
          guestName: res.guest.name,
          checkIn: res.checkIn,
          checkOut: res.checkOut,
          totalAmount: resAmount,
          paidAmount: paidForRes,
          status: res.status,
        });
      }
    }

    const totalOutstanding = totalRevenue - totalPaid;
    const creditLimit = company.creditLimit?.toNumber() ?? null;
    const creditUsed = totalOutstanding > 0 ? totalOutstanding : 0;
    const creditAvailable = creditLimit !== null ? creditLimit - creditUsed : null;
    const isOverLimit = creditLimit !== null && creditUsed > creditLimit;

    return {
      success: true,
      data: {
        totalReservations: company.reservations.length,
        totalRevenue,
        totalPaid,
        totalOutstanding,
        confirmedAmount,
        checkedInAmount,
        checkedOutAmount,
        cancelledAmount,
        creditLimit,
        creditUsed,
        creditAvailable,
        isOverLimit,
        recentReservations,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania rozrachunków",
    };
  }
}

// ===== OPIEKUNOWIE HANDLOWI =====

export interface AccountManager {
  id: string;
  name: string;
  email: string;
  role: string;
  managedCompaniesCount: number;
}

/**
 * Pobiera listę pracowników, którzy mogą być opiekunami handlowymi.
 * Domyślnie tylko MANAGER i OWNER, opcjonalnie wszyscy.
 */
export async function getAccountManagers(options?: {
  includeAllRoles?: boolean;
}): Promise<ActionResult<AccountManager[]>> {
  try {
    const { includeAllRoles = false } = options ?? {};

    const where = includeAllRoles
      ? {}
      : {
          role: {
            in: ["MANAGER", "OWNER", "RECEPTION"],
          },
        };

    const users = await prisma.user.findMany({
      where,
      include: {
        _count: {
          select: { managedCompanies: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return {
      success: true,
      data: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        managedCompaniesCount: u._count.managedCompanies,
      })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania opiekunów",
    };
  }
}

// ===== FAKTURY ZBIORCZE =====

export interface ConsolidatedInvoiceForList {
  id: string;
  number: string;
  companyName: string;
  companyNip: string;
  periodFrom: Date;
  periodTo: Date;
  amountGross: number;
  itemsCount: number;
  status: string;
  dueDate: Date;
  issuedAt: Date;
}

export interface ConsolidatedInvoiceDetails extends ConsolidatedInvoiceForList {
  companyId: string;
  amountNet: number;
  amountVat: number;
  vatRate: number;
  buyerName: string;
  buyerNip: string;
  buyerAddress: string | null;
  buyerPostalCode: string | null;
  buyerCity: string | null;
  paymentTermDays: number;
  paidAt: Date | null;
  notes: string | null;
  createdAt: Date;
  items: Array<{
    id: string;
    reservationId: string;
    guestName: string;
    roomNumber: string;
    checkIn: Date;
    checkOut: Date;
    nights: number;
    amountNet: number;
    amountVat: number;
    amountGross: number;
    description: string | null;
  }>;
}

/**
 * Pobiera rezerwacje firmy gotowe do fakturowania zbiorczego.
 * Rezerwacje muszą być CHECKED_OUT i nie mieć jeszcze faktury zbiorczej.
 */
export async function getReservationsForConsolidatedInvoice(
  companyId: string,
  options?: {
    periodFrom?: Date;
    periodTo?: Date;
  }
): Promise<
  ActionResult<
    Array<{
      id: string;
      confirmationNumber: string | null;
      guestName: string;
      roomNumber: string;
      checkIn: Date;
      checkOut: Date;
      nights: number;
      totalAmount: number;
      status: string;
      hasInvoice: boolean;
    }>
  >
> {
  try {
    const { periodFrom, periodTo } = options ?? {};

    // Pobierz rezerwacje firmy z odpowiednim statusem
    const reservations = await prisma.reservation.findMany({
      where: {
        companyId,
        status: { in: ["CHECKED_OUT", "CHECKED_IN", "CONFIRMED"] },
        ...(periodFrom && periodTo
          ? {
              checkOut: {
                gte: periodFrom,
                lte: periodTo,
              },
            }
          : {}),
      },
      include: {
        guest: { select: { name: true } },
        room: { select: { number: true } },
        invoices: { select: { id: true } },
      },
      orderBy: { checkIn: "asc" },
    });

    // Sprawdź, które rezerwacje są już na fakturze zbiorczej
    const existingItems = await prisma.consolidatedInvoiceItem.findMany({
      where: {
        reservationId: { in: reservations.map((r) => r.id) },
      },
      select: { reservationId: true },
    });
    const invoicedReservationIds = new Set(existingItems.map((i) => i.reservationId));

    const result = reservations.map((r) => {
      const checkIn = new Date(r.checkIn);
      const checkOut = new Date(r.checkOut);
      const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

      return {
        id: r.id,
        confirmationNumber: r.confirmationNumber,
        guestName: r.guest.name,
        roomNumber: r.room.number,
        checkIn: r.checkIn,
        checkOut: r.checkOut,
        nights,
        totalAmount: 0, // TODO: Reservation nie ma totalAmount – obliczyć z Transaction/Folio gdy potrzebne
        status: r.status,
        hasInvoice: invoicedReservationIds.has(r.id) || r.invoices.length > 0,
      };
    });

    return { success: true, data: result };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania rezerwacji",
    };
  }
}

/**
 * Generuje numer faktury zbiorczej z konfigurowalną numeracją.
 * @returns numer faktury zbiorczej lub rzuca błąd przy niepowodzeniu
 */
async function generateConsolidatedInvoiceNumber(): Promise<string> {
  const result = await generateNextDocumentNumber("CONSOLIDATED_INVOICE");
  if (!result.success) throw new Error(result.error);
  return result.data;
}

/**
 * Tworzy fakturę zbiorczą dla wybranych rezerwacji firmy.
 */
export async function createConsolidatedInvoice(data: {
  companyId: string;
  reservationIds: string[];
  vatRate?: number;
  paymentTermDays?: number;
  notes?: string | null;
}): Promise<ActionResult<{ invoiceId: string; invoiceNumber: string }>> {
  try {
    const { companyId, reservationIds, vatRate = 8, paymentTermDays, notes } = data;

    // Walidacja
    if (reservationIds.length === 0) {
      return { success: false, error: "Wybierz co najmniej jedną rezerwację" };
    }

    // Pobierz firmę
    const company = await prisma.company.findUnique({
      where: { id: companyId },
    });
    if (!company) {
      return { success: false, error: "Firma nie istnieje" };
    }

    // Pobierz rezerwacje
    const reservations = await prisma.reservation.findMany({
      where: {
        id: { in: reservationIds },
        companyId, // upewnij się, że należą do tej firmy
      },
      include: {
        guest: { select: { name: true } },
        room: { select: { number: true } },
      },
    });

    if (reservations.length !== reservationIds.length) {
      return {
        success: false,
        error: "Niektóre rezerwacje nie istnieją lub nie należą do tej firmy",
      };
    }

    // Sprawdź, czy nie są już na fakturze zbiorczej
    const existingItems = await prisma.consolidatedInvoiceItem.findMany({
      where: { reservationId: { in: reservationIds } },
      select: { reservationId: true },
    });
    if (existingItems.length > 0) {
      return {
        success: false,
        error: "Niektóre rezerwacje są już na fakturze zbiorczej",
      };
    }

    // Oblicz daty okresu
    const checkIns = reservations.map((r) => new Date(r.checkIn).getTime());
    const checkOuts = reservations.map((r) => new Date(r.checkOut).getTime());
    const periodFrom = new Date(Math.min(...checkIns));
    const periodTo = new Date(Math.max(...checkOuts));

    // Oblicz kwoty
    let totalGross = 0;
    const items = reservations.map((r) => {
      const checkIn = new Date(r.checkIn);
      const checkOut = new Date(r.checkOut);
      const nights = Math.ceil(
        (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24)
      );
      const amountGross = 0; // TODO: Reservation nie ma totalAmount – obliczyć z Transaction/Folio gdy potrzebne
      const amountNet = amountGross / (1 + vatRate / 100);
      const amountVat = amountGross - amountNet;

      totalGross += amountGross;

      return {
        reservationId: r.id,
        guestName: r.guest.name,
        roomNumber: r.room.number,
        checkIn: r.checkIn,
        checkOut: r.checkOut,
        nights,
        amountNet,
        amountVat,
        amountGross,
        description: `Nocleg ${nights} dób, pokój ${r.room.number}`,
      };
    });

    const totalNet = totalGross / (1 + vatRate / 100);
    const totalVat = totalGross - totalNet;

    // Wygeneruj numer faktury
    const invoiceNumber = await generateConsolidatedInvoiceNumber();

    // Oblicz termin płatności
    const termDays = paymentTermDays ?? company.paymentTermDays ?? 14;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + termDays);

    // Utwórz fakturę w transakcji
    const invoice = await prisma.$transaction(async (tx) => {
      const inv = await tx.consolidatedInvoice.create({
        data: {
          number: invoiceNumber,
          companyId,
          amountNet: totalNet,
          amountVat: totalVat,
          amountGross: totalGross,
          vatRate,
          buyerNip: company.nip,
          buyerName: company.name,
          buyerAddress: company.address,
          buyerPostalCode: company.postalCode,
          buyerCity: company.city,
          periodFrom,
          periodTo,
          dueDate,
          paymentTermDays: termDays,
          notes: notes ?? null,
          items: {
            create: items,
          },
        },
      });
      return inv;
    });

    return {
      success: true,
      data: { invoiceId: invoice.id, invoiceNumber: invoice.number },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd tworzenia faktury zbiorczej",
    };
  }
}

/**
 * Pobiera listę faktur zbiorczych firmy.
 */
export async function getCompanyConsolidatedInvoices(
  companyId: string
): Promise<ActionResult<ConsolidatedInvoiceForList[]>> {
  try {
    const invoices = await prisma.consolidatedInvoice.findMany({
      where: { companyId },
      include: {
        company: { select: { name: true, nip: true } },
        _count: { select: { items: true } },
      },
      orderBy: { issuedAt: "desc" },
    });

    return {
      success: true,
      data: invoices.map((inv) => ({
        id: inv.id,
        number: inv.number,
        companyName: inv.company.name,
        companyNip: inv.company.nip,
        periodFrom: inv.periodFrom,
        periodTo: inv.periodTo,
        amountGross: inv.amountGross.toNumber(),
        itemsCount: inv._count.items,
        status: inv.status,
        dueDate: inv.dueDate,
        issuedAt: inv.issuedAt,
      })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania faktur",
    };
  }
}

/**
 * Pobiera szczegóły faktury zbiorczej.
 */
export async function getConsolidatedInvoiceById(
  invoiceId: string
): Promise<ActionResult<ConsolidatedInvoiceDetails>> {
  try {
    const invoice = await prisma.consolidatedInvoice.findUnique({
      where: { id: invoiceId },
      include: {
        company: { select: { name: true, nip: true } },
        items: {
          orderBy: { checkIn: "asc" },
        },
      },
    });

    if (!invoice) {
      return { success: false, error: "Faktura nie istnieje" };
    }

    return {
      success: true,
      data: {
        id: invoice.id,
        number: invoice.number,
        companyId: invoice.companyId,
        companyName: invoice.company.name,
        companyNip: invoice.company.nip,
        periodFrom: invoice.periodFrom,
        periodTo: invoice.periodTo,
        amountNet: invoice.amountNet.toNumber(),
        amountVat: invoice.amountVat.toNumber(),
        amountGross: invoice.amountGross.toNumber(),
        vatRate: invoice.vatRate.toNumber(),
        buyerName: invoice.buyerName,
        buyerNip: invoice.buyerNip,
        buyerAddress: invoice.buyerAddress,
        buyerPostalCode: invoice.buyerPostalCode,
        buyerCity: invoice.buyerCity,
        paymentTermDays: invoice.paymentTermDays,
        dueDate: invoice.dueDate,
        status: invoice.status,
        paidAt: invoice.paidAt,
        notes: invoice.notes,
        issuedAt: invoice.issuedAt,
        createdAt: invoice.createdAt,
        itemsCount: invoice.items.length,
        items: invoice.items.map((item) => ({
          id: item.id,
          reservationId: item.reservationId,
          guestName: item.guestName,
          roomNumber: item.roomNumber,
          checkIn: item.checkIn,
          checkOut: item.checkOut,
          nights: item.nights,
          amountNet: item.amountNet.toNumber(),
          amountVat: item.amountVat.toNumber(),
          amountGross: item.amountGross.toNumber(),
          description: item.description,
        })),
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania faktury",
    };
  }
}

/**
 * Zmienia status faktury zbiorczej (np. oznacza jako opłaconą).
 */
export async function updateConsolidatedInvoiceStatus(
  invoiceId: string,
  status: "ISSUED" | "PAID" | "OVERDUE" | "CANCELLED"
): Promise<ActionResult<void>> {
  try {
    const invoice = await prisma.consolidatedInvoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      return { success: false, error: "Faktura nie istnieje" };
    }

    await prisma.consolidatedInvoice.update({
      where: { id: invoiceId },
      data: {
        status,
        paidAt: status === "PAID" ? new Date() : null,
      },
    });

    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd aktualizacji statusu",
    };
  }
}
