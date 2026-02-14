"use client";

import { useDraggable } from "@dnd-kit/core";
import { CheckCircle, Users, Star, CreditCard, MessageSquare } from "lucide-react";
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

  return (
    <div
      ref={setNodeRef}
      data-testid="reservation-bar"
      data-reservation-id={reservation.id}
      className={cn(
        "relative z-10 flex h-full min-h-[44px] flex-col justify-center gap-0.5 rounded-md px-2 py-1.5 text-xs text-white shadow-md overflow-hidden",
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
      }}
      title={tooltipText}
      {...listeners}
      {...attributes}
    >
      <span className="min-w-0 truncate">
        {reservation.vip && <Star className="inline-block h-3 w-3 mr-0.5 text-yellow-300 fill-yellow-300" aria-label="VIP" />}
        {displayName}
        {paxText}
        {bedsText}
        {timeText}
      </span>
      {priceText && <span className="truncate text-[10px] leading-tight opacity-95">{priceText}</span>}
      {isGroupReservation && reservation.groupName && (
        <span className="truncate text-[10px] leading-tight opacity-90 flex items-center gap-0.5">
          <Users className="h-2.5 w-2.5 shrink-0" aria-hidden />
          {reservation.groupName}
        </span>
      )}
      {/* Payment status indicator */}
      {reservation.paymentStatus && (
        <span className={cn(
          "absolute left-1.5 bottom-1.5 flex items-center gap-0.5 text-[9px] rounded px-1",
          reservation.paymentStatus === "PAID" && "bg-green-600/80",
          reservation.paymentStatus === "PARTIAL" && "bg-yellow-600/80",
          reservation.paymentStatus === "UNPAID" && "bg-red-600/80"
        )}>
          <CreditCard className="h-2.5 w-2.5" aria-hidden />
          {reservation.paymentStatus === "PAID" ? "Opł." : reservation.paymentStatus === "PARTIAL" ? "Częśc." : "Nieopł."}
        </span>
      )}
      {/* Notes indicator */}
      {reservation.notes && (
        <MessageSquare 
          className="absolute right-1.5 bottom-1.5 h-3 w-3 shrink-0 text-white/90" 
          aria-label="Ma uwagi" 
          title={`Uwagi: ${reservation.notes}`}
        />
      )}
      {(reservation.status === "CHECKED_IN" || reservation.status === "CONFIRMED") && (
        <CheckCircle className="absolute right-1.5 top-1/2 h-3 w-3 shrink-0 -translate-y-1/2 opacity-90" aria-hidden />
      )}
    </div>
  );
}
