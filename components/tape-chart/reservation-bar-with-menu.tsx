"use client";

import { useRef, useCallback } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import { ReservationBar } from "./reservation-bar";
import { updateReservationStatus } from "@/app/actions/reservations";
import { toast } from "sonner";
import type { Reservation } from "@/lib/tape-chart-types";

const LONG_PRESS_MS = 500;

interface ReservationBarWithMenuProps {
  reservation: Reservation;
  gridRow: number;
  gridColumnStart: number;
  gridColumnEnd: number;
  privacyMode: boolean;
  isDragging?: boolean;
  isPlaceholder?: boolean;
  pricePerNight?: number;
  totalAmount?: number;
  onEdit: (reservation: Reservation) => void;
  onStatusChange?: (updated: Reservation) => void;
}

export function ReservationBarWithMenu({
  reservation,
  gridRow,
  gridColumnStart,
  gridColumnEnd,
  privacyMode,
  isDragging = false,
  isPlaceholder = false,
  pricePerNight,
  totalAmount,
  onEdit,
  onStatusChange,
}: ReservationBarWithMenuProps) {
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const t = e.touches[0];
      touchStartPos.current = { x: t.clientX, y: t.clientY };
      longPressTimer.current = setTimeout(() => {
        longPressTimer.current = null;
        const ev = new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
          clientX: t.clientX,
          clientY: t.clientY,
          button: 2,
          buttons: 2,
        });
        (e.target as HTMLElement).dispatchEvent(ev);
      }, LONG_PRESS_MS);
    },
    []
  );

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    touchStartPos.current = null;
  }, []);

  const handleTouchMove = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleCheckIn = useCallback(async () => {
    const result = await updateReservationStatus(reservation.id, "CHECKED_IN");
    if (result.success && result.data) {
      toast.success("Meldunek zarejestrowany");
      onStatusChange?.(result.data as Reservation);
    } else if (!result.success) toast.error(result.error);
  }, [reservation.id, onStatusChange]);

  const handleCancel = useCallback(async () => {
    const result = await updateReservationStatus(reservation.id, "CANCELLED");
    if (result.success && result.data) {
      toast.success("Rezerwacja anulowana");
      onStatusChange?.(result.data as Reservation);
    } else if (!result.success) toast.error(result.error);
  }, [reservation.id, onStatusChange]);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className="h-full w-full"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchMove={handleTouchMove}
          onTouchCancel={handleTouchEnd}
        >
          <ReservationBar
            reservation={reservation}
            gridRow={gridRow}
            gridColumnStart={gridColumnStart}
            gridColumnEnd={gridColumnEnd}
            privacyMode={privacyMode}
            isDragging={isDragging}
            isPlaceholder={isPlaceholder}
            pricePerNight={pricePerNight}
            totalAmount={totalAmount}
          />
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuItem
          onSelect={() => onEdit(reservation)}
          disabled={reservation.status === "CANCELLED" || reservation.status === "CHECKED_OUT"}
        >
          Edytuj rezerwację
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={handleCheckIn}
          disabled={reservation.status !== "CONFIRMED" && reservation.status !== "CHECKED_IN"}
        >
          Meldunek
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onSelect={handleCancel}
          className="text-destructive focus:text-destructive"
          disabled={reservation.status === "CANCELLED"}
        >
          Anuluj rezerwację
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
