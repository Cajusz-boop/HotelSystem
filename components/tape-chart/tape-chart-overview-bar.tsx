"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Reservation } from "@/lib/tape-chart-types";
import { getDateRange } from "@/lib/tape-chart-data";

const OVERVIEW_BAR_WIDTH = 44;

interface TapeChartOverviewBarProps {
  dates: string[];
  reservations: Reservation[];
  roomsCount: number;
  todayStr: string;
  columnWidthPx: number;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  /** Callback gdy użytkownik kliknie datę spoza bieżącego widoku – przewiń TapeChart */
  onDateClick?: (dateStr: string) => void;
}

const MONTH_SHORT_PL = ["STY", "LUT", "MAR", "KWI", "MAJ", "CZE", "LIP", "SIE", "WRZ", "PAŹ", "LIS", "GRU"];
const DAY_NAMES_FULL_PL = ["Niedziela", "Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota"];
const MONTH_NAMES_PL = ["stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "września", "października", "listopada", "grudnia"];

function formatTooltipDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  const day = d.getUTCDate();
  const month = MONTH_NAMES_PL[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  return `${day} ${month} ${year}`;
}

function getMonthFromDateStr(dateStr: string): number {
  return new Date(dateStr + "T12:00:00Z").getUTCMonth();
}

function getDayOfWeek(dateStr: string): number {
  return new Date(dateStr + "T12:00:00Z").getUTCDay();
}

function getOccupancyColor(occupancy: number): string {
  if (occupancy === 0) return "hsl(var(--muted))";
  if (occupancy <= 30) return "rgba(37,99,235,0.35)";
  if (occupancy <= 60) return "rgba(37,99,235,0.55)";
  if (occupancy <= 85) return "rgba(37,99,235,0.75)";
  return "rgba(37,99,235,0.92)";
}

/** Zawsze 12 miesięcy (365 dni) od pierwszego dnia bieżącego miesiąca */
function getMinimapDates(todayStr: string): string[] {
  const [y, m] = todayStr.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m - 1 + 12, 0);
  return getDateRange(start, end);
}

export const TapeChartOverviewBar = memo(function TapeChartOverviewBar({
  dates,
  reservations,
  roomsCount,
  todayStr,
  columnWidthPx,
  scrollContainerRef,
  onDateClick,
}: TapeChartOverviewBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ left: number; top: number } | null>(null);
  const [viewportRange, setViewportRange] = useState<{ start: number; end: number } | null>(null);

  /** Zmiana A: zawsze 12 miesięcy, niezależnie od widoku TapeChart */
  const displayDates = useMemo(() => getMinimapDates(todayStr), [todayStr]);

  const occupancyByDate = useMemo(() => {
    const active = reservations.filter(
      (r) => r.status !== "CANCELLED" && r.status !== "NO_SHOW"
    );
    return displayDates.map((dateStr) => {
      const count = active.filter(
        (r) => dateStr >= r.checkIn && dateStr < r.checkOut
      ).length;
      return roomsCount > 0 ? Math.min(100, Math.round((count / roomsCount) * 100)) : 0;
    });
  }, [displayDates, reservations, roomsCount]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || dates.length === 0 || columnWidthPx <= 0) return;

    const updateViewport = () => {
      const scrollLeft = container.scrollLeft;
      const clientWidth = container.clientWidth;
      const totalWidth = dates.length * columnWidthPx;
      if (totalWidth <= 0) return;
      const startRatio = scrollLeft / totalWidth;
      const endRatio = (scrollLeft + clientWidth) / totalWidth;
      setViewportRange({
        start: Math.max(0, startRatio * 100),
        end: Math.min(100, endRatio * 100),
      });
    };

    updateViewport();
    container.addEventListener("scroll", updateViewport, { passive: true });
    const ro = new ResizeObserver(updateViewport);
    ro.observe(container);
    return () => {
      container.removeEventListener("scroll", updateViewport);
      ro.disconnect();
    };
  }, [scrollContainerRef, dates.length, columnWidthPx]);

  /** Mapowanie widocznego zakresu TapeChart (dates) na indeksy displayDates (12 miesięcy) */
  const viewportOnMinimap = useMemo(() => {
    if (!viewportRange || dates.length === 0 || displayDates.length === 0) return null;
    const startIdx = Math.floor((viewportRange.start / 100) * dates.length);
    const endIdx = Math.min(dates.length - 1, Math.ceil((viewportRange.end / 100) * dates.length));
    const visibleStart = dates[startIdx] ?? null;
    const visibleEnd = dates[endIdx] ?? null;
    if (!visibleStart || !visibleEnd) return null;
    const first = displayDates.findIndex((d) => d >= visibleStart);
    let last = -1;
    for (let i = displayDates.length - 1; i >= 0; i--) {
      if (displayDates[i]! <= visibleEnd) {
        last = i;
        break;
      }
    }
    if (first < 0 || last < 0 || first > last) return null;
    return { start: first / displayDates.length, end: (last + 1) / displayDates.length };
  }, [viewportRange, dates, displayDates]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const barEl = barRef.current;
      if (!barEl) return;
      const rect = barEl.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const ratio = rect.height > 0 ? y / rect.height : 0;
      const idx = Math.floor(ratio * displayDates.length);
      const safeIdx = Math.max(0, Math.min(idx, displayDates.length - 1));
      const clickedDate = displayDates[safeIdx];
      if (!clickedDate) return;

      const container = scrollContainerRef.current;
      if (!container || dates.length === 0 || columnWidthPx <= 0) {
        onDateClick?.(clickedDate);
        return;
      }
      const tapeIdx = dates.findIndex((d) => d >= clickedDate);
      if (tapeIdx >= 0) {
        const scrollLeft = tapeIdx * columnWidthPx - container.clientWidth / 2;
        container.scrollTo({ left: Math.max(0, scrollLeft), behavior: "smooth" });
      } else {
        onDateClick?.(clickedDate);
      }
    },
    [scrollContainerRef, dates, displayDates, columnWidthPx, onDateClick]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const barEl = barRef.current;
      if (!barEl) return;
      const rect = barEl.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const ratio = rect.height > 0 ? y / rect.height : 0;
      const idx = Math.max(0, Math.min(Math.floor(ratio * displayDates.length), displayDates.length - 1));
      setHoveredIdx(idx);
      const segmentHeight = rect.height / displayDates.length;
      const rowCenterY = rect.top + idx * segmentHeight + segmentHeight / 2;
      setTooltipPos({ left: rect.left - 12, top: rowCenterY });
    },
    [displayDates.length]
  );

  const monthBoundaries = useMemo(() => {
    const boundaries: Array<{ idx: number; label: string }> = [];
    for (let i = 0; i < displayDates.length; i++) {
      const month = getMonthFromDateStr(displayDates[i]);
      const prevMonth = i > 0 ? getMonthFromDateStr(displayDates[i - 1]) : -1;
      if (month !== prevMonth) {
        boundaries.push({ idx: i, label: MONTH_SHORT_PL[month] });
      }
    }
    return boundaries;
  }, [displayDates]);

  const weekendIndices = useMemo(() => {
    const set = new Set<number>();
    for (let i = 0; i < displayDates.length; i++) {
      const dow = getDayOfWeek(displayDates[i]);
      if (dow === 0 || dow === 6) set.add(i);
    }
    return set;
  }, [displayDates]);

  if (displayDates.length === 0) return null;

  const hoveredDate = hoveredIdx !== null ? displayDates[hoveredIdx] : null;
  const hoveredOccupancy = hoveredIdx !== null ? occupancyByDate[hoveredIdx] : null;
  const hoveredDayNameFull = hoveredDate ? DAY_NAMES_FULL_PL[getDayOfWeek(hoveredDate)] : null;

  const tooltipEl =
    hoveredIdx !== null && hoveredDate && hoveredDayNameFull && tooltipPos && typeof document !== "undefined"
      ? createPortal(
          <div
            className="fixed z-[200] pointer-events-none whitespace-nowrap"
            style={{
              left: Math.max(8, tooltipPos.left - 170),
              top: tooltipPos.top,
              transform: "translateY(-50%)",
            }}
            role="tooltip"
          >
            <div className="bg-popover text-popover-foreground border border-border shadow-lg rounded-md px-2.5 py-1.5 text-xs leading-snug">
              <div className="font-semibold">{hoveredDayNameFull}</div>
              <div className="text-muted-foreground text-[11px]">{formatTooltipDate(hoveredDate)}</div>
              {hoveredOccupancy != null && (
                <div className="text-muted-foreground text-[10px] mt-0.5">
                  Obłożenie: <span className="font-medium text-foreground">{hoveredOccupancy}%</span>
                </div>
              )}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
    <div
      className="flex flex-col h-full min-h-0 border-l border-[hsl(var(--kw-grid-border))] bg-[hsl(var(--muted))] cursor-pointer transition-colors no-print select-none"
      style={{ width: OVERVIEW_BAR_WIDTH, minWidth: OVERVIEW_BAR_WIDTH }}
      role="region"
      aria-label="Mini-mapa dat – przewiń w górę/dół"
    >
      <div
        ref={barRef}
        className="relative w-full flex-1 min-h-0 flex flex-col overflow-hidden"
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => { setHoveredIdx(null); setTooltipPos(null); }}
        role="region"
      >
        {/* Zmiana B: flex fill 100% – brak overflow-y-auto, segmenty wypełniają całą wysokość */}
        <div className="relative flex flex-col flex-1 min-h-0 w-full">
          {viewportOnMinimap && (
            <div
              className="absolute left-0 right-0 z-20 pointer-events-none border-y-2 border-primary/70"
              style={{
                top: `${viewportOnMinimap.start * 100}%`,
                height: `${(viewportOnMinimap.end - viewportOnMinimap.start) * 100}%`,
                background: "rgba(var(--primary-rgb, 37,99,235), 0.08)",
                boxShadow: "0 0 0 1px hsl(var(--primary) / 0.3)",
              }}
            />
          )}
          {monthBoundaries.map(({ idx, label }) => (
            <div
              key={`month-${idx}`}
              className="absolute left-0 right-0 z-10 pointer-events-none"
              style={{ top: `${(idx / displayDates.length) * 100}%` }}
            >
              <div className="w-full border-t border-foreground/25" />
              <span className="absolute left-0 right-0 text-[8px] leading-tight text-center text-foreground/70 font-bold bg-muted/90 py-px -translate-y-px">
                {label}
              </span>
            </div>
          ))}
          {displayDates.map((dateStr, i) => {
            const occupancy = occupancyByDate[i] ?? 0;
            const isToday = dateStr === todayStr;
            const isWeekend = weekendIndices.has(i);
            const isHovered = hoveredIdx === i;

            return (
              <div
                key={dateStr}
                className="relative flex items-stretch flex-1 min-h-0"
              >
                <div
                  className="absolute inset-y-0 left-0 transition-all duration-100"
                  style={{
                    width: occupancy > 0 ? `${Math.max(12, occupancy)}%` : "0%",
                    backgroundColor: isToday
                      ? "rgb(251,191,36)"
                      : getOccupancyColor(occupancy),
                    opacity: isHovered ? 1 : 0.9,
                  }}
                />
                {isWeekend && !isToday && (
                  <div className="absolute inset-0 bg-foreground/[0.04]" />
                )}
                {isToday && (
                  <div className="absolute inset-0 ring-1 ring-inset ring-amber-500/60 z-[5]" />
                )}
                {isHovered && (
                  <div className="absolute inset-0 bg-foreground/10 z-[3]" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
    {tooltipEl}
    </>
  );
});
