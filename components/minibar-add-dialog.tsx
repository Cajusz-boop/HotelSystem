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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getMinibarItems, addMinibarToReservation } from "@/app/actions/minibar";
import { toast } from "sonner";

interface MinibarAddDialogProps {
  reservationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function MinibarAddDialog({
  reservationId,
  open,
  onOpenChange,
  onSuccess,
}: MinibarAddDialogProps) {
  const [items, setItems] = useState<Array<{ id: string; name: string; price: number; unit: string }>>([]);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setLoading(true);
      getMinibarItems()
        .then((r) => {
          if (r.success && r.data) {
            setItems(r.data);
            setQuantities({});
          }
        })
        .finally(() => setLoading(false));
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const entries = items
      .map((i) => ({ minibarItemId: i.id, quantity: parseInt(quantities[i.id] ?? "0", 10) }))
      .filter((x) => x.quantity > 0);
    if (entries.length === 0) {
      toast.error("Wybierz co najmniej jedną pozycję z ilością > 0");
      return;
    }
    setSaving(true);
    try {
      const result = await addMinibarToReservation(reservationId, entries);
      if (result.success) {
        toast.success("Minibar doliczony do rachunku");
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
          <DialogTitle>Dolicz minibar do rachunku</DialogTitle>
        </DialogHeader>
        {loading ? (
          <p className="text-sm text-muted-foreground">Ładowanie…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Brak pozycji minibaru. Dodaj je w module Housekeeping / Minibar.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {items.map((i) => (
                <div key={i.id} className="flex items-center gap-2">
                  <Label className="w-32 shrink-0 text-sm">{i.name}</Label>
                  <span className="text-sm text-muted-foreground w-16">{i.price.toFixed(2)} PLN</span>
                  <Input
                    type="number"
                    min={0}
                    className="w-20"
                    value={quantities[i.id] ?? ""}
                    onChange={(e) =>
                      setQuantities((prev) => ({ ...prev, [i.id]: e.target.value }))
                    }
                    placeholder="0"
                  />
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Anuluj
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Zapisywanie…" : "Dolicz do rachunku"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
