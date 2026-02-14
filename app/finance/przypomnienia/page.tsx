"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  getOverdueReservations,
  getDunningConfig,
  runDunningJob,
  type OverdueReservationItem,
  type DunningConfig,
} from "@/app/actions/dunning";
import { toast } from "sonner";
import { Mail, RefreshCw, AlertCircle } from "lucide-react";

export default function PrzypomnieniaPage() {
  const [loading, setLoading] = useState(true);
  const [overdue, setOverdue] = useState<OverdueReservationItem[]>([]);
  const [config, setConfig] = useState<DunningConfig | null>(null);
  const [runLoading, setRunLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [listRes, configRes] = await Promise.all([
        getOverdueReservations(null),
        getDunningConfig(null),
      ]);
      if (!listRes.success) {
        setError(listRes.error);
        setOverdue([]);
      } else {
        setOverdue(listRes.data);
      }
      if (configRes.success) setConfig(configRes.data);
      else setConfig(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleRunJob = async () => {
    setRunLoading(true);
    try {
      const res = await runDunningJob(null);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      const { sent, skipped, errors } = res.data;
      if (errors.length > 0) {
        toast.warning(
          `Wysłano: ${sent}, pominięto (brak e-mail): ${skipped}, błędy: ${errors.length}. ${errors[0]?.error ?? ""}`
        );
      } else {
        toast.success(
          `Wysłano ${sent} przypomnień. Pominięto ${skipped} (brak adresu e-mail).`
        );
      }
      await load();
    } finally {
      setRunLoading(false);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-6 flex gap-2 text-sm text-muted-foreground">
        <Link href="/finance" className="hover:text-foreground">
          Finanse
        </Link>
        <span>/</span>
        <span>Przypomnienia o płatności</span>
      </div>
      <h1 className="text-2xl font-semibold mb-2">Przypomnienia o płatności (dunning)</h1>
      <p className="text-muted-foreground mb-6">
        Rezerwacje z zaległym saldem i miniętym terminem płatności. Możesz uruchomić wysyłkę
        przypomnień e-mail (poziom 1–3 wg konfiguracji).
      </p>

      {config && (
        <div className="mb-6 rounded-lg border bg-muted/30 p-4 text-sm">
          <strong>Konfiguracja:</strong> Termin płatności = check-out + {config.paymentDueDaysAfterCheckout} dni.
          Poziomy: 1. przypomnienie po {config.level1Days} dniach zaległości, 2. po {config.level2Days}, 3. po {config.level3Days}.
          Maks. {config.maxReminders} przypomnienia na rezerwację.
          {!config.enabled && (
            <span className="ml-2 text-amber-600 font-medium">(wysyłka wyłączona w konfiguracji)</span>
          )}
        </div>
      )}

      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          {error}
        </div>
      )}

      <div className="mb-4 flex items-center gap-4">
        <Button onClick={load} variant="outline" size="sm" disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Odśwież
        </Button>
        <Button
          onClick={handleRunJob}
          disabled={loading || runLoading || overdue.length === 0}
        >
          <Mail className="h-4 w-4 mr-2" />
          {runLoading ? "Wysyłanie…" : "Uruchom wysyłkę przypomnień"}
        </Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Ładowanie…</p>
      ) : overdue.length === 0 ? (
        <p className="text-muted-foreground">Brak rezerwacji z zaległym saldem do przypomnienia.</p>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Gość</th>
                <th className="text-left p-3 font-medium">Pokój</th>
                <th className="text-right p-3 font-medium">Saldo (PLN)</th>
                <th className="text-left p-3 font-medium">Termin płatności</th>
                <th className="text-right p-3 font-medium">Dni zaległości</th>
                <th className="text-center p-3 font-medium">Sugerowany poziom</th>
                <th className="text-left p-3 font-medium">E-mail</th>
              </tr>
            </thead>
            <tbody>
              {overdue.map((item) => (
                <tr key={item.reservationId} className="border-b last:border-0">
                  <td className="p-3">{item.guestName}</td>
                  <td className="p-3">{item.roomNumber}</td>
                  <td className="p-3 text-right font-medium">{item.balance.toFixed(2)}</td>
                  <td className="p-3">{item.dueDate.toLocaleDateString("pl-PL")}</td>
                  <td className="p-3 text-right">{item.daysOverdue}</td>
                  <td className="p-3 text-center">{item.suggestedLevel}</td>
                  <td className="p-3 text-muted-foreground">
                    {item.guestEmail ? item.guestEmail : "(brak)"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
