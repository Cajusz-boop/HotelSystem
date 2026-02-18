"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerTransaction } from "@/app/actions/finance";
import { toast } from "sonner";

const CHARGE_TYPES = [
  { value: "MINIBAR", label: "Minibar" },
  { value: "GASTRONOMY", label: "Gastronomia / Room service" },
  { value: "SPA", label: "SPA" },
  { value: "PARKING", label: "Parking" },
  { value: "PHONE", label: "Telefon" },
  { value: "LAUNDRY", label: "Pranie" },
  { value: "OTHER", label: "Inne" },
] as const;

interface AddChargeDialogProps {
  reservationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  folioNumbers?: number[];
  defaultFolioNumber?: number;
}

export function AddChargeDialog({
  reservationId,
  open,
  onOpenChange,
  onSuccess,
  folioNumbers = [1],
  defaultFolioNumber = 1,
}: AddChargeDialogProps) {
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<string>("OTHER");
  const [description, setDescription] = useState("");
  const [folioNumber, setFolioNumber] = useState(defaultFolioNumber);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(amount.replace(",", "."));
    if (Number.isNaN(num) || num <= 0) {
      toast.error("Podaj prawidłową kwotę");
      return;
    }
    setSaving(true);
    try {
      const result = await registerTransaction({
        reservationId,
        amount: num,
        type,
        description: description.trim() || undefined,
        folioNumber: folioNumbers.length > 1 ? folioNumber : undefined,
      });
      if (result.success) {
        toast.success("Obciążenie dodane do folio");
        setAmount("");
        setDescription("");
        setType("OTHER");
        onOpenChange(false);
        onSuccess?.();
      } else {
        toast.error("error" in result ? (result.error ?? "Błąd") : "Błąd");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Dodaj obciążenie</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="add-charge-amount">Kwota (PLN)</Label>
            <Input
              id="add-charge-amount"
              type="text"
              inputMode="decimal"
              placeholder="np. 50.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-charge-type">Typ</Label>
            <select
              id="add-charge-type"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {CHARGE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-charge-desc">Opis (opcjonalnie)</Label>
            <Input
              id="add-charge-desc"
              type="text"
              placeholder="np. Cola z minibaru"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          {folioNumbers.length > 1 && (
            <div className="space-y-2">
              <Label htmlFor="add-charge-folio">Folio</Label>
              <select
                id="add-charge-folio"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={folioNumber}
                onChange={(e) => setFolioNumber(parseInt(e.target.value, 10))}
              >
                {folioNumbers.map((fn) => (
                  <option key={fn} value={fn}>Folio #{fn}</option>
                ))}
              </select>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Anuluj
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Dodawanie…" : "Dodaj obciążenie"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
