/** Status pokoju – zgodnie z dummy-data.json i Room Guard */
export type RoomStatus = "CLEAN" | "DIRTY" | "OOO";

/** Status rezerwacji – określa kolor paska na grafiku */
export type ReservationStatus = "CONFIRMED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED" | "NO_SHOW";

export interface Room {
  number: string;
  type: string;
  status: RoomStatus;
  price?: number;
  reason?: string; // np. "Broken AC" dla OOO
}

export interface Reservation {
  id: string;
  guestName: string;
  room: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string;
  status: ReservationStatus;
  pax?: number;
  rateCodeId?: string;
  rateCode?: string;
  rateCodeName?: string;
  rateCodePrice?: number;
}

/** Kolory pasków rezerwacji – pełne, nieprzezroczyste */
export const RESERVATION_STATUS_COLORS: Record<ReservationStatus, string> = {
  CONFIRMED: "border-2 border-blue-800",
  CHECKED_IN: "border-2 border-blue-900",
  CHECKED_OUT: "border-2 border-slate-700",
  CANCELLED: "border-2 border-red-700",
  NO_SHOW: "border-2 border-amber-700",
};

/** Tła w rgba – 100% opacity */
export const RESERVATION_STATUS_BG: Record<ReservationStatus, string> = {
  CONFIRMED: "rgb(37 99 235)",
  CHECKED_IN: "rgb(29 78 216)",
  CHECKED_OUT: "rgb(100 116 139)",
  CANCELLED: "rgb(239 68 68)",
  NO_SHOW: "rgb(245 158 11)",
};

/** Ikony Lucide dla statusów pokoju */
export const ROOM_STATUS_LABELS: Record<RoomStatus, string> = {
  CLEAN: "CLEAN",
  DIRTY: "DIRTY",
  OOO: "OOO",
};
