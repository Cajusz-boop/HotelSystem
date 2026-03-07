"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getVatSalesRegister, getVatPurchasesRegister } from "@/app/actions/finance";
import type { VatRegisterData } from "@/app/actions/finance";
import { InvoiceEditSheet } from "@/components/finance/invoice-edit-sheet";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function VatRegisterSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const today = new Date();
  const threeDaysAgo = new Date(today);
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const [dateFrom, setDateFrom] = useState(() => formatDate(threeDaysAgo));
  const [dateTo, setDateTo] = useState(() => formatDate(today));
  const [tab, setTab] = useState<"sales" | "purchases">("sales");
  const [salesData, setSalesData] = useState<VatRegisterData | null>(null);
  const [purchasesData, setPurchasesData] = useState<VatRegisterData | null>(null);
  const [loading, setLoading] = useState(false);
  const [editInvoiceId, setEditInvoiceId] = useState<string | null>(null);

  const loadData = useCallback(async (from?: string, to?: string) => {
    const f = from ?? dateFrom;
    const t = to ?? dateTo;
    if (!f || !t) {
      toast.error("Wybierz zakres dat");
      return;
    }
    setLoading(true);
    try {
      const [salesRes, purchasesRes] = await Promise.all([
        getVatSalesRegister(f, t),
        getVatPurchasesRegister(f, t),
      ]);
      if (salesRes.success && salesRes.data) {
        setSalesData(salesRes.data);
      } else {
        setSalesData(null);
        toast.error("error" in salesRes ? salesRes.error : "Błąd rejestru sprzedaży");
      }
      if (purchasesRes.success && purchasesRes.data) {
        setPurchasesData(purchasesRes.data);
      } else {
        setPurchasesData(null);
        toast.error("error" in purchasesRes ? purchasesRes.error : "Błąd rejestru zakupów");
      }
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    if (open) {
      const from = formatDate(threeDaysAgo);
      const to = formatDate(today);
      setDateFrom(from);
      setDateTo(to);
      loadData(from, to);
    }
  }, [open]);

  const handleLoad = () => {
    loadData();
  };

  const data = tab === "sales" ? salesData : purchasesData;
  const rows = data?.rows
    ? [...data.rows].sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0))
    : [];

  return (
    <>
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex flex-col w-full sm:max-w-xl overflow-hidden">
        <SheetHeader>
          <SheetTitle>Rejestry VAT</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col flex-1 min-h-0 gap-4 mt-2">
          {/* Filtry dat */}
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label htmlFor="vatRegFrom" className="text-xs">
                Data od
              </Label>
              <Input
                id="vatRegFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="mt-1 w-36"
              />
            </div>
            <div>
              <Label htmlFor="vatRegTo" className="text-xs">
                Data do
              </Label>
              <Input
                id="vatRegTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="mt-1 w-36"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={handleLoad}
            >
              {loading ? "Ładowanie…" : "Pokaż"}
            </Button>
          </div>

          {/* Tabs: Sprzedaż / Zakupy */}
          <div className="flex rounded-md border border-input bg-muted/30 p-0.5">
            <button
              type="button"
              className={cn(
                "flex-1 px-3 py-2 text-sm font-medium rounded transition-colors",
                tab === "sales"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setTab("sales")}
            >
              Rejestr sprzedaży
            </button>
            <button
              type="button"
              className={cn(
                "flex-1 px-3 py-2 text-sm font-medium rounded transition-colors",
                tab === "purchases"
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setTab("purchases")}
            >
              Rejestr zakupów
            </button>
          </div>

          {/* Tabela */}
          <div className="flex-1 min-h-0 overflow-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/50 z-10">
                <tr className="border-b">
                  <th className="text-left p-2">Data</th>
                  <th className="text-left p-2">Nr dokumentu</th>
                  <th className="text-left p-2">NIP</th>
                  <th className="text-left p-2">Kontrahent</th>
                  <th className="text-right p-2">Netto</th>
                  <th className="text-right p-2">VAT%</th>
                  <th className="text-right p-2">VAT</th>
                  <th className="text-right p-2">Brutto</th>
                  <th className="text-left p-2 w-20">Akcje</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="p-4 text-center text-muted-foreground">
                      Ładowanie…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="p-4 text-center text-muted-foreground"
                    >
                      {tab === "sales"
                        ? "Brak faktur w tym okresie"
                        : "Brak zakupów w systemie (rejestr zakupów do rozbudowy)"}
                    </td>
                  </tr>
                ) : (
                  rows.map((r, i) => (
                    <tr key={i} className="border-b hover:bg-muted/30">
                      <td className="p-2">{r.date}</td>
                      <td className="p-2">
                        {r.invoiceId ? (
                          <a
                            href={`/finance/invoice/${r.invoiceId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline underline-offset-2"
                          >
                            {r.documentNumber}
                          </a>
                        ) : (
                          r.documentNumber
                        )}
                      </td>
                      <td className="p-2">{r.contractorNip}</td>
                      <td className="p-2">{r.contractorName}</td>
                      <td className="p-2 text-right">{r.netAmount.toFixed(2)}</td>
                      <td className="p-2 text-right">{r.vatRate.toFixed(0)}%</td>
                      <td className="p-2 text-right">{r.vatAmount.toFixed(2)}</td>
                      <td className="p-2 text-right">{r.grossAmount.toFixed(2)}</td>
                      <td className="p-2">
                        {r.invoiceId ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setEditInvoiceId(r.invoiceId!)}
                          >
                            Edytuj
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {data && rows.length > 0 && (
                <tfoot>
                  <tr className="border-t bg-muted/50 font-medium">
                    <td colSpan={5} className="p-2">
                      Razem
                    </td>
                    <td className="p-2 text-right">{data.totalNet.toFixed(2)}</td>
                    <td className="p-2"></td>
                    <td className="p-2 text-right">{data.totalVat.toFixed(2)}</td>
                    <td className="p-2 text-right">{data.totalGross.toFixed(2)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </SheetContent>
    </Sheet>
    <InvoiceEditSheet
      invoiceId={editInvoiceId}
      open={!!editInvoiceId}
      onOpenChange={(open) => {
        if (!open) setEditInvoiceId(null);
      }}
      onSaved={() => {
        setEditInvoiceId(null);
        loadData();
      }}
    />
    </>
  );
}
