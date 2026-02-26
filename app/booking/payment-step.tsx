"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { createPaymentLink } from "@/app/actions/finance";
import { toast } from "sonner";
import type { BookingTransferInfo } from "@/lib/hotel-config-types";

export function PaymentStep({
  summary,
  totalAmount,
  reservationId,
  confirmationNumber,
  transferInfo,
  onSkipPayment,
  loading,
}: {
  summary: string;
  totalAmount: number;
  reservationId: string;
  confirmationNumber: string;
  transferInfo: BookingTransferInfo | null;
  onSkipPayment: () => void;
  loading?: boolean;
}) {
  const [intent, setIntent] = useState<"FULL" | "ADVANCE" | "NONE">("FULL");
  const [creatingLink, setCreatingLink] = useState(false);
  const advanceAmount = Math.round((totalAmount * 30) / 100);

  const handleGoToPayment = async () => {
    if (intent === "NONE") return;
    setCreatingLink(true);
    const amount = intent === "FULL" ? totalAmount : advanceAmount;
    const res = await createPaymentLink(reservationId, amount, 14);
    setCreatingLink(false);
    if (res.success && res.data?.url) {
      window.open(res.data.url, "_blank", "noopener,noreferrer");
    } else if (!res.success) {
      toast.error(res.error ?? "Nie udało się utworzyć linku do płatności.");
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{summary}</p>
      <p className="text-lg font-semibold">Suma: {totalAmount.toFixed(0)} PLN</p>

      <div className="rounded-lg border p-4 space-y-3">
        <Label>Płatność</Label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="paymentIntent"
            value="FULL"
            checked={intent === "FULL"}
            onChange={() => setIntent("FULL")}
            className="rounded-full"
          />
          <span>Zapłać teraz pełną kwotę: {totalAmount.toFixed(0)} PLN</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="paymentIntent"
            value="ADVANCE"
            checked={intent === "ADVANCE"}
            onChange={() => setIntent("ADVANCE")}
            className="rounded-full"
          />
          <span>Wpłać zaliczkę 30%: {advanceAmount.toFixed(0)} PLN</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="paymentIntent"
            value="NONE"
            checked={intent === "NONE"}
            onChange={() => setIntent("NONE")}
            className="rounded-full"
          />
          <span>Rezerwuj bez płatności online (zapłacę w obiekcie)</span>
        </label>
      </div>

      {(intent === "FULL" || intent === "ADVANCE") && (
        <Button
          type="button"
          className="w-full bg-blue-600 hover:bg-blue-700 py-3 text-base"
          onClick={handleGoToPayment}
          disabled={creatingLink || loading}
        >
          {creatingLink ? "Generowanie linku…" : "Przejdź do płatności (" + (intent === "FULL" ? totalAmount : advanceAmount) + " PLN)"}
        </Button>
      )}

      <p className="text-xs text-muted-foreground">
        Możesz też zapłacić później – link do płatności jest ważny 14 dni i zostanie wysłany e-mailem.
      </p>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={onSkipPayment}
        disabled={loading}
      >
        Zakończ (zapłacę później)
      </Button>

      <div className="rounded-md bg-muted/60 p-3 text-xs text-muted-foreground pt-2">
        <p className="font-medium text-foreground mb-1">Dane do przelewu tradycyjnego:</p>
        <p>
          {transferInfo?.name ?? "Karczma Łabędź"}
          {transferInfo?.bankAccount ? ` | ${transferInfo.bankAccount}` : ""}
          {transferInfo?.bankName ? ` | ${transferInfo.bankName}` : ""}
        </p>
        <p className="mt-1">
          Tytuł przelewu: {confirmationNumber ? `REZ-${confirmationNumber}` : "numer rezerwacji"}
        </p>
      </div>
    </div>
  );
}
