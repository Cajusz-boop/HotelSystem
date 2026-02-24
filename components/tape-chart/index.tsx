"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragMoveEvent,
  PointerSensor,
  type PointerSensorOptions,
  useSensor,
  useSensors,
  useDroppable,
} from "@dnd-kit/core";
import {
  Undo2,
  Redo2,
  CalendarPlus,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Printer,
  Users,
  Ban,
  Search,
  UserSearch,
  Eye,
  Layers,
  BedDouble,
  Waves,
  ListFilter,
  Filter,
  Hand,
  ZoomIn,
  ZoomOut,
  Building2,
  ListChecks,
  DoorOpen,
  AlertTriangle,
  ChevronDown,
  MoreHorizontal,
  SlidersHorizontal,
  LogIn,
  LogOut,
  SprayCan,
  Plus,
  RefreshCw,
  StickyNote,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ReservationBarWithMenu } from "./reservation-bar-with-menu";
import { RoomStatusIcon } from "./room-status-icon";
import { getDateRange } from "@/lib/tape-chart-data";
import { useTapeChartStore } from "@/lib/store/tape-chart-store";
import { moveReservation, updateReservation, updateReservationStatus } from "@/app/actions/reservations";
import { getEffectivePricesBatch, updateRoomStatus } from "@/app/actions/rooms";
import { getTapeChartData } from "@/app/actions/tape-chart";
import { useRoomsSync, broadcastRoomStatusChange } from "@/hooks/useRoomsSync";
import {
  getEffectivePropertyId,
  getPropertyReservationColors,
} from "@/app/actions/properties";
import type { Room, Reservation, ReservationGroupSummary, RoomStatus } from "@/lib/tape-chart-types";
import { RESERVATION_STATUS_BG, ROOM_STATUS_LABELS } from "@/lib/tape-chart-types";
import { cn } from "@/lib/utils";
import { TapeChartOverviewBar } from "./tape-chart-overview-bar";
import type { UnifiedReservationTab, CreateReservationContext } from "./unified-reservation-dialog";
import type { QuickStatsTab } from "./quick-stats-dialog";

const UnifiedReservationDialog = dynamic(() => import("./unified-reservation-dialog").then((m) => m.UnifiedReservationDialog), { ssr: false });
const GroupReservationSheet = dynamic(() => import("./group-reservation-sheet").then((m) => m.GroupReservationSheet), { ssr: false });
const RoomBlockSheet = dynamic(() => import("./room-block-sheet").then((m) => m.RoomBlockSheet), { ssr: false });
const SplitReservationDialog = dynamic(() => import("./split-reservation-dialog").then((m) => m.SplitReservationDialog), { ssr: false });
const StatusColorsDialog = dynamic(() => import("./status-colors-dialog").then((m) => m.StatusColorsDialog), { ssr: false });
const MonthlyOverviewDialog = dynamic(() => import("./monthly-overview-dialog").then((m) => m.MonthlyOverviewDialog), { ssr: false });
const FloorPlanDialog = dynamic(() => import("./floor-plan-dialog").then((m) => m.FloorPlanDialog), { ssr: false });
const DailyMovementsDialog = dynamic(() => import("./daily-movements-dialog").then((m) => m.DailyMovementsDialog), { ssr: false });
const QuickStatsDialog = dynamic(() => import("./quick-stats-dialog").then((m) => m.QuickStatsDialog), { ssr: false });
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

/** Parsuje id komórki droppable: cell-roomNumber__dateStr → { roomNumber, dateStr } */
function parseCellId(id: string): { roomNumber: string; dateStr: string } | null {
  if (!id.startsWith("cell-")) return null;
  const rest = id.slice(5);
  const sep = rest.indexOf("__");
  if (sep < 0) return null;
  return { roomNumber: rest.slice(0, sep), dateStr: rest.slice(sep + 2) };
}

/** Komórka (pokój+data) jako strefa upuszczenia – pozwala na zmianę pokoju i daty. */
const CellDroppable = memo(function CellDroppable({
  roomNumber,
  dateStr,
  rowIdx,
  colIdx,
  columnWidthPx,
  rowHeightPx,
  saturday,
  sunday,
  isBlocked,
  isFocused,
  isDirty,
  blockedRanges,
  onCellClick,
}: {
  roomNumber: string;
  dateStr: string;
  rowIdx: number;
  colIdx: number;
  columnWidthPx: number;
  rowHeightPx: number;
  saturday: boolean;
  sunday: boolean;
  isBlocked: boolean;
  isFocused: boolean;
  isDirty: boolean;
  blockedRanges?: Array<{ startDate: string; endDate: string; reason?: string }>;
  onCellClick?: (roomNumber: string, dateStr: string) => void;
}) {
  const { setNodeRef } = useDroppable({ id: `cell-${roomNumber}__${dateStr}` });
  return (
    <div
      ref={setNodeRef}
      key={`cell-${roomNumber}-${colIdx}`}
      data-testid={`cell-${roomNumber}-${dateStr}`}
      data-cell
      data-date={dateStr}
      data-room={roomNumber}
      className={cn(
        "cursor-grab active:cursor-grabbing border-b border-r border-[hsl(var(--kw-grid-border))] select-none",
        rowIdx % 2 === 1 ? "bg-slate-100 dark:bg-slate-800" : "bg-card",
        saturday && "kw-cell-saturday",
        sunday && "kw-cell-sunday",
        isBlocked && "bg-destructive/20 cursor-not-allowed opacity-70",
        isFocused && "ring-2 ring-inset ring-primary bg-primary/10",
        isDirty && "bg-amber-50/80 dark:bg-amber-950/30"
      )}
      style={{
        gridColumn: colIdx + 2,
        gridRow: rowIdx + 2,
        minWidth: columnWidthPx,
        minHeight: rowHeightPx,
      }}
      onClick={() => {
        if (isBlocked) {
          toast.info("Pokój zablokowany w tym terminie (Room Block).");
          return;
        }
        onCellClick?.(roomNumber, dateStr);
      }}
      title={isBlocked ? (blockedRanges?.find(
        (range) => dateStr >= range.startDate && dateStr <= range.endDate
      )?.reason ?? undefined) : undefined}
    />
  );
});

const RoomRowDroppable = memo(function RoomRowDroppable({
  room,
  rowIdx,
  dates,
  children,
  onCellClick,
  onRoomLabelClick,
  onRoomBlock,
  onRoomStatusChange,
  onShowOnlyRoom,
  onShowAllRooms,
  showOnlyRoomNumber,
  previewMode,
  blockedRanges,
  focusedDateIdx,
  columnWidthPx,
  rowHeightPx,
  virtualizedRow,
}: {
  room: Room;
  rowIdx: number;
  dates: string[];
  children: React.ReactNode;
  onCellClick?: (roomNumber: string, dateStr: string) => void;
  onRoomLabelClick?: (room: Room) => void;
  onRoomBlock?: (room: Room) => void;
  onRoomStatusChange?: (room: Room, status: RoomStatus) => void;
  onShowOnlyRoom?: (room: Room) => void;
  onShowAllRooms?: () => void;
  showOnlyRoomNumber?: string | null;
  previewMode?: boolean;
  blockedRanges?: Array<{ startDate: string; endDate: string; reason?: string }>;
  focusedDateIdx?: number;
  columnWidthPx: number;
  rowHeightPx: number;
  /** W trybie wirtualizacji: jedna linia siatki (gridRow: 1) */
  virtualizedRow?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `room-${room.number}` });
  const isDirty = room.status === "DIRTY";
  const isFilteredToThis = showOnlyRoomNumber === room.number;
  const gridRow = virtualizedRow ? 1 : rowIdx + 2;

  const labelContent = (
    <div
      ref={setNodeRef}
      data-testid={`room-row-${room.number}`}
      className={cn(
        "sticky left-0 z-[60] flex items-center gap-1 border-b border-r border-[hsl(var(--kw-grid-border))] px-1.5 py-0.5",
        isOver ? "bg-primary/10 ring-1 ring-primary" : rowIdx % 2 === 1 ? "bg-slate-100 dark:bg-slate-800" : "bg-card",
        isDirty && "bg-amber-50/80 dark:bg-amber-950/30",
        !previewMode && (onRoomLabelClick || onRoomBlock) && "cursor-pointer hover:bg-muted/50"
      )}
      style={{
        gridColumn: 1,
        gridRow,
        minHeight: rowHeightPx,
      }}
      onClick={(e) => {
        if (previewMode || !onRoomLabelClick) return;
        e.stopPropagation();
        onRoomLabelClick(room);
      }}
    >
      {children}
    </div>
  );

  const wrappedLabel = !previewMode && (onRoomBlock || onRoomStatusChange || onShowOnlyRoom || onShowAllRooms) ? (
    <ContextMenu>
      <ContextMenuTrigger asChild>{labelContent}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        {onRoomLabelClick && (
          <ContextMenuItem onSelect={() => onRoomLabelClick(room)}>
            <Plus className="h-4 w-4 mr-2" />
            Nowa rezerwacja
          </ContextMenuItem>
        )}
        {onRoomBlock && (
          <ContextMenuItem onSelect={() => onRoomBlock(room)}>
            <Ban className="h-4 w-4 mr-2" />
            Zablokuj pokój (Room Block)
          </ContextMenuItem>
        )}
        {onRoomStatusChange && room.id && (
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <SprayCan className="h-4 w-4 mr-2" />
              Zmień status pokoju
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              {(Object.keys(ROOM_STATUS_LABELS) as RoomStatus[]).map((status) => (
                <ContextMenuItem
                  key={status}
                  onSelect={() => onRoomStatusChange(room, status)}
                  className={cn(room.status === status && "font-semibold")}
                >
                  {ROOM_STATUS_LABELS[status]}
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
        )}
        <ContextMenuSeparator />
        {onShowOnlyRoom && (
          <ContextMenuItem onSelect={() => onShowOnlyRoom(room)} disabled={isFilteredToThis}>
            Pokaż tylko ten pokój
          </ContextMenuItem>
        )}
        {onShowAllRooms && showOnlyRoomNumber && (
          <ContextMenuItem onSelect={onShowAllRooms}>
            Pokaż wszystkie pokoje
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  ) : labelContent;

  return (
    <>
      {wrappedLabel}
      {dates.map((dateStr, colIdx) => {
        const saturday = isSaturdayDate(dateStr);
        const sunday = isSundayDate(dateStr);
        const isBlocked = blockedRanges?.some(
          (range) => dateStr >= range.startDate && dateStr <= range.endDate
        );
        const isFocused = focusedDateIdx === colIdx;
        return (
          <CellDroppable
            key={`cell-${room.number}-${colIdx}`}
            roomNumber={room.number}
            dateStr={dateStr}
            rowIdx={rowIdx}
            colIdx={colIdx}
            columnWidthPx={columnWidthPx}
            rowHeightPx={rowHeightPx}
            saturday={saturday}
            sunday={sunday}
            isBlocked={isBlocked}
            isFocused={isFocused}
            isDirty={isDirty}
            blockedRanges={blockedRanges}
            onCellClick={onCellClick}
          />
        );
      })}
    </>
  );
}, (prevProps, nextProps) => {
  if (prevProps.room.status !== nextProps.room.status) return false;
  if (prevProps.room.number !== nextProps.room.number) return false;
  if (prevProps.rowIdx !== nextProps.rowIdx) return false;
  if (prevProps.virtualizedRow !== nextProps.virtualizedRow) return false;
  if (prevProps.focusedDateIdx !== nextProps.focusedDateIdx) return false;
  if (prevProps.showOnlyRoomNumber !== nextProps.showOnlyRoomNumber) return false;
  if (prevProps.previewMode !== nextProps.previewMode) return false;
  if (prevProps.columnWidthPx !== nextProps.columnWidthPx) return false;
  if (prevProps.rowHeightPx !== nextProps.rowHeightPx) return false;
  if (prevProps.dates.length !== nextProps.dates.length) return false;
  return true;
});

/** Wysokość rzędu – 21px (zmniejszona o połowę) */
const ROW_HEIGHT_PX = 24; // ~25 − 2%
const ROOM_LABEL_WIDTH_PX = 140;
const HEADER_ROW_PX = 40;
const _BAR_PADDING_PX = 2;

/** Skale widoku grafiku – liczba dni (kolumn). Ograniczone dla wydajności DOM (Faza 1 PRD). */
type ViewScale = "day" | "week" | "month" | "year";
const VIEW_SCALE_CONFIG: Record<ViewScale, { days: number; columnWidth: number; label: string }> = {
  day: { days: 1, columnWidth: 480, label: "Dzień" },       // 1 kolumna
  week: { days: 42, columnWidth: 100, label: "Tydzień" },   // 6 tygodni
  month: { days: 93, columnWidth: 48, label: "Miesiąc" },    // ~3 miesiące
  year: { days: 365, columnWidth: 12, label: "Rok" },       // rok
};

/** Zoom dla wysokości wierszy – wpływa tylko na wysokość komórek (nie na szerokość kolumn) */
const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
const DEFAULT_ZOOM_INDEX = 2; // 1x

const WEEKDAY_SHORT: Record<number, string> = {
  0: "Nd",
  1: "Pn",
  2: "Wt",
  3: "Śr",
  4: "Cz",
  5: "Pt",
  6: "So",
};

function _isWeekendDate(dateStr: string): boolean {
  const d = new Date(dateStr + "Z");
  const w = d.getUTCDay();
  return w === 0 || w === 6; // Nd / So
}

function isSaturdayDate(dateStr: string): boolean {
  return new Date(dateStr + "Z").getUTCDay() === 6;
}

function isSundayDate(dateStr: string): boolean {
  return new Date(dateStr + "Z").getUTCDay() === 0;
}

function _isPastDate(dateStr: string, todayStr: string): boolean {
  return dateStr < todayStr;
}

function formatDateHeader(dateStr: string, todayStr: string): string {
  const d = new Date(dateStr + "Z");
  const w = d.getUTCDay();
  const day = d.getUTCDate();
  const month = d.getUTCMonth() + 1;
  const label = `${WEEKDAY_SHORT[w]} ${day}.${String(month).padStart(2, "0")}`;
  const isToday = dateStr === todayStr;
  return isToday ? `DZIŚ ${day}.${String(month).padStart(2, "0")}` : label;
}

const DEFAULT_VIEW_SCALE: ViewScale = "week";

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

const RESERVATION_STATUS_LABELS: Record<Reservation["status"], string> = {
  CONFIRMED: "Potwierdzona",
  CHECKED_IN: "Zameldowany",
  CHECKED_OUT: "Wymeldowany",
  CANCELLED: "Anulowana",
  NO_SHOW: "No-show",
};

const RESERVATION_STATUS_DESCRIPTIONS: Record<Reservation["status"], string> = {
  CONFIRMED: "Rezerwacja potwierdzona, oczekuje na przyjazd gościa. Pokój jest zarezerwowany na wskazany termin.",
  CHECKED_IN: "Gość zameldowany i przebywa w hotelu. Pokój jest zajęty.",
  CHECKED_OUT: "Gość wymeldowany i opuścił hotel. Rezerwacja zakończona.",
  CANCELLED: "Rezerwacja anulowana przez gościa lub recepcję. Pokój został zwolniony.",
  NO_SHOW: "Gość nie pojawił się w dniu przyjazdu. Rezerwacja zamknięta bez realizacji.",
};

type ConditionalPointerSensorOptions = PointerSensorOptions & {
  requireShift?: boolean;
};

class ConditionalPointerSensor extends PointerSensor {
  static override activators = [
    {
      eventName: "onPointerDown" as const,
      handler(event: { nativeEvent: PointerEvent }, { options }: { options: ConditionalPointerSensorOptions }) {
        if (options?.requireShift && !event.nativeEvent.shiftKey) {
          return false;
        }
        return event.nativeEvent.button === 0;
      },
    },
  ] as unknown as (typeof PointerSensor)["activators"];
}

export function TapeChart({
  rooms,
  initialHighlightReservationId,
  initialStatusBg,
  initialPropertyId,
  initialTodayStr,
  reservationGroups,
  initialOpenCreate = false,
}: {
  rooms: Room[];
  initialHighlightReservationId?: string;
  /** Kolory statusów z serwera – unika migania z niebieskiego na zielony przy ładowaniu */
  initialStatusBg?: Partial<Record<string, string>>;
  /** Id obiektu z serwera – unika dodatkowego wywołania getEffectivePropertyId */
  initialPropertyId?: string | null;
  /** Data YYYY-MM-DD z SSR – unika błędu hydratacji (server vs client) */
  initialTodayStr?: string;
  reservationGroups: ReservationGroupSummary[];
  /** E2E: otwórz formularz nowej rezerwacji od razu (?e2eOpenCreate=1) */
  initialOpenCreate?: boolean;
}) {
  const today = useMemo(() => new Date(), []);
  const clientTodayStr = useMemo(() => {
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, [today]);
  const todayStr = initialTodayStr ?? clientTodayStr;

  const [allRooms, setAllRooms] = useState<Room[]>(rooms);
  useEffect(() => setAllRooms(rooms), [rooms]);
  const [groups, setGroups] = useState<ReservationGroupSummary[]>(reservationGroups);
  useEffect(() => setGroups(reservationGroups), [reservationGroups]);

  // Polling statusów pokoi + BroadcastChannel sync między kartami
  useRoomsSync({
    pollingInterval: 10_000,
    onStatusChange: useCallback((syncedRooms: Array<{ id: string; number: string; status: RoomStatus }>) => {
      const statusMap = new Map(syncedRooms.map((r) => [r.number, r.status]));
      setAllRooms((prev) =>
        prev.map((room) => {
          const newStatus = statusMap.get(room.number);
          if (newStatus && newStatus !== room.status) {
            return { ...room, status: newStatus };
          }
          return room;
        })
      );
    }, []),
  });

  const [roomFilter, setRoomFilter] = useState("");
  // Room/client search fields are always visible in the filters panel
  const [clientSearchTerm, setClientSearchTerm] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [showGroupOnly, setShowGroupOnly] = useState(false);
  const [groupingEnabled, setGroupingEnabled] = useState(false);
  const [hostelMode, setHostelMode] = useState(false);
  const [dragWithoutShift, setDragWithoutShift] = useState(true);
  const [styleSplitByDay, setStyleSplitByDay] = useState(true);
  const [monthlyDialogOpen, setMonthlyDialogOpen] = useState(false);
  const [floorPlanDialogOpen, setFloorPlanDialogOpen] = useState(false);
  const [dailyMovementsDialogOpen, setDailyMovementsDialogOpen] = useState(false);
  const [quickStatsOpen, setQuickStatsOpen] = useState(false);
  const [quickStatsTab, setQuickStatsTab] = useState<QuickStatsTab>("arrivals");
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [exportStartDate, setExportStartDate] = useState("");
  const [exportEndDate, setExportEndDate] = useState("");
  const [exportRooms, setExportRooms] = useState<string[]>([]);
  const [groupReservationSheetOpen, setGroupReservationSheetOpen] = useState(false);
  const [roomBlockSheetOpen, setRoomBlockSheetOpen] = useState(false);
  const [roomBlockInitialRoom, setRoomBlockInitialRoom] = useState<string | null>(null);
  const [showOnlyRoomNumber, setShowOnlyRoomNumber] = useState<string | null>(null);
  const [splitDialogReservation, setSplitDialogReservation] = useState<Reservation | null>(null);
  const [statusColorsDialogOpen, setStatusColorsDialogOpen] = useState(false);
  const [legendDialogOpen, setLegendDialogOpen] = useState(false);
  const router = useRouter();
  const [propertyId, setPropertyId] = useState<string | null>(initialPropertyId ?? null);
  const [statusBg, setStatusBg] = useState<Record<string, string> | null>(
    initialStatusBg && Object.keys(initialStatusBg).length > 0
      ? (Object.fromEntries(Object.entries(initialStatusBg).filter(([, v]) => typeof v === "string")) as Record<string, string>)
      : null
  );
  const [statusTab, setStatusTab] = useState<"statuses" | "roomStatus" | "custom" | "sources" | "prices">("statuses");
  const [colorMode, setColorMode] = useState<"status" | "source">("status");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [footerOpen, setFooterOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  const reservations = useTapeChartStore((s) => s.reservations);
  const setReservations = useTapeChartStore((s) => s.setReservations);
  const undo = useTapeChartStore((s) => s.undo);
  const redo = useTapeChartStore((s) => s.redo);
  const canUndo = useTapeChartStore((s) => s.past.length > 0);
  const canRedo = useTapeChartStore((s) => s.future.length > 0);

  useEffect(() => {
    if (initialPropertyId != null) return;
    getEffectivePropertyId().then(setPropertyId);
  }, [initialPropertyId]);
  useEffect(() => {
    if (!propertyId) return;
    const hasColorsFromServer = initialStatusBg && Object.keys(initialStatusBg).length > 0;
    if (hasColorsFromServer) return;
    getPropertyReservationColors(propertyId).then((res) => {
      if (res?.success && res?.data && Object.keys(res.data).length > 0)
        setStatusBg(res.data as Record<string, string>);
    });
  }, [propertyId, initialStatusBg]);
  // Po odświeżeniu strony (router.refresh) – zsynchronizuj kolory z serwera
  useEffect(() => {
    if (initialStatusBg && Object.keys(initialStatusBg).length > 0) {
      setStatusBg(initialStatusBg as Record<string, string>);
    }
  }, [initialStatusBg]);

  const statusTabOptions = [
    { id: "statuses", label: "Statusy rezerwacji" },
    { id: "roomStatus", label: "Status pokoju" },
    { id: "custom", label: "Dodatkowe statusy" },
    { id: "sources", label: "Źródła rezerwacji" },
    { id: "prices", label: "Ceny" },
  ] as const;

  const [viewStartDate, setViewStartDate] = useState<Date>(() => {
    if (DEFAULT_VIEW_SCALE === "day" || DEFAULT_VIEW_SCALE === "week" || DEFAULT_VIEW_SCALE === "month") {
      return new Date(today);
    }
    const days = VIEW_SCALE_CONFIG[DEFAULT_VIEW_SCALE].days;
    return addDays(new Date(today), -Math.floor(days / 2));
  });
  const [viewScale, setViewScale] = useState<ViewScale>(DEFAULT_VIEW_SCALE);
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX);
  const [highlightedReservationId, setHighlightedReservationId] = useState<string | null>(
    () => initialHighlightReservationId ?? null
  );
  /** Lazy loading: doładowane dni w prawo (scroll). Reset przy zmianie widoku/daty. */
  const [extraDaysLoaded, setExtraDaysLoaded] = useState(0);
  /** Po mount – unika błędu hydratacji (virtualizer zwraca inny wynik na serwerze vs klient). */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const currentViewConfig = VIEW_SCALE_CONFIG[viewScale];
  const zoomMultiplier = ZOOM_LEVELS[zoomIndex];
  const COLUMN_WIDTH_PX = currentViewConfig.columnWidth; // zoom wpływa tylko na wysokość wierszy
  const DAYS_VIEW = currentViewConfig.days;

  useEffect(() => {
    setExtraDaysLoaded(0);
  }, [viewScale, viewStartDate]);

  const handleZoomIn = useCallback(() => {
    setZoomIndex((prev) => Math.min(prev + 1, ZOOM_LEVELS.length - 1));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const dates = useMemo(() => {
    const totalDays = Math.max(1, DAYS_VIEW + extraDaysLoaded);
    const end = addDays(viewStartDate, totalDays - 1);
    return getDateRange(viewStartDate, end);
  }, [viewStartDate, DAYS_VIEW, extraDaysLoaded]);

  const viewStartDateStr = useMemo(
    () => viewStartDate.toISOString().slice(0, 10),
    [viewStartDate]
  );

  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingMoreRef = useRef(false);
  const extendDateRange = useCallback(() => {
    if (loadingMoreRef.current) return;
    const extension = Math.max(7, Math.ceil(DAYS_VIEW / 2));
    loadingMoreRef.current = true;
    const nextLoaded = extraDaysLoaded + extension;
    setExtraDaysLoaded(nextLoaded);
    const lastDate = addDays(viewStartDate, Math.max(0, DAYS_VIEW + nextLoaded - 1));
    const dateToStr = lastDate.toISOString().slice(0, 10);
    getTapeChartData({ dateFrom: viewStartDateStr, dateTo: dateToStr })
      .then((res) => {
        setReservations((prevRes) => {
          const byId = new Map(prevRes.map((r) => [r.id, r]));
          (res.reservations as Reservation[]).forEach((r) => byId.set(r.id, r));
          return Array.from(byId.values()).sort((a, b) =>
            (a.checkIn as string).localeCompare(b.checkIn as string)
          ) as Reservation[];
        });
      })
      .finally(() => {
        loadingMoreRef.current = false;
      });
  }, [DAYS_VIEW, extraDaysLoaded, viewStartDate, viewStartDateStr, setReservations]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    const sentinel = sentinelRef.current;
    if (!container || !sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) extendDateRange();
      },
      { root: container, rootMargin: "200px", threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [extendDateRange]);

  const allAvailableFeatures = useMemo(() => {
    const set = new Set<string>();
    allRooms.forEach((room) => {
      const f = room.roomFeatures;
      if (Array.isArray(f)) f.forEach((x) => set.add(x));
    });
    return Array.from(set).sort();
  }, [allRooms]);

  const [roomFeaturesFilter, setRoomFeaturesFilter] = useState<string[]>([]);
  const [roomTypeFilter, setRoomTypeFilter] = useState<string>("");
  const [floorFilter, setFloorFilter] = useState<string>("");
  const [showOnlyFreeRooms, setShowOnlyFreeRooms] = useState(false);
  const [highlightConflicts, setHighlightConflicts] = useState(false);

  const roomTypeOptions = useMemo(() => {
    const types = [...new Set(allRooms.map((r) => r.type).filter(Boolean))].sort();
    return types;
  }, [allRooms]);
  const floorOptions = useMemo(() => {
    const floors = [...new Set(allRooms.map((r) => r.floor ?? "").filter(Boolean))].sort();
    return floors;
  }, [allRooms]);

  // Zbiór rezerwacji z konfliktami (nakładające się na ten sam pokój)
  const conflictingReservationIds = useMemo(() => {
    if (!highlightConflicts) return new Set<string>();
    const conflicts = new Set<string>();
    const activeReservations = reservations.filter(
      (r) => r.status !== "CANCELLED" && r.status !== "NO_SHOW"
    );

    // Grupuj rezerwacje wg pokoju
    const byRoom = new Map<string, typeof activeReservations>();
    activeReservations.forEach((res) => {
      const list = byRoom.get(res.room) || [];
      list.push(res);
      byRoom.set(res.room, list);
    });

    // Sprawdź nakładanie się w każdym pokoju
    byRoom.forEach((roomReservations) => {
      for (let i = 0; i < roomReservations.length; i++) {
        for (let j = i + 1; j < roomReservations.length; j++) {
          const a = roomReservations[i];
          const b = roomReservations[j];
          // Sprawdź czy nakładają się
          if (a.checkIn < b.checkOut && a.checkOut > b.checkIn) {
            conflicts.add(a.id);
            conflicts.add(b.id);
          }
        }
      }
    });

    return conflicts;
  }, [highlightConflicts, reservations]);

  // Zbiór pokoi z aktywnymi rezerwacjami w widocznym zakresie dat
  const roomsWithReservations = useMemo(() => {
    if (!showOnlyFreeRooms || dates.length === 0) return new Set<string>();
    const viewStart = dates[0];
    const viewEnd = dates[dates.length - 1];
    const occupied = new Set<string>();
    reservations.forEach((res) => {
      // Sprawdź czy rezerwacja nachodzi na widoczny zakres
      if (
        res.status !== "CANCELLED" &&
        res.status !== "NO_SHOW" &&
        res.checkIn <= viewEnd &&
        res.checkOut > viewStart
      ) {
        occupied.add(res.room);
      }
    });
    return occupied;
  }, [showOnlyFreeRooms, dates, reservations]);

  const displayRooms = useMemo(() => {
    const filter = roomFilter.trim().toLowerCase();
    const filtered = allRooms.filter((room) => {
      if (showOnlyRoomNumber && room.number !== showOnlyRoomNumber) return false;
      if (filter && !room.number.toLowerCase().includes(filter) && !room.type.toLowerCase().includes(filter)) {
        return false;
      }
      if (roomTypeFilter && room.type !== roomTypeFilter) return false;
      if (floorFilter && (room.floor ?? "") !== floorFilter) return false;
      if (roomFeaturesFilter.length > 0) {
        const roomFeat = room.roomFeatures ?? [];
        const hasAll = roomFeaturesFilter.every((f) => roomFeat.includes(f));
        if (!hasAll) return false;
      }
      // Filtr "tylko wolne pokoje"
      if (showOnlyFreeRooms && roomsWithReservations.has(room.number)) {
        return false;
      }
      return true;
    });
    return filtered
      .slice()
      .sort((a, b) => {
        if (groupingEnabled) {
          const typeDiff = a.type.localeCompare(b.type, undefined, { sensitivity: "base" });
          if (typeDiff !== 0) return typeDiff;
        }
        return a.number.localeCompare(b.number, undefined, { numeric: true, sensitivity: "base" });
      });
  }, [allRooms, roomFilter, roomTypeFilter, floorFilter, roomFeaturesFilter, groupingEnabled, showOnlyFreeRooms, roomsWithReservations, showOnlyRoomNumber]);

  const visibleRoomNumbers = useMemo(
    () => new Set(displayRooms.map((room) => room.number)),
    [displayRooms]
  );

  const [goToDateOpen, setGoToDateOpen] = useState(false);
  const [goToDateValue, setGoToDateValue] = useState("");
  const handleGoToDate = () => {
    if (goToDateValue) {
      const d = new Date(goToDateValue + "T12:00:00");
      if (!Number.isNaN(d.getTime())) {
        if (viewScale === "day" || viewScale === "week" || viewScale === "month") {
          setViewStartDate(d);
        } else {
          const days = VIEW_SCALE_CONFIG[viewScale].days;
          setViewStartDate(addDays(d, -Math.floor(days / 2)));
        }
        setGoToDateOpen(false);
        setGoToDateValue("");
      }
    }
  };
  // Skok nawigacji zależny od skali widoku
  const navigationStep = useMemo(() => {
    switch (viewScale) {
      case "day": return 7;
      case "week": return 14;
      case "month": return 30;
      case "year": return 90;
    }
  }, [viewScale]);

  const handlePrev = () => {
    setViewStartDate(addDays(viewStartDate, -navigationStep));
  };
  const handleNext = () => {
    setViewStartDate(addDays(viewStartDate, navigationStep));
  };
  const handleGoToToday = useCallback(() => {
    if (viewScale === "day" || viewScale === "week" || viewScale === "month") {
      setViewStartDate(new Date(today));
    } else {
      const days = VIEW_SCALE_CONFIG[viewScale].days;
      setViewStartDate(addDays(new Date(today), -Math.floor(days / 2)));
    }
    didScrollToTodayRef.current = false;
  }, [today, viewScale]);

  const handleOpenExportDialog = () => {
    // Initialize with current view range
    setExportStartDate(dates[0] ?? viewStartDateStr);
    setExportEndDate(dates[dates.length - 1] ?? viewStartDateStr);
    setExportRooms(displayRooms.map((r) => r.number));
    setExportDialogOpen(true);
  };

  const handleExportPdf = useCallback(() => {
    // Temporarily update view for export
    if (exportStartDate && exportEndDate) {
      const start = new Date(exportStartDate + "T12:00:00");
      const end = new Date(exportEndDate + "T12:00:00");
      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
      if (daysDiff > 0 && daysDiff <= 90) {
        setViewStartDate(start);
        // Wait for re-render then print
        setTimeout(() => {
          window.print();
        }, 100);
      } else {
        toast.error("Zakres dat musi być od 1 do 90 dni");
      }
    }
    setExportDialogOpen(false);
  }, [exportStartDate, exportEndDate]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const gridWrapperRef = useRef<HTMLDivElement>(null);
  const didPanRef = useRef(false);
  const didScrollToTodayRef = useRef(false);
  const pointerPosRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointerPosRef.current = { x: e.clientX, y: e.clientY };
    };
    document.addEventListener("pointermove", onMove, { passive: true });
    return () => document.removeEventListener("pointermove", onMove);
  }, []);

  /** Szerokość kolumny = stała COLUMN_WIDTH_PX – siatka szersza niż kontener, przewijanie myszką w każdym widoku */
  const effectiveColumnWidthPx = COLUMN_WIDTH_PX;
  const [effectiveRowHeightPx, setEffectiveRowHeightPx] = useState(ROW_HEIGHT_PX);
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || dates.length === 0) return;
    const measure = () => {
      // zoom wpływa tylko na wysokość komórek (wierszy pokoi)
      const rowH = displayRooms.length > 0
        ? Math.max(16, Math.round(ROW_HEIGHT_PX * zoomMultiplier))
        : ROW_HEIGHT_PX;
      setEffectiveRowHeightPx(rowH);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    return () => ro.disconnect();
  }, [dates.length, displayRooms.length, zoomMultiplier]);

  const getDateFromClientX = useCallback(
    (clientX: number): string | null => {
      const gridEl = gridWrapperRef.current;
      if (!gridEl || dates.length === 0) return null;
      const rect = gridEl.getBoundingClientRect();
      const gridLeft = rect.left;
      const dateAreaWidth = gridEl.offsetWidth - ROOM_LABEL_WIDTH_PX;
      if (dateAreaWidth <= 0) return null;
      const colWidth = dateAreaWidth / dates.length;
      const col = Math.floor((clientX - gridLeft - ROOM_LABEL_WIDTH_PX) / colWidth);
      if (col < 0 || col >= dates.length) return null;
      return dates[col] ?? null;
    },
    [dates]
  );

  const getDropTarget = useCallback(
    (clientX: number, clientY: number): { room: Room; date: string } | null => {
      const gridEl = gridWrapperRef.current;
      if (!gridEl || displayRooms.length === 0 || dates.length === 0) return null;
      const rect = gridEl.getBoundingClientRect();
      const localX = clientX - rect.left;
      const localY = clientY - rect.top;
      const firstRow = gridEl.querySelector("[data-room-row]");
      const headerHeight = firstRow
        ? firstRow.getBoundingClientRect().top - rect.top
        : HEADER_ROW_PX;
      if (localY < headerHeight) return null;
      const rowIndex = Math.floor((localY - headerHeight) / effectiveRowHeightPx);
      if (rowIndex < 0 || rowIndex >= displayRooms.length) return null;
      const colIndex = Math.floor((localX - ROOM_LABEL_WIDTH_PX) / effectiveColumnWidthPx);
      if (colIndex < 0 || colIndex >= dates.length) return null;
      const room = displayRooms[rowIndex];
      const date = dates[colIndex];
      if (!room || !date) return null;
      return { room, date };
    },
    [displayRooms, dates, effectiveRowHeightPx, effectiveColumnWidthPx]
  );

  const handleResize = useCallback(
    async (reservationId: string, payload: { checkIn?: string; checkOut?: string }) => {
      const { updateReservation } = await import("@/app/actions/reservations");
      const result = await updateReservation(reservationId, payload);
      if (result?.success && result?.data) {
        setReservations((prev) =>
          prev.map((r) => (r.id === reservationId ? { ...r, ...result.data } : r)) as Reservation[]
        );
        toast.success("Datę rezerwacji zaktualizowano");
      } else if (!result?.success) {
        toast.error("error" in result ? (result.error ?? "Błąd aktualizacji") : "Błąd aktualizacji");
      }
    },
    [setReservations]
  );

  const handleGridPointerDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const target = e.target;
    // Przeciąganie siatki (komórka, nagłówek lub tło) = przewijanie – nie gdy klik na pasek rezerwacji (DnD)
    if (!(target instanceof HTMLElement)) return;
    if (target.closest("[data-reservation-id]")) return;
    if (!target.closest("[data-cell], [data-date-header], [data-grid-draggable]")) return;
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

  const filteredReservations = useMemo(() => {
    const term = clientSearchTerm.trim().toLowerCase();
    return reservations.filter((reservation) => {
      if (!visibleRoomNumbers.has(reservation.room)) return false;
      if (showGroupOnly && !reservation.groupId) return false;
      if (selectedGroupId && reservation.groupId !== selectedGroupId) return false;
      if (term && !reservation.guestName.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [reservations, visibleRoomNumbers, showGroupOnly, selectedGroupId, clientSearchTerm]);

  const statusLegendItems = useMemo(
    () =>
      (Object.keys(RESERVATION_STATUS_BG) as Array<Reservation["status"]>).map((status) => ({
        status,
        label: RESERVATION_STATUS_LABELS[status],
        description: RESERVATION_STATUS_DESCRIPTIONS[status],
        color: RESERVATION_STATUS_BG[status],
      })),
    []
  );

  // Wskaźnik zajętości (occupancy %)
  const occupancyStats = useMemo(() => {
    if (displayRooms.length === 0 || dates.length === 0) {
      return { percentage: 0, occupiedNights: 0, totalNights: 0 };
    }

    const viewStart = new Date(dates[0] + "T00:00:00Z");
    const viewEnd = new Date(dates[dates.length - 1] + "T23:59:59Z");
    const viewEndNextDay = addDays(viewEnd, 1);

    // Oblicz zajęte noclegi dla aktywnych rezerwacji (nie anulowanych, nie no-show)
    let occupiedNights = 0;
    const activeStatuses = ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"];

    filteredReservations.forEach((res) => {
      if (!activeStatuses.includes(res.status)) return;

      const resStart = new Date(res.checkIn + "T00:00:00Z");
      const resEnd = new Date(res.checkOut + "T00:00:00Z");

      // Oblicz nakładające się dni
      const overlapStart = resStart > viewStart ? resStart : viewStart;
      const overlapEnd = resEnd < viewEndNextDay ? resEnd : viewEndNextDay;

      if (overlapStart < overlapEnd) {
        const nights = Math.round(
          (overlapEnd.getTime() - overlapStart.getTime()) / (24 * 60 * 60 * 1000)
        );
        occupiedNights += Math.max(0, nights);
      }
    });

    const totalNights = displayRooms.length * dates.length;
    const percentage = totalNights > 0 ? Math.round((occupiedNights / totalNights) * 100) : 0;

    return { percentage, occupiedNights, totalNights };
  }, [displayRooms.length, dates, filteredReservations]);

  const todayQuickStats = useMemo(() => {
    const arrivals = reservations.filter(
      (r) => r.checkIn === todayStr && r.status !== "CANCELLED" && r.status !== "NO_SHOW"
    ).length;
    const departures = reservations.filter(
      (r) => r.checkOut === todayStr && (r.status === "CHECKED_IN" || r.status === "CHECKED_OUT")
    ).length;
    const dirtyRooms = allRooms.filter((r) => r.status === "DIRTY").length;
    const checkedInNow = reservations.filter((r) => r.status === "CHECKED_IN").length;
    return { arrivals, departures, dirtyRooms, checkedInNow };
  }, [reservations, todayStr, allRooms]);

  useEffect(() => {
    if (!initialHighlightReservationId || !scrollContainerRef.current) return;
    const res = reservations.find((r) => r.id === initialHighlightReservationId);
    if (res) {
      const d = new Date(res.checkIn + "Z");
      if (!Number.isNaN(d.getTime())) setViewStartDate(addDays(d, -3));
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

  // Scroll to "today" column on mount (and when handleGoToToday resets the flag)
  useEffect(() => {
    if (didScrollToTodayRef.current || initialHighlightReservationId) return;
    const container = scrollContainerRef.current;
    if (!container) return;
    const todayIdx = dates.indexOf(todayStr);
    if (todayIdx < 0) return;
    const t = setTimeout(() => {
      if (didScrollToTodayRef.current) return;
      didScrollToTodayRef.current = true;
      const scrollTarget = Math.max(0, todayIdx * COLUMN_WIDTH_PX - 20);
      container.scrollLeft = scrollTarget;
    }, 100);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dates, todayStr]);

  useEffect(() => {
    if (!moreMenuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setMoreMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [moreMenuOpen]);

  const [privacyMode, setPrivacyMode] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [ghostPreview, setGhostPreview] = useState<{
    roomNumber: string;
    checkIn: string;
    checkOut: string;
  } | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editInitialTab, setEditInitialTab] = useState<UnifiedReservationTab | undefined>(undefined);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [focusedCell, setFocusedCell] = useState<{ roomIdx: number; dateIdx: number } | null>(null);
  const [selectedReservationIds, setSelectedReservationIds] = useState<Set<string>>(new Set());
  const [newReservationContext, setNewReservationContext] = useState<CreateReservationContext | null>(null);
  const [createSheetOpen, setCreateSheetOpen] = useState(false);
  const [effectivePricesMap, setEffectivePricesMap] = useState<Record<string, number>>({});

  useEffect(() => {
    if (filteredReservations.length === 0) {
      setEffectivePricesMap({});
      return;
    }
    const requests = filteredReservations.map((r) => ({ roomNumber: r.room, dateStr: r.checkIn }));
    getEffectivePricesBatch(requests).then(setEffectivePricesMap);
  }, [filteredReservations]);

  useEffect(() => {
    if (initialOpenCreate && displayRooms.length > 0 && !createSheetOpen) {
      const defaultRoom = displayRooms[0];
      setNewReservationContext({
        roomNumber: defaultRoom?.number ?? "",
        checkIn: viewStartDateStr,
      });
      setCreateSheetOpen(true);
    }
  }, [initialOpenCreate, displayRooms, viewStartDateStr, createSheetOpen]);

  const roomRowIndex = useMemo(() => {
    const map = new Map<string, number>();
    displayRooms.forEach((r, i) => map.set(r.number, i + 1));
    return map;
  }, [displayRooms]);

  const dateIndex = useMemo(() => {
    const map = new Map<string, number>();
    dates.forEach((d, i) => map.set(d, i));
    return map;
  }, [dates]);

  /** Konwencja KWHotel: pasek od połowy dnia zameldowania do połowy dnia wymeldowania. */
  const reservationPlacements = useMemo(() => {
    return filteredReservations
      .map((res) => {
        const row = roomRowIndex.get(res.room);
        if (row == null) return null;
        const startIdx = dateIndex.get(res.checkIn);
        let endIdx = dateIndex.get(res.checkOut);
        if (endIdx != null) endIdx = endIdx;
        else endIdx = dates.findIndex((d) => d >= res.checkOut);
        if (endIdx === -1) endIdx = dates.length;
        if (startIdx == null || startIdx >= endIdx) return null;
        const numDays = endIdx - startIdx;
        const numColumns = numDays + 1;
        const barLeftPercent = 0.5 / numColumns;
        const barWidthPercent = numDays / numColumns;
        const gridColumnEnd = Math.min(endIdx + 3, dates.length + 2);
        return {
          reservation: res,
          gridRow: row + 1,
          gridColumnStart: startIdx + 2,
          gridColumnEnd,
          barLeftPercent,
          barWidthPercent,
        };
      })
      .filter((p): p is NonNullable<typeof p> => p != null);
  }, [filteredReservations, roomRowIndex, dateIndex, dates]);

  const roomByNumber = useMemo(() => new Map(allRooms.map((r) => [r.number, r])), [allRooms]);

  const ghostPlacement = useMemo(() => {
    if (!ghostPreview || !activeId) return null;
    const row = roomRowIndex.get(ghostPreview.roomNumber);
    if (row == null) return null;
    const startIdx = dateIndex.get(ghostPreview.checkIn);
    let endIdx = dateIndex.get(ghostPreview.checkOut);
    if (endIdx == null) endIdx = dates.findIndex((d) => d >= ghostPreview.checkOut);
    if (endIdx === -1) endIdx = dates.length;
    if (startIdx == null || startIdx >= endIdx) return null;
    const numDays = endIdx - startIdx;
    const numColumns = numDays + 1;
    const barLeftPercent = 0.5 / numColumns;
    const barWidthPercent = numDays / numColumns;
    const gridColumnEnd = Math.min(endIdx + 3, dates.length + 2);
    const activeReservation = reservations.find((r) => r.id === activeId);
    if (!activeReservation) return null;
    return {
      reservation: { ...activeReservation, room: ghostPreview.roomNumber },
      gridColumnStart: startIdx + 2,
      gridColumnEnd,
      gridRow: row + 1,
      barLeftPercent,
      barWidthPercent,
    };
  }, [ghostPreview, activeId, roomRowIndex, dateIndex, dates, reservations]);

  // Anuluj drag przy zmianie zoomu/skali – unikamy błędnego collision (stale recty) i niespójnego layoutu (D10)
  useEffect(() => {
    if (activeId != null) {
      setActiveId(null);
      setGhostPreview(null);
    }
  }, [zoomIndex, viewScale]); // eslint-disable-line react-hooks/exhaustive-deps -- clear selection on zoom/scale change only

  const sourceSummary = useMemo(() => {
    const counts = new Map<string, number>();
    reservations.forEach((reservation) => {
      const source = reservation.rateCodeName ?? reservation.rateCode ?? "Recepcja";
      counts.set(source, (counts.get(source) ?? 0) + 1);
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [reservations]);

  // Color palette for sources/channels
  const SOURCE_COLORS = useMemo(() => [
    "#6366f1", // indigo
    "#8b5cf6", // violet
    "#ec4899", // pink
    "#f43f5e", // rose
    "#f97316", // orange
    "#eab308", // yellow
    "#22c55e", // green
    "#14b8a6", // teal
    "#06b6d4", // cyan
    "#3b82f6", // blue
  ], []);

  const sourceColors = useMemo(() => {
    const colors = new Map<string, string>();
    sourceSummary.forEach(([source], idx) => {
      colors.set(source, SOURCE_COLORS[idx % SOURCE_COLORS.length]);
    });
    return colors;
  }, [sourceSummary, SOURCE_COLORS]);

  const priceSummary = useMemo(() => {
    const values: number[] = [];
    filteredReservations.forEach((reservation) => {
      const key = `${reservation.room}-${reservation.checkIn}`;
      const price =
        reservation.rateCodePrice ??
        effectivePricesMap[key] ??
        roomByNumber.get(reservation.room)?.price;
      if (price != null) values.push(price);
    });
    if (values.length === 0) return null;
    const sum = values.reduce((acc, value) => acc + value, 0);
    const avg = Math.round(sum / values.length);
    const min = Math.min(...values);
    const max = Math.max(...values);
    return { avg, min, max, count: values.length };
  }, [filteredReservations, effectivePricesMap, roomByNumber]);

  const occupancyToday = useMemo(() => {
    const map = new Map<string, number>();
    reservations.forEach((reservation) => {
      if (todayStr >= reservation.checkIn && todayStr < reservation.checkOut) {
        map.set(reservation.room, (map.get(reservation.room) ?? 0) + (reservation.pax ?? 1));
      }
    });
    return map;
  }, [reservations, todayStr]);

  const handleDragMove = useCallback(() => {
    // Ghost wyłączony – używamy tylko DragOverlay
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      setGhostPreview(null);
      const resId = active.id as string;
      const reservation = reservations.find((r) => r.id === resId);
      if (!reservation) return;

      const pos = pointerPosRef.current;
      let target: { room: Room; date: string } | null = null;

      if (pos.x !== 0 || pos.y !== 0) {
        target = getDropTarget(pos.x, pos.y);
      }
      if (!target && over) {
        const overId = over.id as string;
        if (overId.startsWith("room-")) {
          const newRoomNumber = overId.replace("room-", "");
          const targetRoom = roomByNumber.get(newRoomNumber);
          if (targetRoom) {
            target = { room: targetRoom, date: reservation.checkIn };
          }
        }
      }
      if (!target) {
        toast.error("Upuszczono poza siatką");
        return;
      }

      const targetRoom = target.room;
      if (targetRoom.status === "DIRTY" || targetRoom.status === "OOO" || targetRoom.status === "INSPECTION") {
        toast.error(
          `Nie można przenieść rezerwacji na pokój ${targetRoom.number}. Status: ${targetRoom.status}${targetRoom.reason ? ` (${targetRoom.reason})` : ""}. Zmień status pokoju lub wybierz inny pokój.`
        );
        return;
      }

      const roomBlockOverlap = targetRoom.blocks?.some(
        (b) => reservation.checkIn < b.endDate && reservation.checkOut > b.startDate
      );
      if (roomBlockOverlap) {
        toast.error("Pokój jest zablokowany (Room Block) w tym terminie.");
        return;
      }

      const newRoomNumber = targetRoom.number;
      if (reservation.room === newRoomNumber && target.date === reservation.checkIn) {
        return;
      }

      const oldCheckInStr =
        typeof reservation.checkIn === "string"
          ? reservation.checkIn.slice(0, 10)
          : new Date(reservation.checkIn).toISOString().slice(0, 10);
      const oldCheckOutStr =
        typeof reservation.checkOut === "string"
          ? reservation.checkOut.slice(0, 10)
          : new Date(reservation.checkOut).toISOString().slice(0, 10);
      const oldCheckInDate = new Date(oldCheckInStr);
      const targetDateObj = new Date(target.date);
      const daysDiff = Math.round(
        (targetDateObj.getTime() - oldCheckInDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      const newCheckInDate = new Date(oldCheckInDate);
      newCheckInDate.setDate(newCheckInDate.getDate() + daysDiff);
      const newCheckInStr = newCheckInDate.toISOString().slice(0, 10);
      const newCheckOutDate = new Date(oldCheckOutStr);
      newCheckOutDate.setDate(newCheckOutDate.getDate() + daysDiff);
      const newCheckOutStr = newCheckOutDate.toISOString().slice(0, 10);
      const roomChanged = newRoomNumber !== reservation.room;
      const dateChanged = daysDiff !== 0;
      if (!roomChanged && !dateChanged) return;

      const result = await moveReservation({
        reservationId: resId,
        newRoomNumber,
        newCheckIn: dateChanged ? newCheckInStr : undefined,
        newCheckOut: dateChanged ? newCheckOutStr : undefined,
      });
      if (result.success && result.data) {
        const updated = result.data;
        setReservations((prev) =>
          prev.map((r) => (r.id === resId ? { ...r, room: updated.room, checkIn: updated.checkIn, checkOut: updated.checkOut } : r)) as Reservation[]
        );
        const msg = [
          roomChanged && `pokój ${newRoomNumber}`,
          dateChanged && `${newCheckInStr}–${newCheckOutStr}`,
        ]
          .filter(Boolean)
          .join(", ");
        toast.success(msg ? `Przeniesiono rezerwację → ${msg}` : "Przeniesiono rezerwację");
      } else if (!result.success) {
        toast.error("error" in result ? result.error : "Nie można przenieść rezerwacji");
      }
    },
    [setReservations, roomByNumber, reservations, getDropTarget]
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dnd-kit sensor activator signature mismatch
  const pointerSensor = useSensor(ConditionalPointerSensor as any, {
    requireShift: !dragWithoutShift,
    activationConstraint: { distance: 5, delay: 0, tolerance: 5 },
  });
  const sensors = useSensors(pointerSensor);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Undo/Redo
      if (e.ctrlKey && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (e.ctrlKey && e.key === "y") {
        e.preventDefault();
        redo();
        return;
      }

      // Grid navigation - only when grid is focused
      if (!sheetOpen && !createSheetOpen && document.activeElement?.tagName !== "INPUT") {
        const maxRoomIdx = displayRooms.length - 1;
        const maxDateIdx = dates.length - 1;

        if (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault();
          setFocusedCell((prev) => {
            const current = prev ?? { roomIdx: 0, dateIdx: 0 };
            switch (e.key) {
              case "ArrowUp":
                return { ...current, roomIdx: Math.max(0, current.roomIdx - 1) };
              case "ArrowDown":
                return { ...current, roomIdx: Math.min(maxRoomIdx, current.roomIdx + 1) };
              case "ArrowLeft":
                return { ...current, dateIdx: Math.max(0, current.dateIdx - 1) };
              case "ArrowRight":
                return { ...current, dateIdx: Math.min(maxDateIdx, current.dateIdx + 1) };
              default:
                return current;
            }
          });
        }

        // Enter - open reservation at focused cell
        if (e.key === "Enter" && focusedCell) {
          e.preventDefault();
          const room = displayRooms[focusedCell?.roomIdx ?? -1];
          const dateStr = dates[focusedCell?.dateIdx ?? -1];
          if (room && dateStr) {
            // Find reservation at this cell
            const res = reservations.find(
              (r) =>
                r.room === room.number &&
                r.checkIn <= dateStr &&
                r.checkOut > dateStr &&
                r.status !== "CANCELLED" &&
                r.status !== "NO_SHOW"
            );
            if (res) {
              setSelectedReservation(res);
              setEditInitialTab("rozliczenie");
              setSheetOpen(true);
            } else {
              // Create new reservation at this cell
              setNewReservationContext({ roomNumber: room.number, checkIn: dateStr });
              setCreateSheetOpen(true);
            }
          }
        }

        // Escape - clear focus
        if (e.key === "Escape") {
          setFocusedCell(null);
        }

        // N - Nowa rezerwacja (otwórz sheet z domyślną datą i pierwszym pokojem)
        if ((e.key === "n" || e.key === "N") && !e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          const defaultRoom = displayRooms[0];
          setNewReservationContext({
            roomNumber: defaultRoom?.number ?? "",
            checkIn: dates[0] ?? new Date().toISOString().slice(0, 10),
          });
          setCreateSheetOpen(true);
        }

        // Keyboard shortcuts for quick check-in/check-out
        // "I" - Check In, "O" - Check Out
        if ((e.key === "i" || e.key === "I") && focusedCell) {
          e.preventDefault();
          const room = displayRooms[focusedCell?.roomIdx ?? -1];
          const dateStr = dates[focusedCell?.dateIdx ?? -1];
          if (room && dateStr) {
            const res = reservations.find(
              (r) =>
                r.room === room.number &&
                r.checkIn <= dateStr &&
                r.checkOut > dateStr &&
                r.status === "CONFIRMED"
            );
            if (res) {
              updateReservationStatus(res.id, "CHECKED_IN").then((result) => {
                if (result?.success && result?.data) {
                  setReservations((prev) =>
                    prev.map((r) => (r.id === res.id ? { ...r, status: "CHECKED_IN" } : r))
                  );
                  toast.success(`Zameldowano: ${res.guestName}`);
                }
              });
            }
          }
        }

        if ((e.key === "o" || e.key === "O") && focusedCell) {
          e.preventDefault();
          const room = displayRooms[focusedCell?.roomIdx ?? -1];
          const dateStr = dates[focusedCell?.dateIdx ?? -1];
          if (room && dateStr) {
            const res = reservations.find(
              (r) =>
                r.room === room.number &&
                r.checkIn <= dateStr &&
                r.checkOut > dateStr &&
                r.status === "CHECKED_IN"
            );
            if (res) {
              updateReservationStatus(res.id, "CHECKED_OUT").then((result) => {
                if (result?.success && result?.data) {
                  setReservations((prev) =>
                    prev.map((r) => (r.id === res.id ? { ...r, status: "CHECKED_OUT" } : r))
                  );
                  toast.success(`Wymeldowano: ${res.guestName}`);
                }
              });
            }
          }
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo, sheetOpen, createSheetOpen, displayRooms, dates, focusedCell, reservations, setReservations]);

  const handleCreateReservationClick = useCallback(() => {
    const defaultRoom = displayRooms[0] ?? allRooms[0];
    setNewReservationContext({
      roomNumber: defaultRoom?.number ?? "",
      checkIn: viewStartDateStr,
    });
    setCreateSheetOpen(true);
  }, [displayRooms, allRooms, viewStartDateStr]);

  const handleRoomLabelClick = useCallback((room: Room) => {
    setNewReservationContext({
      roomNumber: room.number,
      checkIn: viewStartDateStr,
    });
    setCreateSheetOpen(true);
  }, [viewStartDateStr]);

  const handleRoomBlock = useCallback((room: Room) => {
    setRoomBlockInitialRoom(room.number);
    setRoomBlockSheetOpen(true);
  }, []);

  const handleRoomStatusChange = useCallback(async (room: Room, status: RoomStatus) => {
    if (!room.id) {
      toast.error(`Brak ID pokoju ${room.number} - odśwież stronę`);
      return;
    }
    const result = await updateRoomStatus({ roomId: room.id, status });
    if (result?.success) {
      const effectiveStatus: RoomStatus = status === "INSPECTED" ? "CLEAN" : status;
      setAllRooms((prev) => {
        const updated = prev.map((r) => (r.number === room.number ? { ...r, status: effectiveStatus } : r));
        return updated;
      });
      broadcastRoomStatusChange();
      toast.success(`Status pokoju ${room.number} zmieniony na ${ROOM_STATUS_LABELS[effectiveStatus]}`);
    } else {
      toast.error(result.error ?? "Nie udało się zmienić statusu");
    }
  }, []);

  const togglePreviewMode = useCallback(() => {
    setPreviewMode((prev) => !prev);
  }, []);

  const handleMonthlyDateSelect = useCallback(
    (dateStr: string) => {
      const next = new Date(dateStr + "T12:00:00");
      if (!Number.isNaN(next.getTime())) {
        setViewStartDate(next);
      }
      setMonthlyDialogOpen(false);
    },
    []
  );

  useEffect(() => {
    const term = clientSearchTerm.trim().toLowerCase();
    if (!term) {
      setHighlightedReservationId(null);
      return;
    }
    const match = reservations.find((r) => r.guestName.toLowerCase().includes(term));
    if (match) {
      setHighlightedReservationId(match.id);
    } else {
      setHighlightedReservationId(null);
    }
  }, [clientSearchTerm, reservations]);

  /* Kolumny o stałej szerokości – siatka zawsze szersza niż kontener → przewijanie myszką we wszystkich widokach */
  const gridColumns = `${ROOM_LABEL_WIDTH_PX}px repeat(${dates.length}, ${effectiveColumnWidthPx}px)`;
  const gridRows = `${HEADER_ROW_PX}px repeat(${displayRooms.length}, ${effectiveRowHeightPx}px)`;

  const rowVirtualizer = useVirtualizer({
    count: displayRooms.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => effectiveRowHeightPx,
    overscan: 12,
    paddingStart: HEADER_ROW_PX,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const visibleRowSet = useMemo(() => {
    const set = new Set(virtualRows.map((v) => v.index + 2));
    if (ghostPlacement) set.add(ghostPlacement.gridRow);
    return set;
  }, [virtualRows, ghostPlacement?.gridRow]);
  const visiblePlacements = useMemo(
    () => reservationPlacements.filter((p) => visibleRowSet.has(p.gridRow)),
    [reservationPlacements, visibleRowSet]
  );

  const totalGridWidthPx = ROOM_LABEL_WIDTH_PX + dates.length * effectiveColumnWidthPx;
  const totalRowHeightPx = displayRooms.length * effectiveRowHeightPx;

  return (
    <div className="relative z-0 flex flex-1 min-h-0 flex-col">
      {previewMode && (
        <div className="bg-blue-500 text-white text-center py-2 text-sm font-medium no-print">
          Tryb podglądu – edycja wyłączona. Kliknij &quot;Zakończ podgląd&quot; aby wrócić do edycji.
        </div>
      )}
      <header
        className="relative z-[100] flex shrink-0 flex-col border-b border-[hsl(var(--kw-header-border))] bg-card no-print"
        role="toolbar"
        data-hide-print="true"
        aria-label="Nawigacja grafiku"
        style={{ pointerEvents: "auto", borderTopWidth: '3px', borderTopColor: 'hsl(var(--kw-header-border))' }}
      >
        {/* Row 1: Navigation + Primary Actions */}
        <div className="flex items-center justify-between gap-2 px-3 py-2 md:px-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={handlePrev} aria-label="Okres wstecz">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-8 px-2.5 gap-1 font-semibold" onClick={handleGoToToday} aria-label="Wróć do dziś" title="Ustaw widok od dziś">
              <CalendarDays className="h-3.5 w-3.5" />
              Dziś
            </Button>
            <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={handleNext} aria-label="Okres naprzód">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant={goToDateOpen ? "default" : "outline"}
              size="sm"
              className="gap-1 h-8"
              onClick={() => setGoToDateOpen((v) => !v)}
              aria-label="Przejdź do daty"
              aria-expanded={goToDateOpen}
            >
              <CalendarPlus className="h-3.5 w-3.5" />
              Data
            </Button>
            {goToDateOpen && (
              <div className="flex items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-1">
                <input
                  type="date"
                  value={goToDateValue}
                  onChange={(e) => setGoToDateValue(e.target.value)}
                  className="rounded border border-input bg-background px-2 py-0.5 text-sm h-7"
                  aria-label="Data do przejścia"
                />
                <Button type="button" size="sm" className="h-7" onClick={handleGoToDate}>
                  Idź
                </Button>
              </div>
            )}

            <div className="mx-1 h-5 w-px bg-border" />

            <div className="flex items-center rounded-md border bg-muted/30" role="group" aria-label="Skala widoku">
              {(Object.keys(VIEW_SCALE_CONFIG) as ViewScale[]).map((scale) => (
                <Button
                  key={scale}
                  type="button"
                  variant={viewScale === scale ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "rounded-none first:rounded-l-md last:rounded-r-md border-0 h-8 px-2.5 text-xs touch-manipulation",
                    viewScale === scale && "bg-primary text-primary-foreground"
                  )}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setViewScale(scale);
                    if (scale === "day" || scale === "week" || scale === "month") {
                      setViewStartDate(new Date(today));
                    } else {
                      const days = VIEW_SCALE_CONFIG[scale].days;
                      setViewStartDate(addDays(new Date(today), -Math.floor(days / 2)));
                    }
                    didScrollToTodayRef.current = false;
                  }}
                  title={`Widok: ${VIEW_SCALE_CONFIG[scale].label} (${VIEW_SCALE_CONFIG[scale].days} dni)`}
                >
                  {VIEW_SCALE_CONFIG[scale].label}
                </Button>
              ))}
            </div>

            <div className="flex items-center gap-0.5 rounded-md border bg-muted/30 px-0.5" role="group" aria-label="Wysokość wierszy">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 min-w-8 min-h-8 p-0 touch-manipulation"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleZoomOut(); }}
                disabled={zoomIndex === 0}
                title="Zmniejsz wysokość wierszy"
                aria-label="Zmniejsz wysokość wierszy"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <button
                type="button"
                className={cn(
                  "min-w-[2.5rem] h-8 px-1.5 flex items-center justify-center text-xs font-medium rounded transition-colors touch-manipulation select-none",
                  zoomIndex === ZOOM_LEVELS.length - 1
                    ? "text-muted-foreground cursor-default"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50 cursor-pointer"
                )}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (zoomIndex < ZOOM_LEVELS.length - 1) handleZoomIn(); }}
                disabled={zoomIndex === ZOOM_LEVELS.length - 1}
                title={zoomIndex === ZOOM_LEVELS.length - 1 ? `Maksymalna wysokość wierszy – ${Math.round(zoomMultiplier * 100)}%` : `Kliknij aby powiększyć wysokość – obecnie ${Math.round(zoomMultiplier * 100)}%`}
                aria-label={`Wysokość wierszy ${Math.round(zoomMultiplier * 100)}%`}
              >
                {Math.round(zoomMultiplier * 100)}%
              </button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 min-w-8 min-h-8 p-0 touch-manipulation"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleZoomIn(); }}
                disabled={zoomIndex === ZOOM_LEVELS.length - 1}
                title="Zwiększ wysokość wierszy"
                aria-label="Zwiększ wysokość wierszy"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>

            <div
              className={cn(
                "flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs",
                occupancyStats.percentage >= 80
                  ? "border-green-500/50 bg-green-50 text-green-700"
                  : occupancyStats.percentage >= 50
                    ? "border-yellow-500/50 bg-yellow-50 text-yellow-700"
                    : "border-muted bg-muted/30 text-muted-foreground"
              )}
              title={`${occupancyStats.occupiedNights} z ${occupancyStats.totalNights} pokojo-nocy zajętych`}
            >
              <span className="font-bold text-sm">{occupancyStats.percentage}%</span>
              <span className="opacity-75">zajętości</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {selectedReservationIds.size > 0 && (
              <div className="flex items-center gap-1.5 rounded-md border border-amber-500 bg-amber-500/10 px-2.5 py-1">
                <span className="text-xs font-medium text-amber-700">
                  Zaznaczono: {selectedReservationIds.size}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 px-1.5 text-[10px]"
                  onClick={() => setSelectedReservationIds(new Set())}
                >
                  Wyczyść
                </Button>
              </div>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => undo()}
              disabled={!canUndo}
              aria-label="Cofnij (Ctrl+Z)"
              title="Cofnij (Ctrl+Z)"
            >
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => redo()}
              disabled={!canRedo}
              aria-label="Ponów (Ctrl+Y)"
              title="Ponów (Ctrl+Y)"
            >
              <Redo2 className="h-4 w-4" />
            </Button>

            <div className="mx-1 h-5 w-px bg-border" />

            <Button variant="default" size="sm" className="gap-1.5 h-8 font-semibold" onClick={handleCreateReservationClick} data-testid="create-reservation-open-btn">
              <Plus className="h-4 w-4" />
              Zarezerwuj
            </Button>

            <Button
              variant={filtersOpen ? "secondary" : "outline"}
              size="sm"
              className="gap-1 h-8"
              onClick={() => setFiltersOpen((v) => !v)}
              title="Filtry i wyszukiwanie"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filtry
              <ChevronDown className={cn("h-3 w-3 transition-transform", filtersOpen && "rotate-180")} />
            </Button>

            <div className="relative" ref={moreMenuRef}>
              <Button
                variant={moreMenuOpen ? "secondary" : "outline"}
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setMoreMenuOpen((v) => !v)}
                title="Więcej opcji"
                aria-label="Więcej opcji"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
              {moreMenuOpen && (
                <div className="absolute right-0 top-full mt-1 z-[200] w-56 rounded-md border border-[hsl(var(--kw-grid-border))] bg-card shadow-lg py-1">
                  <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50" onClick={() => { setGroupReservationSheetOpen(true); setMoreMenuOpen(false); }}>
                    <Users className="h-4 w-4 text-muted-foreground" /> Rezerwacja grupowa
                  </button>
                  <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50" onClick={() => { setRoomBlockSheetOpen(true); setMoreMenuOpen(false); }}>
                    <Ban className="h-4 w-4 text-muted-foreground" /> Wyłącz pokój
                  </button>
                  <div className="mx-2 my-1 h-px bg-border" />
                  <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50" onClick={() => { setMonthlyDialogOpen(true); setMoreMenuOpen(false); }}>
                    <CalendarDays className="h-4 w-4 text-muted-foreground" /> Widok miesięczny
                  </button>
                  <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50" onClick={() => { setFloorPlanDialogOpen(true); setMoreMenuOpen(false); }}>
                    <Building2 className="h-4 w-4 text-muted-foreground" /> Plan pięter
                  </button>
                  <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50" onClick={() => { setDailyMovementsDialogOpen(true); setMoreMenuOpen(false); }}>
                    <ListChecks className="h-4 w-4 text-muted-foreground" /> Przyjazdy/wyjazdy
                  </button>
                  <div className="mx-2 my-1 h-px bg-border" />
                  <button type="button" className={cn("flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50", previewMode && "text-primary font-medium")} onClick={() => { togglePreviewMode(); setMoreMenuOpen(false); }}>
                    <Eye className="h-4 w-4 text-muted-foreground" /> {previewMode ? "Zakończ podgląd" : "Podgląd"}
                  </button>
                  <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50" onClick={() => { setLegendDialogOpen(true); setMoreMenuOpen(false); }}>
                    <Layers className="h-4 w-4 text-muted-foreground" /> Legenda
                  </button>
                  <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50" onClick={() => { setStatusColorsDialogOpen(true); setMoreMenuOpen(false); }}>
                    <Filter className="h-4 w-4 text-muted-foreground" /> Kolory statusów
                  </button>
                  <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50" onClick={() => { router.refresh(); setMoreMenuOpen(false); toast.info("Odświeżanie danych…"); }} title="Pobierz aktualne dane z serwera (rezerwacje, kolory)">
                    <RefreshCw className="h-4 w-4 text-muted-foreground" /> Odśwież
                  </button>
                  <div className="mx-2 my-1 h-px bg-border" />
                  <div className="flex items-center gap-2 px-3 py-2">
                    <div className="flex items-center rounded-md border border-input bg-background">
                      <button type="button" className={cn("px-2.5 py-1 text-xs rounded-l-md", colorMode === "status" ? "bg-primary text-primary-foreground" : "hover:bg-muted/50")} onClick={() => setColorMode("status")}>Status</button>
                      <button type="button" className={cn("px-2.5 py-1 text-xs rounded-r-md", colorMode === "source" ? "bg-primary text-primary-foreground" : "hover:bg-muted/50")} onClick={() => setColorMode("source")}>Kanał</button>
                    </div>
                  </div>
                  <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50" onClick={() => { handleOpenExportDialog(); setMoreMenuOpen(false); }}>
                    <Printer className="h-4 w-4 text-muted-foreground" /> Eksport PDF
                  </button>
                  <div className="mx-2 my-1 h-px bg-border" />
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-xs text-muted-foreground">Prywatność</span>
                    <Switch id="privacy-mode" checked={privacyMode} onCheckedChange={setPrivacyMode} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Row 2: Quick Stats Bar */}
        <div className="flex items-center gap-3 border-t border-[hsl(var(--kw-grid-border))] bg-[hsl(var(--kw-room-label-bg))] px-3 py-1.5 md:px-4 text-xs">
          <button type="button" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-md px-1.5 py-0.5 hover:bg-muted/50" title="Dzisiejsze przyjazdy – kliknij aby zobaczyć listę" onClick={() => { setQuickStatsTab("arrivals"); setQuickStatsOpen(true); }}>
            <LogIn className="h-3.5 w-3.5 text-green-600" />
            <span>Przyjazdy:</span>
            <span className="font-bold text-foreground">{todayQuickStats.arrivals}</span>
          </button>
          <div className="h-3 w-px bg-border" />
          <button type="button" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-md px-1.5 py-0.5 hover:bg-muted/50" title="Dzisiejsze wyjazdy – kliknij aby zobaczyć listę" onClick={() => { setQuickStatsTab("departures"); setQuickStatsOpen(true); }}>
            <LogOut className="h-3.5 w-3.5 text-blue-600" />
            <span>Wyjazdy:</span>
            <span className="font-bold text-foreground">{todayQuickStats.departures}</span>
          </button>
          <div className="h-3 w-px bg-border" />
          <button type="button" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-md px-1.5 py-0.5 hover:bg-muted/50" title="Pokoje do posprzątania – kliknij aby zobaczyć listę" onClick={() => { setQuickStatsTab("dirty"); setQuickStatsOpen(true); }}>
            <SprayCan className="h-3.5 w-3.5 text-amber-500" />
            <span>Do sprzątania:</span>
            <span className={cn("font-bold", todayQuickStats.dirtyRooms > 0 ? "text-amber-600" : "text-foreground")}>{todayQuickStats.dirtyRooms}</span>
          </button>
          <div className="h-3 w-px bg-border" />
          <button type="button" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-md px-1.5 py-0.5 hover:bg-muted/50" title="Aktualnie zameldowani goście – kliknij aby zobaczyć listę" onClick={() => { setQuickStatsTab("checkedIn"); setQuickStatsOpen(true); }}>
            <BedDouble className="h-3.5 w-3.5 text-primary" />
            <span>Zameldowani:</span>
            <span className="font-bold text-foreground">{todayQuickStats.checkedInNow}</span>
          </button>
          <div className="h-3 w-px bg-border" />
          <div className="flex items-center gap-1.5 text-muted-foreground">
            {showOnlyRoomNumber ? (
              <button
                type="button"
                onClick={() => setShowOnlyRoomNumber(null)}
                className="flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-muted/50 hover:text-foreground"
                title="Pokaż wszystkie pokoje"
              >
                <span>Pokój {showOnlyRoomNumber}</span>
                <span className="text-primary">×</span>
              </button>
            ) : (
              <span>{displayRooms.length} pokoi</span>
            )}
            <span className="text-muted-foreground/60">·</span>
            <span>{filteredReservations.length} rez.</span>
          </div>
        </div>

        {/* Collapsible Filters Row */}
        {filtersOpen && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-[hsl(var(--kw-grid-border))] bg-card px-3 py-2 md:px-4">
            <div className="flex items-center gap-1.5">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={roomFilter}
                onChange={(e) => setRoomFilter(e.target.value)}
                className="h-7 w-36 rounded-md border border-input bg-background px-2 text-xs"
                placeholder="Numer / typ pokoju"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <UserSearch className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={clientSearchTerm}
                onChange={(e) => setClientSearchTerm(e.target.value)}
                className="h-7 w-40 rounded-md border border-input bg-background px-2 text-xs"
                placeholder="Imię / nazwisko gościa"
              />
            </div>
            {groups.length > 0 && (
              <select
                value={selectedGroupId ?? ""}
                onChange={(e) => setSelectedGroupId(e.target.value || null)}
                className="h-7 rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="">Wszystkie grupy</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name ?? "Bez nazwy"} ({group.reservationCount})
                  </option>
                ))}
              </select>
            )}
            {roomTypeOptions.length > 0 && (
              <select
                name="roomType"
                data-testid="room-type-filter"
                value={roomTypeFilter}
                onChange={(e) => setRoomTypeFilter(e.target.value)}
                className="h-7 rounded-md border border-input bg-background px-2 text-xs"
                title="Typ pokoju"
              >
                <option value="">Wszystkie typy</option>
                {roomTypeOptions.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            )}
            {floorOptions.length > 0 && (
              <select
                name="floor"
                data-testid="floor-filter"
                value={floorFilter}
                onChange={(e) => setFloorFilter(e.target.value)}
                className="h-7 rounded-md border border-input bg-background px-2 text-xs"
                title="Piętro"
              >
                <option value="">Wszystkie piętra</option>
                {floorOptions.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            )}
            {allAvailableFeatures.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Cechy:</span>
                {allAvailableFeatures.map((feat) => (
                  <label key={feat} className="flex items-center gap-1 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={roomFeaturesFilter.includes(feat)}
                      onChange={(e) => {
                        setRoomFeaturesFilter((prev) =>
                          e.target.checked ? [...prev, feat] : prev.filter((x) => x !== feat)
                        );
                      }}
                      className="rounded border-input h-3.5 w-3.5"
                    />
                    {feat}
                  </label>
                ))}
              </div>
            )}

            <div className="mx-1 h-4 w-px bg-border" />

            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer" title="Pokaż tylko rezerwacje należące do grup (np. wycieczki, konferencje)">
              <ListFilter className="h-3.5 w-3.5" /> Tylko grupowe
              <Switch checked={showGroupOnly} onCheckedChange={setShowGroupOnly} className="scale-75" />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer" title="Grupuj pokoje wg typu (np. Standard, Deluxe) zamiast listy numerów">
              <Layers className="h-3.5 w-3.5" /> Grupowanie
              <Switch checked={groupingEnabled} onCheckedChange={setGroupingEnabled} className="scale-75" />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer" title="Tryb hostelowy – sprzedaż pojedynczych łóżek w pokoju wieloosobowym">
              <BedDouble className="h-3.5 w-3.5" /> Hostel
              <Switch checked={hostelMode} onCheckedChange={setHostelMode} className="scale-75" />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer" title="Pokaż tylko pokoje bez rezerwacji w widocznym zakresie dat">
              <DoorOpen className="h-3.5 w-3.5" /> Wolne
              <Switch checked={showOnlyFreeRooms} onCheckedChange={setShowOnlyFreeRooms} className="scale-75" />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer" title="Podświetl rezerwacje nakładające się na ten sam pokój (konflikty terminów)">
              <AlertTriangle className="h-3.5 w-3.5" /> Konflikty
              <Switch checked={highlightConflicts} onCheckedChange={setHighlightConflicts} className="scale-75" />
              {highlightConflicts && conflictingReservationIds.size > 0 && (
                <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] text-white leading-none">
                  {conflictingReservationIds.size}
                </span>
              )}
            </label>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer" title="Pokaż przerwy między dniami na paskach rezerwacji (lepsza czytelność przy krótkich pobytach)">
              <Filter className="h-3.5 w-3.5" /> Podział dni
              <Switch checked={styleSplitByDay} onCheckedChange={setStyleSplitByDay} className="scale-75" />
            </label>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer" title="Przeciągaj rezerwacje bez trzymania klawisza Shift (wygodniejsze, ale łatwiej o przypadkowe przesunięcie)">
              <Hand className="h-3.5 w-3.5" /> Drag bez Shift
              <Switch checked={dragWithoutShift} onCheckedChange={setDragWithoutShift} className="scale-75" />
            </label>
          </div>
        )}
      </header>

      {/* Grid wrapper + overview bar – scrollable; mini mapa absolute, żeby zawsze do końca ekranu */}
      <div className="relative flex flex-1 min-h-0">
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-auto p-1.5 sm:p-2 md:p-3 min-w-0 tape-chart-scroll-area mr-[44px]"
          style={{ willChange: "scroll-position" }}
        >
        {displayRooms.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
            <BedDouble className="h-12 w-12 opacity-50" />
            <p className="font-medium">Brak pokoi do wyświetlenia</p>
            <p className="text-sm max-w-md">
              Dodaj pokoje w module <strong>Pokoje</strong> lub wyłącz filtry (np. „Wolne”), aby zobaczyć grafik rezerwacji (wykres Gantta, kratki i paski).
            </p>
          </div>
        ) : (
        <DndContext
          sensors={sensors}
          onDragStart={({ active }) => {
            console.log("DRAG START", active.id);
            setActiveId(active.id as string);
          }}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
          onDragCancel={() => { setActiveId(null); setGhostPreview(null); }}
        >
          <div
            ref={gridWrapperRef}
            data-grid-draggable
            className="relative w-full min-w-max cursor-grab active:cursor-grabbing"
            style={{ height: rowVirtualizer.getTotalSize(), minWidth: totalGridWidthPx }}
            onMouseDown={handleGridPointerDown}
          >
            {/* Sticky header: corner + date columns */}
            <div
              className="sticky top-0 z-[60] grid w-full min-w-max border-b border-[hsl(var(--kw-grid-border))]"
              style={{
                gridTemplateColumns: gridColumns,
                gridTemplateRows: `${HEADER_ROW_PX}px`,
                minHeight: HEADER_ROW_PX,
                maxHeight: HEADER_ROW_PX,
                background: "hsl(var(--kw-room-label-bg))",
              }}
            >
              <div className="flex items-center px-3 py-2 text-sm font-semibold border-r border-[hsl(var(--kw-grid-border))]">
                Pokój
              </div>
              {dates.map((dateStr, i) => {
                const isToday = dateStr === todayStr;
                const saturday = isSaturdayDate(dateStr);
                const sunday = isSundayDate(dateStr);
                return (
                  <div
                    key={dateStr}
                    data-date-header
                    className={cn(
                      "flex items-center justify-center border-r border-[hsl(var(--kw-grid-border))] px-2 py-2 text-center text-xs font-medium cursor-grab active:cursor-grabbing",
                      isToday ? "kw-header-today text-[13px]" : saturday ? "kw-header-saturday" : sunday ? "kw-header-sunday" : "kw-header-default"
                    )}
                    style={{ minWidth: effectiveColumnWidthPx }}
                  >
                    {formatDateHeader(dateStr, todayStr)}
                  </div>
                );
              })}
            </div>

            {/* Virtualized room rows – render dopiero po mount (unika hydratacji: virtualizer inny na SSR) */}
            <div
              className="relative w-full"
              style={{ height: totalRowHeightPx }}
            >
              {mounted && virtualRows.map((virtualRow) => {
                const room = displayRooms[virtualRow.index];
                if (!room) return null;
                return (
                  <div
                    key={`${room.number}-${room.status}-${virtualRow.key}`}
                    data-index={virtualRow.index}
                    data-room-row
                    ref={rowVirtualizer.measureElement}
                    className="absolute left-0 grid w-full min-w-max"
                    style={{
                      top: virtualRow.start - HEADER_ROW_PX,
                      height: virtualRow.size,
                      gridTemplateColumns: gridColumns,
                      gridTemplateRows: "1fr",
                    }}
                  >
                    <RoomRowDroppable
                      room={room}
                      rowIdx={virtualRow.index}
                      dates={dates}
                      columnWidthPx={effectiveColumnWidthPx}
                      rowHeightPx={effectiveRowHeightPx}
                      virtualizedRow
                      blockedRanges={room.blocks?.map((block) => ({
                        startDate: block.startDate,
                        endDate: block.endDate,
                        reason: block.reason,
                      }))}
                      focusedDateIdx={focusedCell?.roomIdx === virtualRow.index ? focusedCell.dateIdx : undefined}
                      previewMode={previewMode}
                      onCellClick={previewMode ? undefined : (roomNumber, dateStr) => {
                        if (didPanRef.current) {
                          didPanRef.current = false;
                          return;
                        }
                        setNewReservationContext({ roomNumber, checkIn: dateStr });
                        setCreateSheetOpen(true);
                      }}
                      onRoomLabelClick={previewMode ? undefined : handleRoomLabelClick}
                      onRoomBlock={previewMode ? undefined : handleRoomBlock}
                      onRoomStatusChange={previewMode ? undefined : handleRoomStatusChange}
                      onShowOnlyRoom={previewMode ? undefined : (r) => setShowOnlyRoomNumber(r.number)}
                      onShowAllRooms={showOnlyRoomNumber ? () => setShowOnlyRoomNumber(null) : undefined}
                      showOnlyRoomNumber={showOnlyRoomNumber}
                    >
                      <div
                        className="flex items-center gap-1.5 min-w-0 flex-1"
                        title={[room.type, room.price != null ? `${room.price} PLN/dobę` : null, ROOM_STATUS_LABELS[room.status]].filter(Boolean).join(" · ")}
                      >
                        <span className="font-semibold text-[13px] leading-tight shrink-0 tabular-nums">{room.number}</span>
                        <span className="text-muted-foreground/60 shrink-0">·</span>
                        {/widok|jezioro/i.test(room.type) || (room.roomFeatures ?? []).some((f) => /widok|jezioro/i.test(f)) ? (
                          <Waves className="h-2.5 w-2.5 text-blue-500 shrink-0" aria-label="Z widokiem na jezioro" />
                        ) : null}
                        <span className="truncate text-[10px] text-muted-foreground leading-tight">{room.type}</span>
                        {hostelMode && (
                          <span className="text-[8px] text-muted-foreground shrink-0 tabular-nums">
                            ({occupancyToday.get(room.number) ?? 0})
                          </span>
                        )}
                      </div>
                      <RoomStatusIcon status={room.status} showLabel={false} compact />
                    </RoomRowDroppable>
                  </div>
                );
              })}
            </div>

            {/* Today column highlight – KWHotel yellow (overlay) */}
            {dates.indexOf(todayStr) >= 0 && (
              <>
                <div
                  className="pointer-events-none absolute z-[5] kw-today-column"
                  style={{
                    left: ROOM_LABEL_WIDTH_PX + dates.indexOf(todayStr) * effectiveColumnWidthPx,
                    top: HEADER_ROW_PX,
                    width: effectiveColumnWidthPx,
                    height: totalRowHeightPx,
                  }}
                  aria-hidden="true"
                />
                <div
                  className="pointer-events-none absolute z-[6] kw-today-column-line"
                  style={{
                    left: ROOM_LABEL_WIDTH_PX + dates.indexOf(todayStr) * effectiveColumnWidthPx,
                    top: HEADER_ROW_PX,
                    width: effectiveColumnWidthPx,
                    height: totalRowHeightPx,
                  }}
                  aria-hidden="true"
                />
              </>
            )}

            {/* Reservation bars – overlay, tylko widoczne wiersze (po mount, unika hydratacji) */}
            <div
              className="absolute inset-0 pointer-events-none overflow-visible"
              style={{ zIndex: 50, gridTemplateColumns: gridColumns, gridTemplateRows: gridRows, display: "grid" }}
            >
              {mounted && visiblePlacements.map(({ reservation, gridRow, gridColumnStart, gridColumnEnd, barLeftPercent, barWidthPercent }) => {
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
                  const barHeightPx = effectiveRowHeightPx;
                  const barWidthPx = Math.round(barWidthPercent * (gridColumnEnd - gridColumnStart) * effectiveColumnWidthPx);
                  // Source-based coloring
                  const reservationSource = reservation.rateCodeName ?? reservation.rateCode ?? "Recepcja";
                  const sourceColor = sourceColors.get(reservationSource);
                  const effectiveStatusBg = colorMode === "source" && sourceColor
                    ? { [reservation.status]: sourceColor }
                    : statusBg ?? undefined;
                  return (
                  <div
                    key={reservation.id}
                    className={cn(
                      "pointer-events-auto overflow-hidden flex items-center relative",
                      previewMode ? "cursor-default" : "cursor-grab active:cursor-grabbing",
                      highlightedReservationId === reservation.id &&
                        "ring-2 ring-primary rounded-md z-10",
                      selectedReservationIds.has(reservation.id) &&
                        "ring-2 ring-amber-500 rounded-md"
                    )}
                    data-highlighted-reservation={
                      highlightedReservationId === reservation.id ? "true" : undefined
                    }
                    data-selected={selectedReservationIds.has(reservation.id) ? "true" : undefined}
                    data-reservation-id={reservation.id}
                    style={{
                      gridColumn: `${gridColumnStart} / ${gridColumnEnd}`,
                      gridRow,
                      alignSelf: "stretch",
                      minHeight: barHeightPx,
                      marginBottom: -1,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (previewMode) return; // No actions in preview mode
                      if (activeId !== reservation.id) {
                        // Multi-select with Ctrl/Cmd
                        if (e.ctrlKey || e.metaKey) {
                          setSelectedReservationIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(reservation.id)) {
                              next.delete(reservation.id);
                            } else {
                              next.add(reservation.id);
                            }
                            return next;
                          });
                        } else {
                          const clickedDate = getDateFromClientX(e.clientX);
                          if (clickedDate === reservation.checkOut) {
                            setNewReservationContext({ roomNumber: reservation.room, checkIn: reservation.checkOut });
                            setCreateSheetOpen(true);
                            setSelectedReservationIds(new Set());
                          } else {
                            setSelectedReservationIds(new Set());
                            setSelectedReservation(reservation);
                            setEditInitialTab("rozliczenie");
                            setSheetOpen(true);
                            setHighlightedReservationId(null);
                          }
                        }
                      }
                    }}
                  >
                    <div className="absolute inset-y-0 flex items-stretch" style={{ left: `${(barLeftPercent ?? 0) * 100}%`, width: `${barWidthPercent * 100}%`, minWidth: 0 }}>
                    <ReservationBarWithMenu
                      reservation={reservation}
                      gridRow={0}
                      gridColumnStart={0}
                      gridColumnEnd={0}
                      privacyMode={privacyMode}
                      isDragging={activeId === reservation.id}
                      pricePerNight={pricePerNight}
                      totalAmount={totalAmount}
                      dates={dates}
                      getDateFromClientX={getDateFromClientX}
                      onResize={handleResize}
                      onSplitClick={(r) => setSplitDialogReservation(r)}
                      statusBg={effectiveStatusBg}
                      hasConflict={conflictingReservationIds.has(reservation.id)}
                      isCheckInToday={reservation.checkIn === todayStr && reservation.status === "CONFIRMED"}
                      barWidthPx={barWidthPx}
                      barHeightPx={barHeightPx}
                      showFullInfo={viewScale === "day"}
                      onEdit={(r, initialTab) => {
                        setSelectedReservation(r);
                        setEditInitialTab(initialTab ?? "rozliczenie");
                        setSheetOpen(true);
                      }}
                      onStatusChange={(updated) => {
                        setReservations((prev) =>
                          prev.map((r) => (r.id === updated.id ? updated : r))
                        );
                      }}
                      onDuplicate={(r) => {
                        // Pre-fill create form with duplicated data
                        setNewReservationContext({
                          roomNumber: r.room,
                          checkIn: r.checkIn,
                          checkOut: r.checkOut,
                          guestName: r.guestName,
                          pax: r.pax,
                          notes: r.notes ? `(Kopia) ${r.notes}` : "(Kopia)",
                          rateCodeId: r.rateCodeId,
                        });
                        setCreateSheetOpen(true);
                      }}
                      onExtendStay={async (r, newCheckOut) => {
                        const { updateReservation } = await import("@/app/actions/reservations");
                        const result = await updateReservation(r.id, { checkOut: newCheckOut });
                        if (result?.success && result?.data) {
                          setReservations((prev) =>
                            prev.map((res) => (res.id === r.id ? { ...res, checkOut: newCheckOut } : res))
                          );
                          toast.success(`Pobyt przedłużony do ${newCheckOut}`);
                        } else if ("error" in result) {
                          toast.error(result.error ?? "Błąd przedłużania pobytu");
                        }
                      }}
                    />
                    </div>
                  </div>
                );
                })}
              </div>
            </div>
            {/* Sentinel dla lazy loading: przy scrollu w prawo doładowujemy kolejne dni */}
            <div
              ref={sentinelRef}
              aria-hidden="true"
              className="absolute top-0 h-1 w-6"
              style={{
                left: ROOM_LABEL_WIDTH_PX + dates.length * effectiveColumnWidthPx - 8,
                pointerEvents: "none",
              }}
            />
            <DragOverlay dropAnimation={null}>
              {activeId ? (() => {
                const res = reservations.find((r) => r.id === activeId);
                if (!res) return null;
                const nights =
                  Math.ceil(
                    (new Date(res.checkOut).getTime() - new Date(res.checkIn).getTime()) /
                      (1000 * 60 * 60 * 24)
                  ) || 1;
                const w = nights * effectiveColumnWidthPx;
                const h = Math.max(16, effectiveRowHeightPx - 4);
                const bg =
                  RESERVATION_STATUS_BG[res.status as keyof typeof RESERVATION_STATUS_BG] ??
                  RESERVATION_STATUS_BG.CONFIRMED;
                return (
                  <div
                    className="flex items-center justify-center rounded border border-black text-white font-semibold text-xs overflow-hidden whitespace-nowrap cursor-grabbing"
                    style={{
                      width: w,
                      height: h,
                      minWidth: 40,
                      backgroundColor: bg,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                      userSelect: "none",
                      pointerEvents: "none",
                      padding: "0 6px",
                    }}
                  >
                    <span className="truncate">{res.guestName}</span>
                  </div>
                );
              })() : null}
            </DragOverlay>
        </DndContext>
        )}
        </div>
        {displayRooms.length > 0 && (
          <div className="absolute right-0 top-0 bottom-0 w-[44px] shrink-0 pointer-events-auto">
            <TapeChartOverviewBar
              dates={dates}
              reservations={filteredReservations}
              roomsCount={displayRooms.length}
              todayStr={todayStr}
              columnWidthPx={effectiveColumnWidthPx}
              scrollContainerRef={scrollContainerRef}
            />
          </div>
        )}
      </div>
      <section className="shrink-0 border-t border-[hsl(var(--kw-grid-border))] bg-[hsl(var(--kw-room-label-bg))] no-print" data-hide-print="true">
        <button
          type="button"
          className="flex w-full items-center justify-between px-4 py-1.5 text-xs text-muted-foreground hover:bg-muted/30 transition-colors"
          onClick={() => setFooterOpen((v) => !v)}
        >
          <span className="flex items-center gap-2">
            <Layers className="h-3.5 w-3.5" />
            Legenda i statystyki
          </span>
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", footerOpen && "rotate-180")} />
        </button>
        {footerOpen && (
          <div className="px-4 pb-3">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {statusTabOptions.map((option) => (
                <Button
                  key={option.id}
                  type="button"
                  variant={statusTab === option.id ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setStatusTab(option.id)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              {statusTab === "statuses" && (
                <>
                  {statusLegendItems.map((item) => (
                    <div key={item.status} className="flex items-center gap-2">
                      <span
                        className="inline-block h-3 w-6 rounded-sm border border-border"
                        style={{ backgroundColor: statusBg?.[item.status] ?? item.color }}
                        aria-hidden="true"
                      />
                      <span className="text-xs">{item.label}</span>
                    </div>
                  ))}
                  <span className="mx-1 h-4 w-px bg-border" aria-hidden />
                  <span className="text-[10px] text-muted-foreground mr-1">Pasek z lewej:</span>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-3 w-1 rounded-full bg-[rgb(20_184_166)]" aria-hidden title="Opłacona" />
                    <span className="text-xs">Opłacona</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-3 w-1 rounded-full bg-[rgb(234_179_8)]" aria-hidden title="Częściowo opłacona" />
                    <span className="text-xs">Częściowo opłacona</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-3 w-1 rounded-full bg-[rgb(139_92_246)]" aria-hidden title="Nieopłacona" />
                    <span className="text-xs">Nieopłacona</span>
                  </div>
                  <span className="mx-1 h-4 w-px bg-border" aria-hidden />
                  <div className="flex items-center gap-2">
                    <StickyNote className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                    <span className="text-xs">Ma uwagi</span>
                  </div>
                </>
              )}
              {statusTab === "roomStatus" && (
                <div className="flex flex-wrap items-center gap-3">
                  {(Object.keys(ROOM_STATUS_LABELS) as RoomStatus[]).map((status) => (
                    <div key={status} className="flex items-center gap-2">
                      <RoomStatusIcon status={status} showLabel={false} compact />
                      <span className="text-xs">{ROOM_STATUS_LABELS[status]}</span>
                    </div>
                  ))}
                </div>
              )}
              {statusTab === "custom" && (
                <p className="text-xs text-muted-foreground">
                  Dodatkowe statusy możesz zdefiniować w module Rezerwacje &gt; Konfiguracja.
                </p>
              )}
              {statusTab === "sources" && (
                <div className="flex flex-wrap gap-3">
                  {sourceSummary.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Brak danych o źródłach rezerwacji.</p>
                  ) : (
                    sourceSummary.slice(0, 10).map(([source, count]) => (
                      <div key={source} className="flex items-center gap-1.5 rounded-md border bg-background px-2 py-1.5">
                        <span
                          className="inline-block h-3 w-3 rounded-sm shrink-0"
                          style={{ backgroundColor: sourceColors.get(source) }}
                          aria-hidden="true"
                        />
                        <div>
                          <p className="font-medium text-xs">{source}</p>
                          <p className="text-[10px] text-muted-foreground">{count} rez.</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
              {statusTab === "prices" && (
                <div>
                  {priceSummary ? (
                    <div className="flex flex-wrap gap-3">
                      <div className="rounded-md border bg-background px-2.5 py-1.5">
                        <p className="text-[10px] text-muted-foreground">Śr. stawka / noc</p>
                        <p className="text-sm font-semibold">{priceSummary.avg} PLN</p>
                      </div>
                      <div className="rounded-md border bg-background px-2.5 py-1.5">
                        <p className="text-[10px] text-muted-foreground">Zakres</p>
                        <p className="text-sm font-semibold">
                          {priceSummary.min} – {priceSummary.max} PLN
                        </p>
                      </div>
                      <div className="rounded-md border bg-background px-2.5 py-1.5">
                        <p className="text-[10px] text-muted-foreground">Rez. z ceną</p>
                        <p className="text-sm font-semibold">{priceSummary.count}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Brak danych o cenach.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </section>
      <MonthlyOverviewDialog
        open={monthlyDialogOpen}
        onOpenChange={setMonthlyDialogOpen}
        reservations={reservations}
        rooms={allRooms}
        onSelectDate={handleMonthlyDateSelect}
      />
      <FloorPlanDialog
        open={floorPlanDialogOpen}
        onOpenChange={setFloorPlanDialogOpen}
        rooms={displayRooms}
        reservations={reservations}
        todayStr={todayStr}
        statusBg={statusBg}
      />
      <DailyMovementsDialog
        open={dailyMovementsDialogOpen}
        onOpenChange={setDailyMovementsDialogOpen}
        reservations={reservations}
        initialDate={todayStr}
      />
      <QuickStatsDialog
        open={quickStatsOpen}
        onOpenChange={setQuickStatsOpen}
        initialTab={quickStatsTab}
        reservations={reservations}
        allRooms={allRooms}
        todayStr={todayStr}
      />
      <GroupReservationSheet
        open={groupReservationSheetOpen}
        onOpenChange={setGroupReservationSheetOpen}
        rooms={allRooms}
        defaultDate={viewStartDateStr}
        onCreated={(createdReservations, group) => {
          setReservations((prev) => [...prev, ...createdReservations]);
          setGroups((prev) => {
            const existing = prev.find((g) => g.id === group.id);
            if (existing) {
              return prev.map((g) =>
                g.id === group.id
                  ? {
                      ...g,
                      reservationCount: g.reservationCount + createdReservations.length,
                    }
                  : g
              );
            }
            return [
              { id: group.id, name: group.name, reservationCount: createdReservations.length },
              ...prev,
            ];
          });
          setSelectedGroupId(group.id);
          setShowGroupOnly(true);
        }}
      />
      <RoomBlockSheet
        open={roomBlockSheetOpen}
        onOpenChange={(open) => {
          setRoomBlockSheetOpen(open);
          if (!open) setRoomBlockInitialRoom(null);
        }}
        rooms={allRooms}
        initialRoomNumber={roomBlockInitialRoom}
        onCreated={(block) => {
          setAllRooms((prev) =>
            prev.map((room) =>
              room.number === block.roomNumber
                ? { ...room, blocks: [...(room.blocks ?? []), block] }
                : room
            )
          );
        }}
        onDeleted={(blockId) => {
          setAllRooms((prev) =>
            prev.map((room) => ({
              ...room,
              blocks: room.blocks?.filter((block) => block.id !== blockId),
            }))
          );
        }}
      />
      <UnifiedReservationDialog
        mode="edit"
        reservation={selectedReservation}
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) setEditInitialTab(undefined);
        }}
        initialTab={editInitialTab}
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
      <UnifiedReservationDialog
        mode="create"
        createContext={newReservationContext}
        open={createSheetOpen}
        onOpenChange={setCreateSheetOpen}
        rooms={allRooms}
        onCreated={(newRes) => {
          setReservations((prev) => [...prev, newRes]);
          if (newRes.groupId) {
            setGroups((prev) => {
              const gid = newRes.groupId!;
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
      <StatusColorsDialog
        propertyId={propertyId}
        open={statusColorsDialogOpen}
        onOpenChange={setStatusColorsDialogOpen}
        initialColors={statusBg}
        onSaved={setStatusBg}
      />
      <Dialog open={legendDialogOpen} onOpenChange={setLegendDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Legenda statusów rezerwacji</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {statusLegendItems.map((item) => {
              const color = statusBg?.[item.status] ?? item.color;
              return (
                <div key={item.status} className="flex items-start gap-3">
                  <span
                    className="mt-0.5 inline-block h-5 w-10 flex-shrink-0 rounded border border-border"
                    style={{ backgroundColor: color }}
                    aria-hidden
                  />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">{item.label}</span>
                    <span className="text-xs text-muted-foreground">{item.description}</span>
                  </div>
                </div>
              );
            })}
            <div className="border-t pt-4 mt-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">Pasek z lewej – status płatności</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-4 w-1 flex-shrink-0 rounded-full" style={{ backgroundColor: "rgb(20 184 166)" }} aria-hidden />
                  <span className="text-sm">Opłacona</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block h-4 w-1 flex-shrink-0 rounded-full" style={{ backgroundColor: "rgb(234 179 8)" }} aria-hidden />
                  <span className="text-sm">Częściowo opłacona</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block h-4 w-1 flex-shrink-0 rounded-full" style={{ backgroundColor: "rgb(139 92 246)" }} aria-hidden />
                  <span className="text-sm">Nieopłacona</span>
                </div>
                <p className="text-xs font-medium text-muted-foreground mb-2 mt-4">Ikona na pasku</p>
                <div className="flex items-center gap-2">
                  <StickyNote className="h-4 w-4 text-muted-foreground" aria-hidden />
                  <span className="text-sm">Ma uwagi</span>
                </div>
                <p className="text-xs font-medium text-muted-foreground mb-2 mt-4">Status pokoju (ikony przy liście)</p>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(ROOM_STATUS_LABELS) as RoomStatus[]).map((status) => (
                    <div key={status} className="flex items-center gap-1.5">
                      <RoomStatusIcon status={status} showLabel={false} compact />
                      <span className="text-xs">{ROOM_STATUS_LABELS[status]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <SplitReservationDialog
        reservation={splitDialogReservation}
        open={!!splitDialogReservation}
        onOpenChange={(open) => !open && setSplitDialogReservation(null)}
        onSplit={(first, second) => {
          const origId = splitDialogReservation?.id;
          if (origId) {
            setReservations((prev) =>
              prev.filter((r) => r.id !== origId).concat([first, second])
            );
          }
          setSplitDialogReservation(null);
        }}
        rooms={allRooms}
      />
      {/* Export PDF Dialog */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eksport grafiku do PDF</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Data początkowa</label>
                <input
                  type="date"
                  value={exportStartDate}
                  onChange={(e) => setExportStartDate(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Data końcowa</label>
                <input
                  type="date"
                  value={exportEndDate}
                  onChange={(e) => setExportEndDate(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Pokoje ({exportRooms.length} wybranych)</label>
              <div className="mt-2 max-h-40 overflow-y-auto rounded-md border p-2">
                {allRooms.map((room) => (
                  <label key={room.number} className="flex items-center gap-2 py-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={exportRooms.includes(room.number)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setExportRooms((prev) => [...prev, room.number]);
                        } else {
                          setExportRooms((prev) => prev.filter((r) => r !== room.number));
                        }
                      }}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm">{room.number} - {room.type}</span>
                  </label>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setExportRooms(allRooms.map((r) => r.number))}
                >
                  Zaznacz wszystkie
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setExportRooms([])}
                >
                  Odznacz wszystkie
                </Button>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setExportDialogOpen(false)}>
                Anuluj
              </Button>
              <Button onClick={handleExportPdf}>
                <Printer className="mr-2 h-4 w-4" />
                Eksportuj PDF
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
