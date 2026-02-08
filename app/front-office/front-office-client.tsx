"use client";

import { useSearchParams } from "next/navigation";
import { TapeChart } from "@/components/tape-chart";
import type { Room } from "@/lib/tape-chart-types";

export function FrontOfficeClient({ rooms }: { rooms: Room[] }) {
  const searchParams = useSearchParams();
  const raw = searchParams.get("reservationId");
  const reservationId = raw?.trim() || undefined;
  return <TapeChart rooms={rooms} initialHighlightReservationId={reservationId} />;
}
