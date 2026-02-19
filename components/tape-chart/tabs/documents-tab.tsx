"use client";

import { useState, useEffect } from "react";
import {
  getInvoicesForReservation,
  getProformasForReservation,
  getTransactionsForReservation,
} from "@/app/actions/finance";

interface DocumentsTabProps {
  reservationId: string;
}

export function DocumentsTab({ reservationId }: DocumentsTabProps) {
  const [invoices, setInvoices] = useState<Array<{ id: string; number: string; amountGross: number; issuedAt: string }>>([]);
  const [proformas, setProformas] = useState<Array<{ id: string; number: string; amount: number; issuedAt: string }>>([]);
  const [transactions, setTransactions] = useState<Array<{ id: string; amount: number; type: string; createdAt: string; isReadOnly: boolean }>>([]);

  useEffect(() => {
    getTransactionsForReservation(reservationId).then((r) => r.success && r.data && setTransactions(r.data));
    getInvoicesForReservation(reservationId).then((r) => r.success && r.data && setInvoices(r.data));
    getProformasForReservation(reservationId).then((r) => r.success && r.data && setProformas(r.data));
  }, [reservationId]);

  return (
    <div className="space-y-4">
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
      <div>
        <p className="mb-2 text-sm font-medium">Proformy</p>
        <ul className="list-none space-y-1 text-sm">
          {proformas.length === 0 ? (
            <li className="text-muted-foreground">Brak proform.</li>
          ) : (
            proformas.map((p) => (
              <li key={p.id} className="flex justify-between rounded border px-2 py-1">
                <span>{p.number}</span>
                <span>{p.amount.toFixed(2)} PLN</span>
              </li>
            ))
          )}
        </ul>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">Faktury VAT</p>
        <ul className="list-none space-y-1 text-sm">
          {invoices.length === 0 ? (
            <li className="text-muted-foreground">Brak faktur.</li>
          ) : (
            invoices.map((i) => (
              <li
                key={i.id}
                className="flex justify-between rounded border px-2 py-1 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => window.open(`/api/finance/invoice/${i.id}/pdf`, "_blank", "noopener,noreferrer")}
                title="Kliknij, aby otworzyć PDF faktury"
              >
                <span className="text-primary underline underline-offset-2">{i.number}</span>
                <span>{i.amountGross.toFixed(2)} PLN</span>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
