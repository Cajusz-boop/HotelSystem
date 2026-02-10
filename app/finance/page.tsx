"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  runNightAudit,
  getCashSumForToday,
  getTransactionsForToday,
  submitBlindDrop,
  voidTransaction,
  verifyManagerPin,
} from "@/app/actions/finance";
import type { TransactionForList } from "@/app/actions/finance";
import { toast } from "sonner";
import { Moon, Banknote, Shield, FileText, Receipt } from "lucide-react";
import { getFiscalConfig } from "@/lib/fiscal";
import type { FiscalConfig } from "@/lib/fiscal/types";

const FINANCE_LOAD_TIMEOUT_MS = 15_000;

export default function FinancePage() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [nightAuditLoading, setNightAuditLoading] = useState(false);
  const [expectedCash, setExpectedCash] = useState<number | null>(null);
  const [blindDropCash, setBlindDropCash] = useState("");
  const [blindDropLoading, setBlindDropLoading] = useState(false);
  const [blindDropResult, setBlindDropResult] = useState<{
    expectedCash: number;
    countedCash: number;
    difference: number;
    isShortage: boolean;
  } | null>(null);
  const [voidTxId, setVoidTxId] = useState("");
  const [voidPin, setVoidPin] = useState("");
  const [voidLoading, setVoidLoading] = useState(false);
  const [todayTransactions, setTodayTransactions] = useState<TransactionForList[]>([]);
  const [fiscalConfig, setFiscalConfig] = useState<FiscalConfig | null>(null);

  const load = () => {
    setLoading(true);
    setLoadError(null);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("Przekroczono limit czasu (15 s). Sprawdź połączenie z bazą.")),
        FINANCE_LOAD_TIMEOUT_MS
      )
    );
    Promise.race([
      Promise.all([
        getCashSumForToday().then((r) => {
          if (r.success && r.data) setExpectedCash(r.data.expectedCash);
        }),
        getTransactionsForToday().then((r) => {
          if (r.success && r.data) setTodayTransactions(r.data);
        }),
        getFiscalConfig().then(setFiscalConfig),
      ]),
      timeoutPromise,
    ])
      .catch((e) => {
        const msg = e instanceof Error ? e.message : "Błąd ładowania Finansów.";
        setLoadError(msg);
        toast.error(msg);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleNightAudit = async () => {
    setNightAuditLoading(true);
    const result = await runNightAudit();
    setNightAuditLoading(false);
    if (result.success && result.data) {
      toast.success(
        `Zamknięto dobę. Transakcji: ${result.data.closedCount}. Suma: ${result.data.reportSummary.totalAmount} PLN.`
      );
    } else {
      toast.error(result.success ? undefined : result.error);
    }
  };

  const handleBlindDrop = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(blindDropCash.replace(",", "."));
    if (Number.isNaN(val)) {
      toast.error("Wprowadź poprawną kwotę.");
      return;
    }
    setBlindDropLoading(true);
    const result = await submitBlindDrop(val);
    setBlindDropLoading(false);
    if (result.success && result.data) {
      setBlindDropResult(result.data);
      toast.success(
        result.data.isShortage
          ? `Manko: ${result.data.difference.toFixed(2)} PLN`
          : `Superata: ${result.data.difference.toFixed(2)} PLN`
      );
    } else {
      toast.error(result.success ? undefined : result.error);
    }
  };

  const handleVoid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voidTxId.trim() || !voidPin) {
      toast.error("Wprowadź ID transakcji i PIN.");
      return;
    }
    setVoidLoading(true);
    const result = await voidTransaction(voidTxId.trim(), voidPin);
    setVoidLoading(false);
    if (result.success) {
      toast.success("Transakcja anulowana (void).");
      setVoidTxId("");
      setVoidPin("");
      getTransactionsForToday().then((r) => {
        if (r.success && r.data) setTodayTransactions(r.data);
      });
    } else {
      toast.error(result.error);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-8 pl-[13rem]">
        <h1 className="text-2xl font-semibold">Finanse</h1>
        <p className="text-muted-foreground">Ładowanie…</p>
        <p className="text-xs text-muted-foreground">(max 15 s – jeśli dłużej, pojawi się błąd i przycisk „Ponów”)</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col gap-6 p-8 pl-[13rem]">
        <h1 className="text-2xl font-semibold">Finanse</h1>
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
          <p className="mb-2 text-sm font-medium text-destructive">Błąd ładowania danych</p>
          <p className="mb-4 text-sm text-muted-foreground">{loadError}</p>
          <Button type="button" onClick={() => load()}>
            Ponów
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 p-8">
      <h1 className="text-2xl font-semibold">Finanse</h1>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Night Audit */}
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <Moon className="h-5 w-5" />
            Zamknięcie doby (Night Audit)
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Po uruchomieniu transakcje z daty &lt; dziś staną się tylko do odczytu.
            Wygenerowany zostanie raport dobowy.
          </p>
          <Button
            onClick={handleNightAudit}
            disabled={nightAuditLoading}
          >
            {nightAuditLoading ? "Zamykanie…" : "Zamknij dobę"}
          </Button>
        </section>

        {/* Ślepe rozliczenie */}
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <Banknote className="h-5 w-5" />
            Ślepe rozliczenie (zamknięcie zmiany)
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Wpisz fizycznie policzoną gotówkę. Po zatwierdzeniu zobaczysz różnicę
            (manko/superata).
          </p>
          {expectedCash !== null && (
            <p className="mb-2 text-sm font-medium">
              Suma gotówki w systemie (dziś): {expectedCash.toFixed(2)} PLN
            </p>
          )}
          <form onSubmit={handleBlindDrop} className="flex flex-col gap-3">
            <Label htmlFor="countedCash">Policzona gotówka (PLN)</Label>
            <Input
              id="countedCash"
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={blindDropCash}
              onChange={(e) => setBlindDropCash(e.target.value)}
            />
            <Button type="submit" disabled={blindDropLoading}>
              {blindDropLoading ? "Sprawdzanie…" : "Zatwierdź i pokaż różnicę"}
            </Button>
          </form>
          {blindDropResult && (
            <div className="mt-4 rounded-md border p-3 text-sm">
              <p>
                Oczekiwano: {blindDropResult.expectedCash.toFixed(2)} PLN · Wprowadzono:{" "}
                {blindDropResult.countedCash.toFixed(2)} PLN
              </p>
              <p className="font-medium">
                {blindDropResult.isShortage ? "Manko" : "Superata"}:{" "}
                {blindDropResult.difference.toFixed(2)} PLN
              </p>
            </div>
          )}
        </section>

        {/* Anulowanie transakcji (PIN managera) */}
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <Shield className="h-5 w-5" />
            Anulowanie transakcji
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Usunięcie pozycji z rachunku wymaga PIN managera (symulacja: domyślnie 1234).
            Wybierz transakcję z listy lub wpisz ID.
          </p>
          <p className="mb-2 text-sm font-medium">Lista transakcji (dziś) – wybierz transakcję do anulowania</p>
          {todayTransactions.length > 0 ? (
            <div className="mb-4 overflow-x-auto">
              <table className="w-full text-sm" role="table">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 text-left font-medium">ID</th>
                    <th className="py-2 text-left font-medium">Typ</th>
                    <th className="py-2 text-right font-medium">Kwota (PLN)</th>
                    <th className="py-2 text-left font-medium">Data</th>
                    <th className="py-2 text-left font-medium">Akcja</th>
                  </tr>
                </thead>
                <tbody>
                  {todayTransactions.map((t) => (
                    <tr
                      key={t.id}
                      className="border-b border-border/50 hover:bg-muted/50 cursor-pointer"
                      onClick={() => setVoidTxId(t.id)}
                    >
                      <td className="py-1.5">{t.id}</td>
                      <td className="py-1.5">{t.type}</td>
                      <td className="py-1.5 text-right">{t.amount.toFixed(2)}</td>
                      <td className="py-1.5">{new Date(t.createdAt).toLocaleString("pl-PL")}</td>
                      <td className="py-1.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setVoidTxId(t.id);
                          }}
                        >
                          Wybierz
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mb-4 text-sm text-muted-foreground">Brak transakcji z dzisiejszego dnia.</p>
          )}
          <form onSubmit={handleVoid} className="flex flex-col gap-3">
            <Label htmlFor="voidTxId">ID transakcji</Label>
            <Input
              id="voidTxId"
              value={voidTxId}
              onChange={(e) => setVoidTxId(e.target.value)}
              placeholder="ID transakcji do anulowania"
            />
            <Label htmlFor="voidPin">PIN managera</Label>
            <Input
              id="voidPin"
              type="password"
              value={voidPin}
              onChange={(e) => setVoidPin(e.target.value)}
              placeholder="PIN"
              autoComplete="off"
            />
            <Button type="submit" variant="destructive" disabled={voidLoading}>
              {voidLoading ? "Sprawdzanie…" : "Anuluj transakcję (void)"}
            </Button>
          </form>
        </section>

        {/* Deposit Management */}
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <FileText className="h-5 w-5" />
            Deposit Management (Zaliczki)
          </h2>
          <p className="text-sm text-muted-foreground">
            Płatność typu Przelew/Zadatek rejestrowana w systemie automatycznie
            generuje fakturę zaliczkową (logika w Server Action przy tworzeniu
            transakcji typu DEPOSIT).
          </p>
        </section>

        {/* Kasa fiskalna */}
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <Receipt className="h-5 w-5" />
            Kasa fiskalna
          </h2>
          {fiscalConfig ? (
            <>
              <p className="mb-2 text-sm text-muted-foreground">
                Status:{" "}
                <span className={fiscalConfig.enabled ? "text-green-600 font-medium" : "text-muted-foreground"}>
                  {fiscalConfig.enabled ? "Włączona" : "Wyłączona"}
                </span>
                {fiscalConfig.enabled && (
                  <> · Sterownik: <span className="font-medium">{fiscalConfig.driver}</span></>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                Przy włączeniu (FISCAL_ENABLED=true) każda transakcja (posting, zaliczka) wysyła paragon do kasy.
                Sterownik „mock” tylko loguje w konsoli. Zobacz docs/KASA-FISKALNA.md.
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Ładowanie konfiguracji kasy…</p>
          )}
        </section>
      </div>
    </div>
  );
}
