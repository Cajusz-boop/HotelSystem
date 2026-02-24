"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { TapeChart } from "@/components/tape-chart";
import { TapeChartStoreProvider } from "@/lib/store/tape-chart-store";
import { getTapeChartData } from "@/app/actions/tape-chart";
import type { Reservation, ReservationGroupSummary, Room } from "@/lib/tape-chart-types";

interface FrontOfficeInitialData {
  rooms: Room[];
  reservationGroups: ReservationGroupSummary[];
  reservationStatusColors?: Partial<Record<string, string>> | null;
  propertyId?: string | null;
  reservations: Reservation[];
}

export function FrontOfficeClient({ initialData }: { initialData: FrontOfficeInitialData }) {
  const [data, setData] = useState(() => ({
    rooms: initialData?.rooms ?? [],
    reservationGroups: initialData?.reservationGroups ?? [],
    reservationStatusColors: initialData?.reservationStatusColors ?? null,
    propertyId: initialData?.propertyId ?? null,
    reservations: initialData?.reservations ?? [],
  }));
  const searchParams = useSearchParams();
  const raw = searchParams.get("reservationId");
  const reservationId = raw?.trim() || undefined;
  const e2eOpenCreate = searchParams.get("e2eOpenCreate") === "1";

  useEffect(() => {
    getTapeChartData()
      .then((full) => {
        const next = full && typeof full === "object" ? full : null;
        if (!next) return;
        setData({
          rooms: (full?.rooms ?? []) as Room[],
          reservationGroups: (next.reservationGroups ?? []).map((g) => ({
            id: g?.id,
            name: g?.name ?? undefined,
            reservationCount: g?.reservationCount ?? 0,
          })),
          reservationStatusColors: next.reservationStatusColors ?? null,
          propertyId: next.propertyId ?? null,
          reservations: (full?.reservations ?? []) as Reservation[],
        });
      })
      .catch((err) => console.error("[FrontOffice] getTapeChartData failed:", err));
  }, []);

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <TapeChartStoreProvider reservations={data.reservations}>
        <TapeChart
          rooms={data.rooms}
          reservationGroups={data.reservationGroups}
          initialStatusBg={data.reservationStatusColors ?? undefined}
          initialPropertyId={data.propertyId ?? undefined}
          initialHighlightReservationId={reservationId}
          initialOpenCreate={e2eOpenCreate}
        />
      </TapeChartStoreProvider>
    </div>
  );
}
