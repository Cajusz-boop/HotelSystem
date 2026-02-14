"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getHotelConfig, updateHotelConfig } from "@/app/actions/hotel-config";
import { toast } from "sonner";
import { ArrowLeft, Building, Plus, Trash2 } from "lucide-react";

export default function PietraPage() {
  const [floors, setFloors] = useState<string[]>([]);
  const [newFloor, setNewFloor] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getHotelConfig().then((r) => {
      setLoading(false);
      if (r.success) setFloors(r.data.floors ?? []);
      else toast.error(r.error);
    });
  }, []);

  const addFloor = () => {
    const t = newFloor.trim();
    if (!t) return;
    if (floors.includes(t)) {
      toast.error("Takie piętro już jest");
      return;
    }
    setFloors((prev) => [...prev, t]);
    setNewFloor("");
  };

  const removeFloor = (index: number) => {
    setFloors((prev) => prev.filter((_, i) => i !== index));
  };

  const save = async () => {
    setSaving(true);
    const result = await updateHotelConfig({ floors });
    setSaving(false);
    if (result.success) toast.success("Zapisano");
    else toast.error(result.error);
  };

  if (loading) return <div className="p-6">Ładowanie…</div>;

  return (
    <div className="p-6 max-w-md mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Building className="w-6 h-6" />
          <h1 className="text-2xl font-bold">Piętra budynku</h1>
        </div>
        <Link href="/ustawienia">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Powrót
          </Button>
        </Link>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Lista pięter (np. Parter, 1, 2, 3) – do wyboru przy definiowaniu pokoi.
      </p>
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="new" className="sr-only">Nowe piętro</Label>
            <Input
              id="new"
              value={newFloor}
              onChange={(e) => setNewFloor(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addFloor())}
              placeholder="np. Parter, 1, 2"
            />
          </div>
          <Button type="button" variant="secondary" onClick={addFloor}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <ul className="space-y-2">
          {floors.map((f, i) => (
            <li key={i} className="flex items-center justify-between rounded border px-3 py-2">
              <span>{f}</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => removeFloor(i)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
        {floors.length === 0 && (
          <p className="text-sm text-muted-foreground">Brak pięter. Dodaj pierwsze.</p>
        )}
        <Button onClick={save} disabled={saving}>
          {saving ? "Zapisywanie…" : "Zapisz"}
        </Button>
      </div>
    </div>
  );
}
