/**
 * Offline queue dla Housekeeping: zapisuje zmiany statusów w IndexedDB.
 * Przy powrocie online: strategia Server Wins – jeśli Recepcja zmieniła w międzyczasie, nie nadpisujemy.
 */

const DB_NAME = "pms-housekeeping-offline";
const DB_VERSION = 1;
const STORE_NAME = "pending";

export interface PendingRoomUpdate {
  roomId: string;
  status: string;
  reason?: string;
  timestamp: number;
}

function openDb(): Promise<IDBDatabase> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("IndexedDB only in browser"));
  }
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "roomId" });
      }
    };
  });
}

/** Pobiera listę oczekujących aktualizacji z IndexedDB */
export function getPendingUpdates(): Promise<PendingRoomUpdate[]> {
  if (typeof window === "undefined") return Promise.resolve([]);
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => {
          const raw = req.result;
          resolve(Array.isArray(raw) ? raw : []);
        };
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => db.close();
      })
  );
}

/** Dodaje lub nadpisuje oczekującą aktualizację */
export function addPendingUpdate(
  update: Omit<PendingRoomUpdate, "timestamp">
): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const entry: PendingRoomUpdate = { ...update, timestamp: Date.now() };
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(entry);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => db.close();
      })
  );
}

/** Usuwa oczekującą aktualizację dla pokoju */
export function removePendingUpdate(roomId: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(roomId);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => db.close();
      })
  );
}

/** Czyści wszystkie oczekujące aktualizacje */
export function clearPendingUpdates(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => db.close();
      })
  );
}

/** Pobiera oczekującą aktualizację dla jednego pokoju */
export function getPendingUpdateForRoom(
  roomId: string
): Promise<PendingRoomUpdate | undefined> {
  if (typeof window === "undefined") return Promise.resolve(undefined);
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(roomId);
        req.onsuccess = () => resolve(req.result ?? undefined);
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => db.close();
      })
  );
}
