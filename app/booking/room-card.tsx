"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { BookingRoomType } from "@/app/actions/booking-engine";
import { cn } from "@/lib/utils";

export function RoomCard({
  room,
  nights,
  adultsLabel,
  onSelect,
  onRequest,
  selectedMealPlan,
  onMealPlanChange,
}: {
  room: BookingRoomType;
  nights: number;
  adultsLabel: string;
  onSelect: () => void;
  onRequest: () => void;
  selectedMealPlan: string;
  onMealPlanChange: (plan: string) => void;
}) {
  const [photoError, setPhotoError] = useState(false);
  const { priceBreakdown, restrictions } = room;
  const mealTotal =
    priceBreakdown.mealOptions.find((m) => m.plan === selectedMealPlan)?.total ?? 0;
  const grandTotal = priceBreakdown.grandTotal + mealTotal;

  return (
    <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
      <div className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {room.photoUrl && !photoError ? (
            <div className="sm:w-40 h-32 shrink-0 rounded-lg overflow-hidden bg-muted">
              <img
                src={room.photoUrl}
                alt={room.name}
                className="w-full h-full object-cover"
                onError={() => setPhotoError(true)}
              />
            </div>
          ) : (
            <div className="sm:w-40 h-32 shrink-0 rounded-lg bg-muted flex items-center justify-center text-muted-foreground text-sm">
              📷
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold">{room.name}</h3>
            <p className="text-sm text-muted-foreground mt-0.5">{room.features}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Maks: {room.maxOccupancy ?? "—"} osoby
              {room.bedsDescription && ` · ${room.bedsDescription}`}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-lg bg-muted/50 p-3 text-sm">
          <div className="grid gap-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cena za pokój:</span>
              <span>{priceBreakdown.basePrice} PLN / noc</span>
            </div>
            {priceBreakdown.adultCount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{adultsLabel}:</span>
                <span>
                  {priceBreakdown.adultPrice} × {priceBreakdown.adultCount} ={" "}
                  {priceBreakdown.adultPrice * priceBreakdown.adultCount} PLN / noc
                </span>
              </div>
            )}
            {priceBreakdown.childPrices.map((c, i) => (
              <div key={i} className="flex justify-between">
                <span className="text-muted-foreground">{c.label}:</span>
                <span>{c.price} PLN / noc</span>
              </div>
            ))}
            <div className="border-t mt-2 pt-2 flex justify-between font-medium">
              <span>Suma / noc:</span>
              <span>{priceBreakdown.nightlyTotal} PLN</span>
            </div>
            <div className="flex justify-between font-medium">
              <span>× {nights} noce:</span>
              <span>{priceBreakdown.subtotal} PLN</span>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <Label className="text-sm">Plan wyżywienia</Label>
          <div className="mt-2 space-y-2">
            {priceBreakdown.mealOptions.map((opt) => (
              <label
                key={opt.plan}
                className={cn(
                  "flex items-center gap-2 rounded-md border p-3 cursor-pointer transition-colors",
                  selectedMealPlan === opt.plan
                    ? "border-primary bg-primary/5"
                    : "border-input hover:bg-muted/50"
                )}
              >
                <input
                  type="radio"
                  name={`meal-${room.id}`}
                  value={opt.plan}
                  checked={selectedMealPlan === opt.plan}
                  onChange={() => onMealPlanChange(opt.plan)}
                  className="sr-only"
                />
                <span className="flex-1">
                  {opt.label}
                  {opt.pricePerPerson > 0 && (
                    <span className="text-muted-foreground ml-1">
                      +{opt.pricePerPerson} PLN/os
                    </span>
                  )}
                </span>
                {opt.total > 0 && (
                  <span className="font-medium">{opt.total} PLN</span>
                )}
              </label>
            ))}
          </div>
        </div>

        {(restrictions.minStay != null || restrictions.isNonRefundable) && (
          <p className="mt-3 text-xs text-muted-foreground">
            {restrictions.minStay != null && `Min. ${restrictions.minStay} noc(e). `}
            {restrictions.isNonRefundable && "Rezerwacja bezzwrotna."}
          </p>
        )}

        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <Button
            type="button"
            className="flex-1 bg-blue-600 hover:bg-blue-700 py-3 text-base"
            onClick={onSelect}
          >
            Rezerwuj → {grandTotal} PLN
          </Button>
          <Button type="button" variant="outline" className="py-3" onClick={onRequest}>
            Zapytaj o dostępność
          </Button>
        </div>
      </div>
    </div>
  );
}
