"use client";

import { KwhotelGrafik } from "@/components/tape-chart/kwhotel-grafik";
import type { ReservationGroupSummary, Room } from "@/lib/tape-chart-types";

export function KwhotelClient({
  rooms,
  reservationGroups,
}: {
  rooms: Room[];
  reservationGroups: ReservationGroupSummary[];
}) {
  return <KwhotelGrafik rooms={rooms} reservationGroups={reservationGroups} />;
}
