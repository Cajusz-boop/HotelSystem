"use client";

import { useMemo, useRef, useState, Fragment, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, CalendarPlus, Search, User, Bed, Users, Ban, CalendarDays, Printer } from "lucide-react";
import { getDateRange } from "@/lib/tape-chart-data";
import { useTapeChartStore } from "@/lib/store/tape-chart-store";
import { getEffectivePricesBatch } from "@/app/actions/rooms";
import { ReservationEditSheet } from "./reservation-edit-sheet";
import { CreateReservationSheet, type CreateReservationContext } from "./create-reservation-sheet";
import { GroupReservationSheet } from "./group-reservation-sheet";
import { RoomBlockSheet } from "./room-block-sheet";
import { MonthlyOverviewDialog } from "./monthly-overview-dialog";
import type { Room, Reservation, ReservationGroupSummary, ReservationStatus } from "@/lib/tape-chart-types";
import { cn } from "@/lib/utils";
import { shortGuestLabel } from "./reservation-bar";
import { createPortal } from "react-dom";

const MIN_COLUMN_WIDTH_PX = 64;
const BAR_POINT_DEPTH_PX = 10;
function barClipPath(widthPx: number): string {
  const pct = widthPx > 0 ? Math.min(12, (BAR_POINT_DEPTH_PX / widthPx) * 100) : 6;
  const r = (100 - pct).toFixed(1);
  const l = pct.toFixed(1);
  return `polygon(${l}% 0%, ${r}% 0%, 100% 50%, ${r}% 100%, ${l}% 100%, 0% 50%)`;
}
const ROW_HEIGHT_PX = 28;
const ROOM_LABEL_WIDTH_PX = 180;
const HEADER_ROW_PX = 48;
const BAR_PADDING_PX = 0;
/** Jak w Recepcji: stała liczba dni na osi czasu – siatka jest szeroka, da się przewijać w lewo/prawo */
const DAYS_VIEW = 60;

const WEEKDAY_PL: Record<number, string> = {
  0: "niedziela",
  1: "poniedziałek",
  2: "wtorek",
  3: "środa",
  4: "czwartek",
  5: "piątek",
  6: "sobota",
};

const MONTHS_PL = [
  "styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec",
  "lipiec", "sierpień", "wrzesień", "październik", "listopad", "grudzień",
];

/** Kolory pasków w stylu KWHotel Pro – Status rezerwacji / Źródła */
const KWHOTEL_STATUS_BG: Record<ReservationStatus, string> = {
  NO_SHOW: "rgb(185 28 28)",          // Klient nie przyjechał
  CHECKED_OUT: "rgb(71 85 105)",      // Pobyt zakończony
  CANCELLED: "rgb(55 65 81)",         // Zakończony
  CONFIRMED: "rgb(29 78 216)",        // Rezerwacja potwierdzona (dark blue)
  CHECKED_IN: "rgb(124 58 237)",      // Pobyt nierozliczony (violet)
};

function formatDateHeaderKwhotel(dateStr: string, todayStr: string): { weekday: string; day: number; isToday: boolean; isSunday: boolean } {
  const d = new Date(dateStr + "Z");
  const w = d.getUTCDay();
  const day = d.getUTCDate();
  const isToday = dateStr === todayStr;
  const isSunday = w === 0;
  return { weekday: WEEKDAY_PL[w], day, isToday, isSunday };
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

/** Pojemność pokoju do wyświetlenia (np. 2+2, 4+2) */
function roomCapacity(room: Room): string {
  if (room.type === "Suite") return "4+2";
  return "2+2";
}

export function KwhotelGrafik({
  rooms,
  reservationGroups,
}: {
  rooms: Room[];
  reservationGroups: ReservationGroupSummary[];
}) {
  const today = useMemo(() => new Date(2026, 1, 11), []); // 11 lutego 2026
  const todayStr = useMemo(() => {
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, [today]);

  const [viewStartDate, setViewStartDate] = useState<Date>(() => new Date(today));
  const viewStartDateStr = useMemo(() => viewStartDate.toISOString().slice(0, 10), [viewStartDate]);
  const [roomFilter, setRoomFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("--- Wszystkie ---");
  const [grouping, setGrouping] = useState(false);
  const [dayDivisionStyle, setDayDivisionStyle] = useState(false);
  const [groupReservationFilter, setGroupReservationFilter] = useState(false);
  const [moveWithoutShift, setMoveWithoutShift] = useState(true);
  const [rowHeightPx, setRowHeightPx] = useState(ROW_HEIGHT_PX);
  const [goToDateOpen, setGoToDateOpen] = useState(false);
  const [goToDateValue, setGoToDateValue] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [newReservationContext, setNewReservationContext] = useState<CreateReservationContext | null>(null);
  const [effectivePricesMap, setEffectivePricesMap] = useState<Record<string, number>>({});
  const [monthlyDialogOpen, setMonthlyDialogOpen] = useState(false);
  const [groupReservationSheetOpen, setGroupReservationSheetOpen] = useState(false);
  const [roomBlockSheetOpen, setRoomBlockSheetOpen] = useState(false);
  const [reservationSearchTerm, setReservationSearchTerm] = useState("");
  const [clientSearchTerm, setClientSearchTerm] = useState("");
  const [highlightedReservationId, setHighlightedReservationId] = useState<string | null>(null);
  const [hoveredBarRes, setHoveredBarRes] = useState<Reservation | null>(null);
  const [hoveredBarRect, setHoveredBarRect] = useState<DOMRect | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [allRooms, setAllRooms] = useState<Room[]>(rooms);
  const [groups, setGroups] = useState<ReservationGroupSummary[]>(reservationGroups);

  useEffect(() => setAllRooms(rooms), [rooms]);
  useEffect(() => setGroups(reservationGroups), [reservationGroups]);
  useEffect(() => () => { if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current); }, []);

  const gridWrapperRef = useRef<HTMLDivElement>(null);
  const roomFilterInputRef = useRef<HTMLInputElement>(null);
  const reservationSearchInputRef = useRef<HTMLInputElement>(null);
  const clientSearchInputRef = useRef<HTMLInputElement>(null);
  const setReservations = useTapeChartStore((s) => s.setReservations);

  const dates = useMemo(() => {
    const end = addDays(viewStartDate, DAYS_VIEW - 1);
    return getDateRange(viewStartDate, end);
  }, [viewStartDate]);

  const roomTypeOptions = useMemo(() => {
    const unique = new Set<string>();
    allRooms.forEach((room) => unique.add(room.type));
    return Array.from(unique).sort((a, b) => a.localeCompare(b, "pl"));
  }, [allRooms]);

  const filteredRooms = useMemo(() => {
    const query = roomFilter.trim().toLowerCase();
    let base = allRooms;
    if (groupFilter !== "--- Wszystkie ---") {
      base = base.filter((room) => room.type === groupFilter);
    }
    if (query) {
      base = base.filter(
        (room) => room.number.toLowerCase().includes(query) || room.type.toLowerCase().includes(query)
      );
    }
    const roomsSorted = grouping
      ? base
          .slice()
          .sort((a, b) =>
            a.type.localeCompare(b.type, "pl") !== 0
              ? a.type.localeCompare(b.type, "pl")
              : a.number.localeCompare(b.number, "pl", { numeric: true })
          )
      : base.slice();
    return roomsSorted;
  }, [allRooms, groupFilter, roomFilter, grouping]);

  const reservations = useTapeChartStore((s) => s.reservations);
  const visibleRoomNumbers = useMemo(() => new Set(filteredRooms.map((room) => room.number)), [filteredRooms]);

  const filteredReservations = useMemo(() => {
    const reservationQuery = reservationSearchTerm.trim().toLowerCase();
    const clientQuery = clientSearchTerm.trim().toLowerCase();
    return reservations.filter((reservation) => {
      if (!visibleRoomNumbers.has(reservation.room)) return false;
      if (groupReservationFilter && !reservation.groupId) return false;
      if (
        reservationQuery &&
        !(
          reservation.id.toLowerCase().includes(reservationQuery) ||
          reservation.room.toLowerCase().includes(reservationQuery) ||
          (reservation.groupName ?? "").toLowerCase().includes(reservationQuery)
        )
      ) {
        return false;
      }
      if (clientQuery && !reservation.guestName.toLowerCase().includes(clientQuery)) {
        return false;
      }
      return true;
    });
  }, [reservations, visibleRoomNumbers, groupReservationFilter, reservationSearchTerm, clientSearchTerm]);

  useEffect(() => {
    const reservationQuery = reservationSearchTerm.trim().toLowerCase();
    const clientQuery = clientSearchTerm.trim().toLowerCase();
    if (!reservationQuery && !clientQuery) {
      setHighlightedReservationId(null);
      return;
    }
    const match = filteredReservations.find((reservation) => {
      const matchesReservation =
        reservation.id.toLowerCase().includes(reservationQuery) ||
        reservation.room.toLowerCase().includes(reservationQuery) ||
        (reservation.groupName ?? "").toLowerCase().includes(reservationQuery);
      const matchesClient = reservation.guestName.toLowerCase().includes(clientQuery);
      return (!reservationQuery || matchesReservation) && (!clientQuery || matchesClient);
    });
    setHighlightedReservationId(match?.id ?? null);
  }, [reservationSearchTerm, clientSearchTerm, filteredReservations]);
  const roomRowIndex = useMemo(() => {
    const map = new Map<string, number>();
    filteredRooms.forEach((r, i) => map.set(r.number, i + 1));
    return map;
  }, [filteredRooms]);

  const dateIndex = useMemo(() => {
    const map = new Map<string, number>();
    dates.forEach((d, i) => map.set(d, i));
    return map;
  }, [dates]);

  useEffect(() => {
    if (filteredReservations.length === 0) {
      setEffectivePricesMap({});
      return;
    }
    const requests = filteredReservations.map((r) => ({ roomNumber: r.room, dateStr: r.checkIn }));
    getEffectivePricesBatch(requests).then(setEffectivePricesMap);
  }, [filteredReservations]);

  /** Stała szerokość kolumny dnia – timeline ma stałą szerokość, żeby zawsze dało się przewijać w lewo/prawo */
  const columnWidthPxForBars = MIN_COLUMN_WIDTH_PX;
  const totalGridWidthPx = ROOM_LABEL_WIDTH_PX + dates.length * MIN_COLUMN_WIDTH_PX;

  const STATUS_PL: Record<string, string> = {
    CONFIRMED: "Potwierdzona",
    CHECKED_IN: "Zameldowany",
    CHECKED_OUT: "Wymeldowany",
    CANCELLED: "Anulowana",
    NO_SHOW: "Nie przyjechał",
  };
  const PAYMENT_PL: Record<string, string> = {
    UNPAID: "Nieopłacona",
    PARTIAL: "Częściowo opłacona",
    PAID: "Opłacona",
  };

  function buildBarLabel(guestName: string, barWidthPx: number, res: Reservation): string {
    const short = shortGuestLabel(guestName, false).replace(",", "");
    const surname = short.split(" ")[0] ?? short;
    const initials = guestName
      .split(/[\s,]+/)
      .map((w) => w[0]?.toUpperCase())
      .filter(Boolean)
      .join("");
    const nights = Math.max(1, Math.ceil(
      (new Date(res.checkOut).getTime() - new Date(res.checkIn).getTime()) / (24 * 60 * 60 * 1000)
    ));
    const nightsStr = `${nights}n`;
    const price = effectivePricesMap[`${res.room}:${res.checkIn}`];
    const priceStr = price && price > 0 ? `${(price * nights).toFixed(0)}` : "";
    // Ultra-czytelny tryb: na wąskich paskach tylko kluczowe info, cena wyłącznie w tooltipie.
    if (barWidthPx < 52) return `${(initials || surname).slice(0, 2)} ${nightsStr}`;
    if (barWidthPx < 80) return `${surname.length > 8 ? `${surname.slice(0, 7)}…` : surname} ${nightsStr}`;
    if (barWidthPx < 120) return `${short} · ${nightsStr}`;
    if (barWidthPx < 170) return `${short} · ${nightsStr}`;
    return [short, nightsStr, priceStr ? `${priceStr} PLN` : ""].filter(Boolean).join(" · ");
  }

  function getContrastStyles(bg: string): { textColor: string; textShadow: string; chipBg: string } {
    const match = bg.match(/(\d+)\s+(\d+)\s+(\d+)/);
    if (!match) {
      return {
        textColor: "rgb(255 255 255)",
        textShadow: "0 1px 2px rgba(0,0,0,0.5), 0 0 1px rgba(0,0,0,0.3)",
        chipBg: "rgba(0,0,0,0.22)",
      };
    }
    const r = Number(match[1]) / 255;
    const g = Number(match[2]) / 255;
    const b = Number(match[3]) / 255;
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const darkText = luminance > 0.62;
    return darkText
      ? {
          textColor: "rgb(15 23 42)",
          textShadow: "0 1px 1px rgba(255,255,255,0.35)",
          chipBg: "rgba(255,255,255,0.55)",
        }
      : {
          textColor: "rgb(255 255 255)",
          textShadow: "0 1px 2px rgba(0,0,0,0.5), 0 0 1px rgba(0,0,0,0.3)",
          chipBg: "rgba(0,0,0,0.22)",
        };
  }

  function buildTooltipLines(res: Reservation): string[] {
    const lines: string[] = [
      `Gość: ${res.guestName}`,
      `Pokój: ${res.room}`,
      `Przyjazd: ${res.checkIn}${res.checkInTime ? ` ${res.checkInTime}` : ""}`,
      `Wyjazd: ${res.checkOut}${res.checkOutTime ? ` ${res.checkOutTime}` : ""}`,
      `Status: ${STATUS_PL[res.status] ?? res.status}`,
    ];
    if (res.pax) lines.push(`Osoby: ${res.pax}`);
    const src = res.rateCodeName ?? res.rateCode;
    if (src) lines.push(`Źródło: ${src}`);
    if (res.groupName) lines.push(`Grupa: ${res.groupName}`);
    if (res.vip) lines.push(`VIP`);
    if (res.paymentStatus) lines.push(`Płatność: ${PAYMENT_PL[res.paymentStatus] ?? res.paymentStatus}`);
    const price = effectivePricesMap[`${res.room}:${res.checkIn}`];
    if (price && price > 0) {
      const nights = Math.max(1, Math.ceil(
        (new Date(res.checkOut).getTime() - new Date(res.checkIn).getTime()) / (24 * 60 * 60 * 1000)
      ));
      lines.push(`Cena: ${price} PLN/noc × ${nights}n = ${(price * nights).toFixed(0)} PLN`);
    }
    if (res.notes) lines.push(`Uwagi: ${res.notes}`);
    return lines;
  }

  const reservationPlacements = useMemo(() => {
    return filteredReservations
      .map((res) => {
        const row = roomRowIndex.get(res.room);
        if (row == null) return null;
        const startIdx = dateIndex.get(res.checkIn);
        let endIdx = dateIndex.get(res.checkOut);
        if (endIdx == null) endIdx = dates.findIndex((d) => d >= res.checkOut);
        if (endIdx === -1) endIdx = dates.length;
        if (startIdx == null || startIdx >= endIdx) return null;
        return {
          reservation: res,
          gridRow: row + 1,
          gridColumnStart: startIdx + 2,
          gridColumnEnd: endIdx + 2,
          left: ROOM_LABEL_WIDTH_PX + startIdx * columnWidthPxForBars,
          width: (endIdx - startIdx) * columnWidthPxForBars,
          top: HEADER_ROW_PX + (row - 1) * rowHeightPx,
        };
      })
      .filter((p): p is NonNullable<typeof p> => p != null);
  }, [filteredReservations, roomRowIndex, dateIndex, dates, columnWidthPxForBars, rowHeightPx]);

  const roomByNumber = useMemo(() => new Map(allRooms.map((r) => [r.number, r])), [allRooms]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const didPanRef = useRef(false);

  const handlePrev = () => setViewStartDate((d) => addDays(d, -7));
  const handleNext = () => setViewStartDate((d) => addDays(d, 7));
  const handleToday = () => setViewStartDate(new Date(today));
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
  const handleGridPointerDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const scrollEl = scrollContainerRef.current;
    if (!scrollEl || !scrollEl.contains(target)) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const startScrollLeft = scrollEl.scrollLeft;
    const startScrollTop = scrollEl.scrollTop;
    didPanRef.current = false;
    const onMove = (moveEv: MouseEvent) => {
      scrollEl.scrollLeft = startScrollLeft + (startX - moveEv.clientX);
      scrollEl.scrollTop = startScrollTop + (startY - moveEv.clientY);
      if (Math.abs(moveEv.clientX - startX) > 5 || Math.abs(moveEv.clientY - startY) > 5) didPanRef.current = true;
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

  const handleCellClick = useCallback((roomNumber: string, dateStr: string) => {
    if (didPanRef.current) {
      didPanRef.current = false;
      return;
    }
    setNewReservationContext({ roomNumber, checkIn: dateStr });
    setCreateSheetOpen(true);
  }, []);
  const handleBarClick = useCallback((res: Reservation) => {
    setSelectedReservation(res);
    setSheetOpen(true);
  }, []);

  /** Klik na pasek: jeśli w kolumnie dnia wymeldowania → nowa rezerwacja (pokój wolny), inaczej → edycja */
  const handleBarOrCellClick = useCallback((reservation: Reservation, e: React.MouseEvent) => {
    const gridEl = gridWrapperRef.current;
    if (!gridEl) {
      handleBarClick(reservation);
      return;
    }
    const rect = gridEl.getBoundingClientRect();
    const colIdx = Math.floor((e.clientX - rect.left - ROOM_LABEL_WIDTH_PX) / MIN_COLUMN_WIDTH_PX);
    const clickedDate = dates[Math.max(0, Math.min(colIdx, dates.length - 1))];
    if (clickedDate === reservation.checkOut) {
      handleCellClick(reservation.room, reservation.checkOut);
    } else {
      handleBarClick(reservation);
    }
  }, [dates, handleBarClick, handleCellClick]);
  const handleZarezerwuj = () => {
    const defaultRoom = filteredRooms[0] ?? allRooms[0];
    if (defaultRoom) {
      setNewReservationContext({
        roomNumber: defaultRoom.number,
        checkIn: viewStartDateStr,
      });
    } else {
      setNewReservationContext(null);
    }
    setCreateSheetOpen(true);
  };
  const handleWidokMiesieczny = () => {
    setMonthlyDialogOpen(true);
  };
  const handleWyszukajPokoj = () => {
    roomFilterInputRef.current?.focus();
  };
  const handleZnajdzRezerwacje = () => {
    reservationSearchInputRef.current?.focus();
  };
  const handleSzukajKlienta = () => {
    clientSearchInputRef.current?.focus();
  };
  const handlePodglad = () => window.print();
  const handleWyłączPokoj = () => setRoomBlockSheetOpen(true);
  const handleMonthlySelect = (dateStr: string) => {
    const next = new Date(dateStr + "T12:00:00");
    if (!Number.isNaN(next.getTime())) {
      setViewStartDate(next);
    }
    setMonthlyDialogOpen(false);
  };
  const handleGroupReservationCreated = (newReservations: Reservation[], group: { id: string; name?: string }) => {
    setReservations((prev) => [...prev, ...newReservations]);
    setGroups((prev) => {
      const existing = prev.find((g) => g.id === group.id);
      if (existing) {
        return prev.map((g) =>
          g.id === group.id
            ? { ...g, reservationCount: g.reservationCount + newReservations.length }
            : g
        );
      }
      return [
        { id: group.id, name: group.name ?? null, reservationCount: newReservations.length },
        ...prev,
      ];
    });
  };
  const handleRoomBlockCreated = (block: { id: string; roomNumber: string; startDate: string; endDate: string; reason?: string }) => {
    setAllRooms((prevRooms) =>
      prevRooms.map((room) =>
        room.number === block.roomNumber
          ? { ...room, blocks: [...(room.blocks ?? []), block] }
          : room
      )
    );
  };
  const handleRoomBlockDeleted = (blockId: string) => {
    setAllRooms((prevRooms) =>
      prevRooms.map((room) => ({
        ...room,
        blocks: room.blocks?.filter((block) => block.id !== blockId),
      }))
    );
  };

  const viewMonth = viewStartDate.getMonth();
  const viewYear = viewStartDate.getFullYear();
  const monthYearLabel = `${MONTHS_PL[viewMonth]} ${viewYear}`;

  const gridColumns = `${ROOM_LABEL_WIDTH_PX}px repeat(${dates.length}, ${MIN_COLUMN_WIDTH_PX}px)`;
  const gridRows = `${HEADER_ROW_PX}px repeat(${filteredRooms.length}, ${rowHeightPx}px)`;

  return (
    <div className="relative z-0 flex h-full flex-col bg-[#f5f5f5]">
      {/* Nagłówek – tytuł Grafik w stylu KWHotel */}
      <header className="relative z-[100] flex shrink-0 items-center justify-between border-b border-[#d4d4d4] bg-white px-4 py-3 shadow-sm">
        <h1 className="text-lg font-semibold text-gray-800">Grafik – Recepcja Kwhotel</h1>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Lewy panel – Filtr grup pokoi + lista pokoi */}
        <aside className="w-[200px] shrink-0 border-r border-[#d4d4d4] bg-white p-3">
          <label className="mb-1 block text-xs font-medium text-gray-600">Filtr grup pokoi</label>
          <select
            value={groupFilter}
            onChange={(e) => setGroupFilter(e.target.value)}
            className="mb-4 w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="--- Wszystkie ---">--- Wszystkie ---</option>
            {roomTypeOptions.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <div className="flex flex-col gap-0.5 overflow-y-auto max-h-[calc(100vh-220px)]">
            {filteredRooms.map((room) => (
              <div
                key={room.number}
                className="flex items-baseline justify-between gap-2 py-0.5 text-sm"
              >
                <span className="font-semibold text-[13px] text-gray-800">{room.number}</span>
                <span className="text-gray-500 text-xs">{roomCapacity(room)}</span>
              </div>
            ))}
          </div>
          {groups.length > 0 && (
            <div className="mt-4 border-t border-gray-200 pt-3">
              <p className="mb-1 text-xs font-semibold text-gray-600">Rezerwacje grupowe</p>
              <div className="flex max-h-40 flex-col gap-0.5 overflow-y-auto pr-1 text-xs text-gray-700">
                {groups.map((group) => (
                  <span key={group.id} className="flex items-center justify-between gap-2">
                    <span className="truncate">{group.name ?? "Bez nazwy"}</span>
                    <span className="text-gray-500">{group.reservationCount}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* Główny obszar – siatka dat + paski rezerwacji (pełna szerokość) */}
        <div className="flex-1 flex flex-col min-w-0">
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-auto p-4 cursor-grab active:cursor-grabbing"
            onMouseDown={handleGridPointerDown}
          >
            <div
              ref={gridWrapperRef}
              className="inline-block"
              style={{ width: totalGridWidthPx }}
            >
              {/* Nagłówek miesiąca */}
              <div className="mb-2 text-center text-base font-semibold text-gray-800">
                {monthYearLabel}
              </div>

              <div
                className="grid"
                style={{
                  gridTemplateColumns: gridColumns,
                  gridTemplateRows: gridRows,
                  width: totalGridWidthPx,
                }}
              >
                {/* Lewy górny róg */}
                <div
                  className="sticky left-0 top-0 z-[60] border-b border-r border-[#93c5fd] bg-[#f8fafc] px-2 py-2 text-sm font-medium text-gray-700"
                  style={{ gridColumn: 1, gridRow: 1, minHeight: HEADER_ROW_PX }}
                >
                  Pokój
                </div>

                {/* Nagłówki dat – dzień tygodnia + numer */}
                {dates.map((dateStr, i) => {
                  const { weekday, day, isToday, isSunday } = formatDateHeaderKwhotel(dateStr, todayStr);
                  return (
                    <div
                      key={dateStr}
                      className={cn(
                        "sticky top-0 z-[60] flex flex-col items-center justify-center border-b border-r border-[#93c5fd] px-1 py-2 text-center text-xs min-w-0",
                        isToday && "bg-[#fef08a] font-semibold",
                        isSunday && !isToday && "bg-[#fed7aa]"
                      )}
                      style={{
                        gridColumn: i + 2,
                        gridRow: 1,
                        minHeight: HEADER_ROW_PX,
                      }}
                    >
                      <span className="text-[10px] text-gray-600 truncate w-full">{weekday}</span>
                      <span>{day}</span>
                    </div>
                  );
                })}

                {/* Wiersze pokoi – etykieta + komórki (klikalne) */}
                {filteredRooms.map((room, rowIdx) => (
                  <Fragment key={room.number}>
                    <div
                      className={cn(
                        "sticky left-0 z-[50] flex items-center gap-1.5 border-b border-r border-[#93c5fd] px-1.5 py-1 text-xs",
                        rowIdx % 2 === 1 ? "bg-slate-50" : "bg-white"
                      )}
                      style={{
                        gridColumn: 1,
                        gridRow: rowIdx + 2,
                        minHeight: rowHeightPx,
                      }}
                    >
                      <span className="font-semibold text-[13px] text-gray-800">{room.number}</span>
                      <span className="text-gray-500 text-[9px]">{roomCapacity(room)}</span>
                    </div>
                    {dates.map((dateStr, colIdx) => (
                      <div
                        key={`${room.number}-${colIdx}`}
                        role="button"
                        tabIndex={0}
                        data-cell
                        className={cn(
                          "cursor-pointer border-b border-r border-[#93c5fd] hover:bg-blue-50/50 min-w-0",
                          rowIdx % 2 === 1 ? "bg-slate-50" : "bg-white",
                          room.blocks?.some(
                            (block) => dateStr >= block.startDate && dateStr <= block.endDate
                          ) && "cursor-not-allowed bg-red-50 hover:bg-red-100"
                        )}
                        style={{
                          gridColumn: colIdx + 2,
                          gridRow: rowIdx + 2,
                          minHeight: rowHeightPx,
                        }}
                        onClick={() => {
                          const blocked = room.blocks?.some(
                            (block) => dateStr >= block.startDate && dateStr <= block.endDate
                          );
                          if (blocked) return;
                          handleCellClick(room.number, dateStr);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            const blocked = room.blocks?.some(
                              (block) => dateStr >= block.startDate && dateStr <= block.endDate
                            );
                            if (blocked) return;
                            handleCellClick(room.number, dateStr);
                          }
                        }}
                        title={
                          room.blocks?.find(
                            (block) => dateStr >= block.startDate && dateStr <= block.endDate
                          )?.reason ?? undefined
                        }
                      />
                    ))}
                  </Fragment>
                ))}
              </div>

              {/* Overlay – paski rezerwacji (klikalne: edycja / meldunek) */}
              <div
                className="relative pointer-events-none overflow-hidden w-full"
                style={{
                  marginTop: -((HEADER_ROW_PX + filteredRooms.length * rowHeightPx)),
                  height: HEADER_ROW_PX + filteredRooms.length * rowHeightPx,
                }}
              >
                <div className="absolute inset-0 pointer-events-none">
                  {reservationPlacements.map(({ reservation, left, width, top }) => {
                    const bg = KWHOTEL_STATUS_BG[reservation.status] ?? KWHOTEL_STATUS_BG.CONFIRMED;
                    const contrast = getContrastStyles(bg);
                    const padH = dayDivisionStyle ? BAR_PADDING_PX : 0;
                    const barLeft = Math.round(left + padH);
                    const barTop = Math.round(top) - (top > HEADER_ROW_PX ? 1 : 0);
                    const barWidth = Math.max(0, Math.round(width - padH * 2));
                    const barHeight = rowHeightPx + 2;
                    const label = buildBarLabel(reservation.guestName, barWidth, reservation);
                    const labelSizeClass =
                      barWidth < 56 ? "text-[10px]" : barWidth < 92 ? "text-[11px]" : "text-[12px]";
                    return (
                      <div
                        key={reservation.id}
                        role="button"
                        tabIndex={0}
                        data-reservation-id={reservation.id}
                        className={cn(
                          "absolute pointer-events-auto cursor-pointer overflow-hidden flex items-center justify-center leading-[1.05] font-bold shadow-sm border border-white/25 transition-transform duration-100 hover:z-50 hover:scale-y-[1.35] hover:scale-x-[1.02]",
                          labelSizeClass,
                          highlightedReservationId === reservation.id && "ring-2 ring-yellow-300"
                        )}
                        style={{
                          left: barLeft,
                          top: barTop,
                          width: barWidth,
                          height: barHeight,
                          backgroundColor: bg,
                          clipPath: barClipPath(barWidth),
                          WebkitClipPath: barClipPath(barWidth),
                          color: contrast.textColor,
                          textShadow: contrast.textShadow,
                          transformOrigin: "center center",
                        }}
                        onMouseEnter={(e) => {
                          if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
                          const el = e.currentTarget;
                          hoverTimerRef.current = window.setTimeout(() => {
                            setHoveredBarRes(reservation);
                            setHoveredBarRect(el.getBoundingClientRect());
                          }, 250);
                        }}
                        onMouseLeave={() => {
                          if (hoverTimerRef.current) { clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null; }
                          setHoveredBarRes(null);
                          setHoveredBarRect(null);
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBarOrCellClick(reservation, e);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleBarClick(reservation);
                          }
                        }}
                      >
                        <span
                          className="truncate px-1.5 tabular-nums rounded-sm max-w-full"
                          style={{ backgroundColor: barWidth >= 72 ? contrast.chipBg : "transparent" }}
                        >
                          {reservation.vip && <span className="text-yellow-300 mr-0.5">★</span>}
                          {label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Tooltip rezerwacji – portal */}
          {hoveredBarRes && hoveredBarRect && typeof document !== "undefined" && createPortal(
            <div
              className="fixed z-[200] max-w-[340px] rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-left shadow-xl pointer-events-none"
              style={{
                left: Math.max(8, Math.min(hoveredBarRect.left, window.innerWidth - 350)),
                top: hoveredBarRect.top > 200 ? hoveredBarRect.top - 8 : hoveredBarRect.bottom + 8,
                transform: hoveredBarRect.top > 200 ? "translateY(-100%)" : "none",
              }}
              role="tooltip"
            >
              <div className="space-y-0.5">
                {buildTooltipLines(hoveredBarRes).map((line, i) => (
                  <div
                    key={i}
                    className={cn(
                      "text-xs whitespace-nowrap",
                      i === 0 ? "font-bold text-gray-900" : "text-gray-700"
                    )}
                  >
                    {line}
                  </div>
                ))}
              </div>
            </div>,
            document.body
          )}

          {/* Stopka – nawigacja, akcje, filtry, legenda */}
          <footer className="shrink-0 border-t border-[#d4d4d4] bg-white px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleToday}
                  className="rounded border border-gray-300 bg-gray-50 px-3 py-1.5 text-sm font-medium hover:bg-gray-100"
                >
                  Dzisiaj
                </button>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="rounded border border-gray-300 p-1 hover:bg-gray-100"
                    aria-label="Tydzień wstecz"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="min-w-[140px] px-2 text-center text-sm">
                    {viewStartDate.getDate()} {MONTHS_PL[viewStartDate.getMonth()]} {viewStartDate.getFullYear()}
                  </span>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="rounded border border-gray-300 p-1 hover:bg-gray-100"
                    aria-label="Tydzień naprzód"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setGoToDateOpen((v) => !v)}
                  className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1.5 text-xs hover:bg-gray-50"
                  aria-label="Idź do daty"
                >
                  <CalendarPlus className="h-3.5 w-3.5" />
                  Idź do daty
                </button>
                {goToDateOpen && (
                  <div className="flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1">
                    <input
                      type="date"
                      value={goToDateValue}
                      onChange={(e) => setGoToDateValue(e.target.value)}
                      className="rounded border border-gray-200 px-2 py-1 text-sm"
                      aria-label="Wybierz datę"
                    />
                    <button
                      type="button"
                      onClick={handleGoToDate}
                      className="rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:opacity-90"
                    >
                      Przejdź
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-600">Liczba dni</label>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={DAYS_VIEW}
                    readOnly
                    title="Stały zakres 60 dni (jak w Recepcji) – przewijaj siatkę w lewo/prawo"
                    className="w-14 rounded border border-gray-300 bg-gray-50 px-2 py-1 text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-600">Wysokość</label>
                  <input
                    type="number"
                    min={32}
                    max={80}
                    value={rowHeightPx}
                    onChange={(e) => setRowHeightPx(Number(e.target.value) || ROW_HEIGHT_PX)}
                    className="w-14 rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={handleZarezerwuj} className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1.5 text-xs hover:bg-gray-50">
                  <CalendarPlus className="h-3.5 w-3.5" />
                  Zarezerwuj
                </button>
                <button
                  type="button"
                  onClick={() => setGroupReservationSheetOpen(true)}
                  className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1.5 text-xs hover:bg-gray-50"
                >
                  <Users className="h-3.5 w-3.5" />
                  Rezerwacja grupowa
                </button>
                <button
                  type="button"
                  onClick={handleWyłączPokoj}
                  className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1.5 text-xs hover:bg-gray-50"
                >
                  <Ban className="h-3.5 w-3.5" />
                  Wyłącz pokój
                </button>
                <button
                  type="button"
                  onClick={handleWidokMiesieczny}
                  className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1.5 text-xs hover:bg-gray-50"
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                  Widok miesięczny
                </button>
                <button type="button" onClick={handleWyszukajPokoj} className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1.5 text-xs hover:bg-gray-50">
                  <Bed className="h-3.5 w-3.5" />
                  Wyszukaj pokój
                </button>
                <button type="button" onClick={handleZnajdzRezerwacje} className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1.5 text-xs hover:bg-gray-50">
                  <Search className="h-3.5 w-3.5" />
                  Znajdź rezerwację
                </button>
                <button type="button" onClick={handleSzukajKlienta} className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1.5 text-xs hover:bg-gray-50">
                  <User className="h-3.5 w-3.5" />
                  Szukaj klienta
                </button>
                <button type="button" onClick={handlePodglad} className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1.5 text-xs hover:bg-gray-50">
                  <Printer className="h-3.5 w-3.5" />
                  Podgląd
                </button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4">
                <label className="inline-flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={grouping}
                    onChange={(e) => setGrouping(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  Grupowanie
                </label>
                <label className="inline-flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={dayDivisionStyle}
                    onChange={(e) => setDayDivisionStyle(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  Styl podziału dni
                </label>
                <label className="inline-flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={groupReservationFilter}
                    onChange={(e) => setGroupReservationFilter(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  Filtr rezerwacji grupowych
                </label>
                <label className="inline-flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={moveWithoutShift}
                    onChange={(e) => setMoveWithoutShift(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  Przenoszenie rez. bez &apos;Shift&apos;
                </label>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-600">Filtr pokoi</label>
                  <input
                    ref={roomFilterInputRef}
                    type="text"
                    value={roomFilter}
                    onChange={(e) => setRoomFilter(e.target.value)}
                    placeholder="np. 101"
                    className="w-24 rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-600">Znajdź rezerwację</label>
                  <input
                    ref={reservationSearchInputRef}
                    type="text"
                    value={reservationSearchTerm}
                    onChange={(e) => setReservationSearchTerm(e.target.value)}
                    placeholder="ID / pokój"
                    className="w-28 rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-600">Szukaj klienta</label>
                  <input
                    ref={clientSearchInputRef}
                    type="text"
                    value={clientSearchTerm}
                    onChange={(e) => setClientSearchTerm(e.target.value)}
                    placeholder="Nazwisko"
                    className="w-28 rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                </div>
              </div>

              {/* Legenda – Status rezerwacji */}
              <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-xs">
                <div className="font-semibold text-gray-700 mb-1.5">Status rezerwacji</div>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-block h-3 w-3 rounded-full bg-red-500" />
                    Klient nie przyjechał
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-block h-3 w-3 rounded-full bg-green-700" />
                    Zakończony nierozliczony
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-block h-3 w-3 rounded-full bg-gray-500" />
                    Pobyt zakończony
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-block h-3 w-3 rounded-full bg-black" />
                    Zakończony
                  </span>
                </div>
                <div className="font-semibold text-gray-700 mt-2 mb-1">Dodatkowy status</div>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-block h-3 w-3 rounded-full bg-pink-500" />
                    Pobyt nierozliczony
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-block h-3 w-3 rounded-full bg-purple-500" />
                    Pobyt + zaliczka
                  </span>
                </div>
                <div className="font-semibold text-gray-700 mt-2 mb-1">Źródła rezerwacji</div>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-block h-3 w-3 rounded-full bg-yellow-400" />
                    Rezerwacja wstępna
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-block h-3 w-3 rounded-full bg-green-400" />
                    Rezerwacja potwierdzona
                  </span>
                </div>
              </div>
            </div>
          </footer>
        </div>
      </div>

      <MonthlyOverviewDialog
        open={monthlyDialogOpen}
        onOpenChange={setMonthlyDialogOpen}
        reservations={reservations}
        rooms={allRooms}
        onSelectDate={handleMonthlySelect}
      />
      <GroupReservationSheet
        open={groupReservationSheetOpen}
        onOpenChange={setGroupReservationSheetOpen}
        rooms={allRooms}
        defaultDate={viewStartDateStr}
        onCreated={handleGroupReservationCreated}
      />
      <RoomBlockSheet
        open={roomBlockSheetOpen}
        onOpenChange={setRoomBlockSheetOpen}
        rooms={allRooms}
        onCreated={handleRoomBlockCreated}
        onDeleted={handleRoomBlockDeleted}
      />
      <ReservationEditSheet
        reservation={selectedReservation}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        rooms={allRooms}
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
        rooms={allRooms}
        onCreated={(newRes) => {
          setReservations((prev) => [...prev, newRes]);
          if (newRes.groupId) {
            const gid: string = newRes.groupId;
            setGroups((prev) => {
              const existing = prev.find((g) => g.id === gid);
              if (existing) {
                return prev.map((g) =>
                  g.id === gid ? { ...g, reservationCount: g.reservationCount + 1 } : g
                );
              }
              return [
                { id: gid, name: newRes.groupName ?? undefined, reservationCount: 1 },
                ...prev,
              ];
            });
          }
        }}
      />
    </div>
  );
}
