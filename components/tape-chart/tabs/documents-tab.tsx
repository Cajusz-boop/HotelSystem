"use client";

import { useState, useEffect } from "react";
import {
  getInvoicesForReservation,
  getProformasForReservation,
  getTransactionsForReservation,
  getInvoiceById,
  updateInvoice,
  deleteInvoice,
} from "@/app/actions/finance";
import { lookupCompanyByNip } from "@/app/actions/companies";
import { validateNipOrVat } from "@/lib/nip-vat-validate";
import { DocumentHistoryPanel } from "@/components/finance/document-history-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
    amountNet: number;
    amountVat: number;
    amountGross: number;
    vatRate: number;
    buyerNip: string;
    buyerName: string;
    buyerAddress: string | null;
    buyerPostalCode: string | null;
    buyerCity: string | null;
    issuedAt: string;
    deliveryDate: string | null;
    isEditable: boolean;
    paymentBreakdown: Array<{ type: string; amount: number }> | null;
    customFieldValues: Record<string, string> | null;
    notes: string | null;
  } | null>(null);
  const [customFields, setCustomFields] = useState<Record<string, string>>({});
  const [invoiceNotes, setInvoiceNotes] = useState("");
  const [payment1Type, setPayment1Type] = useState("CASH");
  const [payment1Amount, setPayment1Amount] = useState("");
  const [payment2Type, setPayment2Type] = useState("CARD");
  const [payment2Amount, setPayment2Amount] = useState("");
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [deletingInvoice, setDeletingInvoice] = useState(false);
  const [nipLoading, setNipLoading] = useState(false);
  // Pola edycji głównych danych faktury (gdy isEditable)
  const [editNumber, setEditNumber] = useState("");
  const [editBuyerNip, setEditBuyerNip] = useState("");
  const [editBuyerName, setEditBuyerName] = useState("");
  const [editBuyerAddress, setEditBuyerAddress] = useState("");
  const [editBuyerPostalCode, setEditBuyerPostalCode] = useState("");
  const [editBuyerCity, setEditBuyerCity] = useState("");
  const [editAmountGross, setEditAmountGross] = useState("");
  const [editVatRate, setEditVatRate] = useState("8");
  const [editIssuedAt, setEditIssuedAt] = useState("");
  const [editDeliveryDate, setEditDeliveryDate] = useState("");

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
        const d = r.data;
        setInvoiceDetail({
          number: d.number,
          amountNet: d.amountNet,
          amountVat: d.amountVat,
          amountGross: d.amountGross,
          vatRate: d.vatRate,
          buyerNip: d.buyerNip,
          buyerName: d.buyerName,
          buyerAddress: d.buyerAddress,
          buyerPostalCode: d.buyerPostalCode,
          buyerCity: d.buyerCity,
          issuedAt: d.issuedAt,
          deliveryDate: d.deliveryDate,
          isEditable: d.isEditable,
          paymentBreakdown: d.paymentBreakdown ?? null,
          customFieldValues: d.customFieldValues ?? null,
          notes: d.notes ?? null,
        });
        setEditNumber(d.number);
        setEditBuyerNip(d.buyerNip);
        setEditBuyerName(d.buyerName);
        setEditBuyerAddress(d.buyerAddress ?? "");
        setEditBuyerPostalCode(d.buyerPostalCode ?? "");
        setEditBuyerCity(d.buyerCity ?? "");
        setEditAmountGross(d.amountGross.toFixed(2));
        setEditVatRate(String(d.vatRate));
        setEditIssuedAt(d.issuedAt.slice(0, 10));
        setEditDeliveryDate(d.deliveryDate ? d.deliveryDate.slice(0, 10) : "");
        setCustomFields(d.customFieldValues && typeof d.customFieldValues === "object" ? { ...d.customFieldValues } : {});
        setInvoiceNotes(d.notes ?? "");
        const pb = d.paymentBreakdown;
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

  const handleFetchByNip = async () => {
    const trimmed = editBuyerNip.trim();
    if (!trimmed) {
      toast.error("Podaj NIP.");
      return;
    }
    const validation = validateNipOrVat(trimmed);
    if (!validation.ok) {
      toast.error(validation.error);
      return;
    }
    setNipLoading(true);
    try {
      const result = await lookupCompanyByNip(trimmed);
      if (result.success && result.data) {
        const d = result.data;
        setEditBuyerNip(d.nip ?? trimmed);
        setEditBuyerName(d.name ?? "");
        setEditBuyerAddress(d.address ?? "");
        setEditBuyerPostalCode(d.postalCode ?? "");
        setEditBuyerCity(d.city ?? "");
        toast.success("Dane firmy pobrane z Wykazu VAT.");
      } else {
        toast.error(result.success === false ? result.error : "Nie udało się pobrać danych.");
      }
    } finally {
      setNipLoading(false);
    }
  };

  const handleSaveInvoiceMainData = async () => {
    if (!invoiceSheetId || !invoiceDetail?.isEditable) return;
    const num = editNumber.trim();
    if (!num) {
      toast.error("Podaj numer faktury.");
      return;
    }
    const nipValidation = validateNipOrVat(editBuyerNip.trim());
    if (!nipValidation.ok) {
      toast.error(nipValidation.error);
      return;
    }
    if (!editBuyerName.trim()) {
      toast.error("Podaj nazwę nabywcy.");
      return;
    }
    const gross = parseFloat(editAmountGross.replace(",", "."));
    if (isNaN(gross) || gross < 0) {
      toast.error("Podaj poprawną kwotę brutto.");
      return;
    }
    const vatRate = parseFloat(editVatRate.replace(",", "."));
    if (isNaN(vatRate) || vatRate < 0 || vatRate > 100) {
      toast.error("Podaj poprawną stawkę VAT.");
      return;
    }
    const amountNet = Math.round((gross / (1 + vatRate / 100)) * 100) / 100;
    const amountVat = Math.round((gross - amountNet) * 100) / 100;
    const issuedAt = editIssuedAt.trim() ? new Date(editIssuedAt) : undefined;
    const deliveryDate = editDeliveryDate.trim() ? new Date(editDeliveryDate) : null;
    setSavingInvoice(true);
    try {
      const result = await updateInvoice(invoiceSheetId, {
        number: num,
        buyerNip: nipValidation.normalized,
        buyerName: editBuyerName.trim(),
        buyerAddress: editBuyerAddress.trim() || null,
        buyerPostalCode: editBuyerPostalCode.trim() || null,
        buyerCity: editBuyerCity.trim() || null,
        amountNet,
        amountVat,
        amountGross: gross,
        vatRate,
        issuedAt,
        deliveryDate,
      });
      if (result.success) {
        toast.success("Zapisano dane faktury");
        getInvoicesForReservation(reservationId).then((r) => r.success && r.data && setInvoices(r.data));
        getInvoiceById(invoiceSheetId).then((r) => {
          if (r.success && r.data) {
            const d = r.data;
            setInvoiceDetail((prev) => prev ? {
              ...prev,
              number: d.number,
              amountNet: d.amountNet,
              amountVat: d.amountVat,
              amountGross: d.amountGross,
              vatRate: d.vatRate,
              buyerNip: d.buyerNip,
              buyerName: d.buyerName,
              buyerAddress: d.buyerAddress,
              buyerPostalCode: d.buyerPostalCode,
              buyerCity: d.buyerCity,
              issuedAt: d.issuedAt,
              deliveryDate: d.deliveryDate,
            } : null);
            setEditNumber(d.number);
            setEditBuyerNip(d.buyerNip);
            setEditBuyerName(d.buyerName);
            setEditBuyerAddress(d.buyerAddress ?? "");
            setEditBuyerPostalCode(d.buyerPostalCode ?? "");
            setEditBuyerCity(d.buyerCity ?? "");
            setEditAmountGross(d.amountGross.toFixed(2));
            setEditVatRate(String(d.vatRate));
            setEditIssuedAt(d.issuedAt.slice(0, 10));
            setEditDeliveryDate(d.deliveryDate ? d.deliveryDate.slice(0, 10) : "");
          }
        });
      } else toast.error(result.error);
    } finally {
      setSavingInvoice(false);
    }
  };

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

  const handleSaveInvoiceNotes = async () => {
    if (!invoiceSheetId || !invoiceDetail?.isEditable) return;
    setSavingInvoice(true);
    try {
      const result = await updateInvoice(invoiceSheetId, { notes: invoiceNotes.trim() || null });
      if (result.success) {
        toast.success("Zapisano uwagi");
        setInvoiceDetail((d) => d ? { ...d, notes: invoiceNotes.trim() || null } : null);
      } else toast.error(result.error);
    } finally {
      setSavingInvoice(false);
    }
  };

  const handleDeleteInvoice = async () => {
    if (!invoiceSheetId || !invoiceDetail?.isEditable) return;
    if (!confirm(`Czy na pewno usunąć fakturę ${invoiceDetail.number}? Operacja jest nieodwracalna. Numer będzie dostępny do ponownego użycia.`)) return;
    setDeletingInvoice(true);
    try {
      const result = await deleteInvoice(invoiceSheetId);
      if (result.success) {
        toast.success("Faktura usunięta");
        setInvoiceSheetId(null);
        getInvoicesForReservation(reservationId).then((r) => r.success && r.data && setInvoices(r.data));
      } else toast.error(result.error ?? "Błąd usuwania faktury");
    } finally {
      setDeletingInvoice(false);
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
                  title="Edytuj (szkic) / płatności / historia"
                >
                  Edytuj / Szczegóły
                </Button>
              </li>
            ))
          )}
        </ul>
      </div>

      <Sheet open={!!invoiceSheetId} onOpenChange={(open) => !open && setInvoiceSheetId(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Faktura {invoiceDetail?.number ?? ""}</SheetTitle>
          </SheetHeader>
          {invoiceDetail && (
            <div className="mt-4 space-y-4">
              {invoiceDetail.isEditable ? (
                <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
                  <h4 className="text-sm font-medium">Edycja faktury (szkic)</h4>
                  <div className="grid gap-3 text-sm">
                    <div>
                      <Label className="text-xs">Numer faktury</Label>
                      <Input
                        className="h-8 mt-1"
                        value={editNumber}
                        onChange={(e) => setEditNumber(e.target.value)}
                        placeholder="FV/2026/0001"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Data wystawienia</Label>
                      <Input
                        type="date"
                        className="h-8 mt-1"
                        value={editIssuedAt}
                        onChange={(e) => setEditIssuedAt(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Data dostawy/wykonania usługi</Label>
                      <Input
                        type="date"
                        className="h-8 mt-1"
                        value={editDeliveryDate}
                        onChange={(e) => setEditDeliveryDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Nabywca – NIP</Label>
                      <div className="flex gap-2 mt-1">
                        <Input
                          className="h-8 flex-1"
                          value={editBuyerNip}
                          onChange={(e) => setEditBuyerNip(e.target.value)}
                          placeholder="1234567890"
                        />
                        <Button type="button" variant="outline" size="sm" className="h-8 shrink-0" onClick={handleFetchByNip} disabled={nipLoading}>
                          {nipLoading ? "…" : "Pobierz dane"}
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Nazwa nabywcy</Label>
                      <Input
                        className="h-8 mt-1"
                        value={editBuyerName}
                        onChange={(e) => setEditBuyerName(e.target.value)}
                        placeholder="Nazwa firmy"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Adres</Label>
                      <Input
                        className="h-8 mt-1"
                        value={editBuyerAddress}
                        onChange={(e) => setEditBuyerAddress(e.target.value)}
                        placeholder="ul. Przykładowa 1"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Kod pocztowy</Label>
                        <Input
                          className="h-8 mt-1"
                          value={editBuyerPostalCode}
                          onChange={(e) => setEditBuyerPostalCode(e.target.value)}
                          placeholder="00-000"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Miasto</Label>
                        <Input
                          className="h-8 mt-1"
                          value={editBuyerCity}
                          onChange={(e) => setEditBuyerCity(e.target.value)}
                          placeholder="Warszawa"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Kwota brutto (PLN)</Label>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          className="h-8 mt-1"
                          value={editAmountGross}
                          onChange={(e) => setEditAmountGross(e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Stawka VAT (%)</Label>
                        <Select value={editVatRate} onValueChange={setEditVatRate}>
                          <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">0%</SelectItem>
                            <SelectItem value="5">5%</SelectItem>
                            <SelectItem value="8">8%</SelectItem>
                            <SelectItem value="23">23%</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap items-center">
                    <Button type="button" size="sm" disabled={savingInvoice} onClick={handleSaveInvoiceMainData}>
                      {savingInvoice ? "Zapisywanie…" : "Zapisz dane faktury"}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={savingInvoice || deletingInvoice}
                      onClick={handleDeleteInvoice}
                      title="Usuń fakturę (numer będzie dostępny do ponownego użycia)"
                    >
                      {deletingInvoice ? "Usuwanie…" : "Usuń fakturę"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>Kwota brutto: <span className="font-medium text-foreground">{invoiceDetail.amountGross.toFixed(2)} PLN</span></p>
                  <p>Nabywca: {invoiceDetail.buyerName} ({invoiceDetail.buyerNip})</p>
                  {invoiceDetail.deliveryDate && (
                    <p>Data wykonania usługi: {new Date(invoiceDetail.deliveryDate).toLocaleDateString("pl-PL")}</p>
                  )}
                  <p className="text-xs">Faktury wystawionej / wysłanej do KSeF nie można edytować – użyj korekty faktury.</p>
                </div>
              )}
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
                  <Label className="text-sm">Uwagi na fakturze</Label>
                  <Textarea
                    value={invoiceNotes}
                    onChange={(e) => setInvoiceNotes(e.target.value)}
                    placeholder="Wpisz uwagi, które pojawią się na fakturze..."
                    rows={3}
                    className="text-sm"
                  />
                  <Button type="button" size="sm" disabled={savingInvoice} onClick={handleSaveInvoiceNotes}>
                    {savingInvoice ? "Zapisywanie…" : "Zapisz uwagi"}
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
