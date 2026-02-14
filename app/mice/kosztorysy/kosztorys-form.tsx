"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  createGroupQuote,
  updateGroupQuote,
  deleteGroupQuote,
  type GroupQuoteItem,
} from "@/app/actions/mice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

interface GroupQuoteForForm {
  id: string;
  name: string;
  validUntil: string | null;
  totalAmount: number | null;
  items: GroupQuoteItem[] | null;
}

export function KosztorysForm({ quotes }: { quotes: GroupQuoteForForm[] }) {
  const router = useRouter();
  const onMutate = () => router.refresh();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [items, setItems] = useState<GroupQuoteItem[]>([
    { name: "", quantity: 1, unitPrice: 0, amount: 0 },
  ]);
  const [submitting, setSubmitting] = useState(false);

  const startNew = () => {
    setEditingId(null);
    setName("");
    setValidUntil("");
    setItems([{ name: "", quantity: 1, unitPrice: 0, amount: 0 }]);
  };

  const startEdit = (q: GroupQuoteForForm) => {
    setEditingId(q.id);
    setName(q.name);
    setValidUntil(q.validUntil ? q.validUntil.slice(0, 10) : "");
    const rawItems = q.items;
    setItems(
      Array.isArray(rawItems) && rawItems.length > 0
        ? (rawItems as GroupQuoteItem[]).map((it) => ({
            name: String(it.name ?? ""),
            quantity: Number(it.quantity ?? 1),
            unitPrice: Number(it.unitPrice ?? 0),
            amount: Number(it.amount ?? 0),
          }))
        : [{ name: "", quantity: 1, unitPrice: 0, amount: 0 }]
    );
  };

  const updateItem = (index: number, field: keyof GroupQuoteItem, value: string | number) => {
    setItems((prev) => {
      const next = [...prev];
      const it = { ...next[index], [field]: value };
      if (field === "quantity" || field === "unitPrice") {
        it.amount = Number(it.quantity) * Number(it.unitPrice);
      }
      next[index] = it;
      return next;
    });
  };

  const addItem = () => {
    setItems((prev) => [...prev, { name: "", quantity: 1, unitPrice: 0, amount: 0 }]);
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanItems = items
      .filter((it) => it.name.trim())
      .map((it) => ({
        name: it.name.trim(),
        quantity: Number(it.quantity) || 1,
        unitPrice: Number(it.unitPrice) || 0,
        amount: Number(it.amount) || Number(it.quantity) * Number(it.unitPrice),
      }));
    const itemsToSend = cleanItems.length > 0 ? cleanItems : null;

    setSubmitting(true);
    if (editingId) {
      const r = await updateGroupQuote(
        editingId,
        name.trim(),
        validUntil.trim() || null,
        itemsToSend
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
      const r = await createGroupQuote(name.trim(), validUntil.trim() || null, itemsToSend);
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
        <div>
          <Label htmlFor="quote-name">Nazwa</Label>
          <Input
            id="quote-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="np. Konferencja Q1 2026"
            required
            className="max-w-md"
          />
        </div>
        <div>
          <Label htmlFor="quote-validUntil">Ważny do (opcjonalnie)</Label>
          <Input
            id="quote-validUntil"
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            className="max-w-xs"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label>Pozycje</Label>
            <Button type="button" size="sm" variant="outline" onClick={addItem}>
              <Plus className="h-4 w-4 mr-1" />
              Dodaj pozycję
            </Button>
          </div>
          <div className="space-y-2 rounded border p-3">
            {items.map((it, i) => (
              <div key={i} className="flex flex-wrap items-end gap-2">
                <Input
                  placeholder="Nazwa"
                  value={it.name}
                  onChange={(e) => updateItem(i, "name", e.target.value)}
                  className="flex-1 min-w-[120px]"
                />
                <Input
                  type="number"
                  min={0}
                  step={1}
                  placeholder="Ilość"
                  value={it.quantity || ""}
                  onChange={(e) => updateItem(i, "quantity", e.target.value)}
                  className="w-20"
                />
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="Cena jedn."
                  value={it.unitPrice || ""}
                  onChange={(e) => updateItem(i, "unitPrice", e.target.value)}
                  className="w-24"
                />
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="Kwota"
                  value={it.amount || ""}
                  onChange={(e) => updateItem(i, "amount", parseFloat(e.target.value) || 0)}
                  className="w-24"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => removeItem(i)}
                  disabled={items.length <= 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
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
