"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  runNightAudit,
  getCashSumForToday,
  getTransactionsForToday,
  submitBlindDrop,
  voidTransaction,
  getRecentReceipts,
  markReceiptAsPaid,
  markReceiptAsUnpaid,
  deleteReceipt,
  getRecentAccountingNotes,
  markAccountingNoteAsPaid,
  cancelAccountingNote,
  getCommissionReport,
  getCurrentCashShift,
  openCashShift,
  closeCashShift,
  getCashShiftHistory,
  getCashShiftReport,
  getBlindDropHistory,
  getVatSalesRegister,
  getVatPurchasesRegister,
  getKpirReport,
} from "@/app/actions/finance";
import { sendInvoiceToKsef, sendBatchToKsef, downloadUpo, checkKsefInvoiceStatus, getKsefConfig } from "@/app/actions/ksef";
import type { TransactionForList, AccountingNoteData, CommissionReportData, CashShiftData, BlindDropHistoryItem, VatRegisterData, KpirData, CashShiftHistoryItem, CashShiftReportDetail } from "@/app/actions/finance";
import { getCennikConfig } from "@/app/actions/cennik-config";
import { toast } from "sonner";
import { Moon, Banknote, Shield, FileText, Receipt, ExternalLink, Check, X, Trash2, FileWarning, Ban, Percent, Clock, FileBarChart } from "lucide-react";
import { getFiscalConfigAction } from "@/app/actions/finance";
import type { FiscalConfig } from "@/lib/fiscal/types";

const FINANCE_LOAD_TIMEOUT_MS = 15_000;

interface ReceiptListItem {
  id: string;
  number: string;
  amount: number;
  buyerName: string;
  issuedAt: string;
  isPaid: boolean;
  reservationId: string;
}

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
  const [txTypeFilter, setTxTypeFilter] = useState<string>("all");
  const [fiscalConfig, setFiscalConfig] = useState<FiscalConfig | null>(null);
  const [currency, setCurrency] = useState("PLN");
  const [jpkFrom, setJpkFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [jpkTo, setJpkTo] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  // Rachunki (nie-VAT)
  const [receipts, setReceipts] = useState<ReceiptListItem[]>([]);
  const [receiptActionLoading, setReceiptActionLoading] = useState<string | null>(null);
  const [deleteReceiptId, setDeleteReceiptId] = useState<string | null>(null);
  const [deleteReceiptPin, setDeleteReceiptPin] = useState("");
  // Noty księgowe
  const [accountingNotes, setAccountingNotes] = useState<AccountingNoteData[]>([]);
  const [noteActionLoading, setNoteActionLoading] = useState<string | null>(null);
  const [cancelNoteId, setCancelNoteId] = useState<string | null>(null);
  const [cancelNoteReason, setCancelNoteReason] = useState("");
  // Raport prowizji (agenti / biura podróży)
  const [commissionFrom, setCommissionFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [commissionTo, setCommissionTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [commissionReport, setCommissionReport] = useState<CommissionReportData | null>(null);
  const [commissionReportLoading, setCommissionReportLoading] = useState(false);
  // Kasa zmianowa
  const [currentShift, setCurrentShift] = useState<CashShiftData | null>(null);
  const [shiftOpeningBalance, setShiftOpeningBalance] = useState("");
  const [shiftOpenLoading, setShiftOpenLoading] = useState(false);
  const [shiftCloseCash, setShiftCloseCash] = useState("");
  const [shiftCloseNotes, setShiftCloseNotes] = useState("");
  const [shiftCloseLoading, setShiftCloseLoading] = useState(false);
  const [shiftCloseResult, setShiftCloseResult] = useState<{
    expectedCash: number;
    countedCash: number;
    difference: number;
    isShortage: boolean;
  } | null>(null);
  const [blindDropHistory, setBlindDropHistory] = useState<BlindDropHistoryItem[]>([]);
  const [cashShiftHistory, setCashShiftHistory] = useState<CashShiftHistoryItem[]>([]);
  const [cashReportDetail, setCashReportDetail] = useState<CashShiftReportDetail | null>(null);
  // Rejestry VAT
  const [vatRegisterFrom, setVatRegisterFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [vatRegisterTo, setVatRegisterTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [vatSalesData, setVatSalesData] = useState<VatRegisterData | null>(null);
  const [vatPurchasesData, setVatPurchasesData] = useState<VatRegisterData | null>(null);
  const [vatRegisterLoading, setVatRegisterLoading] = useState(false);
  // KPiR
  const [kpirFrom, setKpirFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [kpirTo, setKpirTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [kpirData, setKpirData] = useState<KpirData | null>(null);
  const [kpirLoading, setKpirLoading] = useState(false);
  const [ksefSendingId, setKsefSendingId] = useState<string | null>(null);
  const [ksefSelectedIds, setKsefSelectedIds] = useState<Set<string>>(new Set());
  const [ksefBatchSending, setKsefBatchSending] = useState(false);
  const [ksefCheckStatusId, setKsefCheckStatusId] = useState<string | null>(null);
  const [ksefErrorDialog, setKsefErrorDialog] = useState<{ documentNumber: string; message: string } | null>(null);

  const queryClient = useQueryClient();

  const { data: _financeData } = useQuery({
    queryKey: ["finance-initial"],
    queryFn: async () => {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("Przekroczono limit czasu (15 s). Sprawdź połączenie z bazą.")),
          FINANCE_LOAD_TIMEOUT_MS
        )
      );
      const result = await Promise.race([
        Promise.all([
          getCashSumForToday(),
          getTransactionsForToday(),
          getFiscalConfigAction(),
          getCennikConfig(),
          getRecentReceipts(20),
          getRecentAccountingNotes(20),
          getCurrentCashShift(),
          getBlindDropHistory(30),
          getCashShiftHistory(30),
        ]),
        timeoutPromise,
      ]);
      return result;
    },
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!_financeData) return;
    const [cashRes, txRes, fiscalRes, cennikRes, receiptsRes, notesRes, shiftRes, blindRes, histRes] = _financeData;
    if (cashRes.success && cashRes.data) setExpectedCash(cashRes.data.expectedCash);
    if (txRes.success && txRes.data) setTodayTransactions(txRes.data);
    setFiscalConfig(fiscalRes);
    if (cennikRes.success && cennikRes.data) setCurrency(cennikRes.data.currency);
    if (receiptsRes.success && receiptsRes.data) setReceipts(receiptsRes.data);
    if (notesRes.success && notesRes.data) setAccountingNotes(notesRes.data as AccountingNoteData[]);
    if (shiftRes.success && shiftRes.data !== undefined) setCurrentShift(shiftRes.data);
    if (blindRes.success && blindRes.data) setBlindDropHistory(blindRes.data);
    if (histRes.success && histRes.data) setCashShiftHistory(histRes.data);
    setLoadError(null);
    setLoading(false);
  }, [_financeData]);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    queryClient.invalidateQueries({ queryKey: ["finance-initial"] });
  }, [queryClient]);

  const handleToggleReceiptPaid = async (receiptId: string, currentlyPaid: boolean) => {
    setReceiptActionLoading(receiptId);
    try {
      if (currentlyPaid) {
        const result = await markReceiptAsUnpaid(receiptId);
        if (result.success) {
          toast.success("Oznaczono rachunek jako nieopłacony");
          setReceipts((prev) =>
            prev.map((r) => (r.id === receiptId ? { ...r, isPaid: false } : r))
          );
        } else {
          toast.error("error" in result ? (result.error ?? "Błąd") : "Błąd");
        }
      } else {
        const result = await markReceiptAsPaid(receiptId);
        if (result.success) {
          toast.success("Oznaczono rachunek jako opłacony");
          setReceipts((prev) =>
            prev.map((r) => (r.id === receiptId ? { ...r, isPaid: true } : r))
          );
        } else {
          toast.error("error" in result ? (result.error ?? "Błąd") : "Błąd");
        }
      }
    } finally {
      setReceiptActionLoading(null);
    }
  };

  const handleDeleteReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deleteReceiptId || !deleteReceiptPin) {
      toast.error("Wprowadź PIN managera");
      return;
    }
    setReceiptActionLoading(deleteReceiptId);
    try {
      const result = await deleteReceipt(deleteReceiptId, deleteReceiptPin);
      if (result.success) {
        toast.success("Rachunek usunięty");
        setReceipts((prev) => prev.filter((r) => r.id !== deleteReceiptId));
        setDeleteReceiptId(null);
        setDeleteReceiptPin("");
      } else {
        toast.error("error" in result ? (result.error ?? "Błąd") : "Błąd");
      }
    } finally {
      setReceiptActionLoading(null);
    }
  };

  const handleMarkNotePaid = async (noteId: string) => {
    setNoteActionLoading(noteId);
    try {
      const result = await markAccountingNoteAsPaid(noteId);
      if (result.success && result.data) {
        toast.success("Nota oznaczona jako opłacona");
        setAccountingNotes((prev) =>
          prev.map((n) => (n.id === noteId ? { ...n, status: "PAID" as const, paidAt: new Date().toISOString() } : n))
        );
      } else {
        toast.error("error" in result ? (result.error ?? "Błąd") : "Błąd");
      }
    } finally {
      setNoteActionLoading(null);
    }
  };

  const handleCancelNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelNoteId) return;
    setNoteActionLoading(cancelNoteId);
    try {
      const result = await cancelAccountingNote(cancelNoteId, cancelNoteReason || undefined);
      if (result.success && result.data) {
        toast.success("Nota anulowana");
        setAccountingNotes((prev) =>
          prev.map((n) =>
            n.id === cancelNoteId
              ? { ...n, status: "CANCELLED" as const, cancelledAt: new Date().toISOString(), cancelledReason: cancelNoteReason || null }
              : n
          )
        );
        setCancelNoteId(null);
        setCancelNoteReason("");
      } else {
        toast.error("error" in result ? (result.error ?? "Błąd") : "Błąd");
      }
    } finally {
      setNoteActionLoading(null);
    }
  };

  const handleLoadCommissionReport = async () => {
    if (!commissionFrom || !commissionTo) {
      toast.error("Wybierz datę od i do");
      return;
    }
    setCommissionReportLoading(true);
    setCommissionReport(null);
    try {
      const result = await getCommissionReport(commissionFrom, commissionTo);
      if (result.success && result.data) {
        setCommissionReport(result.data);
        toast.success("Raport prowizji wygenerowany");
      } else {
        toast.error("error" in result ? (result.error ?? "Błąd raportu") : "Błąd raportu");
      }
    } finally {
      setCommissionReportLoading(false);
    }
  };

  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(shiftOpeningBalance.replace(",", "."));
    if (Number.isNaN(val) || val < 0) {
      toast.error("Wprowadź poprawną kwotę otwarcia (≥ 0)");
      return;
    }
    setShiftOpenLoading(true);
    try {
      const result = await openCashShift(val);
      if (result.success) {
        toast.success("Zmiana otwarta");
        setShiftOpeningBalance("");
        const r = await getCurrentCashShift();
        if (r.success && r.data !== undefined) setCurrentShift(r.data);
      } else {
        toast.error("error" in result ? (result.error ?? "Błąd") : "Błąd");
      }
    } finally {
      setShiftOpenLoading(false);
    }
  };

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(shiftCloseCash.replace(",", "."));
    if (Number.isNaN(val) || val < 0) {
      toast.error("Wprowadź poprawną kwotę (policzona gotówka)");
      return;
    }
    setShiftCloseLoading(true);
    setShiftCloseResult(null);
    try {
      const result = await closeCashShift(val, shiftCloseNotes || undefined);
      if (result.success && result.data) {
        setShiftCloseResult({
          expectedCash: result.data.expectedCash,
          countedCash: result.data.countedCash,
          difference: result.data.difference,
          isShortage: result.data.isShortage,
        });
        setCurrentShift(null);
        setShiftCloseCash("");
        setShiftCloseNotes("");
        getCashShiftHistory(30).then((r) => {
          if (r.success && r.data) setCashShiftHistory(r.data);
        });
        toast.success(result.data.isShortage ? `Zmiana zamknięta. Manko: ${result.data.difference.toFixed(2)} ${currency}` : `Zmiana zamknięta. Superata: ${result.data.difference.toFixed(2)} ${currency}`);
      } else {
        toast.error("error" in result ? (result.error ?? "Błąd") : "Błąd");
      }
    } finally {
      setShiftCloseLoading(false);
    }
  };


  const handleNightAudit = async () => {
    setNightAuditLoading(true);
    const result = await runNightAudit();
    setNightAuditLoading(false);
    if (result.success && result.data) {
      const noShow = result.data.noShowCount ?? 0;
      const noShowText = noShow > 0 ? ` No-show: ${noShow} rezerwacji.` : "";
      toast.success(
        `Zamknięto dobę. Transakcji: ${result.data.closedCount}. Suma: ${result.data.reportSummary.totalAmount} ${currency}.${noShowText}`
      );
    } else {
      toast.error("error" in result ? result.error : "Błąd");
    }
  };

  const handleBlindDrop = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(blindDropCash.replace(",", "."));
    if (Number.isNaN(val)) {
      toast.error("Wprowadź poprawną kwotę.");
      return;
    }
    if (val < 0) {
      toast.error("Policzona gotówka nie może być ujemna.");
      return;
    }
    setBlindDropLoading(true);
    const result = await submitBlindDrop(val);
    setBlindDropLoading(false);
    if (result.success && result.data) {
      setBlindDropResult(result.data);
      getBlindDropHistory(30).then((r) => {
        if (r.success && r.data) setBlindDropHistory(r.data);
      });
      toast.success(
        result.data.isShortage
          ? `Manko: ${result.data.difference.toFixed(2)} ${currency}`
          : `Superata: ${result.data.difference.toFixed(2)} ${currency}`
      );
    } else {
      toast.error("error" in result ? result.error : "Błąd");
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
      toast.error("error" in result ? result.error : "Błąd");
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
              Suma gotówki w systemie (dziś): {expectedCash.toFixed(2)} {currency}
            </p>
          )}
          <form onSubmit={handleBlindDrop} className="flex flex-col gap-3">
            <Label htmlFor="countedCash">Policzona gotówka ({currency})</Label>
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
                Oczekiwano: {blindDropResult.expectedCash.toFixed(2)} {currency} · Wprowadzono:{" "}
                {blindDropResult.countedCash.toFixed(2)} {currency}
              </p>
              <p className="font-medium">
                {blindDropResult.isShortage ? "Manko" : "Superata"}:{" "}
                {blindDropResult.difference.toFixed(2)} {currency}
              </p>
            </div>
          )}
          {blindDropHistory.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-sm font-medium">Historia Blind Dropów</p>
              <div className="max-h-48 overflow-y-auto rounded-md border text-sm">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="py-1.5 pl-2 text-left font-medium">Data</th>
                      <th className="py-1.5 text-right font-medium">Oczekiwano</th>
                      <th className="py-1.5 text-right font-medium">Policzono</th>
                      <th className="py-1.5 text-right font-medium">Różnica</th>
                      <th className="py-1.5 pr-2 text-left font-medium">Kto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blindDropHistory.map((h) => (
                      <tr key={h.id} className="border-b border-border/50">
                        <td className="py-1 pl-2">{new Date(h.performedAt).toLocaleString("pl-PL")}</td>
                        <td className="py-1 text-right">{h.expectedCash.toFixed(2)}</td>
                        <td className="py-1 text-right">{h.countedCash.toFixed(2)}</td>
                        <td className={`py-1 text-right font-medium ${h.isShortage ? "text-destructive" : "text-green-600 dark:text-green-400"}`}>
                          {h.isShortage ? "−" : "+"}{h.difference.toFixed(2)}
                        </td>
                        <td className="py-1 pr-2 text-muted-foreground">{h.performedByName ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* Kasa zmianowa (shift opening/closing balance) */}
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <Clock className="h-5 w-5" />
            Kasa zmianowa
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Otwórz zmianę (stan gotówki na początek) i zamknij ją (policzona gotówka). Tylko jedna zmiana może być otwarta.
          </p>
          {currentShift ? (
            <>
              <div className="mb-4 rounded-md border p-3 text-sm">
                <p className="font-medium">Otwarta zmiana</p>
                <p className="text-muted-foreground">
                  Otwarcie: {new Date(currentShift.openedAt).toLocaleString("pl-PL")} · Stan na początek:{" "}
                  {currentShift.openingBalance.toFixed(2)} {currency}
                </p>
                {currentShift.expectedCashForNow != null && (
                  <p className="mt-1 font-medium text-foreground">
                    Oczekiwana gotówka (na teraz): {currentShift.expectedCashForNow.toFixed(2)} {currency}
                  </p>
                )}
              </div>
              <form onSubmit={handleCloseShift} className="flex flex-col gap-3">
                <Label htmlFor="shiftCloseCash">Policzona gotówka ({currency})</Label>
                <Input
                  id="shiftCloseCash"
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={shiftCloseCash}
                  onChange={(e) => setShiftCloseCash(e.target.value)}
                />
                <div>
                  <Label htmlFor="shiftCloseNotes">Notatki (opcjonalnie)</Label>
                  <Textarea
                    id="shiftCloseNotes"
                    placeholder="Np. uwagi do manka, superaty, zdarzenia na zmianie"
                    value={shiftCloseNotes}
                    onChange={(e) => setShiftCloseNotes(e.target.value)}
                    rows={2}
                    className="mt-1"
                  />
                </div>
                <Button type="submit" variant="destructive" disabled={shiftCloseLoading}>
                  {shiftCloseLoading ? "Zamykanie…" : "Zamknij zmianę"}
                </Button>
              </form>
              {shiftCloseResult && (
                <div className="mt-4 rounded-md border border-orange-200 bg-orange-50 p-3 text-sm dark:border-orange-900 dark:bg-orange-950/30">
                  <p>
                    Oczekiwano: {shiftCloseResult.expectedCash.toFixed(2)} {currency} · Wprowadzono:{" "}
                    {shiftCloseResult.countedCash.toFixed(2)} {currency}
                  </p>
                  <p className="font-medium">
                    {shiftCloseResult.isShortage ? "Manko" : "Superata"}:{" "}
                    {shiftCloseResult.difference.toFixed(2)} {currency}
                  </p>
                </div>
              )}
            </>
          ) : (
            <form onSubmit={handleOpenShift} className="flex flex-col gap-3">
              <Label htmlFor="shiftOpeningBalance">Stan gotówki na początek zmiany ({currency})</Label>
              <Input
                id="shiftOpeningBalance"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={shiftOpeningBalance}
                onChange={(e) => setShiftOpeningBalance(e.target.value)}
              />
              <Button type="submit" disabled={shiftOpenLoading}>
                {shiftOpenLoading ? "Otwieranie…" : "Otwórz zmianę"}
              </Button>
            </form>
          )}
        </section>

        {/* Raport kasowy (historia zmiany) */}
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <FileBarChart className="h-5 w-5" />
            Raport kasowy
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Ostatnie zamknięte zmiany. Kliknij w wiersz, aby zobaczyć szczegóły i listę transakcji gotówkowych.
          </p>
          {cashShiftHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">Brak zamkniętych zmian.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" role="table">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 text-left font-medium">Otwarcie</th>
                    <th className="py-2 text-left font-medium">Zamknięcie</th>
                    <th className="py-2 text-right font-medium">Stan otw.</th>
                    <th className="py-2 text-right font-medium">Stan zamk.</th>
                    <th className="py-2 text-right font-medium">Różnica</th>
                    <th className="py-2 text-left font-medium">Akcja</th>
                  </tr>
                </thead>
                <tbody>
                  {cashShiftHistory.map((s) => (
                    <tr
                      key={s.id}
                      className="border-b border-border/50 hover:bg-muted/50 cursor-pointer"
                      onClick={async () => {
                        const r = await getCashShiftReport(s.id);
                        if (r.success && r.data) setCashReportDetail(r.data);
                        else setCashReportDetail(null);
                      }}
                    >
                      <td className="py-2">{new Date(s.openedAt).toLocaleString("pl-PL")}</td>
                      <td className="py-2">{s.closedAt ? new Date(s.closedAt).toLocaleString("pl-PL") : "—"}</td>
                      <td className="py-2 text-right">{s.openingBalance.toFixed(2)} {currency}</td>
                      <td className="py-2 text-right">{s.closingBalance != null ? `${s.closingBalance.toFixed(2)} ${currency}` : "—"}</td>
                      <td className="py-2 text-right">
                        {s.difference != null ? (
                          <span className={s.difference < 0 ? "text-destructive" : "text-green-600 dark:text-green-400"}>
                            {s.difference >= 0 ? "+" : ""}{s.difference.toFixed(2)} {currency}
                          </span>
                        ) : "—"}
                      </td>
                      <td className="py-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={async (e) => {
                            e.stopPropagation();
                            const r = await getCashShiftReport(s.id);
                            if (r.success && r.data) setCashReportDetail(r.data);
                            else setCashReportDetail(null);
                          }}
                        >
                          Szczegóły
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {cashReportDetail && (
            <Dialog open={!!cashReportDetail} onOpenChange={(open) => !open && setCashReportDetail(null)}>
              <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Raport kasowy – zmiana</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 text-sm">
                  <div className="grid grid-cols-2 gap-2 rounded-md border p-3">
                    <p><span className="text-muted-foreground">Otwarcie:</span> {new Date(cashReportDetail.shift.openedAt).toLocaleString("pl-PL")}</p>
                    <p><span className="text-muted-foreground">Zamknięcie:</span> {cashReportDetail.shift.closedAt ? new Date(cashReportDetail.shift.closedAt).toLocaleString("pl-PL") : "—"}</p>
                    <p><span className="text-muted-foreground">Stan na otwarcie:</span> {cashReportDetail.shift.openingBalance.toFixed(2)} {currency}</p>
                    <p><span className="text-muted-foreground">Oczekiwana przy zamknięciu:</span> {cashReportDetail.shift.expectedCashAtClose != null ? `${cashReportDetail.shift.expectedCashAtClose.toFixed(2)} ${currency}` : "—"}</p>
                    <p><span className="text-muted-foreground">Policzona gotówka:</span> {cashReportDetail.shift.closingBalance != null ? `${cashReportDetail.shift.closingBalance.toFixed(2)} ${currency}` : "—"}</p>
                    <p><span className="text-muted-foreground">Różnica:</span>{" "}
                      {cashReportDetail.shift.difference != null ? (
                        <span className={cashReportDetail.shift.difference < 0 ? "text-destructive" : "text-green-600 dark:text-green-400"}>
                          {cashReportDetail.shift.difference >= 0 ? "+" : ""}{cashReportDetail.shift.difference.toFixed(2)} {currency}
                        </span>
                      ) : "—"}
                    </p>
                    {cashReportDetail.shift.notes && (
                      <p className="col-span-2"><span className="text-muted-foreground">Notatki:</span> {cashReportDetail.shift.notes}</p>
                    )}
                  </div>
                  <div>
                    <p className="mb-2 font-medium">Transakcje gotówkowe w okresie zmiany ({cashReportDetail.cashTransactions.length})</p>
                    {cashReportDetail.cashTransactions.length === 0 ? (
                      <p className="text-muted-foreground">Brak transakcji gotówkowych.</p>
                    ) : (
                      <div className="overflow-x-auto max-h-60 overflow-y-auto rounded border">
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 bg-muted">
                            <tr className="border-b">
                              <th className="py-1.5 text-left font-medium">Data</th>
                              <th className="py-1.5 text-left font-medium">Typ</th>
                              <th className="py-1.5 text-left font-medium">Opis</th>
                              <th className="py-1.5 text-right font-medium">Kwota ({currency})</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cashReportDetail.cashTransactions.map((t) => (
                              <tr key={t.id} className="border-b border-border/50">
                                <td className="py-1">{new Date(t.createdAt).toLocaleString("pl-PL")}</td>
                                <td className="py-1">{t.type}</td>
                                <td className="py-1 max-w-[200px] truncate">{t.description ?? "—"}</td>
                                <td className="py-1 text-right">{t.amount >= 0 ? "" : "−"} {Math.abs(t.amount).toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
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
          <div className="mb-3 flex items-center gap-2">
            <p className="text-sm font-medium">Lista transakcji (dziś)</p>
            <select
              value={txTypeFilter}
              onChange={(e) => setTxTypeFilter(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="all">Wszystkie typy</option>
              <option value="ROOM">Nocleg</option>
              <option value="RESTAURANT">Restauracja</option>
              <option value="DEPOSIT">Zaliczka</option>
              <option value="LOCAL_TAX">Opłata miejscowa</option>
              <option value="MINIBAR">Minibar</option>
              <option value="SPA">SPA</option>
              <option value="PARKING">Parking</option>
              <option value="PAYMENT">Płatność</option>
            </select>
            {txTypeFilter !== "all" && (
              <span className="text-xs text-muted-foreground">
                ({todayTransactions.filter((t) =>
                  txTypeFilter === "RESTAURANT"
                    ? t.type === "GASTRONOMY" || t.type === "RESTAURANT" || t.type === "POSTING"
                    : t.type === txTypeFilter
                ).length} wyników)
              </span>
            )}
          </div>
          {todayTransactions.length > 0 ? (
            <div className="mb-4 overflow-x-auto">
              <table className="w-full text-sm" role="table">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 text-left font-medium">ID</th>
                    <th className="py-2 text-left font-medium">Typ</th>
                    <th className="py-2 text-right font-medium">Kwota ({currency})</th>
                    <th className="py-2 text-left font-medium">Data</th>
                    <th className="py-2 text-left font-medium">Akcja</th>
                  </tr>
                </thead>
                <tbody>
                  {todayTransactions
                    .filter((t) => {
                      if (txTypeFilter === "all") return true;
                      if (txTypeFilter === "RESTAURANT") return t.type === "GASTRONOMY" || t.type === "RESTAURANT" || t.type === "POSTING";
                      return t.type === txTypeFilter;
                    })
                    .map((t) => (
                    <tr
                      key={t.id}
                      className="border-b border-border/50 hover:bg-muted/50 cursor-pointer"
                      onClick={() => setVoidTxId(t.id)}
                    >
                      <td className="py-1.5">{t.id}</td>
                      <td className="py-1.5">
                        {t.type === "ROOM"
                          ? "Nocleg"
                          : t.type === "DEPOSIT"
                            ? "Zaliczka"
                            : t.type === "LOCAL_TAX"
                              ? "Opłata miejscowa"
                              : t.type === "MINIBAR"
                                ? "Minibar"
                                : t.type === "GASTRONOMY" || t.type === "RESTAURANT" || t.type === "POSTING"
                                  ? "Restauracja"
                                  : t.type === "SPA"
                                    ? "SPA"
                                    : t.type === "PARKING"
                                      ? "Parking"
                                      : t.type}
                      </td>
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
            transakcji typu DEPOSIT). Po rejestracji zaliczki dokument faktury
            zaliczkowej jest dostępny do druku (Drukuj → Zapisz jako PDF) pod adresem
            <code className="mx-1 rounded bg-muted px-1 text-xs">/api/finance/deposit-invoice/[id transakcji]</code>.
          </p>
        </section>

        {/* Eksport JPK */}
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <FileText className="h-5 w-5" />
            Eksport JPK (Jednolity Plik Kontrolny)
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Pobierz plik XML z transakcjami i fakturami VAT w wybranym okresie (uproszczona struktura JPK).
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <Label htmlFor="jpkFrom" className="text-xs">Data od</Label>
              <Input
                id="jpkFrom"
                type="date"
                value={jpkFrom}
                onChange={(e) => setJpkFrom(e.target.value)}
                className="mt-1 w-40"
              />
            </div>
            <div>
              <Label htmlFor="jpkTo" className="text-xs">Data do</Label>
              <Input
                id="jpkTo"
                type="date"
                value={jpkTo}
                onChange={(e) => setJpkTo(e.target.value)}
                className="mt-1 w-40"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (!jpkFrom || !jpkTo) {
                  toast.error("Wybierz datę od i do");
                  return;
                }
                window.open(
                  `/api/finance/jpk?from=${encodeURIComponent(jpkFrom)}&to=${encodeURIComponent(jpkTo)}`,
                  "_blank",
                  "noopener,noreferrer"
                );
                toast.success("Pobieranie JPK…");
              }}
            >
              Pobierz JPK (XML)
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (!jpkFrom || !jpkTo) {
                  toast.error("Wybierz datę od i do");
                  return;
                }
                window.open(
                  `/api/finance/jpk-fa?from=${encodeURIComponent(jpkFrom)}&to=${encodeURIComponent(jpkTo)}`,
                  "_blank",
                  "noopener,noreferrer"
                );
                toast.success("Pobieranie JPK_FA…");
              }}
            >
              Pobierz JPK_FA (Faktury)
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (!jpkFrom || !jpkTo) {
                  toast.error("Wybierz datę od i do");
                  return;
                }
                window.open(
                  `/api/finance/jpk-vat?from=${encodeURIComponent(jpkFrom)}&to=${encodeURIComponent(jpkTo)}`,
                  "_blank",
                  "noopener,noreferrer"
                );
                toast.success("Pobieranie JPK_VAT…");
              }}
            >
              Pobierz JPK_VAT
            </Button>
          </div>
        </section>

        {/* Rejestry VAT */}
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <FileText className="h-5 w-5" />
            Rejestry VAT (sprzedaży / zakupów)
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Przegląd rejestru sprzedaży VAT (wystawione faktury) i rejestru zakupów VAT w wybranym okresie.
          </p>
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div>
              <Label htmlFor="vatRegFrom" className="text-xs">Data od</Label>
              <Input
                id="vatRegFrom"
                type="date"
                value={vatRegisterFrom}
                onChange={(e) => setVatRegisterFrom(e.target.value)}
                className="mt-1 w-40"
              />
            </div>
            <div>
              <Label htmlFor="vatRegTo" className="text-xs">Data do</Label>
              <Input
                id="vatRegTo"
                type="date"
                value={vatRegisterTo}
                onChange={(e) => setVatRegisterTo(e.target.value)}
                className="mt-1 w-40"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={vatRegisterLoading}
              onClick={async () => {
                if (!vatRegisterFrom || !vatRegisterTo) {
                  toast.error("Wybierz datę od i do");
                  return;
                }
                setVatRegisterLoading(true);
                try {
                  const [salesRes, purchasesRes] = await Promise.all([
                    getVatSalesRegister(vatRegisterFrom, vatRegisterTo),
                    getVatPurchasesRegister(vatRegisterFrom, vatRegisterTo),
                  ]);
                  if (salesRes.success && salesRes.data) setVatSalesData(salesRes.data);
                  else { toast.error("error" in salesRes ? (salesRes.error ?? "Błąd rejestru sprzedaży") : "Błąd rejestru sprzedaży"); setVatSalesData(null); }
                  if (purchasesRes.success && purchasesRes.data) setVatPurchasesData(purchasesRes.data);
                  else { toast.error("error" in purchasesRes ? (purchasesRes.error ?? "Błąd rejestru zakupów") : "Błąd rejestru zakupów"); setVatPurchasesData(null); }
                  if (salesRes.success && purchasesRes.success) toast.success("Rejestry VAT załadowane");
                } finally {
                  setVatRegisterLoading(false);
                }
              }}
            >
              {vatRegisterLoading ? "Ładowanie…" : "Pokaż rejestry"}
            </Button>
          </div>
          {vatSalesData && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium">Rejestr sprzedaży VAT</h3>
                {ksefSelectedIds.size > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={ksefBatchSending}
                    onClick={async () => {
                      const ids = Array.from(ksefSelectedIds);
                      if (!ids.length) return;
                      const configRes = await getKsefConfig();
                      if (configRes.success && configRes.data.env === "prod") {
                        if (!confirm("Bramka produkcyjna KSeF (ksef.mf.gov.pl). Czy na pewno wysłać zaznaczone faktury?")) return;
                      }
                      setKsefBatchSending(true);
                      const res = await sendBatchToKsef(ids);
                      setKsefBatchSending(false);
                      setKsefSelectedIds(new Set());
                      if (res.success) {
                        if (res.data.queued > 0) {
                          toast.warning(
                            `Wysłano ${res.data.sent} faktur. Bramka MF niedostępna – ${res.data.queued} faktur dodanych do kolejki (wysyłka automatyczna).`
                          );
                        } else {
                          toast.success(`Wysłano ${res.data.sent} faktur do KSeF${res.data.failed > 0 ? `, ${res.data.failed} błędów` : ""}`);
                        }
                        const [salesRes] = await Promise.all([
                          getVatSalesRegister(vatRegisterFrom, vatRegisterTo),
                          getVatPurchasesRegister(vatRegisterFrom, vatRegisterTo),
                        ]);
                        if (salesRes.success && salesRes.data) setVatSalesData(salesRes.data);
                      } else {
                        if (res.error?.includes("dodana do kolejki")) {
                          toast.warning(res.error);
                        } else {
                          toast.error("error" in res ? (res.error ?? "Błąd wysyłki wsadowej do KSeF") : "Błąd wysyłki wsadowej do KSeF");
                        }
                      }
                    }}
                  >
                    {ksefBatchSending ? "Wysyłanie…" : `Wyślij zaznaczone do KSeF (${ksefSelectedIds.size})`}
                  </Button>
                )}
              </div>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-2 w-8">
                        <input
                          type="checkbox"
                          checked={vatSalesData.rows.length > 0 && vatSalesData.rows.every((r) => r.invoiceId && ksefSelectedIds.has(r.invoiceId))}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setKsefSelectedIds(new Set(vatSalesData.rows.filter((r) => r.invoiceId).map((r) => r.invoiceId!)));
                            } else {
                              setKsefSelectedIds(new Set());
                            }
                          }}
                        />
                      </th>
                      <th className="text-left p-2">Data</th>
                      <th className="text-left p-2">Nr dokumentu</th>
                      <th className="text-left p-2">NIP</th>
                      <th className="text-left p-2">Kontrahent</th>
                      <th className="text-left p-2">KSeF</th>
                      <th className="text-right p-2">Netto</th>
                      <th className="text-right p-2">Stawka %</th>
                      <th className="text-right p-2">VAT</th>
                      <th className="text-right p-2">Brutto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vatSalesData.rows.length === 0 ? (
                      <tr><td colSpan={10} className="p-4 text-center text-muted-foreground">Brak faktur w tym okresie</td></tr>
                    ) : (
                      vatSalesData.rows.map((r, i) => {
                        const status = (r.ksefStatus ?? "").toUpperCase();
                        const badgeVariant =
                          status === "DRAFT" ? "secondary" :
                          status === "PENDING" ? "outline" :
                          status === "ACCEPTED" ? "default" :
                          status === "REJECTED" ? "destructive" :
                          status === "VERIFICATION" ? "default" : "secondary";
                        const badgeClass =
                          status === "DRAFT" ? "bg-gray-500/80" :
                          status === "PENDING" ? "bg-yellow-500/80 text-black border-yellow-600" :
                          status === "ACCEPTED" ? "bg-green-600" :
                          status === "REJECTED" ? "" :
                          status === "VERIFICATION" ? "bg-blue-600" : "";
                        return (
                          <tr key={i} className="border-b">
                            <td className="p-2">
                              {r.invoiceId && (
                                <input
                                  type="checkbox"
                                  checked={ksefSelectedIds.has(r.invoiceId)}
                                  onChange={(e) => {
                                    const next = new Set(ksefSelectedIds);
                                    if (e.target.checked) next.add(r.invoiceId!);
                                    else next.delete(r.invoiceId!);
                                    setKsefSelectedIds(next);
                                  }}
                                />
                              )}
                            </td>
                            <td className="p-2">{r.date}</td>
                            <td className="p-2">{r.documentNumber}</td>
                            <td className="p-2">{r.contractorNip}</td>
                            <td className="p-2">{r.contractorName}</td>
                            <td className="p-2">
                              {r.ksefStatus ? (
                                <>
                                  <Badge variant={badgeVariant as "secondary" | "outline" | "default" | "destructive"} className={badgeClass || undefined}>
                                    {r.ksefStatus}
                                  </Badge>
                                  {r.ksefStatus === "REJECTED" && r.ksefErrorMessage && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="ml-1 h-7 text-xs text-destructive"
                                      onClick={() => setKsefErrorDialog({ documentNumber: r.documentNumber, message: r.ksefErrorMessage ?? "" })}
                                    >
                                      Błąd
                                    </Button>
                                  )}
                                </>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                              {r.invoiceId && r.ksefStatus !== "ACCEPTED" && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="ml-1 h-7 text-xs"
                                  disabled={ksefSendingId !== null}
                                  onClick={async () => {
                                    if (!r.invoiceId) return;
                                    const configRes = await getKsefConfig();
                                    if (configRes.success && configRes.data.env === "prod") {
                                      if (!confirm("Bramka produkcyjna KSeF (ksef.mf.gov.pl). Czy na pewno wysłać tę fakturę?")) return;
                                    }
                                    setKsefSendingId(r.invoiceId);
                                    const res = await sendInvoiceToKsef(r.invoiceId);
                                    setKsefSendingId(null);
                                    if (res.success) {
                                      toast.success(`Wysłano do KSeF: ${res.data?.referenceNumber ?? "OK"}`);
                                      const [salesRes] = await Promise.all([
                                        getVatSalesRegister(vatRegisterFrom, vatRegisterTo),
                                        getVatPurchasesRegister(vatRegisterFrom, vatRegisterTo),
                                      ]);
                                      if (salesRes.success && salesRes.data) setVatSalesData(salesRes.data);
                                    } else {
                                      if (res.error?.includes("dodana do kolejki")) {
                                        toast.warning(res.error);
                                      } else {
                                        toast.error("error" in res ? (res.error ?? "Błąd wysyłki do KSeF") : "Błąd wysyłki do KSeF");
                                      }
                                    }
                                  }}
                                >
                                  {ksefSendingId === r.invoiceId ? "…" : "Wyślij do KSeF"}
                                </Button>
                              )}
                              {r.invoiceId && (r.ksefStatus === "PENDING" || r.ksefStatus === "VERIFICATION") && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="ml-1 h-7 text-xs"
                                  disabled={ksefCheckStatusId !== null}
                                  onClick={async () => {
                                    if (!r.invoiceId) return;
                                    setKsefCheckStatusId(r.invoiceId);
                                    const res = await checkKsefInvoiceStatus(r.invoiceId);
                                    setKsefCheckStatusId(null);
                                    if (res.success) {
                                      toast.success(`Status: ${res.data?.status ?? "OK"}`);
                                      const [salesRes] = await Promise.all([
                                        getVatSalesRegister(vatRegisterFrom, vatRegisterTo),
                                        getVatPurchasesRegister(vatRegisterFrom, vatRegisterTo),
                                      ]);
                                      if (salesRes.success && salesRes.data) setVatSalesData(salesRes.data);
                                    } else {
                                      toast.error("error" in res ? (res.error ?? "Błąd sprawdzania statusu") : "Błąd sprawdzania statusu");
                                    }
                                  }}
                                >
                                  {ksefCheckStatusId === r.invoiceId ? "…" : "Sprawdź status"}
                                </Button>
                              )}
                              {r.invoiceId && r.ksefStatus === "ACCEPTED" && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="ml-1 h-7 text-xs"
                                  onClick={async () => {
                                    if (!r.invoiceId) return;
                                    const res = await downloadUpo(r.invoiceId);
                                    if (res.success && res.data.upoUrl) {
                                      if (res.data.upoUrl.startsWith("http")) {
                                        window.open(res.data.upoUrl, "_blank");
                                      } else {
                                        window.open(res.data.upoUrl, "_blank");
                                      }
                                      toast.success("UPO pobrane");
                                    } else {
                                      toast.error("error" in res ? (res.error ?? "Błąd pobierania UPO") : "Błąd pobierania UPO");
                                    }
                                  }}
                                >
                                  Pobierz UPO
                                </Button>
                              )}
                            </td>
                            <td className="p-2 text-right">{r.netAmount.toFixed(2)}</td>
                            <td className="p-2 text-right">{r.vatRate.toFixed(0)}%</td>
                            <td className="p-2 text-right">{r.vatAmount.toFixed(2)}</td>
                            <td className="p-2 text-right">{r.grossAmount.toFixed(2)}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {vatSalesData.rows.length > 0 && (
                    <tfoot>
                      <tr className="border-t bg-muted/50 font-medium">
                        <td colSpan={6} className="p-2">Razem</td>
                        <td className="p-2 text-right">{vatSalesData.totalNet.toFixed(2)}</td>
                        <td className="p-2"></td>
                        <td className="p-2 text-right">{vatSalesData.totalVat.toFixed(2)}</td>
                        <td className="p-2 text-right">{vatSalesData.totalGross.toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}
          {vatPurchasesData && (
            <div>
              <h3 className="text-sm font-medium mb-2">Rejestr zakupów VAT</h3>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-2">Data</th>
                      <th className="text-left p-2">Nr dokumentu</th>
                      <th className="text-left p-2">NIP</th>
                      <th className="text-left p-2">Kontrahent</th>
                      <th className="text-right p-2">Netto</th>
                      <th className="text-right p-2">Stawka %</th>
                      <th className="text-right p-2">VAT</th>
                      <th className="text-right p-2">Brutto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vatPurchasesData.rows.length === 0 ? (
                      <tr><td colSpan={8} className="p-4 text-center text-muted-foreground">Brak zakupów w systemie (rejestr zakupów do rozbudowy)</td></tr>
                    ) : (
                      vatPurchasesData.rows.map((r, i) => (
                        <tr key={i} className="border-b">
                          <td className="p-2">{r.date}</td>
                          <td className="p-2">{r.documentNumber}</td>
                          <td className="p-2">{r.contractorNip}</td>
                          <td className="p-2">{r.contractorName}</td>
                          <td className="p-2 text-right">{r.netAmount.toFixed(2)}</td>
                          <td className="p-2 text-right">{r.vatRate.toFixed(0)}%</td>
                          <td className="p-2 text-right">{r.vatAmount.toFixed(2)}</td>
                          <td className="p-2 text-right">{r.grossAmount.toFixed(2)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {vatPurchasesData.rows.length > 0 && (
                    <tfoot>
                      <tr className="border-t bg-muted/50 font-medium">
                        <td colSpan={4} className="p-2">Razem</td>
                        <td className="p-2 text-right">{vatPurchasesData.totalNet.toFixed(2)}</td>
                        <td className="p-2"></td>
                        <td className="p-2 text-right">{vatPurchasesData.totalVat.toFixed(2)}</td>
                        <td className="p-2 text-right">{vatPurchasesData.totalGross.toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}
        </section>

        {/* KPiR - Księga Przychodów i Rozchodów */}
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <FileText className="h-5 w-5" />
            KPiR (Księga Przychodów i Rozchodów)
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Raport przychodów i rozchodów na podstawie zarejestrowanych transakcji w wybranym okresie.
          </p>
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div>
              <Label htmlFor="kpirFrom" className="text-xs">Data od</Label>
              <Input
                id="kpirFrom"
                type="date"
                value={kpirFrom}
                onChange={(e) => setKpirFrom(e.target.value)}
                className="mt-1 w-40"
              />
            </div>
            <div>
              <Label htmlFor="kpirTo" className="text-xs">Data do</Label>
              <Input
                id="kpirTo"
                type="date"
                value={kpirTo}
                onChange={(e) => setKpirTo(e.target.value)}
                className="mt-1 w-40"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={kpirLoading}
              onClick={async () => {
                if (!kpirFrom || !kpirTo) {
                  toast.error("Wybierz datę od i do");
                  return;
                }
                setKpirLoading(true);
                try {
                  const res = await getKpirReport(kpirFrom, kpirTo);
                  if (res.success && res.data) {
                    setKpirData(res.data);
                    toast.success("KPiR załadowany");
                  } else {
                    toast.error("error" in res ? (res.error ?? "Błąd KPiR") : "Błąd KPiR");
                    setKpirData(null);
                  }
                } finally {
                  setKpirLoading(false);
                }
              }}
            >
              {kpirLoading ? "Ładowanie…" : "Pokaż KPiR"}
            </Button>
          </div>
          {kpirData && (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-2">Data</th>
                    <th className="text-left p-2">Opis</th>
                    <th className="text-right p-2">Przychód</th>
                    <th className="text-right p-2">Rozchód</th>
                  </tr>
                </thead>
                <tbody>
                  {kpirData.rows.length === 0 ? (
                    <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">Brak zapisów w tym okresie</td></tr>
                  ) : (
                    kpirData.rows.map((r, i) => (
                      <tr key={i} className="border-b">
                        <td className="p-2">{r.date}</td>
                        <td className="p-2">{r.description}</td>
                        <td className="p-2 text-right">{r.income > 0 ? r.income.toFixed(2) : ""}</td>
                        <td className="p-2 text-right">{r.expense > 0 ? r.expense.toFixed(2) : ""}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-muted/50 font-medium">
                    <td colSpan={2} className="p-2">Razem</td>
                    <td className="p-2 text-right">{kpirData.totalIncome.toFixed(2)}</td>
                    <td className="p-2 text-right">{kpirData.totalExpense.toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
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

      {/* Rachunki (nie-VAT) */}
      <section className="mt-8 rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <FileText className="h-5 w-5" />
          Rachunki (nie-VAT)
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Rachunki są dokumentami sprzedaży dla podmiotów zwolnionych z VAT (art. 106b ust. 2 ustawy o VAT).
          Wystawiasz je z poziomu rezerwacji (menu kontekstowe → Wystaw rachunek).
        </p>
        
        {receipts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" role="table">
              <thead>
                <tr className="border-b">
                  <th className="py-2 text-left font-medium">Numer</th>
                  <th className="py-2 text-left font-medium">Nabywca</th>
                  <th className="py-2 text-right font-medium">Kwota ({currency})</th>
                  <th className="py-2 text-left font-medium">Data</th>
                  <th className="py-2 text-center font-medium">Status</th>
                  <th className="py-2 text-left font-medium">Akcje</th>
                </tr>
              </thead>
              <tbody>
                {receipts.map((r) => (
                  <tr key={r.id} className="border-b border-border/50 hover:bg-muted/50">
                    <td className="py-2 font-mono text-xs">{r.number}</td>
                    <td className="py-2">{r.buyerName}</td>
                    <td className="py-2 text-right">{r.amount.toFixed(2)}</td>
                    <td className="py-2">{new Date(r.issuedAt).toLocaleDateString("pl-PL")}</td>
                    <td className="py-2 text-center">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                          r.isPaid
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                        }`}
                      >
                        {r.isPaid ? (
                          <>
                            <Check className="h-3 w-3" /> Opłacony
                          </>
                        ) : (
                          <>
                            <X className="h-3 w-3" /> Nieopłacony
                          </>
                        )}
                      </span>
                    </td>
                    <td className="py-2">
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(`/api/finance/receipt/${r.id}/pdf`, "_blank")}
                          title="Podgląd / Drukuj"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleReceiptPaid(r.id, r.isPaid)}
                          disabled={receiptActionLoading === r.id}
                          title={r.isPaid ? "Oznacz jako nieopłacony" : "Oznacz jako opłacony"}
                        >
                          {r.isPaid ? (
                            <X className="h-4 w-4 text-yellow-600" />
                          ) : (
                            <Check className="h-4 w-4 text-green-600" />
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setDeleteReceiptId(r.id);
                            setDeleteReceiptPin("");
                          }}
                          disabled={receiptActionLoading === r.id || r.isPaid}
                          title={r.isPaid ? "Nie można usunąć opłaconego rachunku" : "Usuń rachunek"}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Brak rachunków. Wystaw pierwszy rachunek z poziomu rezerwacji.</p>
        )}

        {/* Dialog usuwania rachunku */}
        {deleteReceiptId && (
          <div className="mt-4 rounded-lg border border-destructive/50 bg-destructive/5 p-4">
            <p className="mb-2 text-sm font-medium">Potwierdź usunięcie rachunku</p>
            <p className="mb-4 text-sm text-muted-foreground">
              Aby usunąć rachunek, wprowadź PIN managera.
            </p>
            <form onSubmit={handleDeleteReceipt} className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="deleteReceiptPin" className="shrink-0">PIN:</Label>
                <Input
                  id="deleteReceiptPin"
                  type="password"
                  value={deleteReceiptPin}
                  onChange={(e) => setDeleteReceiptPin(e.target.value)}
                  placeholder="PIN managera"
                  autoComplete="off"
                  className="max-w-[150px]"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" variant="destructive" size="sm" disabled={receiptActionLoading === deleteReceiptId}>
                  {receiptActionLoading === deleteReceiptId ? "Usuwanie…" : "Usuń rachunek"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDeleteReceiptId(null);
                    setDeleteReceiptPin("");
                  }}
                >
                  Anuluj
                </Button>
              </div>
            </form>
          </div>
        )}
      </section>

      {/* Noty księgowe */}
      <section className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <FileWarning className="h-5 w-5" />
          Noty księgowe
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Noty księgowe dokumentują rozliczenia niegotówkowe: kary umowne, odszkodowania za zniszczenia, odsetki, rabaty.
          Wystawiasz je z poziomu rezerwacji lub firmy.
        </p>

        {accountingNotes.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" role="table">
              <thead>
                <tr className="border-b">
                  <th className="py-2 text-left font-medium">Numer</th>
                  <th className="py-2 text-left font-medium">Typ</th>
                  <th className="py-2 text-left font-medium">Odbiorca</th>
                  <th className="py-2 text-right font-medium">Kwota</th>
                  <th className="py-2 text-left font-medium">Tytuł</th>
                  <th className="py-2 text-left font-medium">Data</th>
                  <th className="py-2 text-center font-medium">Status</th>
                  <th className="py-2 text-left font-medium">Akcje</th>
                </tr>
              </thead>
              <tbody>
                {accountingNotes.map((note) => {
                  const typeLabel = note.type === "DEBIT" ? "Obciążeniowa" : "Uznaniowa";
                  const typeClass = note.type === "DEBIT"
                    ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                    : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
                  const statusLabel =
                    note.status === "ISSUED"
                      ? "Wystawiona"
                      : note.status === "PAID"
                        ? "Opłacona"
                        : note.status === "CANCELLED"
                          ? "Anulowana"
                          : "Sporna";
                  const statusClass =
                    note.status === "ISSUED"
                      ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                      : note.status === "PAID"
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                        : note.status === "CANCELLED"
                          ? "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 line-through"
                          : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";

                  return (
                    <tr key={note.id} className="border-b border-border/50 hover:bg-muted/50">
                      <td className="py-2 font-mono text-xs">{note.number}</td>
                      <td className="py-2">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${typeClass}`}>
                          {typeLabel}
                        </span>
                      </td>
                      <td className="py-2">{note.recipientName}</td>
                      <td className="py-2 text-right font-medium">
                        {Number(note.amount).toFixed(2)} {note.currency}
                      </td>
                      <td className="py-2 max-w-[200px] truncate" title={note.title}>
                        {note.title}
                      </td>
                      <td className="py-2">{new Date(note.issuedAt).toLocaleDateString("pl-PL")}</td>
                      <td className="py-2 text-center">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusClass}`}>
                          {statusLabel}
                        </span>
                      </td>
                      <td className="py-2">
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(`/api/finance/accounting-note/${note.id}/pdf`, "_blank")}
                            title="Podgląd / Drukuj"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                          {note.status === "ISSUED" && (
                            <>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => handleMarkNotePaid(note.id)}
                                disabled={noteActionLoading === note.id}
                                title="Oznacz jako opłaconą"
                              >
                                <Check className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setCancelNoteId(note.id);
                                  setCancelNoteReason("");
                                }}
                                disabled={noteActionLoading === note.id}
                                title="Anuluj notę"
                              >
                                <Ban className="h-4 w-4 text-destructive" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Brak not księgowych. Noty możesz wystawić z poziomu rezerwacji lub kontrahenta.
          </p>
        )}

        {/* Dialog anulowania noty */}
        {cancelNoteId && (
          <div className="mt-4 rounded-lg border border-destructive/50 bg-destructive/5 p-4">
            <p className="mb-2 text-sm font-medium">Anuluj notę księgową</p>
            <p className="mb-4 text-sm text-muted-foreground">
              Opcjonalnie podaj powód anulowania.
            </p>
            <form onSubmit={handleCancelNote} className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Label htmlFor="cancelNoteReason" className="shrink-0">Powód:</Label>
                <Input
                  id="cancelNoteReason"
                  type="text"
                  value={cancelNoteReason}
                  onChange={(e) => setCancelNoteReason(e.target.value)}
                  placeholder="(opcjonalnie)"
                  className="max-w-[300px]"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="submit"
                  variant="destructive"
                  size="sm"
                  disabled={noteActionLoading === cancelNoteId}
                >
                  {noteActionLoading === cancelNoteId ? "Anulowanie…" : "Anuluj notę"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCancelNoteId(null);
                    setCancelNoteReason("");
                  }}
                >
                  Zamknij
                </Button>
              </div>
            </form>
          </div>
        )}
      </section>

      {/* Raport prowizji (biura podróży, OTA) */}
      <section className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          <Percent className="h-5 w-5" />
          Raport prowizji (biura podróży, OTA)
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Prowizje dla agentów (biur podróży, OTA) wg daty wymeldowania. Przychód = suma transakcji nocleg + opłata miejscowa.
        </p>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="commissionFrom" className="text-xs">Data od (wymeldowanie)</Label>
            <Input
              id="commissionFrom"
              type="date"
              value={commissionFrom}
              onChange={(e) => setCommissionFrom(e.target.value)}
              className="mt-1 w-40"
            />
          </div>
          <div>
            <Label htmlFor="commissionTo" className="text-xs">Data do (wymeldowanie)</Label>
            <Input
              id="commissionTo"
              type="date"
              value={commissionTo}
              onChange={(e) => setCommissionTo(e.target.value)}
              className="mt-1 w-40"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleLoadCommissionReport}
            disabled={commissionReportLoading}
          >
            {commissionReportLoading ? "Generowanie…" : "Generuj raport"}
          </Button>
        </div>
        {commissionReport && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" role="table">
              <thead>
                <tr className="border-b">
                  <th className="py-2 text-left font-medium">Agent / Biuro</th>
                  <th className="py-2 text-left font-medium">Kod</th>
                  <th className="py-2 text-center font-medium">Prowizja %</th>
                  <th className="py-2 text-right font-medium">Rezerwacje</th>
                  <th className="py-2 text-right font-medium">Przychód ({commissionReport.currency})</th>
                  <th className="py-2 text-right font-medium">Prowizja ({commissionReport.currency})</th>
                </tr>
              </thead>
              <tbody>
                {commissionReport.rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-muted-foreground">
                      Brak rezerwacji z agentem w wybranym okresie.
                    </td>
                  </tr>
                ) : (
                  commissionReport.rows.map((row) => (
                    <tr key={row.agentId} className="border-b border-border/50 hover:bg-muted/50">
                      <td className="py-2">{row.agentName}</td>
                      <td className="py-2 font-mono text-xs">{row.agentCode}</td>
                      <td className="py-2 text-center">{row.commissionPercent.toFixed(1)}%</td>
                      <td className="py-2 text-right">{row.reservationCount}</td>
                      <td className="py-2 text-right">{row.totalRevenue.toFixed(2)}</td>
                      <td className="py-2 text-right font-medium">{row.totalCommission.toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {commissionReport.rows.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 font-medium">
                    <td className="py-2" colSpan={4}>Razem</td>
                    <td className="py-2 text-right">{commissionReport.totalRevenue.toFixed(2)}</td>
                    <td className="py-2 text-right">{commissionReport.totalCommission.toFixed(2)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </section>

      <Dialog open={!!ksefErrorDialog} onOpenChange={() => setKsefErrorDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Błąd KSeF – {ksefErrorDialog?.documentNumber ?? ""}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
            {ksefErrorDialog?.message ?? ""}
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
