"use client";

import { TapeChart } from "@/components/tape-chart";
import type { ReservationGroupSummary, Room } from "@/lib/tape-chart-types";

export function MiceGrafikClient({
  rooms,
  reservationGroups,
  reservationStatusColors,
  reservationStatusLabels,
  reservationStatusDescriptions,
  statusCombinationColors,
  propertyId: initialPropertyId,
}: {
  rooms: Room[];
  reservationGroups: ReservationGroupSummary[];
  reservationStatusColors?: Partial<Record<string, string>> | null;
  reservationStatusLabels?: Partial<Record<string, string>> | null;
  reservationStatusDescriptions?: Partial<Record<string, string>> | null;
  statusCombinationColors?: Partial<Record<string, string>> | null;
  propertyId?: string | null;
}) {
  return (
    <TapeChart
      rooms={rooms}
      reservationGroups={reservationGroups}
      initialStatusBg={reservationStatusColors ?? undefined}
      initialStatusLabels={reservationStatusLabels ?? undefined}
      initialStatusDescriptions={reservationStatusDescriptions ?? undefined}
      initialCombinationColors={statusCombinationColors ?? undefined}
      initialPropertyId={initialPropertyId ?? undefined}
    />
  );
}
