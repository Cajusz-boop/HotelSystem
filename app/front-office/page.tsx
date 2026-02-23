import { Suspense } from "react";
import { getTapeChartData } from "@/app/actions/tape-chart";
import { FrontOfficeClient } from "./front-office-client";
import { FrontOfficeError } from "./front-office-error";
import FrontOfficeLoading from "./loading";
import type { Reservation, ReservationGroupSummary, Room } from "@/lib/tape-chart-types";

// Cache 15s – kolejne wejścia w ciągu 15 s będą z cache. revalidatePath z akcji (rezerwacja, pokój itd.) wymusi odświeżenie po zmianach.
export const revalidate = 15;

const INITIAL_DAYS_FORWARD = 15;

async function FrontOfficeData() {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const future = new Date(now);
  future.setDate(future.getDate() + INITIAL_DAYS_FORWARD);
  const dateToInitial = future.toISOString().slice(0, 10);

  let data: { reservations: Reservation[]; rooms: Room[]; reservationGroups: ReservationGroupSummary[]; reservationStatusColors?: Partial<Record<string, string>> | null; propertyId?: string | null };
  try {
    const result = await getTapeChartData({ dateFrom: today, dateTo: dateToInitial });
    data = {
      reservations: result.reservations as Reservation[],
      rooms: result.rooms as Room[],
      reservationGroups: result.reservationGroups.map((g) => ({
        id: g.id,
        name: g.name ?? undefined,
        reservationCount: g.reservationCount,
      })),
      reservationStatusColors: result.reservationStatusColors ?? null,
      propertyId: result.propertyId ?? null,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Nie udało się załadować danych.";
    return (
      <div className="flex flex-col h-screen items-center justify-center p-8">
        <FrontOfficeError
          title="Błąd ładowania Recepcji"
          message={message}
          hint="Sprawdź połączenie z bazą i czy wykonano migracje (np. npx prisma db push lub skrypty w scripts/)."
        />
      </div>
    );
  }
  return (
    <FrontOfficeClient
      initialData={{
        rooms: data.rooms,
        reservationGroups: data.reservationGroups,
        reservationStatusColors: data.reservationStatusColors,
        propertyId: data.propertyId,
        reservations: data.reservations,
      }}
    />
  );
}

export default function FrontOfficePage() {
  return (
    <Suspense fallback={<FrontOfficeLoading />}>
      <FrontOfficeData />
    </Suspense>
  );
}
