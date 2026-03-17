/**
 * Logika kwoty rezerwacji do wyświetlenia (np. w kontrahentach).
 * Eksportowana do testów jednostkowych.
 */

/** Typy transakcji traktowane jako płatności (nie wchodzą do sumy obciążeń). */
const PAYMENT_TRANSACTION_TYPES = ["PAYMENT", "DEPOSIT", "REFUND", "VOID"] as const;

/**
 * Suma obciążeń rezerwacji z transakcji (wszystkie typy oprócz płatności).
 */
export function sumChargeAmountFromTransactions(
  transactions: Array<{ amount: unknown; type: string }> | undefined
): number {
  if (!transactions?.length) return 0;
  return transactions
    .filter((t) => !PAYMENT_TRANSACTION_TYPES.includes(t.type as (typeof PAYMENT_TRANSACTION_TYPES)[number]))
    .reduce((s, t) => s + (t.amount != null ? Number(t.amount) : 0), 0);
}

/**
 * Sprawdza, czy jest naliczenie usługi hotelowej (ROOM) w transakcjach.
 */
export function hasRoomCharge(transactions: Array<{ amount: unknown; type: string }> | undefined): boolean {
  if (!transactions?.length) return false;
  return transactions.some((t) => t.type === "ROOM" && t.amount != null && Number(t.amount) > 0);
}

/**
* Kwota rezerwacji do wyświetlenia: usługa hotelowa + posiłki + inne.
* Gdy brak transakcji ROOM, dolicza usługę hotelową z rateCodePrice × noce (fallback).
 */
export function reservationDisplayAmount(res: {
  transactions: Array<{ amount: unknown; type: string }> | undefined;
  rateCodePrice?: unknown;
  checkIn: Date;
  checkOut: Date;
}): number {
  const fromTx = sumChargeAmountFromTransactions(res.transactions);
  const hasRoom = hasRoomCharge(res.transactions);

  if (hasRoom) return fromTx;

  const price = res.rateCodePrice != null ? Number(res.rateCodePrice) : null;
  if (price == null || price <= 0 || !(res.checkIn instanceof Date) || !(res.checkOut instanceof Date)) return fromTx;

  const nights = Math.round((res.checkOut.getTime() - res.checkIn.getTime()) / (24 * 60 * 60 * 1000));
  const roomAmount = nights > 0 ? price * nights : 0;
  return fromTx + roomAmount;
}
