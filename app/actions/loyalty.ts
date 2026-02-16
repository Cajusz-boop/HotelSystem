"use server";

import { prisma } from "@/lib/db";
import { createAuditLog, getClientIp } from "@/lib/audit";
import { headers } from "next/headers";
import { Prisma } from "@prisma/client";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

// ---------------------------------------------------------------------------
// Typy pomocnicze
// ---------------------------------------------------------------------------

export interface LoyaltyProgramData {
  id: string;
  name: string;
  isActive: boolean;
  pointsPerPln: number;
  pointsForCheckIn: number;
  pointsForBirthday: number;
  tierCalculationMode: string;
  cardNumberPrefix: string;
  termsUrl: string | null;
  welcomeMessage: string | null;
}

export interface LoyaltyTierData {
  id: string;
  name: string;
  code: string;
  sortOrder: number;
  minPoints: number;
  minStays: number;
  color: string | null;
  icon: string | null;
  discountPercent: number | null;
  bonusPointsPercent: number | null;
  earlyCheckIn: boolean;
  lateCheckOut: boolean;
  roomUpgrade: boolean;
  welcomeDrink: boolean;
  freeBreakfast: boolean;
  prioritySupport: boolean;
  loungeAccess: boolean;
  freeParking: boolean;
  customBenefits: Array<{ name: string; description: string }> | null;
  isDefault: boolean;
}

export interface GuestLoyaltyStatus {
  isEnrolled: boolean;
  cardNumber: string | null;
  points: number;
  totalPoints: number;
  totalStays: number;
  tier: LoyaltyTierData | null;
  enrolledAt: string | null;
  nextTier: LoyaltyTierData | null;
  pointsToNextTier: number | null;
}

export interface LoyaltyTransactionData {
  id: string;
  type: string;
  points: number;
  balanceAfter: number;
  reason: string | null;
  referenceType: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Pobieranie konfiguracji programu
// ---------------------------------------------------------------------------

/**
 * Pobiera konfigurację programu lojalnościowego.
 * Jeśli nie istnieje, tworzy domyślną konfigurację.
 */
export async function getLoyaltyProgram(): Promise<ActionResult<LoyaltyProgramData>> {
  try {
    let program = await prisma.loyaltyProgram.findUnique({
      where: { id: "default" },
    });

    // Jeśli nie istnieje, utwórz domyślną konfigurację
    if (!program) {
      program = await prisma.loyaltyProgram.create({
        data: {
          id: "default",
          name: "Program Lojalnościowy",
          isActive: true,
          pointsPerPln: new Prisma.Decimal(1),
          pointsForCheckIn: 100,
          pointsForBirthday: 500,
          tierCalculationMode: "POINTS",
          cardNumberPrefix: "LOY",
          cardNumberNextSeq: 1,
        },
      });

      // Utwórz domyślne tiery
      await createDefaultTiers();
    }

    return {
      success: true,
      data: {
        id: program.id,
        name: program.name,
        isActive: program.isActive,
        pointsPerPln: Number(program.pointsPerPln),
        pointsForCheckIn: program.pointsForCheckIn,
        pointsForBirthday: program.pointsForBirthday,
        tierCalculationMode: program.tierCalculationMode,
        cardNumberPrefix: program.cardNumberPrefix,
        termsUrl: program.termsUrl,
        welcomeMessage: program.welcomeMessage,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania konfiguracji programu",
    };
  }
}

/**
 * Aktualizuje konfigurację programu lojalnościowego.
 */
export async function updateLoyaltyProgram(
  data: Partial<{
    name: string;
    isActive: boolean;
    pointsPerPln: number;
    pointsForCheckIn: number;
    pointsForBirthday: number;
    tierCalculationMode: string;
    cardNumberPrefix: string;
    termsUrl: string | null;
    welcomeMessage: string | null;
  }>
): Promise<ActionResult<void>> {
  try {
    const headersList = await headers();
    const ip = getClientIp(headersList);

    const existing = await prisma.loyaltyProgram.findUnique({
      where: { id: "default" },
    });

    await prisma.loyaltyProgram.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        name: data.name ?? "Program Lojalnościowy",
        isActive: data.isActive ?? true,
        pointsPerPln: data.pointsPerPln !== undefined ? new Prisma.Decimal(data.pointsPerPln) : new Prisma.Decimal(1),
        pointsForCheckIn: data.pointsForCheckIn ?? 100,
        pointsForBirthday: data.pointsForBirthday ?? 500,
        tierCalculationMode: data.tierCalculationMode ?? "POINTS",
        cardNumberPrefix: data.cardNumberPrefix ?? "LOY",
        termsUrl: data.termsUrl ?? null,
        welcomeMessage: data.welcomeMessage ?? null,
      },
      update: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.pointsPerPln !== undefined && { pointsPerPln: new Prisma.Decimal(data.pointsPerPln) }),
        ...(data.pointsForCheckIn !== undefined && { pointsForCheckIn: data.pointsForCheckIn }),
        ...(data.pointsForBirthday !== undefined && { pointsForBirthday: data.pointsForBirthday }),
        ...(data.tierCalculationMode !== undefined && { tierCalculationMode: data.tierCalculationMode }),
        ...(data.cardNumberPrefix !== undefined && { cardNumberPrefix: data.cardNumberPrefix }),
        ...(data.termsUrl !== undefined && { termsUrl: data.termsUrl }),
        ...(data.welcomeMessage !== undefined && { welcomeMessage: data.welcomeMessage }),
      },
    });

    await createAuditLog({
      actionType: existing ? "UPDATE" : "CREATE",
      entityType: "LoyaltyProgram",
      entityId: "default",
      oldValue: existing ?? null,
      newValue: data,
      ipAddress: ip,
    });

    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd aktualizacji programu",
    };
  }
}

// ---------------------------------------------------------------------------
// Tiery (poziomy)
// ---------------------------------------------------------------------------

/**
 * Tworzy domyślne tiery programu lojalnościowego.
 */
async function createDefaultTiers(): Promise<void> {
  const tiers = [
    {
      name: "Bronze",
      code: "BRONZE",
      sortOrder: 0,
      minPoints: 0,
      minStays: 0,
      color: "#CD7F32",
      icon: "🥉",
      isDefault: true,
      discountPercent: new Prisma.Decimal(0),
      bonusPointsPercent: new Prisma.Decimal(0),
    },
    {
      name: "Silver",
      code: "SILVER",
      sortOrder: 1,
      minPoints: 5000,
      minStays: 5,
      color: "#C0C0C0",
      icon: "🥈",
      discountPercent: new Prisma.Decimal(5),
      bonusPointsPercent: new Prisma.Decimal(10),
      earlyCheckIn: true,
    },
    {
      name: "Gold",
      code: "GOLD",
      sortOrder: 2,
      minPoints: 15000,
      minStays: 15,
      color: "#FFD700",
      icon: "🥇",
      discountPercent: new Prisma.Decimal(10),
      bonusPointsPercent: new Prisma.Decimal(25),
      earlyCheckIn: true,
      lateCheckOut: true,
      roomUpgrade: true,
      welcomeDrink: true,
    },
    {
      name: "Platinum",
      code: "PLATINUM",
      sortOrder: 3,
      minPoints: 50000,
      minStays: 50,
      color: "#E5E4E2",
      icon: "💎",
      discountPercent: new Prisma.Decimal(15),
      bonusPointsPercent: new Prisma.Decimal(50),
      earlyCheckIn: true,
      lateCheckOut: true,
      roomUpgrade: true,
      welcomeDrink: true,
      freeBreakfast: true,
      prioritySupport: true,
      loungeAccess: true,
      freeParking: true,
    },
  ];

  for (const tier of tiers) {
    await prisma.loyaltyTier.upsert({
      where: { code: tier.code },
      create: tier,
      update: {},
    });
  }
}

/**
 * Pobiera wszystkie tiery programu lojalnościowego posortowane wg kolejności.
 */
export async function getLoyaltyTiers(): Promise<ActionResult<LoyaltyTierData[]>> {
  try {
    // Upewnij się, że program istnieje (utworzy domyślne tiery jeśli nie ma)
    await getLoyaltyProgram();

    const tiers = await prisma.loyaltyTier.findMany({
      orderBy: { sortOrder: "asc" },
    });

    return {
      success: true,
      data: tiers.map((t) => ({
        id: t.id,
        name: t.name,
        code: t.code,
        sortOrder: t.sortOrder,
        minPoints: t.minPoints,
        minStays: t.minStays,
        color: t.color,
        icon: t.icon,
        discountPercent: t.discountPercent ? Number(t.discountPercent) : null,
        bonusPointsPercent: t.bonusPointsPercent ? Number(t.bonusPointsPercent) : null,
        earlyCheckIn: t.earlyCheckIn,
        lateCheckOut: t.lateCheckOut,
        roomUpgrade: t.roomUpgrade,
        welcomeDrink: t.welcomeDrink,
        freeBreakfast: t.freeBreakfast,
        prioritySupport: t.prioritySupport,
        loungeAccess: t.loungeAccess,
        freeParking: t.freeParking,
        customBenefits: t.customBenefits as Array<{ name: string; description: string }> | null,
        isDefault: t.isDefault,
      })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania tierów",
    };
  }
}

/**
 * Aktualizuje tier programu lojalnościowego.
 */
export async function updateLoyaltyTier(
  tierId: string,
  data: Partial<{
    name: string;
    minPoints: number;
    minStays: number;
    color: string | null;
    icon: string | null;
    discountPercent: number | null;
    bonusPointsPercent: number | null;
    earlyCheckIn: boolean;
    lateCheckOut: boolean;
    roomUpgrade: boolean;
    welcomeDrink: boolean;
    freeBreakfast: boolean;
    prioritySupport: boolean;
    loungeAccess: boolean;
    freeParking: boolean;
    customBenefits: Array<{ name: string; description: string }> | null;
  }>
): Promise<ActionResult<void>> {
  try {
    const headersList = await headers();
    const ip = getClientIp(headersList);

    const existing = await prisma.loyaltyTier.findUnique({
      where: { id: tierId },
    });

    if (!existing) {
      return { success: false, error: "Tier nie istnieje" };
    }

    await prisma.loyaltyTier.update({
      where: { id: tierId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.minPoints !== undefined && { minPoints: data.minPoints }),
        ...(data.minStays !== undefined && { minStays: data.minStays }),
        ...(data.color !== undefined && { color: data.color }),
        ...(data.icon !== undefined && { icon: data.icon }),
        ...(data.discountPercent !== undefined && { 
          discountPercent: data.discountPercent !== null ? new Prisma.Decimal(data.discountPercent) : null 
        }),
        ...(data.bonusPointsPercent !== undefined && { 
          bonusPointsPercent: data.bonusPointsPercent !== null ? new Prisma.Decimal(data.bonusPointsPercent) : null 
        }),
        ...(data.earlyCheckIn !== undefined && { earlyCheckIn: data.earlyCheckIn }),
        ...(data.lateCheckOut !== undefined && { lateCheckOut: data.lateCheckOut }),
        ...(data.roomUpgrade !== undefined && { roomUpgrade: data.roomUpgrade }),
        ...(data.welcomeDrink !== undefined && { welcomeDrink: data.welcomeDrink }),
        ...(data.freeBreakfast !== undefined && { freeBreakfast: data.freeBreakfast }),
        ...(data.prioritySupport !== undefined && { prioritySupport: data.prioritySupport }),
        ...(data.loungeAccess !== undefined && { loungeAccess: data.loungeAccess }),
        ...(data.freeParking !== undefined && { freeParking: data.freeParking }),
        ...(data.customBenefits !== undefined && { customBenefits: data.customBenefits as object ?? null }),
      },
    });

    await createAuditLog({
      actionType: "UPDATE",
      entityType: "LoyaltyTier",
      entityId: tierId,
      oldValue: existing,
      newValue: data,
      ipAddress: ip,
    });

    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd aktualizacji tieru",
    };
  }
}

// ---------------------------------------------------------------------------
// Status lojalnościowy gościa
// ---------------------------------------------------------------------------

/**
 * Generuje nowy numer karty lojalnościowej.
 */
async function generateLoyaltyCardNumber(): Promise<string> {
  const program = await prisma.loyaltyProgram.findUnique({
    where: { id: "default" },
  });

  const prefix = program?.cardNumberPrefix ?? "LOY";
  const seq = program?.cardNumberNextSeq ?? 1;

  // Aktualizuj sekwencję
  await prisma.loyaltyProgram.update({
    where: { id: "default" },
    data: { cardNumberNextSeq: seq + 1 },
  });

  // Format: LOY-000001
  return `${prefix}-${String(seq).padStart(6, "0")}`;
}

/**
 * Pobiera status lojalnościowy gościa.
 */
export async function getGuestLoyaltyStatus(
  guestId: string
): Promise<ActionResult<GuestLoyaltyStatus>> {
  try {
    const guest = await prisma.guest.findUnique({
      where: { id: guestId },
      include: {
        loyaltyTier: true,
      },
    });

    if (!guest) {
      return { success: false, error: "Gość nie istnieje" };
    }

    // Pobierz wszystkie tiery do obliczenia następnego
    const tiers = await prisma.loyaltyTier.findMany({
      orderBy: { sortOrder: "asc" },
    });

    // Znajdź następny tier
    let nextTier: typeof tiers[0] | null = null;
    let pointsToNextTier: number | null = null;

    if (guest.loyaltyCardNumber) {
      const currentTierOrder = guest.loyaltyTier?.sortOrder ?? -1;
      nextTier = tiers.find((t) => t.sortOrder > currentTierOrder) ?? null;

      if (nextTier) {
        pointsToNextTier = Math.max(0, nextTier.minPoints - guest.loyaltyTotalPoints);
      }
    }

    const tierData = guest.loyaltyTier
      ? {
          id: guest.loyaltyTier.id,
          name: guest.loyaltyTier.name,
          code: guest.loyaltyTier.code,
          sortOrder: guest.loyaltyTier.sortOrder,
          minPoints: guest.loyaltyTier.minPoints,
          minStays: guest.loyaltyTier.minStays,
          color: guest.loyaltyTier.color,
          icon: guest.loyaltyTier.icon,
          discountPercent: guest.loyaltyTier.discountPercent ? Number(guest.loyaltyTier.discountPercent) : null,
          bonusPointsPercent: guest.loyaltyTier.bonusPointsPercent ? Number(guest.loyaltyTier.bonusPointsPercent) : null,
          earlyCheckIn: guest.loyaltyTier.earlyCheckIn,
          lateCheckOut: guest.loyaltyTier.lateCheckOut,
          roomUpgrade: guest.loyaltyTier.roomUpgrade,
          welcomeDrink: guest.loyaltyTier.welcomeDrink,
          freeBreakfast: guest.loyaltyTier.freeBreakfast,
          prioritySupport: guest.loyaltyTier.prioritySupport,
          loungeAccess: guest.loyaltyTier.loungeAccess,
          freeParking: guest.loyaltyTier.freeParking,
          customBenefits: guest.loyaltyTier.customBenefits as Array<{ name: string; description: string }> | null,
          isDefault: guest.loyaltyTier.isDefault,
        }
      : null;

    const nextTierData = nextTier
      ? {
          id: nextTier.id,
          name: nextTier.name,
          code: nextTier.code,
          sortOrder: nextTier.sortOrder,
          minPoints: nextTier.minPoints,
          minStays: nextTier.minStays,
          color: nextTier.color,
          icon: nextTier.icon,
          discountPercent: nextTier.discountPercent ? Number(nextTier.discountPercent) : null,
          bonusPointsPercent: nextTier.bonusPointsPercent ? Number(nextTier.bonusPointsPercent) : null,
          earlyCheckIn: nextTier.earlyCheckIn,
          lateCheckOut: nextTier.lateCheckOut,
          roomUpgrade: nextTier.roomUpgrade,
          welcomeDrink: nextTier.welcomeDrink,
          freeBreakfast: nextTier.freeBreakfast,
          prioritySupport: nextTier.prioritySupport,
          loungeAccess: nextTier.loungeAccess,
          freeParking: nextTier.freeParking,
          customBenefits: nextTier.customBenefits as Array<{ name: string; description: string }> | null,
          isDefault: nextTier.isDefault,
        }
      : null;

    return {
      success: true,
      data: {
        isEnrolled: !!guest.loyaltyCardNumber,
        cardNumber: guest.loyaltyCardNumber,
        points: guest.loyaltyPoints,
        totalPoints: guest.loyaltyTotalPoints,
        totalStays: guest.loyaltyTotalStays,
        tier: tierData,
        enrolledAt: guest.loyaltyEnrolledAt?.toISOString() ?? null,
        nextTier: nextTierData,
        pointsToNextTier,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania statusu lojalnościowego",
    };
  }
}

/**
 * Zapisuje gościa do programu lojalnościowego.
 */
export async function enrollGuestInLoyalty(
  guestId: string
): Promise<ActionResult<{ cardNumber: string }>> {
  try {
    const headersList = await headers();
    const ip = getClientIp(headersList);

    const guest = await prisma.guest.findUnique({
      where: { id: guestId },
    });

    if (!guest) {
      return { success: false, error: "Gość nie istnieje" };
    }

    if (guest.loyaltyCardNumber) {
      return { success: false, error: "Gość jest już zapisany do programu lojalnościowego" };
    }

    // Upewnij się, że program istnieje
    await getLoyaltyProgram();

    // Pobierz domyślny tier
    const defaultTier = await prisma.loyaltyTier.findFirst({
      where: { isDefault: true },
    });

    // Wygeneruj numer karty
    const cardNumber = await generateLoyaltyCardNumber();

    // Zapisz gościa
    await prisma.guest.update({
      where: { id: guestId },
      data: {
        loyaltyCardNumber: cardNumber,
        loyaltyPoints: 0,
        loyaltyTotalPoints: 0,
        loyaltyTotalStays: 0,
        loyaltyTierId: defaultTier?.id ?? null,
        loyaltyEnrolledAt: new Date(),
      },
    });

    // Utwórz transakcję powitalną (bonus za zapisanie)
    const program = await prisma.loyaltyProgram.findUnique({
      where: { id: "default" },
    });

    if (program && program.pointsForCheckIn > 0) {
      await prisma.loyaltyTransaction.create({
        data: {
          guestId,
          type: "BONUS",
          points: program.pointsForCheckIn,
          balanceAfter: program.pointsForCheckIn,
          reason: "Bonus powitalny za dołączenie do programu",
          referenceType: "ENROLLMENT",
          createdBy: "SYSTEM",
        },
      });

      await prisma.guest.update({
        where: { id: guestId },
        data: {
          loyaltyPoints: program.pointsForCheckIn,
          loyaltyTotalPoints: program.pointsForCheckIn,
        },
      });
    }

    await createAuditLog({
      actionType: "CREATE",
      entityType: "LoyaltyEnrollment",
      entityId: guestId,
      newValue: { cardNumber, guestId },
      ipAddress: ip,
    });

    return { success: true, data: { cardNumber } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd zapisywania do programu lojalnościowego",
    };
  }
}

// ---------------------------------------------------------------------------
// Operacje na punktach
// ---------------------------------------------------------------------------

/**
 * Dodaje punkty gościowi.
 */
export async function addLoyaltyPoints(
  guestId: string,
  points: number,
  reason: string,
  options?: {
    reservationId?: string;
    referenceType?: string;
    referenceId?: string;
    createdBy?: string;
  }
): Promise<ActionResult<{ newBalance: number }>> {
  try {
    if (points <= 0) {
      return { success: false, error: "Liczba punktów musi być większa od 0" };
    }

    const headersList = await headers();
    const ip = getClientIp(headersList);

    const guest = await prisma.guest.findUnique({
      where: { id: guestId },
    });

    if (!guest) {
      return { success: false, error: "Gość nie istnieje" };
    }

    if (!guest.loyaltyCardNumber) {
      return { success: false, error: "Gość nie jest zapisany do programu lojalnościowego" };
    }

    // Pobierz konfigurację programu dla bonusu tier
    const _program = await prisma.loyaltyProgram.findUnique({
      where: { id: "default" },
    });

    // Oblicz bonus z tieru
    let bonusPoints = 0;
    if (guest.loyaltyTierId) {
      const tier = await prisma.loyaltyTier.findUnique({
        where: { id: guest.loyaltyTierId },
      });
      if (tier?.bonusPointsPercent) {
        bonusPoints = Math.floor(points * Number(tier.bonusPointsPercent) / 100);
      }
    }

    const totalPoints = points + bonusPoints;
    const newBalance = guest.loyaltyPoints + totalPoints;
    const newTotalPoints = guest.loyaltyTotalPoints + totalPoints;

    // Utwórz transakcję
    await prisma.loyaltyTransaction.create({
      data: {
        guestId,
        reservationId: options?.reservationId ?? null,
        type: "EARN",
        points: totalPoints,
        balanceAfter: newBalance,
        reason: bonusPoints > 0 ? `${reason} (w tym bonus tier: +${bonusPoints})` : reason,
        referenceType: options?.referenceType ?? null,
        referenceId: options?.referenceId ?? null,
        createdBy: options?.createdBy ?? "SYSTEM",
      },
    });

    // Aktualizuj saldo gościa
    await prisma.guest.update({
      where: { id: guestId },
      data: {
        loyaltyPoints: newBalance,
        loyaltyTotalPoints: newTotalPoints,
      },
    });

    // Przelicz tier
    await recalculateLoyaltyTier(guestId);

    await createAuditLog({
      actionType: "UPDATE",
      entityType: "LoyaltyPoints",
      entityId: guestId,
      oldValue: { points: guest.loyaltyPoints },
      newValue: { points: newBalance, added: totalPoints },
      ipAddress: ip,
    });

    return { success: true, data: { newBalance } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd dodawania punktów",
    };
  }
}

/**
 * Realizuje (wydaje) punkty gościa.
 */
export async function redeemLoyaltyPoints(
  guestId: string,
  points: number,
  reason: string,
  options?: {
    reservationId?: string;
    referenceType?: string;
    referenceId?: string;
    createdBy?: string;
  }
): Promise<ActionResult<{ newBalance: number }>> {
  try {
    if (points <= 0) {
      return { success: false, error: "Liczba punktów musi być większa od 0" };
    }

    const headersList = await headers();
    const ip = getClientIp(headersList);

    const guest = await prisma.guest.findUnique({
      where: { id: guestId },
    });

    if (!guest) {
      return { success: false, error: "Gość nie istnieje" };
    }

    if (!guest.loyaltyCardNumber) {
      return { success: false, error: "Gość nie jest zapisany do programu lojalnościowego" };
    }

    if (guest.loyaltyPoints < points) {
      return { 
        success: false, 
        error: `Niewystarczająca liczba punktów. Dostępne: ${guest.loyaltyPoints}, wymagane: ${points}` 
      };
    }

    const newBalance = guest.loyaltyPoints - points;

    // Utwórz transakcję
    await prisma.loyaltyTransaction.create({
      data: {
        guestId,
        reservationId: options?.reservationId ?? null,
        type: "REDEEM",
        points: -points,
        balanceAfter: newBalance,
        reason,
        referenceType: options?.referenceType ?? null,
        referenceId: options?.referenceId ?? null,
        createdBy: options?.createdBy ?? "SYSTEM",
      },
    });

    // Aktualizuj saldo gościa
    await prisma.guest.update({
      where: { id: guestId },
      data: {
        loyaltyPoints: newBalance,
      },
    });

    await createAuditLog({
      actionType: "UPDATE",
      entityType: "LoyaltyPoints",
      entityId: guestId,
      oldValue: { points: guest.loyaltyPoints },
      newValue: { points: newBalance, redeemed: points },
      ipAddress: ip,
    });

    return { success: true, data: { newBalance } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd realizacji punktów",
    };
  }
}

/**
 * Ręczna korekta punktów (dla managera).
 */
export async function adjustLoyaltyPoints(
  guestId: string,
  points: number,
  reason: string,
  createdBy?: string
): Promise<ActionResult<{ newBalance: number }>> {
  try {
    if (points === 0) {
      return { success: false, error: "Korekta musi być różna od 0" };
    }

    const headersList = await headers();
    const ip = getClientIp(headersList);

    const guest = await prisma.guest.findUnique({
      where: { id: guestId },
    });

    if (!guest) {
      return { success: false, error: "Gość nie istnieje" };
    }

    if (!guest.loyaltyCardNumber) {
      return { success: false, error: "Gość nie jest zapisany do programu lojalnościowego" };
    }

    const newBalance = guest.loyaltyPoints + points;

    if (newBalance < 0) {
      return { success: false, error: "Saldo punktów nie może być ujemne" };
    }

    // Aktualizuj też totalPoints jeśli dodajemy
    const newTotalPoints = points > 0 
      ? guest.loyaltyTotalPoints + points 
      : guest.loyaltyTotalPoints;

    // Utwórz transakcję
    await prisma.loyaltyTransaction.create({
      data: {
        guestId,
        type: "ADJUSTMENT",
        points,
        balanceAfter: newBalance,
        reason: `Korekta ręczna: ${reason}`,
        referenceType: "MANUAL",
        createdBy: createdBy ?? "MANAGER",
      },
    });

    // Aktualizuj saldo gościa
    await prisma.guest.update({
      where: { id: guestId },
      data: {
        loyaltyPoints: newBalance,
        loyaltyTotalPoints: newTotalPoints,
      },
    });

    // Przelicz tier jeśli dodaliśmy punkty
    if (points > 0) {
      await recalculateLoyaltyTier(guestId);
    }

    await createAuditLog({
      actionType: "UPDATE",
      entityType: "LoyaltyPointsAdjustment",
      entityId: guestId,
      oldValue: { points: guest.loyaltyPoints },
      newValue: { points: newBalance, adjustment: points, reason },
      ipAddress: ip,
    });

    return { success: true, data: { newBalance } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd korekty punktów",
    };
  }
}

// ---------------------------------------------------------------------------
// Przeliczanie tieru
// ---------------------------------------------------------------------------

/**
 * Przelicza tier gościa na podstawie punktów/pobytów.
 */
export async function recalculateLoyaltyTier(
  guestId: string
): Promise<ActionResult<{ tierId: string | null; tierName: string | null }>> {
  try {
    const guest = await prisma.guest.findUnique({
      where: { id: guestId },
    });

    if (!guest || !guest.loyaltyCardNumber) {
      return { success: true, data: { tierId: null, tierName: null } };
    }

    const program = await prisma.loyaltyProgram.findUnique({
      where: { id: "default" },
    });

    const tiers = await prisma.loyaltyTier.findMany({
      orderBy: { sortOrder: "desc" }, // Od najwyższego
    });

    let newTier: typeof tiers[0] | null = null;

    for (const tier of tiers) {
      const mode = program?.tierCalculationMode ?? "POINTS";
      let qualifies = false;

      if (mode === "POINTS") {
        qualifies = guest.loyaltyTotalPoints >= tier.minPoints;
      } else if (mode === "STAYS") {
        qualifies = guest.loyaltyTotalStays >= tier.minStays;
      } else {
        // COMBINED – musi spełnić oba warunki
        qualifies = 
          guest.loyaltyTotalPoints >= tier.minPoints && 
          guest.loyaltyTotalStays >= tier.minStays;
      }

      if (qualifies) {
        newTier = tier;
        break;
      }
    }

    // Jeśli nie kwalifikuje się do żadnego – użyj domyślnego
    if (!newTier) {
      newTier = tiers.find((t) => t.isDefault) ?? tiers[tiers.length - 1] ?? null;
    }

    if (newTier && newTier.id !== guest.loyaltyTierId) {
      await prisma.guest.update({
        where: { id: guestId },
        data: { loyaltyTierId: newTier.id },
      });
    }

    return {
      success: true,
      data: {
        tierId: newTier?.id ?? null,
        tierName: newTier?.name ?? null,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd przeliczania tieru",
    };
  }
}

/**
 * Inkrementuje liczbę pobytów gościa (wywoływane przy check-out).
 */
export async function incrementLoyaltyStays(guestId: string): Promise<ActionResult<void>> {
  try {
    const guest = await prisma.guest.findUnique({
      where: { id: guestId },
    });

    if (!guest || !guest.loyaltyCardNumber) {
      return { success: true, data: undefined };
    }

    await prisma.guest.update({
      where: { id: guestId },
      data: {
        loyaltyTotalStays: guest.loyaltyTotalStays + 1,
      },
    });

    // Przelicz tier
    await recalculateLoyaltyTier(guestId);

    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd aktualizacji liczby pobytów",
    };
  }
}

// ---------------------------------------------------------------------------
// Historia transakcji
// ---------------------------------------------------------------------------

/**
 * Pobiera historię transakcji punktowych gościa.
 */
export async function getLoyaltyTransactions(
  guestId: string,
  options?: {
    limit?: number;
    offset?: number;
  }
): Promise<ActionResult<{ transactions: LoyaltyTransactionData[]; total: number }>> {
  try {
    const guest = await prisma.guest.findUnique({
      where: { id: guestId },
      select: { loyaltyCardNumber: true },
    });

    if (!guest) {
      return { success: false, error: "Gość nie istnieje" };
    }

    if (!guest.loyaltyCardNumber) {
      return { success: true, data: { transactions: [], total: 0 } };
    }

    const [transactions, total] = await Promise.all([
      prisma.loyaltyTransaction.findMany({
        where: { guestId },
        orderBy: { createdAt: "desc" },
        take: options?.limit ?? 50,
        skip: options?.offset ?? 0,
      }),
      prisma.loyaltyTransaction.count({
        where: { guestId },
      }),
    ]);

    return {
      success: true,
      data: {
        transactions: transactions.map((t) => ({
          id: t.id,
          type: t.type,
          points: t.points,
          balanceAfter: t.balanceAfter,
          reason: t.reason,
          referenceType: t.referenceType,
          createdAt: t.createdAt.toISOString(),
        })),
        total,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania historii transakcji",
    };
  }
}

// ---------------------------------------------------------------------------
// Naliczanie punktów za rezerwację
// ---------------------------------------------------------------------------

/**
 * Nalicza punkty za rezerwację (wywoływane przy check-out).
 * Punkty = wartość transakcji * pointsPerPln
 */
export async function awardPointsForReservation(
  guestId: string,
  reservationId: string,
  totalAmount: number
): Promise<ActionResult<{ pointsAwarded: number }>> {
  try {
    const guest = await prisma.guest.findUnique({
      where: { id: guestId },
    });

    if (!guest || !guest.loyaltyCardNumber) {
      return { success: true, data: { pointsAwarded: 0 } };
    }

    const program = await prisma.loyaltyProgram.findUnique({
      where: { id: "default" },
    });

    if (!program || !program.isActive) {
      return { success: true, data: { pointsAwarded: 0 } };
    }

    // Oblicz punkty
    const basePoints = Math.floor(totalAmount * Number(program.pointsPerPln));

    if (basePoints <= 0) {
      return { success: true, data: { pointsAwarded: 0 } };
    }

    // Pobierz rezerwację dla opisu
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      select: {
        checkIn: true,
        checkOut: true,
        room: { select: { number: true } },
      },
    });

    const checkInStr = reservation?.checkIn.toISOString().slice(0, 10) ?? "";
    const checkOutStr = reservation?.checkOut.toISOString().slice(0, 10) ?? "";
    const roomNum = reservation?.room.number ?? "";

    const reason = `Pobyt ${checkInStr} - ${checkOutStr} (pokój ${roomNum})`;

    const result = await addLoyaltyPoints(guestId, basePoints, reason, {
      reservationId,
      referenceType: "RESERVATION",
      referenceId: reservationId,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    return { success: true, data: { pointsAwarded: basePoints } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd naliczania punktów za rezerwację",
    };
  }
}
