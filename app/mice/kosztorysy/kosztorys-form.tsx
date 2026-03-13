"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createGroupQuote,
  updateGroupQuote,
  deleteGroupQuote,
  type GroupQuoteItem,
  type GroupQuoteMeta,
} from "@/app/actions/mice";
import { recalcGroupQuoteItem } from "@/lib/mice-quote-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

const VAT_OPTS = [0, 5, 8, 23];

const emptyItem = (): GroupQuoteItem =>
  recalcGroupQuoteItem({
    name: "",
    unit: "szt",
    quantity: 1,
    unitPriceNet: 0,
    vatRate: 8,
  });

function migrateLegacyItem(raw: Record<string, unknown>): GroupQuoteItem {
  const qty = Number(raw.quantity ?? 1) || 0;
  const unitPriceNet = Number(raw.unitPriceNet ?? raw.unitPrice ?? 0) || 0;
  const vatRate = Number(raw.vatRate ?? 8) || 0;
  return recalcGroupQuoteItem({
    name: String(raw.name ?? ""),
    unit: String(raw.unit ?? "szt"),
    quantity: qty,
    unitPriceNet,
    vatRate,
  });
}

interface GroupQuoteForForm {
  id: string;
  name: string;
  validUntil: string | null;
  totalAmount: number | null;
  items: GroupQuoteItem[] | null;
  clientName?: string | null;
  clientNip?: string | null;
  eventDate?: string | null;
  depositAmount?: number | null;
  notes?: string | null;
}

export function KosztorysForm({ quotes }: { quotes: GroupQuoteForForm[] }) {
  const router = useRouter();
  const onMutate = () => router.refresh();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientNip, setClientNip] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<GroupQuoteItem[]>([emptyItem()]);
  const [submitting, setSubmitting] = useState(false);

  const startNew = () => {
    setEditingId(null);
    setName("");
    setValidUntil("");
    setClientName("");
    setClientNip("");
    setEventDate("");
    setDepositAmount("");
    setNotes("");
    setItems([emptyItem()]);
  };

  const startEdit = (q: GroupQuoteForForm) => {
    setEditingId(q.id);
    setName(q.name);
    setValidUntil(q.validUntil ? q.validUntil.slice(0, 10) : "");
    setClientName(q.clientName ?? "");
    setClientNip(q.clientNip ?? "");
    setEventDate(q.eventDate ? q.eventDate.slice(0, 10) : "");
    setDepositAmount(q.depositAmount != null ? String(q.depositAmount) : "");
    setNotes(q.notes ?? "");
    const rawItems = q.items;
    setItems(
      Array.isArray(rawItems) && rawItems.length > 0
        ? (rawItems as Record<string, unknown>[]).map((it) => migrateLegacyItem(it))
        : [emptyItem()]
    );
  };

  const updateItem = (index: number, field: keyof GroupQuoteItem, value: string | number) => {
    setItems((prev) => {
      const next = [...prev];
      const it = { ...next[index], [field]: value };
      const recalc = recalcGroupQuoteItem(it);
      next[index] = recalc;
      return next;
    });
  };

  const addItem = () => {
    setItems((prev) => [...prev, emptyItem()]);
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const totals = items.reduce(
    (acc, it) => ({
      net: acc.net + it.netAmount,
      vat: acc.vat + it.vatAmount,
      gross: acc.gross + it.grossAmount,
    }),
    { net: 0, vat: 0, gross: 0 }
  );
  const deposit = parseFloat(depositAmount) || 0;
  const toPay = totals.gross - deposit;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanItems = items
      .filter((it) => it.name.trim())
      .map((it) => recalcGroupQuoteItem(it));
    const itemsToSend = cleanItems.length > 0 ? cleanItems : null;

    const meta: GroupQuoteMeta = {
      clientName: clientName.trim() || null,
      clientNip: clientNip.trim() || null,
      eventDate: eventDate.trim() || null,
      depositAmount: parseFloat(depositAmount) || null,
      notes: notes.trim() || null,
    };

    setSubmitting(true);
    if (editingId) {
      const r = await updateGroupQuote(
        editingId,
        name.trim(),
        validUntil.trim() || null,
        itemsToSend,
        meta
      );
      setSubmitting(false);
      if (r.success) {
        toast.success("Kosztorys zaktualizowany");
        onMutate();
        startNew();
      } else {
        toast.error(r.error);
      }
    } else {
      const r = await createGroupQuote(
        name.trim(),
        validUntil.trim() || null,
        itemsToSend,
        meta
      );
      setSubmitting(false);
      if (r.success) {
        toast.success("Kosztorys utworzony");
        onMutate();
        startNew();
      } else {
        toast.error(r.error);
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Czy na pewno usunąć ten kosztorys?")) return;
    setSubmitting(true);
    const r = await deleteGroupQuote(id);
    setSubmitting(false);
    if (r.success) {
      toast.success("Kosztorys usunięty");
      onMutate();
      if (editingId === id) startNew();
    } else {
      toast.error(r.error);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="rounded-lg border p-6 space-y-4">
        <h2 className="text-lg font-semibold">
          {editingId ? "Edytuj kosztorys" : "Nowy kosztorys"}
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="quote-name">Nazwa kosztorysu</Label>
            <Input
              id="quote-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="np. Konferencja Q1 2026"
              required
            />
          </div>
          <div>
            <Label htmlFor="quote-validUntil">Ważny do (opcjonalnie)</Label>
            <Input
              id="quote-validUntil"
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
            />
          </div>
        </div>

        <div className="rounded border bg-muted/30 p-4 space-y-4">
          <h3 className="text-sm font-medium">Dane klienta / nabywcy</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="quote-clientName">Nazwa klienta / firmy</Label>
              <Input
                id="quote-clientName"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="np. PKP Intercity"
              />
            </div>
            <div>
              <Label htmlFor="quote-clientNip">NIP (opcjonalnie)</Label>
              <Input
                id="quote-clientNip"
                value={clientNip}
                onChange={(e) => setClientNip(e.target.value)}
                placeholder="0000000000"
              />
            </div>
            <div>
              <Label htmlFor="quote-eventDate">Data imprezy</Label>
              <Input
                id="quote-eventDate"
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="quote-depositAmount">Zaliczka (PLN)</Label>
              <Input
                id="quote-depositAmount"
                type="number"
                min={0}
                step={0.01}
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="quote-notes">Uwagi</Label>
            <Textarea
              id="quote-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="np. posiłki dla kierowcy i pilota gratis"
              rows={2}
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label>Pozycje kosztorysu</Label>
            <Button type="button" size="sm" variant="outline" onClick={addItem}>
              <Plus className="h-4 w-4 mr-1" />
              Dodaj pozycję
            </Button>
          </div>
          <div className="overflow-x-auto rounded border">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-2 font-medium">Nazwa usługi</th>
                  <th className="text-left p-2 font-medium w-[60px]">Jedn.</th>
                  <th className="text-right p-2 font-medium w-[70px]">Ilość</th>
                  <th className="text-right p-2 font-medium w-[90px]">Cena netto</th>
                  <th className="text-center p-2 font-medium w-[70px]">VAT %</th>
                  <th className="text-right p-2 font-medium w-[95px]">Wartość netto</th>
                  <th className="text-right p-2 font-medium w-[85px]">Kwota VAT</th>
                  <th className="text-right p-2 font-medium w-[95px]">Wartość brutto</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="p-1">
                      <Input
                        placeholder="Nazwa"
                        value={it.name}
                        onChange={(e) => updateItem(i, "name", e.target.value)}
                        className="h-8 border-0 bg-transparent focus-visible:ring-1"
                      />
                    </td>
                    <td className="p-1">
                      <Input
                        placeholder="os"
                        value={it.unit}
                        onChange={(e) => updateItem(i, "unit", e.target.value)}
                        className="h-8 w-full min-w-[50px]"
                      />
                    </td>
                    <td className="p-1">
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        value={it.quantity || ""}
                        onChange={(e) =>
                          updateItem(i, "quantity", parseFloat(e.target.value) || 0)
                        }
                        className="h-8 text-right"
                      />
                    </td>
                    <td className="p-1">
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={it.unitPriceNet || ""}
                        onChange={(e) =>
                          updateItem(i, "unitPriceNet", parseFloat(e.target.value) || 0)
                        }
                        className="h-8 text-right"
                      />
                    </td>
                    <td className="p-1">
                      <select
                        value={it.vatRate}
                        onChange={(e) =>
                          updateItem(i, "vatRate", parseInt(e.target.value, 10) || 8)
                        }
                        className="h-8 w-full rounded border bg-background text-sm"
                      >
                        {VAT_OPTS.map((v) => (
                          <option key={v} value={v}>
                            {v}%
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2 text-right tabular-nums">
                      {it.netAmount.toFixed(2)}
                    </td>
                    <td className="p-2 text-right tabular-nums">{it.vatAmount.toFixed(2)}</td>
                    <td className="p-2 text-right tabular-nums font-medium">
                      {it.grossAmount.toFixed(2)}
                    </td>
                    <td className="p-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0"
                        onClick={() => removeItem(i)}
                        disabled={items.length <= 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 rounded border bg-muted/30 p-4 flex flex-col gap-2 max-w-sm ml-auto">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Suma netto:</span>
              <span className="tabular-nums">{totals.net.toFixed(2)} PLN</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Suma VAT:</span>
              <span className="tabular-nums">{totals.vat.toFixed(2)} PLN</span>
            </div>
            <div className="flex justify-between font-medium">
              <span>Suma brutto:</span>
              <span className="tabular-nums">{totals.gross.toFixed(2)} PLN</span>
            </div>
            {deposit > 0 && (
              <>
                <div className="flex justify-between text-sm border-t pt-2 mt-1">
                  <span className="text-muted-foreground">Zaliczka:</span>
                  <span className="tabular-nums">-{deposit.toFixed(2)} PLN</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Do zapłaty:</span>
                  <span className="tabular-nums">{toPay.toFixed(2)} PLN</span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={submitting || !name.trim()}>
            {submitting ? "Zapisywanie…" : editingId ? "Zapisz zmiany" : "Dodaj kosztorys"}
          </Button>
          {editingId && (
            <Button type="button" variant="outline" onClick={startNew}>
              Anuluj
            </Button>
          )}
        </div>
      </form>

      <div>
        <h3 className="text-sm font-medium mb-2">Lista kosztorysów</h3>
        {quotes.length === 0 ? (
          <p className="text-muted-foreground text-sm">Brak kosztorysów.</p>
        ) : (
          <ul className="space-y-2">
            {quotes.map((q) => (
              <li
                key={q.id}
                className="flex items-center justify-between gap-4 rounded border px-4 py-3 text-sm"
              >
                <div className="flex-1">
                  <span className="font-medium">{q.name}</span>
                  <span className="ml-2 text-muted-foreground">
                    {q.totalAmount != null ? `${Number(q.totalAmount).toFixed(2)} PLN` : "—"}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => startEdit(q)}
                    disabled={submitting}
                  >
                    Edytuj
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(q.id)}
                    disabled={submitting}
                  >
                    Usuń
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
