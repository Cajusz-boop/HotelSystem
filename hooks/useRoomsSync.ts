"use client";

import { useEffect, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRoomsForHousekeeping } from "@/app/actions/rooms";
import type { RoomStatus } from "@/lib/tape-chart-types";

const ROOMS_SYNC_KEY = ["rooms", "sync"] as const;
const BROADCAST_CHANNEL_NAME = "hotel-room-status";

export interface RoomStatusData {
  id: string;
  number: string;
  status: RoomStatus;
}

/**
 * Hook do synchronizacji statusów pokoi między stronami/kartami.
 * - Polling co `pollingInterval` ms (domyślnie 10s)
 * - BroadcastChannel dla natychmiastowej synchronizacji między kartami tej samej przeglądarki
 */
export function useRoomsSync(options?: {
  pollingInterval?: number;
  enabled?: boolean;
  onStatusChange?: (rooms: RoomStatusData[]) => void;
}) {
  const { pollingInterval = 10_000, enabled = true, onStatusChange } = options ?? {};
  const queryClient = useQueryClient();
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;

  const query = useQuery({
    queryKey: ROOMS_SYNC_KEY,
    queryFn: async (): Promise<RoomStatusData[]> => {
      const result = await getRoomsForHousekeeping();
      if (!result.success) throw new Error(result.error);
      return (result.data ?? []).map((r) => ({
        id: r.id,
        number: r.number,
        status: r.status as RoomStatus,
      }));
    },
    refetchInterval: pollingInterval,
    refetchOnWindowFocus: true,
    enabled,
    staleTime: 5_000,
    retry: (failureCount, error) => {
      if (
        error instanceof Error &&
        (error.message.toLowerCase().includes("unauthorized") ||
          error.message.toLowerCase().includes("session"))
      ) {
        return false;
      }
      return failureCount < 2;
    },
    throwOnError: false,
  });

  // Wywołaj callback gdy dane się zmienią
  useEffect(() => {
    if (query.data && onStatusChangeRef.current) {
      onStatusChangeRef.current(query.data);
    }
  }, [query.data]);

  // BroadcastChannel - nasłuchuj na zmiany z innych kart
  useEffect(() => {
    if (!enabled || typeof BroadcastChannel === "undefined") return;

    const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);

    channel.onmessage = (event) => {
      if (event.data?.type === "ROOM_STATUS_CHANGED") {
        // Natychmiast odśwież dane
        queryClient.invalidateQueries({ queryKey: ROOMS_SYNC_KEY });
      }
    };

    return () => channel.close();
  }, [queryClient, enabled]);

  return query;
}

/**
 * Wywołaj po udanej zmianie statusu pokoju - powiadomi inne karty tej przeglądarki.
 */
export function broadcastRoomStatusChange(): void {
  if (typeof BroadcastChannel === "undefined") return;
  
  try {
    const channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    channel.postMessage({ type: "ROOM_STATUS_CHANGED" });
    channel.close();
  } catch {
    // BroadcastChannel nie wspierany - polling załatwi sprawę
  }
}

/**
 * Hook do jednorazowego pobrania statusów pokoi (bez pollingu).
 * Używaj gdy potrzebujesz tylko danych, bez ciągłej synchronizacji.
 */
export function useRoomsStatusOnce() {
  return useQuery({
    queryKey: ROOMS_SYNC_KEY,
    queryFn: async (): Promise<RoomStatusData[]> => {
      const result = await getRoomsForHousekeeping();
      if (!result.success) throw new Error(result.error);
      return (result.data ?? []).map((r) => ({
        id: r.id,
        number: r.number,
        status: r.status as RoomStatus,
      }));
    },
    staleTime: 30_000,
  });
}
