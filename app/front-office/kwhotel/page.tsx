import { TapeChartStoreProvider } from "@/lib/store/tape-chart-store";
import { getTapeChartData } from "@/app/actions/tape-chart";
import { FrontOfficeError } from "../front-office-error";
import { KwhotelClient } from "./kwhotel-client";
import type { Reservation, ReservationGroupSummary, Room } from "@/lib/tape-chart-types";

export const dynamic = "force-dynamic";

export default async function RecepcjaKwhotelPage() {
  let data: {
    reservations: Reservation[];
    rooms: Room[];
    reservationGroups: ReservationGroupSummary[];
  };
  try {
    const result = await getTapeChartData();
    data = {
      reservations: result.reservations as Reservation[],
      rooms: result.rooms as Room[],
      reservationGroups: result.reservationGroups.map((g) => ({
        id: g.id,
        name: g.name ?? undefined,
        reservationCount: g.reservationCount,
      })),
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Nie udało się załadować danych.";
    return (
      <div className="flex flex-col h-screen items-center justify-center p-8">
        <FrontOfficeError
          title="Błąd ładowania Recepcja Kwhotel"
          message={message}
          hint="Sprawdź połączenie z bazą i czy wykonano migracje."
        />
      </div>
    );
  }
  return (
    <div className="flex flex-col h-screen">
      <TapeChartStoreProvider reservations={data.reservations}>
        <KwhotelClient rooms={data.rooms} reservationGroups={data.reservationGroups} />
      </TapeChartStoreProvider>
    </div>
  );
}
