"use client";

import { useDroppable } from "@dnd-kit/core";
import { memo, useCallback } from "react";

interface CellDroppableProps {
  roomNumber: string;
  dateStr: string;
  isInDragRange?: boolean;
  /** Pozycja komórki w zakresie dragu – wpływa na kształt podświetlenia (zgodny z paskiem rezerwacji) */
  dragRangePosition?: "start" | "middle" | "end" | "single" | null;
  children?: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  /** Czy komórka jest w zaznaczeniu (zielone tło) */
  isSelected?: boolean;
  /** Czy komórka ma rezerwację – tylko pusta reaguje na klik (Ctrl+klik obsługiwany osobno) */
  hasReservation?: boolean;
  /** Zwykły klik w pustą komórkę → otwórz formularz nowej pojedynczej rezerwacji */
  onCellClick?: () => void;
  title?: string;
}

/**
 * Droppable zone for a single cell (room × date) in the tape chart grid.
 * The id format is: cell-{roomNumber}-{dateStr}
 * Example: cell-008-2026-03-06
 *
 * Podświetlenie odpowiada pozycji paska rezerwacji (od połowy dnia check-in do połowy dnia check-out):
 * - start: prawa połowa (check-in ~14:00)
 * - middle: cała komórka
 * - end: lewa połowa (check-out ~14:00)
 * - single: prawa połowa (jedna noc = od połowy dnia do połowy następnego)
 */
export const CellDroppable = memo(function CellDroppable({
  roomNumber,
  dateStr,
  isInDragRange,
  dragRangePosition,
  children,
  style,
  className,
  isSelected,
  hasReservation,
  onCellClick,
  title,
}: CellDroppableProps) {
  const droppableId = `cell-${roomNumber}-${dateStr}`;

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (hasReservation) return;
      if (e.ctrlKey || e.metaKey) return;
      e.stopPropagation();
      onCellClick?.();
    },
    [hasReservation, onCellClick]
  );

  const { setNodeRef, isOver } = useDroppable({
    id: droppableId,
    data: {
      type: "cell",
      roomNumber,
      dateStr,
    },
  });

  // Podświetlenie w zależności od pozycji w zakresie (zgodne z wizualizacją paska rezerwacji)
  let highlightStyle: React.CSSProperties = {};
  if (isSelected) {
    highlightStyle = { backgroundColor: "rgba(34, 197, 94, 0.25)" };
  } else if (isOver || isInDragRange) {
    const color = isOver ? "rgba(59, 130, 246, 0.25)" : "rgba(59, 130, 246, 0.12)";

    switch (dragRangePosition) {
      case "start":
        // Prawa połowa komórki (check-in zaczyna się od połowy dnia)
        highlightStyle = {
          background: `linear-gradient(to right, transparent 50%, ${color} 50%)`,
        };
        break;
      case "end":
        // Lewa połowa komórki (check-out kończy się na połowie dnia)
        highlightStyle = {
          background: `linear-gradient(to right, ${color} 50%, transparent 50%)`,
        };
        break;
      case "middle":
        highlightStyle = { backgroundColor: color };
        break;
      case "single":
        // Jedna noc: od połowy dnia do połowy następnego → prawa połowa tej komórki
        highlightStyle = {
          background: `linear-gradient(to right, transparent 50%, ${color} 50%)`,
        };
        break;
      default:
        // Fallback gdy brak dragRangePosition (np. isOver bez zakresu)
        highlightStyle = { backgroundColor: color };
        break;
    }
  }

  return (
    <div
      ref={setNodeRef}
      data-testid={`cell-${roomNumber}-${dateStr}`}
      data-room={roomNumber}
      data-date={dateStr}
      data-cell-room={roomNumber}
      data-cell-date={dateStr}
      onClick={handleClick}
      title={title}
      style={{
        ...style,
        ...highlightStyle,
        transition: isOver || isInDragRange ? "background 0.1s" : undefined,
      }}
      className={className}
    >
      {children}
    </div>
  );
});
