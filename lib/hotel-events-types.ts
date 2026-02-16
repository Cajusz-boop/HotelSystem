/** Typy i stałe dla wydarzeń hotelowych – eksportowane z osobnego pliku (pliki "use server" tylko async funkcje). */

export type HotelEventType = "CONFERENCE" | "WEDDING" | "MAINTENANCE" | "HOLIDAY" | "OTHER";

export type HotelEventEntry = {
  id: string;
  title: string;
  startDate: string;
  endDate: string | null;
  eventType: HotelEventType;
  description: string | null;
  propertyId: string | null;
  createdAt: string;
  updatedAt: string;
};

export const EVENT_TYPE_LABELS: Record<HotelEventType, string> = {
  CONFERENCE: "Konferencja",
  WEDDING: "Wesele",
  MAINTENANCE: "Konserwacja",
  HOLIDAY: "Święto",
  OTHER: "Inne",
};
