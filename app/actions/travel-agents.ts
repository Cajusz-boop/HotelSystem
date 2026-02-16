"use server";

import { prisma } from "@/lib/db";

// ===== TYPY =====

export interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface TravelAgentForList {
  id: string;
  code: string;
  name: string;
  nip: string | null;
  city: string | null;
  contactPerson: string | null;
  contactEmail: string | null;
  commissionPercent: number;
  commissionType: string;
  paymentTermDays: number;
  creditLimit: number | null;
  useNetRates: boolean;
  discountPercent: number | null;
  isActive: boolean;
  rateCode: { id: string; code: string; name: string } | null;
  reservationCount: number;
  createdAt: Date;
}

export interface TravelAgentDetails extends TravelAgentForList {
  address: string | null;
  postalCode: string | null;
  country: string;
  contactPhone: string | null;
  website: string | null;
  iataNumber: string | null;
  licenseNumber: string | null;
  notes: string | null;
  rateCodeId: string | null;
  updatedAt: Date;
  reservations: Array<{
    id: string;
    confirmationNumber: string | null;
    guestName: string;
    roomNumber: string;
    checkIn: Date;
    checkOut: Date;
    status: string;
    totalAmount: number;
    agentCommission: number | null;
  }>;
}

// ===== LISTA I WYSZUKIWANIE =====

/**
 * Pobiera listę biur podróży / agentów.
 */
export async function getAllTravelAgents(options?: {
  query?: string;
  limit?: number;
  offset?: number;
  sortBy?: "name" | "code" | "city" | "commissionPercent" | "reservationCount" | "createdAt";
  sortOrder?: "asc" | "desc";
  activeOnly?: boolean;
}): Promise<ActionResult<{ agents: TravelAgentForList[]; total: number }>> {
  try {
    const {
      query = "",
      limit = 50,
      offset = 0,
      sortBy = "name",
      sortOrder = "asc",
      activeOnly = false,
    } = options ?? {};

    const searchQuery = query.trim();
    const where = {
      ...(activeOnly ? { isActive: true } : {}),
      ...(searchQuery
        ? {
            OR: [
              { code: { contains: searchQuery } },
              { name: { contains: searchQuery } },
              { city: { contains: searchQuery } },
              { iataNumber: { contains: searchQuery } },
            ],
          }
        : {}),
    };

    const total = await prisma.travelAgent.count({ where });

    const agents = await prisma.travelAgent.findMany({
      where,
      include: {
        rateCode: { select: { id: true, code: true, name: true } },
        _count: { select: { reservations: true } },
      },
      orderBy:
        sortBy === "reservationCount"
          ? { reservations: { _count: sortOrder } }
          : { [sortBy]: sortOrder },
      take: limit,
      skip: offset,
    });

    const result: TravelAgentForList[] = agents.map((a) => ({
      id: a.id,
      code: a.code,
      name: a.name,
      nip: a.nip,
      city: a.city,
      contactPerson: a.contactPerson,
      contactEmail: a.contactEmail,
      commissionPercent: a.commissionPercent.toNumber(),
      commissionType: a.commissionType,
      paymentTermDays: a.paymentTermDays,
      creditLimit: a.creditLimit?.toNumber() ?? null,
      useNetRates: a.useNetRates,
      discountPercent: a.discountPercent?.toNumber() ?? null,
      isActive: a.isActive,
      rateCode: a.rateCode,
      reservationCount: a._count.reservations,
      createdAt: a.createdAt,
    }));

    return { success: true, data: { agents: result, total } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania agentów",
    };
  }
}

/**
 * Pobiera szczegóły agenta wraz z rezerwacjami.
 */
export async function getTravelAgentById(
  agentId: string
): Promise<ActionResult<TravelAgentDetails>> {
  try {
    const agent = await prisma.travelAgent.findUnique({
      where: { id: agentId },
      include: {
        rateCode: { select: { id: true, code: true, name: true } },
        reservations: {
          include: {
            guest: { select: { name: true } },
            room: { select: { number: true } },
          },
          orderBy: { checkIn: "desc" },
          take: 100,
        },
        _count: { select: { reservations: true } },
      },
    });

    if (!agent) {
      return { success: false, error: "Agent nie istnieje" };
    }

    return {
      success: true,
      data: {
        id: agent.id,
        code: agent.code,
        name: agent.name,
        nip: agent.nip,
        address: agent.address,
        postalCode: agent.postalCode,
        city: agent.city,
        country: agent.country,
        contactPerson: agent.contactPerson,
        contactEmail: agent.contactEmail,
        contactPhone: agent.contactPhone,
        website: agent.website,
        commissionPercent: agent.commissionPercent.toNumber(),
        commissionType: agent.commissionType,
        paymentTermDays: agent.paymentTermDays,
        creditLimit: agent.creditLimit?.toNumber() ?? null,
        rateCodeId: agent.rateCodeId,
        rateCode: agent.rateCode,
        useNetRates: agent.useNetRates,
        discountPercent: agent.discountPercent?.toNumber() ?? null,
        iataNumber: agent.iataNumber,
        licenseNumber: agent.licenseNumber,
        notes: agent.notes,
        isActive: agent.isActive,
        reservationCount: agent._count.reservations,
        createdAt: agent.createdAt,
        updatedAt: agent.updatedAt,
        reservations: agent.reservations.map((r) => ({
          id: r.id,
          confirmationNumber: r.confirmationNumber,
          guestName: r.guest.name,
          roomNumber: r.room.number,
          checkIn: r.checkIn,
          checkOut: r.checkOut,
          status: r.status,
          totalAmount: 0, // Reservation nie ma totalAmount – można obliczyć z transakcji
          agentCommission: r.agentCommission?.toNumber() ?? null,
        })),
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania agenta",
    };
  }
}

// ===== TWORZENIE I AKTUALIZACJA =====

/**
 * Tworzy nowego agenta / biuro podróży.
 */
export async function createTravelAgent(data: {
  code: string;
  name: string;
  nip?: string | null;
  address?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string;
  contactPerson?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  website?: string | null;
  commissionPercent?: number;
  commissionType?: "NET" | "GROSS";
  paymentTermDays?: number;
  creditLimit?: number | null;
  rateCodeId?: string | null;
  useNetRates?: boolean;
  discountPercent?: number | null;
  iataNumber?: string | null;
  licenseNumber?: string | null;
  notes?: string | null;
  isActive?: boolean;
}): Promise<ActionResult<{ agentId: string }>> {
  try {
    // Walidacja
    const code = data.code.trim().toUpperCase();
    if (!code) {
      return { success: false, error: "Kod agenta jest wymagany" };
    }
    if (!data.name?.trim()) {
      return { success: false, error: "Nazwa agenta jest wymagana" };
    }

    // Sprawdź unikalność kodu
    const existing = await prisma.travelAgent.findUnique({
      where: { code },
    });
    if (existing) {
      return { success: false, error: `Agent o kodzie ${code} już istnieje` };
    }

    // Walidacja prowizji
    const commission = data.commissionPercent ?? 10;
    if (commission < 0 || commission > 100) {
      return { success: false, error: "Prowizja musi być między 0% a 100%" };
    }

    // Walidacja rabatu
    if (data.discountPercent !== undefined && data.discountPercent !== null) {
      if (data.discountPercent < 0 || data.discountPercent > 100) {
        return { success: false, error: "Rabat musi być między 0% a 100%" };
      }
    }

    const agent = await prisma.travelAgent.create({
      data: {
        code,
        name: data.name.trim(),
        nip: data.nip?.trim() || null,
        address: data.address?.trim() || null,
        postalCode: data.postalCode?.trim() || null,
        city: data.city?.trim() || null,
        country: data.country?.trim() || "POL",
        contactPerson: data.contactPerson?.trim() || null,
        contactEmail: data.contactEmail?.trim() || null,
        contactPhone: data.contactPhone?.trim() || null,
        website: data.website?.trim() || null,
        commissionPercent: commission,
        commissionType: data.commissionType || "NET",
        paymentTermDays: data.paymentTermDays ?? 14,
        creditLimit: data.creditLimit ?? null,
        rateCodeId: data.rateCodeId || null,
        useNetRates: data.useNetRates ?? true,
        discountPercent: data.discountPercent ?? null,
        iataNumber: data.iataNumber?.trim() || null,
        licenseNumber: data.licenseNumber?.trim() || null,
        notes: data.notes?.trim() || null,
        isActive: data.isActive ?? true,
      },
    });

    return { success: true, data: { agentId: agent.id } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd tworzenia agenta",
    };
  }
}

/**
 * Aktualizuje dane agenta.
 */
export async function updateTravelAgent(
  agentId: string,
  data: {
    code?: string;
    name?: string;
    nip?: string | null;
    address?: string | null;
    postalCode?: string | null;
    city?: string | null;
    country?: string;
    contactPerson?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    website?: string | null;
    commissionPercent?: number;
    commissionType?: "NET" | "GROSS";
    paymentTermDays?: number;
    creditLimit?: number | null;
    rateCodeId?: string | null;
    useNetRates?: boolean;
    discountPercent?: number | null;
    iataNumber?: string | null;
    licenseNumber?: string | null;
    notes?: string | null;
    isActive?: boolean;
  }
): Promise<ActionResult<{ agentId: string }>> {
  try {
    const agent = await prisma.travelAgent.findUnique({
      where: { id: agentId },
    });
    if (!agent) {
      return { success: false, error: "Agent nie istnieje" };
    }

    // Walidacja kodu (jeśli zmieniany)
    if (data.code !== undefined) {
      const newCode = data.code.trim().toUpperCase();
      if (!newCode) {
        return { success: false, error: "Kod agenta jest wymagany" };
      }
      if (newCode !== agent.code) {
        const existing = await prisma.travelAgent.findUnique({
          where: { code: newCode },
        });
        if (existing) {
          return { success: false, error: `Agent o kodzie ${newCode} już istnieje` };
        }
      }
    }

    // Walidacja prowizji
    if (data.commissionPercent !== undefined) {
      if (data.commissionPercent < 0 || data.commissionPercent > 100) {
        return { success: false, error: "Prowizja musi być między 0% a 100%" };
      }
    }

    // Walidacja rabatu
    if (data.discountPercent !== undefined && data.discountPercent !== null) {
      if (data.discountPercent < 0 || data.discountPercent > 100) {
        return { success: false, error: "Rabat musi być między 0% a 100%" };
      }
    }

    await prisma.travelAgent.update({
      where: { id: agentId },
      data: {
        code: data.code !== undefined ? data.code.trim().toUpperCase() : undefined,
        name: data.name !== undefined ? data.name.trim() : undefined,
        nip: data.nip !== undefined ? data.nip?.trim() || null : undefined,
        address: data.address !== undefined ? data.address?.trim() || null : undefined,
        postalCode: data.postalCode !== undefined ? data.postalCode?.trim() || null : undefined,
        city: data.city !== undefined ? data.city?.trim() || null : undefined,
        country: data.country !== undefined ? data.country.trim() : undefined,
        contactPerson: data.contactPerson !== undefined ? data.contactPerson?.trim() || null : undefined,
        contactEmail: data.contactEmail !== undefined ? data.contactEmail?.trim() || null : undefined,
        contactPhone: data.contactPhone !== undefined ? data.contactPhone?.trim() || null : undefined,
        website: data.website !== undefined ? data.website?.trim() || null : undefined,
        commissionPercent: data.commissionPercent !== undefined ? data.commissionPercent : undefined,
        commissionType: data.commissionType !== undefined ? data.commissionType : undefined,
        paymentTermDays: data.paymentTermDays !== undefined ? data.paymentTermDays : undefined,
        creditLimit: data.creditLimit !== undefined ? data.creditLimit : undefined,
        rateCodeId: data.rateCodeId !== undefined ? data.rateCodeId || null : undefined,
        useNetRates: data.useNetRates !== undefined ? data.useNetRates : undefined,
        discountPercent: data.discountPercent !== undefined ? data.discountPercent : undefined,
        iataNumber: data.iataNumber !== undefined ? data.iataNumber?.trim() || null : undefined,
        licenseNumber: data.licenseNumber !== undefined ? data.licenseNumber?.trim() || null : undefined,
        notes: data.notes !== undefined ? data.notes?.trim() || null : undefined,
        isActive: data.isActive !== undefined ? data.isActive : undefined,
      },
    });

    return { success: true, data: { agentId } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd aktualizacji agenta",
    };
  }
}

/**
 * Usuwa agenta (tylko jeśli nie ma powiązanych rezerwacji).
 */
export async function deleteTravelAgent(
  agentId: string
): Promise<ActionResult<void>> {
  try {
    const agent = await prisma.travelAgent.findUnique({
      where: { id: agentId },
      include: { _count: { select: { reservations: true } } },
    });

    if (!agent) {
      return { success: false, error: "Agent nie istnieje" };
    }

    if (agent._count.reservations > 0) {
      return {
        success: false,
        error: `Nie można usunąć agenta z ${agent._count.reservations} rezerwacjami. Dezaktywuj go zamiast tego.`,
      };
    }

    await prisma.travelAgent.delete({ where: { id: agentId } });

    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd usuwania agenta",
    };
  }
}

// ===== WYSZUKIWANIE =====

/**
 * Wyszukuje agentów do autocomplete.
 */
export async function searchTravelAgents(
  query: string,
  limit: number = 10
): Promise<ActionResult<Array<{ id: string; code: string; name: string; commissionPercent: number }>>> {
  try {
    const searchQuery = query.trim();
    if (!searchQuery) {
      return { success: true, data: [] };
    }

    const agents = await prisma.travelAgent.findMany({
      where: {
        isActive: true,
        OR: [
          { code: { contains: searchQuery } },
          { name: { contains: searchQuery } },
          { iataNumber: { contains: searchQuery } },
        ],
      },
      select: {
        id: true,
        code: true,
        name: true,
        commissionPercent: true,
      },
      take: limit,
      orderBy: { name: "asc" },
    });

    return {
      success: true,
      data: agents.map((a) => ({
        id: a.id,
        code: a.code,
        name: a.name,
        commissionPercent: a.commissionPercent.toNumber(),
      })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd wyszukiwania agentów",
    };
  }
}

// ===== STATYSTYKI =====

/**
 * Pobiera statystyki agentów.
 */
export async function getTravelAgentStats(): Promise<
  ActionResult<{
    totalAgents: number;
    activeAgents: number;
    agentsWithReservations: number;
    topAgentsByReservations: Array<{
      id: string;
      code: string;
      name: string;
      reservationCount: number;
      totalCommission: number;
    }>;
    recentlyAdded: Array<{
      id: string;
      code: string;
      name: string;
      createdAt: Date;
    }>;
  }>
> {
  try {
    const [totalAgents, activeAgents, topAgents, recentlyAdded] =
      await Promise.all([
        prisma.travelAgent.count(),
        prisma.travelAgent.count({ where: { isActive: true } }),
        prisma.travelAgent.findMany({
          include: {
            _count: { select: { reservations: true } },
            reservations: {
              select: { agentCommission: true },
            },
          },
          orderBy: { reservations: { _count: "desc" } },
          take: 5,
        }),
        prisma.travelAgent.findMany({
          select: { id: true, code: true, name: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
      ]);

    // Zlicz agentów z rezerwacjami
    const agentsWithReservations = topAgents.filter(
      (a) => a._count.reservations > 0
    ).length;

    return {
      success: true,
      data: {
        totalAgents,
        activeAgents,
        agentsWithReservations,
        topAgentsByReservations: topAgents.map((a) => ({
          id: a.id,
          code: a.code,
          name: a.name,
          reservationCount: a._count.reservations,
          totalCommission: a.reservations.reduce(
            (sum, r) => sum + (r.agentCommission?.toNumber() ?? 0),
            0
          ),
        })),
        recentlyAdded,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania statystyk",
    };
  }
}

// ===== ROZRACHUNKI =====

export interface TravelAgentBalance {
  totalReservations: number;
  totalRevenue: number;
  totalCommission: number;
  totalPaid: number;
  outstandingCommission: number;
  creditLimit: number | null;
  creditUsed: number;
  creditAvailable: number | null;
  isOverLimit: boolean;
  byStatus: {
    confirmed: { count: number; revenue: number; commission: number };
    checkedIn: { count: number; revenue: number; commission: number };
    checkedOut: { count: number; revenue: number; commission: number };
    cancelled: { count: number; revenue: number; commission: number };
  };
}

/**
 * Pobiera rozrachunki (saldo prowizji) dla agenta.
 */
export async function getTravelAgentBalance(
  agentId: string
): Promise<ActionResult<TravelAgentBalance>> {
  try {
    const agent = await prisma.travelAgent.findUnique({
      where: { id: agentId },
      include: {
        reservations: {
          select: {
            id: true,
            status: true,
            agentCommission: true,
          },
        },
      },
    });

    if (!agent) {
      return { success: false, error: "Agent nie istnieje" };
    }

    const byStatus = {
      confirmed: { count: 0, revenue: 0, commission: 0 },
      checkedIn: { count: 0, revenue: 0, commission: 0 },
      checkedOut: { count: 0, revenue: 0, commission: 0 },
      cancelled: { count: 0, revenue: 0, commission: 0 },
    };

    let totalRevenue = 0;
    let totalCommission = 0;

    for (const res of agent.reservations) {
      const amount = 0; // Reservation nie ma totalAmount – można obliczyć z transakcji
      // Oblicz prowizję: jeśli jest podana na rezerwacji, użyj jej; w przeciwnym razie oblicz wg domyślnej stawki
      const commission =
        res.agentCommission?.toNumber() ??
        (amount * agent.commissionPercent.toNumber()) / 100;

      totalRevenue += amount;
      totalCommission += commission;

      switch (res.status) {
        case "CONFIRMED":
          byStatus.confirmed.count++;
          byStatus.confirmed.revenue += amount;
          byStatus.confirmed.commission += commission;
          break;
        case "CHECKED_IN":
          byStatus.checkedIn.count++;
          byStatus.checkedIn.revenue += amount;
          byStatus.checkedIn.commission += commission;
          break;
        case "CHECKED_OUT":
          byStatus.checkedOut.count++;
          byStatus.checkedOut.revenue += amount;
          byStatus.checkedOut.commission += commission;
          break;
        case "CANCELLED":
        case "NO_SHOW":
          byStatus.cancelled.count++;
          byStatus.cancelled.revenue += amount;
          byStatus.cancelled.commission += commission;
          break;
      }
    }

    // Dla uproszczenia zakładamy, że prowizje za zakończone pobyty są należne
    // W pełnej implementacji trzeba by śledzić wypłaty prowizji
    const outstandingCommission = byStatus.checkedOut.commission;
    const creditLimit = agent.creditLimit?.toNumber() ?? null;
    const creditUsed = outstandingCommission;
    const creditAvailable =
      creditLimit !== null ? creditLimit - creditUsed : null;
    const isOverLimit = creditLimit !== null && creditUsed > creditLimit;

    return {
      success: true,
      data: {
        totalReservations: agent.reservations.length,
        totalRevenue,
        totalCommission,
        totalPaid: 0, // TODO: dodać śledzenie wypłat
        outstandingCommission,
        creditLimit,
        creditUsed,
        creditAvailable,
        isOverLimit,
        byStatus,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania rozrachunków",
    };
  }
}
