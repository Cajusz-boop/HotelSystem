"use client";

import { memo, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import type { Reservation } from "@/lib/tape-chart-types";

const OVERVIEW_BAR_WIDTH = 30;

interface TapeChartOverviewBarProps {
  dates: string[];
  reservations: Reservation[];
  roomsCount: number;
  todayStr: string;
  columnWidthPx: number;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

const MONTH_SHORT_PL = ["STY", "LUT", "MAR", "KWI", "MAJ", "CZE", "LIP", "SIE", "WRZ", "PAŹ", "LIS", "GRU"];

/** Kształt jak paski rezerwacji – sześciokąt ze spiczastymi bokami */
const SEGMENT_CLIP_PATH = "polygon(6% 0%, 94% 0%, 100% 50%, 94% 100%, 6% 100%, 0% 50%)";

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  return `${d.getUTCDate()}.${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function getMonthFromDateStr(dateStr: string): number {
  return new Date(dateStr + "T12:00:00Z").getUTCMonth();
}

/** Mini-mapa zagęszczenia rezerwacji – kliknięcie przewija do wybranej daty */
export const TapeChartOverviewBar = memo(function TapeChartOverviewBar({
  dates,
  reservations,
  roomsCount,
  todayStr,
  columnWidthPx,
  scrollContainerRef,
}: TapeChartOverviewBarProps) {
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

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const container = scrollContainerRef.current;
      if (!container) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const ratio = y / rect.height;
      const idx = Math.floor(ratio * dates.length);
      const safeIdx = Math.max(0, Math.min(idx, dates.length - 1));
      const scrollLeft = safeIdx * columnWidthPx - 40;
      container.scrollTo({ left: Math.max(0, scrollLeft), behavior: "smooth" });
    },
    [scrollContainerRef, dates.length, columnWidthPx]
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

  const firstDateLabel = dates.length > 0 ? formatShortDate(dates[0]) : "";
  const lastDateLabel = dates.length > 0 ? formatShortDate(dates[dates.length - 1]) : "";

  if (dates.length === 0) return null;

  return (
    <div
      className="shrink-0 flex flex-col h-full min-h-0 border-l border-[hsl(var(--kw-grid-border))] bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors no-print"
      style={{ width: OVERVIEW_BAR_WIDTH, minWidth: OVERVIEW_BAR_WIDTH }}
      onClick={handleClick}
      title="Kliknij, aby przewinąć do wybranej daty"
      role="scrollbar"
      aria-label={`Mini-mapa: ${firstDateLabel} – ${lastDateLabel}`}
    >
      <div className="text-[7px] leading-none text-center text-muted-foreground font-medium py-0.5 border-b border-muted/50 select-none">
        {firstDateLabel}
      </div>
      <div className="relative flex flex-col w-full flex-1 min-h-0 overflow-hidden">
        {dates.map((dateStr, i) => {
          const occupancy = occupancyByDate[i] ?? 0;
          const isToday = dateStr === todayStr;
          return (
            <div
              key={dateStr}
              className={cn(
                "w-full flex-1 min-h-[2px] border-b border-muted/30 last:border-b-0",
                isToday && "border-l-2 border-l-amber-500 bg-amber-400/30"
              )}
              style={{
                backgroundColor: !isToday && occupancy > 0
                  ? `rgba(37, 99, 235, ${0.35 + (occupancy / 100) * 0.65})`
                  : undefined,
                clipPath: SEGMENT_CLIP_PATH,
                WebkitClipPath: SEGMENT_CLIP_PATH,
              }}
              title={`${dateStr}: ${occupancy}% zajętości${isToday ? " (dzisiaj)" : ""}`}
            />
          );
        })}
        {monthBoundaries.map(({ idx, label }) => (
          <div
            key={`month-${idx}`}
            className="absolute left-0 right-0 flex items-center pointer-events-none select-none"
            style={{ top: `${(idx / dates.length) * 100}%` }}
          >
            <div className="w-full border-t border-foreground/30" />
            <span className="absolute left-0 right-0 text-[6px] leading-none text-center text-foreground/60 font-semibold bg-muted/80 px-px">
              {label}
            </span>
          </div>
        ))}
      </div>
      <div className="text-[7px] leading-none text-center text-muted-foreground font-medium py-0.5 border-t border-muted/50 select-none">
        {lastDateLabel}
      </div>
    </div>
  );
});
