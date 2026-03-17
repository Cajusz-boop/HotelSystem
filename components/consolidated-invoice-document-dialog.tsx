"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const PAYMENT_TYPES = ["CASH", "CARD", "TRANSFER", "PREPAID", "OTHER"] as const;
const PAYMENT_LABELS: Record<string, string> = {
  CASH: "Gotówka",
  CARD: "Karta",
  TRANSFER: "Przelew",
  PREPAID: "Przedpłata",
  OTHER: "Inna",
};

export interface ConsolidatedInvoiceDocDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amountGross: number;
  invoiceNumber: string;
  onVatPdf: (amountOverride: number | null, notes: string, paymentType: string) => Promise<void>;
  onPosnetReceipt: (amount: number, notes: string, paymentType: string) => Promise<void>;
  onBoth?: (amountInvoice: number, amountReceipt: number, notes: string, paymentType: string) => Promise<void>;
  onNone: () => void;
}

function ConsolidatedInvoiceDocDialog({
  open,
  onOpenChange,
  amountGross,
  invoiceNumber,
  onVatPdf,
  onPosnetReceipt,
  onBoth,
  onNone,
}: ConsolidatedInvoiceDocDialogProps) {
  const [docAmountOverride, setDocAmountOverride] = useState("");
  const [docAmountInvoice, setDocAmountInvoice] = useState("");
  const [docAmountReceipt, setDocAmountReceipt] = useState("");
  const [invoiceNotes, setInvoiceNotes] = useState("");
  const [paymentType, setPaymentType] = useState("CASH");
  const [docIssuing, setDocIssuing] = useState(false);

  const docRoomTotal = amountGross;
  const docTotalAmount = amountGross;

  useEffect(() => {
    if (open) {
      setDocAmountOverride(amountGross > 0 ? String(amountGross.toFixed(2)) : "");
      setDocAmountInvoice(amountGross > 0 ? String(amountGross.toFixed(2)) : "");
      setDocAmountReceipt("0");
      setInvoiceNotes("");
    }
  }, [open, amountGross]);

  const effectiveAmount = (() => {
    const override = docAmountOverride.trim() ? parseFloat(docAmountOverride) : null;
    if (override != null && Number.isFinite(override) && override > 0) return Math.round(override * 100) / 100;
    return docTotalAmount ?? 0;
  })();

  const inv = parseFloat(docAmountInvoice) || 0;
  const rec = parseFloat(docAmountReceipt) || 0;
  const sum = Math.round((inv + rec) * 100) / 100;
  const canBoth = onBoth && inv > 0 && rec > 0 && effectiveAmount > 0 && Math.abs(sum - effectiveAmount) < 0.01;

  const handleChoice = async (type: "vat" | "posnet" | "both" | "none") => {
    if (type === "none") {
      onNone();
      onOpenChange(false);
      return;
    }
    setDocIssuing(true);
    try {
      if (type === "vat") {
        const amt = docAmountOverride.trim() && parseFloat(docAmountOverride) > 0 ? parseFloat(docAmountOverride) : amountGross;
        await onVatPdf(amt, invoiceNotes.trim(), paymentType);
      } else if (type === "posnet") {
        const amt = docAmountOverride.trim() && parseFloat(docAmountOverride) > 0 ? parseFloat(docAmountOverride) : amountGross;
        await onPosnetReceipt(amt, invoiceNotes.trim(), paymentType);
      } else if (type === "both" && onBoth) {
        await onBoth(inv, rec, invoiceNotes.trim(), paymentType);
      }
      onOpenChange(false);
    } finally {
      setDocIssuing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleChoice("none"); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Wystawić dokument?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Wybierz jaki dokument wystawić:</p>
        <div className="space-y-3 mt-2">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Kwota usługi hotelowej na paragonie/fakturze [PLN]</label>
            <Input
              type="number"
              min={0}
              step={0.01}
              placeholder={docRoomTotal != null ? String(docRoomTotal.toFixed(2)) : "suma z pozycji"}
              className="h-8 text-sm"
              value={docAmountOverride}
              onChange={(e) => setDocAmountOverride(e.target.value)}
            />
            {docRoomTotal != null && (
              <p className="text-[10px] text-muted-foreground mt-0.5">Aktualna suma usługi hotelowej: {docRoomTotal.toFixed(2)} PLN</p>
            )}
          </div>
          <div className="rounded border bg-muted/30 p-2 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Podział na fakturę i paragon</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground mb-0.5 block">Kwota na fakturę [PLN]</label>
                <Input type="number" min={0} step={0.01} className="h-8 text-sm" value={docAmountInvoice} onChange={(e) => setDocAmountInvoice(e.target.value)} placeholder="0" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground mb-0.5 block">Kwota na paragon [PLN]</label>
                <Input type="number" min={0} step={0.01} className="h-8 text-sm" value={docAmountReceipt} onChange={(e) => setDocAmountReceipt(e.target.value)} placeholder="0" />
              </div>
            </div>
            {(docTotalAmount != null || (docAmountOverride.trim() && parseFloat(docAmountOverride) > 0)) && (
              <p className="text-[10px] text-muted-foreground">
                Kwota do zapłaty: {effectiveAmount.toFixed(2)} PLN
                {docAmountInvoice && docAmountReceipt && (
                  Math.abs(sum - effectiveAmount) < 0.01 ? " ✓" : ` (suma ${sum.toFixed(2)} – musi być równa)`
                )}
              </p>
            )}
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Forma zapłaty (faktura i paragon)</Label>
            <Select value={paymentType} onValueChange={setPaymentType}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{PAYMENT_LABELS[t] ?? t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Uwagi na fakturze (opcjonalnie)</label>
            <Textarea
              value={invoiceNotes}
              onChange={(e) => setInvoiceNotes(e.target.value)}
              placeholder="Wpisz uwagi, które pojawią się na fakturze..."
              rows={2}
              className="text-sm"
            />
          </div>
          <div className="flex flex-col gap-2">
            {canBoth && (
              <Button variant="default" size="sm" className="h-8 text-xs justify-start" disabled={docIssuing} onClick={() => handleChoice("both")}>
                📄 Faktura ({inv.toFixed(2)} PLN) + 🧾 Paragon ({rec.toFixed(2)} PLN) — Wystaw oba
              </Button>
            )}
            <Button variant="default" size="sm" className="h-8 text-xs justify-start" disabled={docIssuing} onClick={() => handleChoice("vat")}>
              📄 Faktura VAT (PDF) — drukuj
            </Button>
            <Button variant="secondary" size="sm" className="h-8 text-xs justify-start" disabled={docIssuing} onClick={() => handleChoice("posnet")}>
              🧾 Paragon (kasa fiskalna POSNET)
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs justify-start" disabled={docIssuing} onClick={() => handleChoice("none")}>
              Bez dokumentu
            </Button>
          </div>
        </div>
        {docIssuing && <p className="text-xs text-muted-foreground mt-2">Wystawianie dokumentu…</p>}
      </DialogContent>
    </Dialog>
  );
}

export { ConsolidatedInvoiceDocDialog as ConsolidatedInvoiceDocumentDialog };
