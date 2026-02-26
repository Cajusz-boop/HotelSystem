"use client";

import { Label } from "@/components/ui/label";

const selectClass =
  "flex h-8 w-full rounded border border-input bg-background px-2 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export interface ParkingTabProps {
  parkingSpotId: string;
  parkingSpots: Array<{ id: string; number: string }>;
  onParkingChange: (parkingSpotId: string) => void;
}

export function ParkingTab({ parkingSpotId, parkingSpots, onParkingChange }: ParkingTabProps) {
  return (
    <div className="space-y-4">
      <div className="rounded border bg-muted/10 p-3">
        <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
          Miejsce parkingowe
        </h4>
        <div className="space-y-2">
          <Label className="text-xs">Przypisane miejsce</Label>
          <select
            value={parkingSpotId}
            onChange={(e) => onParkingChange(e.target.value)}
            className={selectClass}
          >
            <option value="">— brak —</option>
            {parkingSpots.map((s) => (
              <option key={s.id} value={s.id}>{s.number}</option>
            ))}
          </select>
          {parkingSpotId ? (
            <p className="text-xs text-muted-foreground">
              Wybrane miejsce zostanie zapisane przy zapisie rezerwacji.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Nie przypisano miejsca parkingowego.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
