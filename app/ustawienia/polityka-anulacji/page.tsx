"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getCancellationPolicyTemplates,
  updateCancellationPolicyTemplates,
  type CancellationPolicyTemplate,
} from "@/app/actions/cancellation-policy";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Save } from "lucide-react";

function generateId(): string {
  return `cpt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function PolitykaAnulacjiPage() {
  const [templates, setTemplates] = useState<CancellationPolicyTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const result = await getCancellationPolicyTemplates();
      if (result.success && result.data) {
        setTemplates(result.data);
      } else {
        toast.error("error" in result ? (result.error ?? "Błąd ładowania szablonów") : "Błąd ładowania szablonów");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updateEntry = (index: number, patch: Partial<CancellationPolicyTemplate>) => {
    const next = [...templates];
    next[index] = { ...next[index]!, ...patch };
    setTemplates(next);
  };

  const addTemplate = () => {
    setTemplates([
      ...templates,
      {
        id: generateId(),
        name: "Nowa polityka",
        freeUntilDaysBefore: 3,
        penaltyPercent: 50,
        description: "",
      },
    ]);
  };

  const removeTemplate = (index: number) => {
    setTemplates(templates.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await updateCancellationPolicyTemplates(templates);
      if (result.success) {
        toast.success("Szablony polityki anulacji zapisane");
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
          <h1 className="text-2xl font-bold">Polityka anulacji (szablony)</h1>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? "Zapisywanie…" : "Zapisz"}
        </Button>
      </div>

      <p className="text-muted-foreground mb-6">
        Szablony polityki anulacji: bezpłatna anulacja do X dni przed przyjazdem; później Y% opłaty. Używane przy rezerwacjach i w warunkach.
      </p>

      <div className="space-y-4">
        {templates.map((entry, index) => (
          <div
            key={entry.id}
            className="flex flex-wrap gap-3 p-4 rounded-lg border bg-card"
          >
            <div className="flex-1 min-w-[180px] space-y-1">
              <Label>Nazwa</Label>
              <Input
                value={entry.name}
                onChange={(e) => updateEntry(index, { name: e.target.value })}
                placeholder="np. Standardowa"
              />
            </div>
            <div className="w-[140px] space-y-1">
              <Label>Bezpłatna anulacja do (dni przed)</Label>
              <Input
                type="number"
                min={0}
                value={entry.freeUntilDaysBefore}
                onChange={(e) =>
                  updateEntry(index, { freeUntilDaysBefore: parseInt(e.target.value, 10) || 0 })
                }
                placeholder="3"
              />
            </div>
            <div className="w-[120px] space-y-1">
              <Label>Kara później (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={entry.penaltyPercent}
                onChange={(e) =>
                  updateEntry(index, { penaltyPercent: parseInt(e.target.value, 10) || 0 })
                }
                placeholder="50"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-destructive hover:text-destructive shrink-0"
              onClick={() => removeTemplate(index)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
            <div className="w-full space-y-1">
              <Label>Opis (opcjonalnie)</Label>
              <Textarea
                value={entry.description ?? ""}
                onChange={(e) => updateEntry(index, { description: e.target.value })}
                placeholder="np. Bezpłatna anulacja do 3 dni przed przyjazdem. Później 50% ceny."
                rows={2}
                className="resize-none"
              />
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" onClick={addTemplate}>
          <Plus className="w-4 h-4 mr-2" />
          Dodaj szablon
        </Button>
      </div>
    </div>
  );
}
