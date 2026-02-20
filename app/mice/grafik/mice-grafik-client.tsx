"use client";

import { TapeChart } from "@/components/tape-chart";
import type { ReservationGroupSummary, Room } from "@/lib/tape-chart-types";

export function MiceGrafikClient({
  rooms,
  reservationGroups,
  reservationStatusColors,
  propertyId: initialPropertyId,
}: {
  rooms: Room[];
  reservationGroups: ReservationGroupSummary[];
  reservationStatusColors?: Partial<Record<string, string>> | null;
  propertyId?: string | null;
}) {
  return (
    <TapeChart
      rooms={rooms}
      reservationGroups={reservationGroups}
      initialStatusBg={reservationStatusColors ?? undefined}
      initialPropertyId={initialPropertyId ?? undefined}
    />
  );
}
