"use client";

import { useState, useEffect } from "react";
import { getRestaurantChargesForReservation } from "@/app/actions/gastronomy";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function InvoiceSingleLineCheckbox({
  checked,
  onCheckedChange,
}: {
  checked: boolean;
  onCheckedChange: (value: boolean) => void | Promise<void>;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-muted/5 px-3 py-2">
      <Checkbox
        id="invoice-single-line"
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(v === true)}
      />
      <Label htmlFor="invoice-single-line" className="text-sm font-normal cursor-pointer">
        Faktura: jedna linia „Usługa hotelowa” z całą sumą rachunku (nocleg + gastronomia + inne)
      </Label>
    </div>
  );
}

const INVOICE_SCOPE_OPTIONS = [
  { value: "ALL", label: "Całość (hotel + gastronomia)" },
  { value: "HOTEL_ONLY", label: "Tylko usługa hotelowa" },
  { value: "GASTRONOMY_ONLY", label: "Tylko usługa gastronomiczna" },
] as const;

interface MealsTabProps {
  reservationId: string;
  invoiceSingleLine: boolean;
  onInvoiceSingleLineChange: (value: boolean) => void | Promise<void>;
  invoiceScope: string;
  onInvoiceScopeChange: (value: string) => void | Promise<void>;
}

export function MealsTab({ reservationId, invoiceSingleLine, onInvoiceSingleLineChange, invoiceScope, onInvoiceScopeChange }: MealsTabProps) {
  const [charges, setCharges] = useState<
    Array<{
      id: string;
      amount: number;
      description: string | null;
      type: string;
      createdAt: string;
      receiptNumber?: string;
      cashierName?: string;
      posSystem?: string;
      items: Array<{ name: string; quantity: number; unitPrice: number }>;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getRestaurantChargesForReservation(reservationId).then((res) => {
      if (res.success && res.data) setCharges(res.data);
      setLoading(false);
    });
  }, [reservationId]);

  const totalAmount = charges.reduce((s, c) => s + c.amount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        Wczytywanie obciążeń z restauracji...
      </div>
    );
  }

  const emptyState = (
    <div className="space-y-3">
      <div className="rounded-lg border border-dashed bg-muted/10 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Brak obciążeń gastronomicznych dla tej rezerwacji.
        </p>
        <p className="mt-1 text-xs text-muted-foreground/70">
          Dania nabite na pokój z systemu Symplex Bistro pojawią się tutaj automatycznie.
        </p>
      </div>
      <InvoiceSingleLineCheckbox checked={invoiceSingleLine} onCheckedChange={onInvoiceSingleLineChange} />
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Zakres faktury</Label>
        <Select value={invoiceScope || "ALL"} onValueChange={(v) => onInvoiceScopeChange(v)}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INVOICE_SCOPE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  if (charges.length === 0) {
    return emptyState;
  }

  return (
    <div className="space-y-3">
      <InvoiceSingleLineCheckbox checked={invoiceSingleLine} onCheckedChange={onInvoiceSingleLineChange} />
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Zakres faktury</Label>
        <Select value={invoiceScope || "ALL"} onValueChange={(v) => onInvoiceScopeChange(v)}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INVOICE_SCOPE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          Dania nabite na pokój
          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
            ({charges.length} {charges.length === 1 ? "rachunek" : charges.length < 5 ? "rachunki" : "rachunków"})
          </span>
        </h3>
        <span className="text-sm font-bold">{totalAmount.toFixed(2)} PLN</span>
      </div>

      <div className="divide-y rounded-md border">
        {charges.map((charge) => {
          const dateStr = new Date(charge.createdAt).toLocaleString("pl-PL", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
          const hasItems = charge.items.length > 0;
          const isExpanded = expandedId === charge.id;

          return (
            <div key={charge.id} className="text-sm">
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-muted/30 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : charge.id)}
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">
                      {charge.description || "Restauracja"}
                    </span>
                    {charge.posSystem && (
                      <span className="shrink-0 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                        {charge.posSystem}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{dateStr}</span>
                    {charge.cashierName && (
                      <>
                        <span className="text-muted-foreground/50">·</span>
                        <span>Kelner: {charge.cashierName}</span>
                      </>
                    )}
                    {charge.receiptNumber && (
                      <>
                        <span className="text-muted-foreground/50">·</span>
                        <span>Rach. {charge.receiptNumber}</span>
                      </>
                    )}
                    {hasItems && (
                      <>
                        <span className="text-muted-foreground/50">·</span>
                        <span>{charge.items.length} poz.</span>
                      </>
                    )}
                  </div>
                </div>
                <span className="shrink-0 font-semibold ml-3">
                  {charge.amount.toFixed(2)} PLN
                </span>
              </button>

              {isExpanded && hasItems && (
                <div className="border-t bg-muted/5 px-3 py-2">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-muted-foreground">
                        <th className="text-left py-1 font-medium">Pozycja</th>
                        <th className="text-center py-1 font-medium w-12">Ilość</th>
                        <th className="text-right py-1 font-medium w-20">Cena</th>
                        <th className="text-right py-1 font-medium w-20">Razem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {charge.items.map((item, idx) => (
                        <tr key={idx}>
                          <td className="py-1">{item.name}</td>
                          <td className="py-1 text-center text-muted-foreground">{item.quantity}</td>
                          <td className="py-1 text-right text-muted-foreground">{item.unitPrice.toFixed(2)}</td>
                          <td className="py-1 text-right font-medium">{(item.quantity * item.unitPrice).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {isExpanded && !hasItems && (
                <div className="border-t bg-muted/5 px-3 py-2 text-xs text-muted-foreground">
                  Brak szczegółowych pozycji – obciążenie kwotowe bez listy dań.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
