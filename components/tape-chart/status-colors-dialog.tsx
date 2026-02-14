"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  updatePropertyReservationColors,
  getPropertyOverbookingLimit,
  updatePropertyOverbookingLimit,
  getPropertyLocalTax,
  updatePropertyLocalTax,
} from "@/app/actions/properties";
import { toast } from "sonner";
import { RESERVATION_STATUS_BG } from "@/lib/tape-chart-types";
import type { ReservationStatus } from "@/lib/tape-chart-types";

const STATUS_KEYS: ReservationStatus[] = [
  "CONFIRMED",
  "CHECKED_IN",
  "CHECKED_OUT",
  "CANCELLED",
  "NO_SHOW",
];

const STATUS_LABELS: Record<ReservationStatus, string> = {
  CONFIRMED: "Potwierdzona",
  CHECKED_IN: "Zameldowany",
  CHECKED_OUT: "Wymeldowany",
  CANCELLED: "Anulowana",
  NO_SHOW: "No-show",
};

function rgbToHex(rgb: string): string {
  const m = rgb.match(/rgb\((\d+)\s+(\d+)\s+(\d+)\)/);
  if (!m) return rgb;
  const r = parseInt(m[1], 10);
  const g = parseInt(m[2], 10);
  const b = parseInt(m[3], 10);
  return (
    "#" +
    [r, g, b]
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("")
  );
}

interface StatusColorsDialogProps {
  propertyId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialColors: Record<string, string> | null;
  onSaved: (colors: Record<string, string>) => void;
}

export function StatusColorsDialog({
  propertyId,
  open,
  onOpenChange,
  initialColors,
  onSaved,
}: StatusColorsDialogProps) {
  const [colors, setColors] = useState<Record<string, string>>({});
  const [overbookingPercent, setOverbookingPercent] = useState<string>("0");
  const [localTaxPerPerson, setLocalTaxPerPerson] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && propertyId) {
      const defaults: Record<string, string> = {};
      STATUS_KEYS.forEach((k) => {
        const v = RESERVATION_STATUS_BG[k];
        defaults[k] = v.startsWith("rgb") ? rgbToHex(v.replace(/ /g, ",").replace("rgb(", "rgb(")) : v;
      });
      if (initialColors && Object.keys(initialColors).length > 0) {
        STATUS_KEYS.forEach((k) => {
          if (initialColors[k]) defaults[k] = initialColors[k];
        });
      }
      setColors(defaults);
      getPropertyOverbookingLimit(propertyId).then((r) =>
        r.success && r.data != null ? setOverbookingPercent(String(r.data)) : setOverbookingPercent("0")
      );
      getPropertyLocalTax(propertyId).then((r) =>
        setLocalTaxPerPerson(
          r.success && r.data != null && r.data > 0 ? String(r.data) : ""
        )
      );
    }
  }, [open, initialColors, propertyId]);

  const handleSave = async () => {
    if (!propertyId) return;
    setSaving(true);
    const hexColors: Record<string, string> = {};
    STATUS_KEYS.forEach((k) => {
      const v = colors[k]?.trim();
      if (v) hexColors[k] = v;
    });
    const localTaxVal = parseFloat(localTaxPerPerson);
    const [colorsResult, overbookingResult, localTaxResult] = await Promise.all([
      updatePropertyReservationColors(propertyId, hexColors),
      updatePropertyOverbookingLimit(propertyId, parseFloat(overbookingPercent) || 0),
      updatePropertyLocalTax(propertyId, localTaxPerPerson.trim() === "" || localTaxVal <= 0 ? null : localTaxVal),
    ]);
    setSaving(false);
    if (colorsResult.success && overbookingResult.success && localTaxResult.success) {
      const toPass: Record<string, string> = {};
      STATUS_KEYS.forEach((k) => {
        const hex = hexColors[k];
        if (hex) toPass[k] = hex.startsWith("#") ? hex : "#" + hex;
      });
      onSaved(toPass);
      toast.success("Ustawienia zapisane");
      onOpenChange(false);
    } else {
      const err =
        !colorsResult.success
          ? colorsResult.error
          : !overbookingResult.success
            ? (overbookingResult as { success: false; error: string }).error
            : !localTaxResult.success
              ? (localTaxResult as { success: false; error: string }).error
              : undefined;
      toast.error(err ?? "Błąd zapisu");
    }
  };

  if (!propertyId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Kolory statusów rezerwacji</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Ustaw kolor tła pasków na grafiku dla każdego statusu. Wpisz kolor w formacie #RRGGBB.
        </p>
        <div className="grid gap-3 py-2">
          <div className="flex items-center gap-3 rounded-md border border-border p-3">
            <Label htmlFor="overbooking" className="w-48 shrink-0">
              Limit overbookingu (%)
            </Label>
            <input
              id="overbooking"
              type="number"
              min={0}
              max={100}
              value={overbookingPercent}
              onChange={(e) => setOverbookingPercent(e.target.value)}
              className="h-9 w-20 rounded-md border border-input bg-background px-3 text-sm"
            />
            <span className="text-sm text-muted-foreground">
              0 = wyłączony, np. 10 = dozwolone 10% ponad dostępność (z ostrzeżeniem)
            </span>
          </div>
          <div className="flex items-center gap-3 rounded-md border border-border p-3">
            <Label htmlFor="localTax" className="w-48 shrink-0">
              Opłata miejscowa (PLN / osoba / noc)
            </Label>
            <input
              id="localTax"
              type="number"
              min={0}
              step={0.01}
              value={localTaxPerPerson}
              onChange={(e) => setLocalTaxPerPerson(e.target.value)}
              className="h-9 w-24 rounded-md border border-input bg-background px-3 text-sm"
              placeholder="0 = wyłączone"
            />
          </div>
          {STATUS_KEYS.map((status) => (
            <div key={status} className="flex items-center gap-3">
              <input
                type="color"
                value={colors[status]?.startsWith("#") ? colors[status] : "#2563eb"}
                onChange={(e) => setColors((prev) => ({ ...prev, [status]: e.target.value }))}
                className="h-9 w-12 cursor-pointer rounded border border-input bg-background p-0.5"
              />
              <Label className="w-28 shrink-0">{STATUS_LABELS[status]}</Label>
              <input
                type="text"
                value={colors[status] ?? ""}
                onChange={(e) => setColors((prev) => ({ ...prev, [status]: e.target.value }))}
                placeholder="#RRGGBB"
                className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm font-mono"
              />
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Anuluj
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Zapisywanie…" : "Zapisz"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
