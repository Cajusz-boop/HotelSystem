/**
 * Offline queue dla Housekeeping: zapisuje zmiany statusów w localStorage.
 * Przy powrocie online: strategia Server Wins – jeśli Recepcja zmieniła w międzyczasie, nie nadpisujemy.
 */

const STORAGE_KEY = "pms-housekeeping-pending";

export interface PendingRoomUpdate {
  roomId: string;
  status: string;
  reason?: string;
  timestamp: number;
}

export function getPendingUpdates(): PendingRoomUpdate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PendingRoomUpdate[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addPendingUpdate(update: Omit<PendingRoomUpdate, "timestamp">): void {
  const list = getPendingUpdates();
  const existing = list.findIndex((u) => u.roomId === update.roomId);
  const entry: PendingRoomUpdate = { ...update, timestamp: Date.now() };
  if (existing >= 0) list[existing] = entry;
  else list.push(entry);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function removePendingUpdate(roomId: string): void {
  const list = getPendingUpdates().filter((u) => u.roomId !== roomId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function clearPendingUpdates(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function getPendingUpdateForRoom(roomId: string): PendingRoomUpdate | undefined {
  return getPendingUpdates().find((u) => u.roomId === roomId);
}
