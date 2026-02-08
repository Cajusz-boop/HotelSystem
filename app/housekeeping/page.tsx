"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getRoomsForHousekeeping,
  updateRoomStatus,
  type HousekeepingRoom,
} from "@/app/actions/rooms";
import {
  getPendingUpdates,
  addPendingUpdate,
  removePendingUpdate,
} from "@/lib/housekeeping-offline";
import { toast } from "sonner";
import { WifiOff, Wifi, Check, Trash2, AlertTriangle, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = [
  { value: "CLEAN", label: "Czysty", icon: Check },
  { value: "DIRTY", label: "Do sprzątania", icon: Trash2 },
  { value: "OOO", label: "Wyłączony (OOO)", icon: AlertTriangle },
] as const;

const HOUSEKEEPING_QUERY_KEY = ["housekeeping", "rooms"] as const;

function mergeRoomsWithPending(
  serverRooms: HousekeepingRoom[] | undefined,
  pending: { roomId: string; status: string; reason?: string }[]
): HousekeepingRoom[] {
  if (!serverRooms?.length) return serverRooms ?? [];
  const pendingByRoom = new Map(pending.map((p) => [p.roomId, p]));
  return serverRooms.map((r) => {
    const p = pendingByRoom.get(r.id);
    if (p) return { ...r, status: p.status, reason: p.reason };
    return r;
  });
}

export default function HousekeepingPage() {
  const queryClient = useQueryClient();
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [reportRoomId, setReportRoomId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [syncing, setSyncing] = useState(false);

  const HOUSEKEEPING_TIMEOUT_MS = 10_000;

  const {
    data: serverRooms,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: HOUSEKEEPING_QUERY_KEY,
    queryFn: async () => {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Przekroczono limit czasu (10 s). Sprawdź połączenie z bazą.")), HOUSEKEEPING_TIMEOUT_MS)
      );
      const result = await Promise.race([
        getRoomsForHousekeeping(),
        timeoutPromise,
      ]);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    staleTime: 20 * 1000,
    retry: 0,
  });

  const pendingUpdates = getPendingUpdates();
  const rooms = mergeRoomsWithPending(serverRooms, pendingUpdates);

  const statusMutation = useMutation({
    mutationFn: ({
      roomId,
      status,
      reason,
    }: {
      roomId: string;
      status: "CLEAN" | "DIRTY" | "OOO";
      reason?: string;
    }) => updateRoomStatus({ roomId, status, reason }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: HOUSEKEEPING_QUERY_KEY });
      toast.success(`Pokój ustawiony na ${variables.status}`);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      setSyncing(true);
      const pending = getPendingUpdates();
      if (pending.length === 0) {
        setSyncing(false);
        refetch();
        return;
      }
      getRoomsForHousekeeping().then((res) => {
        if (!res.success || !res.data) {
          setSyncing(false);
          return;
        }
        const serverByRoomId = new Map(res.data.map((r) => [r.id, r]));
        let applied = 0;
        Promise.all(
          pending.map((p) => {
            const server = serverByRoomId.get(p.roomId);
            if (server && new Date(server.updatedAt).getTime() > p.timestamp) {
              removePendingUpdate(p.roomId);
              return Promise.resolve();
            }
            return updateRoomStatus({
              roomId: p.roomId,
              status: p.status as "CLEAN" | "DIRTY" | "OOO",
              reason: p.reason,
            }).then((r) => {
              if (r.success) {
                removePendingUpdate(p.roomId);
                applied++;
              }
            });
          })
        ).then(() => {
          queryClient.invalidateQueries({ queryKey: HOUSEKEEPING_QUERY_KEY });
          setSyncing(false);
          if (applied > 0) toast.success(`Zsynchronizowano ${applied} zmian.`);
        });
      });
    };
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [refetch, queryClient]);

  const handleStatusChange = async (
    roomId: string,
    status: "CLEAN" | "DIRTY" | "OOO",
    reason?: string
  ) => {
    if (!online) {
      addPendingUpdate({ roomId, status, reason });
      queryClient.setQueryData<HousekeepingRoom[]>(HOUSEKEEPING_QUERY_KEY, (prev) =>
        prev?.map((r) => (r.id === roomId ? { ...r, status, reason } : r)) ?? []
      );
      toast.info("Brak sieci – zmiana zapisana lokalnie i zostanie wysłana po powrocie online.");
      return;
    }
    statusMutation.mutate({ roomId, status, reason });
  };

  const handleReportMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportRoomId) return;
    await handleStatusChange(reportRoomId, "OOO", reportReason.trim() || undefined);
    setReportRoomId(null);
    setReportReason("");
    toast.success("Zgłoszono usterkę. Pokój oznaczony jako OOO. Dashboard zaktualizowany.");
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-6 pl-[13rem]">
        <h1 className="text-2xl font-semibold">Gospodarka</h1>
        <p className="text-muted-foreground">Ładowanie…</p>
        <p className="text-xs text-muted-foreground">(max 10 s – jeśli dłużej, pojawi się błąd i przycisk „Ponów”)</p>
      </div>
    );
  }

  if (isError && error) {
    return (
      <div className="flex flex-col gap-6 p-6 pl-[13rem]">
        <h1 className="text-2xl font-semibold">Gospodarka</h1>
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
          <p className="mb-2 text-sm font-medium text-destructive">Błąd ładowania danych</p>
          <p className="mb-4 text-sm text-muted-foreground">{error instanceof Error ? error.message : "Nie udało się załadować listy pokoi."}</p>
          <Button type="button" onClick={() => refetch()}>
            Ponów
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Gospodarka</h1>
        <div className="flex items-center gap-2">
          {online ? (
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Wifi className="h-4 w-4" />
              Online
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-sm text-amber-600">
              <WifiOff className="h-4 w-4" />
              Brak sieci – zmiany zapisane lokalnie
            </span>
          )}
          {syncing && (
            <span className="text-sm text-muted-foreground">Synchronizacja…</span>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rooms.map((room) => (
          <div
            key={room.id}
            className={cn(
              "rounded-lg border bg-card p-4 shadow-sm",
              room.status === "CLEAN" && "border-green-200",
              room.status === "DIRTY" && "border-amber-200",
              room.status === "OOO" && "border-red-200"
            )}
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <span className="font-semibold">Pokój {room.number}</span>
                <span className="ml-2 text-sm text-muted-foreground">{room.type}</span>
              </div>
              <span
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold",
                  room.status === "CLEAN" && "bg-green-600 text-white",
                  room.status === "DIRTY" && "bg-amber-500 text-gray-900",
                  room.status === "OOO" && "bg-red-600 text-white"
                )}
              >
                {STATUS_OPTIONS.find((s) => s.value === room.status)?.label ?? room.status}
              </span>
            </div>
            {room.reason && (
              <p className="mb-2 text-xs text-muted-foreground">{room.reason}</p>
            )}
            <div className="flex flex-wrap gap-x-3 gap-y-2">
              {STATUS_OPTIONS.map(({ value, label, icon: Icon }) => (
              <Button
                type="button"
                key={value}
                size="default"
                variant={room.status === value ? "default" : "outline"}
                className="min-w-[100px] justify-center px-4 py-2 text-base font-medium"
                onClick={() => handleStatusChange(room.id, value)}
                disabled={statusMutation.isPending}
              >
                  <Icon className="mr-2 h-4 w-4" />
                  {label}
                </Button>
              ))}
              <Button
                type="button"
                size="default"
                variant="outline"
                className="min-w-[140px] justify-center px-4 py-2"
                onClick={() => {
                  setReportRoomId(room.id);
                  setReportReason(room.reason ?? "");
                }}
              >
                <Wrench className="mr-2 h-4 w-4" />
                Zgłoś usterkę
              </Button>
            </div>
          </div>
        ))}
      </div>

      {reportRoomId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={handleReportMaintenance}
            className="w-full max-w-sm rounded-lg border bg-background p-6 shadow-lg"
          >
            <h3 className="mb-4 font-semibold">Zgłoś usterkę (OOO)</h3>
            <div className="mb-4">
              <Label htmlFor="reason">Przyczyna (opcjonalnie)</Label>
              <Input
                id="reason"
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="np. Uszkodzona klimatyzacja"
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setReportRoomId(null);
                  setReportReason("");
                }}
              >
                Anuluj
              </Button>
              <Button type="submit">Zgłoś usterkę</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
