"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getDerivedRules, createDerivedRule } from "@/app/actions/derived-rates";
import { toast } from "sonner";

export default function RegulyPochodnePage() {
  const [rules, setRules] = useState<Array<{ id: string; name: string; type: string; value: number; description: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [type, setType] = useState<"PERCENT_ADD" | "FIXED_ADD">("FIXED_ADD");
  const [value, setValue] = useState("");
  const [adding, setAdding] = useState(false);

  const load = async () => {
    setLoading(true);
    const r = await getDerivedRules();
    if (r.success && r.data) setRules(r.data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(value.replace(",", "."));
    if (!name.trim() || Number.isNaN(num) || num < 0) {
      toast.error("Nazwa i wartość (≥ 0) są wymagane.");
      return;
    }
    setAdding(true);
    const r = await createDerivedRule({
      name: name.trim(),
      type,
      value: num,
    });
    setAdding(false);
    if (r.success && r.data) {
      setRules((prev) => [...prev, r.data!]);
      setName("");
      setValue("");
      toast.success("Reguła dodana.");
    } else {
      toast.error(r.error ?? "Błąd");
    }
  };

  return (
    <div className="p-8">
      <div className="mb-6 flex gap-2 text-sm text-muted-foreground">
        <Link href="/cennik" className="hover:text-foreground">Cennik</Link>
        <span>/</span>
        <span>Reguły pochodne</span>
      </div>
      <h1 className="text-2xl font-semibold mb-6">Cennik pochodny – reguły</h1>
      <p className="text-muted-foreground mb-6">
        Reguły dodają do ceny bazowej: procent (np. +10% śniadanie) lub kwotę (np. +40 PLN). Używane przy wycenie rezerwacji.
      </p>
      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-4 mb-6 rounded-lg border bg-card p-4">
        <div>
          <Label>Nazwa</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="np. Śniadanie" className="w-40 mt-1" />
        </div>
        <div>
          <Label>Typ</Label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as "PERCENT_ADD" | "FIXED_ADD")}
            className="mt-1 h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="FIXED_ADD">Kwota (PLN)</option>
            <option value="PERCENT_ADD">Procent (%)</option>
          </select>
        </div>
        <div>
          <Label>Wartość</Label>
          <Input type="text" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="40" className="w-24 mt-1" />
        </div>
        <Button type="submit" disabled={adding}>{adding ? "…" : "Dodaj"}</Button>
      </form>
      {loading ? (
        <p className="text-muted-foreground">Ładowanie…</p>
      ) : (
        <ul className="space-y-2">
          {rules.map((r) => (
            <li key={r.id} className="flex justify-between items-center rounded border px-4 py-2 text-sm">
              <span className="font-medium">{r.name}</span>
              <span>{r.type === "PERCENT_ADD" ? `${r.value}%` : `${r.value} PLN`}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
