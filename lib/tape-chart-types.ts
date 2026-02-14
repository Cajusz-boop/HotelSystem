/** Status pokoju – zgodnie z dummy-data.json i Room Guard */
export type RoomStatus = "CLEAN" | "DIRTY" | "OOO" | "INSPECTION";

/** Status rezerwacji – określa kolor paska na grafiku */
export type ReservationStatus = "CONFIRMED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED" | "NO_SHOW";

export interface Room {
  id?: string;
  number: string;
  type: string;
  status: RoomStatus;
  price?: number;
  reason?: string; // np. "Broken AC" dla OOO
  roomFeatures?: string[]; // np. ["balkon", "widok"] – cechy do filtrowania
  beds?: number; // liczba łóżek (1 = cały pokój, >1 = sprzedaż po łóżku)
  blocks?: RoomBlock[];
}

export interface Reservation {
  id: string;
  guestId?: string;
  guestName: string;
  guestBlacklisted?: boolean;
  room: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string;
  checkInTime?: string; // HH:mm – rezerwacja godzinowa
  checkOutTime?: string;
  status: ReservationStatus;
  pax?: number;
  rateCodeId?: string;
  rateCode?: string;
  rateCodeName?: string;
  rateCodePrice?: number;
  groupId?: string;
  groupName?: string;
  parkingSpotId?: string;
  parkingSpotNumber?: string;
  notes?: string;
  bedsBooked?: number; // rezerwacja zasobowa: ile łóżek (gdy room.beds > 1)
  vip?: boolean; // gość VIP
  paymentStatus?: "UNPAID" | "PARTIAL" | "PAID"; // status płatności
}

export interface ReservationGroupSummary {
  id: string;
  name?: string | null;
  reservationCount: number;
}

export interface RoomBlock {
  id: string;
  roomNumber: string;
  startDate: string;
  endDate: string;
  reason?: string;
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
  INSPECTION: "Do sprawdzenia",
  INSPECTED: "Sprawdzony",
  CHECKOUT_PENDING: "Oczekuje wymeldowania",
  MAINTENANCE: "Do naprawy",
};
