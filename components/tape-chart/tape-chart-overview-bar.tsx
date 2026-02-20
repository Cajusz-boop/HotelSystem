"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Reservation } from "@/lib/tape-chart-types";

const OVERVIEW_BAR_WIDTH = 44;
const ROW_HEIGHT_PX = 4;

interface TapeChartOverviewBarProps {
  dates: string[];
  reservations: Reservation[];
  roomsCount: number;
  todayStr: string;
  columnWidthPx: number;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
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

export const TapeChartOverviewBar = memo(function TapeChartOverviewBar({
  dates,
  reservations,
  roomsCount,
  todayStr,
  columnWidthPx,
  scrollContainerRef,
}: TapeChartOverviewBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ left: number; top: number } | null>(null);
  const [viewportRange, setViewportRange] = useState<{ start: number; end: number } | null>(null);

  const occupancyByDate = useMemo(() => {
    const active = reservations.filter(
      (r) => r.status !== "CANCELLED" && r.status !== "NO_SHOW"
    );
    return dates.map((dateStr) => {
      const count = active.filter(
        (r) => dateStr >= r.checkIn && dateStr < r.checkOut
      ).length;
      return roomsCount > 0 ? Math.min(100, Math.round((count / roomsCount) * 100)) : 0;
    });
  }, [dates, reservations, roomsCount]);

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

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const container = scrollContainerRef.current;
      const barEl = barRef.current;
      if (!container || !barEl) return;
      const rect = barEl.getBoundingClientRect();
      const y = e.clientY - rect.top + barEl.scrollTop;
      const totalHeight = dates.length * ROW_HEIGHT_PX;
      const ratio = totalHeight > 0 ? y / totalHeight : 0;
      const idx = Math.floor(ratio * dates.length);
      const safeIdx = Math.max(0, Math.min(idx, dates.length - 1));
      const scrollLeft = safeIdx * columnWidthPx - container.clientWidth / 2;
      container.scrollTo({ left: Math.max(0, scrollLeft), behavior: "smooth" });
    },
    [scrollContainerRef, dates.length, columnWidthPx]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const barEl = barRef.current;
      if (!barEl) return;
      const rect = barEl.getBoundingClientRect();
      const y = e.clientY - rect.top + barEl.scrollTop;
      const totalHeight = dates.length * ROW_HEIGHT_PX;
      const ratio = totalHeight > 0 ? y / totalHeight : 0;
      const idx = Math.max(0, Math.min(Math.floor(ratio * dates.length), dates.length - 1));
      setHoveredIdx(idx);
      const rowCenterY = rect.top + (idx * ROW_HEIGHT_PX - barEl.scrollTop) + ROW_HEIGHT_PX / 2;
      setTooltipPos({ left: rect.left - 12, top: rowCenterY });
    },
    [dates.length]
  );

  const monthBoundaries = useMemo(() => {
    const boundaries: Array<{ idx: number; label: string }> = [];
    for (let i = 0; i < dates.length; i++) {
      const month = getMonthFromDateStr(dates[i]);
      const prevMonth = i > 0 ? getMonthFromDateStr(dates[i - 1]) : -1;
      if (month !== prevMonth) {
        boundaries.push({ idx: i, label: MONTH_SHORT_PL[month] });
      }
    }
    return boundaries;
  }, [dates]);

  const weekendIndices = useMemo(() => {
    const set = new Set<number>();
    for (let i = 0; i < dates.length; i++) {
      const dow = getDayOfWeek(dates[i]);
      if (dow === 0 || dow === 6) set.add(i);
    }
    return set;
  }, [dates]);

  if (dates.length === 0) return null;

  const hoveredDate = hoveredIdx !== null ? dates[hoveredIdx] : null;
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
        className="relative w-full flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => { setHoveredIdx(null); setTooltipPos(null); }}
        role="region"
      >
        {/* Zawartość – pełna wysokość; etykiety miesięcy i viewport wewnątrz = przewijają się razem */}
        <div
          className="relative flex flex-col shrink-0"
          style={{ height: dates.length * ROW_HEIGHT_PX, minHeight: dates.length * ROW_HEIGHT_PX }}
        >
          {/* Warstwa etykiet miesięcy i viewport – absolute względem pełnej wysokości contentu */}
          {viewportRange && (
            <div
              className="absolute left-0 right-0 z-20 pointer-events-none border-y-2 border-primary/70"
              style={{
                top: `${(viewportRange.start / 100) * dates.length * ROW_HEIGHT_PX}px`,
                height: `${Math.max(2, ((viewportRange.end - viewportRange.start) / 100) * dates.length * ROW_HEIGHT_PX)}px`,
                background: "rgba(var(--primary-rgb, 37,99,235), 0.08)",
                boxShadow: "0 0 0 1px hsl(var(--primary) / 0.3)",
              }}
            />
          )}
          {monthBoundaries.map(({ idx, label }) => (
            <div
              key={`month-${idx}`}
              className="absolute left-0 right-0 z-10 pointer-events-none"
              style={{ top: `${idx * ROW_HEIGHT_PX}px` }}
            >
              <div className="w-full border-t border-foreground/25" />
              <span className="absolute left-0 right-0 text-[8px] leading-tight text-center text-foreground/70 font-bold bg-muted/90 py-px -translate-y-px">
                {label}
              </span>
            </div>
          ))}
          {dates.map((dateStr, i) => {
            const occupancy = occupancyByDate[i] ?? 0;
            const isToday = dateStr === todayStr;
            const isWeekend = weekendIndices.has(i);
            const isHovered = hoveredIdx === i;

            return (
              <div
                key={dateStr}
                className="relative flex items-stretch shrink-0"
                style={{ height: ROW_HEIGHT_PX, minHeight: ROW_HEIGHT_PX }}
              >
                {/* Occupancy fill bar — horizontal from left */}
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
                {/* Weekend subtle marker */}
                {isWeekend && !isToday && (
                  <div className="absolute inset-0 bg-foreground/[0.04]" />
                )}
                {/* Today highlight border */}
                {isToday && (
                  <div className="absolute inset-0 ring-1 ring-inset ring-amber-500/60 z-[5]" />
                )}
                {/* Hover highlight */}
                {isHovered && (
                  <div className="absolute inset-0 bg-foreground/10 z-[3]" />
                )}
              </div>
            );
          })}
          {/* Tooltip w portalu – nie obcinany przez overflow */}
        </div>
      </div>
    </div>
    {tooltipEl}
    </>
  );
});
