"use client";

import { useState, useEffect } from "react";
import {
  getInvoicesForReservation,
  getProformasForReservation,
  getTransactionsForReservation,
  getInvoiceById,
  updateInvoice,
} from "@/app/actions/finance";
import { DocumentHistoryPanel } from "@/components/finance/document-history-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface DocumentsTabProps {
  reservationId: string;
}

const PAYMENT_TYPES = ["CASH", "CARD", "TRANSFER", "PREPAID", "OTHER"] as const;
const PAYMENT_LABELS: Record<string, string> = {
  CASH: "Gotówka",
  CARD: "Karta",
  TRANSFER: "Przelew",
  PREPAID: "Przedpłata",
  OTHER: "Inne",
};

export function DocumentsTab({ reservationId }: DocumentsTabProps) {
  const [invoices, setInvoices] = useState<Array<{ id: string; number: string; amountGross: number; issuedAt: string }>>([]);
  const [proformas, setProformas] = useState<Array<{ id: string; number: string; amount: number; issuedAt: string }>>([]);
  const [transactions, setTransactions] = useState<Array<{ id: string; amount: number; type: string; createdAt: string; isReadOnly: boolean }>>([]);
  const [invoiceSheetId, setInvoiceSheetId] = useState<string | null>(null);
  const [invoiceDetail, setInvoiceDetail] = useState<{
    number: string;
    amountGross: number;
    isEditable: boolean;
    paymentBreakdown: Array<{ type: string; amount: number }> | null;
    customFieldValues: Record<string, string> | null;
  } | null>(null);
  const [customFields, setCustomFields] = useState<Record<string, string>>({});
  const [payment1Type, setPayment1Type] = useState("CASH");
  const [payment1Amount, setPayment1Amount] = useState("");
  const [payment2Type, setPayment2Type] = useState("CARD");
  const [payment2Amount, setPayment2Amount] = useState("");
  const [savingInvoice, setSavingInvoice] = useState(false);

  useEffect(() => {
    getTransactionsForReservation(reservationId).then((r) => r.success && r.data && setTransactions(r.data));
    getInvoicesForReservation(reservationId).then((r) => r.success && r.data && setInvoices(r.data));
    getProformasForReservation(reservationId).then((r) => r.success && r.data && setProformas(r.data));
  }, [reservationId]);

  useEffect(() => {
    if (!invoiceSheetId) {
      setInvoiceDetail(null);
      return;
    }
    getInvoiceById(invoiceSheetId).then((r) => {
      if (r.success && r.data) {
        setInvoiceDetail({
          number: r.data.number,
          amountGross: r.data.amountGross,
          isEditable: r.data.isEditable,
          paymentBreakdown: r.data.paymentBreakdown ?? null,
          customFieldValues: r.data.customFieldValues ?? null,
        });
        setCustomFields(r.data.customFieldValues && typeof r.data.customFieldValues === "object" ? { ...r.data.customFieldValues } : {});
        const pb = r.data.paymentBreakdown;
        if (pb && pb.length >= 1) {
          setPayment1Type(pb[0].type);
          setPayment1Amount(String(pb[0].amount));
        } else {
          setPayment1Type("CASH");
          setPayment1Amount("");
        }
        if (pb && pb.length >= 2) {
          setPayment2Type(pb[1].type);
          setPayment2Amount(String(pb[1].amount));
        } else {
          setPayment2Type("CARD");
          setPayment2Amount("");
        }
      } else setInvoiceDetail(null);
    });
  }, [invoiceSheetId]);

  const handleSaveInvoicePayments = async () => {
    if (!invoiceSheetId || !invoiceDetail?.isEditable) return;
    const amt1 = payment1Amount.trim() ? parseFloat(payment1Amount) : 0;
    const amt2 = payment2Amount.trim() ? parseFloat(payment2Amount) : 0;
    const paymentBreakdown: Array<{ type: string; amount: number }> = [];
    if (amt1 > 0) paymentBreakdown.push({ type: payment1Type, amount: amt1 });
    if (amt2 > 0) paymentBreakdown.push({ type: payment2Type, amount: amt2 });
    setSavingInvoice(true);
    try {
      const result = await updateInvoice(invoiceSheetId, { paymentBreakdown: paymentBreakdown.length > 0 ? paymentBreakdown : null });
      if (result.success) {
        toast.success("Zapisano rozbicie płatności");
        getInvoiceById(invoiceSheetId).then((r) => {
          if (r.success && r.data)
            setInvoiceDetail((d) => d ? { ...d, paymentBreakdown: r.data!.paymentBreakdown ?? null } : null);
        });
      } else toast.error(result.error);
    } finally {
      setSavingInvoice(false);
    }
  };

  const handleSaveInvoiceCustomFields = async () => {
    if (!invoiceSheetId || !invoiceDetail?.isEditable) return;
    setSavingInvoice(true);
    try {
      const result = await updateInvoice(invoiceSheetId, { customFieldValues: Object.keys(customFields).length > 0 ? customFields : null });
      if (result.success) {
        toast.success("Zapisano pola własne");
        getInvoiceById(invoiceSheetId).then((r) => {
          if (r.success && r.data)
            setInvoiceDetail((d) => d ? { ...d, customFieldValues: r.data!.customFieldValues ?? null } : null);
        });
      } else toast.error(result.error);
    } finally {
      setSavingInvoice(false);
    }
  };

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
              <li key={i.id} className="flex items-center justify-between gap-2 rounded border px-2 py-1 group">
                <span
                  className="text-primary underline underline-offset-2 cursor-pointer flex-1 min-w-0"
                  onClick={() => window.open(`/api/finance/invoice/${i.id}/pdf`, "_blank", "noopener,noreferrer")}
                  title="Otwórz PDF"
                >
                  {i.number}
                </span>
                <span className="tabular-nums shrink-0">{i.amountGross.toFixed(2)} PLN</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs shrink-0 opacity-70 group-hover:opacity-100"
                  onClick={(e) => { e.stopPropagation(); setInvoiceSheetId(i.id); }}
                >
                  Płatności / Historia
                </Button>
              </li>
            ))
          )}
        </ul>
      </div>

      <Sheet open={!!invoiceSheetId} onOpenChange={(open) => !open && setInvoiceSheetId(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Faktura {invoiceDetail?.number ?? ""}</SheetTitle>
          </SheetHeader>
          {invoiceDetail && (
            <div className="mt-4 space-y-4">
              <div className="text-sm text-muted-foreground">
                Kwota brutto: <span className="font-medium text-foreground">{invoiceDetail.amountGross.toFixed(2)} PLN</span>
              </div>
              {invoiceDetail.isEditable && (
                <div className="rounded border p-3 space-y-3">
                  <Label className="text-sm">Rozbicie płatności (dwa sposoby)</Label>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <Label className="text-xs">1. Typ</Label>
                      <Select value={payment1Type} onValueChange={setPayment1Type}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PAYMENT_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>{PAYMENT_LABELS[t] ?? t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Kwota (PLN)</Label>
                      <Input type="number" min={0} step={0.01} className="h-8" value={payment1Amount} onChange={(e) => setPayment1Amount(e.target.value)} placeholder="0" />
                    </div>
                    <div>
                      <Label className="text-xs">2. Typ</Label>
                      <Select value={payment2Type} onValueChange={setPayment2Type}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PAYMENT_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>{PAYMENT_LABELS[t] ?? t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Kwota (PLN)</Label>
                      <Input type="number" min={0} step={0.01} className="h-8" value={payment2Amount} onChange={(e) => setPayment2Amount(e.target.value)} placeholder="0" />
                    </div>
                  </div>
                  <Button type="button" size="sm" disabled={savingInvoice} onClick={handleSaveInvoicePayments}>
                    {savingInvoice ? "Zapisywanie…" : "Zapisz rozbicie płatności"}
                  </Button>
                </div>
              )}
              {invoiceDetail?.isEditable && (
                <div className="rounded border p-3 space-y-2">
                  <Label className="text-sm">Pola własne na fakturze (B3)</Label>
                  <p className="text-xs text-muted-foreground">Np. numer zamówienia, projekt. Klucz i wartość.</p>
                  <div className="space-y-2">
                    {Object.entries(customFields).map(([key, value]) => (
                      <div key={key} className="flex gap-2 items-center">
                        <Input className="flex-1 h-8 text-xs" value={key} placeholder="Klucz" disabled />
                        <Input className="flex-1 h-8 text-xs" value={value} placeholder="Wartość" onChange={(e) => setCustomFields((prev) => ({ ...prev, [key]: e.target.value }))} />
                        <Button type="button" variant="ghost" size="sm" className="h-8 w-8 shrink-0" onClick={() => setCustomFields((prev) => { const n = { ...prev }; delete n[key]; return n; })}>−</Button>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <Input className="h-8 text-xs" placeholder="Nowy klucz" id="new-custom-key" />
                      <Input className="h-8 text-xs" placeholder="Wartość" id="new-custom-val" onChange={(e) => {
                        const keyInput = document.getElementById("new-custom-key") as HTMLInputElement;
                        const key = keyInput?.value?.trim();
                        if (key) setCustomFields((prev) => ({ ...prev, [key]: e.target.value }));
                      }} />
                      <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => {
                        const keyInput = document.getElementById("new-custom-key") as HTMLInputElement;
                        const valInput = document.getElementById("new-custom-val") as HTMLInputElement;
                        const key = keyInput?.value?.trim();
                        const val = valInput?.value?.trim() ?? "";
                        if (key) { setCustomFields((prev) => ({ ...prev, [key]: val })); keyInput.value = ""; valInput.value = ""; }
                      }}>Dodaj</Button>
                    </div>
                  </div>
                  <Button type="button" size="sm" disabled={savingInvoice} onClick={handleSaveInvoiceCustomFields}>
                    {savingInvoice ? "Zapisywanie…" : "Zapisz pola własne"}
                  </Button>
                </div>
              )}
              {invoiceSheetId && (
                <DocumentHistoryPanel entityType="Invoice" entityId={invoiceSheetId} title="Historia faktury" className="border-t pt-4" />
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
