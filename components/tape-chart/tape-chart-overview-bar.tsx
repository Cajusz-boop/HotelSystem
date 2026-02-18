"use client";

import { memo, useCallback, useMemo } from "react";
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

  const gradientStops = useMemo(() => {
    const pct = 100 / dates.length;
    const gap = 0.4;
    const segmentPct = pct - gap;
    const separator = "rgb(203,213,225)";
    const stops: string[] = [];
    for (let i = 0; i < dates.length; i++) {
      const occupancy = occupancyByDate[i] ?? 0;
      const isToday = dates[i] === todayStr;
      const color = isToday
        ? "rgb(251,191,36)"
        : occupancy > 0
          ? `rgba(37,99,235,${0.6 + (occupancy / 100) * 0.4})`
          : "rgb(226,232,240)";
      const start = i * pct;
      const segmentEnd = start + segmentPct;
      const gapEnd = start + pct;
      stops.push(`${color} ${start}%`, `${color} ${segmentEnd}%`);
      stops.push(`${separator} ${segmentEnd}%`, `${separator} ${gapEnd}%`);
    }
    return stops.join(", ");
  }, [dates, occupancyByDate, todayStr]);

  const firstDateLabel = dates.length > 0 ? formatShortDate(dates[0]) : "";
  const lastDateLabel = dates.length > 0 ? formatShortDate(dates[dates.length - 1]) : "";

  if (dates.length === 0) return null;

  return (
    <div
      className="flex flex-col h-full min-h-0 border-l border-[hsl(var(--kw-grid-border))] bg-[hsl(var(--muted))] cursor-pointer hover:bg-[hsl(var(--muted))]/80 transition-colors no-print"
      style={{ width: OVERVIEW_BAR_WIDTH, minWidth: OVERVIEW_BAR_WIDTH }}
      onClick={handleClick}
      title="Kliknij, aby przewinąć do wybranej daty"
      role="scrollbar"
      aria-label={`Mini-mapa: ${firstDateLabel} – ${lastDateLabel}`}
    >
      <div className="text-[7px] leading-none text-center text-muted-foreground font-medium py-0.5 border-b border-border select-none shrink-0">
        {firstDateLabel}
      </div>
      <div className="relative w-full flex-1 min-h-0 overflow-hidden flex flex-col">
        <div className="flex-1 min-h-0 w-full" aria-hidden />
        <div
          className="absolute inset-0 w-full"
          style={{
            background: `linear-gradient(to bottom, ${gradientStops})`,
          }}
        />
        {monthBoundaries.map(({ idx, label }) => (
          <div
            key={`month-${idx}`}
            className="absolute left-0 right-0 z-10 flex items-center pointer-events-none select-none"
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
