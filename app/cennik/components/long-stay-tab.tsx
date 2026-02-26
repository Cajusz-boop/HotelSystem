"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getLongStayDiscounts,
  saveLongStayDiscount,
  deleteLongStayDiscount,
  type LongStayDiscountRow,
} from "@/app/actions/cennik-pricing";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";

export function LongStayTab() {
  const [list, setList] = useState<LongStayDiscountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [minNights, setMinNights] = useState("");
  const [discountPercent, setDiscountPercent] = useState("");
  const [discountFixed, setDiscountFixed] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await getLongStayDiscounts();
    if (res.success && res.data) setList(res.data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setMinNights("");
    setDiscountPercent("");
    setDiscountFixed("");
  };

  const handleEdit = (row: LongStayDiscountRow) => {
    setEditingId(row.id);
    setMinNights(String(row.minNights));
    setDiscountPercent(row.discountPercent != null ? String(row.discountPercent) : "");
    setDiscountFixed(row.discountFixed != null ? String(row.discountFixed) : "");
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nights = parseInt(minNights, 10);
    if (Number.isNaN(nights) || nights < 1) {
      toast.error("Min. liczba nocy musi być ≥ 1.");
      return;
    }
    const pct = discountPercent.trim() ? parseFloat(discountPercent.replace(",", ".")) : null;
    const fix = discountFixed.trim() ? parseFloat(discountFixed.replace(",", ".")) : null;
    if (pct == null && fix == null) {
      toast.error("Podaj rabat procentowy lub kwotowy.");
      return;
    }
    setSaving(true);
    const res = await saveLongStayDiscount({
      minNights: nights,
      discountPercent: pct ?? undefined,
      discountFixed: fix ?? undefined,
      isActive: true,
    });
    setSaving(false);
    if (res.success) {
      toast.success(editingId ? "Zaktualizowano próg." : "Dodano próg rabatowy.");
      resetForm();
      load();
    } else {
      toast.error(res.error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Usunąć ten próg rabatowy?")) return;
    const res = await deleteLongStayDiscount(id);
    if (res.success) {
      toast.success("Usunięto.");
      load();
    } else {
      toast.error(res.error);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Ładowanie…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-2 font-medium">Min. noce</th>
              <th className="px-4 py-2 font-medium">Rabat</th>
              <th className="px-4 py-2 font-medium">Aktywny</th>
              <th className="w-24 px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="px-4 py-2 font-medium">{r.minNights}</td>
                <td className="px-4 py-2">
                  {r.discountPercent != null && `${r.discountPercent}%`}
                  {r.discountPercent != null && r.discountFixed != null && " / "}
                  {r.discountFixed != null && `${r.discountFixed} PLN/dobę`}
                  {r.discountPercent == null && r.discountFixed == null && "–"}
                </td>
                <td className="px-4 py-2">{r.isActive ? "Tak" : "Nie"}</td>
                <td className="px-4 py-2">
                  <div className="flex gap-1">
                    <Button type="button" variant="ghost" size="sm" onClick={() => handleEdit(r)}>Edytuj</Button>
                    <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(r.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!formOpen ? (
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nowy próg rabatowy
        </Button>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-4 rounded-lg border bg-card p-4">
          <div className="space-y-1">
            <Label>Min. liczba nocy</Label>
            <Input
              type="number"
              min={1}
              value={minNights}
              onChange={(e) => setMinNights(e.target.value)}
              placeholder="7"
              className="w-24"
            />
          </div>
          <div className="space-y-1">
            <Label>Rabat (%)</Label>
            <Input
              type="text"
              inputMode="decimal"
              value={discountPercent}
              onChange={(e) => setDiscountPercent(e.target.value)}
              placeholder="10"
              className="w-20"
            />
          </div>
          <div className="space-y-1">
            <Label>Rabat (PLN/dobę)</Label>
            <Input
              type="text"
              inputMode="decimal"
              value={discountFixed}
              onChange={(e) => setDiscountFixed(e.target.value)}
              placeholder="opcjonalnie"
              className="w-24"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>{saving ? "…" : editingId ? "Zapisz" : "Dodaj"}</Button>
            <Button type="button" variant="outline" onClick={resetForm}>Anuluj</Button>
          </div>
        </form>
      )}
      <p className="text-xs text-muted-foreground">
        Stosowany jest najwyższy pasujący próg (np. pobyt 10 nocy → rabat za 7 nocy). Rabaty nie kumulują się.
      </p>
    </div>
  );
}
