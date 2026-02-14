"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface OrderRow {
  id: string;
  name: string;
  eventType: string;
  roomIds: string[];
  dateFrom: string;
  dateTo: string;
  status: string;
  roomNumbers: string;
}

export function EventyClient({
  orders,
  eventTypeLabels,
  statusLabels,
}: {
  orders: OrderRow[];
  eventTypeLabels: Record<string, string>;
  statusLabels: Record<string, string>;
}) {
  const [filterEventType, setFilterEventType] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (filterEventType && o.eventType !== filterEventType) return false;
      if (filterDateFrom && o.dateTo < filterDateFrom) return false;
      if (filterDateTo && o.dateFrom > filterDateTo) return false;
      return true;
    });
  }, [orders, filterEventType, filterDateFrom, filterDateTo]);

  const byType = useMemo(() => {
    const m: Record<string, OrderRow[]> = {};
    for (const o of filtered) {
      const t = o.eventType || "OTHER";
      if (!m[t]) m[t] = [];
      m[t].push(o);
    }
    return m;
  }, [filtered]);

  const types = ["WEDDING", "CONFERENCE", "BANQUET", "OTHER"];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-4 items-end">
        <div className="flex items-center gap-2">
          <Label htmlFor="f-type" className="text-xs">Typ eventu</Label>
          <select
            id="f-type"
            value={filterEventType}
            onChange={(e) => setFilterEventType(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
          >
            <option value="">Wszystkie</option>
            {types.map((t) => (
              <option key={t} value={t}>{eventTypeLabels[t] ?? t}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="f-from" className="text-xs">Data od</Label>
          <Input
            id="f-from"
            type="date"
            value={filterDateFrom}
            onChange={(e) => setFilterDateFrom(e.target.value)}
            className="w-auto h-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="f-to" className="text-xs">Data do</Label>
          <Input
            id="f-to"
            type="date"
            value={filterDateTo}
            onChange={(e) => setFilterDateTo(e.target.value)}
            className="w-auto h-9"
          />
        </div>
        {(filterEventType || filterDateFrom || filterDateTo) && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setFilterEventType("");
              setFilterDateFrom("");
              setFilterDateTo("");
            }}
          >
            Wyczyść filtry
          </Button>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {types.map((t) => {
          const items = (byType[t] ?? []).slice(0, 10);
          const total = byType[t]?.length ?? 0;
          return (
            <div key={t} className="rounded-lg border bg-card p-4 shadow-sm">
              <h3 className="font-semibold mb-2">{eventTypeLabels[t] ?? t}</h3>
              <p className="text-sm text-muted-foreground mb-3">{total} zleceń</p>
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Brak zleceń</p>
              ) : (
                <ul className="space-y-2">
                  {items.map((o) => (
                    <li key={o.id} className="text-sm">
                      <Link
                        href={`/mice/zlecenia`}
                        className="text-primary hover:underline font-medium"
                      >
                        {o.name}
                      </Link>
                      <span className="ml-1 text-muted-foreground">
                        {o.dateFrom}–{o.dateTo}
                        {o.roomNumbers && ` · ${o.roomNumbers}`}
                      </span>
                      <span className="ml-1 text-xs">{statusLabels[o.status] ?? o.status}</span>
                    </li>
                  ))}
                  {total > 10 && (
                    <li className="text-xs text-muted-foreground">
                      +{total - 10} więcej
                    </li>
                  )}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <div className="pt-4">
        <Link href="/mice/zlecenia">
          <Button variant="outline">Przejdź do zleceń realizacji</Button>
        </Link>
      </div>
    </div>
  );
}
