"use client";

import { useMemo, useState } from "react";
import { useTapeChartStore } from "@/lib/store/tape-chart-store";
import {
  ChevronLeft,
  ChevronRight,
  PlaneLanding,
  PlaneTakeoff,
  Sparkles,
  Wrench,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Room, Reservation, RoomStatus } from "@/lib/tape-chart-types";
import {
  getRoomStateForDay,
  getOccupancyForDay,
  getHeatmapLevel,
  groupRoomsByFloor,
  maskGuestName,
  RESERVATION_STATUS_LABELS,
  type RoomTileState,
} from "@/lib/vertical-timeline-utils";
import { RoomStatusIcon } from "@/components/tape-chart/room-status-icon";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

const WEEKDAY_SHORT: Record<number, string> = {
  0: "Nd",
  1: "Pn",
  2: "Wt",
  3: "Śr",
  4: "Cz",
  5: "Pt",
  6: "So",
};

const MONTH_SHORT: Record<number, string> = {
  0: "Sty",
  1: "Lut",
  2: "Mar",
  3: "Kwi",
  4: "Maj",
  5: "Cze",
  6: "Lip",
  7: "Sie",
  8: "Wrz",
  9: "Paź",
  10: "Lis",
  11: "Gru",
};

const MONTH_FULL: Record<number, string> = {
  0: "Styczeń",
  1: "Luty",
  2: "Marzec",
  3: "Kwiecień",
  4: "Maj",
  5: "Czerwiec",
  6: "Lipiec",
  7: "Sierpień",
  8: "Wrzesień",
  9: "Październik",
  10: "Listopad",
  11: "Grudzień",
};

function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const w = d.getDay();
  const day = d.getDate();
  const month = d.getMonth();
  return `${WEEKDAY_SHORT[w]}, ${day} ${MONTH_SHORT[month]}`;
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, delta: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + delta);
  return out;
}

function addMonths(d: Date, delta: number): Date {
  const out = new Date(d);
  out.setMonth(out.getMonth() + delta);
  return out;
}

/** Siatka miesiąca: Pn–Nd, puste na początku. Dopełniona do wielokrotności 7. */
function getCalendarGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startDow = first.getDay();
  const emptyStart = startDow === 0 ? 6 : startDow - 1;
  const grid: (Date | null)[] = [];
  for (let i = 0; i < emptyStart; i++) grid.push(null);
  const d = new Date(first);
  while (d <= last) {
    grid.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  const remainder = grid.length % 7;
  if (remainder !== 0) {
    for (let i = 0; i < 7 - remainder; i++) grid.push(null);
  }
  return grid;
}

const HEATMAP_CLASSES: Record<string, string> = {
  red: "bg-red-500 text-white",
  yellow: "bg-amber-400 text-gray-900",
  orange: "bg-orange-400 text-gray-900",
  green: "bg-green-500 text-white",
};

/** Kalendarz miesięczny z heatmapą obłożenia – rozwijany pod nagłówkiem (ok. pół ekranu). */
function CalendarHeatmapDropdown({
  open,
  onClose,
  displayedMonth,
  onPrevMonth,
  onNextMonth,
  selectedDateStr,
  rooms,
  reservations,
  onSelectDay,
}: {
  open: boolean;
  onClose: () => void;
  displayedMonth: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  selectedDateStr: string;
  rooms: Room[];
  reservations: Reservation[];
  onSelectDay: (date: Date) => void;
}) {
  if (!open) return null;

  const year = displayedMonth.getFullYear();
  const month = displayedMonth.getMonth();
  const grid = getCalendarGrid(year, month);

  return (
    <div className="absolute left-0 right-0 top-full z-20 border-b border-border bg-card shadow-lg">
      <div className="max-h-[50vh] overflow-y-auto p-3">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background hover:bg-accent"
            onClick={onPrevMonth}
            aria-label="Poprzedni miesiąc"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold">
            {MONTH_FULL[month]} {year}
          </span>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background hover:bg-accent"
            onClick={onNextMonth}
            aria-label="Następny miesiąc"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-0.5 text-center text-xs">
          {["Pn", "Wt", "Śr", "Cz", "Pt", "So", "Nd"].map((day) => (
            <div key={day} className="py-1 font-medium text-muted-foreground">
              {day}
            </div>
          ))}
          {grid.map((cell, i) => {
            if (cell === null) {
              return <div key={`empty-${i}`} className="aspect-square" />;
            }
            const dateStr = toDateStr(cell);
            const occupancy = getOccupancyForDay(dateStr, rooms, reservations);
            const level = getHeatmapLevel(occupancy);
            const isSelected = dateStr === selectedDateStr;
            return (
              <button
                key={dateStr}
                type="button"
                className={cn(
                  "flex aspect-square items-center justify-center rounded-full text-xs font-medium transition-opacity hover:opacity-90",
                  HEATMAP_CLASSES[level],
                  isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background"
                )}
                onClick={() => {
                  onSelectDay(cell);
                  onClose();
                }}
                title={`${dateStr} – obłożenie ${Math.round(occupancy * 100)}%`}
              >
                {cell.getDate()}
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1" title="Dużo wolnego">
            <span className="h-2.5 w-2.5 rounded-full bg-green-500" aria-hidden />{" "}
            &lt;50% obłożenia
          </span>
          <span className="flex items-center gap-1" title="Średnie obłożenie">
            <span className="h-2.5 w-2.5 rounded-full bg-orange-400" aria-hidden /> 50–90%
          </span>
          <span className="flex items-center gap-1" title="Ostatnie wolne">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" aria-hidden /> &gt;90%
          </span>
          <span className="flex items-center gap-1" title="Brak miejsc">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500" aria-hidden /> 100%
          </span>
        </div>
      </div>
    </div>
  );
}

/** Kafelek: Przyjazd (niebieski, ikona lądowania) */
function TileArrival({
  reservation,
  privacyMode,
  roomDirty,
}: {
  reservation: Reservation;
  privacyMode: boolean;
  roomDirty: boolean;
}) {
  const name = privacyMode ? maskGuestName(reservation.guestName) : reservation.guestName;
  const statusLabel = RESERVATION_STATUS_LABELS[reservation.status] ?? reservation.status;
  const saldo = reservation.rateCodePrice ?? 0;

  return (
    <div className="relative flex flex-1 flex-col gap-0.5 rounded-lg border-2 border-blue-800 bg-blue-600 p-2.5 text-white">
      {roomDirty && (
        <span className="absolute right-1.5 top-1.5 text-blue-200" title="Do sprzątania">
          <Wrench className="h-4 w-4" />
        </span>
      )}
      <div className="flex items-center gap-1.5">
        <PlaneLanding className="h-4 w-4 shrink-0" aria-hidden />
        <span className="truncate font-medium">{name}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs opacity-95">
        <span>{statusLabel}</span>
        {saldo > 0 && <span>Saldo: {saldo} PLN</span>}
      </div>
    </div>
  );
}

/** Kafelek: Pobyt (środek) – krawędzie „poszarpane” / ikony << >> */
function TileStay({
  reservation,
  privacyMode,
  roomDirty,
}: {
  reservation: Reservation;
  privacyMode: boolean;
  roomDirty: boolean;
}) {
  const name = privacyMode ? maskGuestName(reservation.guestName) : reservation.guestName;
  const statusLabel = RESERVATION_STATUS_LABELS[reservation.status] ?? reservation.status;
  const saldo = reservation.rateCodePrice ?? 0;

  return (
    <div className="relative flex flex-1 flex-col gap-0.5 rounded-lg border-2 border-blue-800 bg-blue-600 p-2.5 text-white">
      {roomDirty && (
        <span className="absolute right-1.5 top-1.5 text-blue-200" title="Do sprzątania">
          <Wrench className="h-4 w-4" />
        </span>
      )}
      <div className="flex items-center justify-between gap-1">
        <span className="text-[10px] opacity-80">«</span>
        <span className="truncate font-medium">{name}</span>
        <span className="text-[10px] opacity-80">»</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs opacity-95">
        <span>{statusLabel}</span>
        {saldo > 0 && <span>Saldo: {saldo} PLN</span>}
      </div>
    </div>
  );
}

/** Kafelek: Wolny (przerywany obrys, cena, wolne noce) */
function TileGap({
  freeNights,
  price,
}: {
  freeNights?: number;
  price?: number;
}) {
  const nightsText =
    freeNights === undefined
      ? "Wolny"
      : freeNights === 1
        ? "Wolny: tylko 1 noc"
        : `Wolny: ${freeNights} noce`;

  return (
    <div className="flex flex-1 flex-col gap-0.5 rounded-lg border-2 border-dashed border-muted-foreground/40 bg-muted/50 p-2.5 text-muted-foreground">
      <span className="font-medium">{nightsText}</span>
      {price != null && price > 0 && <span className="text-xs">{price} PLN</span>}
    </div>
  );
}

/** Kafelek: Wyjazd (szary, ikona odlotu) */
function TileDeparture({
  reservation,
  privacyMode,
  label = "do 11:00",
}: {
  reservation: Reservation;
  privacyMode: boolean;
  label?: string;
}) {
  const name = privacyMode ? maskGuestName(reservation.guestName) : reservation.guestName;

  return (
    <div className="flex flex-1 flex-col gap-0.5 rounded-lg border border-slate-500 bg-slate-600 p-2.5 text-white">
      <div className="flex items-center gap-1.5">
        <PlaneTakeoff className="h-4 w-4 shrink-0" aria-hidden />
        <span className="truncate text-sm font-medium">{name}</span>
      </div>
      <span className="text-xs opacity-90">{label}</span>
    </div>
  );
}

/** Wiersz: Mijanka (wyjazd | sprzątanie | przyjazd) */
function RowChangeover({
  departureRes,
  arrivalRes,
  privacyMode,
}: {
  departureRes: Reservation;
  arrivalRes: Reservation;
  privacyMode: boolean;
}) {
  return (
    <div className="flex w-full items-stretch gap-1">
      <div className="min-w-0 flex-1">
        <TileDeparture reservation={departureRes} privacyMode={privacyMode} label="do 11:00" />
      </div>
      <div className="flex shrink-0 items-center justify-center rounded bg-muted px-1.5" title="Sprzątanie">
        <Sparkles className="h-5 w-5 text-amber-600" />
      </div>
      <div className="min-w-0 flex-1">
        <TileArrival
          reservation={arrivalRes}
          privacyMode={privacyMode}
          roomDirty={false}
        />
      </div>
    </div>
  );
}

/** Jedna sekcja piętra (zwijana) */
function FloorSection({
  floorLabel,
  rooms,
  dateStr,
  reservations,
  privacyMode,
  defaultExpanded = true,
}: {
  floorLabel: string;
  rooms: Room[];
  dateStr: string;
  reservations: Reservation[];
  privacyMode: boolean;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <section className="border-b border-border">
      <button
        type="button"
        className="flex w-full items-center justify-between bg-muted/40 px-3 py-2.5 text-left font-semibold text-foreground"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        <span>{floorLabel}. PIĘTRO</span>
        {expanded ? (
          <ChevronUp className="h-4 w-4 shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0" />
        )}
      </button>
      {expanded && (
        <div className="divide-y divide-border/60">
          {rooms.map((room) => {
            const state = getRoomStateForDay(room.number, dateStr, reservations);

            return (
              <div
                key={room.number}
                className="flex flex-col gap-1.5 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">Pokój {room.number}</span>
                  <span className="text-xs text-muted-foreground">{room.type}</span>
                  <RoomStatusIcon
                    status={room.status as RoomStatus}
                    showLabel={false}
                    className="ml-auto shrink-0"
                  />
                </div>
                <RoomRowTile
                  state={state}
                  room={room}
                  privacyMode={privacyMode}
                />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function RoomRowTile({
  state,
  room,
  privacyMode,
}: {
  state: RoomTileState;
  room: Room;
  privacyMode: boolean;
}) {
  const roomDirty = room.status === "DIRTY" || room.status === "OOO" || room.status === "INSPECTION";

  if (state.type === "changeover" && state.departureRes && state.arrivalRes) {
    return (
      <RowChangeover
        departureRes={state.departureRes}
        arrivalRes={state.arrivalRes}
        privacyMode={privacyMode}
      />
    );
  }

  if (state.type === "arrival" && state.reservation) {
    return (
      <TileArrival
        reservation={state.reservation}
        privacyMode={privacyMode}
        roomDirty={roomDirty}
      />
    );
  }

  if (state.type === "stay" && state.reservation) {
    return (
      <TileStay
        reservation={state.reservation}
        privacyMode={privacyMode}
        roomDirty={roomDirty}
      />
    );
  }

  if (state.type === "departure" && state.reservation) {
    return (
      <TileDeparture
        reservation={state.reservation}
        privacyMode={privacyMode}
        label="do 11:00"
      />
    );
  }

  return (
    <TileGap
      freeNights={state.freeNights}
      price={room.price}
    />
  );
}

export interface FrontOfficeMobileTimelineProps {
  rooms: Room[];
  /** Opcjonalna początkowa data (YYYY-MM-DD). Domyślnie "dziś". Rezerwacje z useTapeChartStore. */
  initialDateStr?: string;
}

export function FrontOfficeMobileTimeline({
  rooms,
  initialDateStr,
}: FrontOfficeMobileTimelineProps) {
  const reservations = useTapeChartStore((s) => s.reservations);
  const today = useMemo(() => new Date(2026, 1, 7), []); // spójne z Tape Chart: 7 lut 2026
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    if (initialDateStr) {
      const d = new Date(initialDateStr + "T12:00:00");
      if (!Number.isNaN(d.getTime())) return d;
    }
    return new Date(today);
  });

  const [privacyMode, setPrivacyMode] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => new Date(selectedDate));

  const dateStr = toDateStr(selectedDate);
  const floors = useMemo(() => groupRoomsByFloor(rooms), [rooms]);

  const handlePrevDay = () => setSelectedDate((d) => addDays(d, -1));
  const handleNextDay = () => setSelectedDate((d) => addDays(d, 1));
  const handleDateClick = () => {
    setCalendarMonth(new Date(selectedDate));
    setCalendarOpen((o) => !o);
  };
  const handleSelectDay = (date: Date) => {
    setSelectedDate(date);
    setCalendarOpen(false);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      {/* Nagłówek sticky + kalendarz (dropdown na pół ekranu) */}
      <header className="sticky top-0 z-10 flex flex-col border-b border-border bg-card shadow-sm">
        <div className="flex flex-col gap-2 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-input bg-background hover:bg-accent"
              onClick={handlePrevDay}
              aria-label="Poprzedni dzień"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              className="min-w-0 flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-center text-sm font-medium hover:bg-accent"
              onClick={handleDateClick}
              aria-expanded={calendarOpen}
              aria-haspopup="dialog"
            >
              {formatDateDisplay(dateStr)}
            </button>
            <button
              type="button"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-input bg-background hover:bg-accent"
              onClick={handleNextDay}
              aria-label="Następny dzień"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="privacy-mobile"
              checked={privacyMode}
              onCheckedChange={setPrivacyMode}
            />
            <Label htmlFor="privacy-mobile" className="text-sm font-normal cursor-pointer">
              Tryb prywatności
            </Label>
          </div>
        </div>
        <div className="relative">
          <CalendarHeatmapDropdown
            open={calendarOpen}
            onClose={() => setCalendarOpen(false)}
            displayedMonth={calendarMonth}
            onPrevMonth={() => setCalendarMonth((m) => addMonths(m, -1))}
            onNextMonth={() => setCalendarMonth((m) => addMonths(m, 1))}
            selectedDateStr={dateStr}
            rooms={rooms}
            reservations={reservations}
            onSelectDay={handleSelectDay}
          />
        </div>
      </header>

      {/* Przewijana lista pokoi */}
      <div className="flex-1 overflow-y-auto">
        {[...floors.entries()].map(([floor, floorRooms]) => (
          <FloorSection
            key={floor}
            floorLabel={floor}
            rooms={floorRooms}
            dateStr={dateStr}
            reservations={reservations}
            privacyMode={privacyMode}
            defaultExpanded={true}
          />
        ))}
      </div>
    </div>
  );
}
