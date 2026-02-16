"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getRoomsForHousekeeping,
  updateRoomStatus,
  updateRoomCleaningPriority,
  updateRoomHousekeeper,
  updateRoomCleaningTime,
  assignHousekeeperToFloor,
  getHousekeepingStaff,
  getCleaningScheduleForDate,
  generateDailyCleaningSchedule,
  updateCleaningScheduleStatus,
  getHousekeeperPerformanceReport,
  type HousekeepingRoom,
  type CleaningPriority,
  type CleaningScheduleStatus,
} from "@/app/actions/rooms";
import { getEffectivePropertyId } from "@/app/actions/properties";
import {
  getPendingUpdates,
  addPendingUpdate,
  removePendingUpdate,
  type PendingRoomUpdate,
} from "@/lib/housekeeping-offline";
import { toast } from "sonner";
import { WifiOff, Wifi, Check, Trash2, AlertTriangle, Wrench, ClipboardCheck, CheckCircle2, Clock, Star, ArrowDownCircle, ArrowUpCircle, Minus as MinusIcon, ListTodo, X } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = [
  { value: "CLEAN", label: "Czysty", icon: Check },
  { value: "DIRTY", label: "Do sprzątania", icon: Trash2 },
  { value: "INSPECTION", label: "Do sprawdzenia", icon: ClipboardCheck },
  { value: "INSPECTED", label: "Sprawdzony", icon: CheckCircle2 },
  { value: "CHECKOUT_PENDING", label: "Oczekuje wymeldowania", icon: Clock },
  { value: "MAINTENANCE", label: "Do naprawy", icon: Wrench },
  { value: "OOO", label: "Wyłączony (OOO)", icon: AlertTriangle },
] as const;

const PRIORITY_OPTIONS: Array<{ value: CleaningPriority | null; label: string; icon: typeof Star; color: string }> = [
  { value: "VIP_ARRIVAL", label: "VIP przyjazd", icon: Star, color: "text-yellow-500" },
  { value: "DEPARTURE", label: "Wymeldowanie", icon: ArrowUpCircle, color: "text-red-500" },
  { value: "STAY_OVER", label: "Przedłużenie", icon: ArrowDownCircle, color: "text-blue-500" },
  { value: "NORMAL", label: "Normalny", icon: MinusIcon, color: "text-gray-400" },
  { value: null, label: "Brak", icon: MinusIcon, color: "text-gray-300" },
];

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

const SCHEDULE_STATUS_LABELS: Record<CleaningScheduleStatus, string> = {
  PENDING: "Oczekuje",
  IN_PROGRESS: "W trakcie",
  COMPLETED: "Zakończone",
  SKIPPED: "Pominięte",
};

export default function HousekeepingPage() {
  const queryClient = useQueryClient();
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [reportRoomId, setReportRoomId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [pendingUpdates, setPendingUpdates] = useState<PendingRoomUpdate[]>([]);
  const [viewMode, setViewMode] = useState<"rooms" | "schedule" | "performance">("rooms");
  const [scheduleDate, setScheduleDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [perfDateFrom, setPerfDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [perfDateTo, setPerfDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [generatingSchedule, setGeneratingSchedule] = useState(false);
  const [filterFloor, setFilterFloor] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [selectedRoomIds, setSelectedRoomIds] = useState<Set<string>>(new Set());
  const [bulkCleaning, setBulkCleaning] = useState(false);

  const HOUSEKEEPING_TIMEOUT_MS = 10_000;
  const SCHEDULE_QUERY_KEY = ["housekeeping", "schedule", scheduleDate] as const;
  const PERF_QUERY_KEY = ["housekeeping", "performance", perfDateFrom, perfDateTo] as const;

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

  const { data: scheduleData, refetch: refetchSchedule } = useQuery({
    queryKey: SCHEDULE_QUERY_KEY,
    queryFn: async () => {
      const result = await getCleaningScheduleForDate(scheduleDate);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    staleTime: 30 * 1000,
    enabled: viewMode === "schedule",
  });

  const { data: perfData, isLoading: perfLoading } = useQuery({
    queryKey: PERF_QUERY_KEY,
    queryFn: async () => {
      const result = await getHousekeeperPerformanceReport(perfDateFrom, perfDateTo);
      if (!result.success) throw new Error(result.error);
      return result.data;
    },
    staleTime: 60 * 1000,
    enabled: viewMode === "performance",
  });

  const rooms = mergeRoomsWithPending(serverRooms, pendingUpdates);

  const filteredRooms = rooms.filter((room) => {
    if (filterFloor && (room.floor ?? "") !== filterFloor) return false;
    if (filterStatus && room.status !== filterStatus) return false;
    if (filterType && room.type !== filterType) return false;
    return true;
  });

  const floorOptions = Array.from(new Set(rooms.map((r) => r.floor ?? "").filter(Boolean))).sort();
  const typeOptions = Array.from(new Set(rooms.map((r) => r.type))).sort();

  const { data: housekeepingStaff = [] } = useQuery({
    queryKey: ["housekeeping", "staff"],
    queryFn: async () => {
      const r = await getHousekeepingStaff();
      return r.success ? r.data : [];
    },
  });

  const housekeeperMutation = useMutation({
    mutationFn: ({ roomId, name }: { roomId: string; name: string | null }) =>
      updateRoomHousekeeper(roomId, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: HOUSEKEEPING_QUERY_KEY });
      toast.success("Zaktualizowano przypisanie");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cleaningTimeMutation = useMutation({
    mutationFn: ({ roomId, minutes }: { roomId: string; minutes: number | null }) =>
      updateRoomCleaningTime(roomId, minutes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: HOUSEKEEPING_QUERY_KEY });
      toast.success("Zaktualizowano czas sprzątania");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [floorAssignFloor, setFloorAssignFloor] = useState("");
  const [floorAssignName, setFloorAssignName] = useState("");
  const [floorAssigning, setFloorAssigning] = useState(false);
  const [editingCleaningTime, setEditingCleaningTime] = useState<{ roomId: string; value: string } | null>(null);

  const handleAssignToFloor = async () => {
    if (!floorAssignFloor || !floorAssignName.trim()) return;
    setFloorAssigning(true);
    const propertyId = await getEffectivePropertyId();
    if (!propertyId) {
      toast.error("Wybierz obiekt");
      setFloorAssigning(false);
      return;
    }
    const r = await assignHousekeeperToFloor(propertyId, floorAssignFloor, floorAssignName.trim());
    setFloorAssigning(false);
    if (r.success) {
      toast.success(`Przypisano ${floorAssignName} do piętra ${floorAssignFloor} (${r.data.updated} pokoi)`);
      queryClient.invalidateQueries({ queryKey: HOUSEKEEPING_QUERY_KEY });
    } else toast.error(r.error);
  };

  useEffect(() => {
    getPendingUpdates().then(setPendingUpdates);
  }, []);

  const statusMutation = useMutation({
    mutationFn: ({
      roomId,
      status,
      reason,
    }: {
      roomId: string;
      status: "CLEAN" | "DIRTY" | "OOO" | "INSPECTION" | "INSPECTED" | "CHECKOUT_PENDING" | "MAINTENANCE";
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
      getPendingUpdates().then((pending) => {
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
                return removePendingUpdate(p.roomId).then(() => undefined);
              }
              return updateRoomStatus({
                roomId: p.roomId,
                status: p.status as "CLEAN" | "DIRTY" | "OOO" | "INSPECTION" | "INSPECTED" | "CHECKOUT_PENDING" | "MAINTENANCE",
                reason: p.reason,
              }).then((r) => {
                if (r.success) {
                  applied++;
                  return removePendingUpdate(p.roomId);
                }
              });
            })
          )
            .then(() => getPendingUpdates().then(setPendingUpdates))
            .then(() => {
              queryClient.invalidateQueries({ queryKey: HOUSEKEEPING_QUERY_KEY });
              setSyncing(false);
              if (applied > 0) toast.success(`Zsynchronizowano ${applied} zmian.`);
            });
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
    status: "CLEAN" | "DIRTY" | "OOO" | "INSPECTION" | "INSPECTED" | "CHECKOUT_PENDING" | "MAINTENANCE",
    reason?: string
  ) => {
    if (!online) {
      addPendingUpdate({ roomId, status, reason }).then(() =>
        getPendingUpdates().then(setPendingUpdates)
      );
      queryClient.setQueryData<HousekeepingRoom[]>(HOUSEKEEPING_QUERY_KEY, (prev) =>
        prev?.map((r) => (r.id === roomId ? { ...r, status, reason } : r)) ?? []
      );
      toast.info("Brak sieci – zmiana zapisana lokalnie i zostanie wysłana po powrocie online.");
      return;
    }
    statusMutation.mutate({ roomId, status, reason });
  };

  const priorityMutation = useMutation({
    mutationFn: ({ roomId, priority }: { roomId: string; priority: CleaningPriority | null }) =>
      updateRoomCleaningPriority(roomId, priority),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: HOUSEKEEPING_QUERY_KEY });
      toast.success("Zaktualizowano priorytet sprzątania");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const handlePriorityChange = (roomId: string, priority: CleaningPriority | null) => {
    priorityMutation.mutate({ roomId, priority });
  };

  const toggleRoomSelection = (roomId: string) => {
    setSelectedRoomIds((prev) => {
      const next = new Set(prev);
      if (next.has(roomId)) next.delete(roomId);
      else next.add(roomId);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedRoomIds(new Set(filteredRooms.map((r) => r.id)));
  };

  const clearSelection = () => {
    setSelectedRoomIds(new Set());
  };

  const handleBulkClean = async () => {
    if (selectedRoomIds.size === 0) return;
    setBulkCleaning(true);
    let done = 0;
    for (const roomId of selectedRoomIds) {
      const r = await updateRoomStatus({ roomId, status: "CLEAN" });
      if (r.success) done++;
    }
    setBulkCleaning(false);
    clearSelection();
    queryClient.invalidateQueries({ queryKey: HOUSEKEEPING_QUERY_KEY });
    toast.success(`Oznaczono ${done} pokoi jako czyste.`);
  };

  const scheduleStatusMutation = useMutation({
    mutationFn: ({ scheduleId, status }: { scheduleId: string; status: CleaningScheduleStatus }) =>
      updateCleaningScheduleStatus(scheduleId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SCHEDULE_QUERY_KEY });
      toast.success("Zaktualizowano status harmonogramu");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const handleGenerateSchedule = async () => {
    setGeneratingSchedule(true);
    const result = await generateDailyCleaningSchedule(scheduleDate);
    setGeneratingSchedule(false);
    if (result.success) {
      toast.success(`Wygenerowano ${result.data.created} wpisów harmonogramu`);
      refetchSchedule();
    } else {
      toast.error(result.error ?? "Błąd generowania harmonogramu");
    }
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
        <h1 className="text-2xl font-semibold">Housekeeping</h1>
        <p className="text-muted-foreground">Ładowanie…</p>
        <p className="text-xs text-muted-foreground">(max 10 s – jeśli dłużej, pojawi się błąd i przycisk „Ponów”)</p>
      </div>
    );
  }

  if (isError && error) {
    return (
      <div className="flex flex-col gap-6 p-6 pl-[13rem]">
        <h1 className="text-2xl font-semibold">Housekeeping</h1>
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
        <h1 className="text-2xl font-semibold">Housekeeping</h1>
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
          {!online && pendingUpdates.length > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              {pendingUpdates.length} zmian w kolejce
            </span>
          )}
        </div>
      </div>

      {/* Lista oczekujących zmian offline */}
      {pendingUpdates.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-900">
              <ListTodo className="h-4 w-4" />
              Oczekujące zmiany ({pendingUpdates.length})
            </h3>
            {online ? (
              <span className="text-xs text-muted-foreground">Synchronizacja przy powrocie online</span>
            ) : (
              <span className="text-xs text-amber-700">Offline – zmiany zostaną wysłane po powrocie sieci</span>
            )}
          </div>
          <ul className="space-y-1.5 text-sm">
            {pendingUpdates.map((p) => {
              const room = rooms.find((r) => r.id === p.roomId);
              const roomLabel = room ? `Pokój ${room.number}` : p.roomId;
              const statusLabel = STATUS_OPTIONS.find((s) => s.value === p.status)?.label ?? p.status;
              return (
                <li
                  key={p.roomId}
                  className="flex items-center justify-between gap-2 rounded border border-amber-200/80 bg-white px-3 py-2"
                >
                  <span>
                    {roomLabel} → <strong>{statusLabel}</strong>
                    {p.reason && <span className="ml-2 text-muted-foreground">({p.reason})</span>}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    onClick={async () => {
                      await removePendingUpdate(p.roomId);
                      setPendingUpdates(await getPendingUpdates());
                      queryClient.invalidateQueries({ queryKey: HOUSEKEEPING_QUERY_KEY });
                      toast.info("Usunięto z kolejki");
                    }}
                    title="Usuń z kolejki"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
          {online && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => {
                setSyncing(true);
                getRoomsForHousekeeping().then((res) => {
                  if (!res.success || !res.data) {
                    setSyncing(false);
                    return;
                  }
                  const _serverByRoomId = new Map(res.data.map((r) => [r.id, r]));
                  Promise.all(
                    pendingUpdates.map((p) =>
                      updateRoomStatus({
                        roomId: p.roomId,
                        status: p.status as "CLEAN" | "DIRTY" | "OOO" | "INSPECTION" | "INSPECTED" | "CHECKOUT_PENDING" | "MAINTENANCE",
                        reason: p.reason,
                      }).then((r) => (r.success ? removePendingUpdate(p.roomId) : undefined))
                    )
                  )
                    .then(() => getPendingUpdates().then(setPendingUpdates))
                    .then(() => {
                      queryClient.invalidateQueries({ queryKey: HOUSEKEEPING_QUERY_KEY });
                      setSyncing(false);
                      toast.success("Zsynchronizowano zmiany");
                    });
                });
              }}
              disabled={syncing}
            >
              {syncing ? "Synchronizuję…" : "Synchronizuj teraz"}
            </Button>
          )}
        </div>
      )}

      {/* View Mode Tabs */}
      <div className="flex items-center gap-4 border-b pb-2">
        <button
          type="button"
          onClick={() => setViewMode("rooms")}
          className={cn(
            "pb-2 text-sm font-medium transition-colors",
            viewMode === "rooms"
              ? "border-b-2 border-primary text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Pokoje
        </button>
        <button
          type="button"
          onClick={() => setViewMode("schedule")}
          className={cn(
            "pb-2 text-sm font-medium transition-colors",
            viewMode === "schedule"
              ? "border-b-2 border-primary text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Harmonogram sprzątania
        </button>
        <button
          type="button"
          onClick={() => setViewMode("performance")}
          className={cn(
            "pb-2 text-sm font-medium transition-colors",
            viewMode === "performance"
              ? "border-b-2 border-primary text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Raport wydajności
        </button>
      </div>

      {viewMode === "schedule" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <Input
              type="date"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
              className="w-auto"
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleGenerateSchedule}
              disabled={generatingSchedule}
            >
              {generatingSchedule ? "Generowanie..." : "Generuj harmonogram"}
            </Button>
          </div>

          {scheduleData && scheduleData.length > 0 ? (
            <div className="rounded-lg border">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Pokój</th>
                    <th className="px-4 py-3 text-left font-medium">Godzina</th>
                    <th className="px-4 py-3 text-left font-medium">Czas (min)</th>
                    <th className="px-4 py-3 text-left font-medium">Przypisano</th>
                    <th className="px-4 py-3 text-left font-medium">Priorytet</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium">Akcje</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {scheduleData.map((item) => (
                    <tr key={item.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">
                        Pokój {item.roomNumber}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {item.scheduledTime ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {item.estimatedDuration ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {item.assignedTo ?? "Nieprzypisano"}
                      </td>
                      <td className="px-4 py-3">
                        {item.priority && (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                              item.priority === "VIP_ARRIVAL" && "bg-amber-100 text-amber-800",
                              item.priority === "DEPARTURE" && "bg-blue-100 text-blue-800",
                              item.priority === "STAY_OVER" && "bg-gray-100 text-gray-700"
                            )}
                          >
                            {item.priority === "VIP_ARRIVAL" && <Star className="h-3 w-3" />}
                            {item.priority === "DEPARTURE" && <ArrowDownCircle className="h-3 w-3" />}
                            {item.priority === "STAY_OVER" && <MinusIcon className="h-3 w-3" />}
                            {item.priority}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-medium",
                            item.status === "PENDING" && "bg-gray-100 text-gray-700",
                            item.status === "IN_PROGRESS" && "bg-blue-100 text-blue-800",
                            item.status === "COMPLETED" && "bg-green-100 text-green-800",
                            item.status === "SKIPPED" && "bg-amber-100 text-amber-800"
                          )}
                        >
                          {SCHEDULE_STATUS_LABELS[item.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {item.status === "PENDING" && (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  scheduleStatusMutation.mutate({
                                    scheduleId: item.id,
                                    status: "IN_PROGRESS",
                                  })
                                }
                                disabled={scheduleStatusMutation.isPending}
                              >
                                <Clock className="mr-1 h-3 w-3" />
                                Rozpocznij
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  scheduleStatusMutation.mutate({
                                    scheduleId: item.id,
                                    status: "SKIPPED",
                                  })
                                }
                                disabled={scheduleStatusMutation.isPending}
                              >
                                Pomiń
                              </Button>
                            </>
                          )}
                          {item.status === "IN_PROGRESS" && (
                            <Button
                              type="button"
                              size="sm"
                              variant="default"
                              onClick={() =>
                                scheduleStatusMutation.mutate({
                                  scheduleId: item.id,
                                  status: "COMPLETED",
                                })
                              }
                              disabled={scheduleStatusMutation.isPending}
                            >
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              Zakończ
                            </Button>
                          )}
                          {(item.status === "COMPLETED" || item.status === "SKIPPED") && (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="text-muted-foreground">
                Brak wpisów w harmonogramie na {scheduleDate}.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Kliknij &quot;Generuj harmonogram&quot; aby utworzyć wpisy na podstawie wyjazdów i brudnych pokoi.
              </p>
            </div>
          )}
        </div>
      )}

      {viewMode === "performance" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="perfFrom">Od</Label>
              <Input
                id="perfFrom"
                type="date"
                value={perfDateFrom}
                onChange={(e) => setPerfDateFrom(e.target.value)}
                className="w-auto"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="perfTo">Do</Label>
              <Input
                id="perfTo"
                type="date"
                value={perfDateTo}
                onChange={(e) => setPerfDateTo(e.target.value)}
                className="w-auto"
              />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Raport pokazuje liczbę posprzątanych pokoi w harmonogramie (status Zakończone) w wybranym okresie.
          </p>
          {perfLoading ? (
            <p className="text-muted-foreground">Ładowanie…</p>
          ) : perfData && perfData.length > 0 ? (
            <div className="rounded-lg border">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Pokojowa</th>
                    <th className="px-4 py-3 text-right font-medium">Posprzątane pokoje</th>
                    <th className="px-4 py-3 text-right font-medium">Szac. czas (min)</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {perfData.map((row) => (
                    <tr key={row.name} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{row.name}</td>
                      <td className="px-4 py-3 text-right">{row.roomsCompleted}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {row.totalEstimatedMinutes > 0 ? row.totalEstimatedMinutes : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="text-muted-foreground">Brak danych w wybranym okresie.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Zakończ wpisy w harmonogramie sprzątania, aby pojawiły się w raporcie.
              </p>
            </div>
          )}
        </div>
      )}

      {viewMode === "rooms" && (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="filterFloor" className="text-sm whitespace-nowrap">Piętro</Label>
            <select
              id="filterFloor"
              value={filterFloor}
              onChange={(e) => setFilterFloor(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm min-w-[100px]"
            >
              <option value="">Wszystkie</option>
              {floorOptions.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="filterStatus" className="text-sm whitespace-nowrap">Status</Label>
            <select
              id="filterStatus"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm min-w-[140px]"
            >
              <option value="">Wszystkie</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="filterType" className="text-sm whitespace-nowrap">Typ</Label>
            <select
              id="filterType"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm min-w-[120px]"
            >
              <option value="">Wszystkie</option>
              {typeOptions.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          {(filterFloor || filterStatus || filterType) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilterFloor("");
                setFilterStatus("");
                setFilterType("");
              }}
            >
              Wyczyść filtry
            </Button>
          )}
          <span className="text-sm text-muted-foreground">
            {filteredRooms.length} / {rooms.length} pokoi
          </span>
          <div className="flex flex-wrap items-center gap-4 border-l pl-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="floorAssignFloor" className="text-xs">Piętro</Label>
              <select
                id="floorAssignFloor"
                value={floorAssignFloor}
                onChange={(e) => setFloorAssignFloor(e.target.value)}
                className="h-8 rounded border px-2 text-sm"
              >
                <option value="">—</option>
                {floorOptions.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="floorAssignName" className="text-xs">Pokojowa</Label>
              <select
                id="floorAssignName"
                value={floorAssignName}
                onChange={(e) => setFloorAssignName(e.target.value)}
                className="h-8 rounded border px-2 text-sm min-w-[100px]"
              >
                <option value="">—</option>
                {housekeepingStaff.map((u) => (
                  <option key={u.id} value={u.name}>{u.name}</option>
                ))}
              </select>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleAssignToFloor}
              disabled={!floorAssignFloor || !floorAssignName.trim() || floorAssigning}
            >
              {floorAssigning ? "Przypisuję…" : "Przypisz do piętra"}
            </Button>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={selectAllFiltered}
            >
              Zaznacz wszystkie
            </Button>
            {selectedRoomIds.size > 0 && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearSelection}
                >
                  Wyczyść zaznaczenie
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleBulkClean}
                  disabled={bulkCleaning || !online}
                >
                  {bulkCleaning ? "Oznaczam…" : `Czysty (${selectedRoomIds.size})`}
                </Button>
              </>
            )}
          </div>
        </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filteredRooms.map((room) => (
          <div
            key={room.id}
            className={cn(
              "rounded-lg border bg-card p-4 shadow-sm",
              room.status === "CLEAN" && "border-green-200",
              room.status === "DIRTY" && "border-amber-200",
              room.status === "INSPECTION" && "border-blue-200",
              room.status === "INSPECTED" && "border-emerald-200",
              room.status === "CHECKOUT_PENDING" && "border-orange-200",
              room.status === "MAINTENANCE" && "border-purple-200",
              room.status === "OOO" && "border-red-200"
            )}
          >
            <div className="mb-3 flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedRoomIds.has(room.id)}
                  onChange={() => toggleRoomSelection(room.id)}
                  className="h-4 w-4 rounded border-input"
                />
                <div>
                <span className="font-semibold">Pokój {room.number}</span>
                <span className="ml-2 text-sm text-muted-foreground">{room.type}</span>
                </div>
              </label>
              <span
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold",
                  room.status === "CLEAN" && "bg-green-600 text-white",
                  room.status === "DIRTY" && "bg-amber-500 text-gray-900",
                  room.status === "INSPECTION" && "bg-blue-600 text-white",
                  room.status === "INSPECTED" && "bg-emerald-600 text-white",
                  room.status === "CHECKOUT_PENDING" && "bg-orange-500 text-white",
                  room.status === "MAINTENANCE" && "bg-purple-600 text-white",
                  room.status === "OOO" && "bg-red-600 text-white"
                )}
              >
                {STATUS_OPTIONS.find((s) => s.value === room.status)?.label ?? room.status}
              </span>
            </div>
            {room.reason && (
              <p className="mb-2 text-xs text-muted-foreground">{room.reason}</p>
            )}
            <div className="mb-2 flex items-center gap-2">
              <Label htmlFor={`hk-${room.id}`} className="text-xs">Pokojowa</Label>
              <select
                id={`hk-${room.id}`}
                value={room.assignedHousekeeper ?? ""}
                onChange={(e) =>
                  housekeeperMutation.mutate({
                    roomId: room.id,
                    name: e.target.value || null,
                  })
                }
                className="h-8 flex-1 rounded border px-2 text-sm"
                disabled={housekeeperMutation.isPending}
              >
                <option value="">—</option>
                {housekeepingStaff.map((u) => (
                  <option key={u.id} value={u.name}>{u.name}</option>
                ))}
              </select>
            </div>
            <div className="mb-2 flex items-center gap-2">
              <Label htmlFor={`time-${room.id}`} className="text-xs">Czas sprzątania (min)</Label>
              <Input
                id={`time-${room.id}`}
                type="number"
                min={5}
                max={180}
                step={5}
                placeholder="—"
                value={
                  editingCleaningTime?.roomId === room.id
                    ? editingCleaningTime.value
                    : (room.estimatedCleaningMinutes ?? "")
                }
                onChange={(e) =>
                  setEditingCleaningTime({ roomId: room.id, value: e.target.value })
                }
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  const num = v === "" ? null : parseInt(v, 10);
                  const valid = v === "" || (!Number.isNaN(num ?? 0) && (num ?? 0) >= 0);
                  setEditingCleaningTime(null);
                  if (!valid) return;
                  const current = room.estimatedCleaningMinutes ?? null;
                  if (num !== current) {
                    cleaningTimeMutation.mutate({ roomId: room.id, minutes: num });
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
                className="h-8 w-20"
                disabled={cleaningTimeMutation.isPending}
              />
            </div>
            {/* Priorytet sprzątania */}
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground shrink-0">Priorytet:</span>
              <div className="flex flex-wrap gap-1">
                {PRIORITY_OPTIONS.map(({ value, label, icon: PriorityIcon, color }) => (
                  <Button
                    key={String(value)}
                    type="button"
                    size="sm"
                    variant={room.cleaningPriority === value || (!room.cleaningPriority && value === null) ? "default" : "ghost"}
                    className={cn("h-7 px-2 shrink-0", room.cleaningPriority !== value && value !== null && color)}
                    onClick={() => handlePriorityChange(room.id, value)}
                    disabled={priorityMutation.isPending}
                    title={label}
                  >
                    <PriorityIcon className="h-3.5 w-3.5" />
                    <span className="ml-1 text-xs">{label}</span>
                  </Button>
                ))}
              </div>
            </div>
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
      </div>
      )}

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
