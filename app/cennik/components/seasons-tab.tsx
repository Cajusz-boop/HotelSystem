"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getSeasonsFromTable,
  saveSeason,
  deleteSeason,
  copySeasonsFromYearToYear,
  type SeasonRow,
} from "@/app/actions/cennik-pricing";
import { toast } from "sonner";
import { Trash2, Plus, Copy } from "lucide-react";

const currentYear = new Date().getFullYear();

export function SeasonsTab() {
  const [list, setList] = useState<SeasonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(currentYear);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [saving, setSaving] = useState(false);
  const [copyFromYear, setCopyFromYear] = useState(String(currentYear - 1));
  const [copyToYear, setCopyToYear] = useState(String(currentYear));
  const [copying, setCopying] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await getSeasonsFromTable({ year });
    if (res.success && res.data) setList(res.data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [year]);

  const resetForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setName("");
    setColor("");
    setDateFrom("");
    setDateTo("");
  };

  const handleEdit = (row: SeasonRow) => {
    setEditingId(row.id);
    setName(row.name);
    setColor(row.color ?? "");
    setDateFrom(row.dateFrom);
    setDateTo(row.dateTo);
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Nazwa sezonu jest wymagana.");
      return;
    }
    if (!dateFrom || !dateTo) {
      toast.error("Podaj zakres dat.");
      return;
    }
    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    if (to < from) {
      toast.error("Data do nie może być wcześniejsza niż data od.");
      return;
    }
    setSaving(true);
    const res = await saveSeason({
      id: editingId ?? undefined,
      name: name.trim(),
      color: color.trim() || null,
      dateFrom,
      dateTo,
      year,
      isActive: true,
    });
    setSaving(false);
    if (res.success) {
      toast.success(editingId ? "Zaktualizowano sezon." : "Dodano sezon.");
      resetForm();
      load();
    } else {
      toast.error(res.error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Usunąć ten sezon?")) return;
    const res = await deleteSeason(id);
    if (res.success) {
      toast.success("Usunięto.");
      load();
    } else {
      toast.error(res.error);
    }
  };

  const handleCopyYears = async () => {
    const from = parseInt(copyFromYear, 10);
    const to = parseInt(copyToYear, 10);
    if (Number.isNaN(from) || Number.isNaN(to) || from === to) {
      toast.error("Podaj dwa różne lata.");
      return;
    }
    setCopying(true);
    const res = await copySeasonsFromYearToYear(from, to);
    setCopying(false);
    if (res.success && res.data) {
      toast.success(`Skopiowano ${res.data.copied} sezonów z ${from} na ${to}.`);
      setYear(to);
      load();
    } else if (!res.success) {
      toast.error(res.error);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Ładowanie…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Label>Rok</Label>
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value, 10))}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-2 font-medium">Nazwa</th>
              <th className="px-4 py-2 font-medium">Kolor</th>
              <th className="px-4 py-2 font-medium">Od</th>
              <th className="px-4 py-2 font-medium">Do</th>
              <th className="px-4 py-2 font-medium">Aktywny</th>
              <th className="w-24 px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="px-4 py-2 font-medium">{r.name}</td>
                <td className="px-4 py-2">
                  {r.color ? (
                    <span
                      className="inline-block h-5 w-8 rounded border border-border"
                      style={{ backgroundColor: r.color }}
                      title={r.color}
                    />
                  ) : (
                    "–"
                  )}
                </td>
                <td className="px-4 py-2">{r.dateFrom}</td>
                <td className="px-4 py-2">{r.dateTo}</td>
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
          Nowy sezon
        </Button>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-4 rounded-lg border bg-card p-4">
          <div className="space-y-1">
            <Label>Nazwa</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="np. Sezon wysoki" className="w-40" />
          </div>
          <div className="space-y-1">
            <Label>Kolor (#)</Label>
            <Input value={color} onChange={(e) => setColor(e.target.value)} placeholder="#FF5733" className="w-28" />
          </div>
          <div className="space-y-1">
            <Label>Data od</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36" />
          </div>
          <div className="space-y-1">
            <Label>Data do</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36" />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>{saving ? "…" : editingId ? "Zapisz" : "Dodaj"}</Button>
            <Button type="button" variant="outline" onClick={resetForm}>Anuluj</Button>
          </div>
        </form>
      )}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 p-3">
        <span className="text-sm text-muted-foreground">Kopiuj sezony z roku:</span>
        <Input
          type="number"
          min={2020}
          max={2030}
          value={copyFromYear}
          onChange={(e) => setCopyFromYear(e.target.value)}
          className="w-20"
        />
        <span className="text-sm">na</span>
        <Input
          type="number"
          min={2020}
          max={2030}
          value={copyToYear}
          onChange={(e) => setCopyToYear(e.target.value)}
          className="w-20"
        />
        <Button size="sm" variant="outline" disabled={copying} onClick={handleCopyYears}>
          <Copy className="mr-1 h-4 w-4" />
          {copying ? "…" : "Kopiuj"}
        </Button>
      </div>
    </div>
  );
}
