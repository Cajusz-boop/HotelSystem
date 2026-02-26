"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getAssortmentItems,
  createAssortmentItem,
  updateAssortmentItem,
  deleteAssortmentItem,
  type AssortmentItemData,
} from "@/app/actions/assortment";
import { toast } from "sonner";
import { Package, ArrowLeft, Plus, Pencil, Trash2, RefreshCw } from "lucide-react";

const CATEGORIES = [
  { value: "", label: "—" },
  { value: "ACCOMMODATION", label: "Nocleg" },
  { value: "F_B", label: "Gastronomia" },
  { value: "SPA", label: "Spa" },
  { value: "PARKING", label: "Parking" },
  { value: "OTHER", label: "Inne" },
];

export default function AsortymentPage() {
  const [items, setItems] = useState<AssortmentItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    defaultPrice: 0,
    vatRate: 8,
    gtuCode: "",
    category: "",
  });

  const load = async () => {
    setLoading(true);
    try {
      const result = await getAssortmentItems();
      if (result.success && result.data) setItems(result.data);
      else toast.error("error" in result ? result.error : "Błąd ładowania");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setForm({
      name: "",
      defaultPrice: 0,
      vatRate: 8,
      gtuCode: "",
      category: "",
    });
    setShowForm(false);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) {
        const result = await updateAssortmentItem(editingId, {
          name: form.name,
          defaultPrice: form.defaultPrice,
          vatRate: form.vatRate,
          gtuCode: form.gtuCode || null,
          category: form.category || null,
        });
        if (result.success) {
          toast.success("Pozycja zaktualizowana");
          setItems((prev) => prev.map((i) => (i.id === editingId ? result.data! : i)));
          resetForm();
        } else toast.error(result.error);
      } else {
        const result = await createAssortmentItem({
          name: form.name,
          defaultPrice: form.defaultPrice,
          vatRate: form.vatRate,
          gtuCode: form.gtuCode || null,
          category: form.category || null,
        });
        if (result.success) {
          toast.success("Pozycja dodana");
          setItems((prev) => [...prev, result.data!]);
          resetForm();
        } else toast.error(result.error);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (item: AssortmentItemData) => {
    setForm({
      name: item.name,
      defaultPrice: item.defaultPrice,
      vatRate: item.vatRate,
      gtuCode: item.gtuCode ?? "",
      category: item.category ?? "",
    });
    setEditingId(item.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Usunąć tę pozycję asortymentu?")) return;
    const result = await deleteAssortmentItem(id);
    if (result.success) {
      toast.success("Pozycja usunięta");
      setItems((prev) => prev.filter((i) => i.id !== id));
    } else toast.error(result.error);
  };

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Package className="w-6 h-6" />
          <h1 className="text-2xl font-bold">Asortyment (baza do fakturowania)</h1>
        </div>
        <p className="text-muted-foreground">Ładowanie...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Package className="w-6 h-6" />
          <h1 className="text-2xl font-bold">Asortyment (baza do fakturowania)</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Odśwież
          </Button>
          <Button
            variant={showForm ? "secondary" : "default"}
            onClick={() => {
              setShowForm((v) => !v);
              if (showForm) resetForm();
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            {showForm ? "Anuluj" : "Dodaj pozycję"}
          </Button>
          <Link href="/ustawienia">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Powrót
            </Button>
          </Link>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 p-4 border rounded-lg bg-muted/30 space-y-4"
        >
          <h2 className="font-semibold">
            {editingId ? "Edycja pozycji" : "Nowa pozycja"}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Nazwa *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="np. Nocleg, Śniadanie"
                required
              />
            </div>
            <div>
              <Label>Cena domyślna (PLN)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={form.defaultPrice || ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, defaultPrice: Number(e.target.value) || 0 }))
                }
              />
            </div>
            <div>
              <Label>Stawka VAT (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={form.vatRate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, vatRate: Number(e.target.value) || 0 }))
                }
              />
            </div>
            <div>
              <Label>Kod GTU</Label>
              <Input
                value={form.gtuCode}
                onChange={(e) => setForm((f) => ({ ...f, gtuCode: e.target.value }))}
                placeholder="np. GTU_11"
              />
            </div>
            <div>
              <Label>Kategoria</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value || "empty"} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Zapisywanie…" : editingId ? "Zapisz" : "Dodaj"}
            </Button>
            <Button type="button" variant="outline" onClick={resetForm}>
              Anuluj
            </Button>
          </div>
        </form>
      )}

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left p-3 font-medium">Nazwa</th>
              <th className="text-right p-3 font-medium">Cena (PLN)</th>
              <th className="text-right p-3 font-medium">VAT %</th>
              <th className="text-left p-3 font-medium">GTU</th>
              <th className="text-left p-3 font-medium">Kategoria</th>
              <th className="w-20 p-3" />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-4 text-center text-muted-foreground">
                  Brak pozycji. Kliknij „Dodaj pozycję”, aby dodać pierwszą.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-t">
                  <td className="p-3">{item.name}</td>
                  <td className="p-3 text-right tabular-nums">
                    {item.defaultPrice.toFixed(2)}
                  </td>
                  <td className="p-3 text-right">{item.vatRate}%</td>
                  <td className="p-3">{item.gtuCode ?? "—"}</td>
                  <td className="p-3">
                    {CATEGORIES.find((c) => c.value === item.category)?.label ?? item.category ?? "—"}
                  </td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEdit(item)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleDelete(item.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
