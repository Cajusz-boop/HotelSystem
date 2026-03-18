"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { getInvoicePreviewData, updateInvoice } from "@/app/actions/finance";
import type { InvoicePreviewData } from "@/app/actions/finance";
import { lookupCompanyByNip } from "@/app/actions/companies";
import { EditableField, EditableDateField } from "@/components/finance/editable-field";
import { amountToWords } from "@/lib/amount-to-words";
import { Button } from "@/components/ui/button";
import { SendEmailDialog } from "@/components/finance/send-email-dialog";
import { Printer, FileDown, Mail, ArrowLeft, Save, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

const UNIT_OPTIONS = [
  { value: "szt.", label: "szt." },
  { value: "godz.", label: "godz." },
  { value: "doba", label: "doba" },
  { value: "os.", label: "os." },
  { value: "usł.", label: "usł." },
  { value: "km", label: "km" },
];

const VAT_OPTIONS = [
  { value: "5", label: "5" },
  { value: "8", label: "8" },
  { value: "23", label: "23" },
  { value: "0", label: "zw." },
];

const DOCUMENT_VARIANTS = [
  { value: "oryginał", label: "oryginał" },
  { value: "kopia", label: "kopia" },
  { value: "duplikat", label: "duplikat" },
];

const PAYMENT_OPTIONS = [
  { value: "Przelew", label: "Przelew" },
  { value: "Gotówka", label: "Gotówka" },
  { value: "Karta płatnicza", label: "Karta płatnicza" },
  { value: "BLIK", label: "BLIK" },
];

const DEFAULT_SELLER = {
  sellerName: "Karczma Łabędź Łukasz Wojenkowski",
  sellerAddress: "ul. Marsa 2",
  sellerPostalCity: "14-200 Nowa Wieś",
  sellerNip: "5711640854",
  sellerPhone: "604 070 908",
  sellerEmail: "recepcja@labedzhotel.pl",
  sellerBankName: "Alior Bank",
  sellerBankAccount: "64 2490 0005 0000 4530 3746 8866",
};

/** Id faktur, dla których auto-druk już się wykonał (przetrwa remount w Strict Mode — unikamy podwójnego druku). */
const autoPrintDoneIds = new Set<string>();

export interface EditableLineItem {
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  netAmount: number;
  vatRate: number;
  vatAmount: number;
  grossAmount: number;
}

function parseDdMmYyyyToYyyyMmDd(s: string): string {
  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return "";
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function calcFromNet(net: number, vatRate: number) {
  const vat = vatRate === 0 ? 0 : round2(net * (vatRate / 100));
  const gross = round2(net + vat);
  return { net, vat, gross };
}

function calcFromGross(gross: number, vatRate: number) {
  if (vatRate === 0) return { net: round2(gross), vat: 0, gross };
  const net = round2(gross / (1 + vatRate / 100));
  const vat = round2(gross - net);
  return { net, vat, gross };
}

export interface InvoicePreviewPageProps {
  id: string;
  autoPrint?: boolean;
}

export function InvoicePreviewPage({ id, autoPrint }: InvoicePreviewPageProps) {
  const [data, setData] = useState<InvoicePreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [nipLookupLoading, setNipLookupLoading] = useState(false);

  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [documentVariant, setDocumentVariant] = useState("oryginał");
  const [placeOfIssue, setPlaceOfIssue] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [buyerNip, setBuyerNip] = useState("");
  const [buyerAddress, setBuyerAddress] = useState("");
  const [buyerPostalCode, setBuyerPostalCode] = useState("");
  const [buyerCity, setBuyerCity] = useState("");
  const [placeOfIssueRight, setPlaceOfIssueRight] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentDays, setPaymentDays] = useState("");
  const [notes, setNotes] = useState("");
  const [footerText, setFooterText] = useState("");
  const [thanksText, setThanksText] = useState("");

  const [sellerName, setSellerName] = useState("");
  const [sellerAddress, setSellerAddress] = useState("");
  const [sellerPostalCity, setSellerPostalCity] = useState("");
  const [sellerNip, setSellerNip] = useState("");
  const [sellerPhone, setSellerPhone] = useState("");
  const [sellerEmail, setSellerEmail] = useState("");
  const [sellerBank, setSellerBank] = useState("");
  const [sellerAccount, setSellerAccount] = useState("");

  const [lineItems, setLineItems] = useState<EditableLineItem[]>([]);

  const loadData = useCallback(() => {
    getInvoicePreviewData(id).then((r) => {
      if (r.success && r.data) {
        const d = r.data;
        setData(d);
        setInvoiceNumber(d.invoice.number);
        setPlaceOfIssue(d.placeOfIssue ?? "");
        setPlaceOfIssueRight(d.placeOfIssue ?? "");
        setIssueDate(d.issueDate ? parseDdMmYyyyToYyyyMmDd(d.issueDate) : "");
        setDeliveryDate(d.deliveryDate ? parseDdMmYyyyToYyyyMmDd(d.deliveryDate) : "");
        setBuyerName(d.buyerName);
        setBuyerNip(d.buyerNip ?? "");
        setBuyerAddress(d.buyerAddress ?? "");
        setBuyerPostalCode(d.invoice.buyerPostalCode ?? "");
        setBuyerCity(d.invoice.buyerCity ?? "");
        setPaymentMethod(d.paymentMethod);
        setPaymentDays(String(d.paymentDays));
        setNotes(d.notes ?? "");
        setFooterText(d.footerText ?? "Dziękujemy za skorzystanie z naszych usług.");
        setThanksText(d.thanksText ?? "Zapraszamy ponownie!");
        setSellerName(d.sellerName || DEFAULT_SELLER.sellerName);
        setSellerAddress(d.sellerAddress ?? DEFAULT_SELLER.sellerAddress);
        setSellerPostalCity(d.sellerPostalCity || DEFAULT_SELLER.sellerPostalCity);
        setSellerNip(d.sellerNip ?? DEFAULT_SELLER.sellerNip);
        setSellerPhone(d.sellerPhone ?? DEFAULT_SELLER.sellerPhone);
        setSellerEmail(d.sellerEmail ?? DEFAULT_SELLER.sellerEmail);
        const bankParts = (d.bankLine ?? "").split("\n");
        setSellerBank(bankParts[0] ?? DEFAULT_SELLER.sellerBankName);
        setSellerAccount(bankParts[1] ?? DEFAULT_SELLER.sellerBankAccount);
        setLineItems(
          d.lineItems.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
            netAmount: item.netAmount,
            vatRate: typeof item.vatRate === "string" && item.vatRate === "zw." ? 0 : Number(item.vatRate) || 0,
            vatAmount: item.vatAmount,
            grossAmount: item.grossAmount,
          }))
        );
      } else if (!r.success) {
        setError(r.error ?? "Błąd ładowania danych");
      }
      setLoading(false);
    });
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateLineItem = (idx: number, patch: Partial<EditableLineItem>) => {
    setLineItems((prev) => {
      const next = [...prev];
      const item = { ...next[idx], ...patch };
      const vatRate = item.vatRate;
      const qty = item.quantity > 0 ? item.quantity : 1;
      if ("grossAmount" in patch && patch.grossAmount != null) {
        const { net, vat, gross } = calcFromGross(Number(patch.grossAmount), vatRate);
        item.netAmount = net;
        item.vatAmount = vat;
        item.grossAmount = gross;
        item.unitPrice = round2(net / qty);
      } else if ("quantity" in patch || "unitPrice" in patch) {
        const q = "quantity" in patch ? patch.quantity : item.quantity;
        const up = "unitPrice" in patch ? patch.unitPrice : item.unitPrice;
        const net = round2((q ?? item.quantity) * (up ?? item.unitPrice));
        const { vat, gross } = calcFromNet(net, vatRate);
        item.quantity = q ?? item.quantity;
        item.unitPrice = up ?? item.unitPrice;
        item.netAmount = net;
        item.vatAmount = vat;
        item.grossAmount = gross;
      } else if ("vatRate" in patch) {
        const vatPct = patch.vatRate ?? item.vatRate;
        item.vatRate = vatPct;
        const net = item.netAmount;
        const { vat, gross } = calcFromNet(net, vatPct);
        item.vatAmount = vat;
        item.grossAmount = gross;
      }
      next[idx] = item;
      return next;
    });
  };

  const addLineItem = () => {
    const last = lineItems[lineItems.length - 1];
    const vatRate = last?.vatRate ?? 8;
    setLineItems((prev) => [
      ...prev,
      {
        name: "",
        quantity: 1,
        unit: "szt.",
        unitPrice: 0,
        netAmount: 0,
        vatRate,
        vatAmount: 0,
        grossAmount: 0,
      },
    ]);
  };

  const removeLineItem = (idx: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const { totalNet, totalVat, totalGross, vatSummary } = (() => {
    let tn = 0,
      tv = 0,
      tg = 0;
    const byVat: Record<string, { net: number; vat: number; gross: number }> = {};
    for (const li of lineItems) {
      tn += li.netAmount;
      tv += li.vatAmount;
      tg += li.grossAmount;
      const k = li.vatRate === 0 ? "zw." : String(li.vatRate);
      if (!byVat[k]) byVat[k] = { net: 0, vat: 0, gross: 0 };
      byVat[k].net += li.netAmount;
      byVat[k].vat += li.vatAmount;
      byVat[k].gross += li.grossAmount;
    }
    for (const k of Object.keys(byVat)) {
      byVat[k] = {
        net: round2(byVat[k].net),
        vat: round2(byVat[k].vat),
        gross: round2(byVat[k].gross),
      };
    }
    return {
      totalNet: round2(tn),
      totalVat: round2(tv),
      totalGross: round2(tg),
      vatSummary: byVat,
    };
  })();

  const dueDateStr = (() => {
    if (!issueDate) return "";
    const d = new Date(issueDate + "T12:00:00");
    const days = parseInt(paymentDays, 10) || 0;
    d.setDate(d.getDate() + days);
    return d.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });
  })();

  const displayToCode: Record<string, string> = {
    Gotówka: "CASH",
    Przelew: "TRANSFER",
    "Karta płatnicza": "CARD",
    BLIK: "BLIK",
    Voucher: "VOUCHER",
    Przedpłata: "PREPAID",
    "Płatność mieszana": "SPLIT",
    Inna: "OTHER",
  };

  const buildPayload = useCallback((): Parameters<typeof updateInvoice>[1] => {
    const payload: Parameters<typeof updateInvoice>[1] = {};
    if (!data) return payload;
    if (invoiceNumber !== data.invoice.number) payload.number = invoiceNumber.trim();
    if (buyerName !== data.buyerName) payload.buyerName = buyerName.trim();
    if (buyerAddress !== (data.buyerAddress ?? "")) payload.buyerAddress = buyerAddress.trim() || null;
    if (buyerPostalCode !== (data.invoice.buyerPostalCode ?? ""))
      payload.buyerPostalCode = buyerPostalCode.trim() || null;
    if (buyerCity !== (data.invoice.buyerCity ?? "")) payload.buyerCity = buyerCity.trim() || null;
    if (buyerNip !== data.buyerNip) payload.buyerNip = buyerNip.trim();
    const placeVal = placeOfIssue || placeOfIssueRight;
    if (placeVal !== (data.placeOfIssue ?? "")) payload.placeOfIssue = placeVal.trim() || null;
    const origIssue = data.issueDate ? parseDdMmYyyyToYyyyMmDd(data.issueDate) : "";
    if (issueDate && issueDate !== origIssue) payload.issuedAt = new Date(issueDate + "T12:00:00");
    const origDel = data.deliveryDate ? parseDdMmYyyyToYyyyMmDd(data.deliveryDate) : "";
    if (deliveryDate !== origDel) payload.deliveryDate = deliveryDate ? new Date(deliveryDate + "T12:00:00") : null;
    const pmCode = displayToCode[paymentMethod] ?? paymentMethod;
    if (paymentMethod !== data.paymentMethod && pmCode) payload.paymentMethod = pmCode;
    const pd = parseInt(paymentDays, 10);
    if (!Number.isNaN(pd) && pd >= 0 && pd !== data.paymentDays) payload.paymentDays = pd;
    if (notes !== (data.notes ?? "")) payload.notes = notes.trim() || null;

    const sellerChanged =
      sellerName !== (data.sellerName ?? "") ||
      sellerAddress !== (data.sellerAddress ?? "") ||
      sellerPostalCity !== (data.sellerPostalCity ?? "") ||
      sellerNip !== (data.sellerNip ?? "") ||
      sellerPhone !== (data.sellerPhone ?? "") ||
      sellerEmail !== (data.sellerEmail ?? "");
    const bankLine = [sellerBank, sellerAccount].filter(Boolean).join("\n");
    const dataBank = data.bankLine ?? "";
    if (sellerChanged || bankLine !== dataBank) {
      payload.sellerOverride = {
        sellerName: sellerName || undefined,
        sellerAddress: sellerAddress || undefined,
        sellerPostalCity: sellerPostalCity || undefined,
        sellerNip: sellerNip || undefined,
        sellerPhone: sellerPhone || undefined,
        sellerEmail: sellerEmail || undefined,
        sellerBankName: sellerBank || undefined,
        sellerBankAccount: sellerAccount || undefined,
      };
    }

    const footOrig = data.footerText ?? "Dziękujemy za skorzystanie z naszych usług.";
    const thanksOrig = data.thanksText ?? "Zapraszamy ponownie!";
    if (footerText !== footOrig || thanksText !== thanksOrig) {
      payload.documentOverrides = { footerText: footerText || undefined, thanksText: thanksText || undefined };
    }

    const lineItemsChanged =
      lineItems.length !== data.lineItems.length ||
      lineItems.some(
        (li, i) =>
          li.name !== data.lineItems[i]?.name ||
          li.quantity !== data.lineItems[i]?.quantity ||
          li.unit !== data.lineItems[i]?.unit ||
          Math.abs(li.unitPrice - (data.lineItems[i]?.unitPrice ?? 0)) > 0.001 ||
          Math.abs(li.grossAmount - (data.lineItems[i]?.grossAmount ?? 0)) > 0.001 ||
          li.vatRate !== (typeof data.lineItems[i]?.vatRate === "string" ? 0 : data.lineItems[i]?.vatRate ?? 0)
      );
    if (lineItemsChanged) {
      payload.lineItems = lineItems
        .filter((li) => li.name.trim())
        .map((li) => ({
          description: li.name.trim(),
          quantity: li.quantity,
          unit: li.unit,
          unitPrice: li.unitPrice,
          vatRate: li.vatRate,
          amountNet: li.netAmount,
          amountVat: li.vatAmount,
          amountGross: li.grossAmount,
        }));
      if (payload.lineItems && payload.lineItems.length > 0) {
        payload.amountNet = totalNet;
        payload.amountVat = totalVat;
        payload.amountGross = totalGross;
      }
    }

    return payload;
  }, [
    data,
    invoiceNumber,
    buyerName,
    buyerAddress,
    buyerPostalCode,
    buyerCity,
    buyerNip,
    placeOfIssue,
    placeOfIssueRight,
    issueDate,
    deliveryDate,
    paymentMethod,
    paymentDays,
    notes,
    sellerName,
    sellerAddress,
    sellerPostalCity,
    sellerNip,
    sellerPhone,
    sellerEmail,
    sellerBank,
    sellerAccount,
    footerText,
    thanksText,
    lineItems,
    totalNet,
    totalVat,
    totalGross,
  ]);

  const hasUnsavedChanges = buildPayload() && Object.keys(buildPayload()).length > 0;

  const performSave = useCallback(async () => {
    const payload = buildPayload();
    if (Object.keys(payload).length === 0) return true;
    setBusy(true);
    try {
      const res = await updateInvoice(id, payload);
      if (!res.success) {
        toast.error(res.error ?? "Błąd zapisu");
        return false;
      }
      toast.success("Faktura zapisana");
      loadData();
      return true;
    } finally {
      setBusy(false);
    }
  }, [id, buildPayload, loadData]);

  const saveAndThen = useCallback(
    async (action: () => void) => {
      const ok = await performSave();
      if (ok) action();
    },
    [performSave]
  );

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedChanges]);

  const handlePrint = useCallback(
    () =>
      saveAndThen(() => {
        const iframe = document.createElement("iframe");
        iframe.style.cssText = "position:absolute;left:-9999px;width:210mm;height:297mm;border:none";
        iframe.src = `/api/finance/invoice/${id}/pdf`;
        document.body.appendChild(iframe);
        iframe.addEventListener("load", () => {
          setTimeout(() => {
            iframe.contentWindow?.print();
            setTimeout(() => {
              if (iframe.parentNode) document.body.removeChild(iframe);
            }, 2000);
          }, 1800);
        });
      }),
    [id, saveAndThen]
  );

  useEffect(() => {
    if (!autoPrint || loading || !data) return;
    if (autoPrintDoneIds.has(id)) return;
    autoPrintDoneIds.add(id);
    handlePrint();
  }, [autoPrint, loading, data, id, handlePrint]);

  const handlePdf = () => {
    let url = `/api/finance/invoice/${id}/pdf?format=pdf`;
    const override = data?.amountOverride;
    if (override != null && Number.isFinite(override)) {
      url += `&amountOverride=${encodeURIComponent(override)}`;
    }
    saveAndThen(() => window.open(url, "_blank", "noopener,noreferrer"));
  };

  const handleNipLookup = async () => {
    const trimmed = buyerNip.replace(/\s/g, "");
    if (!trimmed) {
      toast.error("Podaj NIP");
      return;
    }
    setNipLookupLoading(true);
    try {
      const res = await lookupCompanyByNip(trimmed);
      if (res.success && res.data) {
        const d = res.data;
        setBuyerName(d.name ?? "");
        setBuyerAddress(d.address ?? "");
        setBuyerPostalCode(d.postalCode ?? "");
        setBuyerCity(d.city ?? "");
        setBuyerNip(d.nip ?? trimmed);
        toast.success("Dane pobrane z GUS");
      } else {
        toast.error(res.success === false ? res.error : "Nie udało się pobrać danych");
      }
    } finally {
      setNipLookupLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-muted-foreground">Ładowanie…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8">
        <p className="text-destructive">{error ?? "Brak danych faktury"}</p>
        <Link href="/finance">
          <Button variant="outline" className="mt-4">
            Powrót
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen invoice-preview-root">
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .invoice-preview-root [data-editable]:hover { background: none !important; outline: none !important; }
        .invoice-preview-root input, .invoice-preview-root select, .invoice-preview-root textarea {
          border: none !important; background: none !important; outline: none !important; padding: 0 !important;
        }
        @media print {
          .toolbar { display: none !important; }
          body { margin: 0; }
          .page-break-after, [style*="page-break-after: always"] { page-break-after: always !important; }
        }
      `,
        }}
      />
      {(
        <div className="print:hidden toolbar flex items-center gap-2 border-b bg-muted/30 px-6 py-3">
          <Button
            variant={hasUnsavedChanges ? "default" : "outline"}
            size="sm"
            onClick={() => performSave()}
            disabled={busy}
          >
            <Save className="mr-2 h-4 w-4" />
            Zapisz
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint} disabled={busy}>
            <Printer className="mr-2 h-4 w-4" />
            Drukuj
          </Button>
          <Button variant="outline" size="sm" onClick={handlePdf} disabled={busy}>
            <FileDown className="mr-2 h-4 w-4" />
            Pobierz PDF
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEmailDialogOpen(true)} disabled={busy}>
            <Mail className="mr-2 h-4 w-4" />
            Wyślij na email
          </Button>
          <Button variant="ghost" size="sm" onClick={() => (hasUnsavedChanges ? (window.confirm("Masz niezapisane zmiany. Czy na pewno chcesz wyjść?") ? window.history.back() : null) : window.history.back())}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Powrót
          </Button>
        </div>
      )}

      <div className="flex-1 p-6 max-w-4xl mx-auto">
        <InvoicePreviewContent
          variant="original"
          data={data}
          editable
            invoiceNumber={invoiceNumber}
            setInvoiceNumber={setInvoiceNumber}
            documentVariant={documentVariant}
            setDocumentVariant={setDocumentVariant}
            placeOfIssue={placeOfIssueRight}
            setPlaceOfIssue={setPlaceOfIssueRight}
            issueDate={issueDate}
            setIssueDate={setIssueDate}
            deliveryDate={deliveryDate}
            setDeliveryDate={setDeliveryDate}
            buyerName={buyerName}
            setBuyerName={setBuyerName}
            buyerNip={buyerNip}
            setBuyerNip={setBuyerNip}
            buyerAddress={buyerAddress}
            setBuyerAddress={setBuyerAddress}
            buyerPostalCode={buyerPostalCode}
            setBuyerPostalCode={setBuyerPostalCode}
            buyerCity={buyerCity}
            setBuyerCity={setBuyerCity}
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
            paymentDays={paymentDays}
            setPaymentDays={setPaymentDays}
            notes={notes}
            setNotes={setNotes}
            footerText={footerText}
            setFooterText={setFooterText}
            thanksText={thanksText}
            setThanksText={setThanksText}
            sellerName={sellerName}
            setSellerName={setSellerName}
            sellerAddress={sellerAddress}
            setSellerAddress={setSellerAddress}
            sellerPostalCity={sellerPostalCity}
            setSellerPostalCity={setSellerPostalCity}
            sellerNip={sellerNip}
            setSellerNip={setSellerNip}
            sellerPhone={sellerPhone}
            setSellerPhone={setSellerPhone}
            sellerEmail={sellerEmail}
            setSellerEmail={setSellerEmail}
            sellerBank={sellerBank}
            setSellerBank={setSellerBank}
            sellerAccount={sellerAccount}
            setSellerAccount={setSellerAccount}
            lineItems={lineItems}
            updateLineItem={updateLineItem}
            addLineItem={addLineItem}
            removeLineItem={removeLineItem}
            totalNet={totalNet}
            totalVat={totalVat}
            totalGross={totalGross}
            vatSummary={vatSummary}
            dueDateStr={dueDateStr}
          nipLookupLoading={nipLookupLoading}
          onNipLookup={handleNipLookup}
        />
      </div>

      <SendEmailDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        documentType="invoice"
        documentId={id}
        documentNumber={data.invoice.number}
        amountGross={data.finalGross}
        defaultEmail={data.guestEmail ?? ""}
        amountOverride={data.amountOverride}
        onBeforeSend={async () => {
          const ok = await performSave();
          return ok;
        }}
      />
    </div>
  );
}

interface InvoicePreviewContentProps {
  variant: "original" | "copy";
  data: InvoicePreviewData;
  invoiceNumber: string;
  setInvoiceNumber: (v: string) => void;
  documentVariant: string;
  setDocumentVariant: (v: string) => void;
  placeOfIssue: string;
  setPlaceOfIssue: (v: string) => void;
  issueDate: string;
  setIssueDate: (v: string) => void;
  deliveryDate: string;
  setDeliveryDate: (v: string) => void;
  buyerName: string;
  setBuyerName: (v: string) => void;
  buyerNip: string;
  setBuyerNip: (v: string) => void;
  buyerAddress: string;
  setBuyerAddress: (v: string) => void;
  buyerPostalCode: string;
  setBuyerPostalCode: (v: string) => void;
  buyerCity: string;
  setBuyerCity: (v: string) => void;
  paymentMethod: string;
  setPaymentMethod: (v: string) => void;
  paymentDays: string;
  setPaymentDays: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  footerText: string;
  setFooterText: (v: string) => void;
  thanksText: string;
  setThanksText: (v: string) => void;
  sellerName: string;
  setSellerName: (v: string) => void;
  sellerAddress: string;
  setSellerAddress: (v: string) => void;
  sellerPostalCity: string;
  setSellerPostalCity: (v: string) => void;
  sellerNip: string;
  setSellerNip: (v: string) => void;
  sellerPhone: string;
  setSellerPhone: (v: string) => void;
  sellerEmail: string;
  setSellerEmail: (v: string) => void;
  sellerBank: string;
  setSellerBank: (v: string) => void;
  sellerAccount: string;
  setSellerAccount: (v: string) => void;
  lineItems: EditableLineItem[];
  updateLineItem: (idx: number, patch: Partial<EditableLineItem>) => void;
  addLineItem: () => void;
  removeLineItem: (idx: number) => void;
  totalNet: number;
  totalVat: number;
  totalGross: number;
  vatSummary: Record<string, { net: number; vat: number; gross: number }>;
  dueDateStr: string;
  nipLookupLoading: boolean;
  onNipLookup: () => void;
  editable: boolean;
}

function InvoicePreviewContent({
  variant,
  data,
  invoiceNumber,
  setInvoiceNumber,
  documentVariant,
  setDocumentVariant,
  placeOfIssue,
  setPlaceOfIssue,
  issueDate,
  setIssueDate,
  deliveryDate,
  setDeliveryDate,
  buyerName,
  setBuyerName,
  buyerNip,
  setBuyerNip,
  buyerAddress,
  setBuyerAddress,
  buyerPostalCode,
  setBuyerPostalCode,
  buyerCity,
  setBuyerCity,
  paymentMethod,
  setPaymentMethod,
  paymentDays,
  setPaymentDays,
  notes,
  setNotes,
  footerText,
  setFooterText,
  thanksText,
  setThanksText,
  sellerName,
  setSellerName,
  sellerAddress,
  setSellerAddress,
  sellerPostalCity,
  setSellerPostalCity,
  sellerNip,
  setSellerNip,
  sellerPhone,
  setSellerPhone,
  sellerEmail,
  setSellerEmail,
  sellerBank,
  setSellerBank,
  sellerAccount,
  setSellerAccount,
  lineItems,
  updateLineItem,
  addLineItem,
  removeLineItem,
  totalNet,
  totalVat,
  totalGross,
  vatSummary,
  dueDateStr,
  nipLookupLoading,
  onNipLookup,
  editable,
}: InvoicePreviewContentProps) {
  const variantLabel = variant === "copy" ? "kopia" : documentVariant;
  const receiverLines = data.receiverName ? [data.receiverName, data.receiverAddress, data.receiverPostalCity].filter(Boolean) : [];

  const datesTopHtml = !data.isConsolidated && (
    <div className="text-right space-y-0.5 text-sm">
      <p className="mb-0">
        <strong>Miejsce wystawienia:</strong>{" "}
        {editable ? (
          <EditableField value={placeOfIssue} onChange={setPlaceOfIssue} className="inline" />
        ) : (
          placeOfIssue || "—"
        )}
      </p>
      <p className="mb-0">
        <strong>Data dostawy/wykonania usługi:</strong>{" "}
        {editable ? (
          <EditableDateField value={deliveryDate} onChange={setDeliveryDate} displayValue={data.deliveryDate} />
        ) : (
          data.deliveryDate || "—"
        )}
      </p>
      <p className="mb-0">
        <strong>Data wystawienia:</strong>{" "}
        {editable ? (
          <EditableDateField value={issueDate} onChange={setIssueDate} displayValue={data.issueDate} />
        ) : (
          data.issueDate || "—"
        )}
      </p>
    </div>
  );

  const datesBelowH1 = data.isConsolidated && (
    <div className="mb-4 text-sm">
      <p className="mb-0">
        <strong>Miejsce wystawienia:</strong>{" "}
        {editable ? <EditableField value={placeOfIssue} onChange={setPlaceOfIssue} /> : placeOfIssue || "—"}
      </p>
      <p className="mb-0">
        <strong>Data dostawy/wykonania usługi:</strong>{" "}
        {editable ? (
          <EditableDateField value={deliveryDate} onChange={setDeliveryDate} displayValue={data.deliveryDate} />
        ) : (
          data.deliveryDate || "—"
        )}
      </p>
      <p className="mb-0">
        <strong>Data wystawienia:</strong>{" "}
        {editable ? (
          <EditableDateField value={issueDate} onChange={setIssueDate} displayValue={data.issueDate} />
        ) : (
          data.issueDate || "—"
        )}
      </p>
    </div>
  );

  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm text-sm max-w-[900px]">
      <div className="flex justify-between items-start gap-6 mb-4">
        <div className="text-xs leading-snug space-y-0.5">
          {data.logoBase64 && (
            <div
              className="mb-2"
              style={{ textAlign: (data.logoPosition === "center" ? "center" : data.logoPosition === "right" ? "right" : "left") as "left" | "center" | "right" }}
            >
              <img src={`data:image/png;base64,${data.logoBase64}`} alt="Logo" style={{ maxWidth: data.logoWidth }} className="h-auto" />
            </div>
          )}
          {data.logoUrl && !data.logoBase64 && (
            <div
              className="mb-2"
              style={{ textAlign: (data.logoPosition === "center" ? "center" : data.logoPosition === "right" ? "right" : "left") as "left" | "center" | "right" }}
            >
              <img src={data.logoUrl} alt="Logo" style={{ maxWidth: data.logoWidth }} className="h-auto" />
            </div>
          )}
          {editable ? (
            <>
              <p className="mb-0 font-medium">
                <EditableField value={sellerName} onChange={setSellerName} className="inline" />
              </p>
              <p className="mb-0">
                <EditableField value={sellerAddress} onChange={setSellerAddress} className="inline" />
              </p>
              <p className="mb-0">
                <EditableField value={sellerPostalCity} onChange={setSellerPostalCity} className="inline" />
              </p>
              {sellerNip && (
                <p className="mb-0">
                  NIP: <EditableField value={sellerNip} onChange={setSellerNip} className="inline" />
                </p>
              )}
              {sellerPhone && (
                <p className="mb-0">
                  Tel: <EditableField value={sellerPhone} onChange={setSellerPhone} className="inline" />
                </p>
              )}
              {sellerEmail && (
                <p className="mb-0">
                  e-mail: <EditableField value={sellerEmail} onChange={setSellerEmail} className="inline" />
                </p>
              )}
              {(sellerBank || sellerAccount) && (
                <p className="mb-0 mt-1 whitespace-pre-line">
                  <EditableField value={sellerBank} onChange={setSellerBank} className="block" />
                  <EditableField value={sellerAccount} onChange={setSellerAccount} className="block" />
                </p>
              )}
            </>
          ) : (
            <>
              <p className="mb-0 font-medium">{sellerName}</p>
              {sellerAddress && <p className="mb-0">{sellerAddress}</p>}
              {sellerPostalCity && <p className="mb-0">{sellerPostalCity}</p>}
              {sellerNip && <p className="mb-0">NIP: {sellerNip}</p>}
              {sellerPhone && <p className="mb-0">Tel: {sellerPhone}</p>}
              {sellerEmail && <p className="mb-0">e-mail: {sellerEmail}</p>}
              {(sellerBank || sellerAccount) && (
                <p className="mb-0 mt-1 whitespace-pre-line">
                  {sellerBank}
                  {sellerBank && sellerAccount && "\n"}
                  {sellerAccount}
                </p>
              )}
            </>
          )}
        </div>
        <div>{datesTopHtml}</div>
      </div>

      <h1 className="text-lg font-semibold text-center mb-2">
        {data.docLabel}{" "}
        {editable ? (
          <EditableField value={invoiceNumber} onChange={setInvoiceNumber} className="inline" />
        ) : (
          invoiceNumber
        )}{" "}
        {editable ? (
          <EditableField
            value={variantLabel}
            onChange={setDocumentVariant}
            type="select"
            options={DOCUMENT_VARIANTS}
          />
        ) : (
          variantLabel
        )}
      </h1>
      {datesBelowH1}
      {data.headerText && <div className="bg-muted/50 p-2 text-xs mb-3 whitespace-pre-line">{data.headerText}</div>}

      <div className="flex gap-4 my-4 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <div className="font-semibold text-xs text-muted-foreground mb-1">Sprzedawca</div>
          <div className="border border-border rounded p-2 min-h-[80px] text-sm">
            {editable ? (
              <>
                <p className="mb-0">
                  <EditableField value={sellerName} onChange={setSellerName} className="block font-medium" />
                </p>
                <p className="mb-0">
                  <EditableField value={sellerAddress} onChange={setSellerAddress} className="block" />
                </p>
                <p className="mb-0">
                  <EditableField value={sellerPostalCity} onChange={setSellerPostalCity} className="block" />
                </p>
                {sellerNip && (
                  <p className="mb-0">
                    NIP: <EditableField value={sellerNip} onChange={setSellerNip} className="inline" />
                  </p>
                )}
                {sellerPhone && (
                  <p className="mb-0">
                    Tel: <EditableField value={sellerPhone} onChange={setSellerPhone} className="inline" />
                  </p>
                )}
                {sellerEmail && (
                  <p className="mb-0">
                    e-mail: <EditableField value={sellerEmail} onChange={setSellerEmail} className="inline" />
                  </p>
                )}
                {(sellerBank || sellerAccount) && (
                  <p className="mb-0 mt-1">
                    <EditableField value={sellerBank} onChange={setSellerBank} className="block" />
                    <EditableField value={sellerAccount} onChange={setSellerAccount} className="block" />
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="mb-0 font-medium">{sellerName}</p>
                {sellerAddress && <p className="mb-0">{sellerAddress}</p>}
                {sellerPostalCity && <p className="mb-0">{sellerPostalCity}</p>}
                {sellerNip && <p className="mb-0">NIP: {sellerNip}</p>}
                {sellerPhone && <p className="mb-0">Tel: {sellerPhone}</p>}
                {sellerEmail && <p className="mb-0">e-mail: {sellerEmail}</p>}
                {(sellerBank || sellerAccount) && (
                  <p className="mb-0 mt-1 whitespace-pre-line">
                    {sellerBank}
                    {sellerBank && sellerAccount && "\n"}
                    {sellerAccount}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
        <div className="flex-1 min-w-[200px]">
          <div className="font-semibold text-xs text-muted-foreground mb-1">Nabywca</div>
          <div className="border border-border rounded p-2 min-h-[80px] text-sm">
            <p className="mb-0">
              <EditableField value={buyerName} onChange={setBuyerName} className="block font-medium" />
            </p>
            <p className="mb-0 flex items-center gap-1">
              NIP: <EditableField value={buyerNip} onChange={setBuyerNip} className="inline flex-1" />
              {editable && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={onNipLookup}
                  disabled={nipLookupLoading}
                >
                    {nipLookupLoading ? "…" : "Pobierz dane"}
                </Button>
              )}
            </p>
            <p className="mb-0">
              <EditableField value={buyerAddress} onChange={setBuyerAddress} className="block" multiline />
            </p>
            <p className="mb-0">
              <EditableField value={buyerPostalCode} onChange={setBuyerPostalCode} className="inline w-16" />{" "}
              <EditableField value={buyerCity} onChange={setBuyerCity} className="inline" />
            </p>
          </div>
        </div>
        {receiverLines.length > 0 && (
          <div className="flex-1 min-w-[200px]">
            <div className="font-semibold text-xs text-muted-foreground mb-1">Odbiorca</div>
            <div className="border border-border rounded p-2 min-h-[80px] text-sm">
              {receiverLines.map((l, i) => (
                <p key={i} className="mb-0">
                  {l}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>

      <table className="w-full border-collapse border border-border text-xs my-3">
        <thead>
          <tr className="bg-muted/50">
            <th className="border border-border p-1.5 text-center w-8">Lp.</th>
            <th className="border border-border p-1.5 text-left">Nazwa towaru/usługi (SWW/KU)</th>
            {data.showPkwiu && <th className="border border-border p-1.5 text-left">PKWIU</th>}
            <th className="border border-border p-1.5 text-right">Ilość</th>
            {data.showUnit && <th className="border border-border p-1.5 text-left">j.m.</th>}
            <th className="border border-border p-1.5 text-right">Cena netto</th>
            <th className="border border-border p-1.5 text-right">Wartość netto</th>
            <th className="border border-border p-1.5 text-right">VAT (%)</th>
            <th className="border border-border p-1.5 text-right">Wartość VAT</th>
            <th className="border border-border p-1.5 text-right">Wartość brutto</th>
            {editable && <th className="border border-border p-1.5 w-8"></th>}
          </tr>
        </thead>
        <tbody>
          {lineItems.map((item, idx) => (
            <tr key={idx}>
              <td className="border border-border p-1.5 text-center">{idx + 1}</td>
              <td className="border border-border p-1.5">
                {editable ? (
                  <EditableField value={item.name} onChange={(v) => updateLineItem(idx, { name: v })} className="block" />
                ) : (
                  item.name || "—"
                )}
              </td>
              {data.showPkwiu && <td className="border border-border p-1.5">55.10.10.0</td>}
              <td className="border border-border p-1.5 text-right">
                {editable ? (
                  <EditableField
                    value={item.quantity}
                    onChange={(v) => updateLineItem(idx, { quantity: parseFloat(v) || 0 })}
                    type="number"
                    className="inline w-14 text-right"
                  />
                ) : (
                  item.quantity
                )}
              </td>
              {data.showUnit && (
                <td className="border border-border p-1.5">
                  {editable ? (
                    <EditableField
                      value={item.unit}
                      onChange={(v) => updateLineItem(idx, { unit: v })}
                      type="select"
                      options={UNIT_OPTIONS}
                      className="inline"
                    />
                  ) : (
                    item.unit
                  )}
                </td>
              )}
              <td className="border border-border p-1.5 text-right">
                {editable ? (
                  <EditableField
                    value={item.unitPrice}
                    onChange={(v) => updateLineItem(idx, { unitPrice: parseFloat(v) || 0 })}
                    type="number"
                    className="inline w-16 text-right"
                  />
                ) : (
                  item.unitPrice.toFixed(2)
                )}
              </td>
              <td className="border border-border p-1.5 text-right">{item.netAmount.toFixed(2)}</td>
              <td className="border border-border p-1.5 text-right">
                {editable ? (
                  <EditableField
                    value={String(item.vatRate)}
                    onChange={(v) => updateLineItem(idx, { vatRate: parseFloat(v) || 0 })}
                    type="select"
                    options={VAT_OPTIONS}
                    className="inline"
                  />
                ) : item.vatRate === 0 ? (
                  "zw."
                ) : (
                  item.vatRate
                )}
              </td>
              <td className="border border-border p-1.5 text-right">{item.vatAmount.toFixed(2)}</td>
              <td className="border border-border p-1.5 text-right">
                {editable ? (
                  <EditableField
                    value={item.grossAmount}
                    onChange={(v) => updateLineItem(idx, { grossAmount: parseFloat(v) || 0 })}
                    type="number"
                    className="inline w-16 text-right"
                  />
                ) : (
                  item.grossAmount.toFixed(2)
                )}
              </td>
              {editable && (
                <td className="border border-border p-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                    onClick={() => removeLineItem(idx)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {editable && (
        <Button type="button" variant="outline" size="sm" className="mb-3" onClick={addLineItem}>
          <Plus className="mr-2 h-4 w-4" />
          Dodaj pozycję
        </Button>
      )}

      <table className="w-auto ml-auto border-collapse border border-border text-xs my-3">
        <thead>
          <tr className="bg-muted/50">
            <th className="border border-border p-1 text-left">Stawka VAT</th>
            <th className="border border-border p-1 text-right">Wartość netto</th>
            <th className="border border-border p-1 text-right">Wartość VAT</th>
            <th className="border border-border p-1 text-right">Wartość brutto</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(vatSummary).map(([rate, row]) => (
            <tr key={rate}>
              <td className="border border-border p-1 text-center">{rate === "zw." ? "zw." : rate + "%"}</td>
              <td className="border border-border p-1 text-right">{row.net.toFixed(2)}</td>
              <td className="border border-border p-1 text-right">{row.vat.toFixed(2)}</td>
              <td className="border border-border p-1 text-right">{row.gross.toFixed(2)}</td>
            </tr>
          ))}
          <tr className="font-semibold">
            <td className="border border-border p-1">Suma:</td>
            <td className="border border-border p-1 text-right">{totalNet.toFixed(2)}</td>
            <td className="border border-border p-1 text-right">{totalVat.toFixed(2)}</td>
            <td className="border border-border p-1 text-right">{totalGross.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      <div className="border border-border rounded p-2 my-3 inline-block">
        <strong>Forma płatności:</strong>
        <br />
        {editable ? (
          <>
            <EditableField
              value={paymentMethod}
              onChange={setPaymentMethod}
              type="select"
              options={PAYMENT_OPTIONS}
              className="inline"
            />
            {paymentMethod === "Przelew" && (
              <>
                {" "}
                w terminie{" "}
                <EditableField value={paymentDays} onChange={setPaymentDays} type="number" className="inline w-12" /> dni = {dueDateStr}
              </>
            )}
          </>
        ) : (
          <>
            {paymentMethod}
            {paymentMethod === "Przelew" && ` w terminie ${paymentDays} dni = ${dueDateStr}`}
          </>
        )}
      </div>

      <div className="my-3 text-xs">
        <strong>Słownie zł:</strong> {amountToWords(totalGross)}
      </div>

      <div className="border border-border rounded p-2 my-3 bg-muted/20">
        <strong>Uwagi:</strong>
        <br />
        <EditableField value={notes} onChange={setNotes} className="block" multiline />
      </div>

      <div className="border-t border-border pt-2 mt-4 text-xs text-muted-foreground">
        {editable ? (
          <>
            <EditableField value={footerText} onChange={setFooterText} className="block" />
          </>
        ) : (
          footerText
        )}
      </div>
      {(thanksText || editable) && (
        <p className="font-semibold italic text-sm mt-1">
          {editable ? (
            <EditableField value={thanksText} onChange={setThanksText} className="inline" />
          ) : (
            thanksText
          )}
        </p>
      )}
    </div>
  );
}
