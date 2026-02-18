"use client";

import { useDraggable } from "@dnd-kit/core";
import { Users, Star } from "lucide-react";
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
  /** Opcjonalna paleta kolorów tła (nadpisuje domyślną) */
  statusBg?: Record<string, string>;
  /** Czy rezerwacja ma konflikt (nakłada się z inną) */
  hasConflict?: boolean;
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
}: ReservationBarProps) {
  const displayName = privacyMode
    ? obscureGuestName(reservation.guestName) + " (Privacy)"
    : reservation.guestName;
  const paxText = reservation.pax != null ? ` (${reservation.pax} os.)` : "";
  const bedsText = reservation.bedsBooked != null && reservation.bedsBooked > 1 ? ` · ${reservation.bedsBooked} ł.` : "";
  const timeText =
    reservation.checkInTime && reservation.checkOutTime
      ? ` ${reservation.checkInTime}–${reservation.checkOutTime}`
      : "";
  const priceText =
    pricePerNight != null && pricePerNight > 0
      ? totalAmount != null && totalAmount > 0
        ? `${pricePerNight} PLN/dobę · ${totalAmount.toFixed(0)} PLN`
        : `${pricePerNight} PLN/dobę`
      : "";
  const colorClass = RESERVATION_STATUS_COLORS[reservation.status];
  const defaultBg = RESERVATION_STATUS_BG[reservation.status as keyof typeof RESERVATION_STATUS_BG] ?? RESERVATION_STATUS_BG.CONFIRMED;
  const bgColor = statusBg?.[reservation.status] ?? defaultBg;
  const isGroupReservation = Boolean(reservation.groupId);

  // Build comprehensive tooltip
  const tooltipLines: string[] = [
    `Gość: ${reservation.guestName}`,
    `Pokój: ${reservation.room}`,
    `Przyjazd: ${reservation.checkIn}${reservation.checkInTime ? ` ${reservation.checkInTime}` : ""}`,
    `Wyjazd: ${reservation.checkOut}${reservation.checkOutTime ? ` ${reservation.checkOutTime}` : ""}`,
    `Status: ${reservation.status}`,
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

  const paymentEdgeColor =
    reservation.paymentStatus === "PAID"
      ? "rgb(22 163 74)"
      : reservation.paymentStatus === "PARTIAL"
        ? "rgb(234 179 8)"
        : reservation.paymentStatus === "UNPAID"
          ? "rgb(239 68 68)"
          : undefined;

  /** Kształt jak w KWHotel: ukośne końce (check-in / check-out w ciągu dnia) */
  const clipPath = "polygon(0% 100%, 5% 0%, 95% 0%, 100% 100%)";

  return (
    <div
      ref={setNodeRef}
      data-testid="reservation-bar"
      data-reservation-id={reservation.id}
      className={cn(
        "relative z-10 flex h-full min-h-[28px] flex-col justify-center gap-0 text-[11px] leading-tight text-white shadow-sm overflow-hidden",
        colorClass,
        isPlaceholder && "border-2 border-dashed opacity-80",
        isDragging && "z-50 cursor-grabbing opacity-90",
        hasConflict && "ring-2 ring-red-500 ring-offset-1 animate-pulse",
        isGroupReservation && "border-l-4 border-l-amber-400"
      )}
      style={{
        gridRow,
        gridColumn: `${gridColumnStart} / ${gridColumnEnd}`,
        backgroundColor: bgColor,
        clipPath,
        WebkitClipPath: clipPath,
      }}
      title={tooltipText}
      {...listeners}
      {...attributes}
    >
      {/* Payment status edge indicator */}
      {paymentEdgeColor && (
        <div
          className="absolute left-0 top-0 bottom-0 w-[3px]"
          style={{ backgroundColor: paymentEdgeColor }}
          aria-hidden
        />
      )}
      <div className={cn("flex flex-col justify-center gap-0 min-w-0", paymentEdgeColor ? "pl-2 pr-2 py-0.5" : "px-2 py-0.5")}>
        <span className="min-w-0 truncate font-medium text-[11px] leading-none">
          {reservation.vip && <Star className="inline-block h-2.5 w-2.5 mr-0.5 text-yellow-300 fill-yellow-300" aria-label="VIP" />}
          {displayName}
          <span className="font-normal opacity-80">
            {paxText}
            {bedsText}
          </span>
          {priceText && <span className="font-normal opacity-70 ml-1">{priceText}</span>}
        </span>
      </div>
      {/* Notes indicator - compact dot */}
      {reservation.notes && (
        <span
          title={`Uwagi: ${reservation.notes}`}
          className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-white/70"
          aria-label="Ma uwagi"
        />
      )}
    </div>
  );
}
