"use client";

import { useSearchParams } from "next/navigation";
import { TapeChart } from "@/components/tape-chart";
import type { ReservationGroupSummary, Room } from "@/lib/tape-chart-types";

export function FrontOfficeClient({
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
  const searchParams = useSearchParams();
  const raw = searchParams.get("reservationId");
  const reservationId = raw?.trim() || undefined;
  const e2eOpenCreate = searchParams.get("e2eOpenCreate") === "1";
  return (
    <TapeChart
      rooms={rooms}
      reservationGroups={reservationGroups}
      initialStatusBg={reservationStatusColors ?? undefined}
      initialPropertyId={initialPropertyId ?? undefined}
      initialHighlightReservationId={reservationId}
      initialOpenCreate={e2eOpenCreate}
    />
  );
}
