"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getLoginReport, type LoginLogItem } from "@/app/actions/audit";
import { toast } from "sonner";
import { RefreshCw, LogIn } from "lucide-react";

export default function LoginsReportPage() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [emailFilter, setEmailFilter] = useState("");
  const [items, setItems] = useState<LoginLogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = async () => {
    setLoading(true);
    setLoaded(true);
    const result = await getLoginReport({
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
      email: emailFilter.trim() || undefined,
      limit: 500,
    });
    setLoading(false);
    if (result.success) {
      setItems(result.data);
    } else {
      toast.error(result.error);
      setItems([]);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex flex-wrap items-end gap-4">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <LogIn className="h-6 w-6" />
          Raport logowań użytkowników
        </h1>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">Od</Label>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="mt-1 w-40"
            />
          </div>
          <div>
            <Label className="text-xs">Do</Label>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="mt-1 w-40"
            />
          </div>
          <div>
            <Label className="text-xs">Email (zawiera)</Label>
            <Input
              type="text"
              placeholder="np. @hotel.pl"
              value={emailFilter}
              onChange={(e) => setEmailFilter(e.target.value)}
              className="mt-1 w-44"
            />
          </div>
          <Button onClick={load} disabled={loading}>
            {loading ? "Ładowanie…" : <RefreshCw className="mr-2 h-4 w-4" />}
            Pobierz
          </Button>
        </div>
      </div>

      {loaded && (
        <p className="text-sm text-muted-foreground">
          Wyświetlono {items.length} wpisów (max 500). Kolejność: od najnowszych.
        </p>
      )}

      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/95">
              <tr className="border-b">
                <th className="text-left p-2 font-medium whitespace-nowrap">Data/czas</th>
                <th className="text-left p-2 font-medium whitespace-nowrap">Użytkownik</th>
                <th className="text-left p-2 font-medium whitespace-nowrap">Email</th>
                <th className="text-left p-2 font-medium whitespace-nowrap">Sukces</th>
                <th className="text-left p-2 font-medium whitespace-nowrap">IP</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="p-2 whitespace-nowrap">
                    {new Date(row.loggedAt).toLocaleString("pl-PL")}
                  </td>
                  <td className="p-2 whitespace-nowrap">{row.userName ?? "—"}</td>
                  <td className="p-2 whitespace-nowrap">{row.email}</td>
                  <td className="p-2 whitespace-nowrap">
                    {row.success ? (
                      <span className="text-green-600">Tak</span>
                    ) : (
                      <span className="text-destructive">Nie</span>
                    )}
                  </td>
                  <td className="p-2 whitespace-nowrap text-muted-foreground">{row.ipAddress ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {items.length === 0 && loaded && !loading && (
          <div className="p-8 text-center text-muted-foreground">
            Brak wpisów dla wybranych filtrów.
          </div>
        )}
      </div>
    </div>
  );
}
