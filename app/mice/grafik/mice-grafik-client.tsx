"use client";

import { TapeChart } from "@/components/tape-chart";
import type { ReservationGroupSummary, Room } from "@/lib/tape-chart-types";

export function MiceGrafikClient({
  rooms,
  reservationGroups,
}: {
  rooms: Room[];
  reservationGroups: ReservationGroupSummary[];
}) {
  return (
    <TapeChart
      rooms={rooms}
      reservationGroups={reservationGroups}
    />
  );
}
