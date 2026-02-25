"use client";

import { useEffect, useRef, useState } from "react";
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
  today?: string;
}

const LOADING_MSG = "Ładowanie recepcji…";

export function FrontOfficeClient({ initialData }: { initialData: FrontOfficeInitialData }) {
  const [data, setData] = useState(() => ({
    rooms: initialData?.rooms ?? [],
    reservationGroups: initialData?.reservationGroups ?? [],
    reservationStatusColors: initialData?.reservationStatusColors ?? null,
    propertyId: initialData?.propertyId ?? null,
    reservations: initialData?.reservations ?? [],
    today: initialData?.today ?? undefined,
  }));
  const searchParams = useSearchParams();
  const [reservationId, setReservationId] = useState<string | undefined>(undefined);
  const [e2eOpenCreate, setE2eOpenCreate] = useState(false);
  /** Tape Chart tylko po mount – serwer i klient renderują ten sam placeholder, zero hydratacji tego fragmentu. */
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    const raw = searchParams.get("reservationId");
    setReservationId(raw?.trim() || undefined);
    setE2eOpenCreate(searchParams.get("e2eOpenCreate") === "1");
  }, [searchParams]);

  useEffect(() => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const to = new Date(now);
    to.setDate(to.getDate() + 42);
    const dateTo = to.toISOString().slice(0, 10);
    getTapeChartData({ dateFrom: today, dateTo }).then((full) => {
      setData((prev) => ({
        rooms: Array.isArray(full.rooms) ? (full.rooms as Room[]) : [],
        reservationGroups: Array.isArray(full.reservationGroups)
          ? full.reservationGroups.map((g) => ({
              id: g.id,
              name: g.name ?? undefined,
              reservationCount: g.reservationCount,
            }))
          : [],
        reservationStatusColors: full.reservationStatusColors ?? null,
        propertyId: full.propertyId ?? null,
        reservations: Array.isArray(full.reservations) ? (full.reservations as Reservation[]) : [],
        today: prev.today ?? today,
      }));
    }).catch(() => {
      // Zachowaj initialData przy błędzie
    });
  }, []);

  const rooms = Array.isArray(data.rooms) ? data.rooms : [];
  const reservationGroups = Array.isArray(data.reservationGroups) ? data.reservationGroups : [];
  const reservations = Array.isArray(data.reservations) ? data.reservations : [];

  const hadDataRef = useRef(false);
  if (rooms.length > 0) hadDataRef.current = true;

  console.log("[FrontOfficeClient render]", {
    hasMounted,
    roomsLength: rooms.length,
    dataRoomsLength: data?.rooms?.length,
  });

  if (!hasMounted || (rooms.length === 0 && !hadDataRef.current)) {
    console.log("[FrontOfficeClient] SHOWING LOADING - reason:", !hasMounted ? "not mounted" : "rooms empty");
    return (
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden items-center justify-center p-8 text-muted-foreground">
        {LOADING_MSG}
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      <TapeChartStoreProvider reservations={reservations}>
        <TapeChart
          rooms={rooms}
          reservationGroups={reservationGroups}
          initialStatusBg={data.reservationStatusColors ?? undefined}
          initialPropertyId={data.propertyId ?? undefined}
          initialTodayStr={data.today}
          initialHighlightReservationId={reservationId}
          initialOpenCreate={e2eOpenCreate}
        />
      </TapeChartStoreProvider>
    </div>
  );
}
