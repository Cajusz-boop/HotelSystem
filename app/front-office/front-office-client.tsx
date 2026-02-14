"use client";

import { useSearchParams } from "next/navigation";
import { TapeChart } from "@/components/tape-chart";
import type { ReservationGroupSummary, Room } from "@/lib/tape-chart-types";

export function FrontOfficeClient({
  rooms,
  reservationGroups,
}: {
  rooms: Room[];
  reservationGroups: ReservationGroupSummary[];
}) {
  const searchParams = useSearchParams();
  const raw = searchParams.get("reservationId");
  const reservationId = raw?.trim() || undefined;
  return (
    <TapeChart
      rooms={rooms}
      reservationGroups={reservationGroups}
      initialHighlightReservationId={reservationId}
    />
  );
}
