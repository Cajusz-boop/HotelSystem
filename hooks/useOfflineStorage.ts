"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const DB_NAME = "hotel-sprzatanie-db";
const DB_VERSION = 1;
const ROOMS_STORE = "rooms";
const PENDING_STORE = "pending-mutations";

export interface OfflineRoom {
  id: string;
  number: string;
  type: string;
  status: string;
  updatedAt: string;
}

export interface PendingMutation {
  id: string;
  roomId: string;
  action: "markClean";
  timestamp: number;
  synced: boolean;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(ROOMS_STORE)) {
        db.createObjectStore(ROOMS_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(PENDING_STORE)) {
        const pendingStore = db.createObjectStore(PENDING_STORE, { keyPath: "id" });
        pendingStore.createIndex("synced", "synced", { unique: false });
      }
    };
  });
}

export function useOfflineStorage() {
  const [isReady, setIsReady] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const dbRef = useRef<IDBDatabase | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      return;
    }
    openDB()
      .then((db) => {
        dbRef.current = db;
        setIsReady(true);
        refreshPendingCount();
      })
      .catch((err) => {
        console.error("[useOfflineStorage] Failed to open IndexedDB:", err);
      });

    return () => {
      dbRef.current?.close();
    };
  }, []);

  const refreshPendingCount = useCallback(async () => {
    const db = dbRef.current;
    if (!db) return;
    try {
      const tx = db.transaction(PENDING_STORE, "readonly");
      const store = tx.objectStore(PENDING_STORE);
      const index = store.index("synced");
      const request = index.count(IDBKeyRange.only(false));
      request.onsuccess = () => setPendingCount(request.result);
    } catch {
      // ignore
    }
  }, []);

  const saveRooms = useCallback(async (rooms: OfflineRoom[]) => {
    const db = dbRef.current;
    if (!db) return;
    const tx = db.transaction(ROOMS_STORE, "readwrite");
    const store = tx.objectStore(ROOMS_STORE);
    await Promise.all(rooms.map((room) => new Promise<void>((res, rej) => {
      const req = store.put(room);
      req.onsuccess = () => res();
      req.onerror = () => rej(req.error);
    })));
  }, []);

  const getRooms = useCallback(async (): Promise<OfflineRoom[]> => {
    const db = dbRef.current;
    if (!db) return [];
    return new Promise((resolve, reject) => {
      const tx = db.transaction(ROOMS_STORE, "readonly");
      const store = tx.objectStore(ROOMS_STORE);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result as OfflineRoom[]);
      request.onerror = () => reject(request.error);
    });
  }, []);

  const updateRoomStatusLocally = useCallback(async (roomId: string, status: string) => {
    const db = dbRef.current;
    if (!db) return;
    const tx = db.transaction(ROOMS_STORE, "readwrite");
    const store = tx.objectStore(ROOMS_STORE);
    return new Promise<void>((resolve, reject) => {
      const getReq = store.get(roomId);
      getReq.onsuccess = () => {
        const room = getReq.result as OfflineRoom | undefined;
        if (room) {
          room.status = status;
          room.updatedAt = new Date().toISOString();
          const putReq = store.put(room);
          putReq.onsuccess = () => resolve();
          putReq.onerror = () => reject(putReq.error);
        } else {
          resolve();
        }
      };
      getReq.onerror = () => reject(getReq.error);
    });
  }, []);

  const addPendingMutation = useCallback(async (roomId: string, action: "markClean") => {
    const db = dbRef.current;
    if (!db) return;
    const mutation: PendingMutation = {
      id: `${roomId}-${Date.now()}`,
      roomId,
      action,
      timestamp: Date.now(),
      synced: false,
    };
    const tx = db.transaction(PENDING_STORE, "readwrite");
    const store = tx.objectStore(PENDING_STORE);
    await new Promise<void>((resolve, reject) => {
      const req = store.add(mutation);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    await refreshPendingCount();
  }, [refreshPendingCount]);

  const getPendingMutations = useCallback(async (): Promise<PendingMutation[]> => {
    const db = dbRef.current;
    if (!db) return [];
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PENDING_STORE, "readonly");
      const store = tx.objectStore(PENDING_STORE);
      const index = store.index("synced");
      const request = index.getAll(IDBKeyRange.only(false));
      request.onsuccess = () => resolve(request.result as PendingMutation[]);
      request.onerror = () => reject(request.error);
    });
  }, []);

  const markMutationSynced = useCallback(async (id: string) => {
    const db = dbRef.current;
    if (!db) return;
    const tx = db.transaction(PENDING_STORE, "readwrite");
    const store = tx.objectStore(PENDING_STORE);
    await new Promise<void>((resolve, reject) => {
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const mutation = getReq.result as PendingMutation | undefined;
        if (mutation) {
          mutation.synced = true;
          const putReq = store.put(mutation);
          putReq.onsuccess = () => resolve();
          putReq.onerror = () => reject(putReq.error);
        } else {
          resolve();
        }
      };
      getReq.onerror = () => reject(getReq.error);
    });
    await refreshPendingCount();
  }, [refreshPendingCount]);

  const clearSyncedMutations = useCallback(async () => {
    const db = dbRef.current;
    if (!db) return;
    const tx = db.transaction(PENDING_STORE, "readwrite");
    const store = tx.objectStore(PENDING_STORE);
    const index = store.index("synced");
    const request = index.getAllKeys(IDBKeyRange.only(true));
    request.onsuccess = () => {
      const keys = request.result;
      keys.forEach((key) => store.delete(key));
    };
  }, []);

  return {
    isReady,
    pendingCount,
    saveRooms,
    getRooms,
    updateRoomStatusLocally,
    addPendingMutation,
    getPendingMutations,
    markMutationSynced,
    clearSyncedMutations,
    refreshPendingCount,
  };
}
