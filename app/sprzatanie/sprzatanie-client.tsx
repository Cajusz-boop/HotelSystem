"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { getRoomsForHousekeeping, updateRoomStatus } from "@/app/actions/rooms";
import { broadcastRoomStatusChange } from "@/hooks/useRoomsSync";
import { toast } from "sonner";
import { CheckCircle2, Circle, Wifi, WifiOff } from "lucide-react";

const HOUSEKEEPING_QUERY_KEY = ["housekeeping", "rooms"] as const;

export default function SprzatanieClient() {
  const queryClient = useQueryClient();
  const online = typeof navigator !== "undefined" ? navigator.onLine : true;

  const {
    data: rooms,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: HOUSEKEEPING_QUERY_KEY,
    queryFn: async () => {
      const result = await getRoomsForHousekeeping();
      if (!result.success) throw new Error(result.error);
      return result.data ?? [];
    },
    staleTime: 20 * 1000,
    retry: 0,
  });

  const statusMutation = useMutation({
    mutationFn: ({ roomId }: { roomId: string }) =>
      updateRoomStatus({ roomId, status: "CLEAN" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: HOUSEKEEPING_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["rooms", "sync"] });
      broadcastRoomStatusChange();
      toast.success("Pokój oznaczony jako posprzątany");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const allRooms = rooms ?? [];

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
        <h1 className="text-2xl font-semibold">Tryb sprzątania</h1>
        <p className="text-muted-foreground">Ładowanie…</p>
      </div>
    );
  }

  if (isError && error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
        <h1 className="text-2xl font-semibold">Tryb sprzątania</h1>
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
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Tryb sprzątania</h1>
        {online ? (
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Wifi className="h-4 w-4" />
            Online
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-sm text-amber-600">
            <WifiOff className="h-4 w-4" />
            Brak sieci
          </span>
        )}
      </div>

      <p className="mb-6 text-muted-foreground">
        Pokoje do posprzątania. Kliknij „Posprzątane”, gdy pokój jest gotowy. Zmiana pojawi się w Housekeeping.
      </p>

      {allRooms.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-green-300 bg-green-50/50 p-12 text-center">
          <CheckCircle2 className="mb-4 h-16 w-16 text-green-600" />
          <p className="text-lg font-medium text-green-800">Brak pokoi</p>
          <p className="mt-1 text-sm text-green-700">Nie znaleziono pokoi w bazie.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3 md:gap-4 md:grid-cols-4">
          {allRooms.map((room) => {
            const needsCleaning = room.status === "DIRTY" || room.status === "INSPECTION";
            return (
              <div
                key={room.id}
                className={`flex flex-col items-center justify-between gap-2 rounded-xl border-2 p-3 shadow-sm min-h-[120px] md:gap-4 md:p-6 md:min-h-[140px] ${
                  needsCleaning
                    ? "border-amber-200 bg-amber-50/30"
                    : "border-green-200/80 bg-green-50/20"
                }`}
              >
                <span className="text-sm font-bold md:text-2xl">Pokój {room.number}</span>
                <span className="text-[10px] text-muted-foreground text-center line-clamp-2 md:text-sm">
                  {room.type}
                </span>
                <Button
                  type="button"
                  size="lg"
                  variant={needsCleaning ? "default" : "outline"}
                  className={`h-10 w-full text-xs font-semibold touch-manipulation md:h-14 md:text-lg ${
                    !needsCleaning ? "border-green-300 bg-green-50 text-green-800 hover:bg-green-100 hover:text-green-900" : ""
                  }`}
                  onClick={() => statusMutation.mutate({ roomId: room.id })}
                  disabled={statusMutation.isPending}
                >
                  {needsCleaning ? (
                    <>
                      <Circle className="mr-1 h-4 w-4 shrink-0 md:mr-2 md:h-6 md:w-6" strokeWidth={2.5} />
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
    </div>
  );
}
