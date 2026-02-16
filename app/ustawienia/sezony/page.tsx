"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSeasons, updateSeasons, type SeasonEntry, type SeasonType } from "@/app/actions/seasons";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Save } from "lucide-react";

function generateId(): string {
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function SezonyPage() {
  const [seasons, setSeasons] = useState<SeasonEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const result = await getSeasons();
      if (result.success && result.data) {
        setSeasons(result.data);
      } else {
        toast.error("error" in result ? (result.error ?? "Błąd ładowania sezonów") : "Błąd ładowania sezonów");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updateEntry = (index: number, patch: Partial<SeasonEntry>) => {
    const next = [...seasons];
    next[index] = { ...next[index]!, ...patch };
    setSeasons(next);
  };

  const addSeason = () => {
    setSeasons([
      ...seasons,
      {
        id: generateId(),
        name: "Nowy sezon",
        type: "PEAK",
        dateFrom: "06-01",
        dateTo: "08-31",
      },
    ]);
  };

  const removeSeason = (index: number) => {
    setSeasons(seasons.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await updateSeasons(seasons);
      if (result.success) {
        toast.success("Sezony zapisane");
      } else {
        toast.error("error" in result ? (result.error ?? "Błąd zapisu") : "Błąd zapisu");
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="text-muted-foreground">Ładowanie…</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/ustawienia">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Sezony (peak / off-peak)</h1>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? "Zapisywanie…" : "Zapisz"}
        </Button>
      </div>

      <p className="text-muted-foreground mb-6">
        Określ okresy sezonu wysokiego (peak) i niskiego (off-peak) – daty w formacie MM-DD (bez roku). Używane w cenniku i raportach.
      </p>

      <div className="space-y-4">
        {seasons.map((entry, index) => (
          <div
            key={entry.id}
            className="flex flex-wrap items-end gap-3 p-4 rounded-lg border bg-card"
          >
            <div className="flex-1 min-w-[140px] space-y-1">
              <Label>Nazwa</Label>
              <Input
                value={entry.name}
                onChange={(e) => updateEntry(index, { name: e.target.value })}
                placeholder="np. Sezon letni"
              />
            </div>
            <div className="w-[140px] space-y-1">
              <Label>Typ</Label>
              <Select
                value={entry.type}
                onValueChange={(v) => updateEntry(index, { type: v as SeasonType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PEAK">Wysoki (peak)</SelectItem>
                  <SelectItem value="OFF_PEAK">Niski (off-peak)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-[100px] space-y-1">
              <Label>Od (MM-DD)</Label>
              <Input
                value={entry.dateFrom}
                onChange={(e) => updateEntry(index, { dateFrom: e.target.value })}
                placeholder="06-01"
                maxLength={5}
              />
            </div>
            <div className="w-[100px] space-y-1">
              <Label>Do (MM-DD)</Label>
              <Input
                value={entry.dateTo}
                onChange={(e) => updateEntry(index, { dateTo: e.target.value })}
                placeholder="08-31"
                maxLength={5}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive"
              onClick={() => removeSeason(index)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" onClick={addSeason}>
          <Plus className="w-4 h-4 mr-2" />
          Dodaj sezon
        </Button>
      </div>
    </div>
  );
}
