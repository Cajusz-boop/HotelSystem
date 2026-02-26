"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { BookingTransferInfo } from "@/lib/hotel-config-types";

export function BookingConfirmation({
  confirmationNumber,
  summary,
  totalAmount,
  paymentStatus,
  guestEmail,
  reservationId,
  paymentLinkUrl,
  checkInLink,
  transferInfo,
  onNewBooking,
}: {
  confirmationNumber: string;
  summary: string;
  totalAmount: number;
  paymentStatus: string;
  guestEmail: string;
  reservationId: string;
  paymentLinkUrl?: string | null;
  checkInLink?: string | null;
  transferInfo?: BookingTransferInfo | null;
  onNewBooking: () => void;
}) {
  const isRequest = !confirmationNumber;

  return (
    <div className="rounded-xl border border-green-500/50 bg-green-500/10 p-6 space-y-4">
      <h2 className="text-xl font-semibold text-green-800 dark:text-green-400">
        {isRequest ? "Zapytanie wysłane" : "Rezerwacja potwierdzona"}
      </h2>
      {confirmationNumber && <p className="text-sm">Nr rezerwacji: {confirmationNumber}</p>}
      {summary && <p className="text-sm">{summary}</p>}
      {totalAmount > 0 && (
        <p className="text-sm">
          Kwota: {totalAmount.toFixed(0)} PLN ({paymentStatus})
        </p>
      )}
      {guestEmail && <p className="text-sm">Potwierdzenie wysłane na: {guestEmail}</p>}

      <div className="flex flex-col gap-2 pt-2">
        {confirmationNumber && (
          <Button asChild variant="outline" size="sm">
            <Link href={`/api/reservations/${reservationId}/confirmation/pdf`} target="_blank">
              Pobierz potwierdzenie PDF
            </Link>
          </Button>
        )}
        {checkInLink && (
          <Button asChild variant="outline" size="sm">
            <Link href={checkInLink} target="_blank">
              Link do odprawy online
            </Link>
          </Button>
        )}
        {paymentLinkUrl && (
          <Button asChild size="sm" className="bg-blue-600 hover:bg-blue-700">
            <Link href={paymentLinkUrl} target="_blank">
              Zapłać teraz
            </Link>
          </Button>
        )}
        {transferInfo?.bankAccount && confirmationNumber && (
          <div className="rounded-md bg-muted/60 p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Dane do przelewu:</p>
            <p>
              {transferInfo.name} | {transferInfo.bankAccount}
              {transferInfo.bankName ? ` | ${transferInfo.bankName}` : ""}
            </p>
            <p className="mt-1">Tytuł: REZ-{confirmationNumber}</p>
          </div>
        )}
        <Button type="button" variant="outline" className="mt-2" onClick={onNewBooking}>
          Wróć na stronę hotelu
        </Button>
      </div>
    </div>
  );
}
