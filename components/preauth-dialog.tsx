"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getCardPreauthsForReservation,
  createCardPreauth,
  captureCardPreauth,
  releaseCardPreauth,
} from "@/app/actions/finance";
import { toast } from "sonner";

interface PreauthDialogProps {
  reservationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PreauthDialog({
  reservationId,
  open,
  onOpenChange,
}: PreauthDialogProps) {
  const [list, setList] = useState<Array<{ id: string; amount: number; status: string; createdAt: string }>>([]);
  const [amount, setAmount] = useState("500");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && reservationId) {
      getCardPreauthsForReservation(reservationId).then((r) => {
        if (r.success && r.data) setList(r.data);
      });
    }
  }, [open, reservationId]);

  const handleCreate = async () => {
    const num = parseFloat(amount.replace(",", "."));
    if (Number.isNaN(num) || num <= 0) {
      toast.error("Podaj kwotę > 0");
      return;
    }
    setLoading(true);
    const r = await createCardPreauth(reservationId, num, 7);
    setLoading(false);
    if (r.success && r.data) {
      setList((prev) => [{ id: r.data!.id, amount: r.data!.amount, status: r.data!.status, createdAt: new Date().toISOString() }, ...prev]);
      toast.success(`Blokada ${r.data.amount} PLN utworzona`);
    } else {
      toast.error(r.error ?? "Błąd");
    }
  };

  const handleCapture = async (preauthId: string) => {
    setLoading(true);
    const r = await captureCardPreauth(preauthId);
    setLoading(false);
    if (r.success) {
      setList((prev) => prev.map((p) => (p.id === preauthId ? { ...p, status: "CAPTURED" } : p)));
      toast.success("Zaliczka pobrana z karty");
    } else {
      toast.error(r.error ?? "Błąd");
    }
  };

  const handleRelease = async (preauthId: string) => {
    setLoading(true);
    const r = await releaseCardPreauth(preauthId);
    setLoading(false);
    if (r.success) {
      setList((prev) => prev.map((p) => (p.id === preauthId ? { ...p, status: "RELEASED" } : p)));
      toast.success("Blokada zwolniona");
    } else {
      toast.error(r.error ?? "Błąd");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Preautoryzacja karty</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2 items-end">
            <div>
              <Label>Kwota (PLN)</Label>
              <Input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-24 mt-1"
              />
            </div>
            <Button onClick={handleCreate} disabled={loading}>
              Zablokuj kartę
            </Button>
          </div>
          <div>
            <p className="text-sm font-medium mb-2">Blokady</p>
            {list.length === 0 ? (
              <p className="text-sm text-muted-foreground">Brak preautoryzacji</p>
            ) : (
              <ul className="space-y-2">
                {list.map((p) => (
                  <li key={p.id} className="flex justify-between items-center rounded border px-3 py-2 text-sm">
                    <span>{p.amount.toFixed(2)} PLN · {p.status}</span>
                    {p.status === "HOLD" && (
                      <span className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => handleCapture(p.id)} disabled={loading}>
                          Pobierz
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleRelease(p.id)} disabled={loading}>
                          Zwolnij
                        </Button>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
