import { TapeChartStoreProvider } from "@/lib/store/tape-chart-store";
import { getTapeChartData } from "@/app/actions/tape-chart";
import { prisma } from "@/lib/db";
import { getEffectivePropertyId } from "@/app/actions/properties";
import { MiceGrafikClient } from "./mice-grafik-client";
import { FrontOfficeError } from "@/app/front-office/front-office-error";
import type { Reservation, ReservationGroupSummary, Room } from "@/lib/tape-chart-types";

export const metadata = {
  title: "Grafik sal – MICE",
  description: "Grafik rezerwacji sal konferencyjnych",
};

export const dynamic = "force-dynamic";

export default async function MiceGrafikPage() {
  try {
    const propertyId = await getEffectivePropertyId();
    const salaRooms = await prisma.room.findMany({
      where: {
        type: "Sala",
        activeForSale: true,
        ...(propertyId ? { propertyId } : {}),
      },
      select: { id: true },
      orderBy: { number: "asc" },
    });
    const roomIds = salaRooms.map((r) => r.id);

    const result = roomIds.length > 0
      ? await getTapeChartData({ roomIds })
      : { reservations: [], rooms: [], reservationGroups: [] };

    const data = {
      reservations: result.reservations as Reservation[],
      rooms: result.rooms as Room[],
      reservationGroups: result.reservationGroups.map((g) => ({
        id: g.id,
        name: g.name ?? undefined,
        reservationCount: g.reservationCount,
      })),
    };

    if (data.rooms.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center p-12">
          <h1 className="text-2xl font-semibold mb-4">Grafik sal konferencyjnych</h1>
          <p className="text-muted-foreground">
            Brak pokoi typu „Sala” w systemie. Dodaj sale konferencyjne w module Pokoje (typ: Sala).
          </p>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-screen">
        <TapeChartStoreProvider reservations={data.reservations}>
          <MiceGrafikClient
            rooms={data.rooms}
            reservationGroups={data.reservationGroups}
          />
        </TapeChartStoreProvider>
      </div>
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Nie udało się załadować danych.";
    return (
      <div className="flex flex-col h-screen items-center justify-center p-8">
        <FrontOfficeError
          title="Błąd ładowania grafiku sal"
          message={message}
          hint="Sprawdź połączenie z bazą i czy wykonano migracje."
        />
      </div>
    );
  }
}
