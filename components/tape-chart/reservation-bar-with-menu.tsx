"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
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
import { ReservationBar } from "./reservation-bar";
import type { ReservationEditSheetTab } from "./reservation-edit-sheet";
import { updateReservationStatus, getCheckoutBalanceWarning } from "@/app/actions/reservations";
import { printInvoiceForReservation, createProforma, chargeLocalTax, createVatInvoice, createPaymentLink, createReceipt, collectSecurityDeposit } from "@/app/actions/finance";
import { sendReservationConfirmation, sendThankYouAfterStay } from "@/app/actions/mailing";
import { sendDoorCodeSms, sendRoomReadySms } from "@/app/actions/sms";
import { createWebCheckInLink } from "@/app/actions/web-check-in";
import { MinibarAddDialog } from "@/components/minibar-add-dialog";
import { PreauthDialog } from "@/components/preauth-dialog";
import { ReceiptDialog } from "@/components/receipt-dialog";
import { toast } from "sonner";
import type { Reservation } from "@/lib/tape-chart-types";
import { FileText, Receipt, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

const LONG_PRESS_MS = 500;
const RESIZE_HANDLE_WIDTH_PX = 6;

interface ReservationBarWithMenuProps {
  reservation: Reservation;
  gridRow: number;
  gridColumnStart: number;
  gridColumnEnd: number;
  privacyMode: boolean;
  isDragging?: boolean;
  isPlaceholder?: boolean;
  pricePerNight?: number;
  totalAmount?: number;
  onEdit: (reservation: Reservation, initialTab?: ReservationEditSheetTab) => void;
  onStatusChange?: (updated: Reservation) => void;
  /** Resize: przekazane gdy grafik obsługuje zmianę dat przez przeciąganie krawędzi */
  dates?: string[];
  getDateFromClientX?: (clientX: number) => string | null;
  onResize?: (reservationId: string, payload: { checkIn?: string; checkOut?: string }) => Promise<void>;
  onSplitClick?: (reservation: Reservation) => void;
  /** Opcjonalna paleta kolorów tła pasków (z ustawień obiektu) */
  statusBg?: Record<string, string>;
  /** Czy rezerwacja ma konflikt (nakłada się z inną) */
  hasConflict?: boolean;
  /** Callback do duplikowania rezerwacji */
  onDuplicate?: (reservation: Reservation) => void;
  /** Callback do przedłużenia pobytu */
  onExtendStay?: (reservation: Reservation, newCheckOut: string) => void;
}

export function ReservationBarWithMenu({
  reservation,
  gridRow,
  gridColumnStart,
  gridColumnEnd,
  privacyMode,
  isDragging = false,
  isPlaceholder = false,
  pricePerNight,
  totalAmount,
  onEdit,
  onStatusChange,
  dates,
  getDateFromClientX,
  onResize,
  onSplitClick,
  statusBg,
  hasConflict,
  onDuplicate,
  onExtendStay,
}: ReservationBarWithMenuProps) {
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);

  const [resizeEdge, setResizeEdge] = useState<"left" | "right" | null>(null);
  const [minibarOpen, setMinibarOpen] = useState(false);
  const [preauthOpen, setPreauthOpen] = useState(false);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [checkInDialogOpen, setCheckInDialogOpen] = useState(false);
  const [checkInCashDeposit, setCheckInCashDeposit] = useState("");
  const [checkInSubmitting, setCheckInSubmitting] = useState(false);
  const [checkoutDialogOpen, setCheckoutDialogOpen] = useState(false);
  const [checkoutBalance, setCheckoutBalance] = useState<{
    balance: number;
    restaurantCharges: number;
    restaurantCount: number;
    totalOwed: number;
    totalPaid: number;
  } | null>(null);
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);
  const lastValidDateRef = useRef<string | null>(null);
  const canResize =
    onResize &&
    getDateFromClientX &&
    dates?.length &&
    (reservation.status === "CONFIRMED" || reservation.status === "CHECKED_IN");

  // Helper to add days to a date string
  const addDays = useCallback((dateStr: string, days: number): string => {
    const d = new Date(dateStr + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }, []);

  const handleExtendStay = useCallback(() => {
    if (onExtendStay) {
      const newCheckOut = addDays(reservation.checkOut, 1);
      onExtendStay(reservation, newCheckOut);
    }
  }, [onExtendStay, reservation, addDays]);

  const handleShortenStay = useCallback(() => {
    if (onExtendStay) {
      const newCheckOut = addDays(reservation.checkOut, -1);
      // Ensure checkout is after checkin
      if (newCheckOut > reservation.checkIn) {
        onExtendStay(reservation, newCheckOut);
      } else {
        toast.error("Nie można skrócić – checkout musi być po checkin");
      }
    }
  }, [onExtendStay, reservation, addDays]);

  useEffect(() => {
    if (resizeEdge === null) return;
    const edge = resizeEdge;
    const checkIn = reservation.checkIn;
    const checkOut = reservation.checkOut;
    lastValidDateRef.current = edge === "left" ? checkIn : checkOut;

    const handleMove = (e: MouseEvent) => {
      const dateStr = getDateFromClientX!(e.clientX);
      if (!dateStr) return;
      if (edge === "left") {
        if (dateStr >= checkOut) return;
      } else {
        if (dateStr <= checkIn) return;
      }
      lastValidDateRef.current = dateStr;
    };
    const handleUp = async () => {
      setResizeEdge(null);
      const dateStr = lastValidDateRef.current;
      if (!dateStr || !onResize) return;
      if (edge === "left") {
        if (dateStr >= checkOut) return;
        await onResize(reservation.id, { checkIn: dateStr });
      } else {
        if (dateStr <= checkIn) return;
        await onResize(reservation.id, { checkOut: dateStr });
      }
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp, { once: true });
    return () => {
      window.removeEventListener("mousemove", handleMove);
    };
  }, [resizeEdge, reservation.id, reservation.checkIn, reservation.checkOut, getDateFromClientX, onResize]);

  const handleResizeHandleDown = useCallback(
    (edge: "left" | "right") => (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!canResize) return;
      setResizeEdge(edge);
    },
    [canResize]
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const t = e.touches[0];
      touchStartPos.current = { x: t.clientX, y: t.clientY };
      longPressTimer.current = setTimeout(() => {
        longPressTimer.current = null;
        const ev = new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
          clientX: t.clientX,
          clientY: t.clientY,
          button: 2,
          buttons: 2,
        });
        (e.target as HTMLElement).dispatchEvent(ev);
      }, LONG_PRESS_MS);
    },
    []
  );

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    touchStartPos.current = null;
  }, []);

  const handleTouchMove = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleCheckInConfirm = useCallback(async (cashDepositStr: string) => {
    setCheckInSubmitting(true);
    try {
      const result = await updateReservationStatus(reservation.id, "CHECKED_IN");
      if (!result.success) {
        toast.error("error" in result ? result.error : "Błąd meldunku");
        return;
      }
      onStatusChange?.(result.data as Reservation);
      const amount = parseFloat(cashDepositStr.replace(",", "."));
      if (Number.isFinite(amount) && amount > 0) {
        const dep = await collectSecurityDeposit({
          reservationId: reservation.id,
          amount,
          paymentMethod: "CASH",
        });
        if (dep.success) {
          toast.success(`Meldunek zarejestrowany. Kaucja gotówkowa ${amount.toFixed(2)} PLN pobrana.`);
        } else {
          toast.success("Meldunek zarejestrowany.");
          toast.error("error" in dep ? (dep.error ?? "Nie udało się pobrać kaucji – możesz to zrobić w Płatnościach.") : "Nie udało się pobrać kaucji – możesz to zrobić w Płatnościach.");
        }
      } else {
        toast.success("Meldunek zarejestrowany");
      }
      setCheckInDialogOpen(false);
    } finally {
      setCheckInSubmitting(false);
    }
  }, [reservation.id, onStatusChange]);

  const handleCheckIn = useCallback(() => {
    if (reservation.status === "CONFIRMED") {
      setCheckInCashDeposit("");
      setCheckInDialogOpen(true);
    } else {
      handleCheckInConfirm("");
    }
  }, [reservation.status, handleCheckInConfirm]);

  const handleCancel = useCallback(async () => {
    const result = await updateReservationStatus(reservation.id, "CANCELLED");
    if (result.success && result.data) {
      toast.success("Rezerwacja anulowana");
      onStatusChange?.(result.data as Reservation);
    } else if (!result.success) toast.error("error" in result ? result.error : "Błąd");
  }, [reservation.id, onStatusChange]);

  const handleCheckoutClick = useCallback(async () => {
    const balanceResult = await getCheckoutBalanceWarning(reservation.id);
    if (balanceResult.success && balanceResult.data) {
      const d = balanceResult.data;
      if (d.hasUnpaidBalance || d.restaurantCount > 0) {
        setCheckoutBalance(d);
        setCheckoutDialogOpen(true);
        return;
      }
    }
    // No unpaid balance — proceed directly
    const result = await updateReservationStatus(reservation.id, "CHECKED_OUT");
    if (result.success && result.data) {
      toast.success("Gość wymeldowany");
      onStatusChange?.(result.data as Reservation);
    } else if (!result.success) {
      toast.error("error" in result ? result.error : "Błąd wymeldowania");
    }
  }, [reservation.id, onStatusChange]);

  const handleCheckoutConfirm = useCallback(async () => {
    setCheckoutSubmitting(true);
    try {
      const result = await updateReservationStatus(reservation.id, "CHECKED_OUT");
      if (result.success && result.data) {
        toast.success("Gość wymeldowany");
        onStatusChange?.(result.data as Reservation);
        setCheckoutDialogOpen(false);
      } else if (!result.success) {
        toast.error("error" in result ? result.error : "Błąd wymeldowania");
      }
    } finally {
      setCheckoutSubmitting(false);
    }
  }, [reservation.id, onStatusChange]);

  const handlePrintInvoice = useCallback(async () => {
    const result = await printInvoiceForReservation(reservation.id);
    if (result.success) {
      toast.success(
        result.data?.invoiceNumber
          ? `Faktura wydrukowana: ${result.data.invoiceNumber}`
          : "Faktura wysłana do kasy (POSNET)"
      );
    } else {
      toast.error("error" in result ? result.error : "Błąd");
    }
  }, [reservation.id]);

  const handleCreateProforma = useCallback(async () => {
    const result = await createProforma(reservation.id);
    if (result.success && result.data) {
      toast.success(`Proforma ${result.data.number} – ${result.data.amount.toFixed(2)} PLN`);
    } else {
      toast.error("error" in result ? result.error : "Błąd");
    }
  }, [reservation.id]);

  const handleChargeLocalTax = useCallback(async () => {
    const result = await chargeLocalTax(reservation.id);
    if (result.success && result.data) {
      toast.success(`Opłata miejscowa naliczona: ${result.data.amount.toFixed(2)} PLN`);
    } else {
      toast.error("error" in result ? result.error : "Błąd");
    }
  }, [reservation.id]);

  const handleCreateVatInvoice = useCallback(async () => {
    const result = await createVatInvoice(reservation.id);
    if (result.success && result.data) {
      toast.success(`Faktura VAT ${result.data.number} – ${result.data.amountGross.toFixed(2)} PLN`);
      if (typeof window !== "undefined") {
        window.open(`/api/finance/invoice/${result.data.id}/pdf`, "_blank", "noopener,noreferrer");
      }
    } else {
      toast.error("error" in result ? result.error : "Błąd");
    }
  }, [reservation.id]);

  const handleCreatePaymentLink = useCallback(async () => {
    const amount = totalAmount ?? 0;
    if (amount <= 0) {
      toast.error("Brak kwoty – ustaw w edycji rezerwacji lub nalicz usługi.");
      return;
    }
    const result = await createPaymentLink(reservation.id, amount, 14);
    if (result.success && result.data) {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(result.data.url);
        toast.success("Link do płatności skopiowany do schowka");
      } else {
        toast.success(`Link: ${result.data.url}`);
      }
    } else {
      toast.error("error" in result ? result.error : "Błąd");
    }
  }, [reservation.id, totalAmount]);

  const handleSendConfirmation = useCallback(async () => {
    const result = await sendReservationConfirmation(reservation.id);
    if (result.success && result.data) {
      toast.success(`Potwierdzenie wysłane na ${result.data.sentTo}`);
    } else {
      toast.error("error" in result ? result.error : "Błąd");
    }
  }, [reservation.id]);

  const handleSendThankYou = useCallback(async () => {
    const result = await sendThankYouAfterStay(reservation.id);
    if (result.success && result.data) {
      toast.success(`Podziękowanie wysłane na ${result.data.sentTo}`);
    } else {
      toast.error("error" in result ? result.error : "Błąd");
    }
  }, [reservation.id]);

  const handleSendDoorCodeSms = useCallback(async () => {
    const result = await sendDoorCodeSms(reservation.id);
    if (result.success && result.data) {
      toast.success(`SMS (kod do drzwi) wysłany na ${result.data.sentTo}`);
    } else {
      toast.error("error" in result ? result.error : "Błąd");
    }
  }, [reservation.id]);

  const handleSendRoomReadySms = useCallback(async () => {
    const result = await sendRoomReadySms(reservation.id);
    if (result.success && result.data) {
      toast.success(`SMS (pokój gotowy) wysłany na ${result.data.sentTo}`);
    } else {
      toast.error("error" in result ? result.error : "Błąd");
    }
  }, [reservation.id]);

  const handleCreateWebCheckInLink = useCallback(async () => {
    const result = await createWebCheckInLink(reservation.id);
    if (result.success && result.data) {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(result.data.url);
        toast.success("Link Web Check-in skopiowany do schowka");
      } else {
        toast.success(`Link: ${result.data.url}`);
      }
    } else {
      toast.error("error" in result ? result.error : "Błąd");
    }
  }, [reservation.id]);

  const _handleCreateReceipt = useCallback(async (buyerName: string, buyerAddress?: string, buyerCity?: string, buyerPostalCode?: string) => {
    const result = await createReceipt({
      reservationId: reservation.id,
      buyerName,
      buyerAddress,
      buyerCity,
      buyerPostalCode,
      paymentMethod: "CASH",
    });
    if (result.success && result.data) {
      toast.success(`Rachunek ${result.data.number} – ${result.data.amount.toFixed(2)} PLN`);
      if (typeof window !== "undefined") {
        window.open(`/api/finance/receipt/${result.data.id}/pdf`, "_blank", "noopener,noreferrer");
      }
    } else {
      toast.error("error" in result ? result.error : "Błąd");
    }
  }, [reservation.id]);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className="relative h-full w-full"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchMove={handleTouchMove}
          onTouchCancel={handleTouchEnd}
        >
          <ReservationBar
            reservation={reservation}
            gridRow={gridRow}
            gridColumnStart={gridColumnStart}
            gridColumnEnd={gridColumnEnd}
            privacyMode={privacyMode}
            isDragging={isDragging}
            isPlaceholder={isPlaceholder}
            pricePerNight={pricePerNight}
            totalAmount={totalAmount}
            statusBg={statusBg}
            hasConflict={hasConflict}
          />
          {canResize && (
            <>
              <div
                role="button"
                tabIndex={0}
                className={cn(
                  "absolute left-0 top-0 bottom-0 z-20 w-1.5 cursor-ew-resize hover:bg-white/30 rounded-l shrink-0",
                  resizeEdge === "left" && "bg-white/40"
                )}
                style={{ minWidth: RESIZE_HANDLE_WIDTH_PX }}
                onMouseDown={handleResizeHandleDown("left")}
                onPointerDown={(e) => e.stopPropagation()}
                title="Przeciągnij, aby zmienić datę zameldowania"
                aria-label="Zmiana daty zameldowania"
              />
              <div
                role="button"
                tabIndex={0}
                className={cn(
                  "absolute right-0 top-0 bottom-0 z-20 w-1.5 cursor-ew-resize hover:bg-white/30 rounded-r shrink-0",
                  resizeEdge === "right" && "bg-white/40"
                )}
                style={{ minWidth: RESIZE_HANDLE_WIDTH_PX }}
                onMouseDown={handleResizeHandleDown("right")}
                onPointerDown={(e) => e.stopPropagation()}
                title="Przeciągnij, aby zmienić datę wymeldowania"
                aria-label="Zmiana daty wymeldowania"
              />
            </>
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuItem
          onSelect={() => onEdit(reservation)}
          disabled={reservation.status === "CANCELLED" || reservation.status === "CHECKED_OUT"}
        >
          Edytuj rezerwację
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => onEdit(reservation, "dokumenty")}
          disabled={reservation.status === "CANCELLED" || reservation.status === "CHECKED_OUT"}
        >
          <Receipt className="mr-2 h-4 w-4" />
          Wystaw dokument
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => onEdit(reservation, "rozliczenie")}
          disabled={reservation.status === "CANCELLED" || reservation.status === "CHECKED_OUT"}
        >
          <CreditCard className="mr-2 h-4 w-4" />
          Płatności
        </ContextMenuItem>
        {onDuplicate && (
          <ContextMenuItem onSelect={() => onDuplicate(reservation)}>
            Duplikuj rezerwację
          </ContextMenuItem>
        )}
        {onExtendStay && (reservation.status === "CONFIRMED" || reservation.status === "CHECKED_IN") && (
          <>
            <ContextMenuItem onSelect={handleExtendStay}>
              Przedłuż pobyt (+1 dzień)
            </ContextMenuItem>
            <ContextMenuItem onSelect={handleShortenStay}>
              Skróć pobyt (-1 dzień)
            </ContextMenuItem>
          </>
        )}
        <ContextMenuItem
          onSelect={handleCheckIn}
          disabled={reservation.status !== "CONFIRMED" && reservation.status !== "CHECKED_IN"}
        >
          Meldunek
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={handleCheckoutClick}
          disabled={reservation.status !== "CHECKED_IN"}
        >
          Wymelduj
        </ContextMenuItem>
        <ContextMenuItem onSelect={handlePrintInvoice}>
          <FileText className="mr-2 h-4 w-4" />
          Drukuj fakturę (POSNET)
        </ContextMenuItem>
        <ContextMenuItem onSelect={handleCreateVatInvoice}>
          <FileText className="mr-2 h-4 w-4" />
          Wystaw fakturę VAT (PDF)
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => setReceiptDialogOpen(true)}>
          <FileText className="mr-2 h-4 w-4" />
          Wystaw rachunek (nie-VAT)
        </ContextMenuItem>
        <ContextMenuItem onSelect={handleCreateProforma}>
          <FileText className="mr-2 h-4 w-4" />
          Wystaw proformę
        </ContextMenuItem>
        <ContextMenuItem onSelect={handleChargeLocalTax}>
          Nalicz opłatę miejscową
        </ContextMenuItem>
        <ContextMenuItem onSelect={handleCreatePaymentLink}>
          Wyślij link do płatności
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => setPreauthOpen(true)}>
          Preautoryzacja karty
        </ContextMenuItem>
        <ContextMenuItem onSelect={handleSendConfirmation}>
          Wyślij potwierdzenie e-mailem
        </ContextMenuItem>
        {(reservation.status === "CHECKED_OUT" && (
          <ContextMenuItem onSelect={handleSendThankYou}>
            Wyślij podziękowanie e-mailem
          </ContextMenuItem>
        ))}
        <ContextMenuItem onSelect={handleSendDoorCodeSms}>
          Wyślij kod do drzwi SMS
        </ContextMenuItem>
        {(reservation.status === "CHECKED_IN" && (
          <ContextMenuItem onSelect={handleSendRoomReadySms}>
            Wyślij SMS: pokój gotowy
          </ContextMenuItem>
        ))}
        <ContextMenuItem onSelect={handleCreateWebCheckInLink}>
          Wyślij link Web Check-in
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => setMinibarOpen(true)}>
          Dolicz minibar do rachunku
        </ContextMenuItem>
        <ContextMenuSeparator />
        {onSplitClick &&
          reservation.status !== "CANCELLED" &&
          reservation.status !== "CHECKED_OUT" &&
          (() => {
            const nights = Math.round(
              (new Date(reservation.checkOut).getTime() - new Date(reservation.checkIn).getTime()) /
                (24 * 60 * 60 * 1000)
            );
            return nights >= 2 ? (
              <ContextMenuItem onSelect={() => onSplitClick(reservation)}>
                Podziel rezerwację
              </ContextMenuItem>
            ) : null;
          })()}
        <ContextMenuSeparator />
        <ContextMenuItem
          onSelect={handleCancel}
          className="text-destructive focus:text-destructive"
          disabled={reservation.status === "CANCELLED"}
        >
          Anuluj rezerwację
        </ContextMenuItem>
      </ContextMenuContent>
      <MinibarAddDialog
        reservationId={reservation.id}
        open={minibarOpen}
        onOpenChange={setMinibarOpen}
      />
      <PreauthDialog
        reservationId={reservation.id}
        open={preauthOpen}
        onOpenChange={setPreauthOpen}
      />
      <ReceiptDialog
        reservationId={reservation.id}
        guestName={reservation.guestName}
        open={receiptDialogOpen}
        onOpenChange={setReceiptDialogOpen}
      />
      <Dialog open={checkInDialogOpen} onOpenChange={setCheckInDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Meldunek – depozyt gotówkowy</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Opcjonalnie podaj kwotę kaucji gotówkowej pobieranej przy meldunku.
          </p>
          <div className="space-y-2">
            <Label htmlFor="checkInCashDeposit">Kaucja gotówkowa (PLN)</Label>
            <Input
              id="checkInCashDeposit"
              type="number"
              min={0}
              step={0.01}
              placeholder="0"
              value={checkInCashDeposit}
              onChange={(e) => setCheckInCashDeposit(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCheckInDialogOpen(false)}
              disabled={checkInSubmitting}
            >
              Anuluj
            </Button>
            <Button
              onClick={() => handleCheckInConfirm(checkInCashDeposit)}
              disabled={checkInSubmitting}
            >
              {checkInSubmitting ? "Zapisywanie…" : "Zamelduj"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={checkoutDialogOpen} onOpenChange={setCheckoutDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Wymeldowanie – uwaga na saldo</DialogTitle>
          </DialogHeader>
          {checkoutBalance && (
            <div className="space-y-3 text-sm">
              {checkoutBalance.restaurantCount > 0 && (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3">
                  <p className="font-semibold text-amber-800">
                    Rachunki z restauracji: {checkoutBalance.restaurantCount} szt.
                  </p>
                  <p className="text-amber-700">
                    Kwota: {checkoutBalance.restaurantCharges.toFixed(2)} PLN
                  </p>
                </div>
              )}
              {checkoutBalance.balance > 0 && (
                <div className="rounded-md border border-red-300 bg-red-50 p-3">
                  <p className="font-semibold text-red-800">
                    Nieopłacone saldo: {checkoutBalance.balance.toFixed(2)} PLN
                  </p>
                  <p className="text-xs text-red-600">
                    Obciążenia: {checkoutBalance.totalOwed.toFixed(2)} PLN | Wpłaty: {checkoutBalance.totalPaid.toFixed(2)} PLN
                  </p>
                </div>
              )}
              {checkoutBalance.balance <= 0 && checkoutBalance.restaurantCount > 0 && (
                <div className="rounded-md border border-green-300 bg-green-50 p-3">
                  <p className="text-green-800">
                    Saldo uregulowane. Rachunki restauracyjne uwzględnione.
                  </p>
                </div>
              )}
              <p className="text-muted-foreground">
                Czy na pewno chcesz wymeldować gościa?
              </p>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCheckoutDialogOpen(false)}
              disabled={checkoutSubmitting}
            >
              Anuluj
            </Button>
            <Button
              variant={checkoutBalance?.balance && checkoutBalance.balance > 0 ? "destructive" : "default"}
              onClick={handleCheckoutConfirm}
              disabled={checkoutSubmitting}
            >
              {checkoutSubmitting ? "Wymeldowywanie…" : checkoutBalance?.balance && checkoutBalance.balance > 0 ? "Wymelduj mimo salda" : "Wymelduj"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ContextMenu>
  );
}
