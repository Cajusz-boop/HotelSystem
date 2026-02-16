"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getMinibarItems,
  createMinibarItem,
  deleteMinibarItem,
} from "@/app/actions/minibar";
import { toast } from "sonner";
import Link from "next/link";

export default function MinibarPage() {
  const [items, setItems] = useState<Array<{ id: string; name: string; price: number; unit: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [unit, setUnit] = useState("szt");
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    getMinibarItems()
      .then((r) => {
        if (r.success && r.data) setItems(r.data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseFloat(price.replace(",", "."));
    if (!name.trim()) {
      toast.error("Podaj nazwę");
      return;
    }
    if (!Number.isFinite(p) || p < 0) {
      toast.error("Podaj prawidłową cenę");
      return;
    }
    setSaving(true);
    try {
      const result = await createMinibarItem({ name: name.trim(), price: p, unit });
      if (result.success) {
        toast.success("Pozycja dodana");
        setName("");
        setPrice("");
        setUnit("szt");
        load();
      } else {
        toast.error(result.error ?? "Błąd");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Usunąć pozycję?")) return;
    const result = await deleteMinibarItem(id);
    if (result.success) {
      toast.success("Usunięto");
      load();
    } else {
      toast.error(result.error ?? "Błąd");
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6 md:p-8">
      <div className="flex items-center gap-4">
        <Link href="/housekeeping" className="text-sm text-primary hover:underline">
          ← Housekeeping
        </Link>
        <h1 className="text-2xl font-semibold">Minibar – pozycje</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Pozycje minibaru są używane przy „Dolicz minibar do rachunku” w menu rezerwacji (PPM na pasku).
      </p>
      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
        <div>
          <Label htmlFor="minibarName" className="text-xs">Nazwa</Label>
          <Input
            id="minibarName"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="np. Cola 0.33"
            className="mt-1 w-40"
          />
        </div>
        <div>
          <Label htmlFor="minibarPrice" className="text-xs">Cena (PLN)</Label>
          <Input
            id="minibarPrice"
            type="number"
            min={0}
            step={0.01}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="mt-1 w-24"
          />
        </div>
        <div>
          <Label htmlFor="minibarUnit" className="text-xs">Jednostka</Label>
          <Input
            id="minibarUnit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="szt"
            className="mt-1 w-20"
          />
        </div>
        <Button type="submit" disabled={saving}>
          {saving ? "Zapisywanie…" : "Dodaj"}
        </Button>
      </form>
      {loading ? (
        <p className="text-sm text-muted-foreground">Ładowanie…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Brak pozycji. Dodaj pierwszą powyżej.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((i) => (
            <li
              key={i.id}
              className="flex items-center justify-between rounded-md border px-4 py-2"
            >
              <span className="font-medium">{i.name}</span>
              <span className="text-muted-foreground">{i.price.toFixed(2)} PLN / {i.unit}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => handleDelete(i.id)}
              >
                Usuń
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
