"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RoomCard } from "./room-card";
import type { BookingRoomType } from "@/app/actions/booking-engine";

export function RoomSelection({
  rooms,
  checkIn,
  checkOut,
  adults,
  childrenCount,
  onSelectRoom,
  onRequestRoom,
  onBack,
}: {
  rooms: BookingRoomType[];
  checkIn: string;
  checkOut: string;
  adults: number;
  childrenCount: number;
  onSelectRoom: (room: BookingRoomType, mealPlan: string, totalAmount: number) => void;
  onRequestRoom: (room: BookingRoomType) => void;
  onBack: () => void;
}) {
  const nights = rooms[0]?.priceBreakdown.nights ?? 0;
  const [selectedMealByRoom, setSelectedMealByRoom] = useState<Record<string, string>>({});

  const adultsLabel = adults === 1 ? "Dorosły" : "Dorośli";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {checkIn} — {checkOut} ({nights} {nights === 1 ? "noc" : "nocy"}) · {adults}{" "}
          {adultsLabel.toLowerCase()}
          {childrenCount > 0 && ", " + childrenCount + " " + (childrenCount === 1 ? "dziecko" : "dzieci")}
        </p>
        <Button type="button" variant="outline" onClick={onBack}>
          Inne daty
        </Button>
      </div>

      <ul className="space-y-6">
        {rooms.map((room) => {
          const mealPlan = selectedMealByRoom[room.id] ?? "RO";
          const mealTotal =
            room.priceBreakdown.mealOptions.find((m) => m.plan === mealPlan)?.total ?? 0;
          const totalAmount = room.priceBreakdown.grandTotal + mealTotal;

          return (
            <li key={room.id}>
              <RoomCard
                room={room}
                nights={nights}
                adultsLabel={adultsLabel}
                selectedMealPlan={mealPlan}
                onMealPlanChange={(plan) =>
                  setSelectedMealByRoom((prev) => ({ ...prev, [room.id]: plan }))
                }
                onSelect={() => onSelectRoom(room, mealPlan, totalAmount)}
                onRequest={() => onRequestRoom(room)}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
