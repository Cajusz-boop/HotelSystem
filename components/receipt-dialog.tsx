"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { createReceipt } from "@/app/actions/finance";
import { toast } from "sonner";

interface ReceiptDialogProps {
  reservationId: string;
  guestName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReceiptDialog({
  reservationId,
  guestName,
  open,
  onOpenChange,
}: ReceiptDialogProps) {
  const [loading, setLoading] = useState(false);
  const [buyerName, setBuyerName] = useState(guestName || "");
  const [buyerAddress, setBuyerAddress] = useState("");
  const [buyerCity, setBuyerCity] = useState("");
  const [buyerPostalCode, setBuyerPostalCode] = useState("");
  const [buyerNip, setBuyerNip] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [notes, setNotes] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!buyerName.trim()) {
      toast.error("Nazwa nabywcy jest wymagana");
      return;
    }
    setLoading(true);
    try {
      const result = await createReceipt({
        reservationId,
        buyerName: buyerName.trim(),
        buyerAddress: buyerAddress.trim() || undefined,
        buyerCity: buyerCity.trim() || undefined,
        buyerPostalCode: buyerPostalCode.trim() || undefined,
        buyerNip: buyerNip.trim() || undefined,
        paymentMethod,
        notes: notes.trim() || undefined,
      });

      if (result.success && result.data) {
        toast.success(`Rachunek ${result.data.number} – ${result.data.amount.toFixed(2)} PLN`);
        onOpenChange(false);
        // Otwórz PDF w nowym oknie
        if (typeof window !== "undefined") {
          window.open(`/api/finance/receipt/${result.data.id}/pdf`, "_blank", "noopener,noreferrer");
        }
        // Reset form
        setBuyerAddress("");
        setBuyerCity("");
        setBuyerPostalCode("");
        setBuyerNip("");
        setNotes("");
      } else {
        toast.error(result.error || "Błąd wystawiania rachunku");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Wystaw rachunek (nie-VAT)</DialogTitle>
          <DialogDescription>
            Rachunek dla podmiotów zwolnionych z VAT. Wprowadź dane nabywcy.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="buyerName">Nazwa nabywcy *</Label>
            <Input
              id="buyerName"
              value={buyerName}
              onChange={(e) => setBuyerName(e.target.value)}
              placeholder="Imię i nazwisko lub nazwa firmy"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="buyerNip">NIP (opcjonalnie)</Label>
              <Input
                id="buyerNip"
                value={buyerNip}
                onChange={(e) => setBuyerNip(e.target.value)}
                placeholder="0000000000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentMethod">Sposób płatności</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger id="paymentMethod">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">Gotówka</SelectItem>
                  <SelectItem value="TRANSFER">Przelew</SelectItem>
                  <SelectItem value="CARD">Karta płatnicza</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="buyerAddress">Adres</Label>
            <Input
              id="buyerAddress"
              value={buyerAddress}
              onChange={(e) => setBuyerAddress(e.target.value)}
              placeholder="ul. Przykładowa 1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="buyerPostalCode">Kod pocztowy</Label>
              <Input
                id="buyerPostalCode"
                value={buyerPostalCode}
                onChange={(e) => setBuyerPostalCode(e.target.value)}
                placeholder="00-000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="buyerCity">Miasto</Label>
              <Input
                id="buyerCity"
                value={buyerCity}
                onChange={(e) => setBuyerCity(e.target.value)}
                placeholder="Warszawa"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Uwagi (opcjonalnie)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Dodatkowe informacje..."
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Anuluj
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Wystawianie…" : "Wystaw rachunek"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
