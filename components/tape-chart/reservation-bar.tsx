"use client";

import { useDraggable } from "@dnd-kit/core";
import { CheckCircle } from "lucide-react";
import type { Reservation } from "@/lib/tape-chart-types";
import { RESERVATION_STATUS_COLORS, RESERVATION_STATUS_BG } from "@/lib/tape-chart-types";
import { cn } from "@/lib/utils";

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
}: ReservationBarProps) {
  const displayName = privacyMode
    ? obscureGuestName(reservation.guestName) + " (Privacy)"
    : reservation.guestName;
  const paxText = reservation.pax != null ? ` (${reservation.pax} os.)` : "";
  const priceText =
    pricePerNight != null && pricePerNight > 0
      ? totalAmount != null && totalAmount > 0
        ? `${pricePerNight} PLN/dobę · ${totalAmount.toFixed(0)} PLN`
        : `${pricePerNight} PLN/dobę`
      : "";
  const colorClass = RESERVATION_STATUS_COLORS[reservation.status];
  const bgColor = RESERVATION_STATUS_BG[reservation.status as keyof typeof RESERVATION_STATUS_BG] ?? RESERVATION_STATUS_BG.CONFIRMED;

  const { attributes, listeners, setNodeRef } = useDraggable({
    id: reservation.id,
    data: { type: "reservation", reservation },
  });

  return (
    <div
      ref={setNodeRef}
      data-testid="reservation-bar"
      data-reservation-id={reservation.id}
      className={cn(
        "relative z-10 flex h-full min-h-[44px] flex-col justify-center gap-0.5 rounded-md px-2 py-1.5 text-xs text-white shadow-md overflow-hidden",
        colorClass,
        isPlaceholder && "border-2 border-dashed opacity-80",
        isDragging && "z-50 cursor-grabbing opacity-90"
      )}
      style={{
        gridRow,
        gridColumn: `${gridColumnStart} / ${gridColumnEnd}`,
        backgroundColor: bgColor,
      }}
      {...listeners}
      {...attributes}
    >
      <span className="min-w-0 truncate" title={reservation.guestName}>
        {displayName}
        {paxText}
      </span>
      {priceText && <span className="truncate text-[10px] leading-tight opacity-95">{priceText}</span>}
      {(reservation.status === "CHECKED_IN" || reservation.status === "CONFIRMED") && (
        <CheckCircle className="absolute right-1.5 top-1/2 h-3 w-3 shrink-0 -translate-y-1/2 opacity-90" aria-hidden />
      )}
    </div>
  );
}
