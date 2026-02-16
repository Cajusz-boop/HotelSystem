/** Stałe dla modułu transferów – eksportowane z osobnego pliku (pliki "use server" tylko async funkcje). */

export const TRANSFER_TYPES = ["AIRPORT", "STATION"] as const;
export const DIRECTIONS = ["ARRIVAL", "DEPARTURE"] as const;
export const STATUSES = ["BOOKED", "CONFIRMED", "DONE", "CANCELLED"] as const;

export type TransferType = (typeof TRANSFER_TYPES)[number];
export type TransferDirection = (typeof DIRECTIONS)[number];
export type TransferBookingStatus = (typeof STATUSES)[number];
