"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getInvoicesForReservation,
  getInvoicesForReservations,
  getProformasForReservation,
  getTransactionsForReservation,
} from "@/app/actions/finance";
import { updateReservation } from "@/app/actions/reservations";
import { InvoiceEditSheet } from "@/components/finance/invoice-edit-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface DocumentsTabProps {
  reservationId?: string;
  /** Tryb zbiorczy: lista ID rezerwacji, z kolumną Pokój */
  reservationIds?: string[];
  isConsolidated?: boolean;
  /** Numer paragonu (z rezerwacji) – przekazywany z rodzica */
  receiptNumber?: string | null;
  /** Data paragonu (YYYY-MM-DD lub null) – przekazywany z rodzica */
  receiptDate?: string | null;
  /** Wywołane po zapisie paragonu – przekazuje zaktualizowane pola, rodzic może zaktualizować stan rezerwacji */
  onReceiptSave?: (updates: { receiptNumber: string | null; receiptDate: string | null }) => void;
}

export function DocumentsTab({ reservationId, reservationIds, isConsolidated, receiptNumber, receiptDate, onReceiptSave }: DocumentsTabProps) {
  const [invoices, setInvoices] = useState<Array<{ id: string; number: string; amountGross: number; issuedAt: string; room?: string }>>([]);
  const [proformas, setProformas] = useState<Array<{ id: string; number: string; amount: number; issuedAt: string }>>([]);
  const [transactions, setTransactions] = useState<Array<{ id: string; amount: number; type: string; createdAt: string; isReadOnly: boolean }>>([]);
  const [invoiceSheetId, setInvoiceSheetId] = useState<string | null>(null);
  const [receiptFormOpen, setReceiptFormOpen] = useState(false);
  const [editReceiptNumber, setEditReceiptNumber] = useState("");
  const [editReceiptDate, setEditReceiptDate] = useState("");
  const [receiptSaving, setReceiptSaving] = useState(false);

  const loadInvoices = useCallback(() => {
    if (isConsolidated && reservationIds?.length) {
      getInvoicesForReservations(reservationIds).then((r) => r.success && r.data && setInvoices(r.data));
    } else if (reservationId) {
      getInvoicesForReservation(reservationId).then((r) => r.success && r.data && setInvoices(r.data));
    }
  }, [isConsolidated, reservationIds, reservationId]);

  const effectiveReservationId = reservationId ?? (reservationIds?.length === 1 ? reservationIds[0] : undefined);
  useEffect(() => {
    if (isConsolidated && reservationIds?.length) {
      getInvoicesForReservations(reservationIds).then((r) => r.success && r.data && setInvoices(r.data));
      setTransactions([]);
      setProformas([]);
    } else if (reservationId) {
      getTransactionsForReservation(reservationId).then((r) => r.success && r.data && setTransactions(r.data));
      getInvoicesForReservation(reservationId).then((r) => r.success && r.data && setInvoices(r.data));
      getProformasForReservation(reservationId).then((r) => r.success && r.data && setProformas(r.data));
    }
  }, [reservationId, reservationIds, isConsolidated]);

  const hasReceipt = receiptNumber != null && String(receiptNumber).trim() !== "";
  const hasInvoice = invoices.length > 0;
  const showReceiptSection = !isConsolidated && effectiveReservationId;

  const openReceiptForm = useCallback(() => {
    setEditReceiptNumber(receiptNumber?.trim() ?? "");
    setEditReceiptDate(receiptDate ?? "");
    setReceiptFormOpen(true);
  }, [receiptNumber, receiptDate]);

  const saveReceipt = useCallback(async () => {
    if (!reservationId) return;
    const num = editReceiptNumber.trim();
    if (!num) {
      toast.error("Podaj numer paragonu.");
      return;
    }
    setReceiptSaving(true);
    try {
      const res = await updateReservation(reservationId, {
        receiptNumber: num,
        receiptDate: editReceiptDate.trim() ? editReceiptDate.trim() : null,
      } as Parameters<typeof updateReservation>[1]);
      if (res.success) {
        toast.success("Paragon zapisany.");
        setReceiptFormOpen(false);
        onReceiptSave?.({ receiptNumber: num, receiptDate: editReceiptDate.trim() || null });
        loadInvoices();
      } else {
        toast.error(res.error ?? "Błąd zapisu");
      }
    } finally {
      setReceiptSaving(false);
    }
  }, [reservationId, editReceiptNumber, editReceiptDate, onReceiptSave]);

  const removeReceipt = useCallback(async () => {
    if (!reservationId) return;
    setReceiptSaving(true);
    try {
      const res = await updateReservation(reservationId, {
        receiptNumber: null,
        receiptDate: null,
      } as Parameters<typeof updateReservation>[1]);
      if (res.success) {
        toast.success("Paragon usunięty.");
        setReceiptFormOpen(false);
        onReceiptSave?.({ receiptNumber: null, receiptDate: null });
        loadInvoices();
      } else {
        toast.error(res.error ?? "Błąd zapisu");
      }
    } finally {
      setReceiptSaving(false);
    }
  }, [reservationId, onReceiptSave]);

  return (
    <div className="space-y-4">
      {showReceiptSection && (
        <div>
          <p className="mb-2 text-sm font-medium">Paragon fiskalny</p>
          {receiptFormOpen ? (
            <div className="rounded border bg-muted/20 p-3 space-y-3">
              <div>
                <Label htmlFor="receipt-number" className="text-xs">Numer paragonu</Label>
                <Input
                  id="receipt-number"
                  value={editReceiptNumber}
                  onChange={(e) => setEditReceiptNumber(e.target.value)}
                  placeholder="np. 123/2025"
                  className="h-8 text-sm mt-1"
                />
              </div>
              <div>
                <Label htmlFor="receipt-date" className="text-xs">Data paragonu (opcjonalnie)</Label>
                <Input
                  id="receipt-date"
                  type="date"
                  value={editReceiptDate}
                  onChange={(e) => setEditReceiptDate(e.target.value)}
                  className="h-8 text-sm mt-1"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" className="h-8 text-xs" onClick={saveReceipt} disabled={receiptSaving}>
                  {receiptSaving ? "Zapisywanie…" : "Zapisz"}
                </Button>
                <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={() => setReceiptFormOpen(false)} disabled={receiptSaving}>
                  Anuluj
                </Button>
                {hasReceipt && (
                  <Button type="button" size="sm" variant="destructive" className="h-8 text-xs" onClick={removeReceipt} disabled={receiptSaving}>
                    Usuń paragon
                  </Button>
                )}
              </div>
            </div>
          ) : hasReceipt ? (
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="font-normal">
                Paragon nr {receiptNumber}
                {receiptDate ? ` · ${new Date(receiptDate).toLocaleDateString("pl-PL")}` : ""}
              </Badge>
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={openReceiptForm}>
                Edytuj
              </Button>
            </div>
          ) : !hasInvoice ? (
            <p className="text-sm text-muted-foreground">Brak dokumentu finansowego.</p>
          ) : null}
          {!hasReceipt && !receiptFormOpen && !hasInvoice && (
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs mt-1" onClick={openReceiptForm}>
              Dodaj paragon
            </Button>
          )}
        </div>
      )}
      {!isConsolidated && effectiveReservationId && (
      <div>
        <p className="mb-2 text-sm font-medium">Druki</p>
        <button
          type="button"
          onClick={() =>
            window.open(
              `/api/reservations/${reservationId}/registration-card/pdf`,
              "_blank",
              "noopener,noreferrer"
            )
          }
          className="text-sm text-primary hover:underline underline-offset-2"
        >
          Drukuj kartę meldunkową
        </button>
      </div>
      )}
      {!isConsolidated && (
      <div>
        <p className="mb-2 text-sm font-medium">Transakcje (KP/KW)</p>
        <ul className="list-none space-y-1 text-sm">
          {transactions.length === 0 ? (
            <li className="text-muted-foreground">Brak transakcji.</li>
          ) : (
            transactions.map((t) => (
              <li key={t.id} className="flex justify-between rounded border px-2 py-1">
                <span>{t.type}</span>
                <span>{t.amount.toFixed(2)} PLN · {new Date(t.createdAt).toLocaleString("pl-PL")}{t.isReadOnly ? " (zamknięta)" : ""}</span>
              </li>
            ))
          )}
        </ul>
      </div>
      )}
      {!isConsolidated && (
      <div>
        <p className="mb-2 text-sm font-medium">Proformy</p>
        <ul className="list-none space-y-1 text-sm">
          {proformas.length === 0 ? (
            <li className="text-muted-foreground">Brak proform.</li>
          ) : (
            proformas.map((p) => (
              <li key={p.id} className="flex justify-between rounded border px-2 py-1 group">
                <span
                  className="text-primary underline underline-offset-2 cursor-pointer flex-1 min-w-0"
                  onClick={() => window.open(`/finance/proforma/${p.id}`, "_blank", "noopener,noreferrer")}
                  title="Otwórz podgląd"
                >
                  {p.number}
                </span>
                <span className="tabular-nums shrink-0">{p.amount.toFixed(2)} PLN</span>
              </li>
            ))
          )}
        </ul>
      </div>
      )}
      <div>
        <p className="mb-2 text-sm font-medium">Faktury VAT{isConsolidated ? " (z wszystkich rezerwacji)" : ""}</p>
        <ul className="list-none space-y-1 text-sm">
          {invoices.length === 0 ? (
            <li className="text-muted-foreground">Brak faktur.</li>
          ) : (
            invoices.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-2 rounded border px-2 py-1 group">
                <span
                  className="text-primary underline underline-offset-2 cursor-pointer flex-1 min-w-0"
                  onClick={() => window.open(`/finance/invoice/${i.id}`, "_blank", "noopener,noreferrer")}
                  title="Otwórz podgląd"
                >
                  {i.number}
                </span>
                {isConsolidated && i.room != null ? (
                  <span className="text-muted-foreground text-xs shrink-0 w-16 truncate" title={i.room}>{i.room}</span>
                ) : null}
                <span className="tabular-nums shrink-0">{i.amountGross.toFixed(2)} PLN</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs shrink-0 opacity-70 group-hover:opacity-100"
                  onClick={(e) => { e.stopPropagation(); setInvoiceSheetId(i.id); }}
                  title="Edytuj (szkic) / płatności / historia"
                >
                  Edytuj / Szczegóły
                </Button>
              </li>
            ))
          )}
        </ul>
      </div>

      <InvoiceEditSheet
        invoiceId={invoiceSheetId}
        open={!!invoiceSheetId}
        onOpenChange={(open) => {
          if (!open) setInvoiceSheetId(null);
        }}
        onSaved={loadInvoices}
      />
    </div>
  );
}
