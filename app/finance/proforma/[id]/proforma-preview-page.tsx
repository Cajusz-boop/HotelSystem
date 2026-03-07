"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getProformaPreviewData, updateProforma } from "@/app/actions/finance";
import type { ProformaPreviewData } from "@/app/actions/finance";
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

const displayToCode: Record<string, string> = {
  Gotówka: "CASH",
  Przelew: "TRANSFER",
  "Karta płatnicza": "CARD",
  BLIK: "BLIK",
};

export interface ProformaPreviewPageProps {
  id: string;
}

export function ProformaPreviewPage({ id }: ProformaPreviewPageProps) {
  const [data, setData] = useState<ProformaPreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [nipLookupLoading, setNipLookupLoading] = useState(false);

  const [documentVariant, setDocumentVariant] = useState("oryginał");
  const [placeOfIssue, setPlaceOfIssue] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [buyerNip, setBuyerNip] = useState("");
  const [buyerAddress, setBuyerAddress] = useState("");
  const [buyerPostalCode, setBuyerPostalCode] = useState("");
  const [buyerCity, setBuyerCity] = useState("");
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
    getProformaPreviewData(id).then((r) => {
      if (r.success && r.data) {
        const d = r.data;
        setData(d);
        setPlaceOfIssue(d.placeOfIssue ?? "");
        setIssueDate(d.issueDate ? parseDdMmYyyyToYyyyMmDd(d.issueDate) : "");
        setDeliveryDate(d.deliveryDate ? parseDdMmYyyyToYyyyMmDd(d.deliveryDate) : "");
        setBuyerName(d.buyerName);
        setBuyerNip(d.buyerNip);
        setBuyerAddress(d.buyerAddress ?? "");
        setBuyerPostalCode(d.buyerPostalCode ?? "");
        setBuyerCity(d.buyerCity ?? "");
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
    let tn = 0, tv = 0, tg = 0;
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
      byVat[k] = { net: round2(byVat[k].net), vat: round2(byVat[k].vat), gross: round2(byVat[k].gross) };
    }
    return { totalNet: round2(tn), totalVat: round2(tv), totalGross: round2(tg), vatSummary: byVat };
  })();

  const dueDateStr = (() => {
    if (!issueDate) return "";
    const d = new Date(issueDate + "T12:00:00");
    const days = parseInt(paymentDays, 10) || 0;
    d.setDate(d.getDate() + days);
    return d.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });
  })();

  const buildPayload = useCallback(() => {
    if (!data) return null;
    const hasAnyOverride =
      buyerName !== data.buyerName ||
      buyerAddress !== (data.buyerAddress ?? "") ||
      buyerPostalCode !== data.buyerPostalCode ||
      buyerCity !== data.buyerCity ||
      buyerNip !== data.buyerNip ||
      placeOfIssue !== data.placeOfIssue ||
      deliveryDate !== (data.deliveryDate ? parseDdMmYyyyToYyyyMmDd(data.deliveryDate) : "") ||
      paymentMethod !== data.paymentMethod ||
      parseInt(paymentDays, 10) !== data.paymentDays ||
      notes !== (data.notes ?? "") ||
      footerText !== (data.footerText ?? "") ||
      thanksText !== (data.thanksText ?? "") ||
      sellerName !== data.sellerName ||
      sellerAddress !== (data.sellerAddress ?? "") ||
      sellerPostalCity !== data.sellerPostalCity ||
      [sellerBank, sellerAccount].filter(Boolean).join("\n") !== (data.bankLine ?? "") ||
      lineItems.length !== data.lineItems.length ||
      lineItems.some(
        (li, i) =>
          li.name !== data.lineItems[i]?.name ||
          li.quantity !== data.lineItems[i]?.quantity ||
          Math.abs(li.grossAmount - (data.lineItems[i]?.grossAmount ?? 0)) > 0.001
      );
    if (!hasAnyOverride) return null;

    const ov: Record<string, unknown> = {
      buyerName: buyerName.trim(),
      buyerNip: buyerNip.trim(),
      buyerAddress: buyerAddress.trim() || null,
      buyerPostalCode: buyerPostalCode.trim() || null,
      buyerCity: buyerCity.trim() || null,
      placeOfIssue: placeOfIssue.trim() || null,
      deliveryDate: deliveryDate || null,
      paymentMethod: displayToCode[paymentMethod] ?? paymentMethod,
      paymentDays: parseInt(paymentDays, 10) || 14,
      notes: notes.trim() || null,
      footerText: footerText || null,
      thanksText: thanksText || null,
      sellerOverride: {
        sellerName: sellerName || undefined,
        sellerAddress: sellerAddress || undefined,
        sellerPostalCity: sellerPostalCity || undefined,
        sellerNip: sellerNip || undefined,
        sellerPhone: sellerPhone || undefined,
        sellerEmail: sellerEmail || undefined,
        sellerBankName: sellerBank || undefined,
        sellerBankAccount: sellerAccount || undefined,
      },
      lineItems: lineItems
        .filter((li) => li.name.trim())
        .map((li) => ({
          name: li.name.trim(),
          quantity: li.quantity,
          unit: li.unit,
          unitPrice: li.unitPrice,
          vatRate: li.vatRate,
          netAmount: li.netAmount,
          vatAmount: li.vatAmount,
          grossAmount: li.grossAmount,
        })),
    };
    return ov;
  }, [data, buyerName, buyerAddress, buyerPostalCode, buyerCity, buyerNip, placeOfIssue, deliveryDate, paymentMethod, paymentDays, notes, footerText, thanksText, sellerName, sellerAddress, sellerPostalCity, sellerNip, sellerPhone, sellerEmail, sellerBank, sellerAccount, lineItems]);

  const hasUnsavedChanges = buildPayload() != null && Object.keys(buildPayload() ?? {}).length > 0;

  const performSave = useCallback(async () => {
    const ov = buildPayload();
    const amount = totalGross;
    const payload: Parameters<typeof updateProforma>[1] = {};
    if (ov && Object.keys(ov).length > 0) payload.overrides = ov as Parameters<typeof updateProforma>[1]["overrides"];
    if (Math.abs(amount - (data?.finalGross ?? 0)) > 0.001) payload.amount = amount;
    const origIssue = data?.issueDate ? parseDdMmYyyyToYyyyMmDd(data.issueDate) : "";
    if (issueDate && issueDate !== origIssue) payload.issuedAt = new Date(issueDate + "T12:00:00");
    if (Object.keys(payload).length === 0) return true;
    setBusy(true);
    try {
      const res = await updateProforma(id, payload);
      if (!res.success) {
        toast.error(res.error ?? "Błąd zapisu");
        return false;
      }
      toast.success("Proforma zapisana");
      loadData();
      return true;
    } finally {
      setBusy(false);
    }
  }, [id, buildPayload, totalGross, data, issueDate, loadData]);

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

  const handlePrint = () =>
    saveAndThen(() => {
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.src = `/api/finance/proforma/${id}/pdf`;
      document.body.appendChild(iframe);
      iframe.addEventListener("load", () => {
        iframe.contentWindow?.print();
        setTimeout(() => {
          if (iframe.parentNode) document.body.removeChild(iframe);
        }, 1000);
      });
    });
  const handlePdf = () => saveAndThen(() => window.open(`/api/finance/proforma/${id}/pdf`, "_blank", "noopener,noreferrer"));

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

  if (loading) return <div className="p-8"><p className="text-muted-foreground">Ładowanie…</p></div>;
  if (error || !data) return (
    <div className="p-8">
      <p className="text-destructive">{error ?? "Brak danych proformy"}</p>
      <Link href="/finance"><Button variant="outline" className="mt-4">Powrót</Button></Link>
    </div>
  );

  const commonProps: {
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
    nipLookupLoading?: boolean;
    onNipLookup?: () => void;
  } = {
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
    onNipLookup: handleNipLookup,
  };

  return (
    <div className="flex flex-col min-h-screen proforma-preview-root">
      <style dangerouslySetInnerHTML={{ __html: `
        .proforma-preview-root [data-editable]:hover { background: none !important; outline: none !important; }
        .proforma-preview-root input, .proforma-preview-root select, .proforma-preview-root textarea {
          border: none !important; background: none !important; outline: none !important; padding: 0 !important;
        }
        @media print {
          .toolbar { display: none !important; }
          body { margin: 0; }
          .page-break-after, [style*="page-break-after"] { page-break-after: always !important; }
        }
      `}} />
      {(
        <div className="print:hidden toolbar flex items-center gap-2 border-b bg-muted/30 px-6 py-3">
          <Button variant={hasUnsavedChanges ? "default" : "outline"} size="sm" onClick={() => performSave()} disabled={busy}>
            <Save className="mr-2 h-4 w-4" /> Zapisz
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint} disabled={busy}><Printer className="mr-2 h-4 w-4" /> Drukuj</Button>
          <Button variant="outline" size="sm" onClick={handlePdf} disabled={busy}><FileDown className="mr-2 h-4 w-4" /> Pobierz PDF</Button>
          <Button variant="outline" size="sm" onClick={() => setEmailDialogOpen(true)} disabled={busy}><Mail className="mr-2 h-4 w-4" /> Wyślij na email</Button>
          <Button variant="ghost" size="sm" onClick={() => (hasUnsavedChanges ? (window.confirm("Masz niezapisane zmiany. Czy na pewno chcesz wyjść?") ? window.history.back() : null) : window.history.back())}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Powrót
          </Button>
        </div>
      )}

      <div className="flex-1 p-6 max-w-4xl mx-auto">
        <ProformaContent data={data} editable variantLabel={documentVariant} setDocumentVariant={setDocumentVariant} {...commonProps} />
      </div>

      <SendEmailDialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen} documentType="proforma" documentId={id} documentNumber={data.proforma.number} amountGross={data.finalGross} defaultEmail={data.guestEmail ?? ""} onBeforeSend={async () => performSave()} />
    </div>
  );
}

function ProformaContent({
  data,
  editable,
  variantLabel = "oryginał",
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
}: {
  data: ProformaPreviewData;
  editable: boolean;
  variantLabel?: string;
  setDocumentVariant?: (v: string) => void;
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
  nipLookupLoading?: boolean;
  onNipLookup?: () => void;
}) {
  const UNIT_OPTS = UNIT_OPTIONS;
  const VAT_OPTS = VAT_OPTIONS;
  const DOC_VARIANTS = DOCUMENT_VARIANTS;
  const PAY_OPTS = PAYMENT_OPTIONS;

  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm text-sm">
      <h1 className="text-xl font-semibold text-center mb-6">
        Proforma {data.proforma.number}{" "}
        {editable && setDocumentVariant ? (
          <EditableField value={variantLabel} onChange={setDocumentVariant} type="select" options={DOC_VARIANTS} />
        ) : (
          variantLabel
        )}
      </h1>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div>
          <div className="text-xs text-muted-foreground mb-1">Nabywca</div>
          <div className="space-y-0.5 border border-border rounded p-2 text-sm">
            <p className="mb-0"><EditableField value={buyerName} onChange={setBuyerName} className="block font-medium" /></p>
            <p className="mb-0 flex items-center gap-1">
              NIP: <EditableField value={buyerNip} onChange={setBuyerNip} className="inline flex-1" />
              {editable && <Button type="button" variant="outline" size="sm" className="h-6 text-xs" onClick={onNipLookup} disabled={nipLookupLoading}>{nipLookupLoading ? "…" : "Pobierz dane"}</Button>}
            </p>
            <p className="mb-0"><EditableField value={buyerAddress} onChange={setBuyerAddress} className="block" multiline /></p>
            <p className="mb-0"><EditableField value={buyerPostalCode} onChange={setBuyerPostalCode} className="inline w-16" /> <EditableField value={buyerCity} onChange={setBuyerCity} className="inline" /></p>
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-1">Sprzedawca</div>
          <div className="space-y-0.5 border border-border rounded p-2 text-sm">
            <p className="mb-0"><EditableField value={sellerName} onChange={setSellerName} className="block font-medium" /></p>
            <p className="mb-0"><EditableField value={sellerAddress} onChange={setSellerAddress} className="block" /></p>
            <p className="mb-0"><EditableField value={sellerPostalCity} onChange={setSellerPostalCity} className="block" /></p>
            {sellerNip && <p className="mb-0">NIP: <EditableField value={sellerNip} onChange={setSellerNip} className="inline" /></p>}
            {sellerPhone && <p className="mb-0">Tel: <EditableField value={sellerPhone} onChange={setSellerPhone} className="inline" /></p>}
            {sellerEmail && <p className="mb-0">e-mail: <EditableField value={sellerEmail} onChange={setSellerEmail} className="inline" /></p>}
            {(sellerBank || sellerAccount) && <p className="mb-0"><EditableField value={sellerBank} onChange={setSellerBank} className="block" /><EditableField value={sellerAccount} onChange={setSellerAccount} className="block" /></p>}
          </div>
        </div>
      </div>

      <div className="text-right space-y-1 text-sm mb-4">
        <p><span className="text-muted-foreground">Miejsce wystawienia:</span> {editable ? <EditableField value={placeOfIssue} onChange={setPlaceOfIssue} /> : placeOfIssue || "—"}</p>
        <p><span className="text-muted-foreground">Data wystawienia:</span> {editable ? <EditableDateField value={issueDate} onChange={setIssueDate} displayValue={data.issueDate} /> : data.issueDate}</p>
        <p><span className="text-muted-foreground">Data dostawy/wykonania usługi:</span> {editable ? <EditableDateField value={deliveryDate} onChange={setDeliveryDate} displayValue={data.deliveryDate} /> : data.deliveryDate}</p>
      </div>

      <table className="w-full border-collapse border border-border text-xs mb-3">
        <thead>
          <tr className="bg-muted/50">
            <th className="border border-border p-1.5 text-center w-8">Lp.</th>
            <th className="border border-border p-1.5 text-left">Nazwa</th>
            {data.showPkwiu && <th className="border border-border p-1.5 text-left">PKWIU</th>}
            <th className="border border-border p-1.5 text-right">Ilość</th>
            {data.showUnit && <th className="border border-border p-1.5 text-left">j.m.</th>}
            <th className="border border-border p-1.5 text-right">Cena netto</th>
            <th className="border border-border p-1.5 text-right">Wartość netto</th>
            <th className="border border-border p-1.5 text-right">VAT %</th>
            <th className="border border-border p-1.5 text-right">Wartość brutto</th>
            {editable && <th className="border border-border p-1.5 w-8"></th>}
          </tr>
        </thead>
        <tbody>
          {lineItems.map((item, idx) => (
            <tr key={idx}>
              <td className="border border-border p-1.5 text-center">{idx + 1}</td>
              <td className="border border-border p-1.5">
                {editable ? <EditableField value={item.name} onChange={(v) => updateLineItem(idx, { name: v })} className="block" /> : item.name || "—"}
              </td>
              {data.showPkwiu && <td className="border border-border p-1.5">55.10.10.0</td>}
              <td className="border border-border p-1.5 text-right">
                {editable ? <EditableField value={item.quantity} onChange={(v) => updateLineItem(idx, { quantity: parseFloat(v) || 0 })} type="number" className="inline w-14 text-right" /> : item.quantity}
              </td>
              {data.showUnit && (
                <td className="border border-border p-1.5">
                  {editable ? <EditableField value={item.unit} onChange={(v) => updateLineItem(idx, { unit: v })} type="select" options={UNIT_OPTS} className="inline" /> : item.unit}
                </td>
              )}
              <td className="border border-border p-1.5 text-right">
                {editable ? <EditableField value={item.unitPrice} onChange={(v) => updateLineItem(idx, { unitPrice: parseFloat(v) || 0 })} type="number" className="inline w-16 text-right" /> : item.unitPrice.toFixed(2)}
              </td>
              <td className="border border-border p-1.5 text-right">{item.netAmount.toFixed(2)}</td>
              <td className="border border-border p-1.5 text-right">
                {editable ? <EditableField value={String(item.vatRate)} onChange={(v) => updateLineItem(idx, { vatRate: parseFloat(v) || 0 })} type="select" options={VAT_OPTS} className="inline" /> : item.vatRate === 0 ? "zw." : item.vatRate}
              </td>
              <td className="border border-border p-1.5 text-right">
                {editable ? <EditableField value={item.grossAmount} onChange={(v) => updateLineItem(idx, { grossAmount: parseFloat(v) || 0 })} type="number" className="inline w-16 text-right" /> : item.grossAmount.toFixed(2)}
              </td>
              {editable && (
                <td className="border border-border p-1">
                  <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:text-destructive" onClick={() => removeLineItem(idx)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {editable && <Button type="button" variant="outline" size="sm" className="mb-3" onClick={addLineItem}><Plus className="mr-2 h-4 w-4" /> Dodaj pozycję</Button>}

      <div className="flex justify-end mb-4">
        <table className="w-auto text-sm border border-border">
          <tbody>
            {Object.entries(vatSummary).map(([rate, row]) => (
              <tr key={rate}>
                <td className="border border-border p-1 text-muted-foreground">{rate === "zw." ? "zw." : rate + "%"}</td>
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
      </div>

      <div className="space-y-1 text-sm mb-3">
        <p>
          <span className="text-muted-foreground">Forma płatności:</span>{" "}
          {editable ? (
            <>
              <EditableField value={paymentMethod} onChange={setPaymentMethod} type="select" options={PAY_OPTS} />
              {paymentMethod === "Przelew" && (
                <> w terminie <EditableField value={paymentDays} onChange={setPaymentDays} type="number" className="inline w-12" /> dni = {dueDateStr}</>
              )}
            </>
          ) : (
            <>
              {paymentMethod}
              {paymentMethod === "Przelew" && ` w terminie ${paymentDays} dni = ${dueDateStr}`}
            </>
          )}
        </p>
      </div>

      <div className="my-3 text-xs"><strong>Słownie zł:</strong> {amountToWords(totalGross)}</div>

      <div className="border border-border rounded p-2 my-3 bg-muted/20">
        <strong>Uwagi:</strong><br />
        <EditableField value={notes} onChange={setNotes} className="block" multiline />
      </div>

      <div className="border-t border-border pt-2 mt-4 text-xs text-muted-foreground">
        {editable ? <EditableField value={footerText} onChange={setFooterText} className="block" /> : footerText}
      </div>
      {(thanksText || editable) && (
        <p className="font-semibold italic text-sm mt-1">
          {editable ? <EditableField value={thanksText} onChange={setThanksText} className="inline" /> : thanksText}
        </p>
      )}
    </div>
  );
}
