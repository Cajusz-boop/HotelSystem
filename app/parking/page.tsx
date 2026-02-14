"use client";

import React, { useState, useEffect, useMemo } from "react";
import { getParkingGrafikData } from "@/app/actions/parking";
import { Car } from "lucide-react";

const DAYS_VIEW = 14;

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + n);
  return out;
}

function getDateRange(from: Date, to: Date): string[] {
  const out: string[] = [];
  const curr = new Date(from);
  while (curr <= to) {
    out.push(curr.toISOString().slice(0, 10));
    curr.setUTCDate(curr.getUTCDate() + 1);
  }
  return out;
}

export default function ParkingPage() {
  const today = useMemo(() => new Date(), []);
  const [fromStr, setFromStr] = useState(() => today.toISOString().slice(0, 10));
  const [data, setData] = useState<{ spots: { id: string; number: string }[]; bookings: { id: string; spotNumber: string; startDate: string; endDate: string; guestName?: string }[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fromDate = useMemo(() => new Date(fromStr + "T00:00:00Z"), [fromStr]);
  const toDate = useMemo(() => addDays(fromDate, DAYS_VIEW - 1), [fromDate]);
  const toStr = useMemo(() => toDate.toISOString().slice(0, 10), [toDate]);
  const dates = useMemo(() => getDateRange(fromDate, toDate), [fromDate, toDate]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getParkingGrafikData(fromStr, toStr).then((res) => {
      setLoading(false);
      if (res.success && res.data) setData(res.data);
      else setError(res.success ? null : res.error ?? "Błąd");
    });
  }, [fromStr, toStr]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="text-muted-foreground">Ładowanie grafiku parkingu…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  const spots = data?.spots ?? [];
  const bookings = data?.bookings ?? [];

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <Car className="h-6 w-6" />
        <h1 className="text-xl font-semibold">Grafik Parkingu</h1>
        <input
          type="date"
          value={fromStr}
          onChange={(e) => setFromStr(e.target.value)}
          className="rounded border px-2 py-1 text-sm"
        />
      </div>

      {spots.length === 0 ? (
        <p className="text-muted-foreground">Brak zdefiniowanych miejsc postojowych. Dodaj miejsca w ustawieniach obiektu.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <div
            className="grid min-w-max"
            style={{
              gridTemplateColumns: `100px repeat(${dates.length}, minmax(48px, 1fr))`,
              gridTemplateRows: `32px repeat(${spots.length}, 40px)`,
            }}
          >
            <div className="border-b border-r bg-muted/50 p-1 text-center text-xs font-medium" />
            {dates.map((d) => (
              <div key={d} className="border-b border-r p-1 text-center text-xs text-muted-foreground">
                {new Date(d + "Z").toLocaleDateString("pl-PL", { day: "numeric", month: "short" })}
              </div>
            ))}
            {spots.map((spot, rowIdx) => {
              const row = rowIdx + 2;
              return (
                <React.Fragment key={spot.id}>
                  <div className="border-b border-r bg-muted/30 p-1 text-sm font-medium" style={{ gridRow: row, gridColumn: 1 }}>
                    {spot.number}
                  </div>
                  {dates.map((dateStr, colIdx) => {
                    const booking = bookings.find(
                      (b) =>
                        b.spotNumber === spot.number &&
                        b.startDate <= dateStr &&
                        dateStr < b.endDate
                    );
                    return (
                      <div
                        key={`${spot.id}-${dateStr}`}
                        className="border-b border-r p-0.5"
                        style={{ gridRow: row, gridColumn: colIdx + 2 }}
                      >
                        {booking && (
                          <div
                            className="h-full w-full rounded bg-blue-200 px-1 text-xs truncate"
                            title={booking.guestName ?? "Rezerwacja"}
                          >
                            {booking.guestName ?? "—"}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
