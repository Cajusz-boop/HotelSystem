"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getInvoicesForReservation,
  getInvoicesForReservations,
  getProformasForReservation,
  getTransactionsForReservation,
} from "@/app/actions/finance";
import { InvoiceEditSheet } from "@/components/finance/invoice-edit-sheet";
import { Button } from "@/components/ui/button";

interface DocumentsTabProps {
  reservationId?: string;
  /** Tryb zbiorczy: lista ID rezerwacji, z kolumną Pokój */
  reservationIds?: string[];
  isConsolidated?: boolean;
}

export function DocumentsTab({ reservationId, reservationIds, isConsolidated }: DocumentsTabProps) {
  const [invoices, setInvoices] = useState<Array<{ id: string; number: string; amountGross: number; issuedAt: string; room?: string }>>([]);
  const [proformas, setProformas] = useState<Array<{ id: string; number: string; amount: number; issuedAt: string }>>([]);
  const [transactions, setTransactions] = useState<Array<{ id: string; amount: number; type: string; createdAt: string; isReadOnly: boolean }>>([]);
  const [invoiceSheetId, setInvoiceSheetId] = useState<string | null>(null);

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

  return (
    <div className="space-y-4">
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
