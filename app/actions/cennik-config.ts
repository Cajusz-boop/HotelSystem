"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface CennikConfigForUi {
  currency: string;
  vatPercent: number;
  pricesAreNetto: boolean;
}

const DEFAULT_ID = "default";

/** Pobiera ustawienia cennika (waluta, VAT, netto/brutto) */
export async function getCennikConfig(): Promise<ActionResult<CennikConfigForUi>> {
  try {
    let row: Awaited<ReturnType<typeof prisma.cennikConfig.findUnique>> = null;
    try {
      row = await prisma.cennikConfig.findUnique({ where: { id: DEFAULT_ID } });
    } catch (error) {
      console.error("[getCennikConfig] Error fetching config:", error instanceof Error ? error.message : String(error));
      // Continue to create default config
    }

    if (!row) {
      try {
        row = await prisma.cennikConfig.create({
          data: {
            id: DEFAULT_ID,
            currency: "PLN",
            vatPercent: 8,
            pricesAreNetto: false,
          },
        });
      } catch (error) {
        console.error("[getCennikConfig] Error creating default config:", error instanceof Error ? error.message : String(error));
        return {
          success: true,
          data: {
            currency: "PLN",
            vatPercent: 8,
            pricesAreNetto: false,
          },
        };
      }
    }

    if (!row) {
      return {
        success: true,
        data: {
          currency: "PLN",
          vatPercent: 8,
          pricesAreNetto: false,
        },
      };
    }

    // Auto-migracja: jeśli VAT = 0 (stary domyślny), zaktualizuj na 8% brutto (usługi hotelowe)
    if (Number(row.vatPercent) === 0 && row.pricesAreNetto === true) {
      try {
        row = await prisma.cennikConfig.update({
          where: { id: DEFAULT_ID },
          data: { vatPercent: 8, pricesAreNetto: false },
        });
      } catch {
        // Ignoruj błąd migracji — użytkownik może zmienić ręcznie w /cennik
      }
    }

    return {
      success: true,
      data: {
        currency: row.currency,
        vatPercent: Number(row.vatPercent),
        pricesAreNetto: row.pricesAreNetto,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu ustawień",
    };
  }
}

/** Aktualizuje ustawienia cennika */
export async function updateCennikConfig(data: {
  currency?: string;
  vatPercent?: number;
  pricesAreNetto?: boolean;
}): Promise<ActionResult<CennikConfigForUi>> {
  try {
    const updated = await prisma.cennikConfig.upsert({
      where: { id: DEFAULT_ID },
      create: {
        id: DEFAULT_ID,
        currency: data.currency ?? "PLN",
        vatPercent: data.vatPercent ?? 0,
        pricesAreNetto: data.pricesAreNetto ?? true,
      },
      update: {
        ...(data.currency != null && { currency: data.currency }),
        ...(data.vatPercent != null && { vatPercent: data.vatPercent }),
        ...(data.pricesAreNetto != null && { pricesAreNetto: data.pricesAreNetto }),
      },
    });
    revalidatePath("/cennik");
    return {
      success: true,
      data: {
        currency: updated.currency,
        vatPercent: Number(updated.vatPercent),
        pricesAreNetto: updated.pricesAreNetto,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd zapisu ustawień",
    };
  }
}
