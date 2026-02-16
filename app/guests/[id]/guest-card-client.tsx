"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  updateGuest, 
  updateGuestBlacklist, 
  withdrawAllGdprConsents, 
  anonymizeGuestData, 
  exportGuestData,
  getGuestRelations,
  addGuestRelation,
  removeGuestRelation,
  searchGuestsForRelation,
  type GuestRelationData,
  findPotentialDuplicates,
  mergeGuests,
  type PotentialDuplicateGuest,
  type MergeGuestsResult,
  getGuestGdprHistory,
  type GdprHistoryEntry,
  getGuestAutoFillData,
  type GuestAutoFillData,
} from "@/app/actions/reservations";
import { useRouter } from "next/navigation";
import {
  getGuestLoyaltyStatus,
  getLoyaltyTransactions,
  enrollGuestInLoyalty,
  redeemLoyaltyPoints,
  adjustLoyaltyPoints,
  type GuestLoyaltyStatus,
  type LoyaltyTransactionData,
} from "@/app/actions/loyalty";
import { getGuestRestaurantHistory } from "@/app/actions/gastronomy";
import Link from "next/link";

const STATUS_LABELS: Record<string, string> = {
  CONFIRMED: "Potwierdzona",
  CHECKED_IN: "Zameldowany",
  CHECKED_OUT: "Wymeldowany",
  CANCELLED: "Anulowana",
  NO_SHOW: "No-show",
};

interface GuestCardClientProps {
  guest: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    photoUrl: string | null;
    emergencyContactName: string | null;
    emergencyContactPhone: string | null;
    emergencyContactRelation: string | null;
    occupation: string | null;
    guestType: string;
    segment: string | null;
    dateOfBirth: string | null;
    placeOfBirth: string | null;
    nationality: string | null;
    gender: string | null;
    street: string | null;
    city: string | null;
    postalCode: string | null;
    country: string | null;
    documentType: string | null;
    documentNumber: string | null;
    documentExpiry: string | null;
    documentIssuedBy: string | null;
    mrz: string | null;
    isVip: boolean;
    vipLevel: string | null;
    isBlacklisted: boolean;
    preferences: Record<string, unknown> | null;
    totalStays: number;
    lastStayDate: string | null;
    mealPreferences: {
      vegetarian?: boolean;
      vegan?: boolean;
      glutenFree?: boolean;
      lactoseFree?: boolean;
      halal?: boolean;
      kosher?: boolean;
      allergies?: string[];
      other?: string;
    } | null;
    healthAllergies: string | null;
    healthNotes: string | null;
    favoriteMinibarItems: Array<{ itemId?: string; name: string; quantity?: number }> | null;
    staffNotes: string | null;
    // RODO
    gdprDataProcessingConsent: boolean;
    gdprDataProcessingDate: string | null;
    gdprMarketingConsent: boolean;
    gdprMarketingConsentDate: string | null;
    gdprThirdPartyConsent: boolean;
    gdprThirdPartyConsentDate: string | null;
    gdprConsentWithdrawnAt: string | null;
    gdprAnonymizedAt: string | null;
    gdprNotes: string | null;
  };
  history: Array<{
    id: string;
    room: string;
    checkIn: string;
    checkOut: string;
    status: string;
    guestName: string;
  }>;
}

export function GuestCardClient({ guest: initialGuest, history }: GuestCardClientProps) {
  const router = useRouter();
  const [tab, setTab] = useState<"dane" | "lojalnosc" | "relacje" | "duplikaty" | "rodo">("dane");
  const [name, setName] = useState(initialGuest.name);
  const [email, setEmail] = useState(initialGuest.email ?? "");
  const [phone, setPhone] = useState(initialGuest.phone ?? "");
  const [photoUrl, setPhotoUrl] = useState(initialGuest.photoUrl ?? "");
  const [emergencyContactName, setEmergencyContactName] = useState(initialGuest.emergencyContactName ?? "");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(initialGuest.emergencyContactPhone ?? "");
  const [emergencyContactRelation, setEmergencyContactRelation] = useState(initialGuest.emergencyContactRelation ?? "");
  const [occupation, setOccupation] = useState(initialGuest.occupation ?? "");
  const [guestType, setGuestType] = useState(initialGuest.guestType);
  const [segment, setSegment] = useState(initialGuest.segment ?? "");
  const [dateOfBirth, setDateOfBirth] = useState(initialGuest.dateOfBirth ?? "");
  const [placeOfBirth, setPlaceOfBirth] = useState(initialGuest.placeOfBirth ?? "");
  const [nationality, setNationality] = useState(initialGuest.nationality ?? "");
  const [gender, setGender] = useState(initialGuest.gender ?? "");
  const [street, setStreet] = useState(initialGuest.street ?? "");
  const [city, setCity] = useState(initialGuest.city ?? "");
  const [postalCode, setPostalCode] = useState(initialGuest.postalCode ?? "");
  const [country, setCountry] = useState(initialGuest.country ?? "");
  const [documentType, setDocumentType] = useState(initialGuest.documentType ?? "");
  const [documentNumber, setDocumentNumber] = useState(initialGuest.documentNumber ?? "");
  const [documentExpiry, setDocumentExpiry] = useState(initialGuest.documentExpiry ?? "");
  const [documentIssuedBy, setDocumentIssuedBy] = useState(initialGuest.documentIssuedBy ?? "");
  const [mrz, setMrz] = useState(initialGuest.mrz ?? "");
  const [isVip, setIsVip] = useState(initialGuest.isVip);
  const [vipLevel, setVipLevel] = useState(initialGuest.vipLevel ?? "");
  const [isBlacklisted, setIsBlacklisted] = useState(initialGuest.isBlacklisted);
  // Preferencje dietetyczne
  const [mealVegetarian, setMealVegetarian] = useState(initialGuest.mealPreferences?.vegetarian ?? false);
  const [mealVegan, setMealVegan] = useState(initialGuest.mealPreferences?.vegan ?? false);
  const [mealGlutenFree, setMealGlutenFree] = useState(initialGuest.mealPreferences?.glutenFree ?? false);
  const [mealLactoseFree, setMealLactoseFree] = useState(initialGuest.mealPreferences?.lactoseFree ?? false);
  const [mealHalal, setMealHalal] = useState(initialGuest.mealPreferences?.halal ?? false);
  const [mealKosher, setMealKosher] = useState(initialGuest.mealPreferences?.kosher ?? false);
  const [mealAllergies, setMealAllergies] = useState(initialGuest.mealPreferences?.allergies?.join(", ") ?? "");
  const [mealOther, setMealOther] = useState(initialGuest.mealPreferences?.other ?? "");
  // Alergie i uwagi zdrowotne
  const [healthAllergies, setHealthAllergies] = useState(initialGuest.healthAllergies ?? "");
  const [healthNotes, setHealthNotes] = useState(initialGuest.healthNotes ?? "");
  // Ulubiony minibar
  const [favoriteMinibar, setFavoriteMinibar] = useState(
    initialGuest.favoriteMinibarItems
      ? initialGuest.favoriteMinibarItems.map(item => 
          item.quantity && item.quantity > 1 ? `${item.name} x${item.quantity}` : item.name
        ).join("\n")
      : ""
  );
  // Historia restauracyjna
  const [restaurantHistory, setRestaurantHistory] = useState<{
    totalAmount: number;
    totalCharges: number;
    charges: Array<{
      id: string;
      amount: number;
      description: string | null;
      createdAt: string;
      roomNumber: string;
      checkIn: string;
      checkOut: string;
      items: Array<{ name: string; quantity: number; unitPrice: number }>;
    }>;
  } | null>(null);
  const [restaurantLoading, setRestaurantLoading] = useState(false);
  // Uwagi dla personelu
  const [staffNotes, setStaffNotes] = useState(initialGuest.staffNotes ?? "");
  // RODO
  const [gdprDataProcessing, setGdprDataProcessing] = useState(initialGuest.gdprDataProcessingConsent);
  const [gdprMarketing, setGdprMarketing] = useState(initialGuest.gdprMarketingConsent);
  const [gdprThirdParty, setGdprThirdParty] = useState(initialGuest.gdprThirdPartyConsent);
  const [gdprNotes, setGdprNotes] = useState(initialGuest.gdprNotes ?? "");
  const [gdprSaving, setGdprSaving] = useState(false);
  const [gdprError, setGdprError] = useState<string | null>(null);
  const [gdprSuccess, setGdprSuccess] = useState<string | null>(null);
  const [showAnonymizeConfirm, setShowAnonymizeConfirm] = useState(false);
  const [exporting, setExporting] = useState(false);
  // Historia RODO
  const [gdprHistory, setGdprHistory] = useState<GdprHistoryEntry[]>([]);
  const [gdprHistoryLoading, setGdprHistoryLoading] = useState(false);
  // Autouzupełnianie
  const [autoFillData, setAutoFillData] = useState<GuestAutoFillData | null>(null);
  const [autoFillLoading, setAutoFillLoading] = useState(false);
  // Relacje
  const [relations, setRelations] = useState<GuestRelationData[]>([]);
  const [relationsLoading, setRelationsLoading] = useState(false);
  const [relationsError, setRelationsError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedRelationType, setSelectedRelationType] = useState("SPOUSE");
  const [relationNote, setRelationNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Stan programu lojalnościowego
  const [loyaltyStatus, setLoyaltyStatus] = useState<GuestLoyaltyStatus | null>(null);
  const [loyaltyTransactions, setLoyaltyTransactions] = useState<LoyaltyTransactionData[]>([]);
  const [loyaltyLoading, setLoyaltyLoading] = useState(false);
  const [loyaltyError, setLoyaltyError] = useState<string | null>(null);
  const [loyaltySuccess, setLoyaltySuccess] = useState<string | null>(null);
  const [adjustPoints, setAdjustPoints] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [redeemPoints, setRedeemPoints] = useState("");
  const [redeemReason, setRedeemReason] = useState("");

  // Stan deduplikacji
  const [duplicates, setDuplicates] = useState<PotentialDuplicateGuest[]>([]);
  const [duplicatesLoading, setDuplicatesLoading] = useState(false);
  const [duplicatesError, setDuplicatesError] = useState<string | null>(null);
  const [duplicatesSuccess, setDuplicatesSuccess] = useState<string | null>(null);
  const [showMergeConfirm, setShowMergeConfirm] = useState<string | null>(null); // ID gościa do scalenia
  const [mergeInProgress, setMergeInProgress] = useState(false);
  const [lastMergeResult, setLastMergeResult] = useState<MergeGuestsResult | null>(null);

  // Ładowanie danych lojalnościowych
  const loadLoyaltyData = useCallback(async () => {
    setLoyaltyLoading(true);
    setLoyaltyError(null);
    try {
      const [statusRes, transRes] = await Promise.all([
        getGuestLoyaltyStatus(initialGuest.id),
        getLoyaltyTransactions(initialGuest.id, { limit: 20 }),
      ]);
      if (statusRes.success) {
        setLoyaltyStatus(statusRes.data);
      } else {
        setLoyaltyError(statusRes.error);
      }
      if (transRes.success) {
        setLoyaltyTransactions(transRes.data.transactions);
      }
    } catch {
      setLoyaltyError("Błąd ładowania danych lojalnościowych");
    } finally {
      setLoyaltyLoading(false);
    }
  }, [initialGuest.id]);

  useEffect(() => {
    if (tab === "lojalnosc") {
      loadLoyaltyData();
    }
  }, [tab, loadLoyaltyData]);

  // Ładowanie relacji
  const loadRelations = useCallback(async () => {
    setRelationsLoading(true);
    setRelationsError(null);
    const res = await getGuestRelations(initialGuest.id);
    if (res.success) {
      setRelations(res.data);
    } else {
      setRelationsError(res.error);
    }
    setRelationsLoading(false);
  }, [initialGuest.id]);

  useEffect(() => {
    if (tab === "relacje") {
      loadRelations();
    }
  }, [tab, loadRelations]);

  // Ładowanie potencjalnych duplikatów
  const loadDuplicates = useCallback(async () => {
    setDuplicatesLoading(true);
    setDuplicatesError(null);
    setDuplicatesSuccess(null);
    const res = await findPotentialDuplicates(initialGuest.id, { minScore: 40, limit: 15 });
    if (res.success) {
      setDuplicates(res.data);
    } else {
      setDuplicatesError(res.error);
    }
    setDuplicatesLoading(false);
  }, [initialGuest.id]);

  useEffect(() => {
    if (tab === "duplikaty") {
      loadDuplicates();
    }
  }, [tab, loadDuplicates]);

  // Ładowanie historii RODO
  const loadGdprHistory = useCallback(async () => {
    setGdprHistoryLoading(true);
    const res = await getGuestGdprHistory(initialGuest.id, { limit: 30 });
    if (res.success) {
      setGdprHistory(res.data);
    }
    setGdprHistoryLoading(false);
  }, [initialGuest.id]);

  useEffect(() => {
    if (tab === "rodo") {
      loadGdprHistory();
    }
  }, [tab, loadGdprHistory]);

  // Ładowanie danych do autouzupełniania (dla sekcji "Sugestie z poprzednich pobytów")
  const loadAutoFillData = useCallback(async () => {
    if (initialGuest.totalStays === 0) return; // Brak poprzednich pobytów
    setAutoFillLoading(true);
    const res = await getGuestAutoFillData({ guestId: initialGuest.id });
    if (res.success && res.data) {
      setAutoFillData(res.data);
    }
    setAutoFillLoading(false);
  }, [initialGuest.id, initialGuest.totalStays]);

  useEffect(() => {
    if (tab === "dane") {
      loadAutoFillData();
      if (!restaurantHistory && !restaurantLoading) {
        setRestaurantLoading(true);
        getGuestRestaurantHistory(initialGuest.id).then((res) => {
          if (res.success && res.data) setRestaurantHistory(res.data);
          setRestaurantLoading(false);
        });
      }
    }
  }, [tab, loadAutoFillData, initialGuest.id, restaurantHistory, restaurantLoading]);

  // Scalanie gości
  const handleMergeGuests = async (sourceGuestId: string) => {
    setMergeInProgress(true);
    setDuplicatesError(null);
    setDuplicatesSuccess(null);
    setLastMergeResult(null);

    const res = await mergeGuests(sourceGuestId, initialGuest.id);
    setMergeInProgress(false);
    setShowMergeConfirm(null);

    if (res.success) {
      setLastMergeResult(res.data);
      setDuplicatesSuccess(
        `Scalono profile. Przeniesiono ${res.data.transferredReservations} rezerwacji, ` +
        `${res.data.transferredLoyaltyTransactions} transakcji lojalnościowych, ` +
        `${res.data.transferredRelations} relacji.`
      );
      // Odśwież listę duplikatów
      await loadDuplicates();
      // Odśwież stronę aby pokazać zaktualizowane dane
      router.refresh();
    } else {
      setDuplicatesError(res.error);
    }
  };

  // Wyszukiwanie gości do relacji
  const handleSearchGuests = async (query: string) => {
    setSearchQuery(query);
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const res = await searchGuestsForRelation(query, initialGuest.id);
    if (res.success) {
      setSearchResults(res.data);
    }
  };

  // Dodawanie relacji
  const handleAddRelation = async (targetGuestId: string) => {
    setRelationsLoading(true);
    setRelationsError(null);
    const res = await addGuestRelation(initialGuest.id, targetGuestId, selectedRelationType, relationNote);
    if (res.success) {
      setRelations((prev) => [...prev, res.data]);
      setSearchQuery("");
      setSearchResults([]);
      setRelationNote("");
    } else {
      setRelationsError(res.error);
    }
    setRelationsLoading(false);
  };

  // Usuwanie relacji
  const handleRemoveRelation = async (relationId: string) => {
    setRelationsLoading(true);
    setRelationsError(null);
    const res = await removeGuestRelation(relationId);
    if (res.success) {
      setRelations((prev) => prev.filter((r) => r.id !== relationId));
    } else {
      setRelationsError(res.error);
    }
    setRelationsLoading(false);
  };

  // Zapisanie do programu
  const handleEnrollLoyalty = async () => {
    setLoyaltyLoading(true);
    setLoyaltyError(null);
    setLoyaltySuccess(null);
    const res = await enrollGuestInLoyalty(initialGuest.id);
    if (res.success) {
      setLoyaltySuccess(`Gość zapisany do programu. Numer karty: ${res.data.cardNumber}`);
      await loadLoyaltyData();
    } else {
      setLoyaltyError(res.error);
    }
    setLoyaltyLoading(false);
  };

  // Korekta punktów
  const handleAdjustPoints = async () => {
    const pts = parseInt(adjustPoints, 10);
    if (isNaN(pts) || pts === 0) {
      setLoyaltyError("Podaj prawidłową liczbę punktów (różną od 0)");
      return;
    }
    if (!adjustReason.trim()) {
      setLoyaltyError("Podaj powód korekty");
      return;
    }
    setLoyaltyLoading(true);
    setLoyaltyError(null);
    setLoyaltySuccess(null);
    const res = await adjustLoyaltyPoints(initialGuest.id, pts, adjustReason.trim());
    if (res.success) {
      setLoyaltySuccess(`Korekta wykonana. Nowe saldo: ${res.data.newBalance} pkt`);
      setAdjustPoints("");
      setAdjustReason("");
      await loadLoyaltyData();
    } else {
      setLoyaltyError(res.error);
    }
    setLoyaltyLoading(false);
  };

  // Realizacja punktów
  const handleRedeemPoints = async () => {
    const pts = parseInt(redeemPoints, 10);
    if (isNaN(pts) || pts <= 0) {
      setLoyaltyError("Podaj prawidłową liczbę punktów do realizacji");
      return;
    }
    if (!redeemReason.trim()) {
      setLoyaltyError("Podaj powód realizacji");
      return;
    }
    setLoyaltyLoading(true);
    setLoyaltyError(null);
    setLoyaltySuccess(null);
    const res = await redeemLoyaltyPoints(initialGuest.id, pts, redeemReason.trim());
    if (res.success) {
      setLoyaltySuccess(`Zrealizowano ${pts} pkt. Nowe saldo: ${res.data.newBalance} pkt`);
      setRedeemPoints("");
      setRedeemReason("");
      await loadLoyaltyData();
    } else {
      setLoyaltyError(res.error);
    }
    setLoyaltyLoading(false);
  };

  // Zapis zgód RODO
  const handleSaveGdprConsents = async () => {
    setGdprSaving(true);
    setGdprError(null);
    setGdprSuccess(null);

    const result = await updateGuest(initialGuest.id, {
      gdprDataProcessingConsent: gdprDataProcessing,
      gdprMarketingConsent: gdprMarketing,
      gdprThirdPartyConsent: gdprThirdParty,
      gdprNotes: gdprNotes.trim() || null,
    });

    setGdprSaving(false);
    if (result.success) {
      setGdprSuccess("Zgody RODO zostały zaktualizowane.");
    } else {
      setGdprError(result.error ?? "Błąd zapisu zgód RODO");
    }
  };

  // Wycofanie wszystkich zgód
  const handleWithdrawAllConsents = async () => {
    setGdprSaving(true);
    setGdprError(null);
    setGdprSuccess(null);

    const result = await withdrawAllGdprConsents(initialGuest.id);

    setGdprSaving(false);
    if (result.success) {
      setGdprDataProcessing(false);
      setGdprMarketing(false);
      setGdprThirdParty(false);
      setGdprSuccess("Wszystkie zgody zostały wycofane.");
    } else {
      setGdprError(result.error ?? "Błąd wycofywania zgód");
    }
  };

  // Anonimizacja danych (prawo do zapomnienia)
  const handleAnonymize = async () => {
    setGdprSaving(true);
    setGdprError(null);
    setGdprSuccess(null);

    const result = await anonymizeGuestData(initialGuest.id);

    setGdprSaving(false);
    setShowAnonymizeConfirm(false);
    if (result.success) {
      setGdprSuccess("Dane gościa zostały zanonimizowane. Odśwież stronę, aby zobaczyć zmiany.");
    } else {
      setGdprError(result.error ?? "Błąd anonimizacji danych");
    }
  };

  // Eksport danych do CSV
  const handleExportCsv = async () => {
    setExporting(true);
    setGdprError(null);
    setGdprSuccess(null);

    const result = await exportGuestData(initialGuest.id);
    setExporting(false);

    if (!result.success) {
      setGdprError(result.error ?? "Błąd eksportu danych");
      return;
    }

    const data = result.data;
    const guestFields = [
      ["Pole", "Wartość"],
      ["ID", data.guest.id],
      ["Imię i nazwisko", data.guest.name],
      ["E-mail", data.guest.email ?? ""],
      ["Telefon", data.guest.phone ?? ""],
      ["Data urodzenia", data.guest.dateOfBirth ?? ""],
      ["Miejsce urodzenia", data.guest.placeOfBirth ?? ""],
      ["Obywatelstwo", data.guest.nationality ?? ""],
      ["Płeć", data.guest.gender ?? ""],
      ["Ulica", data.guest.street ?? ""],
      ["Miasto", data.guest.city ?? ""],
      ["Kod pocztowy", data.guest.postalCode ?? ""],
      ["Kraj", data.guest.country ?? ""],
      ["Typ dokumentu", data.guest.documentType ?? ""],
      ["Numer dokumentu", data.guest.documentNumber ?? ""],
      ["Ważność dokumentu", data.guest.documentExpiry ?? ""],
      ["Organ wydający", data.guest.documentIssuedBy ?? ""],
      ["VIP", data.guest.isVip ? "Tak" : "Nie"],
      ["Poziom VIP", data.guest.vipLevel ?? ""],
      ["Czarna lista", data.guest.isBlacklisted ? "Tak" : "Nie"],
      ["Liczba pobytów", String(data.guest.totalStays)],
      ["Ostatni pobyt", data.guest.lastStayDate ?? ""],
      ["Karta lojalnościowa", data.guest.loyaltyCardNumber ?? ""],
      ["Punkty lojalnościowe", String(data.guest.loyaltyPoints)],
      ["Łączne punkty", String(data.guest.loyaltyTotalPoints)],
      ["Poziom lojalności", data.guest.loyaltyTierName ?? ""],
      ["Zgoda przetwarzanie", data.guest.gdprDataProcessingConsent ? "Tak" : "Nie"],
      ["Data zgody przetw.", data.guest.gdprDataProcessingDate ?? ""],
      ["Zgoda marketing", data.guest.gdprMarketingConsent ? "Tak" : "Nie"],
      ["Data zgody market.", data.guest.gdprMarketingConsentDate ?? ""],
      ["Zgoda partnerzy", data.guest.gdprThirdPartyConsent ? "Tak" : "Nie"],
      ["Data zgody partn.", data.guest.gdprThirdPartyConsentDate ?? ""],
      ["Data utworzenia", data.guest.createdAt],
      ["Data aktualizacji", data.guest.updatedAt],
    ];

    let csv = "DANE GOŚCIA\n";
    csv += guestFields.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
    
    csv += "\n\nHISTORIA REZERWACJI\n";
    csv += ["ID", "Nr potwierdzenia", "Pokój", "Check-in", "Check-out", "Status", "Źródło", "Kanał", "Plan posiłków", "Osoby", "Data utworzenia"]
      .map(v => `"${v}"`).join(";") + "\n";
    csv += data.reservations.map(r => [
      r.id, r.confirmationNumber ?? "", r.roomNumber, r.checkIn, r.checkOut,
      r.status, r.source ?? "", r.channel ?? "", r.mealPlan ?? "",
      String(r.pax ?? ""), r.createdAt
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");

    if (data.loyaltyTransactions.length > 0) {
      csv += "\n\nTRANSAKCJE LOJALNOŚCIOWE\n";
      csv += ["ID", "Typ", "Punkty", "Saldo po", "Opis", "Data"]
        .map(v => `"${v}"`).join(";") + "\n";
      csv += data.loyaltyTransactions.map(t => [
        t.id, t.type, String(t.points), String(t.balanceAfter), t.reason ?? "", t.createdAt
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\n");
    }

    csv += `\n\nData eksportu: ${data.exportDate}`;

    // Pobierz plik
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `eksport-gosc-${data.guest.id.slice(-8)}-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setGdprSuccess("Dane zostały wyeksportowane do pliku CSV.");
  };

  // Eksport danych do PDF (widok do druku)
  const handleExportPdf = async () => {
    setExporting(true);
    setGdprError(null);
    setGdprSuccess(null);

    const result = await exportGuestData(initialGuest.id);
    setExporting(false);

    if (!result.success) {
      setGdprError(result.error ?? "Błąd eksportu danych");
      return;
    }

    const data = result.data;
    
    // Otwórz nowe okno z danymi do wydruku
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      setGdprError("Nie można otworzyć okna do druku. Sprawdź blokadę pop-up.");
      return;
    }

    const html = `
<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <title>Eksport danych gościa - ${data.guest.name}</title>
  <style>
    * { font-family: Arial, sans-serif; }
    body { padding: 20px; max-width: 800px; margin: 0 auto; }
    h1 { font-size: 18px; border-bottom: 2px solid #333; padding-bottom: 10px; }
    h2 { font-size: 14px; margin-top: 25px; margin-bottom: 10px; color: #333; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th, td { padding: 6px 10px; text-align: left; border: 1px solid #ddd; font-size: 11px; }
    th { background: #f5f5f5; font-weight: bold; }
    .section { margin-bottom: 30px; }
    .meta { font-size: 10px; color: #666; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 10px; }
    .consent-yes { color: green; }
    .consent-no { color: red; }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <h1>Eksport danych osobowych gościa</h1>
  <p><strong>Podstawa prawna:</strong> Art. 15 RODO – Prawo dostępu do danych</p>
  
  <div class="section">
    <h2>Dane osobowe</h2>
    <table>
      <tr><th>Pole</th><th>Wartość</th></tr>
      <tr><td>ID</td><td>${data.guest.id}</td></tr>
      <tr><td>Imię i nazwisko</td><td>${data.guest.name}</td></tr>
      <tr><td>E-mail</td><td>${data.guest.email ?? "—"}</td></tr>
      <tr><td>Telefon</td><td>${data.guest.phone ?? "—"}</td></tr>
      <tr><td>Data urodzenia</td><td>${data.guest.dateOfBirth ?? "—"}</td></tr>
      <tr><td>Miejsce urodzenia</td><td>${data.guest.placeOfBirth ?? "—"}</td></tr>
      <tr><td>Obywatelstwo</td><td>${data.guest.nationality ?? "—"}</td></tr>
      <tr><td>Płeć</td><td>${data.guest.gender === "M" ? "Mężczyzna" : data.guest.gender === "F" ? "Kobieta" : "—"}</td></tr>
    </table>
  </div>

  <div class="section">
    <h2>Adres zamieszkania</h2>
    <table>
      <tr><th>Pole</th><th>Wartość</th></tr>
      <tr><td>Ulica</td><td>${data.guest.street ?? "—"}</td></tr>
      <tr><td>Miasto</td><td>${data.guest.city ?? "—"}</td></tr>
      <tr><td>Kod pocztowy</td><td>${data.guest.postalCode ?? "—"}</td></tr>
      <tr><td>Kraj</td><td>${data.guest.country ?? "—"}</td></tr>
    </table>
  </div>

  ${data.guest.emergencyContactName || data.guest.emergencyContactPhone ? `
  <div class="section">
    <h2>Kontakt awaryjny</h2>
    <table>
      <tr><th>Pole</th><th>Wartość</th></tr>
      <tr><td>Imię i nazwisko</td><td>${data.guest.emergencyContactName ?? "—"}</td></tr>
      <tr><td>Telefon</td><td>${data.guest.emergencyContactPhone ?? "—"}</td></tr>
      <tr><td>Relacja</td><td>${data.guest.emergencyContactRelation === "SPOUSE" ? "Małżonek/Partner" : data.guest.emergencyContactRelation === "PARENT" ? "Rodzic" : data.guest.emergencyContactRelation === "SIBLING" ? "Rodzeństwo" : data.guest.emergencyContactRelation === "CHILD" ? "Dziecko" : data.guest.emergencyContactRelation === "FRIEND" ? "Przyjaciel" : data.guest.emergencyContactRelation ?? "—"}</td></tr>
    </table>
  </div>
  ` : ""}

  <div class="section">
    <h2>Dokument tożsamości</h2>
    <table>
      <tr><th>Pole</th><th>Wartość</th></tr>
      <tr><td>Typ dokumentu</td><td>${data.guest.documentType ?? "—"}</td></tr>
      <tr><td>Numer dokumentu</td><td>${data.guest.documentNumber ?? "—"}</td></tr>
      <tr><td>Data ważności</td><td>${data.guest.documentExpiry ?? "—"}</td></tr>
      <tr><td>Organ wydający</td><td>${data.guest.documentIssuedBy ?? "—"}</td></tr>
    </table>
  </div>

  <div class="section">
    <h2>Zgody na przetwarzanie danych</h2>
    <table>
      <tr><th>Rodzaj zgody</th><th>Status</th><th>Data udzielenia</th></tr>
      <tr>
        <td>Przetwarzanie danych osobowych</td>
        <td class="${data.guest.gdprDataProcessingConsent ? "consent-yes" : "consent-no"}">${data.guest.gdprDataProcessingConsent ? "TAK" : "NIE"}</td>
        <td>${data.guest.gdprDataProcessingDate ? new Date(data.guest.gdprDataProcessingDate).toLocaleDateString("pl-PL") : "—"}</td>
      </tr>
      <tr>
        <td>Komunikacja marketingowa</td>
        <td class="${data.guest.gdprMarketingConsent ? "consent-yes" : "consent-no"}">${data.guest.gdprMarketingConsent ? "TAK" : "NIE"}</td>
        <td>${data.guest.gdprMarketingConsentDate ? new Date(data.guest.gdprMarketingConsentDate).toLocaleDateString("pl-PL") : "—"}</td>
      </tr>
      <tr>
        <td>Udostępnianie partnerom</td>
        <td class="${data.guest.gdprThirdPartyConsent ? "consent-yes" : "consent-no"}">${data.guest.gdprThirdPartyConsent ? "TAK" : "NIE"}</td>
        <td>${data.guest.gdprThirdPartyConsentDate ? new Date(data.guest.gdprThirdPartyConsentDate).toLocaleDateString("pl-PL") : "—"}</td>
      </tr>
    </table>
  </div>

  ${data.guest.loyaltyCardNumber ? `
  <div class="section">
    <h2>Program lojalnościowy</h2>
    <table>
      <tr><th>Pole</th><th>Wartość</th></tr>
      <tr><td>Numer karty</td><td>${data.guest.loyaltyCardNumber}</td></tr>
      <tr><td>Dostępne punkty</td><td>${data.guest.loyaltyPoints}</td></tr>
      <tr><td>Łączne punkty</td><td>${data.guest.loyaltyTotalPoints}</td></tr>
      <tr><td>Poziom</td><td>${data.guest.loyaltyTierName ?? "—"}</td></tr>
      <tr><td>Data zapisania</td><td>${data.guest.loyaltyEnrolledAt ? new Date(data.guest.loyaltyEnrolledAt).toLocaleDateString("pl-PL") : "—"}</td></tr>
    </table>
  </div>
  ` : ""}

  <div class="section">
    <h2>Historia rezerwacji (${data.reservations.length})</h2>
    ${data.reservations.length > 0 ? `
    <table>
      <tr>
        <th>Nr potwierdzenia</th>
        <th>Pokój</th>
        <th>Check-in</th>
        <th>Check-out</th>
        <th>Status</th>
      </tr>
      ${data.reservations.map(r => `
      <tr>
        <td>${r.confirmationNumber ?? "—"}</td>
        <td>${r.roomNumber}</td>
        <td>${r.checkIn}</td>
        <td>${r.checkOut}</td>
        <td>${r.status}</td>
      </tr>
      `).join("")}
    </table>
    ` : "<p>Brak rezerwacji.</p>"}
  </div>

  ${data.loyaltyTransactions.length > 0 ? `
  <div class="section">
    <h2>Historia transakcji lojalnościowych</h2>
    <table>
      <tr>
        <th>Data</th>
        <th>Typ</th>
        <th>Punkty</th>
        <th>Opis</th>
      </tr>
      ${data.loyaltyTransactions.map(t => `
      <tr>
        <td>${new Date(t.createdAt).toLocaleDateString("pl-PL")}</td>
        <td>${t.type}</td>
        <td>${t.points > 0 ? "+" : ""}${t.points}</td>
        <td>${t.reason ?? "—"}</td>
      </tr>
      `).join("")}
    </table>
  </div>
  ` : ""}

  <div class="meta">
    <p><strong>Data eksportu:</strong> ${new Date(data.exportDate).toLocaleString("pl-PL")}</p>
    <p><strong>Data utworzenia rekordu:</strong> ${new Date(data.guest.createdAt).toLocaleString("pl-PL")}</p>
    <p><strong>Data ostatniej aktualizacji:</strong> ${new Date(data.guest.updatedAt).toLocaleString("pl-PL")}</p>
  </div>

  <div class="no-print" style="margin-top: 20px; text-align: center;">
    <button onclick="window.print()" style="padding: 10px 30px; font-size: 14px; cursor: pointer;">
      Drukuj / Zapisz jako PDF
    </button>
  </div>
</body>
</html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    setGdprSuccess("Otwarto okno eksportu. Użyj funkcji drukowania przeglądarki, aby zapisać jako PDF.");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    // Przygotuj preferencje dietetyczne
    const allergiesArray = mealAllergies.trim() 
      ? mealAllergies.split(",").map(a => a.trim()).filter(a => a.length > 0)
      : [];
    const hasMealPrefs = mealVegetarian || mealVegan || mealGlutenFree || mealLactoseFree || 
                         mealHalal || mealKosher || allergiesArray.length > 0 || mealOther.trim();
    
    const mealPreferences = hasMealPrefs ? {
      vegetarian: mealVegetarian,
      vegan: mealVegan,
      glutenFree: mealGlutenFree,
      lactoseFree: mealLactoseFree,
      halal: mealHalal,
      kosher: mealKosher,
      allergies: allergiesArray,
      other: mealOther.trim() || undefined,
    } : null;

    const result = await updateGuest(initialGuest.id, {
      name: name.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      photoUrl: photoUrl.trim() || null,
      emergencyContactName: emergencyContactName.trim() || null,
      emergencyContactPhone: emergencyContactPhone.trim() || null,
      emergencyContactRelation: emergencyContactRelation || null,
      occupation: occupation.trim() || null,
      guestType: guestType,
      segment: segment || null,
      dateOfBirth: dateOfBirth.trim() || null,
      placeOfBirth: placeOfBirth.trim() || null,
      nationality: nationality.trim() || null,
      gender: gender || null,
      street: street.trim() || null,
      city: city.trim() || null,
      postalCode: postalCode.trim() || null,
      country: country.trim() || null,
      documentType: documentType || null,
      documentNumber: documentNumber.trim() || null,
      documentExpiry: documentExpiry.trim() || null,
      documentIssuedBy: documentIssuedBy.trim() || null,
      mrz: mrz.trim() || null,
      isVip: isVip,
      vipLevel: vipLevel || null,
      mealPreferences,
      healthAllergies: healthAllergies.trim() || null,
      healthNotes: healthNotes.trim() || null,
      favoriteMinibarItems: parseFavoriteMinibar(favoriteMinibar),
      staffNotes: staffNotes.trim() || null,
    });
    setSaving(false);
    if (result.success) setSuccess(true);
    else setError(result.error ?? null);
  };

  // Parsuj tekst minibara do tablicy obiektów
  const parseFavoriteMinibar = (text: string): Array<{ name: string; quantity?: number }> | null => {
    const lines = text.trim().split("\n").filter(line => line.trim());
    if (lines.length === 0) return null;

    return lines.map(line => {
      const trimmed = line.trim();
      // Próbuj wyciągnąć ilość: "Cola x2", "Piwo x3", "Woda"
      const match = trimmed.match(/^(.+?)\s*x(\d+)$/i);
      if (match) {
        return { name: match[1].trim(), quantity: parseInt(match[2], 10) };
      }
      return { name: trimmed };
    });
  };

  const toggleBlacklist = async () => {
    setSaving(true);
    const res = await updateGuestBlacklist(initialGuest.id, !isBlacklisted);
    setSaving(false);
    if (res.success) setIsBlacklisted(!isBlacklisted);
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-border">
        <button
          type="button"
          onClick={() => setTab("dane")}
          className={`px-3 py-2 text-sm font-medium ${tab === "dane" ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}
        >
          Dane
        </button>
        <button
          type="button"
          onClick={() => setTab("lojalnosc")}
          className={`px-3 py-2 text-sm font-medium ${tab === "lojalnosc" ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}
        >
          Lojalność
        </button>
        <button
          type="button"
          onClick={() => setTab("relacje")}
          className={`px-3 py-2 text-sm font-medium ${tab === "relacje" ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}
        >
          Osoby towarzyszące
        </button>
        <button
          type="button"
          onClick={() => setTab("duplikaty")}
          className={`px-3 py-2 text-sm font-medium ${tab === "duplikaty" ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}
        >
          Duplikaty
        </button>
        <button
          type="button"
          onClick={() => setTab("rodo")}
          className={`px-3 py-2 text-sm font-medium ${tab === "rodo" ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}
        >
          RODO
        </button>
      </div>

      {tab === "relacje" && (
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Osoby towarzyszące / Rodzina</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Powiąż gościa z innymi gośćmi (rodzina, współpracownicy, asystenci). Pomoże to w obsłudze rezerwacji grupowych i rodzinnych.
          </p>

          {relationsError && (
            <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
              {relationsError}
            </div>
          )}

          {/* Lista istniejących relacji */}
          <div className="mb-6">
            <h3 className="text-sm font-medium mb-3">Istniejące powiązania</h3>
            {relationsLoading && relations.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ładowanie...</p>
            ) : relations.length === 0 ? (
              <p className="text-sm text-muted-foreground">Brak powiązań z innymi gośćmi.</p>
            ) : (
              <div className="space-y-2">
                {relations.map((rel) => (
                  <div key={rel.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">
                        {rel.relationType === "SPOUSE" ? "💑" : 
                         rel.relationType === "CHILD" ? "👶" :
                         rel.relationType === "PARENT" ? "👨‍👩‍👧" :
                         rel.relationType === "SIBLING" ? "👫" :
                         rel.relationType === "FRIEND" ? "👋" :
                         rel.relationType === "COLLEAGUE" ? "💼" :
                         rel.relationType === "ASSISTANT" ? "📋" :
                         rel.relationType === "EMPLOYER" ? "🏢" : "👤"}
                      </span>
                      <div>
                        <Link 
                          href={`/guests/${rel.relatedGuestId}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {rel.relatedGuestName}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {rel.relationType === "SPOUSE" ? "Małżonek/Partner" :
                           rel.relationType === "CHILD" ? "Dziecko" :
                           rel.relationType === "PARENT" ? "Rodzic" :
                           rel.relationType === "SIBLING" ? "Rodzeństwo" :
                           rel.relationType === "FRIEND" ? "Przyjaciel" :
                           rel.relationType === "COLLEAGUE" ? "Współpracownik" :
                           rel.relationType === "ASSISTANT" ? "Asystent" :
                           rel.relationType === "EMPLOYER" ? "Pracodawca" : rel.relationType}
                          {rel.note && ` — ${rel.note}`}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveRelation(rel.id)}
                      disabled={relationsLoading}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      Usuń
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Dodawanie nowej relacji */}
          <div className="p-4 border rounded-lg bg-muted/20">
            <h3 className="text-sm font-medium mb-3">Dodaj powiązanie</h3>
            <div className="space-y-3">
              <div>
                <Label htmlFor="searchGuest" className="text-xs">Wyszukaj gościa</Label>
                <Input
                  id="searchGuest"
                  value={searchQuery}
                  onChange={(e) => handleSearchGuests(e.target.value)}
                  placeholder="Wpisz imię i nazwisko..."
                  className="mt-1"
                />
                {searchResults.length > 0 && (
                  <div className="mt-2 border rounded-md max-h-40 overflow-y-auto">
                    {searchResults.map((guest) => (
                      <button
                        key={guest.id}
                        type="button"
                        onClick={() => handleAddRelation(guest.id)}
                        disabled={relationsLoading}
                        className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex items-center justify-between"
                      >
                        <span>{guest.name}</span>
                        <span className="text-xs text-muted-foreground">Dodaj</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="relationType" className="text-xs">Typ relacji</Label>
                  <select
                    id="relationType"
                    value={selectedRelationType}
                    onChange={(e) => setSelectedRelationType(e.target.value)}
                    className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="SPOUSE">Małżonek/Partner</option>
                    <option value="CHILD">Dziecko</option>
                    <option value="PARENT">Rodzic</option>
                    <option value="SIBLING">Rodzeństwo</option>
                    <option value="FRIEND">Przyjaciel</option>
                    <option value="COLLEAGUE">Współpracownik</option>
                    <option value="ASSISTANT">Asystent</option>
                    <option value="OTHER">Inny</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="relationNote" className="text-xs">Notatka (opcjonalna)</Label>
                  <Input
                    id="relationNote"
                    value={relationNote}
                    onChange={(e) => setRelationNote(e.target.value)}
                    placeholder="np. syn, córka, siostra..."
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {tab === "duplikaty" && (
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Deduplikacja profili gości</h2>
          <p className="text-sm text-muted-foreground mb-4">
            System automatycznie wyszukuje potencjalne duplikaty profilu gościa na podstawie
            dopasowania numeru dokumentu, e-maila, telefonu i imienia. Możesz scalić zduplikowane
            profile, przenosząc wszystkie rezerwacje i dane do bieżącego profilu.
          </p>

          {/* Komunikaty */}
          {duplicatesError && (
            <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
              {duplicatesError}
            </div>
          )}
          {duplicatesSuccess && (
            <div className="mb-4 p-3 bg-green-100 text-green-800 rounded-md text-sm">
              {duplicatesSuccess}
            </div>
          )}

          {/* Wynik ostatniego scalenia */}
          {lastMergeResult && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="text-sm font-medium text-blue-800 mb-2">Szczegóły scalenia</h3>
              <ul className="text-xs text-blue-700 space-y-1">
                <li>Przeniesione rezerwacje: <strong>{lastMergeResult.transferredReservations}</strong></li>
                <li>Przeniesione transakcje lojalnościowe: <strong>{lastMergeResult.transferredLoyaltyTransactions}</strong></li>
                <li>Przeniesione relacje: <strong>{lastMergeResult.transferredRelations}</strong></li>
                {lastMergeResult.mergedFields.length > 0 && (
                  <li>Uzupełnione pola: {lastMergeResult.mergedFields.join(", ")}</li>
                )}
              </ul>
            </div>
          )}

          {/* Akcja odświeżenia */}
          <div className="mb-6 flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={loadDuplicates}
              disabled={duplicatesLoading}
            >
              {duplicatesLoading ? "Szukanie..." : "Odśwież listę duplikatów"}
            </Button>
            <span className="text-xs text-muted-foreground">
              Znaleziono: {duplicates.length} potencjalnych duplikatów
            </span>
          </div>

          {/* Lista duplikatów */}
          {duplicatesLoading && duplicates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Wyszukiwanie duplikatów...
            </div>
          ) : duplicates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-lg mb-2">Brak wykrytych duplikatów</p>
              <p className="text-sm">Ten profil gościa nie ma podobnych rekordów w bazie danych.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {duplicates.map((dup) => (
                <div 
                  key={dup.id} 
                  className={`p-4 border rounded-lg ${
                    dup.matchScore >= 80 ? "border-red-300 bg-red-50" :
                    dup.matchScore >= 60 ? "border-amber-300 bg-amber-50" :
                    "border-gray-200 bg-gray-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium">{dup.name}</span>
                        {dup.isVip && <span title="VIP" className="text-yellow-500">⭐</span>}
                        {dup.isBlacklisted && <span title="Czarna lista" className="text-red-500">🚫</span>}
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          dup.matchScore >= 80 ? "bg-red-200 text-red-800" :
                          dup.matchScore >= 60 ? "bg-amber-200 text-amber-800" :
                          "bg-gray-200 text-gray-700"
                        }`}>
                          {dup.matchScore}% dopasowania
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-muted-foreground mb-2">
                        <div>
                          <span className="font-medium">E-mail:</span>{" "}
                          {dup.email ?? "—"}
                        </div>
                        <div>
                          <span className="font-medium">Telefon:</span>{" "}
                          {dup.phone ?? "—"}
                        </div>
                        <div>
                          <span className="font-medium">Dokument:</span>{" "}
                          {dup.documentNumber ?? "—"}
                        </div>
                        <div>
                          <span className="font-medium">Pobyty:</span>{" "}
                          {dup.totalStays}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {dup.matchReasons.map((reason, idx) => (
                          <span 
                            key={idx}
                            className="px-1.5 py-0.5 bg-white/70 border rounded text-xs"
                          >
                            {reason}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Link href={`/guests/${dup.id}`} target="_blank">
                        <Button variant="outline" size="sm" className="w-full">
                          Otwórz
                        </Button>
                      </Link>
                      
                      {showMergeConfirm === dup.id ? (
                        <div className="flex flex-col gap-1">
                          <p className="text-xs text-center text-red-600 font-medium">
                            Scalić profile?
                          </p>
                          <div className="flex gap-1">
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleMergeGuests(dup.id)}
                              disabled={mergeInProgress}
                            >
                              {mergeInProgress ? "..." : "Tak"}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setShowMergeConfirm(null)}
                              disabled={mergeInProgress}
                            >
                              Nie
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => setShowMergeConfirm(dup.id)}
                          className="bg-primary"
                        >
                          Scal tutaj
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Informacja o procesie scalania */}
          <div className="mt-6 pt-4 border-t text-xs text-muted-foreground">
            <p className="font-medium mb-2">Co się dzieje podczas scalania:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Wszystkie rezerwacje z profilu źródłowego są przenoszone do bieżącego profilu</li>
              <li>Transakcje lojalnościowe i punkty są sumowane</li>
              <li>Relacje z innymi gośćmi są przenoszone (bez duplikatów)</li>
              <li>Puste pola w bieżącym profilu są uzupełniane danymi z profilu źródłowego</li>
              <li>Uwagi dla personelu są dołączane z oznaczeniem źródła</li>
              <li>Status VIP i czarnej listy są zachowywane jeśli występują w którymkolwiek profilu</li>
              <li>Profil źródłowy jest usuwany po scaleniu</li>
              <li>Operacja jest zapisywana w dzienniku audytu</li>
            </ul>
          </div>
        </section>
      )}

      {tab === "rodo" && (
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">RODO – zgody i dane osobowe</h2>

          {/* Komunikaty */}
          {gdprError && (
            <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
              {gdprError}
            </div>
          )}
          {gdprSuccess && (
            <div className="mb-4 p-3 bg-green-100 text-green-800 rounded-md text-sm">
              {gdprSuccess}
            </div>
          )}

          {/* Status anonimizacji */}
          {initialGuest.gdprAnonymizedAt && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm font-medium text-red-800">
                Dane tego gościa zostały zanonimizowane dnia:{" "}
                {new Date(initialGuest.gdprAnonymizedAt).toLocaleDateString("pl-PL", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              <p className="text-xs text-red-600 mt-1">
                Nie można przywrócić zanonimizowanych danych.
              </p>
            </div>
          )}

          {/* Data wycofania zgód */}
          {initialGuest.gdprConsentWithdrawnAt && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                Zgody wycofano: {new Date(initialGuest.gdprConsentWithdrawnAt).toLocaleDateString("pl-PL")}
              </p>
            </div>
          )}

          {/* Sekcja zgód */}
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium mb-4">Zgody na przetwarzanie danych</h3>
              <div className="space-y-4">
                {/* Zgoda na przetwarzanie danych (obowiązkowa dla meldunku) */}
                <div className="p-4 border rounded-lg">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="gdprDataProcessing"
                      checked={gdprDataProcessing}
                      onChange={(e) => setGdprDataProcessing(e.target.checked)}
                      className="h-4 w-4 mt-0.5 rounded border-gray-300 text-primary focus:ring-primary"
                      disabled={gdprSaving || !!initialGuest.gdprAnonymizedAt}
                    />
                    <div>
                      <Label htmlFor="gdprDataProcessing" className="cursor-pointer font-medium">
                        Zgoda na przetwarzanie danych osobowych
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Wymagana do meldunku i świadczenia usług hotelowych (art. 6 ust. 1 lit. b RODO).
                        Obejmuje: imię, nazwisko, dane kontaktowe, dane dokumentu tożsamości.
                      </p>
                      {initialGuest.gdprDataProcessingDate && (
                        <p className="text-xs text-green-600 mt-1">
                          Udzielona: {new Date(initialGuest.gdprDataProcessingDate).toLocaleDateString("pl-PL")}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Zgoda marketingowa */}
                <div className="p-4 border rounded-lg">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="gdprMarketing"
                      checked={gdprMarketing}
                      onChange={(e) => setGdprMarketing(e.target.checked)}
                      className="h-4 w-4 mt-0.5 rounded border-gray-300 text-primary focus:ring-primary"
                      disabled={gdprSaving || !!initialGuest.gdprAnonymizedAt}
                    />
                    <div>
                      <Label htmlFor="gdprMarketing" className="cursor-pointer font-medium">
                        Zgoda na komunikację marketingową
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Zgoda na otrzymywanie newslettera, ofert specjalnych i informacji o promocjach
                        drogą elektroniczną (e-mail, SMS).
                      </p>
                      {initialGuest.gdprMarketingConsentDate && (
                        <p className="text-xs text-green-600 mt-1">
                          Udzielona: {new Date(initialGuest.gdprMarketingConsentDate).toLocaleDateString("pl-PL")}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Zgoda na udostępnianie podmiotom trzecim */}
                <div className="p-4 border rounded-lg">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="gdprThirdParty"
                      checked={gdprThirdParty}
                      onChange={(e) => setGdprThirdParty(e.target.checked)}
                      className="h-4 w-4 mt-0.5 rounded border-gray-300 text-primary focus:ring-primary"
                      disabled={gdprSaving || !!initialGuest.gdprAnonymizedAt}
                    />
                    <div>
                      <Label htmlFor="gdprThirdParty" className="cursor-pointer font-medium">
                        Zgoda na udostępnianie danych partnerom
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1">
                        Zgoda na przekazywanie danych zaufanym partnerom (np. OTA, programy lojalnościowe sieci hotelowej).
                      </p>
                      {initialGuest.gdprThirdPartyConsentDate && (
                        <p className="text-xs text-green-600 mt-1">
                          Udzielona: {new Date(initialGuest.gdprThirdPartyConsentDate).toLocaleDateString("pl-PL")}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Notatki RODO */}
            <div>
              <Label htmlFor="gdprNotes">Notatki RODO</Label>
              <textarea
                id="gdprNotes"
                value={gdprNotes}
                onChange={(e) => setGdprNotes(e.target.value)}
                placeholder="np. Gość poprosił o usunięcie e-maila z bazy marketingowej, korespondencja z dnia..."
                rows={2}
                disabled={gdprSaving || !!initialGuest.gdprAnonymizedAt}
                className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {/* Przycisk zapisu zgód */}
            <Button
              onClick={handleSaveGdprConsents}
              disabled={gdprSaving || !!initialGuest.gdprAnonymizedAt}
            >
              {gdprSaving ? "Zapisywanie..." : "Zapisz zgody"}
            </Button>

            {/* Eksport danych (Art. 15 RODO - Prawo dostępu) */}
            <div className="pt-6 border-t mt-6">
              <h3 className="text-sm font-medium mb-4">Eksport danych (Art. 15 RODO)</h3>
              <p className="text-xs text-muted-foreground mb-4">
                Osoba, której dane dotyczą, ma prawo uzyskać od administratora kopię danych osobowych podlegających przetwarzaniu.
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={handleExportCsv}
                  disabled={exporting || !!initialGuest.gdprAnonymizedAt}
                >
                  {exporting ? "Eksportowanie..." : "Eksportuj do CSV"}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleExportPdf}
                  disabled={exporting || !!initialGuest.gdprAnonymizedAt}
                >
                  {exporting ? "Eksportowanie..." : "Eksportuj do PDF"}
                </Button>
              </div>
            </div>

            {/* Sekcja niebezpiecznych akcji */}
            <div className="pt-6 border-t mt-6">
              <h3 className="text-sm font-medium mb-4 text-destructive">Operacje RODO</h3>
              <div className="space-y-4">
                {/* Wycofanie wszystkich zgód */}
                <div className="p-4 border border-amber-300 bg-amber-50 rounded-lg">
                  <h4 className="text-sm font-medium text-amber-800 mb-2">Wycofanie wszystkich zgód</h4>
                  <p className="text-xs text-amber-700 mb-3">
                    Wycofuje wszystkie zgody marketingowe i na przetwarzanie danych. Historia pobytów zostaje zachowana.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleWithdrawAllConsents}
                    disabled={gdprSaving || !!initialGuest.gdprAnonymizedAt}
                    className="border-amber-400 text-amber-700 hover:bg-amber-100"
                  >
                    Wycofaj wszystkie zgody
                  </Button>
                </div>

                {/* Prawo do bycia zapomnianym */}
                <div className="p-4 border border-red-300 bg-red-50 rounded-lg">
                  <h4 className="text-sm font-medium text-red-800 mb-2">Prawo do bycia zapomnianym (Art. 17 RODO)</h4>
                  <p className="text-xs text-red-700 mb-3">
                    Anonimizuje dane osobowe gościa. Rezerwacje zostaną zachowane z anonimowymi danymi dla celów księgowych.
                    <strong className="block mt-1">Tej operacji nie można cofnąć!</strong>
                  </p>
                  {!showAnonymizeConfirm ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setShowAnonymizeConfirm(true)}
                      disabled={gdprSaving || !!initialGuest.gdprAnonymizedAt}
                    >
                      Anonimizuj dane gościa
                    </Button>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm font-medium text-red-800">
                        Czy na pewno chcesz zanonimizować dane gościa &quot;{initialGuest.name}&quot;?
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleAnonymize}
                          disabled={gdprSaving}
                        >
                          {gdprSaving ? "Anonimizowanie..." : "Tak, anonimizuj"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowAnonymizeConfirm(false)}
                          disabled={gdprSaving}
                        >
                          Anuluj
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Historia operacji RODO */}
            <div className="pt-6 border-t mt-6">
              <h3 className="text-sm font-medium mb-4">Historia operacji RODO</h3>
              <p className="text-xs text-muted-foreground mb-4">
                Chronologiczny rejestr wszystkich operacji związanych z danymi osobowymi gościa.
              </p>
              {gdprHistoryLoading ? (
                <p className="text-sm text-muted-foreground">Ładowanie historii...</p>
              ) : gdprHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Brak zarejestrowanych operacji RODO.</p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {gdprHistory.map((entry) => (
                    <div
                      key={entry.id}
                      className={`p-3 rounded-md border text-sm ${
                        entry.actionType === "GuestAnonymization"
                          ? "bg-red-50 border-red-200"
                          : entry.actionType === "GuestDataExport"
                          ? "bg-blue-50 border-blue-200"
                          : entry.actionType === "GuestGdprConsent"
                          ? "bg-green-50 border-green-200"
                          : "bg-gray-50 border-gray-200"
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">
                            {entry.actionType === "GuestAnonymization" && "Anonimizacja"}
                            {entry.actionType === "GuestDataExport" && "Eksport danych"}
                            {entry.actionType === "GuestGdprConsent" && "Zmiana zgód"}
                            {entry.actionType === "Guest" && "Aktualizacja danych"}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">{entry.description}</p>
                          {entry.details && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {typeof entry.details === "string" ? entry.details : JSON.stringify(entry.details)}
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                          {new Date(entry.timestamp).toLocaleString("pl-PL", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={loadGdprHistory}
                disabled={gdprHistoryLoading}
                className="mt-4"
              >
                {gdprHistoryLoading ? "Ładowanie..." : "Odśwież historię"}
              </Button>
            </div>

            {/* Informacje prawne */}
            <div className="pt-4 border-t text-xs text-muted-foreground">
              <p className="mb-2">
                <strong>Podstawa prawna:</strong> Rozporządzenie Parlamentu Europejskiego i Rady (UE) 2016/679 (RODO).
              </p>
              <p>
                <strong>Administrator danych:</strong> Dane kontaktowe administratora dostępne w recepcji hotelu.
                Osoba, której dane dotyczą, ma prawo dostępu do swoich danych, ich sprostowania, usunięcia
                lub ograniczenia przetwarzania oraz prawo do wniesienia skargi do organu nadzorczego (UODO).
              </p>
            </div>
          </div>
        </section>
      )}

      {tab === "lojalnosc" && (
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Program Lojalnościowy</h2>

          {loyaltyError && (
            <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
              {loyaltyError}
            </div>
          )}
          {loyaltySuccess && (
            <div className="mb-4 p-3 bg-green-100 text-green-800 rounded-md text-sm">
              {loyaltySuccess}
            </div>
          )}

          {loyaltyLoading && !loyaltyStatus && (
            <p className="text-sm text-muted-foreground">Ładowanie...</p>
          )}

          {!loyaltyLoading && loyaltyStatus && !loyaltyStatus.isEnrolled && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Gość nie jest jeszcze zapisany do programu lojalnościowego.
              </p>
              <Button onClick={handleEnrollLoyalty} disabled={loyaltyLoading}>
                {loyaltyLoading ? "Zapisywanie..." : "Zapisz do programu"}
              </Button>
            </div>
          )}

          {loyaltyStatus?.isEnrolled && (
            <div className="space-y-6">
              {/* Status karty */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">Numer karty</p>
                  <p className="font-mono font-medium">{loyaltyStatus.cardNumber}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">Dostępne punkty</p>
                  <p className="text-2xl font-bold text-primary">{loyaltyStatus.points.toLocaleString()}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">Łączne punkty</p>
                  <p className="text-lg font-semibold">{loyaltyStatus.totalPoints.toLocaleString()}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">Liczba pobytów</p>
                  <p className="text-lg font-semibold">{loyaltyStatus.totalStays}</p>
                </div>
              </div>

              {/* Tier */}
              {loyaltyStatus.tier && (
                <div className="p-4 rounded-lg border-2" style={{ borderColor: loyaltyStatus.tier.color ?? "#ccc" }}>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">{loyaltyStatus.tier.icon}</span>
                    <div>
                      <p className="font-semibold text-lg">{loyaltyStatus.tier.name}</p>
                      <p className="text-xs text-muted-foreground">Aktualny poziom</p>
                    </div>
                  </div>

                  {/* Benefity tieru */}
                  <div className="flex flex-wrap gap-2 text-xs">
                    {loyaltyStatus.tier.discountPercent && loyaltyStatus.tier.discountPercent > 0 && (
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded">
                        -{loyaltyStatus.tier.discountPercent}% rabat
                      </span>
                    )}
                    {loyaltyStatus.tier.bonusPointsPercent && loyaltyStatus.tier.bonusPointsPercent > 0 && (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
                        +{loyaltyStatus.tier.bonusPointsPercent}% bonus pkt
                      </span>
                    )}
                    {loyaltyStatus.tier.earlyCheckIn && (
                      <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded">Wczesny check-in</span>
                    )}
                    {loyaltyStatus.tier.lateCheckOut && (
                      <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded">Późny check-out</span>
                    )}
                    {loyaltyStatus.tier.roomUpgrade && (
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded">Upgrade pokoju</span>
                    )}
                    {loyaltyStatus.tier.welcomeDrink && (
                      <span className="px-2 py-1 bg-pink-100 text-pink-800 rounded">Drink powitalny</span>
                    )}
                    {loyaltyStatus.tier.freeBreakfast && (
                      <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded">Bezpłatne śniadanie</span>
                    )}
                    {loyaltyStatus.tier.freeParking && (
                      <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded">Bezpłatny parking</span>
                    )}
                    {loyaltyStatus.tier.loungeAccess && (
                      <span className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded">Dostęp do lounge</span>
                    )}
                    {loyaltyStatus.tier.prioritySupport && (
                      <span className="px-2 py-1 bg-red-100 text-red-800 rounded">Priorytetowa obsługa</span>
                    )}
                  </div>

                  {/* Następny tier */}
                  {loyaltyStatus.nextTier && loyaltyStatus.pointsToNextTier !== null && (
                    <div className="mt-4 pt-3 border-t">
                      <p className="text-xs text-muted-foreground mb-2">
                        Do poziomu {loyaltyStatus.nextTier.icon} <strong>{loyaltyStatus.nextTier.name}</strong> brakuje: <strong>{loyaltyStatus.pointsToNextTier.toLocaleString()}</strong> pkt
                      </p>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="h-2 rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, (loyaltyStatus.totalPoints / loyaltyStatus.nextTier.minPoints) * 100)}%`,
                            backgroundColor: loyaltyStatus.nextTier.color ?? "#6366f1",
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Korekta punktów */}
              <div className="p-4 rounded-lg bg-muted/30 space-y-3">
                <h3 className="text-sm font-medium">Korekta punktów (Manager)</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="adjustPoints" className="text-xs">Punkty (+/-)</Label>
                    <Input
                      id="adjustPoints"
                      type="number"
                      value={adjustPoints}
                      onChange={(e) => setAdjustPoints(e.target.value)}
                      placeholder="np. 500 lub -200"
                      className="mt-1"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="adjustReason" className="text-xs">Powód</Label>
                    <Input
                      id="adjustReason"
                      value={adjustReason}
                      onChange={(e) => setAdjustReason(e.target.value)}
                      placeholder="np. Kompensata za niedogodności"
                      className="mt-1"
                    />
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleAdjustPoints}
                  disabled={loyaltyLoading}
                >
                  Wykonaj korektę
                </Button>
              </div>

              {/* Realizacja punktów */}
              <div className="p-4 rounded-lg bg-muted/30 space-y-3">
                <h3 className="text-sm font-medium">Realizacja punktów</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="redeemPoints" className="text-xs">Punkty do realizacji</Label>
                    <Input
                      id="redeemPoints"
                      type="number"
                      min="1"
                      value={redeemPoints}
                      onChange={(e) => setRedeemPoints(e.target.value)}
                      placeholder="np. 1000"
                      className="mt-1"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="redeemReason" className="text-xs">Za co</Label>
                    <Input
                      id="redeemReason"
                      value={redeemReason}
                      onChange={(e) => setRedeemReason(e.target.value)}
                      placeholder="np. Upgrade pokoju, Darmowe śniadanie"
                      className="mt-1"
                    />
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRedeemPoints}
                  disabled={loyaltyLoading}
                >
                  Zrealizuj punkty
                </Button>
              </div>

              {/* Historia transakcji */}
              <div>
                <h3 className="text-sm font-medium mb-3">Historia punktów</h3>
                {loyaltyTransactions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Brak transakcji.</p>
                ) : (
                  <div className="max-h-64 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 sticky top-0">
                        <tr>
                          <th className="text-left px-2 py-1.5">Data</th>
                          <th className="text-left px-2 py-1.5">Typ</th>
                          <th className="text-right px-2 py-1.5">Punkty</th>
                          <th className="text-right px-2 py-1.5">Saldo</th>
                          <th className="text-left px-2 py-1.5">Opis</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loyaltyTransactions.map((t) => (
                          <tr key={t.id} className="border-b border-border/50">
                            <td className="px-2 py-1.5 text-muted-foreground">
                              {new Date(t.createdAt).toLocaleDateString("pl-PL")}
                            </td>
                            <td className="px-2 py-1.5">
                              <span className={`px-1.5 py-0.5 rounded text-xs ${
                                t.type === "EARN" ? "bg-green-100 text-green-800" :
                                t.type === "REDEEM" ? "bg-red-100 text-red-800" :
                                t.type === "BONUS" ? "bg-blue-100 text-blue-800" :
                                t.type === "ADJUSTMENT" ? "bg-yellow-100 text-yellow-800" :
                                "bg-gray-100 text-gray-800"
                              }`}>
                                {t.type === "EARN" ? "Zdobycie" :
                                 t.type === "REDEEM" ? "Realizacja" :
                                 t.type === "BONUS" ? "Bonus" :
                                 t.type === "ADJUSTMENT" ? "Korekta" :
                                 t.type}
                              </span>
                            </td>
                            <td className={`px-2 py-1.5 text-right font-mono ${
                              t.points > 0 ? "text-green-600" : "text-red-600"
                            }`}>
                              {t.points > 0 ? "+" : ""}{t.points.toLocaleString()}
                            </td>
                            <td className="px-2 py-1.5 text-right font-mono">
                              {t.balanceAfter.toLocaleString()}
                            </td>
                            <td className="px-2 py-1.5 text-muted-foreground truncate max-w-[200px]" title={t.reason ?? ""}>
                              {t.reason ?? "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Data zapisania */}
              {loyaltyStatus.enrolledAt && (
                <p className="text-xs text-muted-foreground">
                  Członek programu od: {new Date(loyaltyStatus.enrolledAt).toLocaleDateString("pl-PL")}
                </p>
              )}
            </div>
          )}
        </section>
      )}
      {tab === "dane" && (
      <section className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Dane gościa</h2>
        
        {/* Zdjęcie gościa i statystyki */}
        <div className="mb-6 flex flex-col sm:flex-row gap-6">
          {/* Zdjęcie */}
          <div className="flex flex-col items-center gap-2">
            <div className="w-28 h-28 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-border">
              {photoUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={photoUrl} 
                    alt={`Zdjęcie ${name}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                    e.currentTarget.style.display = "none";
                    e.currentTarget.nextElementSibling?.classList.remove("hidden");
                  }}
                />
                </>
              ) : null}
              <span className={`text-3xl text-muted-foreground ${photoUrl ? "hidden" : ""}`}>
                {name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="text-center">
              <Label htmlFor="photoUrl" className="text-xs text-muted-foreground">URL zdjęcia</Label>
              <Input
                id="photoUrl"
                type="url"
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                placeholder="https://..."
                className="mt-1 w-44 text-xs"
              />
            </div>
          </div>

          {/* Statystyki pobytów */}
          <div className="flex-1 p-4 rounded-lg bg-muted/50 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Liczba pobytów</p>
              <p className="text-2xl font-bold">{initialGuest.totalStays}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Ostatni pobyt</p>
              <p className="text-lg font-semibold">
                {initialGuest.lastStayDate 
                  ? new Date(initialGuest.lastStayDate).toLocaleDateString("pl-PL") 
                  : "—"}
              </p>
            </div>
          </div>
        </div>

        {/* Sugestie z poprzednich pobytów - autouzupełnianie */}
        {initialGuest.totalStays > 0 && (
          <div className="mb-6 p-4 rounded-lg border border-blue-200 bg-blue-50">
            <h3 className="text-sm font-medium text-blue-800 mb-3">
              Sugestie z poprzednich pobytów
            </h3>
            {autoFillLoading ? (
              <p className="text-sm text-blue-600">Ładowanie sugestii...</p>
            ) : autoFillData ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                {/* Średnia długość pobytu */}
                {autoFillData.averageStayLength !== null && (
                  <div>
                    <p className="text-xs text-blue-600 mb-1">Śr. długość pobytu</p>
                    <p className="font-medium text-blue-900">
                      {autoFillData.averageStayLength.toFixed(1)} nocy
                    </p>
                  </div>
                )}
                {/* Średnia liczba osób */}
                {autoFillData.averagePax !== null && (
                  <div>
                    <p className="text-xs text-blue-600 mb-1">Śr. liczba osób</p>
                    <p className="font-medium text-blue-900">
                      {autoFillData.averagePax.toFixed(1)}
                    </p>
                  </div>
                )}
                {/* Preferowane pokoje */}
                {autoFillData.preferredRoomType && (
                  <div>
                    <p className="text-xs text-blue-600 mb-1">Preferowany typ pokoju</p>
                    <p className="font-medium text-blue-900">
                      {autoFillData.preferredRoomType}
                    </p>
                  </div>
                )}
                {/* Preferowane piętra */}
                {autoFillData.preferredFloor && (
                  <div>
                    <p className="text-xs text-blue-600 mb-1">Preferowane piętro</p>
                    <p className="font-medium text-blue-900">
                      {autoFillData.preferredFloor}
                    </p>
                  </div>
                )}
                {/* Preferowane ceny/plany */}
                {autoFillData.mostCommonRateCode && (
                  <div>
                    <p className="text-xs text-blue-600 mb-1">Częsty plan cenowy</p>
                    <p className="font-medium text-blue-900">
                      {autoFillData.mostCommonRateCode}
                    </p>
                  </div>
                )}
                {/* Preferowane wyżywienie */}
                {autoFillData.mostCommonMealPlan && (
                  <div>
                    <p className="text-xs text-blue-600 mb-1">Preferowane wyżywienie</p>
                    <p className="font-medium text-blue-900">
                      {autoFillData.mostCommonMealPlan}
                    </p>
                  </div>
                )}
                {/* Preferowany typ łóżka */}
                {autoFillData.preferredBedType && (
                  <div>
                    <p className="text-xs text-blue-600 mb-1">Preferowany typ łóżka</p>
                    <p className="font-medium text-blue-900">
                      {autoFillData.preferredBedType}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-blue-600 italic">
                Brak danych o poprzednich rezerwacjach.
              </p>
            )}
            <p className="text-xs text-blue-500 mt-3">
              Te informacje mogą być wykorzystane przy tworzeniu nowej rezerwacji dla tego gościa.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Imię i nazwisko</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="phone">Telefon</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="dateOfBirth">Data urodzenia</Label>
            <Input
              id="dateOfBirth"
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="placeOfBirth">Miejsce urodzenia</Label>
            <Input
              id="placeOfBirth"
              value={placeOfBirth}
              onChange={(e) => setPlaceOfBirth(e.target.value)}
              placeholder="np. Warszawa"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="nationality">Obywatelstwo / Narodowość</Label>
            <Input
              id="nationality"
              value={nationality}
              onChange={(e) => setNationality(e.target.value)}
              placeholder="np. PL, DE, GB"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="gender">Płeć (do statystyk GUS)</Label>
            <select
              id="gender"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">— wybierz —</option>
              <option value="M">Mężczyzna</option>
              <option value="F">Kobieta</option>
            </select>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="occupation">Zawód</Label>
              <Input
                id="occupation"
                value={occupation}
                onChange={(e) => setOccupation(e.target.value)}
                placeholder="np. lekarz, prawnik"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="guestType">Typ gościa</Label>
              <select
                id="guestType"
                value={guestType}
                onChange={(e) => setGuestType(e.target.value)}
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="INDIVIDUAL">Indywidualny</option>
                <option value="CORPORATE">Korporacyjny</option>
                <option value="GROUP">Grupowy</option>
                <option value="CREW">Załoga (lotnicza/morska)</option>
              </select>
            </div>
            <div>
              <Label htmlFor="segment">Segment</Label>
              <select
                id="segment"
                value={segment}
                onChange={(e) => setSegment(e.target.value)}
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">— wybierz —</option>
                <option value="BUSINESS">Business</option>
                <option value="LEISURE">Leisure</option>
                <option value="MICE">MICE (konferencje)</option>
                <option value="VIP">VIP</option>
                <option value="LONGSTAY">Long stay</option>
                <option value="CREW">Załoga</option>
                <option value="OTHER">Inny</option>
              </select>
            </div>
          </div>

          {/* Adres zamieszkania */}
          <div className="pt-4 border-t">
            <h3 className="text-sm font-medium mb-3">Adres zamieszkania</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="street">Ulica i numer</Label>
                <Input
                  id="street"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  placeholder="np. ul. Kwiatowa 15/3"
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="postalCode">Kod pocztowy</Label>
                  <Input
                    id="postalCode"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    placeholder="np. 00-001"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="city">Miasto</Label>
                  <Input
                    id="city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="np. Warszawa"
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="country">Kraj</Label>
                <Input
                  id="country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="np. PL, DE"
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          {/* Kontakt awaryjny */}
          <div className="pt-4 border-t">
            <h3 className="text-sm font-medium mb-3">Kontakt awaryjny</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Osoba do kontaktu w nagłych przypadkach (choroba, wypadek, sytuacja kryzysowa).
            </p>
            <div className="space-y-4">
              <div>
                <Label htmlFor="emergencyContactName">Imię i nazwisko</Label>
                <Input
                  id="emergencyContactName"
                  value={emergencyContactName}
                  onChange={(e) => setEmergencyContactName(e.target.value)}
                  placeholder="np. Jan Kowalski"
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="emergencyContactPhone">Telefon</Label>
                  <Input
                    id="emergencyContactPhone"
                    value={emergencyContactPhone}
                    onChange={(e) => setEmergencyContactPhone(e.target.value)}
                    placeholder="np. +48 600 123 456"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="emergencyContactRelation">Relacja</Label>
                  <select
                    id="emergencyContactRelation"
                    value={emergencyContactRelation}
                    onChange={(e) => setEmergencyContactRelation(e.target.value)}
                    className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">— wybierz —</option>
                    <option value="SPOUSE">Małżonek/Partner</option>
                    <option value="PARENT">Rodzic</option>
                    <option value="SIBLING">Rodzeństwo</option>
                    <option value="CHILD">Dziecko</option>
                    <option value="FRIEND">Przyjaciel</option>
                    <option value="OTHER">Inny</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Dokument tożsamości */}
          <div className="pt-4 border-t">
            <h3 className="text-sm font-medium mb-3">Dokument tożsamości</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="documentType">Typ dokumentu</Label>
                <select
                  id="documentType"
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">— wybierz —</option>
                  <option value="ID_CARD">Dowód osobisty</option>
                  <option value="PASSPORT">Paszport</option>
                  <option value="DRIVING_LICENSE">Prawo jazdy</option>
                  <option value="OTHER">Inny</option>
                </select>
              </div>
              <div>
                <Label htmlFor="documentNumber">Numer dokumentu</Label>
                <Input
                  id="documentNumber"
                  value={documentNumber}
                  onChange={(e) => setDocumentNumber(e.target.value)}
                  placeholder="np. ABC123456"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="documentExpiry">Data ważności dokumentu</Label>
                <Input
                  id="documentExpiry"
                  type="date"
                  value={documentExpiry}
                  onChange={(e) => setDocumentExpiry(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="documentIssuedBy">Organ wydający dokument</Label>
                <Input
                  id="documentIssuedBy"
                  value={documentIssuedBy}
                  onChange={(e) => setDocumentIssuedBy(e.target.value)}
                  placeholder="np. Prezydent m.st. Warszawy"
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="mrz">MRZ (dowód)</Label>
            <Input
              id="mrz"
              value={mrz}
              onChange={(e) => setMrz(e.target.value)}
              placeholder="Kod MRZ ze skanera 2D"
              className="mt-1"
            />
          </div>

          {/* VIP Status */}
          <div className="pt-4 border-t">
            <h3 className="text-sm font-medium mb-3">Status VIP</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isVip"
                  checked={isVip}
                  onChange={(e) => setIsVip(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <Label htmlFor="isVip" className="cursor-pointer">Gość VIP</Label>
              </div>
              {isVip && (
                <div>
                  <Label htmlFor="vipLevel">Poziom VIP</Label>
                  <select
                    id="vipLevel"
                    value={vipLevel}
                    onChange={(e) => setVipLevel(e.target.value)}
                    className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">— wybierz —</option>
                    <option value="BRONZE">Bronze</option>
                    <option value="SILVER">Silver</option>
                    <option value="GOLD">Gold</option>
                    <option value="PLATINUM">Platinum</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Preferencje dietetyczne */}
          <div className="pt-4 border-t">
            <h3 className="text-sm font-medium mb-3">Preferencje dietetyczne</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="mealVegetarian"
                    checked={mealVegetarian}
                    onChange={(e) => setMealVegetarian(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <Label htmlFor="mealVegetarian" className="cursor-pointer text-sm">Wegetariańska</Label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="mealVegan"
                    checked={mealVegan}
                    onChange={(e) => setMealVegan(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <Label htmlFor="mealVegan" className="cursor-pointer text-sm">Wegańska</Label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="mealGlutenFree"
                    checked={mealGlutenFree}
                    onChange={(e) => setMealGlutenFree(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <Label htmlFor="mealGlutenFree" className="cursor-pointer text-sm">Bezglutenowa</Label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="mealLactoseFree"
                    checked={mealLactoseFree}
                    onChange={(e) => setMealLactoseFree(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <Label htmlFor="mealLactoseFree" className="cursor-pointer text-sm">Bez laktozy</Label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="mealHalal"
                    checked={mealHalal}
                    onChange={(e) => setMealHalal(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <Label htmlFor="mealHalal" className="cursor-pointer text-sm">Halal</Label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="mealKosher"
                    checked={mealKosher}
                    onChange={(e) => setMealKosher(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <Label htmlFor="mealKosher" className="cursor-pointer text-sm">Koszer</Label>
                </div>
              </div>
              <div>
                <Label htmlFor="mealAllergies">Alergie pokarmowe</Label>
                <Input
                  id="mealAllergies"
                  value={mealAllergies}
                  onChange={(e) => setMealAllergies(e.target.value)}
                  placeholder="np. orzechy, skorupiaki, jajka (oddzielone przecinkami)"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="mealOther">Inne preferencje</Label>
                <Input
                  id="mealOther"
                  value={mealOther}
                  onChange={(e) => setMealOther(e.target.value)}
                  placeholder="np. bez owoców morza, dieta niskokaloryczna"
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          {/* Alergie i uwagi zdrowotne */}
          <div className="pt-4 border-t">
            <h3 className="text-sm font-medium mb-3">Alergie i uwagi zdrowotne</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="healthAllergies">Alergie (inne niż pokarmowe)</Label>
                <textarea
                  id="healthAllergies"
                  value={healthAllergies}
                  onChange={(e) => setHealthAllergies(e.target.value)}
                  placeholder="np. lateks, pyłki, kurz, sierść zwierząt, leki (penicylina, aspiryna), środki chemiczne"
                  rows={2}
                  className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              <div>
                <Label htmlFor="healthNotes">Uwagi zdrowotne</Label>
                <textarea
                  id="healthNotes"
                  value={healthNotes}
                  onChange={(e) => setHealthNotes(e.target.value)}
                  placeholder="np. cukrzyca, astma, problemy z sercem, potrzebny wózek inwalidzki, leżanka pod prysznicem, przyjmowane leki..."
                  rows={3}
                  className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Poufne informacje widoczne tylko dla personelu. Mogą być użyte do zapewnienia lepszej opieki.
                </p>
              </div>
            </div>
          </div>

          {/* Ulubiony minibar */}
          <div className="pt-4 border-t">
            <h3 className="text-sm font-medium mb-3">Ulubiony minibar</h3>
            <div>
              <Label htmlFor="favoriteMinibar">Produkty do przygotowania przed przyjazdem</Label>
              <textarea
                id="favoriteMinibar"
                value={favoriteMinibar}
                onChange={(e) => setFavoriteMinibar(e.target.value)}
                placeholder={"Cola\nWoda mineralna x2\nPiwo lokalne\nCzipsy\nCzekolada"}
                rows={4}
                className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-mono"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Jeden produkt na linię. Możesz dodać ilość: &quot;Woda x2&quot;. Lista zostanie wyświetlona housekeeping przed przyjazdem gościa.
              </p>
            </div>
          </div>

          {/* Historia restauracyjna */}
          <div className="pt-4 border-t">
            <h3 className="text-sm font-medium mb-3">Historia restauracyjna</h3>
            {restaurantLoading && (
              <p className="text-xs text-muted-foreground">Wczytywanie...</p>
            )}
            {!restaurantLoading && (!restaurantHistory || restaurantHistory.totalCharges === 0) && (
              <p className="text-xs text-muted-foreground">Brak rachunków restauracyjnych nabitych na pokój.</p>
            )}
            {!restaurantLoading && restaurantHistory && restaurantHistory.totalCharges > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>Łącznie: <strong className="text-foreground">{restaurantHistory.totalAmount.toFixed(2)} PLN</strong></span>
                  <span>·</span>
                  <span>{restaurantHistory.totalCharges} {restaurantHistory.totalCharges === 1 ? "rachunek" : restaurantHistory.totalCharges < 5 ? "rachunki" : "rachunków"}</span>
                </div>
                <div className="rounded-md border divide-y max-h-48 overflow-y-auto">
                  {restaurantHistory.charges.map((charge) => (
                    <div key={charge.id} className="flex items-center justify-between px-3 py-2 text-xs">
                      <div className="min-w-0">
                        <span className="font-medium">Pok. {charge.roomNumber}</span>
                        <span className="ml-2 text-muted-foreground">
                          {new Date(charge.createdAt).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" })}
                        </span>
                        {charge.items.length > 0 && (
                          <span className="ml-2 text-muted-foreground truncate">
                            ({charge.items.map((it) => it.name).join(", ")})
                          </span>
                        )}
                        {!charge.items.length && charge.description && (
                          <span className="ml-2 text-muted-foreground truncate">{charge.description}</span>
                        )}
                      </div>
                      <span className="shrink-0 font-semibold ml-2">{charge.amount.toFixed(2)} PLN</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Uwagi/ostrzeżenia dla personelu */}
          <div className="pt-4 border-t">
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <span className="text-amber-600">⚠️</span>
              Uwagi/ostrzeżenia dla personelu
            </h3>
            <div>
              <Label htmlFor="staffNotes">Notatki wewnętrzne</Label>
              <textarea
                id="staffNotes"
                value={staffNotes}
                onChange={(e) => setStaffNotes(e.target.value)}
                placeholder="np. Zawsze prosi o późny checkout. Skarżył się na hałas w pokoju 105. Preferuje pokoje z dala od windy..."
                rows={3}
                className="mt-1 flex w-full rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Te uwagi są widoczne tylko dla personelu przy rezerwacjach tego gościa. Używaj do zapisania ważnych informacji o preferencjach lub historii.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button type="submit" disabled={saving}>
              {saving ? "Zapisywanie…" : "Zapisz"}
            </Button>
            {success && <span className="text-sm text-green-600">Zapisano.</span>}
            {error && <span className="text-sm text-destructive">{error}</span>}
          </div>
        </form>
        <div className="mt-4 pt-4 border-t">
          <p className="text-sm font-medium mb-2">Czarna lista</p>
          <Button
            type="button"
            variant={isBlacklisted ? "destructive" : "outline"}
            size="sm"
            onClick={toggleBlacklist}
            disabled={saving}
          >
            {isBlacklisted ? "Usuń z czarnej listy" : "Dodaj do czarnej listy"}
          </Button>
        </div>
      </section>
      )}

      <section className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Historia pobytów</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Brak rezerwacji.</p>
        ) : (
          <ul className="space-y-2">
            {history.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-2 rounded border px-3 py-2 text-sm"
              >
                <span className="font-medium">{r.room}</span>
                <span className="text-muted-foreground">
                  {r.checkIn} – {r.checkOut}
                </span>
                <span className="text-muted-foreground">
                  {STATUS_LABELS[r.status] ?? r.status}
                </span>
                <Link
                  href={`/front-office?reservation=${r.id}`}
                  className="text-primary hover:underline ml-auto"
                >
                  Otwórz rezerwację
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
