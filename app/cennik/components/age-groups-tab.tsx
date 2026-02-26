"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getAgeGroupConfig,
  saveAgeGroupConfig,
  type AgeGroupConfigRow,
} from "@/app/actions/cennik-pricing";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

const GROUPS = [
  { key: "ADULT", defaultLabel: "Dorosły", defaultFrom: 18, defaultTo: 99 },
  { key: "CHILD1", defaultLabel: "Dziecko 0-6", defaultFrom: 0, defaultTo: 6 },
  { key: "CHILD2", defaultLabel: "Dziecko 7-12", defaultFrom: 7, defaultTo: 12 },
  { key: "CHILD3", defaultLabel: "Dziecko 13-17", defaultFrom: 13, defaultTo: 17 },
];

export function AgeGroupsTab() {
  const [list, setList] = useState<AgeGroupConfigRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Record<string, { label: string; ageFrom: string; ageTo: string }>>({});

  const load = async () => {
    setLoading(true);
    const res = await getAgeGroupConfig();
    if (res.success && res.data) {
      setList(res.data);
      const next: Record<string, { label: string; ageFrom: string; ageTo: string }> = {};
      GROUPS.forEach((g) => {
        const row = res.data!.find((r) => r.group === g.key);
        next[g.key] = {
          label: row?.label ?? g.defaultLabel,
          ageFrom: String(row?.ageFrom ?? g.defaultFrom),
          ageTo: String(row?.ageTo ?? g.defaultTo),
        };
      });
      setEditing(next);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleSave = async () => {
    const groups = GROUPS.map((g) => {
      const e = editing[g.key];
      return {
        group: g.key,
        label: e?.label?.trim() || g.defaultLabel,
        ageFrom: parseInt(e?.ageFrom ?? String(g.defaultFrom), 10) || 0,
        ageTo: parseInt(e?.ageTo ?? String(g.defaultTo), 10) || 99,
      };
    });
    if (groups.some((g) => g.ageFrom > g.ageTo)) {
      toast.error("Wiek „od” nie może być większy niż „do”.");
      return;
    }
    setSaving(true);
    const res = await saveAgeGroupConfig({ groups });
    setSaving(false);
    if (res.success && res.data) {
      setList(res.data);
      toast.success("Zapisano grupy wiekowe.");
    } else {
      toast.error(res.success ? undefined : res.error);
    }
  };

  if (loading) {
    return <p className="text-muted-foreground text-sm">Ładowanie…</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Te grupy określają, jak system liczy ceny za osoby w rezerwacjach (np. dziecko 0–6, 7–12).
      </p>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-2 font-medium">Grupa</th>
              <th className="px-4 py-2 font-medium">Etykieta</th>
              <th className="px-4 py-2 font-medium">Wiek od</th>
              <th className="px-4 py-2 font-medium">Wiek do</th>
            </tr>
          </thead>
          <tbody>
            {GROUPS.map((g) => (
              <tr key={g.key} className="border-b last:border-0">
                <td className="px-4 py-2 font-medium">{g.key}</td>
                <td className="px-4 py-2">
                  <Input
                    value={editing[g.key]?.label ?? g.defaultLabel}
                    onChange={(e) =>
                      setEditing((prev) => ({
                        ...prev,
                        [g.key]: { ...prev[g.key], label: e.target.value },
                      }))
                    }
                    className="max-w-[200px]"
                  />
                </td>
                <td className="px-4 py-2">
                  <Input
                    type="number"
                    min={0}
                    max={99}
                    value={editing[g.key]?.ageFrom ?? String(g.defaultFrom)}
                    onChange={(e) =>
                      setEditing((prev) => ({
                        ...prev,
                        [g.key]: { ...(prev[g.key] ?? {}), ageFrom: e.target.value },
                      }))
                    }
                    className="w-20"
                  />
                </td>
                <td className="px-4 py-2">
                  <Input
                    type="number"
                    min={0}
                    max={99}
                    value={editing[g.key]?.ageTo ?? String(g.defaultTo)}
                    onChange={(e) =>
                      setEditing((prev) => ({
                        ...prev,
                        [g.key]: { ...(prev[g.key] ?? {}), ageTo: e.target.value },
                      }))
                    }
                    className="w-20"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/30">
        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
        <span>
          Zmiana zakresów wpłynie na naliczanie cen w <strong>nowych</strong> rezerwacjach. Istniejące rezerwacje nie zostaną zmienione.
        </span>
      </div>
      <Button onClick={handleSave} disabled={saving}>
        {saving ? "Zapisywanie…" : "Zapisz"}
      </Button>
    </div>
  );
}
