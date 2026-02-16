"use client";

import { Sparkles, AlertTriangle, Wrench, ClipboardCheck, CheckCircle, Clock, Settings } from "lucide-react";
import type { RoomStatus } from "@/lib/tape-chart-types";
import { cn } from "@/lib/utils";

/** Badge + ikona – CLEAN=zielony, DIRTY=żółty, OOO=czerwony, INSPECTION=niebieski (WCAG AA) */
const statusConfig: Record<
  RoomStatus,
  { icon: typeof Sparkles; label: string; description: string; badgeClass: string; iconClass: string }
> = {
  CLEAN: {
    icon: Sparkles,
    label: "Czysty",
    description: "Pokój posprzątany i gotowy do zameldowania gościa",
    badgeClass: "bg-green-600 text-white",
    iconClass: "text-white",
  },
  DIRTY: {
    icon: AlertTriangle,
    label: "Do sprzątania",
    description: "Pokój wymaga sprzątania przed przyjęciem kolejnego gościa",
    badgeClass: "bg-amber-500 text-gray-900",
    iconClass: "text-gray-900",
  },
  OOO: {
    icon: Wrench,
    label: "OOO",
    description: "Pokój wyłączony z użytku (Out of Order) – nie można go rezerwować",
    badgeClass: "bg-red-600 text-white",
    iconClass: "text-white",
  },
  INSPECTION: {
    icon: ClipboardCheck,
    label: "Do sprawdzenia",
    description: "Pokój posprzątany, oczekuje na kontrolę jakości przez kierownika",
    badgeClass: "bg-blue-600 text-white",
    iconClass: "text-white",
  },
  INSPECTED: {
    icon: CheckCircle,
    label: "Sprawdzony",
    description: "Pokój przeszedł kontrolę jakości – posprzątany i zweryfikowany",
    badgeClass: "bg-green-700 text-white",
    iconClass: "text-white",
  },
  CHECKOUT_PENDING: {
    icon: Clock,
    label: "Oczekuje wymeldowania",
    description: "Gość powinien się dziś wymeldować – pokój wkrótce do sprzątania",
    badgeClass: "bg-amber-600 text-white",
    iconClass: "text-white",
  },
  MAINTENANCE: {
    icon: Settings,
    label: "Do naprawy",
    description: "Pokój wymaga naprawy technicznej (np. awaria, usterka) – niedostępny",
    badgeClass: "bg-slate-600 text-white",
    iconClass: "text-white",
  },
};

interface RoomStatusIconProps {
  status: RoomStatus;
  className?: string;
  showLabel?: boolean;
  compact?: boolean;
}

export function RoomStatusIcon({ status, className, showLabel = true, compact = false }: RoomStatusIconProps) {
  const { icon: Icon, label, description, badgeClass, iconClass } = statusConfig[status];
  const tooltip = `${label} – ${description}`;

  if (compact) {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-full shrink-0",
          badgeClass,
          "h-5 w-5",
          className
        )}
        title={tooltip}
      >
        <Icon className={cn("h-3 w-3 shrink-0", iconClass)} aria-hidden />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        badgeClass,
        className
      )}
      title={tooltip}
    >
      <Icon className={cn("h-3.5 w-3.5 shrink-0", iconClass)} aria-hidden />
      {showLabel && <span>{label}</span>}
    </span>
  );
}
