"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getServiceRates,
  saveServiceRate,
  deleteServiceRate,
  type ServiceRateRow,
} from "@/app/actions/cennik-pricing";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";

const CALC_METHODS: { value: string; label: string }[] = [
  { value: "PER_NIGHT", label: "Za dobę" },
  { value: "PER_STAY", label: "Za pobyt" },
  { value: "PER_PERSON_PER_NIGHT", label: "Za osobo-dobę" },
  { value: "ONE_TIME", label: "Jednorazowo" },
];

export function ServiceRatesTab() {
  const [list, setList] = useState<ServiceRateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [price, setPrice] = useState("");
  const [calculationMethod, setCalculationMethod] = useState("PER_NIGHT");
  const [vatRate, setVatRate] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await getServiceRates();
    if (res.success && res.data) setList(res.data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setName("");
    setCode("");
    setPrice("");
    setCalculationMethod("PER_NIGHT");
    setVatRate("");
  };

  const handleEdit = (row: ServiceRateRow) => {
    setEditingId(row.id);
    setName(row.name);
    setCode(row.code);
    setPrice(String(row.price));
    setCalculationMethod(row.calculationMethod);
    setVatRate(row.vatRate != null ? String(row.vatRate) : "");
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = parseFloat(price.replace(",", "."));
    if (Number.isNaN(priceNum) || priceNum < 0) {
      toast.error("Wprowadź poprawną cenę.");
      return;
    }
    if (!name.trim() || !code.trim()) {
      toast.error("Nazwa i kod są wymagane.");
      return;
    }
    setSaving(true);
    const res = await saveServiceRate({
      id: editingId ?? undefined,
      name: name.trim(),
      code: code.trim().toUpperCase(),
      price: priceNum,
      calculationMethod,
      vatRate: vatRate.trim() ? parseFloat(vatRate.replace(",", ".")) : null,
      isActive: true,
    });
    setSaving(false);
    if (res.success) {
      toast.success(editingId ? "Zaktualizowano usługę." : "Dodano usługę.");
      resetForm();
      load();
    } else {
      toast.error(res.error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Usunąć tę usługę?")) return;
    const res = await deleteServiceRate(id);
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
              <th className="px-4 py-2 font-medium">Nazwa</th>
              <th className="px-4 py-2 font-medium">Kod</th>
              <th className="px-4 py-2 font-medium">Cena</th>
              <th className="px-4 py-2 font-medium">Naliczanie</th>
              <th className="px-4 py-2 font-medium">VAT</th>
              <th className="w-24 px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="px-4 py-2">{r.name}</td>
                <td className="px-4 py-2 font-mono text-muted-foreground">{r.code}</td>
                <td className="px-4 py-2">{r.price.toFixed(2)} PLN</td>
                <td className="px-4 py-2">
                  {CALC_METHODS.find((m) => m.value === r.calculationMethod)?.label ?? r.calculationMethod}
                </td>
                <td className="px-4 py-2">{r.vatRate != null ? `${r.vatRate}%` : "–"}</td>
                <td className="px-4 py-2">
                  <div className="flex gap-1">
                    <Button type="button" variant="ghost" size="sm" onClick={() => handleEdit(r)}>
                      Edytuj
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => handleDelete(r.id)}
                    >
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
          Nowa usługa
        </Button>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-4 rounded-lg border bg-card p-4">
          <div className="space-y-1">
            <Label>Nazwa</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="np. Parking" className="w-40" />
          </div>
          <div className="space-y-1">
            <Label>Kod</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="PARKING" className="w-28" />
          </div>
          <div className="space-y-1">
            <Label>Cena (PLN)</Label>
            <Input
              type="text"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0"
              className="w-24"
            />
          </div>
          <div className="space-y-1">
            <Label>Naliczanie</Label>
            <select
              value={calculationMethod}
              onChange={(e) => setCalculationMethod(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              {CALC_METHODS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>VAT (%)</Label>
            <Input
              type="text"
              inputMode="decimal"
              value={vatRate}
              onChange={(e) => setVatRate(e.target.value)}
              placeholder="23"
              className="w-16"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>{saving ? "…" : editingId ? "Zapisz" : "Dodaj"}</Button>
            <Button type="button" variant="outline" onClick={resetForm}>Anuluj</Button>
          </div>
        </form>
      )}
      <p className="text-xs text-muted-foreground">
        Za dobę = cena × liczba nocy. Za pobyt = jednorazowo. Za osobo-dobę = cena × osoby × noce. Jednorazowo = przy zameldowaniu.
      </p>
    </div>
  );
}
