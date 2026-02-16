"use client";

import { useState, useEffect } from "react";
import { getRevenueAndCostsForProperty } from "@/app/actions/properties";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Property {
  id: string;
  name: string;
  code: string;
}

export function OwnerRevenueSection({ properties }: { properties: Property[] }) {
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<
    Record<string, { revenue: number; costs: number; commission: number; currency: string }>
  >({});

  const loadData = async () => {
    if (properties.length === 0) return;
    setLoading(true);
    const results: typeof data = {};
    for (const prop of properties) {
      const r = await getRevenueAndCostsForProperty(prop.id, {
        dateFrom,
        dateTo,
      });
      if (r.success && r.data) {
        results[prop.id] = r.data;
      }
    }
    setData(results);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- run once on mount

  return (
    <section className="mb-8 rounded-lg border bg-card p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">Przychody i koszty</h2>
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <Label htmlFor="owner-dateFrom">Od</Label>
          <Input
            id="owner-dateFrom"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-auto"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="owner-dateTo">Do</Label>
          <Input
            id="owner-dateTo"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-auto"
          />
        </div>
        <Button onClick={loadData} disabled={loading}>
          {loading ? "Ładowanie…" : "Pobierz dane"}
        </Button>
      </div>

      {Object.keys(data).length > 0 && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Obiekt</TableHead>
                <TableHead className="text-right">Przychód</TableHead>
                <TableHead className="text-right">Prowizje</TableHead>
                <TableHead className="text-right">Koszty</TableHead>
                <TableHead className="text-right">Netto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {properties.map((prop) => {
                const row = data[prop.id];
                if (!row) return null;
                const netto = row.revenue - row.commission - row.costs;
                return (
                  <TableRow key={prop.id}>
                    <TableCell className="font-medium">{prop.name}</TableCell>
                    <TableCell className="text-right">
                      {row.revenue.toFixed(2)} {row.currency}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {row.commission.toFixed(2)} {row.currency}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {row.costs.toFixed(2)} {row.currency}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {netto.toFixed(2)} {row.currency}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
