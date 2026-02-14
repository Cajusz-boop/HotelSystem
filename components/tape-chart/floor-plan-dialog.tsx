"use client";

import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Room, Reservation } from "@/lib/tape-chart-types";
import { RESERVATION_STATUS_BG } from "@/lib/tape-chart-types";

interface FloorPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rooms: Room[];
  reservations: Reservation[];
  todayStr: string;
  statusBg?: Record<string, string> | null;
}

/** Wyciąga numer piętra z numeru pokoju (np. "201" -> "2", "A12" -> "A") */
function extractFloor(roomNumber: string): string {
  const firstChar = roomNumber.charAt(0);
  if (/\d/.test(firstChar)) {
    return firstChar;
  }
  // Dla pokoi z literą na początku (np. "A1", "B2")
  return firstChar.toUpperCase();
}

const ROOM_STATUS_LABELS: Record<string, string> = {
  CLEAN: "Czysty",
  DIRTY: "Brudny",
  OOO: "Wyłączony",
  INSPECTION: "Do sprawdzenia",
  INSPECTED: "Sprawdzony",
  CHECKOUT_PENDING: "Oczekuje wymeldowania",
  MAINTENANCE: "Do naprawy",
};

export function FloorPlanDialog({
  open,
  onOpenChange,
  rooms,
  reservations,
  todayStr,
  statusBg,
}: FloorPlanDialogProps) {
  // Grupowanie pokoi wg piętra
  const roomsByFloor = useMemo(() => {
    const map = new Map<string, Room[]>();
    rooms.forEach((room) => {
      const floor = extractFloor(room.number);
      const existing = map.get(floor) || [];
      existing.push(room);
      map.set(floor, existing);
    });
    // Sortowanie pięter
    const sorted = Array.from(map.entries()).sort((a, b) =>
      a[0].localeCompare(b[0], undefined, { numeric: true })
    );
    // Sortowanie pokoi na każdym piętrze
    sorted.forEach(([, roomList]) => {
      roomList.sort((a, b) =>
        a.number.localeCompare(b.number, undefined, { numeric: true })
      );
    });
    return sorted;
  }, [rooms]);

  // Mapa: numer pokoju -> aktualna rezerwacja (checked-in dzisiaj)
  const currentOccupancy = useMemo(() => {
    const map = new Map<string, Reservation>();
    reservations.forEach((res) => {
      if (
        res.status === "CHECKED_IN" &&
        todayStr >= res.checkIn &&
        todayStr < res.checkOut
      ) {
        map.set(res.room, res);
      }
    });
    return map;
  }, [reservations, todayStr]);

  // Mapa: numer pokoju -> przyszła rezerwacja (potwierdzona, dziś zameldowanie)
  const todayArrivals = useMemo(() => {
    const map = new Map<string, Reservation>();
    reservations.forEach((res) => {
      if (res.status === "CONFIRMED" && res.checkIn === todayStr) {
        map.set(res.room, res);
      }
    });
    return map;
  }, [reservations, todayStr]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Plan pięter</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-2">
          {roomsByFloor.map(([floor, floorRooms]) => (
            <div key={floor}>
              <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
                Piętro {floor}
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {floorRooms.map((room) => {
                  const occupant = currentOccupancy.get(room.number);
                  const arrival = !occupant ? todayArrivals.get(room.number) : null;
                  const isOccupied = !!occupant;
                  const hasArrival = !!arrival;

                  // Kolor tła na podstawie statusu
                  let bgColor = "bg-muted/50";
                  let borderColor = "border-muted";
                  let statusLabel = ROOM_STATUS_LABELS[room.status] || room.status;

                  if (isOccupied) {
                    const resColor =
                      statusBg?.["CHECKED_IN"] || RESERVATION_STATUS_BG["CHECKED_IN"];
                    bgColor = "";
                    borderColor = "border-green-500";
                    statusLabel = "Zajęty";
                  } else if (room.status === "DIRTY") {
                    bgColor = "bg-orange-100 dark:bg-orange-900/30";
                    borderColor = "border-orange-400";
                  } else if (room.status === "OOO") {
                    bgColor = "bg-red-100 dark:bg-red-900/30";
                    borderColor = "border-red-400";
                  } else if (room.status === "CLEAN") {
                    bgColor = "bg-green-50 dark:bg-green-900/20";
                    borderColor = "border-green-300";
                  }

                  return (
                    <div
                      key={room.number}
                      className={cn(
                        "relative rounded-lg border-2 p-3 transition-colors",
                        bgColor,
                        borderColor
                      )}
                      style={
                        isOccupied
                          ? {
                              backgroundColor:
                                statusBg?.["CHECKED_IN"] ||
                                RESERVATION_STATUS_BG["CHECKED_IN"],
                            }
                          : undefined
                      }
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-lg font-bold">{room.number}</div>
                          <div className="text-xs text-muted-foreground">
                            {room.type}
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px]",
                            room.status === "CLEAN" && "border-green-500 text-green-700",
                            room.status === "DIRTY" && "border-orange-500 text-orange-700",
                            room.status === "OOO" && "border-red-500 text-red-700",
                            isOccupied && "border-white text-white"
                          )}
                        >
                          {statusLabel}
                        </Badge>
                      </div>

                      {isOccupied && occupant && (
                        <div className="mt-2 text-sm text-white/90">
                          <div className="font-medium truncate" title={occupant.guestName}>
                            {occupant.guestName}
                          </div>
                          <div className="text-xs opacity-75">
                            do {occupant.checkOut}
                          </div>
                        </div>
                      )}

                      {hasArrival && arrival && (
                        <div className="mt-2 text-sm">
                          <Badge variant="secondary" className="text-[10px]">
                            Przyjazd dziś
                          </Badge>
                          <div className="mt-1 text-xs text-muted-foreground truncate">
                            {arrival.guestName}
                          </div>
                        </div>
                      )}

                      {room.reason && room.status === "OOO" && (
                        <div className="mt-2 text-xs text-red-600 dark:text-red-400">
                          {room.reason}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {roomsByFloor.length === 0 && (
            <div className="py-8 text-center text-muted-foreground">
              Brak pokoi do wyświetlenia
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
