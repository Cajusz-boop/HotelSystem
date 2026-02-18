"use client";

import { useState, useEffect, useRef } from "react";
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
import { updateReservation, getReservationsByGuestId, updateGuestBlacklist, searchGuests } from "@/app/actions/reservations";
import { getRestaurantChargesForReservation } from "@/app/actions/gastronomy";
import { getRateCodes, type RateCodeForUi } from "@/app/actions/rate-codes";
import { getRatePlanInfoForRoomDate } from "@/app/actions/rooms";
import { getParkingSpotsForSelect } from "@/app/actions/parking";
import {
  getInvoicesForReservation,
  getProformasForReservation,
  getTransactionsForReservation,
  getFolioSummary,
  setFolioAssignment,
  createNewFolio,
  getFolioItems,
  transferFolioItem,
  addFolioDiscount,
  collectSecurityDeposit,
  refundSecurityDeposit,
  getReservationGuestsForFolio,
  addReservationOccupant,
  removeReservationOccupant,
  postRoomChargeOnCheckout,
  type ReservationGuestForFolio,
} from "@/app/actions/finance";
import { type FolioBillTo } from "@/lib/finance-constants";
import { searchCompanies } from "@/app/actions/companies";
import type { Reservation } from "@/lib/tape-chart-types";
import { toast } from "sonner";
import { SplitSquareVertical, User, Building2, Plus, ArrowRightLeft, Percent, Banknote } from "lucide-react";
import { AddChargeDialog } from "@/components/add-charge-dialog";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "CONFIRMED", label: "Potwierdzona" },
  { value: "CHECKED_IN", label: "Zameldowany" },
  { value: "CHECKED_OUT", label: "Wymeldowany" },
  { value: "CANCELLED", label: "Anulowana" },
  { value: "NO_SHOW", label: "No-show" },
];

export type ReservationEditSheetTab = "rozliczenie" | "dokumenty" | "posilki";

interface ReservationEditSheetProps {
  reservation: Reservation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (updated: Reservation) => void;
  /** Zakładka otwierana przy otwarciu arkusza (np. z menu kontekstowego „Wystaw dokument" / „Płatności") */
  initialTab?: ReservationEditSheetTab;
  /** Pokoje z cenami i liczbą łóżek */
  rooms?: Array<{ number: string; price?: number; beds?: number }>;
  /** Cena efektywna na datę zameldowania (ze stawek sezonowych) – nadpisuje rooms[].price */
  effectivePricePerNight?: number;
}

function RestaurantChargesTab({ reservationId }: { reservationId: string }) {
  const [charges, setCharges] = useState<
    Array<{
      id: string;
      amount: number;
      description: string | null;
      type: string;
      createdAt: string;
      receiptNumber?: string;
      cashierName?: string;
      posSystem?: string;
      items: Array<{ name: string; quantity: number; unitPrice: number }>;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getRestaurantChargesForReservation(reservationId).then((res) => {
      if (res.success && res.data) setCharges(res.data);
      setLoading(false);
    });
  }, [reservationId]);

  const totalAmount = charges.reduce((s, c) => s + c.amount, 0);

  if (loading) {
    return (
      <div className="mt-4 flex items-center justify-center py-8 text-sm text-muted-foreground">
        Wczytywanie obciążeń z restauracji...
      </div>
    );
  }

  if (charges.length === 0) {
    return (
      <div className="mt-4 space-y-3">
        <div className="rounded-lg border border-dashed bg-muted/10 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Brak obciążeń gastronomicznych dla tej rezerwacji.
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Dania nabite na pokój z systemu Symplex Bistro pojawią się tutaj automatycznie.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          Dania nabite na pokój
          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
            ({charges.length} {charges.length === 1 ? "rachunek" : charges.length < 5 ? "rachunki" : "rachunków"})
          </span>
        </h3>
        <span className="text-sm font-bold">{totalAmount.toFixed(2)} PLN</span>
      </div>

      <div className="divide-y rounded-md border">
        {charges.map((charge) => {
          const dateStr = new Date(charge.createdAt).toLocaleString("pl-PL", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });
          const hasItems = charge.items.length > 0;
          const isExpanded = expandedId === charge.id;

          return (
            <div key={charge.id} className="text-sm">
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-muted/30 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : charge.id)}
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">
                      {charge.description || "Restauracja"}
                    </span>
                    {charge.posSystem && (
                      <span className="shrink-0 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                        {charge.posSystem}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{dateStr}</span>
                    {charge.cashierName && (
                      <>
                        <span className="text-muted-foreground/50">·</span>
                        <span>Kelner: {charge.cashierName}</span>
                      </>
                    )}
                    {charge.receiptNumber && (
                      <>
                        <span className="text-muted-foreground/50">·</span>
                        <span>Rach. {charge.receiptNumber}</span>
                      </>
                    )}
                    {hasItems && (
                      <>
                        <span className="text-muted-foreground/50">·</span>
                        <span>{charge.items.length} poz.</span>
                      </>
                    )}
                  </div>
                </div>
                <span className="shrink-0 font-semibold ml-3">
                  {charge.amount.toFixed(2)} PLN
                </span>
              </button>

              {isExpanded && hasItems && (
                <div className="border-t bg-muted/5 px-3 py-2">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-muted-foreground">
                        <th className="text-left py-1 font-medium">Pozycja</th>
                        <th className="text-center py-1 font-medium w-12">Ilość</th>
                        <th className="text-right py-1 font-medium w-20">Cena</th>
                        <th className="text-right py-1 font-medium w-20">Razem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {charge.items.map((item, idx) => (
                        <tr key={idx}>
                          <td className="py-1">{item.name}</td>
                          <td className="py-1 text-center text-muted-foreground">{item.quantity}</td>
                          <td className="py-1 text-right text-muted-foreground">{item.unitPrice.toFixed(2)}</td>
                          <td className="py-1 text-right font-medium">{(item.quantity * item.unitPrice).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {isExpanded && !hasItems && (
                <div className="border-t bg-muted/5 px-3 py-2 text-xs text-muted-foreground">
                  Brak szczegółowych pozycji – obciążenie kwotowe bez listy dań.
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ReservationEditSheet({
  reservation,
  open,
  onOpenChange,
  onSaved,
  initialTab: initialTabProp,
  rooms = [],
  effectivePricePerNight,
}: ReservationEditSheetProps) {
  const [guestName, setGuestName] = useState("");
  const [room, setRoom] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [status, setStatus] = useState<string>("CONFIRMED");
  const [pax, setPax] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateCodes, setRateCodes] = useState<RateCodeForUi[]>([]);
  const [rateCodeId, setRateCodeId] = useState("");
  const [isNonRefundable, setIsNonRefundable] = useState(false);
  const [parkingSpots, setParkingSpots] = useState<{ id: string; number: string }[]>([]);
  const [parkingSpotId, setParkingSpotId] = useState("");
  const [notes, setNotes] = useState("");
  const [bedsBooked, setBedsBooked] = useState<string>("");
  const [checkInTime, setCheckInTime] = useState("");
  const [checkOutTime, setCheckOutTime] = useState("");
  const [guestHistory, setGuestHistory] = useState<Reservation[]>([]);
  const [localGuestBlacklisted, setLocalGuestBlacklisted] = useState(false);
  const [togglingBlacklist, setTogglingBlacklist] = useState(false);
  const [activeTab, setActiveTab] = useState<"rozliczenie" | "dokumenty" | "posilki">("rozliczenie");
  const [invoices, setInvoices] = useState<Array<{ id: string; number: string; amountGross: number; issuedAt: string }>>([]);
  const [proformas, setProformas] = useState<Array<{ id: string; number: string; amount: number; issuedAt: string }>>([]);
  const [transactions, setTransactions] = useState<Array<{ id: string; amount: number; type: string; createdAt: string; isReadOnly: boolean }>>([]);
  // Podział folio (split folio: gość / firma; separate checks: który gość)
  const [folioSummaries, setFolioSummaries] = useState<Array<{ folioNumber: number; balance: number; totalCharges: number; totalDiscounts: number; totalPayments: number; billTo?: FolioBillTo; guestId?: string | null; guestName?: string | null; companyId?: string | null; companyName?: string | null; label?: string | null }>>([]);
  const [editingFolioNumber, setEditingFolioNumber] = useState<number | null>(null);
  const [editBillTo, setEditBillTo] = useState<FolioBillTo>("GUEST");
  const [editGuestId, setEditGuestId] = useState("");
  const [editCompanyId, setEditCompanyId] = useState("");
  const [editLabel, setEditLabel] = useState("");
  const [reservationGuests, setReservationGuests] = useState<ReservationGuestForFolio[]>([]);
  const [companyOptions, setCompanyOptions] = useState<Array<{ id: string; nip: string; name: string; city: string | null }>>([]);
  const [companySearchQuery, setCompanySearchQuery] = useState("");
  const [folioActionLoading, setFolioActionLoading] = useState(false);
  const [newFolioLoading, setNewFolioLoading] = useState(false);
  const [occupantSearchQuery, setOccupantSearchQuery] = useState("");
  const [occupantSearchResults, setOccupantSearchResults] = useState<Array<{ id: string; name: string }>>([]);
  const [addOccupantLoading, setAddOccupantLoading] = useState(false);
  const [roomChargeLoading, setRoomChargeLoading] = useState(false);
  // Pozycje folio i przenoszenie między folio
  const [folioItemsByNumber, setFolioItemsByNumber] = useState<Record<number, Array<{ id: string; type: string; description: string | null; amount: number; status: string }>>>({});
  const [loadingItemsFolio, setLoadingItemsFolio] = useState<number | null>(null);
  const [transferLoadingId, setTransferLoadingId] = useState<string | null>(null);
  // Rabat: formularz dodawania rabatu do folio
  const [discountFolioNumber, setDiscountFolioNumber] = useState<number | null>(null);
  const [discountScope, setDiscountScope] = useState<"RESERVATION" | "LINE_ITEM">("RESERVATION");
  const [discountAppliesToTransactionId, setDiscountAppliesToTransactionId] = useState<string | null>(null);
  const [discountType, setDiscountType] = useState<"PERCENT" | "FIXED">("PERCENT");
  const [discountValue, setDiscountValue] = useState("");
  const [discountDescription, setDiscountDescription] = useState("");
  const [discountManagerPin, setDiscountManagerPin] = useState("");
  const [addDiscountLoading, setAddDiscountLoading] = useState(false);
  // Kaucja (security deposit)
  const [showCollectDeposit, setShowCollectDeposit] = useState(false);
  const [showRefundDeposit, setShowRefundDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositPaymentMethod, setDepositPaymentMethod] = useState<string>("CASH");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundDeduction, setRefundDeduction] = useState("");
  const [refundDeductionReason, setRefundDeductionReason] = useState("");
  const [refundMethod, setRefundMethod] = useState<string>("CASH");
  const [collectDepositLoading, setCollectDepositLoading] = useState(false);
  const collectDepositInFlightRef = useRef(false);
  const [refundDepositLoading, setRefundDepositLoading] = useState(false);
  const [addChargeDialogOpen, setAddChargeDialogOpen] = useState(false);

  useEffect(() => {
    if (open) setActiveTab(initialTabProp ?? "rozliczenie");
  }, [open, initialTabProp]);

  useEffect(() => {
    if (reservation) {
      setLocalGuestBlacklisted(reservation.guestBlacklisted ?? false);
      setGuestName(reservation.guestName);
      setRoom(reservation.room);
      setCheckIn(reservation.checkIn);
      setCheckOut(reservation.checkOut);
      setStatus(reservation.status);
      setPax(reservation.pax != null ? String(reservation.pax) : "");
      setRateCodeId(reservation.rateCodeId ?? "");
      setParkingSpotId(reservation.parkingSpotId ?? "");
      setNotes(reservation.notes ?? "");
      setBedsBooked(reservation.bedsBooked != null ? String(reservation.bedsBooked) : "");
      setCheckInTime(reservation.checkInTime ?? "");
      setCheckOutTime(reservation.checkOutTime ?? "");
      setError(null);
    }
  }, [reservation]);

  useEffect(() => {
    if (open) {
      getRateCodes().then((r) => r.success && r.data && setRateCodes(r.data));
      getParkingSpotsForSelect().then((r) => r.success && r.data && setParkingSpots(r.data));
    }
  }, [open]);

  useEffect(() => {
    if (open && reservation?.guestId) {
      getReservationsByGuestId(reservation.guestId).then((r) =>
        r.success && r.data ? setGuestHistory(r.data as Reservation[]) : setGuestHistory([])
      );
    } else {
      setGuestHistory([]);
    }
  }, [open, reservation?.guestId]);

  useEffect(() => {
    if (open && reservation?.id && (activeTab === "dokumenty" || activeTab === "rozliczenie")) {
      getTransactionsForReservation(reservation.id).then((r) => r.success && r.data && setTransactions(r.data));
    }
  }, [open, activeTab, reservation?.id]);

  useEffect(() => {
    if (open && activeTab === "dokumenty" && reservation?.id) {
      getInvoicesForReservation(reservation.id).then((r) => r.success && r.data && setInvoices(r.data));
      getProformasForReservation(reservation.id).then((r) => r.success && r.data && setProformas(r.data));
    }
  }, [open, activeTab, reservation?.id]);

  useEffect(() => {
    if (open && room.trim() && checkIn) {
      getRatePlanInfoForRoomDate(room.trim(), checkIn).then((info) =>
        setIsNonRefundable(info.isNonRefundable)
      );
    } else {
      setIsNonRefundable(false);
    }
  }, [open, room, checkIn]);

  useEffect(() => {
    if (open && reservation?.id && activeTab === "rozliczenie") {
      getFolioSummary(reservation.id).then((r) => {
        if (r.success && r.data?.folios) {
          setFolioSummaries(
            r.data.folios.map((f: { folioNumber: number; balance: number; totalCharges: number; totalDiscounts?: number; totalPayments: number; billTo?: FolioBillTo; guestId?: string | null; guestName?: string | null; companyId?: string | null; companyName?: string | null; label?: string | null }) => ({
              folioNumber: f.folioNumber,
              balance: f.balance,
              totalCharges: f.totalCharges,
              totalDiscounts: f.totalDiscounts ?? 0,
              totalPayments: f.totalPayments,
              billTo: f.billTo,
              guestId: f.guestId,
              guestName: f.guestName,
              companyId: f.companyId,
              companyName: f.companyName,
              label: f.label,
            }))
          );
        } else {
          setFolioSummaries([]);
        }
      });
      getReservationGuestsForFolio(reservation.id).then((r) => {
        if (r.success && r.data) setReservationGuests(r.data);
        else setReservationGuests([]);
      });
    } else {
      setFolioSummaries([]);
      setReservationGuests([]);
    }
  }, [open, activeTab, reservation?.id]);

  useEffect(() => {
    if (companySearchQuery.trim().length >= 2) {
      searchCompanies(companySearchQuery, 15).then((r) => {
        if (r.success && r.data) setCompanyOptions(r.data);
        else setCompanyOptions([]);
      });
    } else {
      setCompanyOptions([]);
    }
  }, [companySearchQuery]);

  const openFolioEditor = (folioNumber: number, billTo: FolioBillTo, guestId: string | null, _guestName: string | null, companyId: string | null, companyName: string | null, label: string | null) => {
    setEditingFolioNumber(folioNumber);
    setEditBillTo(billTo);
    setEditGuestId(guestId ?? reservation?.guestId ?? "");
    setEditCompanyId(companyId ?? "");
    setEditLabel(label ?? "");
    setCompanySearchQuery(companyName ?? "");
    if (companyName && companyId) setCompanyOptions([{ id: companyId, nip: "", name: companyName, city: null }]);
    else if (companySearchQuery.trim().length >= 2) setCompanyOptions([]);
  };

  const saveFolioAssignment = async () => {
    if (!reservation?.id || editingFolioNumber == null) return;
    setFolioActionLoading(true);
    const result = await setFolioAssignment({
      reservationId: reservation.id,
      folioNumber: editingFolioNumber,
      billTo: editBillTo,
      guestId: editBillTo === "GUEST" ? (editGuestId || null) : null,
      companyId: editBillTo === "COMPANY" ? editCompanyId || null : null,
      label: editLabel.trim() || null,
    });
    setFolioActionLoading(false);
    if (result.success) {
      toast.success("Płatnik folio zapisany");
      setEditingFolioNumber(null);
      getFolioSummary(reservation.id).then((r) => {
        if (r.success && r.data?.folios) {
          setFolioSummaries(
            r.data.folios.map((f: { folioNumber: number; balance: number; totalCharges: number; totalDiscounts?: number; totalPayments: number; billTo?: FolioBillTo; guestId?: string | null; guestName?: string | null; companyId?: string | null; companyName?: string | null; label?: string | null }) => ({
              folioNumber: f.folioNumber,
              balance: f.balance,
              totalCharges: f.totalCharges,
              totalDiscounts: f.totalDiscounts ?? 0,
              totalPayments: f.totalPayments,
              billTo: f.billTo,
              guestId: f.guestId,
              guestName: f.guestName,
              companyId: f.companyId,
              companyName: f.companyName,
              label: f.label,
            }))
          );
        }
      });
    } else {
      toast.error("error" in result ? (result.error ?? "Błąd zapisu") : "Błąd zapisu");
    }
  };

  const handleAddFolio = async () => {
    if (!reservation?.id) return;
    setNewFolioLoading(true);
    const result = await createNewFolio({
      reservationId: reservation.id,
      billTo: "GUEST",
    });
    setNewFolioLoading(false);
    if (result.success && result.data) {
      toast.success(`Utworzono folio #${result.data.folioNumber}`);
      getFolioSummary(reservation.id).then((r) => {
        if (r.success && r.data?.folios) {
          setFolioSummaries(
            r.data.folios.map((f: { folioNumber: number; balance: number; totalCharges: number; totalDiscounts?: number; totalPayments: number; billTo?: FolioBillTo; guestId?: string | null; guestName?: string | null; companyId?: string | null; companyName?: string | null; label?: string | null }) => ({
              folioNumber: f.folioNumber,
              balance: f.balance,
              totalCharges: f.totalCharges,
              totalDiscounts: f.totalDiscounts ?? 0,
              totalPayments: f.totalPayments,
              billTo: f.billTo,
              guestId: f.guestId,
              guestName: f.guestName,
              companyId: f.companyId,
              companyName: f.companyName,
              label: f.label,
            }))
          );
        }
      });
    } else {
      toast.error("error" in result ? (result.error ?? "Błąd tworzenia folio") : "Błąd tworzenia folio");
    }
  };

  const loadFolioItems = async (folioNum: number) => {
    if (!reservation?.id) return;
    setLoadingItemsFolio(folioNum);
    const result = await getFolioItems({
      reservationId: reservation.id,
      folioNumber: folioNum,
      includeVoided: false,
    });
    setLoadingItemsFolio(null);
    if (result.success && result.data?.items) {
      setFolioItemsByNumber((prev) => ({
        ...prev,
        [folioNum]: result.data!.items.map((it: { id: string; type: string; description: string | null; amount: number; status: string }) => ({
          id: it.id,
          type: it.type,
          description: it.description,
          amount: it.amount,
          status: it.status,
        })),
      }));
    } else {
      setFolioItemsByNumber((prev) => ({ ...prev, [folioNum]: [] }));
    }
  };

  const handleAddDiscount = async (folioNum: number) => {
    if (!reservation?.id) return;
    const num = discountType === "PERCENT" ? parseFloat(discountValue) : parseFloat(discountValue);
    if (Number.isNaN(num) || (discountType === "PERCENT" && (num < 0 || num > 100)) || (discountType === "FIXED" && num <= 0)) {
      toast.error(discountType === "PERCENT" ? "Wprowadź procent 0–100" : "Wprowadź kwotę rabatu > 0");
      return;
    }
    if (discountScope === "LINE_ITEM" && !discountAppliesToTransactionId?.trim()) {
      toast.error("Wybierz pozycję do rabatowania");
      return;
    }
    setAddDiscountLoading(true);
    const result = await addFolioDiscount({
      reservationId: reservation.id,
      folioNumber: folioNum,
      appliesToTransactionId: discountScope === "LINE_ITEM" ? discountAppliesToTransactionId : undefined,
      discountType,
      discountValue: num,
      description: discountDescription.trim() || undefined,
      managerPin: discountManagerPin.trim() || undefined,
    });
    setAddDiscountLoading(false);
    if (result.success) {
      const scopeLabel = result.data?.discountScope === "LINE_ITEM" ? " (na pozycję)" : "";
      toast.success(`Dodano rabat${scopeLabel}: ${result.data?.discountAmount.toFixed(2) ?? ""} PLN`);
      setDiscountValue("");
      setDiscountDescription("");
      setDiscountFolioNumber(null);
      setDiscountScope("RESERVATION");
      setDiscountAppliesToTransactionId(null);
      getFolioSummary(reservation.id).then((r) => {
        if (r.success && r.data?.folios) {
          setFolioSummaries(
            r.data.folios.map((f: { folioNumber: number; balance: number; totalCharges: number; totalDiscounts?: number; totalPayments: number; billTo?: FolioBillTo; guestId?: string | null; guestName?: string | null; companyId?: string | null; companyName?: string | null; label?: string | null }) => ({
              folioNumber: f.folioNumber,
              balance: f.balance,
              totalCharges: f.totalCharges,
              totalDiscounts: f.totalDiscounts ?? 0,
              totalPayments: f.totalPayments,
              billTo: f.billTo,
              guestId: f.guestId,
              guestName: f.guestName,
              companyId: f.companyId,
              companyName: f.companyName,
              label: f.label,
            }))
          );
        }
      });
      loadFolioItems(folioNum);
    } else {
      toast.error("error" in result ? (result.error ?? "Błąd dodawania rabatu") : "Błąd dodawania rabatu");
    }
  };

  const handleTransferItem = async (transactionId: string, fromFolioNumber: number, targetFolioNumber: number) => {
    if (!reservation?.id) return;
    setTransferLoadingId(transactionId);
    const result = await transferFolioItem({
      transactionId,
      targetFolioNumber,
    });
    setTransferLoadingId(null);
    if (result.success) {
      toast.success(`Przeniesiono pozycję do folio #${targetFolioNumber}`);
      getFolioSummary(reservation.id).then((r) => {
        if (r.success && r.data?.folios) {
          setFolioSummaries(
            r.data.folios.map((f: { folioNumber: number; balance: number; totalCharges: number; totalDiscounts?: number; totalPayments: number; billTo?: FolioBillTo; companyId?: string | null; companyName?: string | null; label?: string | null }) => ({
              folioNumber: f.folioNumber,
              balance: f.balance,
              totalCharges: f.totalCharges,
              totalDiscounts: f.totalDiscounts ?? 0,
              totalPayments: f.totalPayments,
              billTo: f.billTo,
              companyId: f.companyId,
              companyName: f.companyName,
              label: f.label,
            }))
          );
        }
      });
      loadFolioItems(fromFolioNumber);
      loadFolioItems(targetFolioNumber);
    } else {
      toast.error("error" in result ? (result.error ?? "Błąd przenoszenia") : "Błąd przenoszenia");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reservation) return;
    setSaving(true);
    setError(null);
    const roomData = rooms.find((r) => r.number === room.trim());
    const roomBeds = roomData?.beds ?? 1;
    const result = await updateReservation(reservation.id, {
      guestName: guestName.trim() || undefined,
      room: room.trim() || undefined,
      checkIn: checkIn || undefined,
      checkOut: checkOut || undefined,
      checkInTime: checkInTime.trim() || undefined,
      checkOutTime: checkOutTime.trim() || undefined,
      status: status as Reservation["status"],
      pax: pax !== "" ? parseInt(pax, 10) : undefined,
      bedsBooked: roomBeds > 1 ? (bedsBooked !== "" ? parseInt(bedsBooked, 10) : null) : undefined,
      rateCodeId: rateCodeId || undefined,
      parkingSpotId: parkingSpotId || null,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (result.success && result.data) {
      onSaved?.(result.data as Reservation);
      onOpenChange(false);
    } else {
      setError("error" in result ? (result.error ?? null) : null);
    }
  };

  if (!reservation) return null;

  const roomData = rooms.find((r) => r.number === room);
  const pricePerNight = effectivePricePerNight ?? roomData?.price;
  const nights =
    checkIn && checkOut
      ? Math.round(
          (new Date(checkOut).getTime() - new Date(checkIn).getTime()) /
            (24 * 60 * 60 * 1000)
        )
      : 0;
  const totalAmount =
    pricePerNight != null && pricePerNight > 0 && nights > 0
      ? pricePerNight * nights
      : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" data-scroll-area>
        <DialogHeader>
          <DialogTitle>Edycja rezerwacji</DialogTitle>
        </DialogHeader>
        <div className="mt-4 flex gap-1 border-b border-border">
          <button
            type="button"
            onClick={() => setActiveTab("rozliczenie")}
            className={`px-3 py-2 text-sm font-medium ${activeTab === "rozliczenie" ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            Rozliczenie
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("dokumenty")}
            className={`px-3 py-2 text-sm font-medium ${activeTab === "dokumenty" ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            Dokumenty
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("posilki")}
            className={`px-3 py-2 text-sm font-medium ${activeTab === "posilki" ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            Posiłki
          </button>
        </div>
        {activeTab === "dokumenty" && (
          <div className="mt-4 space-y-4">
            <div>
              <p className="mb-2 text-sm font-medium">Druki</p>
              <button
                type="button"
                onClick={() =>
                  window.open(
                    `/api/reservations/${reservation.id}/registration-card/pdf`,
                    "_blank",
                    "noopener,noreferrer"
                  )
                }
                className="text-sm text-primary hover:underline underline-offset-2"
              >
                Drukuj kartę meldunkową
              </button>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Transakcje (KP/KW)</p>
              <ul className="list-none space-y-1 text-sm">
                {transactions.length === 0 ? (
                  <li className="text-muted-foreground">Brak transakcji.</li>
                ) : (
                  transactions.map((t) => (
                    <li key={t.id} className="flex justify-between rounded border px-2 py-1">
                      <span>{t.type}</span>
                      <span>{t.amount.toFixed(2)} PLN · {new Date(t.createdAt).toLocaleString("pl-PL")}{t.isReadOnly ? " (zamknięta)" : ""}</span>
                    </li>
                  ))
                )}
              </ul>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Proformy</p>
              <ul className="list-none space-y-1 text-sm">
                {proformas.length === 0 ? (
                  <li className="text-muted-foreground">Brak proform.</li>
                ) : (
                  proformas.map((p) => (
                    <li key={p.id} className="flex justify-between rounded border px-2 py-1">
                      <span>{p.number}</span>
                      <span>{p.amount.toFixed(2)} PLN</span>
                    </li>
                  ))
                )}
              </ul>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Faktury VAT</p>
              <ul className="list-none space-y-1 text-sm">
                {invoices.length === 0 ? (
                  <li className="text-muted-foreground">Brak faktur.</li>
                ) : (
                  invoices.map((i) => (
                    <li
                      key={i.id}
                      className="flex justify-between rounded border px-2 py-1 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => window.open(`/api/finance/invoice/${i.id}/pdf`, "_blank", "noopener,noreferrer")}
                      title="Kliknij, aby otworzyć PDF faktury"
                    >
                      <span className="text-primary underline underline-offset-2">{i.number}</span>
                      <span>{i.amountGross.toFixed(2)} PLN</span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        )}
        {activeTab === "posilki" && (
          <RestaurantChargesTab reservationId={reservation.id} />
        )}
        {activeTab === "rozliczenie" && (
        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          <div className="space-y-2">
            <Label htmlFor="guestName">Gość</Label>
            <div className="flex items-center gap-2">
              <Input
                id="guestName"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Imię i nazwisko"
              />
              {reservation.guestId && (
                <a
                  href={`/guests/${reservation.guestId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-sm text-primary hover:underline"
                >
                  Edycja klienta
                </a>
              )}
            </div>
          </div>
          {reservation.guestId && (
            <div className="flex items-center gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm">
              {localGuestBlacklisted ? (
                <>
                  <span className="font-medium text-amber-700 dark:text-amber-400">Gość na czarnej liście</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={togglingBlacklist}
                    onClick={async () => {
                      setTogglingBlacklist(true);
                      const res = await updateGuestBlacklist(reservation!.guestId!, false);
                      setTogglingBlacklist(false);
                      if (res.success) setLocalGuestBlacklisted(false);
                    }}
                  >
                    Usuń z listy
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={togglingBlacklist}
                    onClick={async () => {
                      setTogglingBlacklist(true);
                      const res = await updateGuestBlacklist(reservation!.guestId!, true);
                      setTogglingBlacklist(false);
                      if (res.success) setLocalGuestBlacklisted(true);
                    }}
                  >
                    Dodaj do czarnej listy
                  </Button>
                </>
              )}
            </div>
          )}
          {guestHistory.length > 0 && (
            <details className="rounded-md border bg-muted/20">
              <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
                Historia pobytów ({guestHistory.length})
              </summary>
              <ul className="list-none space-y-1 px-3 pb-2 text-sm">
                {guestHistory.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="font-medium">{r.room}</span>
                    <span className="text-muted-foreground">
                      {r.checkIn} – {r.checkOut}
                    </span>
                    <span className="text-muted-foreground">·</span>
                    <span className={r.id === reservation.id ? "font-medium text-primary" : ""}>
                      {r.id === reservation.id ? "(bieżąca) " : ""}
                      {STATUS_OPTIONS.find((s) => s.value === r.status)?.label ?? r.status}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
          {(() => {
            const rBeds = rooms.find((r) => r.number === room)?.beds ?? 1;
            if (rBeds <= 1) return null;
            return (
              <div className="space-y-2">
                <Label htmlFor="bedsBooked">Łóżek (rezerwacja zasobowa)</Label>
                <Input
                  id="bedsBooked"
                  type="number"
                  min={1}
                  max={rBeds}
                  value={bedsBooked}
                  onChange={(e) => setBedsBooked(e.target.value)}
                  placeholder={`1–${rBeds}`}
                />
              </div>
            );
          })()}
          <div className="space-y-2">
            <Label htmlFor="room">Pokój</Label>
            <Input
              id="room"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              placeholder="Numer pokoju"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="checkIn">Zameldowanie</Label>
              <Input
                id="checkIn"
                type="date"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="checkOut">Wymeldowanie</Label>
              <Input
                id="checkOut"
                type="date"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="checkInTime">Godzina od (rezerwacja godzinowa)</Label>
              <Input
                id="checkInTime"
                type="time"
                value={checkInTime}
                onChange={(e) => setCheckInTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="checkOutTime">Godzina do</Label>
              <Input
                id="checkOutTime"
                type="time"
                value={checkOutTime}
                onChange={(e) => setCheckOutTime(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="parking">Miejsce parkingowe (opcjonalnie)</Label>
            <select
              id="parking"
              value={parkingSpotId}
              onChange={(e) => setParkingSpotId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">— brak —</option>
              {parkingSpots.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.number}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rateCode">Kod stawki (opcjonalnie)</Label>
            <select
              id="rateCode"
              value={rateCodeId}
              onChange={(e) => setRateCodeId(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">— brak —</option>
              {rateCodes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} – {c.name}
                  {c.price != null ? ` (${c.price} PLN)` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          {(pricePerNight != null && pricePerNight > 0) && (
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
              <p><strong>Cena za dobę:</strong> {pricePerNight} PLN</p>
              {nights > 0 && (
                <p><strong>Liczba nocy:</strong> {nights} · <strong>Suma noclegu:</strong> {totalAmount?.toFixed(0)} PLN</p>
              )}
              {transactions.length > 0 && (
                <p className="mt-1">
                  <strong>Wpłaty (KP/KW):</strong>{" "}
                  {transactions
                    .filter((t) => t.type === "DEPOSIT" || t.type === "ROOM")
                    .reduce((s, t) => s + t.amount, 0)
                    .toFixed(2)}{" "}
                  PLN
                  {totalAmount != null && totalAmount > 0 && (
                    <> · <strong>Saldo (szac.):</strong> {(totalAmount - transactions.filter((t) => t.type === "DEPOSIT" || t.type === "ROOM").reduce((s, t) => s + t.amount, 0)).toFixed(0)} PLN</>
                  )}
                </p>
              )}
              {transactions.some((t) => t.type === "ROOM") ? (
                <p className="mt-1 text-xs text-green-600 dark:text-green-400">✓ Nocleg naliczony</p>
              ) : (
                reservation?.id && nights > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2 w-full"
                    disabled={roomChargeLoading}
                    onClick={async () => {
                      if (!reservation?.id) return;
                      setRoomChargeLoading(true);
                      const result = await postRoomChargeOnCheckout(reservation.id);
                      setRoomChargeLoading(false);
                      if (result.success && result.data) {
                        if (result.data.skipped) {
                          toast.info("Nocleg już był naliczony.");
                        } else {
                          toast.success(`Naliczono nocleg: ${result.data.amount?.toFixed(2)} PLN`);
                        }
                        getTransactionsForReservation(reservation.id).then((r) => r.success && r.data && setTransactions(r.data));
                      } else {
                        toast.error("error" in result ? result.error : "Błąd naliczania noclegu");
                      }
                    }}
                  >
                    <Banknote className="mr-2 h-4 w-4" />
                    {roomChargeLoading ? "Naliczanie..." : "Nalicz nocleg"}
                  </Button>
                )
              )}
            </div>
          )}
          {isNonRefundable && (
            <p className="text-sm font-medium text-amber-600 dark:text-amber-500">
              Stawka non-refundable – brak zwrotu przy anulowaniu
            </p>
          )}
          {/* Podział folio (split folio: gość / firma) */}
          <details className="rounded-md border bg-muted/20">
            <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm font-medium">
              <SplitSquareVertical className="h-4 w-4" />
              Podział folio (split – np. firma + gość prywatnie)
            </summary>
            <div className="space-y-3 border-t px-3 pb-3 pt-2">
              {/* Goście w pokoju (separate checks) */}
              <div className="rounded border border-border/50 p-2">
                <p className="mb-2 text-xs font-medium text-muted-foreground">Goście w pokoju (osobne rachunki)</p>
                <ul className="list-none space-y-1 text-sm">
                  {reservationGuests.map((g) => (
                    <li key={g.guestId} className="flex items-center justify-between gap-2 rounded bg-muted/30 px-2 py-1">
                      <span>{g.name} {g.isPrimary ? "(główny)" : ""}</span>
                      {!g.isPrimary && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs text-destructive hover:text-destructive"
                          onClick={async () => {
                            if (!reservation?.id) return;
                            const result = await removeReservationOccupant(reservation.id, g.guestId);
                            if (result.success) {
                              toast.success("Usunięto gościa z pokoju");
                              getReservationGuestsForFolio(reservation.id).then((r) => r.success && r.data && setReservationGuests(r.data));
                            } else {
                              toast.error(result.error);
                            }
                          }}
                        >
                          Usuń
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex gap-2">
                  <Input
                    type="text"
                    placeholder="Wyszukaj gościa (min. 2 znaki)"
                    value={occupantSearchQuery}
                    onChange={(e) => {
                      const q = e.target.value;
                      setOccupantSearchQuery(q);
                      if (q.trim().length >= 2) {
                        searchGuests(q, { limit: 8 }).then((r) => {
                          if (r.success && r.data?.guests) setOccupantSearchResults(r.data.guests.map((g: { id: string; name: string }) => ({ id: g.id, name: g.name })));
                          else setOccupantSearchResults([]);
                        });
                      } else setOccupantSearchResults([]);
                    }}
                    className="h-8 text-sm"
                  />
                </div>
                {occupantSearchResults.length > 0 && (
                  <ul className="mt-1 list-none space-y-0.5 text-xs">
                    {occupantSearchResults
                      .filter((g) => !reservationGuests.some((r) => r.guestId === g.id))
                      .slice(0, 5)
                      .map((g) => (
                        <li key={g.id}>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 w-full justify-start text-left font-normal"
                            disabled={addOccupantLoading}
                            onClick={async () => {
                              if (!reservation?.id) return;
                              setAddOccupantLoading(true);
                              const result = await addReservationOccupant(reservation.id, g.id);
                              setAddOccupantLoading(false);
                              if (result.success) {
                                toast.success(`Dodano ${g.name} do pokoju`);
                                setOccupantSearchQuery("");
                                setOccupantSearchResults([]);
                                getReservationGuestsForFolio(reservation.id).then((r) => r.success && r.data && setReservationGuests(r.data));
                              } else {
                                toast.error(result.error);
                              }
                            }}
                          >
                            + {g.name}
                          </Button>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
              {/* Kaucja (security deposit) */}
              <details className="rounded border border-border/50">
                <summary className="cursor-pointer px-2 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
                  <Banknote className="mr-1.5 inline-block h-4 w-4" />
                  Kaucja za pokój
                </summary>
                <div className="border-t px-2 py-2 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => { setShowCollectDeposit(!showCollectDeposit); setShowRefundDeposit(false); }}
                    >
                      Pobierz kaucję
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => { setShowRefundDeposit(!showRefundDeposit); setShowCollectDeposit(false); }}
                    >
                      Zwróć kaucję
                    </Button>
                  </div>
                  {showCollectDeposit && reservation?.id && (
                    <div className="rounded border bg-muted/10 p-2 space-y-2 text-xs">
                      <Label className="text-xs">Kwota (PLN)</Label>
                      <Input
                        type="number"
                        min={0.01}
                        step={0.01}
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        placeholder="np. 500"
                        className="h-8 w-28"
                      />
                      <Label className="text-xs">Metoda płatności</Label>
                      <select
                        className="h-8 rounded border border-input bg-background px-2 w-32 text-xs"
                        value={depositPaymentMethod}
                        onChange={(e) => setDepositPaymentMethod(e.target.value)}
                      >
                        <option value="CASH">Gotówka</option>
                        <option value="CARD">Karta</option>
                        <option value="TRANSFER">Przelew</option>
                        <option value="PREPAID">Przedpłata</option>
                      </select>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={collectDepositLoading || !depositAmount || parseFloat(depositAmount) <= 0}
                          onClick={async () => {
                            if (!reservation?.id) return;
                            if (collectDepositInFlightRef.current) return;
                            const amt = parseFloat(depositAmount);
                            if (Number.isNaN(amt) || amt <= 0) {
                              toast.error("Kwota kaucji musi być większa od zera.");
                              return;
                            }
                            collectDepositInFlightRef.current = true;
                            setCollectDepositLoading(true);
                            try {
                              const r = await collectSecurityDeposit({
                              reservationId: reservation.id,
                              amount: amt,
                              paymentMethod: depositPaymentMethod as "CASH" | "CARD" | "TRANSFER" | "PREPAID",
                            });
                              if (r.success) {
                                toast.success(`Pobrano kaucję: ${amt.toFixed(2)} PLN`);
                                setDepositAmount("");
                                setShowCollectDeposit(false);
                                getFolioSummary(reservation.id).then((res) => {
                                  if (res.success && res.data?.folios) {
                                    setFolioSummaries(res.data.folios.map((f: { folioNumber: number; balance: number; totalCharges: number; totalDiscounts?: number; totalPayments: number; billTo?: FolioBillTo; guestId?: string | null; guestName?: string | null; companyId?: string | null; companyName?: string | null; label?: string | null }) => ({
                                      folioNumber: f.folioNumber,
                                      balance: f.balance,
                                      totalCharges: f.totalCharges,
                                      totalDiscounts: f.totalDiscounts ?? 0,
                                      totalPayments: f.totalPayments,
                                      billTo: f.billTo,
                                      guestId: f.guestId,
                                      guestName: f.guestName,
                                      companyId: f.companyId,
                                      companyName: f.companyName,
                                      label: f.label,
                                    })));
                                  }
                                });
                              } else {
                                toast.error("error" in r ? (r.error ?? "Błąd pobierania kaucji") : "Błąd pobierania kaucji");
                              }
                            } finally {
                              collectDepositInFlightRef.current = false;
                              setCollectDepositLoading(false);
                            }
                          }}
                        >
                          {collectDepositLoading ? "Zapisywanie…" : "Zapisz"}
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => { setShowCollectDeposit(false); setDepositAmount(""); }}>
                          Anuluj
                        </Button>
                      </div>
                    </div>
                  )}
                  {showRefundDeposit && reservation?.id && (
                    <div className="rounded border bg-muted/10 p-2 space-y-2 text-xs">
                      <Label className="text-xs">Kwota do zwrotu (PLN, puste = całość)</Label>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={refundAmount}
                        onChange={(e) => setRefundAmount(e.target.value)}
                        placeholder="Całość"
                        className="h-8 w-28"
                      />
                      <Label className="text-xs">Potrącenie (PLN, opcjonalnie)</Label>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={refundDeduction}
                        onChange={(e) => setRefundDeduction(e.target.value)}
                        placeholder="0"
                        className="h-8 w-28"
                      />
                      <Label className="text-xs">Powód potrącenia</Label>
                      <Input
                        type="text"
                        value={refundDeductionReason}
                        onChange={(e) => setRefundDeductionReason(e.target.value)}
                        placeholder="np. minibar, uszkodzenia"
                        className="h-8 w-48"
                      />
                      <Label className="text-xs">Metoda zwrotu</Label>
                      <select
                        className="h-8 rounded border border-input bg-background px-2 w-32 text-xs"
                        value={refundMethod}
                        onChange={(e) => setRefundMethod(e.target.value)}
                      >
                        <option value="CASH">Gotówka</option>
                        <option value="CARD">Karta</option>
                        <option value="TRANSFER">Przelew</option>
                      </select>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={refundDepositLoading}
                          onClick={async () => {
                            if (!reservation?.id) return;
                            setRefundDepositLoading(true);
                            const r = await refundSecurityDeposit({
                              reservationId: reservation.id,
                              refundAmount: refundAmount.trim() ? parseFloat(refundAmount) : undefined,
                              deductionAmount: refundDeduction.trim() ? parseFloat(refundDeduction) : undefined,
                              deductionReason: refundDeductionReason.trim() || undefined,
                              refundMethod: refundMethod as "CASH" | "CARD" | "TRANSFER",
                            });
                            setRefundDepositLoading(false);
                            if (r.success) {
                              toast.success(r.data?.refundAmount ? `Zwrócono kaucję: ${r.data.refundAmount.toFixed(2)} PLN` : "Zapisano potrącenie z kaucji");
                              setRefundAmount("");
                              setRefundDeduction("");
                              setRefundDeductionReason("");
                              setShowRefundDeposit(false);
                              getFolioSummary(reservation.id).then((res) => {
                                if (res.success && res.data?.folios) {
                                  setFolioSummaries(res.data.folios.map((f: { folioNumber: number; balance: number; totalCharges: number; totalDiscounts?: number; totalPayments: number; billTo?: FolioBillTo; guestId?: string | null; guestName?: string | null; companyId?: string | null; companyName?: string | null; label?: string | null }) => ({
                                    folioNumber: f.folioNumber,
                                    balance: f.balance,
                                    totalCharges: f.totalCharges,
                                    totalDiscounts: f.totalDiscounts ?? 0,
                                    totalPayments: f.totalPayments,
                                    billTo: f.billTo,
                                    guestId: f.guestId,
                                    guestName: f.guestName,
                                    companyId: f.companyId,
                                    companyName: f.companyName,
                                    label: f.label,
                                  })));
                                }
                              });
                            } else {
                              toast.error("error" in r ? (r.error ?? "Błąd zwrotu kaucji") : "Błąd zwrotu kaucji");
                            }
                          }}
                        >
                          {refundDepositLoading ? "Zapisywanie…" : "Zwróć"}
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => { setShowRefundDeposit(false); setRefundAmount(""); setRefundDeduction(""); setRefundDeductionReason(""); }}>
                          Anuluj
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </details>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAddChargeDialogOpen(true)}
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Dodaj obciążenie
                </Button>
              </div>
              {folioSummaries.length === 0 ? (
                <p className="text-sm text-muted-foreground">Brak folio. Dodaj folio, aby rozdzielić rozliczenie (np. firma + gość).</p>
              ) : (
                <ul className="list-none space-y-2">
                  {folioSummaries.map((f) => (
                    <li key={f.folioNumber} className="rounded border px-3 py-2 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">Folio #{f.folioNumber}</span>
                        <span className="text-muted-foreground">
                          Obciążenia: {f.totalCharges.toFixed(2)} PLN
                          {f.totalDiscounts > 0 && <> · Rabaty: {f.totalDiscounts.toFixed(2)} PLN</>}
                          {" · "}Płatności: {f.totalPayments.toFixed(2)} PLN · Saldo: {f.balance.toFixed(2)} PLN
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-muted-foreground">
                        {f.billTo === "COMPANY" && f.companyName ? (
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3.5 w-3.5" />
                            Firma: {f.companyName}
                            {f.label ? ` · ${f.label}` : ""}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <User className="h-3.5 w-3.5" />
                            Gość: {f.guestName ?? "Główny gość"}
                            {f.label ? ` · ${f.label}` : ""}
                          </span>
                        )}
                        {editingFolioNumber === f.folioNumber ? (
                          <Button type="button" variant="ghost" size="sm" onClick={() => setEditingFolioNumber(null)}>
                            Anuluj
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openFolioEditor(f.folioNumber, f.billTo ?? "GUEST", f.guestId ?? null, f.guestName ?? null, f.companyId ?? null, f.companyName ?? null, f.label ?? null)}
                          >
                            Ustaw płatnika
                          </Button>
                        )}
                      </div>
                      {editingFolioNumber === f.folioNumber && (
                        <div className="mt-3 space-y-2 rounded border bg-background p-2">
                          <div className="flex gap-2">
                            <Label className="shrink-0 pt-2 text-xs">Płatnik</Label>
                            <div className="flex flex-1 gap-2">
                              <label className="flex cursor-pointer items-center gap-1.5 text-sm">
                                <input
                                  type="radio"
                                  name={`billTo-${f.folioNumber}`}
                                  checked={editBillTo === "GUEST"}
                                  onChange={() => setEditBillTo("GUEST")}
                                  className="rounded"
                                />
                                Gość
                              </label>
                              <label className="flex cursor-pointer items-center gap-1.5 text-sm">
                                <input
                                  type="radio"
                                  name={`billTo-${f.folioNumber}`}
                                  checked={editBillTo === "COMPANY"}
                                  onChange={() => setEditBillTo("COMPANY")}
                                  className="rounded"
                                />
                                Firma
                              </label>
                            </div>
                          </div>
                          {editBillTo === "GUEST" && reservationGuests.length > 0 && (
                            <div className="space-y-1">
                              <Label className="text-xs">Który gość (osobny rachunek)</Label>
                              <select
                                className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
                                value={editGuestId}
                                onChange={(e) => setEditGuestId(e.target.value)}
                              >
                                {reservationGuests.map((g) => (
                                  <option key={g.guestId} value={g.guestId}>
                                    {g.name} {g.isPrimary ? "(główny)" : ""}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                          {editBillTo === "COMPANY" && (
                            <div className="space-y-1">
                              <Label className="text-xs">Firma (wyszukaj min. 2 znaki)</Label>
                              <Input
                                type="text"
                                value={companySearchQuery}
                                onChange={(e) => setCompanySearchQuery(e.target.value)}
                                placeholder="Nazwa lub NIP firmy"
                                className="h-8 text-sm"
                              />
                              {companyOptions.length > 0 && (
                                <select
                                  className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
                                  value={editCompanyId}
                                  onChange={(e) => {
                                    const id = e.target.value;
                                    const c = companyOptions.find((x) => x.id === id);
                                    if (c) {
                                      setEditCompanyId(c.id);
                                      setCompanySearchQuery(c.name);
                                    }
                                  }}
                                >
                                  <option value="">— wybierz firmę —</option>
                                  {companyOptions.map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.name} {c.nip ? `(${c.nip})` : ""}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          )}
                          <div className="space-y-1">
                            <Label className="text-xs">Etykieta (opcjonalnie)</Label>
                            <Input
                              type="text"
                              value={editLabel}
                              onChange={(e) => setEditLabel(e.target.value)}
                              placeholder="np. Gość prywatnie"
                              className="h-8 text-sm"
                            />
                          </div>
                          <Button type="button" size="sm" disabled={folioActionLoading} onClick={saveFolioAssignment}>
                            {folioActionLoading ? "Zapisywanie…" : "Zapisz"}
                          </Button>
                        </div>
                      )}
                      {/* Pozycje folio i przenoszenie między folio */}
                      <details
                        className="mt-2 rounded border border-border/50"
                        onToggle={(e) => {
                          const details = e.currentTarget;
                          if (details.open && !folioItemsByNumber[f.folioNumber] && loadingItemsFolio !== f.folioNumber) {
                            loadFolioItems(f.folioNumber);
                          }
                        }}
                      >
                        <summary className="flex cursor-pointer items-center gap-2 px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
                          <ArrowRightLeft className="h-3.5 w-3.5" />
                          Pozycje {loadingItemsFolio === f.folioNumber ? "(ładowanie…)" : folioItemsByNumber[f.folioNumber] ? `(${folioItemsByNumber[f.folioNumber].length})` : ""}
                        </summary>
                        <div className="border-t px-2 py-2">
                          {loadingItemsFolio === f.folioNumber ? (
                            <p className="text-xs text-muted-foreground">Ładowanie…</p>
                          ) : (folioItemsByNumber[f.folioNumber]?.length ?? 0) === 0 ? (
                            <p className="text-xs text-muted-foreground">Brak aktywnych pozycji w tym folio.</p>
                          ) : (
                            <>
                            <ul className="list-none space-y-1.5">
                              {folioItemsByNumber[f.folioNumber]?.map((item) => (
                                <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded border bg-muted/20 px-2 py-1.5 text-xs">
                                  <span className="font-medium">{item.type === "DISCOUNT" ? "Rabat" : item.type}</span>
                                  <span>{item.description ?? ""} · {item.type === "DISCOUNT" ? "-" : ""}{item.amount.toFixed(2)} PLN</span>
                                  {folioSummaries.length > 1 && (
                                    <select
                                      className="h-7 rounded border border-input bg-background px-1.5 text-xs"
                                      value=""
                                      onChange={(e) => {
                                        const target = parseInt(e.target.value, 10);
                                        if (!Number.isNaN(target)) handleTransferItem(item.id, f.folioNumber, target);
                                        e.target.value = "";
                                      }}
                                      disabled={!!transferLoadingId}
                                    >
                                      <option value="">Przenieś do folio…</option>
                                      {folioSummaries
                                        .filter((o) => o.folioNumber !== f.folioNumber)
                                        .map((o) => (
                                          <option key={o.folioNumber} value={o.folioNumber}>
                                            Folio #{o.folioNumber}
                                          </option>
                                        ))}
                                    </select>
                                  )}
                                </li>
                              ))}
                            </ul>
                            {/* Formularz dodawania rabatu */}
                            <div className="mt-3 space-y-2 rounded border border-dashed border-muted-foreground/40 bg-muted/10 p-2">
                              {discountFolioNumber === f.folioNumber ? (
                                <>
                                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                                    <Percent className="h-3.5 w-3.5" /> Rabat procentowy lub kwotowy
                                  </div>
                                  <div className="flex flex-col gap-2">
                                    <div className="flex flex-wrap items-center gap-3 text-xs">
                                      <span className="text-muted-foreground">Zakres rabatu:</span>
                                      <label className="flex items-center gap-1.5">
                                        <input
                                          type="radio"
                                          name={`discount-scope-${f.folioNumber}`}
                                          checked={discountScope === "RESERVATION"}
                                          onChange={() => { setDiscountScope("RESERVATION"); setDiscountAppliesToTransactionId(null); }}
                                          className="rounded border-input"
                                        />
                                        Na całe folio
                                      </label>
                                      <label className="flex items-center gap-1.5">
                                        <input
                                          type="radio"
                                          name={`discount-scope-${f.folioNumber}`}
                                          checked={discountScope === "LINE_ITEM"}
                                          onChange={() => { setDiscountScope("LINE_ITEM"); setDiscountAppliesToTransactionId(null); if (!folioItemsByNumber[f.folioNumber]) loadFolioItems(f.folioNumber); }}
                                          className="rounded border-input"
                                        />
                                        Na wybraną pozycję
                                      </label>
                                    </div>
                                    {discountScope === "LINE_ITEM" && (
                                      <label className="flex flex-col gap-0.5 text-xs">
                                        <span>Pozycja do rabatowania</span>
                                        <select
                                          className="h-8 max-w-xs rounded border border-input bg-background px-2 text-xs"
                                          value={discountAppliesToTransactionId ?? ""}
                                          onChange={(e) => setDiscountAppliesToTransactionId(e.target.value || null)}
                                        >
                                          <option value="">— wybierz pozycję —</option>
                                          {(folioItemsByNumber[f.folioNumber] ?? [])
                                            .filter((it) => it.type !== "DISCOUNT" && it.type !== "PAYMENT" && it.amount > 0)
                                            .map((it) => (
                                              <option key={it.id} value={it.id}>
                                                {it.description || it.type} — {Number(it.amount).toFixed(2)} PLN
                                              </option>
                                            ))}
                                        </select>
                                        {(!folioItemsByNumber[f.folioNumber] && loadingItemsFolio === f.folioNumber) && (
                                          <span className="text-muted-foreground">Ładowanie pozycji…</span>
                                        )}
                                        {(folioItemsByNumber[f.folioNumber]?.length ?? 0) > 0 &&
                                          (folioItemsByNumber[f.folioNumber] ?? []).filter((it) => it.type !== "DISCOUNT" && it.type !== "PAYMENT" && it.amount > 0).length === 0 && (
                                            <span className="text-muted-foreground">Brak obciążeń w tym folio (tylko rabaty/płatności).</span>
                                        )}
                                      </label>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-end gap-2">
                                    <label className="flex flex-col gap-0.5 text-xs">
                                      <span>Typ</span>
                                      <select
                                        className="h-8 rounded border border-input bg-background px-2 text-xs"
                                        value={discountType}
                                        onChange={(e) => setDiscountType(e.target.value as "PERCENT" | "FIXED")}
                                      >
                                        <option value="PERCENT">Procent (%)</option>
                                        <option value="FIXED">Kwota (PLN)</option>
                                      </select>
                                    </label>
                                    <label className="flex flex-col gap-0.5 text-xs">
                                      <span>{discountType === "PERCENT" ? "Procent (0–100)" : "Kwota (PLN)"}</span>
                                      <Input
                                        type="number"
                                        min={discountType === "PERCENT" ? 0 : 0.01}
                                        max={discountType === "PERCENT" ? 100 : undefined}
                                        step={discountType === "PERCENT" ? 1 : 0.01}
                                        value={discountValue}
                                        onChange={(e) => setDiscountValue(e.target.value)}
                                        placeholder={discountType === "PERCENT" ? "np. 10" : "np. 50.00"}
                                        className="h-8 w-24 text-xs"
                                      />
                                    </label>
                                    <Input
                                      type="text"
                                      value={discountDescription}
                                      onChange={(e) => setDiscountDescription(e.target.value)}
                                      placeholder="Opis (opcjonalnie)"
                                      className="h-8 w-32 text-xs"
                                    />
                                    <label className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                                      <span>PIN managera (gdy limit przekroczony)</span>
                                      <Input
                                        type="password"
                                        inputMode="numeric"
                                        autoComplete="off"
                                        value={discountManagerPin}
                                        onChange={(e) => setDiscountManagerPin(e.target.value)}
                                        placeholder="Opcjonalnie"
                                        className="h-8 w-20 text-xs"
                                      />
                                    </label>
                                    <Button
                                      type="button"
                                      size="sm"
                                      disabled={addDiscountLoading || !discountValue.trim() || (discountScope === "LINE_ITEM" && !discountAppliesToTransactionId)}
                                      onClick={() => handleAddDiscount(f.folioNumber)}
                                    >
                                      {addDiscountLoading ? "Dodawanie…" : "Dodaj rabat"}
                                    </Button>
                                    <Button type="button" variant="ghost" size="sm" onClick={() => { setDiscountFolioNumber(null); setDiscountValue(""); setDiscountDescription(""); setDiscountScope("RESERVATION"); setDiscountAppliesToTransactionId(null); setDiscountManagerPin(""); }}>
                                      Anuluj
                                    </Button>
                                  </div>
                                </>
                              ) : (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="text-xs"
                                  onClick={() => { setDiscountFolioNumber(f.folioNumber); setDiscountScope("RESERVATION"); setDiscountAppliesToTransactionId(null); if (!folioItemsByNumber[f.folioNumber]) loadFolioItems(f.folioNumber); }}
                                >
                                  <Banknote className="mr-1 h-3.5 w-3.5" />
                                  Dodaj rabat
                                </Button>
                              )}
                            </div>
                            </>
                          )}
                        </div>
                      </details>
                    </li>
                  ))}
                </ul>
              )}
              {folioSummaries.length > 0 && folioSummaries.length < 10 && (
                <Button type="button" variant="outline" size="sm" disabled={newFolioLoading} onClick={handleAddFolio}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  {newFolioLoading ? "Tworzenie…" : "Dodaj folio"}
                </Button>
              )}
            </div>
          </details>
          {reservation && (
            <AddChargeDialog
              reservationId={reservation.id}
              open={addChargeDialogOpen}
              onOpenChange={setAddChargeDialogOpen}
              onSuccess={() => {
                getFolioSummary(reservation.id).then((res) => {
                  if (res.success && res.data?.folios) {
                    setFolioSummaries(res.data.folios.map((f: { folioNumber: number; balance: number; totalCharges: number; totalDiscounts?: number; totalPayments: number; billTo?: FolioBillTo; guestId?: string | null; guestName?: string | null; companyId?: string | null; companyName?: string | null; label?: string | null }) => ({
                      folioNumber: f.folioNumber,
                      balance: f.balance,
                      totalCharges: f.totalCharges,
                      totalDiscounts: f.totalDiscounts ?? 0,
                      totalPayments: f.totalPayments,
                      billTo: f.billTo,
                      guestId: f.guestId,
                      guestName: f.guestName,
                      companyId: f.companyId,
                      companyName: f.companyName,
                      label: f.label,
                    })));
                  }
                });
              }}
              folioNumbers={folioSummaries.length > 0 ? folioSummaries.map((f) => f.folioNumber) : [1]}
              defaultFolioNumber={folioSummaries[0]?.folioNumber ?? 1}
            />
          )}
          <div className="space-y-2">
            <Label htmlFor="pax">Liczba gości (pax)</Label>
            <Input
              id="pax"
              type="number"
              min={0}
              max={20}
              value={pax}
              onChange={(e) => setPax(e.target.value)}
              placeholder="Opcjonalnie"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Uwagi</Label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Uwagi do rezerwacji (opcjonalnie)"
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" data-testid="reservation-edit-error">{error}</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Anuluj
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Zapisywanie…" : "Zapisz"}
            </Button>
          </DialogFooter>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
