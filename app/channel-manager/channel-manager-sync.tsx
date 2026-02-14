"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { syncChannel } from "@/app/actions/channel-manager";
import { toast } from "sonner";

const CHANNELS: Array<{
  id: "booking_com" | "airbnb" | "expedia" | "amadeus" | "sabre" | "travelport";
  name: string;
  description: string;
}> = [
  { id: "booking_com", name: "Booking.com", description: "B.XML availability (BOOKING_COM_*)." },
  { id: "airbnb", name: "Airbnb", description: "Homes API (AIRBNB_*)." },
  { id: "expedia", name: "Expedia", description: "EQC AR (EXPEDIA_*)." },
  { id: "amadeus", name: "Amadeus", description: "GDS – GDS_AMADEUS_URL." },
  { id: "sabre", name: "Sabre", description: "GDS – GDS_SABRE_URL." },
  { id: "travelport", name: "Travelport", description: "GDS – GDS_TRAVELPORT_URL." },
];

function defaultDateFrom(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function defaultDateTo(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

export type SyncLogEntry = {
  channel: string;
  dateFrom: string;
  dateTo: string;
  timestamp: string;
  success: boolean;
  message: string;
};

export function ChannelManagerSync() {
  const [dateFrom, setDateFrom] = useState(defaultDateFrom);
  const [dateTo, setDateTo] = useState(defaultDateTo);
  const [loading, setLoading] = useState<string | null>(null);
  const [lastSyncLog, setLastSyncLog] = useState<SyncLogEntry | null>(null);

  const handleSync = async (channel: "booking_com" | "airbnb" | "expedia" | "amadeus" | "sabre" | "travelport") => {
    setLoading(channel);
    try {
      const result = await syncChannel(dateFrom, dateTo, channel);
      const chName = CHANNELS.find((c) => c.id === channel)?.name ?? channel;
      const entry: SyncLogEntry = {
        channel: chName,
        dateFrom,
        dateTo,
        timestamp: new Date().toLocaleString("pl-PL"),
        success: result.success,
        message: result.success ? (result.message ?? "OK") : (result.error ?? "Błąd"),
      };
      setLastSyncLog(entry);
      if (result.success) {
        toast.success(result.message ?? `Synchronizacja ${chName} zakończona.`);
      } else {
        toast.error(result.error);
      }
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm mb-6">
      <h2 className="font-semibold text-lg mb-4">Synchronizacja</h2>
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <Label htmlFor="dateFrom" className="text-sm">
            Data od
          </Label>
          <Input
            id="dateFrom"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="mt-1 w-40"
          />
        </div>
        <div>
          <Label htmlFor="dateTo" className="text-sm">
            Data do
          </Label>
          <Input
            id="dateTo"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="mt-1 w-40"
          />
        </div>
        {CHANNELS.map((ch) => (
          <Button
            key={ch.id}
            variant={ch.id === "booking_com" ? "default" : "outline"}
            onClick={() => handleSync(ch.id)}
            disabled={loading !== null}
          >
            {loading === ch.id ? "Synchronizuję…" : ch.id === "booking_com" ? "Synchronizuj" : `Sync ${ch.name}`}
          </Button>
        ))}
      </div>
      {lastSyncLog && (
        <div
          className={`mt-4 rounded-md border p-4 text-sm ${
            lastSyncLog.success ? "border-green-200 bg-green-50 dark:bg-green-950/30" : "border-red-200 bg-red-50 dark:bg-red-950/30"
          }`}
        >
          <h3 className="font-medium mb-1">Ostatnia synchronizacja</h3>
          <p className="text-muted-foreground">
            <span className="font-medium">{lastSyncLog.channel}</span> • {lastSyncLog.timestamp}
          </p>
          <p className="mt-1">{lastSyncLog.dateFrom} – {lastSyncLog.dateTo}</p>
          <p className={`mt-1 ${lastSyncLog.success ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
            {lastSyncLog.message}
          </p>
        </div>
      )}
      <p className="text-xs text-muted-foreground mt-3">
        Konfiguracja: zmienne środowiskowe (BOOKING_COM_*, AIRBNB_*, EXPEDIA_*) oraz mapowanie
        obiektu/pokoi w ustawieniach.
      </p>
    </div>
  );
}
