"use server";

import { revalidatePath } from "next/cache";
import {
  fetchCdrsFromCdrApi,
  createPhoneCallLogFromCdr,
  findRoomIdByChannel,
  findReservationIdByRoomAndDate,
} from "@/lib/telephony";
import { chargePhoneCallLogToReservation } from "@/app/actions/finance";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface ImportPhoneCallsResult {
  imported: number;
  skipped: number;
  charged: number;
  errors: string[];
}

/**
 * Pobiera CDR z centrali (Asterisk/3CX) za podany zakres dat i zapisuje do PhoneCallLog.
 * URL i klucz: z options lub z TELEPHONY_CDR_IMPORT_URL w .env.
 */
export async function importPhoneCalls(
  _propertyId: string | null,
  dateFrom: string,
  dateTo: string,
  options?: { cdrImportUrl?: string | null; apiKey?: string | null }
): Promise<ActionResult<ImportPhoneCallsResult>> {
  try {
    const apiUrl = (options?.cdrImportUrl?.trim() || process.env.TELEPHONY_CDR_IMPORT_URL || "").trim();
    if (!apiUrl) {
      return {
        success: false,
        error: "Podaj URL API CDR lub ustaw TELEPHONY_CDR_IMPORT_URL w .env.",
      };
    }

    const from = new Date(dateFrom + "T00:00:00Z");
    const to = new Date(dateTo + "T23:59:59.999Z");
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
      return { success: false, error: "Nieprawidłowy zakres dat" };
    }

    const apiKey = options?.apiKey?.trim() || process.env.TELEPHONY_CDR_API_KEY || null;
    const cdrs = await fetchCdrsFromCdrApi(apiUrl, from, to, apiKey);
    let imported = 0;
    let skipped = 0;
    let charged = 0;
    const errors: string[] = [];

    for (const cdr of cdrs) {
      try {
        let roomId: string | null = null;
        let reservationId: string | null = null;
        if (cdr.sourceChannel) {
          roomId = await findRoomIdByChannel(cdr.sourceChannel);
          if (roomId) {
            reservationId = await findReservationIdByRoomAndDate(roomId, cdr.startedAt);
          }
        }

        const result = await createPhoneCallLogFromCdr(cdr, {
          roomId: roomId ?? undefined,
          reservationId: reservationId ?? undefined,
        });
        if (result.skipped) skipped++;
        else imported++;

        if (cdr.cost != null && cdr.cost > 0) {
          const chargeResult = await chargePhoneCallLogToReservation(result.id);
          if (chargeResult.success && !chargeResult.data.skipped) charged++;
          else if (!chargeResult.success) errors.push(chargeResult.error);
        }
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e));
      }
    }

    revalidatePath("/finance");
    return {
      success: true,
      data: { imported, skipped, charged, errors },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd importu rozmów",
    };
  }
}
