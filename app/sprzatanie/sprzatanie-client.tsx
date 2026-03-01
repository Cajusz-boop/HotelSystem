"use client";

import { useEffect, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { getRoomsForHousekeeping, updateRoomStatus } from "@/app/actions/rooms";
import { broadcastRoomStatusChange } from "@/hooks/useRoomsSync";
import { useOfflineStorage, type OfflineRoom } from "@/hooks/useOfflineStorage";
import { toast } from "sonner";
import {
  CheckCircle2,
  Circle,
  Wifi,
  WifiOff,
  Download,
  RefreshCw,
  CloudOff,
  Cloud,
} from "lucide-react";

const HOUSEKEEPING_QUERY_KEY = ["housekeeping", "rooms"] as const;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function SprzatanieClient() {
  const queryClient = useQueryClient();
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  const {
    isReady: offlineReady,
    pendingCount,
    saveRooms,
    getRooms: getOfflineRooms,
    updateRoomStatusLocally,
    addPendingMutation,
    getPendingMutations,
    markMutationSynced,
    clearSyncedMutations,
  } = useOfflineStorage();

  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      toast.success("Połączono z siecią");
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.warning("Brak połączenia - tryb offline");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      toast.success("Aplikacja zainstalowana!");
    }
    setDeferredPrompt(null);
  };

  const {
    data: rooms,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: HOUSEKEEPING_QUERY_KEY,
    queryFn: async () => {
      if (!isOnline && offlineReady) {
        const offlineData = await getOfflineRooms();
        if (offlineData.length > 0) {
          return offlineData;
        }
      }
      const result = await getRoomsForHousekeeping();
      if (!result.success) throw new Error(result.error);
      const data = result.data ?? [];
      if (offlineReady && data.length > 0) {
        await saveRooms(
          data.map((r) => ({
            id: r.id,
            number: r.number,
            type: r.type,
            status: r.status,
            updatedAt: r.updatedAt,
          }))
        );
      }
      return data;
    },
    staleTime: 20 * 1000,
    retry: isOnline ? 1 : 0,
    enabled: true,
  });

  const syncPendingMutations = useCallback(async () => {
    if (!isOnline || !offlineReady) return;
    setIsSyncing(true);
    try {
      const pending = await getPendingMutations();
      let syncedCount = 0;
      for (const mutation of pending) {
        try {
          if (mutation.action === "markClean") {
            const result = await updateRoomStatus({ roomId: mutation.roomId, status: "CLEAN" });
            if (result.success) {
              await markMutationSynced(mutation.id);
              syncedCount++;
            }
          }
        } catch (err) {
          console.error("[Sync] Failed to sync mutation:", mutation.id, err);
        }
      }
      if (syncedCount > 0) {
        await clearSyncedMutations();
        toast.success(`Zsynchronizowano ${syncedCount} zmian`);
        queryClient.invalidateQueries({ queryKey: HOUSEKEEPING_QUERY_KEY });
        queryClient.invalidateQueries({ queryKey: ["rooms", "sync"] });
        broadcastRoomStatusChange();
      }
    } finally {
      setIsSyncing(false);
    }
  }, [
    isOnline,
    offlineReady,
    getPendingMutations,
    markMutationSynced,
    clearSyncedMutations,
    queryClient,
  ]);

  useEffect(() => {
    if (isOnline && offlineReady && pendingCount > 0) {
      syncPendingMutations();
    }
  }, [isOnline, offlineReady, pendingCount, syncPendingMutations]);

  const statusMutation = useMutation({
    mutationFn: async ({ roomId }: { roomId: string }) => {
      if (isOnline) {
        return updateRoomStatus({ roomId, status: "CLEAN" });
      } else {
        await updateRoomStatusLocally(roomId, "CLEAN");
        await addPendingMutation(roomId, "markClean");
        return { success: true };
      }
    },
    onSuccess: (result, { roomId }) => {
      if (result.success) {
        queryClient.setQueryData<OfflineRoom[]>(HOUSEKEEPING_QUERY_KEY, (old) =>
          old?.map((r) => (r.id === roomId ? { ...r, status: "CLEAN" } : r))
        );
        if (isOnline) {
          queryClient.invalidateQueries({ queryKey: HOUSEKEEPING_QUERY_KEY });
          queryClient.invalidateQueries({ queryKey: ["rooms", "sync"] });
          broadcastRoomStatusChange();
        }
        toast.success(
          isOnline
            ? "Pokój oznaczony jako posprzątany"
            : "Zapisano offline - zsynchronizuje po połączeniu"
        );
      }
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const allRooms = rooms ?? [];

  if (isLoading && !rooms) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
        <h1 className="text-2xl font-semibold">Sprzątanie</h1>
        <p className="text-muted-foreground">Ładowanie…</p>
      </div>
    );
  }

  if (isError && error && !rooms) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
        <h1 className="text-2xl font-semibold">Sprzątanie</h1>
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-center">
          <p className="mb-2 text-sm font-medium text-destructive">Błąd ładowania</p>
          <p className="mb-4 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "Nie udało się załadować listy pokoi."}
          </p>
          <Button type="button" onClick={() => refetch()}>
            Ponów
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col p-4 pb-[env(safe-area-inset-bottom)] pt-[max(1rem,env(safe-area-inset-top))] md:p-8">
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-semibold">Sprzątanie</h1>
          <div className="flex items-center gap-3">
            {isOnline ? (
              <span className="flex items-center gap-1.5 text-sm text-green-600">
                <Wifi className="h-4 w-4" />
                Online
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-sm text-amber-600">
                <WifiOff className="h-4 w-4" />
                Offline
              </span>
            )}
            {pendingCount > 0 && (
              <span className="flex items-center gap-1.5 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                <CloudOff className="h-3 w-3" />
                {pendingCount} do synchronizacji
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {!isInstalled && deferredPrompt && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleInstall}
              className="gap-1.5"
            >
              <Download className="h-4 w-4" />
              Zainstaluj aplikację
            </Button>
          )}
          {isOnline && pendingCount > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={syncPendingMutations}
              disabled={isSyncing}
              className="gap-1.5"
            >
              {isSyncing ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Cloud className="h-4 w-4" />
              )}
              Synchronizuj teraz
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={!isOnline}
            className="gap-1.5"
          >
            <RefreshCw className="h-4 w-4" />
            Odśwież
          </Button>
        </div>
      </div>

      <p className="mb-6 text-muted-foreground">
        Pokoje do posprzątania. Kliknij &ldquo;Brudny&rdquo;, aby oznaczyć jako posprzątany.
        {!isOnline && " Zmiany zostaną zsynchronizowane po połączeniu z siecią."}
      </p>

      {allRooms.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-green-300 bg-green-50/50 p-12 text-center">
          <CheckCircle2 className="mb-4 h-16 w-16 text-green-600" />
          <p className="text-lg font-medium text-green-800">Brak pokoi</p>
          <p className="mt-1 text-sm text-green-700">Nie znaleziono pokoi w bazie.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3 md:grid-cols-4 md:gap-4">
          {allRooms.map((room) => {
            const needsCleaning = room.status === "DIRTY" || room.status === "INSPECTION";
            return (
              <div
                key={room.id}
                className={`flex min-h-[120px] flex-col items-center justify-between gap-2 rounded-xl border-2 p-3 shadow-sm md:min-h-[140px] md:gap-4 md:p-6 ${
                  needsCleaning
                    ? "border-amber-200 bg-amber-50/30"
                    : "border-green-200/80 bg-green-50/20"
                }`}
              >
                <span className="text-sm font-bold md:text-2xl">Pokój {room.number}</span>
                <span className="line-clamp-2 text-center text-[10px] text-muted-foreground md:text-sm">
                  {room.type}
                </span>
                <Button
                  type="button"
                  size="lg"
                  variant={needsCleaning ? "default" : "outline"}
                  className={`h-10 w-full touch-manipulation text-xs font-semibold md:h-14 md:text-lg ${
                    !needsCleaning
                      ? "border-green-300 bg-green-50 text-green-800 hover:bg-green-100 hover:text-green-900"
                      : ""
                  }`}
                  onClick={() => statusMutation.mutate({ roomId: room.id })}
                  disabled={statusMutation.isPending}
                >
                  {needsCleaning ? (
                    <>
                      <Circle
                        className="mr-1 h-4 w-4 shrink-0 md:mr-2 md:h-6 md:w-6"
                        strokeWidth={2.5}
                      />
                      Brudny
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-1 h-4 w-4 shrink-0 md:mr-2 md:h-6 md:w-6" />
                      Posprzątane
                    </>
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {isInstalled && (
        <p className="mt-8 text-center text-xs text-muted-foreground">
          Aplikacja zainstalowana — dostępna na ekranie głównym
        </p>
      )}
    </div>
  );
}
