"use client";

import { useDraggable } from "@dnd-kit/core";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Star } from "lucide-react";
import type { Reservation } from "@/lib/tape-chart-types";
import { RESERVATION_STATUS_COLORS, RESERVATION_STATUS_BG } from "@/lib/tape-chart-types";
import { cn } from "@/lib/utils";

/** Zamienia rgba/hex z alpha na nieprzezroczysty rgb (composite nad białym) */
export function ensureOpaque(color: string): string {
  const rgbaMatch = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*[\d.]+)?\s*\)/);
  if (rgbaMatch) {
    const r = Number(rgbaMatch[1]);
    const g = Number(rgbaMatch[2]);
    const b = Number(rgbaMatch[3]);
    const a = color.includes("rgba") ? parseFloat(color.match(/,\s*([\d.]+)\s*\)/)?.[1] ?? "1") : 1;
    if (a >= 0.999) return `rgb(${r} ${g} ${b})`;
    const r2 = Math.round(r * a + 255 * (1 - a));
    const g2 = Math.round(g * a + 255 * (1 - a));
    const b2 = Math.round(b * a + 255 * (1 - a));
    return `rgb(${r2} ${g2} ${b2})`;
  }
  const hslAlpha = color.match(/hsla?\([^)]+\)/);
  if (hslAlpha && color.includes("/")) return color.replace(/\/\s*[\d.]+/, "");
  return color;
}

/** Zamazuje nazwisko do formy "K*****i, J." (Privacy Mode) */
export function obscureGuestName(name: string): string {
  const parts = name.split(/,\s*/);
  if (parts.length >= 2) {
    const [last, first] = parts;
    const obscuredLast =
      last.length > 2
        ? last[0] + "*".repeat(Math.min(last.length - 2, 5)) + last[last.length - 1]
        : last;
    const firstInitial = first.trim()[0] ?? "";
    return `${obscuredLast}, ${firstInitial}.`;
  }
  if (name.length > 3) {
    return name[0] + "*".repeat(Math.min(name.length - 2, 5)) + name[name.length - 1];
  }
  return name;
}

/** Krótka etykieta gościa do paska: "Nazwisko I." – mieści się w wąskich komórkach */
export function shortGuestLabel(fullName: string, privacyMode: boolean): string {
  if (privacyMode) {
    const obscured = obscureGuestName(fullName);
    return obscured.replace(/\s*\(Privacy\)\s*$/, "");
  }
  const parts = fullName.split(/,\s*/);
  if (parts.length >= 2) {
    const [last, first] = parts;
    const initial = (first.trim()[0] ?? "").toUpperCase();
    return initial ? `${last.trim()} ${initial}.` : last.trim();
  }
  const words = fullName.trim().split(/\s+/);
  if (words.length >= 2) {
    const last = words[words.length - 1];
    const initial = words[0][0]?.toUpperCase() ?? "";
    return `${last} ${initial}.`;
  }
  return fullName.length > 12 ? fullName.slice(0, 10) + "…" : fullName;
}

interface ReservationBarProps {
  reservation: Reservation;
  gridRow: number;
  gridColumnStart: number;
  gridColumnEnd: number;
  privacyMode: boolean;
  isDragging?: boolean;
  isPlaceholder?: boolean;
  /** Cena za dobę (PLN) – z cennika pokoju */
  pricePerNight?: number;
  /** Suma za pobyt (PLN) – liczba nocy × cena */
  totalAmount?: number;
  /** Opcjonalna paleta kolorów tła (nadpisuje domyślną) */
  statusBg?: Record<string, string>;
  /** Czy rezerwacja ma konflikt (nakłada się z inną) */
  hasConflict?: boolean;
  /** Czy check-in jest dziś – wizualne wyróżnienie */
  isCheckInToday?: boolean;
  /** Szerokość paska w px – do wyliczenia stałego clipPath (opcjonalnie) */
  barWidthPx?: number;
}

export function ReservationBar({
  reservation,
  gridRow,
  gridColumnStart,
  gridColumnEnd,
  privacyMode,
  isDragging = false,
  isPlaceholder = false,
  pricePerNight,
  totalAmount,
  statusBg,
  hasConflict,
  isCheckInToday = false,
  barWidthPx,
}: ReservationBarProps) {
  const shortName = shortGuestLabel(reservation.guestName, privacyMode);
  const nights =
    reservation.checkIn && reservation.checkOut
      ? Math.max(
          1,
          Math.ceil(
            (new Date(reservation.checkOut).getTime() - new Date(reservation.checkIn).getTime()) /
              (24 * 60 * 60 * 1000)
          )
        )
      : null;
  const nightsShort = nights != null ? `${nights}n` : "";
  const priceShort =
    pricePerNight != null && pricePerNight > 0
      ? totalAmount != null && totalAmount > 0
        ? `${totalAmount.toFixed(0)} PLN`
        : `${pricePerNight} PLN`
      : "";
  const barLabel =
    barWidthPx != null && barWidthPx > 0
      ? barWidthPx < 56
        ? [shortName.split(" ")[0] ?? shortName, nightsShort].filter(Boolean).join(" ")
        : barWidthPx < 120
          ? [shortName, nightsShort].filter(Boolean).join(" · ")
          : [shortName, nightsShort, priceShort].filter(Boolean).join(" · ")
      : [shortName, nightsShort, priceShort].filter(Boolean).join(" · ");
  const colorClass = RESERVATION_STATUS_COLORS[reservation.status];
  const defaultBg = RESERVATION_STATUS_BG[reservation.status as keyof typeof RESERVATION_STATUS_BG] ?? RESERVATION_STATUS_BG.CONFIRMED;
  const bgColor = ensureOpaque(statusBg?.[reservation.status] ?? defaultBg);
  const isGroupReservation = Boolean(reservation.groupId);

  const STATUS_PL: Record<string, string> = {
    CONFIRMED: "Potwierdzona",
    CHECKED_IN: "Zameldowany",
    CHECKED_OUT: "Wymeldowany",
    CANCELLED: "Anulowana",
    NO_SHOW: "Nie przyjechał",
  };

  const tooltipLines: string[] = [
    `Gość: ${reservation.guestName}`,
    `Pokój: ${reservation.room}`,
    `Przyjazd: ${reservation.checkIn}${reservation.checkInTime ? ` ${reservation.checkInTime}` : ""}`,
    `Wyjazd: ${reservation.checkOut}${reservation.checkOutTime ? ` ${reservation.checkOutTime}` : ""}`,
    `Status: ${STATUS_PL[reservation.status] ?? reservation.status}`,
    ...(nights != null ? [`Noce: ${nights}`] : []),
  ];
  if (reservation.pax) tooltipLines.push(`Liczba osób: ${reservation.pax}`);
  const source = reservation.rateCodeName ?? reservation.rateCode;
  if (source) tooltipLines.push(`Źródło: ${source}`);
  if (reservation.groupName) tooltipLines.push(`Grupa: ${reservation.groupName}`);
  if (reservation.vip) tooltipLines.push(`⭐ Gość VIP`);
  if (reservation.paymentStatus) {
    const paymentLabels = { UNPAID: "Nieopłacona", PARTIAL: "Częściowo opłacona", PAID: "Opłacona" };
    tooltipLines.push(`Płatność: ${paymentLabels[reservation.paymentStatus]}`);
  }
  if (reservation.notes) tooltipLines.push(`Uwagi: ${reservation.notes}`);
  const tooltipText = tooltipLines.join("\n");

  const { attributes, listeners, setNodeRef } = useDraggable({
    id: reservation.id,
    data: { type: "reservation", reservation },
  });

  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipRect, setTooltipRect] = useState<DOMRect | null>(null);
  const tooltipTimerRef = useRef<number | NodeJS.Timeout | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);

  const showTooltip = () => {
    tooltipTimerRef.current = window.setTimeout(() => {
      const el = barRef.current;
      if (!el || isDragging) return;
      setTooltipRect(el.getBoundingClientRect());
      setTooltipVisible(true);
    }, 200);
  };
  const hideTooltip = () => {
    if (tooltipTimerRef.current) {
      clearTimeout(tooltipTimerRef.current);
      tooltipTimerRef.current = null;
    }
    setTooltipVisible(false);
    setTooltipRect(null);
  };

  useEffect(() => () => {
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
  }, []);

  const paymentEdgeColor =
    reservation.paymentStatus === "PAID"
      ? "rgb(22 163 74)"
      : reservation.paymentStatus === "PARTIAL"
        ? "rgb(234 179 8)"
        : reservation.paymentStatus === "UNPAID"
          ? "rgb(239 68 68)"
          : undefined;

  const POINT_DEPTH_PX = 10;
  const pct = barWidthPx && barWidthPx > 0 ? Math.min(12, (POINT_DEPTH_PX / barWidthPx) * 100) : 6;
  const r = (100 - pct).toFixed(1);
  const l = pct.toFixed(1);
  const clipPath = `polygon(${l}% 0%, ${r}% 0%, 100% 50%, ${r}% 100%, ${l}% 100%, 0% 50%)`;

  const setRef = (el: HTMLDivElement | null) => {
    setNodeRef(el);
    barRef.current = el;
  };

  const tooltipAbove = tooltipRect && tooltipRect.top > 180;
  const tooltipEl =
    tooltipVisible && tooltipRect && typeof document !== "undefined"
      ? createPortal(
          <div
            className="fixed z-[200] max-w-[320px] rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-left shadow-lg"
            style={{
              left: Math.min(tooltipRect.left, window.innerWidth - 330),
              top: tooltipAbove ? tooltipRect.top - 8 : tooltipRect.bottom + 8,
              transform: tooltipAbove ? "translateY(-100%)" : "none",
            }}
            role="tooltip"
          >
            <div className="text-xs text-gray-800 space-y-1 font-medium">
              {tooltipLines.map((line, i) => (
                <div key={i} className="whitespace-nowrap">
                  {line}
                </div>
              ))}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <div
        ref={setRef}
        data-testid="reservation-bar"
        data-reservation-id={reservation.id}
        className={cn(
          "relative z-10 flex h-full w-full min-h-0 flex-col justify-center gap-0 text-xs leading-snug font-semibold text-white shadow-sm overflow-hidden antialiased",
          colorClass,
          isPlaceholder && "border-2 border-dashed opacity-80",
          isDragging && "z-50 cursor-grabbing opacity-90",
          hasConflict && "ring-2 ring-red-500 ring-offset-1 animate-pulse",
          isGroupReservation && "border-l-4 border-l-amber-400",
          isCheckInToday && "ring-2 ring-white/90 ring-offset-1 animate-pulse"
        )}
        style={{
          gridRow,
          gridColumn: `${gridColumnStart} / ${gridColumnEnd}`,
          backgroundColor: bgColor,
          clipPath,
          WebkitClipPath: clipPath,
        }}
        title={tooltipText}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        {...listeners}
        {...attributes}
      >
        {/* Payment status edge indicator */}
        {paymentEdgeColor && (
          <div
            className="absolute left-0 top-0 bottom-0 w-[2px]"
            style={{ backgroundColor: paymentEdgeColor }}
            aria-hidden
          />
        )}
        <div className={cn("flex items-center justify-center min-h-0 min-w-0 overflow-hidden", paymentEdgeColor ? "pl-2 pr-1.5 py-0.5" : "px-1.5 py-0.5")}>
          <span className="min-w-0 truncate text-xs leading-snug font-semibold tabular-nums antialiased">
            {reservation.vip && <Star className="inline h-2.5 w-2.5 mr-0.5 text-yellow-300 fill-yellow-300 align-middle shrink-0" aria-label="VIP" />}
            {barLabel}
          </span>
        </div>
        {/* Notes indicator - compact dot */}
        {reservation.notes && (
          <span
            title={`Uwagi: ${reservation.notes}`}
            className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-white/70"
            aria-label="Ma uwagi"
          />
        )}
      </div>
      {tooltipEl}
    </>
  );
}
