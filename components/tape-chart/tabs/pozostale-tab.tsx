"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getReservationAuditLog } from "@/app/actions/reservations";
import type { SettlementTabFormState } from "./settlement-tab";

const SOURCE_OPTIONS = [
  { value: "PHONE", label: "Telefon" },
  { value: "EMAIL", label: "Email" },
  { value: "WALK_IN", label: "Osobiście (walk-in)" },
  { value: "WEBSITE", label: "Strona WWW" },
  { value: "OTA", label: "OTA (portal)" },
  { value: "BOOKING_ENGINE", label: "Silnik rezerwacji" },
  { value: "CHANNEL_MANAGER", label: "Channel Manager" },
  { value: "OTHER", label: "Inne" },
];

const CHANNEL_OPTIONS = [
  { value: "DIRECT", label: "Bezpośrednio" },
  { value: "BOOKING_COM", label: "Booking.com" },
  { value: "EXPEDIA", label: "Expedia" },
  { value: "AIRBNB", label: "Airbnb" },
  { value: "AGODA", label: "Agoda" },
  { value: "OTHER", label: "Inne" },
];

const MEAL_PLAN_OPTIONS = [
  { value: "RO", label: "RO — Tylko nocleg" },
  { value: "BB", label: "BB — Śniadanie" },
  { value: "HB", label: "HB — Półpensja" },
  { value: "FB", label: "FB — Pełne wyżywienie" },
  { value: "AI", label: "AI — All Inclusive" },
  { value: "OTHER", label: "Inne" },
];

const SEGMENT_OPTIONS = [
  { value: "", label: "— brak —" },
  { value: "BUSINESS", label: "Biznes" },
  { value: "LEISURE", label: "Wypoczynek" },
  { value: "GROUP", label: "Grupa" },
  { value: "CORPORATE", label: "Korporacja" },
  { value: "GOVERNMENT", label: "Rząd" },
  { value: "CREW", label: "Załoga" },
  { value: "WHOLESALE", label: "Wholesale" },
  { value: "PACKAGE", label: "Pakiet" },
];

const selectClass =
  "flex h-8 w-full rounded border border-input bg-background px-2 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";
const inputCompact = "h-8 text-xs";

export interface PozostaleTabProps {
  form: SettlementTabFormState;
  onFormChange: (patch: Partial<SettlementTabFormState>) => void;
  reservationId?: string | null;
}

export function PozostaleTab({ form, onFormChange, reservationId }: PozostaleTabProps) {
  const [auditEntries, setAuditEntries] = useState<Array<{ timestamp: string; actionType: string; changesLabel?: string }>>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  useEffect(() => {
    if (!reservationId?.trim()) {
      setAuditEntries([]);
      return;
    }
    setAuditLoading(true);
    getReservationAuditLog(reservationId, { limit: 10 })
      .then((r) => {
        if (r.success && r.data?.entries) {
          setAuditEntries(
            r.data.entries.map((e) => {
              const date = typeof e.timestamp === "string" ? e.timestamp : new Date(e.timestamp).toISOString();
              const dateStr = date.slice(0, 10).split("-").reverse().join(".") + " " + date.slice(11, 16);
              const changesLabel =
                e.changes?.length > 0
                  ? e.changes.slice(0, 2).map((c) => c.field).join(", ") + (e.changes.length > 2 ? "…" : "")
                  : undefined;
              return { timestamp: dateStr, actionType: e.actionType, changesLabel };
            })
          );
        } else setAuditEntries([]);
      })
      .finally(() => setAuditLoading(false));
  }, [reservationId]);

  return (
    <div className="space-y-4">
      <div className="rounded border bg-muted/10 p-3">
        <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
          Źródło i kanał
        </h4>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Źródło</Label>
            <select
              value={form.source}
              onChange={(e) => onFormChange({ source: e.target.value })}
              className={selectClass}
            >
              <option value="">— brak —</option>
              {SOURCE_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Kanał</Label>
            <select
              value={form.channel}
              onChange={(e) => onFormChange({ channel: e.target.value })}
              className={selectClass}
            >
              <option value="">— brak —</option>
              {CHANNEL_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Segment</Label>
            <select
              value={form.segment ?? ""}
              onChange={(e) => onFormChange({ segment: e.target.value })}
              className={selectClass}
            >
              {SEGMENT_OPTIONS.map((s) => (
                <option key={s.value || "_"} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="rounded border bg-muted/10 p-3">
        <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
          Wyżywienie i przyjazd
        </h4>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Wyżywienie</Label>
            <select
              value={form.mealPlan}
              onChange={(e) => onFormChange({ mealPlan: e.target.value })}
              className={selectClass}
            >
              <option value="">— brak —</option>
              {MEAL_PLAN_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">ETA (godzina przyjazdu)</Label>
            <Input
              type="time"
              value={form.eta}
              onChange={(e) => onFormChange({ eta: e.target.value })}
              className={inputCompact}
            />
          </div>
        </div>
      </div>

      <div className="rounded border bg-muted/10 p-3">
        <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
          Rezerwacja zewnętrzna i waluta
        </h4>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Nr rezerwacji online</Label>
            <Input
              value={form.externalReservationNumber ?? ""}
              onChange={(e) => onFormChange({ externalReservationNumber: e.target.value })}
              placeholder="np. Booking.com"
              className={inputCompact}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Waluta</Label>
            <select
              value={form.currency ?? "PLN"}
              onChange={(e) => onFormChange({ currency: e.target.value })}
              className={selectClass}
            >
              <option value="PLN">PLN</option>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
              <option value="CHF">CHF</option>
            </select>
          </div>
        </div>
      </div>

      <div className="rounded border border-dashed border-muted-foreground/40 p-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground mb-1">Kopiuj rezerwację</p>
        <p>TODO: Akcja kopiowania rezerwacji (placeholder).</p>
      </div>
      <div className="rounded border bg-muted/10 p-3">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Historia zmian</p>
        {!reservationId ? (
          <p className="text-xs text-muted-foreground">Zapisz rezerwację, aby zobaczyć historię zmian.</p>
        ) : auditLoading ? (
          <p className="text-xs text-muted-foreground">Ładowanie…</p>
        ) : auditEntries.length === 0 ? (
          <p className="text-xs text-muted-foreground">Brak wpisów w historii.</p>
        ) : (
          <ul className="space-y-1 max-h-40 overflow-y-auto text-xs">
            {auditEntries.map((e, i) => (
              <li key={i} className="flex flex-wrap gap-x-2 gap-y-0 text-muted-foreground">
                <span className="shrink-0">{e.timestamp}</span>
                <span>
                  {e.actionType === "CREATE" ? "Utworzenie" : e.actionType === "UPDATE" ? "Zmiana" : e.actionType === "DELETE" ? "Usunięcie" : e.actionType}
                  {e.changesLabel && ` (${e.changesLabel})`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
