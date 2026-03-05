"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createSalesInvoice, type SalesInvoiceLineItem } from "@/app/actions/finance";
import { getAllCompanies } from "@/app/actions/companies";
import { validateNipOrVat } from "@/lib/nip-vat-validate";
import { toast } from "sonner";
import { Plus, Trash2, ChevronDown } from "lucide-react";

type BuyerMode = "company" | "manual";

interface CompanyOption {
  id: string;
  name: string;
  nip: string | null;
}

type PriceMode = "net" | "gross";

interface LineItemWithMode extends SalesInvoiceLineItem {
  priceMode?: PriceMode;
}

export function SalesInvoiceDialog({
  open,
  onOpenChange,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}) {
  const [buyerMode, setBuyerMode] = useState<BuyerMode>("company");
  const [companyId, setCompanyId] = useState("");
  const [companySearchQuery, setCompanySearchQuery] = useState("");
  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);
  const companyInputRef = useRef<HTMLInputElement>(null);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [nip, setNip] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [buyerAddress, setBuyerAddress] = useState("");
  const [buyerPostalCode, setBuyerPostalCode] = useState("");
  const [buyerCity, setBuyerCity] = useState("");
  const [lineItems, setLineItems] = useState<LineItemWithMode[]>([
    { description: "", quantity: 1, unit: "szt.", unitPrice: 0, vatRate: 8, priceMode: "net" },
  ]);
  const [paymentMethod, setPaymentMethod] = useState("TRANSFER");
  const [paymentDays, setPaymentDays] = useState(14);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      getAllCompanies({ limit: 500 }).then((r) => {
        if (r.success && r.data) {
          setCompanies(
            r.data.companies.map((c) => ({
              id: c.id,
              name: c.name,
              nip: c.nip ?? null,
            }))
          );
        }
      });
    }
  }, [open]);

  const addLine = () => {
    setLineItems((prev) => [
      ...prev,
      { description: "", quantity: 1, unit: "szt.", unitPrice: 0, vatRate: 8, priceMode: "net" as PriceMode },
    ]);
  };

  const removeLine = (idx: number) => {
    if (lineItems.length <= 1) return;
    setLineItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateLine = (idx: number, field: keyof LineItemWithMode, value: string | number) => {
    setLineItems((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        const next = { ...item, [field]: value } as LineItemWithMode;
        if (field === "priceMode" && typeof value === "string") {
          const vat = (item.vatRate ?? 8) / 100;
          const curr = Number(item.unitPrice) || 0;
          const currentMode = item.priceMode ?? "net";
          if (value === "gross" && currentMode === "net") {
            next.unitPrice = Math.round(curr * (1 + vat) * 100) / 100;
          } else if (value === "net" && currentMode === "gross") {
            next.unitPrice = curr > 0 ? Math.round((curr / (1 + vat)) * 100) / 100 : 0;
          }
        }
        return next;
      })
    );
  };

  const getNetUnitPrice = (li: LineItemWithMode): number => {
    const vat = (li.vatRate ?? 8) / 100;
    const val = Number(li.unitPrice) || 0;
    return li.priceMode === "gross" ? val / (1 + vat) : val;
  };

  const totalGross = lineItems.reduce((sum, li) => {
    const qty = Number(li.quantity) || 0;
    const vat = (li.vatRate ?? 8) / 100;
    const netPrice = getNetUnitPrice(li);
    return sum + qty * netPrice * (1 + vat);
  }, 0);

  const buildLineItemsForApi = (): SalesInvoiceLineItem[] =>
    lineItems
      .filter((li) => li.description?.trim() && Number(li.quantity) > 0 && (Number(li.unitPrice) > 0 || getNetUnitPrice(li) > 0))
      .map((li) => ({
        description: li.description,
        quantity: li.quantity,
        unit: li.unit,
        unitPrice: getNetUnitPrice(li),
        vatRate: li.vatRate,
      }));

  const handleSubmit = async (e: React.FormEvent, asProforma = false) => {
    e.preventDefault();
    const filtered = buildLineItemsForApi();
    if (filtered.length === 0) {
      toast.error("Dodaj co najmniej jedną pozycję z opisem, ilością i ceną.");
      return;
    }

    let buyer: { companyId: string } | { nip: string; name: string; address?: string; postalCode?: string; city?: string };
    if (buyerMode === "company") {
      if (!companyId) {
        toast.error("Wybierz firmę z listy.");
        return;
      }
      buyer = { companyId };
    } else {
      const nipValidation = validateNipOrVat(nip.trim());
      if (!nipValidation.ok) {
        toast.error(nipValidation.error);
        return;
      }
      if (!buyerName.trim()) {
        toast.error("Podaj nazwę nabywcy.");
        return;
      }
      buyer = {
        nip: nipValidation.normalized,
        name: buyerName.trim(),
        address: buyerAddress.trim() || undefined,
        postalCode: buyerPostalCode.trim() || undefined,
        city: buyerCity.trim() || undefined,
      };
    }

    const effectivePaymentDays = ["CARD", "BLIK", "CASH"].includes(paymentMethod) ? 0 : paymentDays;

    setLoading(true);
    try {
      const result = await createSalesInvoice(buyer, filtered, {
        paymentMethod,
        paymentDays: effectivePaymentDays,
        notes: notes.trim() || undefined,
        asProforma,
      });
      if (result.success && result.data) {
        const label = asProforma ? "Proforma" : "Faktura";
        toast.success(`${label} ${result.data.number} – ${result.data.amountGross.toFixed(2)} PLN`);
        onOpenChange(false);
        onSuccess?.();
        if (typeof window !== "undefined") {
          window.open(`/api/finance/invoice/${result.data.id}/pdf`, "_blank");
        }
      } else {
        toast.error(result.success === false ? result.error : "Błąd wystawiania faktury");
      }
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setBuyerMode("company");
    setCompanyId("");
    setCompanySearchQuery("");
    setCompanyDropdownOpen(false);
    setNip("");
    setBuyerName("");
    setBuyerAddress("");
    setBuyerPostalCode("");
    setBuyerCity("");
    setLineItems([{ description: "", quantity: 1, unit: "szt.", unitPrice: 0, vatRate: 8, priceMode: "net" }]);
    setPaymentMethod("TRANSFER");
    setPaymentDays(14);
    setNotes("");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) resetForm();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Faktura na produkty (stypy, vouchery, usługi)</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Nabywca */}
          <div className="space-y-3">
            <Label>Nabywca</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={buyerMode === "company"}
                  onChange={() => setBuyerMode("company")}
                  className="rounded"
                />
                Firma z bazy
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={buyerMode === "manual"}
                  onChange={() => setBuyerMode("manual")}
                  className="rounded"
                />
                Wprowadź ręcznie
              </label>
            </div>
            {buyerMode === "company" ? (
              <div className="relative">
                <Input
                  ref={companyInputRef}
                  value={companyDropdownOpen || companySearchQuery ? companySearchQuery : (companyId ? (() => {
                    const c = companies.find((x) => x.id === companyId);
                    return c ? `${c.name}${c.nip ? ` (${c.nip})` : ""}` : "";
                  })() : "")}
                  onChange={(e) => {
                    setCompanySearchQuery(e.target.value);
                    setCompanyId("");
                    setCompanyDropdownOpen(true);
                  }}
                  onFocus={() => {
                    setCompanyDropdownOpen(true);
                    if (companyId) {
                      const c = companies.find((x) => x.id === companyId);
                      setCompanySearchQuery(c ? `${c.name} ${c.nip ?? ""}`.trim() : "");
                      setCompanyId("");
                    }
                  }}
                  onBlur={() => setTimeout(() => setCompanyDropdownOpen(false), 200)}
                  placeholder="Wpisz nazwę lub NIP firmy…"
                  className="pr-8"
                />
                <ChevronDown className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50 pointer-events-none" />
                {companyDropdownOpen && (
                  <div className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-popover p-1 shadow-lg">
                    {companies
                      .filter((c) => c.nip && (!companySearchQuery.trim() || [c.name, c.nip].some((s) => s?.toLowerCase().includes(companySearchQuery.toLowerCase()))))
                      .slice(0, 50)
                      .map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setCompanyId(c.id);
                            setCompanySearchQuery("");
                            setCompanyDropdownOpen(false);
                            companyInputRef.current?.blur();
                          }}
                        >
                          {c.name} ({c.nip})
                        </button>
                      ))}
                    {companies.filter((c) => c.nip && (!companySearchQuery.trim() || [c.name, c.nip].some((s) => s?.toLowerCase().includes(companySearchQuery.toLowerCase())))).length === 0 && (
                      <p className="px-2 py-3 text-sm text-muted-foreground">Brak firm z NIP</p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <Label htmlFor="nip">NIP / Numer VAT (UE) *</Label>
                  <Input
                    id="nip"
                    value={nip}
                    onChange={(e) => setNip(e.target.value.toUpperCase().replace(/\s/g, "").slice(0, 14))}
                    placeholder="1234567890 lub DE123456789"
                  />
                </div>
                <div>
                  <Label htmlFor="buyerName">Nazwa *</Label>
                  <Input
                    id="buyerName"
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    placeholder="Nazwa firmy / imię i nazwisko"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="buyerAddress">Adres</Label>
                  <Input
                    id="buyerAddress"
                    value={buyerAddress}
                    onChange={(e) => setBuyerAddress(e.target.value)}
                    placeholder="Ulica, numer"
                  />
                </div>
                <div>
                  <Label htmlFor="buyerPostalCode">Kod pocztowy</Label>
                  <Input
                    id="buyerPostalCode"
                    value={buyerPostalCode}
                    onChange={(e) => setBuyerPostalCode(e.target.value)}
                    placeholder="00-000"
                  />
                </div>
                <div>
                  <Label htmlFor="buyerCity">Miasto</Label>
                  <Input
                    id="buyerCity"
                    value={buyerCity}
                    onChange={(e) => setBuyerCity(e.target.value)}
                    placeholder="Miasto"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Pozycje */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Pozycje faktury</Label>
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                <Plus className="h-4 w-4 mr-1" />
                Dodaj
              </Button>
            </div>
            <div className="max-h-48 overflow-y-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="p-1.5 text-left font-medium">Opis</th>
                    <th className="p-1.5 w-16 text-right">Ilość</th>
                    <th className="p-1.5 w-14 text-left">j.m.</th>
                    <th className="p-1.5 w-20 text-right">Typ ceny</th>
                    <th className="p-1.5 w-24 text-right">Kwota</th>
                    <th className="p-1.5 w-14 text-right">VAT %</th>
                    <th className="p-1.5 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((li, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="p-1.5">
                        <Input
                          value={li.description}
                          onChange={(e) => updateLine(idx, "description", e.target.value)}
                          placeholder="np. Stypa 50 os., Voucher 500 PLN"
                          className="h-8"
                        />
                      </td>
                      <td className="p-1.5">
                        <Input
                          type="number"
                          min={0.01}
                          step={0.01}
                          value={li.quantity || ""}
                          onChange={(e) =>
                            updateLine(idx, "quantity", parseFloat(e.target.value) || 0)
                          }
                          className="h-8 text-right"
                        />
                      </td>
                      <td className="p-1.5">
                        <Input
                          value={li.unit ?? "szt."}
                          onChange={(e) => updateLine(idx, "unit", e.target.value)}
                          className="h-8"
                        />
                      </td>
                      <td className="p-1.5">
                        <select
                          value={li.priceMode ?? "net"}
                          onChange={(e) => updateLine(idx, "priceMode", e.target.value as PriceMode)}
                          className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
                        >
                          <option value="net">Netto</option>
                          <option value="gross">Brutto</option>
                        </select>
                      </td>
                      <td className="p-1.5">
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={li.unitPrice || ""}
                          onChange={(e) =>
                            updateLine(idx, "unitPrice", parseFloat(e.target.value) || 0)
                          }
                          className="h-8 text-right"
                          placeholder={li.priceMode === "gross" ? "Brutto" : "Netto"}
                        />
                      </td>
                      <td className="p-1.5">
                        <select
                          value={[5, 8, 23].includes(Number(li.vatRate)) ? Number(li.vatRate) : 8}
                          onChange={(e) =>
                            updateLine(idx, "vatRate", parseFloat(e.target.value) || 8)
                          }
                          className="h-8 w-full min-w-[4rem] rounded-md border border-input bg-background px-2 text-right text-sm"
                        >
                          <option value={5}>5%</option>
                          <option value={8}>8%</option>
                          <option value={23}>23%</option>
                        </select>
                      </td>
                      <td className="p-1.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => removeLine(idx)}
                          disabled={lineItems.length <= 1}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-sm text-muted-foreground">
              Suma brutto: {totalGross.toFixed(2)} PLN
            </p>
          </div>

          {/* Opcje */}
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <Label htmlFor="paymentMethod">Forma płatności</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger id="paymentMethod">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TRANSFER">Przelew</SelectItem>
                  <SelectItem value="CASH">Gotówka</SelectItem>
                  <SelectItem value="CARD">Karta</SelectItem>
                  <SelectItem value="BLIK">BLIK</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {!["CARD", "BLIK", "CASH"].includes(paymentMethod) && (
              <div>
                <Label htmlFor="paymentDays">Termin płatności (dni)</Label>
                <Input
                  id="paymentDays"
                  type="number"
                  min={1}
                  value={paymentDays}
                  onChange={(e) => setPaymentDays(parseInt(e.target.value, 10) || 14)}
                />
              </div>
            )}
          </div>
          <div>
            <Label htmlFor="notes">Uwagi (opcjonalnie)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Uwagi widoczne na fakturze"
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Anuluj
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={(e) => handleSubmit(e as unknown as React.FormEvent, true)}
            >
              {loading ? "Wystawianie…" : "Proforma faktura"}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Wystawianie…" : "Wystaw fakturę"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
