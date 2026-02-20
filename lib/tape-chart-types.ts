/** Status pokoju – zgodnie z Prisma RoomStatus */
export type RoomStatus = "CLEAN" | "DIRTY" | "OOO" | "INSPECTION" | "INSPECTED" | "CHECKOUT_PENDING" | "MAINTENANCE";

/** Status rezerwacji – określa kolor paska na grafiku */
export type ReservationStatus = "CONFIRMED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED" | "NO_SHOW";

export interface Room {
  id?: string;
  number: string;
  type: string;
  status: RoomStatus;
  floor?: string; // piętro (np. "1", "Parter")
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

/** Ramka pasków rezerwacji – zawsze czarna, cienka (kolor wypełnienia z RESERVATION_STATUS_BG / ustawień) */
export const RESERVATION_STATUS_COLORS: Record<ReservationStatus, string> = {
  CONFIRMED: "border border-black",
  CHECKED_IN: "border border-black",
  CHECKED_OUT: "border border-black",
  CANCELLED: "border border-black",
  NO_SHOW: "border border-black",
};

/** Tła – kolory unikalne, Potwierdzona zielona */
export const RESERVATION_STATUS_BG: Record<ReservationStatus, string> = {
  CONFIRMED: "rgb(34 197 94)",   // zielony
  CHECKED_IN: "rgb(59 130 246)", // niebieski
  CHECKED_OUT: "rgb(100 116 139)", // szary
  CANCELLED: "rgb(239 68 68)",   // czerwony
  NO_SHOW: "rgb(245 158 11)",    // pomarańczowy
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
