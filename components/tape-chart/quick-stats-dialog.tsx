"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Room, Reservation } from "@/lib/tape-chart-types";
import { LogIn, LogOut, SprayCan, BedDouble, DoorOpen } from "lucide-react";

export type QuickStatsTab = "arrivals" | "departures" | "dirty" | "checkedIn";

interface QuickStatsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab: QuickStatsTab;
  reservations: Reservation[];
  allRooms: Room[];
  todayStr: string;
}

const ROOM_STATUS_PL: Record<string, string> = {
  DIRTY: "Brudny",
  CLEAN: "Czysty",
  OOO: "Wyłączony",
  INSPECTION: "Do kontroli",
  INSPECTED: "Skontrolowany",
  CHECKOUT_PENDING: "Oczekuje wymeldowania",
  MAINTENANCE: "Konserwacja",
};

const RES_STATUS_PL: Record<string, string> = {
  CONFIRMED: "Potwierdzona",
  CHECKED_IN: "Zameldowany",
  CHECKED_OUT: "Wymeldowany",
  CANCELLED: "Anulowana",
  NO_SHOW: "No-show",
};

const TABS: { key: QuickStatsTab; label: string; icon: typeof LogIn }[] = [
  { key: "arrivals", label: "Przyjazdy", icon: LogIn },
  { key: "departures", label: "Wyjazdy", icon: LogOut },
  { key: "dirty", label: "Do sprzątania", icon: SprayCan },
  { key: "checkedIn", label: "Zameldowani", icon: BedDouble },
];

export function QuickStatsDialog({
  open,
  onOpenChange,
  initialTab,
  reservations,
  allRooms,
  todayStr,
}: QuickStatsDialogProps) {
  const [tab, setTab] = useState<QuickStatsTab>(initialTab);

  const arrivals = useMemo(
    () =>
      reservations
        .filter(
          (r) =>
            r.checkIn === todayStr &&
            r.status !== "CANCELLED" &&
            r.status !== "NO_SHOW"
        )
        .sort((a, b) => {
          const tA = a.checkInTime || "99:99";
          const tB = b.checkInTime || "99:99";
          if (tA !== tB) return tA.localeCompare(tB);
          return a.guestName.localeCompare(b.guestName);
        }),
    [reservations, todayStr]
  );

  const departures = useMemo(
    () =>
      reservations
        .filter(
          (r) =>
            r.checkOut === todayStr &&
            (r.status === "CHECKED_IN" || r.status === "CHECKED_OUT")
        )
        .sort((a, b) => {
          const tA = a.checkOutTime || "99:99";
          const tB = b.checkOutTime || "99:99";
          if (tA !== tB) return tA.localeCompare(tB);
          return a.guestName.localeCompare(b.guestName);
        }),
    [reservations, todayStr]
  );

  const dirtyRooms = useMemo(
    () => allRooms.filter((r) => r.status === "DIRTY").sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true })),
    [allRooms]
  );

  const checkedIn = useMemo(
    () =>
      reservations
        .filter((r) => r.status === "CHECKED_IN")
        .sort((a, b) => a.room.localeCompare(b.room, undefined, { numeric: true })),
    [reservations]
  );

  const counts: Record<QuickStatsTab, number> = {
    arrivals: arrivals.length,
    departures: departures.length,
    dirty: dirtyRooms.length,
    checkedIn: checkedIn.length,
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (v) setTab(initialTab);
      }}
    >
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-4 pt-4 pb-0">
          <DialogTitle className="text-base">Szybki podgląd</DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex border-b px-2 mt-2">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors",
                tab === key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
              <span
                className={cn(
                  "ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                  tab === key
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {counts[key]}
              </span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-3 min-h-[200px]">
          {tab === "arrivals" && (
            <ReservationList
              items={arrivals}
              emptyMsg="Brak przyjazdów na dziś"
              showTime="checkIn"
            />
          )}
          {tab === "departures" && (
            <ReservationList
              items={departures}
              emptyMsg="Brak wyjazdów na dziś"
              showTime="checkOut"
            />
          )}
          {tab === "dirty" && (
            <DirtyRoomsList rooms={dirtyRooms} />
          )}
          {tab === "checkedIn" && (
            <ReservationList
              items={checkedIn}
              emptyMsg="Brak zameldowanych gości"
              showTime={null}
              showDates
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReservationList({
  items,
  emptyMsg,
  showTime,
  showDates,
}: {
  items: Reservation[];
  emptyMsg: string;
  showTime: "checkIn" | "checkOut" | null;
  showDates?: boolean;
}) {
  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
        {emptyMsg}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {items.map((res) => {
        const time =
          showTime === "checkIn"
            ? res.checkInTime
            : showTime === "checkOut"
            ? res.checkOutTime
            : null;
        return (
          <div
            key={res.id}
            className={cn(
              "rounded-md border p-3 transition-colors hover:bg-muted/30",
              res.status === "CHECKED_IN" && "border-l-4 border-l-green-500",
              res.status === "CHECKED_OUT" && "border-l-4 border-l-slate-400",
              res.status === "CONFIRMED" && "border-l-4 border-l-blue-500"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm truncate">
                  {res.guestName}
                  {res.vip && (
                    <Badge variant="outline" className="ml-2 text-[9px] px-1 py-0 text-amber-600 border-amber-400">
                      VIP
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  <span className="flex items-center gap-1">
                    <DoorOpen className="h-3 w-3" />
                    Pokój {res.room}
                  </span>
                  {time && <span>• godz. {time}</span>}
                  {res.pax && res.pax > 1 && <span>• {res.pax} os.</span>}
                </div>
                {showDates && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {res.checkIn} → {res.checkOut}
                  </div>
                )}
                {res.notes && (
                  <div className="text-xs text-muted-foreground mt-1 italic truncate">
                    {res.notes}
                  </div>
                )}
              </div>
              <Badge
                variant={res.status === "CHECKED_IN" ? "default" : "secondary"}
                className="text-[10px] shrink-0"
              >
                {RES_STATUS_PL[res.status] ?? res.status}
              </Badge>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DirtyRoomsList({ rooms }: { rooms: Room[] }) {
  if (rooms.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
        Wszystkie pokoje czyste!
      </div>
    );
  }
  return (
    <div className="grid gap-2 grid-cols-2 sm:grid-cols-3">
      {rooms.map((room) => (
        <div
          key={room.number}
          className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 p-3 text-center"
        >
          <div className="text-lg font-bold text-amber-700 dark:text-amber-400">
            {room.number}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">{room.type}</div>
          {room.reason && (
            <div className="text-[10px] text-muted-foreground mt-1 italic truncate">
              {room.reason}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
