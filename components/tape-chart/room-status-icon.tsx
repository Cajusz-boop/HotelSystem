"use client";

import { Sparkles, AlertTriangle, Wrench, ClipboardCheck } from "lucide-react";
import type { RoomStatus } from "@/lib/tape-chart-types";
import { cn } from "@/lib/utils";

/** Badge + ikona – CLEAN=zielony, DIRTY=żółty, OOO=czerwony, INSPECTION=niebieski (WCAG AA) */
const statusConfig: Record<
  RoomStatus,
  { icon: typeof Sparkles; label: string; badgeClass: string; iconClass: string }
> = {
  CLEAN: {
    icon: Sparkles,
    label: "Czysty",
    badgeClass: "bg-green-600 text-white",
    iconClass: "text-white",
  },
  DIRTY: {
    icon: AlertTriangle,
    label: "Do sprzątania",
    badgeClass: "bg-amber-500 text-gray-900",
    iconClass: "text-gray-900",
  },
  OOO: {
    icon: Wrench,
    label: "OOO",
    badgeClass: "bg-red-600 text-white",
    iconClass: "text-white",
  },
  INSPECTION: {
    icon: ClipboardCheck,
    label: "Do sprawdzenia",
    badgeClass: "bg-blue-600 text-white",
    iconClass: "text-white",
  },
};

interface RoomStatusIconProps {
  status: RoomStatus;
  className?: string;
  showLabel?: boolean;
}

export function RoomStatusIcon({ status, className, showLabel = true }: RoomStatusIconProps) {
  const { icon: Icon, label, badgeClass, iconClass } = statusConfig[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        badgeClass,
        className
      )}
      title={label}
    >
      <Icon className={cn("h-3.5 w-3.5 shrink-0", iconClass)} aria-hidden />
      {showLabel && <span>{label}</span>}
    </span>
  );
}
