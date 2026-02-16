"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getReservationDictionaries,
  updateReservationDictionaries,
  type ReservationDictionaries,
  type DictionaryEntry,
} from "@/app/actions/dictionaries";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Save } from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

const TAB_LABELS: Record<keyof ReservationDictionaries, string> = {
  sources: "Źródła rezerwacji",
  channels: "Kanały sprzedaży",
  segments: "Segmenty rynkowe",
  cancellationReasons: "Powody anulacji",
};

function DictionaryEditor({
  entries,
  onChange,
  title,
}: {
  entries: DictionaryEntry[];
  onChange: (entries: DictionaryEntry[]) => void;
  title: string;
}) {
  const updateEntry = (index: number, patch: Partial<DictionaryEntry>) => {
    const next = [...entries];
    next[index] = { ...next[index]!, ...patch };
    onChange(next);
  };

  const addEntry = () => {
    onChange([...entries, { code: "", label: "" }]);
  };

  const removeEntry = (index: number) => {
    onChange(entries.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
        <Button type="button" variant="outline" size="sm" onClick={addEntry}>
          <Plus className="w-4 h-4 mr-2" />
          Dodaj
        </Button>
      </div>
      <div className="space-y-2">
        {entries.map((entry, index) => (
          <div key={index} className="flex gap-2 items-center">
            <Input
              placeholder="Kod (np. BOOKING_COM)"
              value={entry.code}
              onChange={(e) => updateEntry(index, { code: e.target.value })}
              className="max-w-[200px] font-mono text-sm"
            />
            <Input
              placeholder="Etykieta (np. Booking.com)"
              value={entry.label}
              onChange={(e) => updateEntry(index, { label: e.target.value })}
              className="flex-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive"
              onClick={() => removeEntry(index)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
        {entries.length === 0 && (
          <p className="text-sm text-muted-foreground">Brak wpisów. Kliknij „Dodaj”, aby dodać pozycję.</p>
        )}
      </div>
    </div>
  );
}

export default function SlownikiPage() {
  const [config, setConfig] = useState<ReservationDictionaries | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const result = await getReservationDictionaries();
      if (result.success && result.data) {
        setConfig(result.data);
      } else {
        toast.error("error" in result ? (result.error ?? "Błąd ładowania słowników") : "Błąd ładowania słowników");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const setDictionary = <K extends keyof ReservationDictionaries>(
    key: K,
    entries: DictionaryEntry[]
  ) => {
    setConfig((prev) => (prev ? { ...prev, [key]: entries } : null));
  };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const result = await updateReservationDictionaries(config);
      if (result.success) {
        toast.success("Słowniki zapisane");
      } else {
        toast.error("error" in result ? (result.error ?? "Błąd zapisu") : "Błąd zapisu");
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading || !config) {
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
          <h1 className="text-2xl font-bold">Słowniki rezerwacji</h1>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? "Zapisywanie…" : "Zapisz"}
        </Button>
      </div>

      <p className="text-muted-foreground mb-6">
        Źródła rezerwacji, kanały sprzedaży, segmenty rynkowe i powody anulacji – używane w formularzach rezerwacji i raportach.
      </p>

      <Tabs defaultValue="sources" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          {(Object.keys(TAB_LABELS) as (keyof ReservationDictionaries)[]).map((key) => (
            <TabsTrigger key={key} value={key}>
              {TAB_LABELS[key]}
            </TabsTrigger>
          ))}
        </TabsList>
        {(Object.keys(TAB_LABELS) as (keyof ReservationDictionaries)[]).map((key) => (
          <TabsContent key={key} value={key}>
            <div className="rounded-lg border bg-card p-6">
              <DictionaryEditor
                entries={config[key]}
                onChange={(entries) => setDictionary(key, entries)}
                title={TAB_LABELS[key]}
              />
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
