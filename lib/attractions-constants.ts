/** Stałe dla modułu atrakcji – eksportowane z osobnego pliku (pliki "use server" tylko async funkcje). */

export const STATUSES = ["BOOKED", "CONFIRMED", "DONE", "CANCELLED"] as const;
export type AttractionBookingStatus = (typeof STATUSES)[number];
