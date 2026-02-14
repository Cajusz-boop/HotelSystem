import type { Reservation, Room } from "./tape-chart-types";

/** Wyciąga numer piętra z numeru pokoju (np. "101" → "1", "201" → "2") */
export function getFloorFromRoomNumber(roomNumber: string): string {
  const match = roomNumber.match(/^(\d)/);
  return match ? match[1] : "0";
}

/** Grupuje pokoje po piętrach. Klucze posortowane. */
export function groupRoomsByFloor(rooms: Room[]): Map<string, Room[]> {
  const map = new Map<string, Room[]>();
  for (const room of rooms) {
    const floor = getFloorFromRoomNumber(room.number);
    if (!map.has(floor)) map.set(floor, []);
    map.get(floor)!.push(room);
  }
  const sorted = new Map<string, Room[]>();
  [...map.keys()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).forEach((k) => {
    sorted.set(k, map.get(k)!);
  });
  return sorted;
}

export type RoomTileType = "arrival" | "stay" | "departure" | "changeover" | "gap";

export interface RoomTileState {
  type: RoomTileType;
  reservation?: Reservation;
  /** Dla changeover: rezerwacja wyjeżdżająca */
  departureRes?: Reservation;
  /** Dla changeover: rezerwacja przyjeżdżająca */
  arrivalRes?: Reservation;
  /** Dla gap: liczba wolnych nocy (undefined = nie liczone / 3+) */
  freeNights?: number;
}

/** Określa stan pokoju na dany dzień (dateStr YYYY-MM-DD). */
export function getRoomStateForDay(
  roomNumber: string,
  dateStr: string,
  reservations: Reservation[]
): RoomTileState {
  const roomRes = reservations.filter((r) => r.room === roomNumber);
  const overlapping = roomRes.filter((r) => r.checkIn <= dateStr && dateStr < r.checkOut);
  const departing = roomRes.filter((r) => r.checkOut === dateStr);
  const arriving = roomRes.filter((r) => r.checkIn === dateStr);

  if (departing.length >= 1 && arriving.length >= 1) {
    return {
      type: "changeover",
      departureRes: departing[0],
      arrivalRes: arriving[0],
    };
  }

  if (overlapping.length === 1) {
    const res = overlapping[0];
    if (res.checkIn === dateStr) return { type: "arrival", reservation: res };
    if (res.checkOut > dateStr) return { type: "stay", reservation: res };
    return { type: "departure", reservation: res };
  }

  if (departing.length === 1) {
    return { type: "departure", reservation: departing[0] };
  }

  const freeNights = getFreeNightsFrom(roomNumber, dateStr, reservations);
  return { type: "gap", freeNights };
}

/** Liczy wolne noce od dateStr (do następnego checkIn w tym pokoju). */
export function getFreeNightsFrom(
  roomNumber: string,
  dateStr: string,
  reservations: Reservation[]
): number | undefined {
  const nextCheckIns = reservations
    .filter((r) => r.room === roomNumber && r.checkIn > dateStr)
    .map((r) => r.checkIn)
    .sort();
  if (nextCheckIns.length === 0) return undefined;
  const next = nextCheckIns[0];
  const from = new Date(dateStr + "T12:00:00").getTime();
  const to = new Date(next + "T12:00:00").getTime();
  const nights = Math.floor((to - from) / (24 * 60 * 60 * 1000));
  return nights <= 0 ? undefined : nights;
}

/** Maskuje nazwisko w trybie prywatności: np. "Jan Kowalski" → "J*****i" */
export function maskGuestName(name: string): string {
  const t = name.trim();
  if (t.length <= 2) return t[0] + "***" || "***";
  return t[0] + "*****" + t[t.length - 1];
}

/** Etykiety statusów rezerwacji */
export const RESERVATION_STATUS_LABELS: Record<string, string> = {
  CONFIRMED: "Oczekuje",
  CHECKED_IN: "Zameldowany",
  CHECKED_OUT: "Wymeldowany",
  CANCELLED: "Anulowana",
  NO_SHOW: "No-show",
};

/**
 * Obłożenie w danym dniu: ułamek pokoi zajętych (0..1).
 * Pokój jest zajęty, jeśli ma rezerwację z checkIn <= dateStr < checkOut.
 */
export function getOccupancyForDay(
  dateStr: string,
  rooms: Room[],
  reservations: Reservation[]
): number {
  if (rooms.length === 0) return 0;
  const roomNumbers = new Set(rooms.map((r) => r.number));
  const occupiedRooms = new Set<string>();
  for (const r of reservations) {
    if (r.checkIn <= dateStr && dateStr < r.checkOut && roomNumbers.has(r.room)) {
      occupiedRooms.add(r.room);
    }
  }
  return occupiedRooms.size / rooms.length;
}

/** Kolor heatmapy: red = 100%, yellow = >90%, green = <50%, orange = 50–90% */
export type HeatmapLevel = "red" | "yellow" | "orange" | "green";

export function getHeatmapLevel(occupancy: number): HeatmapLevel {
  if (occupancy >= 1) return "red";
  if (occupancy > 0.9) return "yellow";
  if (occupancy < 0.5) return "green";
  return "orange";
}
