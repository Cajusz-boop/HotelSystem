"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from "@dnd-kit/core";
import { Undo2, Redo2, CalendarPlus, ChevronLeft, ChevronRight, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ReservationBarWithMenu } from "./reservation-bar-with-menu";
import { ReservationEditSheet } from "./reservation-edit-sheet";
import { CreateReservationSheet, type CreateReservationContext } from "./create-reservation-sheet";
import { RoomStatusIcon } from "./room-status-icon";
import { getDateRange } from "@/lib/tape-chart-data";
import { useTapeChartStore } from "@/lib/store/tape-chart-store";
import { moveReservation } from "@/app/actions/reservations";
import { getEffectivePricesBatch } from "@/app/actions/rooms";
import type { Room, Reservation } from "@/lib/tape-chart-types";
import { cn } from "@/lib/utils";

function RoomRowDroppable({
  room,
  rowIdx,
  dates,
  children,
  onCellClick,
}: {
  room: Room;
  rowIdx: number;
  dates: string[];
  children: React.ReactNode;
  onCellClick?: (roomNumber: string, dateStr: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `room-${room.number}` });
  return (
    <>
      <div
        ref={setNodeRef}
        data-testid={`room-row-${room.number}`}
        className={cn(
          "sticky left-0 z-[60] flex items-center gap-2 border-b border-r bg-card px-3 py-2",
          isOver && "bg-primary/10 ring-1 ring-primary"
        )}
        style={{
          gridColumn: 1,
          gridRow: rowIdx + 2,
          minHeight: ROW_HEIGHT_PX,
        }}
      >
        {children}
      </div>
      {dates.map((dateStr, colIdx) => (
        <div
          key={`cell-${room.number}-${colIdx}`}
          data-testid={`cell-${room.number}-${dateStr}`}
          data-cell
          role="button"
          tabIndex={0}
          className="cursor-grab active:cursor-grabbing border-b border-r bg-background hover:bg-muted/50 select-none"
          style={{
            gridColumn: colIdx + 2,
            gridRow: rowIdx + 2,
            minWidth: COLUMN_WIDTH_PX,
            minHeight: ROW_HEIGHT_PX,
          }}
          onClick={() => onCellClick?.(room.number, dateStr)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onCellClick?.(room.number, dateStr);
            }
          }}
        />
      ))}
    </>
  );
}

const COLUMN_WIDTH_PX = 64;
/** Wysokość rzędu – min. 56px dla Fitts's Law (większe strefy kliknięcia, mniej pomyłek) */
const ROW_HEIGHT_PX = 56;
const ROOM_LABEL_WIDTH_PX = 160;
const HEADER_ROW_PX = 40;
/** Margines wewnętrzny paska – 6px dla wyraźnej przerwy między sąsiednimi rezerwacjami */
const BAR_PADDING_PX = 6;

const WEEKDAY_SHORT: Record<number, string> = {
  0: "Nd",
  1: "Pn",
  2: "Wt",
  3: "Śr",
  4: "Cz",
  5: "Pt",
  6: "So",
};

function formatDateHeader(dateStr: string, todayStr: string): string {
  const d = new Date(dateStr + "Z");
  const w = d.getUTCDay();
  const day = d.getUTCDate();
  const month = d.getUTCMonth() + 1;
  const label = `${WEEKDAY_SHORT[w]} ${day}.${String(month).padStart(2, "0")}`;
  const isToday = dateStr === todayStr;
  return isToday ? `${label} •` : label;
}

const DAYS_VIEW = 60;

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

export function TapeChart({
  rooms,
  initialHighlightReservationId,
}: {
  rooms: Room[];
  initialHighlightReservationId?: string;
}) {
  const today = useMemo(() => new Date(2026, 1, 7), []); // Feb 7, 2026
  const todayStr = useMemo(() => {
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, [today]);

  const [viewStartDate, setViewStartDate] = useState<Date>(() => new Date(today));
  const [highlightedReservationId, setHighlightedReservationId] = useState<string | null>(
    () => initialHighlightReservationId ?? null
  );
  const dates = useMemo(() => {
    const end = addDays(viewStartDate, DAYS_VIEW);
    return getDateRange(viewStartDate, end);
  }, [viewStartDate]);

  const [goToDateOpen, setGoToDateOpen] = useState(false);
  const [goToDateValue, setGoToDateValue] = useState("");
  const handleGoToDate = () => {
    if (goToDateValue) {
      const d = new Date(goToDateValue + "T12:00:00");
      if (!Number.isNaN(d.getTime())) {
        setViewStartDate(d);
        setGoToDateOpen(false);
        setGoToDateValue("");
      }
    }
  };
  const handlePrev = () => {
    setViewStartDate(addDays(viewStartDate, -7));
  };
  const handleNext = () => {
    setViewStartDate(addDays(viewStartDate, 7));
  };
  const handlePrint = () => {
    window.print();
  };

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const didPanRef = useRef(false);

  const handleGridPointerDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target;
    if (!(target instanceof HTMLElement) || !target.closest("[data-cell]")) return;
    const ref = scrollContainerRef.current;
    if (!ref) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const startScrollLeft = ref.scrollLeft;
    const startScrollTop = ref.scrollTop;
    didPanRef.current = false;

    const onMove = (moveEv: MouseEvent) => {
      ref.scrollLeft = startScrollLeft + (startX - moveEv.clientX);
      ref.scrollTop = startScrollTop + (startY - moveEv.clientY);
      if (
        Math.abs(moveEv.clientX - startX) > 5 ||
        Math.abs(moveEv.clientY - startY) > 5
      ) {
        didPanRef.current = true;
      }
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    e.preventDefault();
  }, []);

  const reservations = useTapeChartStore((s) => s.reservations);
  const setReservations = useTapeChartStore((s) => s.setReservations);
  const undo = useTapeChartStore((s) => s.undo);
  const redo = useTapeChartStore((s) => s.redo);
  const canUndo = useTapeChartStore((s) => s.past.length > 0);
  const canRedo = useTapeChartStore((s) => s.future.length > 0);

  useEffect(() => {
    if (!initialHighlightReservationId || !scrollContainerRef.current) return;
    const res = reservations.find((r) => r.id === initialHighlightReservationId);
    if (res) {
      const d = new Date(res.checkIn + "Z");
      if (!Number.isNaN(d.getTime())) setViewStartDate(d);
    }
    const t = setTimeout(() => {
      const bar = scrollContainerRef.current?.querySelector(
        `[data-reservation-id="${initialHighlightReservationId}"]`
      );
      if (bar instanceof HTMLElement) {
        bar.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
      }
    }, 300);
    return () => clearTimeout(t);
  }, [initialHighlightReservationId, reservations]);

  const [privacyMode, setPrivacyMode] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [newReservationContext, setNewReservationContext] = useState<CreateReservationContext | null>(null);
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [effectivePricesMap, setEffectivePricesMap] = useState<Record<string, number>>({});

  useEffect(() => {
    if (reservations.length === 0) {
      setEffectivePricesMap({});
      return;
    }
    const requests = reservations.map((r) => ({ roomNumber: r.room, dateStr: r.checkIn }));
    getEffectivePricesBatch(requests).then(setEffectivePricesMap);
  }, [reservations]);

  const roomRowIndex = useMemo(() => {
    const map = new Map<string, number>();
    rooms.forEach((r, i) => map.set(r.number, i + 1));
    return map;
  }, [rooms]);

  const dateIndex = useMemo(() => {
    const map = new Map<string, number>();
    dates.forEach((d, i) => map.set(d, i));
    return map;
  }, [dates]);

  const reservationPlacements = useMemo(() => {
    return reservations
      .map((res) => {
        const row = roomRowIndex.get(res.room);
        if (row == null) return null;
        const startIdx = dateIndex.get(res.checkIn);
        let endIdx = dateIndex.get(res.checkOut);
        if (endIdx != null) endIdx = endIdx;
        else endIdx = dates.findIndex((d) => d >= res.checkOut);
        if (endIdx === -1) endIdx = dates.length;
        if (startIdx == null || startIdx >= endIdx) return null;
        return {
          reservation: res,
          gridRow: row + 1,
          gridColumnStart: startIdx + 2,
          gridColumnEnd: endIdx + 2,
          left: ROOM_LABEL_WIDTH_PX + startIdx * COLUMN_WIDTH_PX,
          width: (endIdx - startIdx) * COLUMN_WIDTH_PX,
          top: HEADER_ROW_PX + (row - 1) * ROW_HEIGHT_PX,
        };
      })
      .filter((p): p is NonNullable<typeof p> => p != null);
  }, [reservations, roomRowIndex, dateIndex, dates]);

  const roomByNumber = useMemo(() => new Map(rooms.map((r) => [r.number, r])), [rooms]);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      if (!over) return;
      const resId = active.id as string;
      const overId = over.id as string;
      if (!overId.startsWith("room-")) return;
      const newRoomNumber = overId.replace("room-", "");
      const targetRoom = roomByNumber.get(newRoomNumber);
      if (!targetRoom) return;

      // Room Guard: blokuj DIRTY i OOO – Toast
      if (targetRoom.status === "DIRTY" || targetRoom.status === "OOO") {
        toast.error(
          `Nie można przenieść rezerwacji na pokój ${targetRoom.number}. Status: ${targetRoom.status}${targetRoom.reason ? ` (${targetRoom.reason})` : ""}. Zmień status pokoju lub wybierz inny pokój.`
        );
        return;
      }

      const reservation = reservations.find((r) => r.id === resId);
      if (!reservation || reservation.room === newRoomNumber) return;

      const result = await moveReservation({ reservationId: resId, newRoomNumber });
      if (result.success && result.data) {
        const updated = result.data;
        setReservations((prev) =>
          prev.map((r) => (r.id === resId ? { ...r, room: updated.room } : r))
        );
      }
    },
    [setReservations, roomByNumber, reservations]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
      if (e.ctrlKey && e.key === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo]);

  /* Stała szerokość pierwszej kolumny (160px), żeby paski rezerwacji były dokładnie w kratkach. */
  /* Stała wysokość wiersza nagłówka (40px), żeby paski nie nachodziły na daty. */
  const gridColumns = `${ROOM_LABEL_WIDTH_PX}px repeat(${dates.length}, ${COLUMN_WIDTH_PX}px)`;
  const gridRows = `${HEADER_ROW_PX}px repeat(${rooms.length}, ${ROW_HEIGHT_PX}px)`;

  return (
    <div className="relative z-0 flex h-full flex-col">
      {/* Header – własny kontekst nakładania, zawsze nad siatką i overlayem */}
      <header className="relative z-[100] flex shrink-0 flex-wrap items-center justify-between gap-4 border-b bg-card px-6 py-4" role="toolbar" aria-label="Nawigacja grafiku" style={{ pointerEvents: "auto" }}>
        <h1 className="text-xl font-semibold">Grafik</h1>
        <div className="flex flex-wrap items-center gap-3">
          {/* Nawigacja w czasie (GAP 1.1) */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); handlePrev(); }}
              aria-label="Tydzień wstecz"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="inline-flex h-9 items-center justify-center gap-1 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleNext(); }}
              aria-label="Tydzień naprzód"
            >
              Naprz.
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="inline-flex h-9 items-center justify-center gap-1 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setGoToDateOpen((v) => !v); }}
              aria-label="Idź do daty"
            >
              <CalendarPlus className="h-4 w-4" />
              Data
            </button>
            {goToDateOpen && (
              <div className="flex items-center gap-1 rounded-md border bg-background px-2 py-1">
                <input
                  type="date"
                  value={goToDateValue}
                  onChange={(e) => setGoToDateValue(e.target.value)}
                  className="rounded border border-input bg-background px-2 py-1 text-sm"
                  aria-label="Wybierz datę"
                />
                <button type="button" className="inline-flex h-8 items-center justify-center rounded-md px-2 text-sm font-medium hover:bg-accent" onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleGoToDate(); }}>
                  Przejdź
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex h-9 items-center justify-center gap-1 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); handlePrint(); }}
              aria-label="Drukuj lub zapisz jako PDF"
            >
              <Printer className="h-4 w-4" />
              Drukuj / PDF
            </button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => undo()}
              disabled={!canUndo}
              className="gap-1.5"
              aria-label="Cofnij (Ctrl+Z)"
            >
              <Undo2 className="h-4 w-4" />
              Cofnij (Ctrl+Z)
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => redo()}
              disabled={!canRedo}
              className="gap-1.5"
              aria-label="Ponów (Ctrl+Y)"
            >
              <Redo2 className="h-4 w-4" />
              Ponów (Ctrl+Y)
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <label
              htmlFor="privacy-mode"
              className="text-sm font-medium text-muted-foreground"
            >
              Tryb prywatności
            </label>
            <Switch
              id="privacy-mode"
              checked={privacyMode}
              onCheckedChange={setPrivacyMode}
            />
          </div>
        </div>
      </header>

      {/* Grid wrapper – scrollable; przeciąganie komórki = przewijanie tabeli */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto p-6 cursor-grab active:cursor-grabbing"
      >
        <DndContext
          sensors={sensors}
          onDragStart={({ active }) => setActiveId(active.id as string)}
          onDragEnd={handleDragEnd}
        >
          <div
            className="relative inline-block w-max min-w-full"
            onMouseDown={handleGridPointerDown}
          >
            <div
              className="inline-grid w-max min-w-full"
              style={{
                gridTemplateColumns: gridColumns,
                gridTemplateRows: gridRows,
              }}
            >
            {/* Sticky corner cell – stała wysokość, żeby paski nie nachodziły na daty */}
            <div
              className="sticky left-0 top-0 z-[60] flex items-center border-b border-r bg-muted/50 px-3 py-2 text-sm font-medium"
              style={{ gridColumn: 1, gridRow: 1, minHeight: HEADER_ROW_PX, maxHeight: HEADER_ROW_PX }}
            >
              Pokój
            </div>

            {/* Sticky date headers */}
            {dates.map((dateStr, i) => (
              <div
                key={dateStr}
                className="sticky top-0 z-[60] flex items-center justify-center border-b bg-muted/50 px-2 py-2 text-center text-sm font-medium"
                style={{
                  gridColumn: i + 2,
                  gridRow: 1,
                  minWidth: COLUMN_WIDTH_PX,
                  minHeight: HEADER_ROW_PX,
                  maxHeight: HEADER_ROW_PX,
                }}
              >
                {formatDateHeader(dateStr, todayStr)}
              </div>
            ))}

            {/* Room rows: sticky first column (droppable) + day cells */}
            {rooms.map((room, rowIdx) => (
              <RoomRowDroppable
                key={room.number}
                room={room}
                rowIdx={rowIdx}
                dates={dates}
                onCellClick={(roomNumber, dateStr) => {
                  if (didPanRef.current) {
                    didPanRef.current = false;
                    return;
                  }
                  setNewReservationContext({ roomNumber, checkIn: dateStr });
                  setCreateSheetOpen(true);
                }}
              >
                <span className="font-medium">{room.number}</span>
                <span className="text-muted-foreground">{room.type}</span>
                <RoomStatusIcon status={room.status} showLabel />
              </RoomRowDroppable>
            ))}

            </div>
            {/* Reservation bars – overlay; overflow hidden, żeby paski nie wychodziły poza linie ani na daty */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 50 }}>
              <div className="relative w-full h-full pointer-events-none overflow-hidden">
                {reservationPlacements.map(({ reservation, left, width, top }) => {
                  const room = roomByNumber.get(reservation.room);
                  const priceKey = `${reservation.room}-${reservation.checkIn}`;
                  const pricePerNight =
                    reservation.rateCodePrice ??
                    effectivePricesMap[priceKey] ??
                    room?.price;
                  const nights = Math.round(
                    (new Date(reservation.checkOut).getTime() -
                      new Date(reservation.checkIn).getTime()) /
                      (24 * 60 * 60 * 1000)
                  );
                  const totalAmount =
                    pricePerNight != null && pricePerNight > 0
                      ? nights * pricePerNight
                      : undefined;
                  const barLeft = Math.round(left + BAR_PADDING_PX);
                  const barTop = Math.round(top + BAR_PADDING_PX);
                  const barWidth = Math.round(width - BAR_PADDING_PX * 2);
                  const barHeight = ROW_HEIGHT_PX - BAR_PADDING_PX * 2;
                  return (
                  <div
                    key={reservation.id}
                    className={cn(
                      "absolute pointer-events-auto cursor-grab active:cursor-grabbing overflow-hidden",
                      highlightedReservationId === reservation.id &&
                        "ring-2 ring-primary rounded-md z-10"
                    )}
                    data-highlighted-reservation={
                      highlightedReservationId === reservation.id ? "true" : undefined
                    }
                    style={{
                      left: barLeft,
                      top: barTop,
                      width: barWidth,
                      height: barHeight,
                      minHeight: barHeight,
                      maxHeight: barHeight,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (activeId !== reservation.id) {
                        setSelectedReservation(reservation);
                        setSheetOpen(true);
                        setHighlightedReservationId(null);
                      }
                    }}
                  >
                    <ReservationBarWithMenu
                      reservation={reservation}
                      gridRow={0}
                      gridColumnStart={0}
                      gridColumnEnd={0}
                      privacyMode={privacyMode}
                      isDragging={activeId === reservation.id}
                      pricePerNight={pricePerNight}
                      totalAmount={totalAmount}
                      onEdit={(r) => {
                        setSelectedReservation(r);
                        setSheetOpen(true);
                      }}
                      onStatusChange={(updated) => {
                        setReservations((prev) =>
                          prev.map((r) => (r.id === updated.id ? updated : r))
                        );
                      }}
                    />
                  </div>
                );
                })}
              </div>
            </div>
          </div>
        </DndContext>
      </div>
      <ReservationEditSheet
        reservation={selectedReservation}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        rooms={rooms}
        effectivePricePerNight={
          selectedReservation
            ? effectivePricesMap[`${selectedReservation.room}-${selectedReservation.checkIn}`] ??
              roomByNumber.get(selectedReservation.room)?.price
            : undefined
        }
        onSaved={(updated) => {
          setReservations((prev) =>
            prev.map((r) => (r.id === updated.id ? updated : r))
          );
        }}
      />
      <CreateReservationSheet
        context={newReservationContext}
        open={createSheetOpen}
        onOpenChange={setCreateSheetOpen}
        rooms={rooms}
        onCreated={(newRes) => {
          setReservations((prev) => [...prev, newRes]);
        }}
      />
    </div>
  );
}
