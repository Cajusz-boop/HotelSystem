"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  getExpectedMealsForDate,
  getReservationsWithMealPlanForDate,
  getMealConsumptionsForDate,
  recordMealConsumption,
  MEAL_PLAN_MEALS,
} from "@/app/actions/meals";
import { chargeMealConsumptionsToReservation } from "@/app/actions/finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const MEAL_PLAN_LABELS: Record<string, string> = {
  RO: "Tylko nocleg",
  BB: "Śniadanie",
  HB: "Śniadanie + kolacja",
  FB: "Pełne wyżywienie",
  AI: "All Inclusive",
};

export default function MealsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [dateStr, setDateStr] = useState(today);
  const [expected, setExpected] = useState<{ breakfast: number; lunch: number; dinner: number } | null>(null);
  const [reservations, setReservations] = useState<Array<{ id: string; roomNumber: string; guestName: string; mealPlan: string; pax: number }>>([]);
  const [consumptions, setConsumptions] = useState<Array<{ reservationId: string; roomNumber: string; guestName: string; mealType: string; paxCount: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [chargingId, setChargingId] = useState<string | null>(null);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      getExpectedMealsForDate(dateStr),
      getReservationsWithMealPlanForDate(dateStr),
      getMealConsumptionsForDate(dateStr),
    ]).then(([expRes, resRes, consRes]) => {
      if (expRes.success && expRes.data) setExpected(expRes.data);
      if (resRes.success && resRes.data) setReservations(resRes.data);
      if (consRes.success && consRes.data) setConsumptions(consRes.data);
      setLoading(false);
    });
  };

  useEffect(() => loadData(), [dateStr]);

  const handleRecord = async (reservationId: string, mealType: string, paxCount: number) => {
    const r = await recordMealConsumption(reservationId, dateStr, mealType as "BREAKFAST" | "LUNCH" | "DINNER", paxCount);
    if (r.success) {
      toast.success("Zapisano");
      loadData();
    } else {
      toast.error(r.error);
    }
  };

  const getConsumed = (reservationId: string, mealType: string) =>
    consumptions.find((c) => c.reservationId === reservationId && c.mealType === mealType);

  const getConsumptionCount = (reservationId: string) =>
    consumptions.filter((c) => c.reservationId === reservationId).length;

  const handleCharge = async (reservationId: string) => {
    setChargingId(reservationId);
    const r = await chargeMealConsumptionsToReservation(reservationId, dateStr);
    setChargingId(null);
    if (r.success) {
      if (r.data.transactionIds.length > 0) {
        toast.success(`Doliczono ${r.data.totalAmount.toFixed(2)} zł do rachunku`);
      } else {
        toast.info("Brak posiłków do doliczenia lub już doliczone");
      }
      loadData();
    } else {
      toast.error(r.error);
    }
  };

  if (loading) return <p className="text-muted-foreground p-8">Ładowanie…</p>;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold mb-6">Moduł posiłków (meal plan)</h1>
      <p className="text-muted-foreground mb-6">
        Tracking wyżywienia BB, HB, FB, AI. <Link href="/front-office" className="text-primary hover:underline">Powrót do recepcji</Link>
      </p>

      <div className="flex items-center gap-4 mb-6">
        <Label htmlFor="meal-date">Data</Label>
        <Input
          id="meal-date"
          type="date"
          value={dateStr}
          onChange={(e) => setDateStr(e.target.value)}
          className="w-auto"
        />
      </div>

      {expected && (
        <div className="rounded-lg border p-4 mb-6 max-w-md">
          <h2 className="font-semibold mb-2">Oczekiwane posiłki (rezerwacje z wyżywieniem)</h2>
          <div className="flex gap-6 text-sm">
            <span>Śniadania: <strong>{expected.breakfast}</strong></span>
            <span>Obiady: <strong>{expected.lunch}</strong></span>
            <span>Kolacje: <strong>{expected.dinner}</strong></span>
          </div>
        </div>
      )}

      <div className="rounded-lg border overflow-hidden">
        <h2 className="font-semibold p-4 bg-muted/50">Rezerwacje z planem wyżywienia</h2>
        {reservations.length === 0 ? (
          <p className="p-4 text-muted-foreground text-sm">Brak rezerwacji z wyżywieniem na ten dzień.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="text-left p-2">Pokój</th>
                <th className="text-left p-2">Gość</th>
                <th className="text-left p-2">Plan</th>
                <th className="text-left p-2">PAX</th>
                <th className="text-left p-2">Śniadanie</th>
                <th className="text-left p-2">Obiad</th>
                <th className="text-left p-2">Kolacja</th>
                <th className="text-left p-2">Obciążenie</th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((r) => {
                const meals = MEAL_PLAN_MEALS[r.mealPlan] ?? ["BREAKFAST"];
                return (
                  <tr key={r.id} className="border-t">
                    <td className="p-2">{r.roomNumber}</td>
                    <td className="p-2">{r.guestName}</td>
                    <td className="p-2">{MEAL_PLAN_LABELS[r.mealPlan] ?? r.mealPlan}</td>
                    <td className="p-2">{r.pax}</td>
                    {(["BREAKFAST", "LUNCH", "DINNER"] as const).map((mt) => {
                      const consumed = getConsumed(r.id, mt);
                      const hasPlan = meals.includes(mt);
                      return (
                        <td key={mt} className="p-2">
                          {hasPlan ? (
                            consumed ? (
                              <span className="text-emerald-600">{consumed.paxCount} zapisane</span>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRecord(r.id, mt, r.pax)}
                              >
                                Zapisz ({r.pax})
                              </Button>
                            )
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="p-2">
                      {getConsumptionCount(r.id) > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={chargingId === r.id}
                          onClick={() => handleCharge(r.id)}
                        >
                          {chargingId === r.id ? "…" : "Dolicz do rachunku"}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
