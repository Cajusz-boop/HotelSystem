import { Suspense } from "react";
import { unstable_noStore } from "next/cache";
import { getTapeChartData } from "@/app/actions/tape-chart";
import { FrontOfficeClient } from "./front-office-client";
import { FrontOfficeError } from "./front-office-error";
import FrontOfficeLoading from "./loading";
import type { Reservation, ReservationGroupSummary, Room } from "@/lib/tape-chart-types";

/** Brak cache HTML – przy F5 zawsze świeży server render (fix: F5 vs Ctrl+Shift+R, anulacje, loading przy dragu). */
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Zgodne z widokiem "Tydzień" w TapeChart (42 dni) – mniej DOM, szybszy load */
const INITIAL_DAYS_VIEW = 42;

async function FrontOfficeData() {
  unstable_noStore();
  const now = new Date();
  // Używaj polskiej strefy czasowej dla spójności z klientem (unika rozbieżności UTC vs local o północy)
  const today = now.toLocaleDateString('sv-SE', { timeZone: 'Europe/Warsaw' });
  const future = new Date(now);
  future.setDate(future.getDate() + INITIAL_DAYS_VIEW);
  const dateToInitial = future.toLocaleDateString('sv-SE', { timeZone: 'Europe/Warsaw' });

  let data: { reservations: Reservation[]; rooms: Room[]; reservationGroups: ReservationGroupSummary[]; reservationStatusColors?: Partial<Record<string, string>> | null; propertyId?: string | null; events?: Array<{ id: string; name: string; dateFrom: string; dateTo: string; color: string | null; description?: string | null }> };
  try {
    const result = await getTapeChartData({ dateFrom: today, dateTo: dateToInitial });
    if (!result?.rooms || !result?.reservations) {
      throw new Error("Nieprawidłowa odpowiedź z getTapeChartData");
    }
    data = {
      reservations: result.reservations as Reservation[],
      rooms: result.rooms as Room[],
      reservationGroups: (result.reservationGroups ?? []).map((g) => ({
        id: g.id,
        name: g.name ?? undefined,
        reservationCount: g.reservationCount,
      })),
      reservationStatusColors: result.reservationStatusColors ?? null,
      propertyId: result.propertyId ?? null,
      events: result.events ?? [],
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
        today,
        events: data.events,
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
