"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getAllCompanies,
  lookupCompanyByNip,
  createOrUpdateCompany,
  deleteCompany,
  getCompanyById,
  updateCompany,
  getCompanyStats,
  createCorporateContract,
  updateCorporateContract,
  deleteCorporateContract,
  getRateCodes,
  getCompanyBalance,
  getAccountManagers,
  getReservationsForConsolidatedInvoice,
  createConsolidatedInvoice,
  getCompanyConsolidatedInvoices,
  updateConsolidatedInvoiceStatus,
  type CompanyForList,
  type CompanyDetails,
  type CorporateContractForList,
  type CompanyBalance,
  type AccountManager,
  type ConsolidatedInvoiceForList,
} from "@/app/actions/companies";

type Tab = "lista" | "dodaj" | "szczegoly" | "statystyki";

export default function FirmyPage() {
  // Aktywna zakładka
  const [tab, setTab] = useState<Tab>("lista");

  // === LISTA FIRM ===
  const [companies, setCompanies] = useState<CompanyForList[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<"name" | "nip" | "city" | "createdAt" | "reservationCount">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const pageSize = 20;

  // === DODAWANIE FIRMY ===
  const [nipInput, setNipInput] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyPostalCode, setCompanyPostalCode] = useState("");
  const [companyCity, setCompanyCity] = useState("");
  const [companyCountry, setCompanyCountry] = useState("POL");
  const [nipLookupLoading, setNipLookupLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);

  // === SZCZEGÓŁY FIRMY ===
  const [selectedCompany, setSelectedCompany] = useState<CompanyDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editPostalCode, setEditPostalCode] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editCountry, setEditCountry] = useState("");
  // Osoba kontaktowa
  const [editContactPerson, setEditContactPerson] = useState("");
  const [editContactEmail, setEditContactEmail] = useState("");
  const [editContactPhone, setEditContactPhone] = useState("");
  const [editContactPosition, setEditContactPosition] = useState("");
  // Warunki płatności
  const [editPaymentTermDays, setEditPaymentTermDays] = useState("14");
  const [editCreditLimit, setEditCreditLimit] = useState("");
  const [editBillingEmail, setEditBillingEmail] = useState("");
  const [editBillingNotes, setEditBillingNotes] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // === KONTRAKTY KORPORACYJNE ===
  const [showContractForm, setShowContractForm] = useState(false);
  const [editingContract, setEditingContract] = useState<CorporateContractForList | null>(null);
  const [contractName, setContractName] = useState("");
  const [contractRateCodeId, setContractRateCodeId] = useState("");
  const [contractDiscountPercent, setContractDiscountPercent] = useState("");
  const [contractFixedPrice, setContractFixedPrice] = useState("");
  const [contractValidFrom, setContractValidFrom] = useState("");
  const [contractValidTo, setContractValidTo] = useState("");
  const [contractMinNights, setContractMinNights] = useState("");
  const [contractPaymentTermDays, setContractPaymentTermDays] = useState("14");
  const [contractContactPerson, setContractContactPerson] = useState("");
  const [contractContactEmail, setContractContactEmail] = useState("");
  const [contractContactPhone, setContractContactPhone] = useState("");
  const [contractNotes, setContractNotes] = useState("");
  const [contractIsActive, setContractIsActive] = useState(true);
  const [contractSaving, setContractSaving] = useState(false);
  const [contractError, setContractError] = useState<string | null>(null);
  const [rateCodes, setRateCodes] = useState<Array<{ id: string; code: string; name: string; price: number | null }>>([]);
  const [rateCodesLoaded, setRateCodesLoaded] = useState(false);

  // === ROZRACHUNKI (SALDO NALEŻNOŚCI) ===
  const [companyBalance, setCompanyBalance] = useState<CompanyBalance | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  // === OPIEKUN HANDLOWY ===
  const [accountManagers, setAccountManagers] = useState<AccountManager[]>([]);
  const [accountManagersLoaded, setAccountManagersLoaded] = useState(false);
  const [editAccountManagerId, setEditAccountManagerId] = useState<string>("");

  // === FAKTURY ZBIORCZE ===
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [invoiceReservations, setInvoiceReservations] = useState<Array<{
    id: string;
    confirmationNumber: string | null;
    guestName: string;
    roomNumber: string;
    checkIn: Date;
    checkOut: Date;
    nights: number;
    totalAmount: number;
    status: string;
    hasInvoice: boolean;
  }>>([]);
  const [invoiceReservationsLoading, setInvoiceReservationsLoading] = useState(false);
  const [selectedForInvoice, setSelectedForInvoice] = useState<Set<string>>(new Set());
  const [invoiceCreating, setInvoiceCreating] = useState(false);
  const [consolidatedInvoices, setConsolidatedInvoices] = useState<ConsolidatedInvoiceForList[]>([]);
  const [consolidatedInvoicesLoading, setConsolidatedInvoicesLoading] = useState(false);

  // === STATYSTYKI ===
  const [stats, setStats] = useState<{
    totalCompanies: number;
    companiesWithReservations: number;
    topCompaniesByReservations: Array<{ id: string; name: string; nip: string; reservationCount: number }>;
    recentlyAdded: Array<{ id: string; name: string; nip: string; createdAt: Date }>;
  } | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Ładowanie listy firm
  const loadCompanies = useCallback(async () => {
    setLoading(true);
    setError(null);

    const res = await getAllCompanies({
      query,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      sortBy,
      sortOrder,
    });

    setLoading(false);
    if (res.success) {
      setCompanies(res.data.companies);
      setTotal(res.data.total);
    } else {
      setError(res.error);
    }
  }, [query, page, sortBy, sortOrder]);

  // Ładowanie przy zmianie filtrów
  useEffect(() => {
    if (tab === "lista") {
      loadCompanies();
    }
  }, [tab, loadCompanies]);

  // Reset strony przy zmianie query
  useEffect(() => {
    setPage(1);
  }, [query, sortBy, sortOrder]);

  // Ładowanie statystyk
  useEffect(() => {
    if (tab === "statystyki" && !stats) {
      setStatsLoading(true);
      getCompanyStats().then((res) => {
        setStatsLoading(false);
        if (res.success) {
          setStats(res.data);
        }
      });
    }
  }, [tab, stats]);

  // Lookup NIP
  const handleNipLookup = async () => {
    const nip = nipInput.replace(/\D/g, "");
    if (nip.length !== 10) {
      setAddError("NIP musi mieć 10 cyfr");
      return;
    }

    setNipLookupLoading(true);
    setAddError(null);
    setAddSuccess(null);

    const res = await lookupCompanyByNip(nip);
    setNipLookupLoading(false);

    if (res.success) {
      setCompanyName(res.data.name);
      setCompanyAddress(res.data.address ?? "");
      setCompanyPostalCode(res.data.postalCode ?? "");
      setCompanyCity(res.data.city ?? "");
      setCompanyCountry(res.data.country);
      setAddSuccess("Dane pobrane pomyślnie");
    } else {
      setAddError(res.error);
    }
  };

  // Zapisywanie nowej firmy
  const handleSaveCompany = async () => {
    const nip = nipInput.replace(/\D/g, "");
    if (nip.length !== 10) {
      setAddError("NIP musi mieć 10 cyfr");
      return;
    }
    if (!companyName.trim()) {
      setAddError("Nazwa firmy jest wymagana");
      return;
    }

    setSaveLoading(true);
    setAddError(null);
    setAddSuccess(null);

    const res = await createOrUpdateCompany({
      nip,
      name: companyName,
      address: companyAddress || null,
      postalCode: companyPostalCode || null,
      city: companyCity || null,
      country: companyCountry || "POL",
    });

    setSaveLoading(false);

    if (res.success) {
      setAddSuccess("Firma została zapisana");
      // Wyczyść formularz
      setNipInput("");
      setCompanyName("");
      setCompanyAddress("");
      setCompanyPostalCode("");
      setCompanyCity("");
      setCompanyCountry("POL");
      // Odśwież listę
      loadCompanies();
    } else {
      setAddError(res.error);
    }
  };

  // Otwieranie szczegółów firmy
  const handleOpenDetails = async (companyId: string) => {
    setDetailsLoading(true);
    setSelectedCompany(null);
    setEditMode(false);
    setDeleteConfirm(false);
    setTab("szczegoly");

    const res = await getCompanyById(companyId);
    setDetailsLoading(false);

    if (res.success) {
      setSelectedCompany(res.data);
      setEditName(res.data.name);
      setEditAddress(res.data.address ?? "");
      setEditPostalCode(res.data.postalCode ?? "");
      setEditCity(res.data.city ?? "");
      setEditCountry(res.data.country);
      setEditContactPerson(res.data.contactPerson ?? "");
      setEditContactEmail(res.data.contactEmail ?? "");
      setEditContactPhone(res.data.contactPhone ?? "");
      setEditContactPosition(res.data.contactPosition ?? "");
      setEditPaymentTermDays(res.data.paymentTermDays.toString());
      setEditCreditLimit(res.data.creditLimit?.toString() ?? "");
      setEditBillingEmail(res.data.billingEmail ?? "");
      setEditBillingNotes(res.data.billingNotes ?? "");
      setEditAccountManagerId(res.data.accountManagerId ?? "");
      
      // Załaduj rozrachunki
      setBalanceLoading(true);
      setCompanyBalance(null);
      const balanceRes = await getCompanyBalance(companyId);
      setBalanceLoading(false);
      if (balanceRes.success) {
        setCompanyBalance(balanceRes.data);
      }
      
      // Załaduj listę opiekunów handlowych (jeśli jeszcze nie załadowano)
      if (!accountManagersLoaded) {
        const managersRes = await getAccountManagers();
        if (managersRes.success) {
          setAccountManagers(managersRes.data);
          setAccountManagersLoaded(true);
        }
      }
      
      // Załaduj faktury zbiorcze
      setConsolidatedInvoicesLoading(true);
      const invoicesRes = await getCompanyConsolidatedInvoices(companyId);
      setConsolidatedInvoicesLoading(false);
      if (invoicesRes.success) {
        setConsolidatedInvoices(invoicesRes.data);
      }
      
      // Reset stanu formularza faktur
      setShowInvoiceForm(false);
      setSelectedForInvoice(new Set());
      setInvoiceReservations([]);
    } else {
      setError(res.error);
      setTab("lista");
    }
  };

  // Załaduj rezerwacje do faktury zbiorczej
  const loadReservationsForInvoice = async () => {
    if (!selectedCompany) return;
    setInvoiceReservationsLoading(true);
    const res = await getReservationsForConsolidatedInvoice(selectedCompany.id);
    setInvoiceReservationsLoading(false);
    if (res.success) {
      setInvoiceReservations(res.data);
      setSelectedForInvoice(new Set());
    }
  };

  // Utwórz fakturę zbiorczą
  const handleCreateConsolidatedInvoice = async () => {
    if (!selectedCompany) return;
    if (selectedForInvoice.size === 0) {
      setError("Wybierz co najmniej jedną rezerwację");
      return;
    }

    setInvoiceCreating(true);
    setError(null);

    const res = await createConsolidatedInvoice({
      companyId: selectedCompany.id,
      reservationIds: Array.from(selectedForInvoice),
    });

    setInvoiceCreating(false);

    if (res.success) {
      // Odśwież listę faktur i rozrachunki
      handleOpenDetails(selectedCompany.id);
    } else {
      setError(res.error ?? "Błąd tworzenia faktury");
    }
  };

  // Zmień status faktury (oznacz jako opłaconą)
  const handleMarkInvoicePaid = async (invoiceId: string) => {
    const res = await updateConsolidatedInvoiceStatus(invoiceId, "PAID");
    if (res.success && selectedCompany) {
      // Odśwież listę faktur
      const invoicesRes = await getCompanyConsolidatedInvoices(selectedCompany.id);
      if (invoicesRes.success) {
        setConsolidatedInvoices(invoicesRes.data);
      }
    }
  };

  // Zapisywanie edycji
  const handleSaveEdit = async () => {
    if (!selectedCompany) return;
    if (!editName.trim()) {
      setError("Nazwa firmy jest wymagana");
      return;
    }

    setEditLoading(true);
    setError(null);

    const res = await updateCompany(selectedCompany.id, {
      name: editName,
      address: editAddress || null,
      postalCode: editPostalCode || null,
      city: editCity || null,
      country: editCountry || "POL",
      contactPerson: editContactPerson || null,
      contactEmail: editContactEmail || null,
      contactPhone: editContactPhone || null,
      contactPosition: editContactPosition || null,
      paymentTermDays: parseInt(editPaymentTermDays, 10) || 14,
      creditLimit: editCreditLimit ? parseFloat(editCreditLimit) : null,
      billingEmail: editBillingEmail || null,
      billingNotes: editBillingNotes || null,
      accountManagerId: editAccountManagerId || null,
    });

    setEditLoading(false);

    if (res.success) {
      setEditMode(false);
      // Odśwież dane
      handleOpenDetails(selectedCompany.id);
    } else {
      setError(res.error);
    }
  };

  // Usuwanie firmy
  const handleDelete = async () => {
    if (!selectedCompany) return;

    setDeleteLoading(true);
    setError(null);

    const res = await deleteCompany(selectedCompany.id);
    setDeleteLoading(false);

    if (res.success) {
      setSelectedCompany(null);
      setTab("lista");
      loadCompanies();
    } else {
      setError(res.error);
      setDeleteConfirm(false);
    }
  };

  // === ZARZĄDZANIE KONTRAKTAMI ===

  // Ładowanie kodów cenowych
  const loadRateCodes = useCallback(async () => {
    if (rateCodesLoaded) return;
    const res = await getRateCodes();
    if (res.success) {
      setRateCodes(res.data);
      setRateCodesLoaded(true);
    }
  }, [rateCodesLoaded]);

  // Resetowanie formularza kontraktu
  const resetContractForm = () => {
    setContractName("");
    setContractRateCodeId("");
    setContractDiscountPercent("");
    setContractFixedPrice("");
    setContractValidFrom("");
    setContractValidTo("");
    setContractMinNights("");
    setContractPaymentTermDays("14");
    setContractContactPerson("");
    setContractContactEmail("");
    setContractContactPhone("");
    setContractNotes("");
    setContractIsActive(true);
    setContractError(null);
    setEditingContract(null);
  };

  // Otwórz formularz dodawania kontraktu
  const handleShowContractForm = () => {
    loadRateCodes();
    resetContractForm();
    // Ustaw domyślne daty (od dziś, do za rok)
    const today = new Date();
    const nextYear = new Date();
    nextYear.setFullYear(today.getFullYear() + 1);
    setContractValidFrom(today.toISOString().split("T")[0]);
    setContractValidTo(nextYear.toISOString().split("T")[0]);
    setShowContractForm(true);
  };

  // Otwórz formularz edycji kontraktu
  const handleEditContract = (contract: CorporateContractForList) => {
    loadRateCodes();
    setEditingContract(contract);
    setContractName(contract.name ?? "");
    setContractRateCodeId(contract.rateCode?.id ?? "");
    setContractDiscountPercent(contract.discountPercent?.toString() ?? "");
    setContractFixedPrice(contract.fixedPricePerNight?.toString() ?? "");
    setContractValidFrom(new Date(contract.validFrom).toISOString().split("T")[0]);
    setContractValidTo(new Date(contract.validTo).toISOString().split("T")[0]);
    setContractMinNights(contract.minNightsPerYear?.toString() ?? "");
    setContractPaymentTermDays(contract.paymentTermDays.toString());
    setContractContactPerson(contract.contactPerson ?? "");
    setContractContactEmail("");
    setContractContactPhone("");
    setContractNotes("");
    setContractIsActive(contract.isActive);
    setContractError(null);
    setShowContractForm(true);
  };

  // Zapisz kontrakt (dodaj lub edytuj)
  const handleSaveContract = async () => {
    if (!selectedCompany) return;

    // Walidacja
    if (!contractValidFrom || !contractValidTo) {
      setContractError("Daty obowiązywania są wymagane");
      return;
    }

    setContractSaving(true);
    setContractError(null);

    const data = {
      companyId: selectedCompany.id,
      name: contractName || null,
      rateCodeId: contractRateCodeId || null,
      discountPercent: contractDiscountPercent ? parseFloat(contractDiscountPercent) : null,
      fixedPricePerNight: contractFixedPrice ? parseFloat(contractFixedPrice) : null,
      validFrom: contractValidFrom,
      validTo: contractValidTo,
      minNightsPerYear: contractMinNights ? parseInt(contractMinNights, 10) : null,
      paymentTermDays: parseInt(contractPaymentTermDays, 10) || 14,
      contactPerson: contractContactPerson || null,
      contactEmail: contractContactEmail || null,
      contactPhone: contractContactPhone || null,
      notes: contractNotes || null,
      isActive: contractIsActive,
    };

    let res;
    if (editingContract) {
      res = await updateCorporateContract(editingContract.id, data);
    } else {
      res = await createCorporateContract(data);
    }

    setContractSaving(false);

    if (res.success) {
      setShowContractForm(false);
      resetContractForm();
      // Odśwież dane firmy
      handleOpenDetails(selectedCompany.id);
    } else {
      setContractError(res.error);
    }
  };

  // Usuń kontrakt
  const handleDeleteContract = async (contractId: string) => {
    if (!selectedCompany) return;
    if (!confirm("Czy na pewno usunąć ten kontrakt?")) return;

    const res = await deleteCorporateContract(contractId);
    if (res.success) {
      handleOpenDetails(selectedCompany.id);
    } else {
      setError(res.error);
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  // Formatowanie NIP
  const formatNip = (nip: string) => {
    const clean = nip.replace(/\D/g, "");
    if (clean.length === 10) {
      return `${clean.slice(0, 3)}-${clean.slice(3, 6)}-${clean.slice(6, 8)}-${clean.slice(8)}`;
    }
    return nip;
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">Panel</Link>
        <span>/</span>
        <span>Firmy</span>
      </div>

      <h1 className="text-2xl font-semibold mb-6">Baza firm / Kontrahenci</h1>

      {/* Zakładki */}
      <div className="mb-6 flex gap-1 border-b">
        <button
          type="button"
          onClick={() => setTab("lista")}
          className={`px-4 py-2 text-sm font-medium ${tab === "lista" ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}
        >
          Lista firm
        </button>
        <button
          type="button"
          onClick={() => setTab("dodaj")}
          className={`px-4 py-2 text-sm font-medium ${tab === "dodaj" ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}
        >
          Dodaj firmę
        </button>
        <button
          type="button"
          onClick={() => setTab("statystyki")}
          className={`px-4 py-2 text-sm font-medium ${tab === "statystyki" ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}
        >
          Statystyki
        </button>
        {selectedCompany && (
          <button
            type="button"
            onClick={() => setTab("szczegoly")}
            className={`px-4 py-2 text-sm font-medium ${tab === "szczegoly" ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            Szczegóły: {selectedCompany.name.slice(0, 20)}...
          </button>
        )}
      </div>

      {/* Komunikaty błędów */}
      {error && (
        <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
          {error}
        </div>
      )}

      {/* === ZAKŁADKA: LISTA FIRM === */}
      {tab === "lista" && (
        <div className="space-y-4">
          {/* Wyszukiwarka */}
          <div className="p-4 border rounded-lg bg-card">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="md:col-span-2">
                <Label htmlFor="search" className="text-sm font-medium">Szukaj firmy</Label>
                <Input
                  id="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Wpisz NIP, nazwę lub miasto..."
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm font-medium">Sortowanie</Label>
                <div className="mt-1 flex gap-2">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                  >
                    <option value="name">Nazwa</option>
                    <option value="nip">NIP</option>
                    <option value="city">Miasto</option>
                    <option value="createdAt">Data dodania</option>
                    <option value="reservationCount">Liczba rezerwacji</option>
                  </select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                    className="px-3"
                  >
                    {sortOrder === "asc" ? "↑" : "↓"}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Tabela firm */}
          {loading ? (
            <p className="text-sm text-muted-foreground">Ładowanie...</p>
          ) : companies.length === 0 ? (
            <div className="p-8 text-center border rounded-lg bg-card">
              <p className="text-muted-foreground">Brak firm w bazie.</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setTab("dodaj")}
              >
                Dodaj pierwszą firmę
              </Button>
            </div>
          ) : (
            <>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">NIP</th>
                      <th className="px-4 py-3 text-left font-medium">Nazwa</th>
                      <th className="px-4 py-3 text-left font-medium hidden md:table-cell">Adres</th>
                      <th className="px-4 py-3 text-left font-medium hidden lg:table-cell">Miasto</th>
                      <th className="px-4 py-3 text-center font-medium hidden lg:table-cell">Termin płatności</th>
                      <th className="px-4 py-3 text-center font-medium">Rezerwacje</th>
                      <th className="px-4 py-3 text-right font-medium">Akcje</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {companies.map((company) => (
                      <tr key={company.id} className="hover:bg-muted/50">
                        <td className="px-4 py-3 font-mono text-xs">
                          {formatNip(company.nip)}
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {company.name}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                          {company.address ?? "—"}
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          {company.city ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-center hidden lg:table-cell">
                          <span className="text-xs">
                            {company.paymentTermDays === 0 ? "Gotówka" : `${company.paymentTermDays}d`}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full text-xs font-medium ${company.reservationCount > 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                            {company.reservationCount}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDetails(company.id)}
                          >
                            Szczegóły
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Paginacja */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Wyświetlono {companies.length} z {total} firm
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Poprzednia
                    </Button>
                    <span className="px-3 py-1 text-sm">
                      {page} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      Następna
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* === ZAKŁADKA: DODAJ FIRMĘ === */}
      {tab === "dodaj" && (
        <div className="max-w-xl">
          <div className="p-6 border rounded-lg bg-card space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-4">Dodaj nową firmę</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Wpisz NIP i pobierz dane z bazy VAT, lub wypełnij formularz ręcznie.
              </p>
            </div>

            {addError && (
              <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                {addError}
              </div>
            )}
            {addSuccess && (
              <div className="p-3 bg-green-100 text-green-800 rounded-md text-sm">
                {addSuccess}
              </div>
            )}

            {/* NIP z lookup */}
            <div>
              <Label htmlFor="nip">NIP *</Label>
              <div className="mt-1 flex gap-2">
                <Input
                  id="nip"
                  value={nipInput}
                  onChange={(e) => setNipInput(e.target.value)}
                  placeholder="np. 5711640854"
                  maxLength={13}
                />
                <Button
                  variant="outline"
                  onClick={handleNipLookup}
                  disabled={nipLookupLoading}
                >
                  {nipLookupLoading ? "Pobieranie..." : "Pobierz dane"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Dane zostaną pobrane z Wykazu podatników VAT (API MF).
              </p>
            </div>

            {/* Nazwa firmy */}
            <div>
              <Label htmlFor="companyName">Nazwa firmy *</Label>
              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="np. KARCZMA ŁABĘDŹ ŁUKASZ WOJENKOWSKI"
                className="mt-1"
              />
            </div>

            {/* Adres */}
            <div>
              <Label htmlFor="companyAddress">Adres (ulica, nr)</Label>
              <Input
                id="companyAddress"
                value={companyAddress}
                onChange={(e) => setCompanyAddress(e.target.value)}
                placeholder="np. ul. Główna 1"
                className="mt-1"
              />
            </div>

            {/* Kod pocztowy i miasto */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="companyPostalCode">Kod pocztowy</Label>
                <Input
                  id="companyPostalCode"
                  value={companyPostalCode}
                  onChange={(e) => setCompanyPostalCode(e.target.value)}
                  placeholder="np. 00-001"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="companyCity">Miasto</Label>
                <Input
                  id="companyCity"
                  value={companyCity}
                  onChange={(e) => setCompanyCity(e.target.value)}
                  placeholder="np. WARSZAWA"
                  className="mt-1"
                />
              </div>
            </div>

            {/* Kraj */}
            <div>
              <Label htmlFor="companyCountry">Kraj</Label>
              <Input
                id="companyCountry"
                value={companyCountry}
                onChange={(e) => setCompanyCountry(e.target.value)}
                placeholder="np. POL"
                className="mt-1"
              />
            </div>

            {/* Przyciski */}
            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleSaveCompany}
                disabled={saveLoading}
              >
                {saveLoading ? "Zapisywanie..." : "Zapisz firmę"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setNipInput("");
                  setCompanyName("");
                  setCompanyAddress("");
                  setCompanyPostalCode("");
                  setCompanyCity("");
                  setCompanyCountry("POL");
                  setAddError(null);
                  setAddSuccess(null);
                }}
              >
                Wyczyść
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* === ZAKŁADKA: SZCZEGÓŁY FIRMY === */}
      {tab === "szczegoly" && (
        <div className="space-y-6">
          {detailsLoading ? (
            <p className="text-sm text-muted-foreground">Ładowanie danych firmy...</p>
          ) : selectedCompany ? (
            <>
              {/* Nagłówek */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-semibold">{selectedCompany.name}</h2>
                  <p className="text-muted-foreground font-mono">
                    NIP: {formatNip(selectedCompany.nip)}
                  </p>
                </div>
                <div className="flex gap-2">
                  {!editMode && (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => setEditMode(true)}
                      >
                        Edytuj
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setTab("lista")}
                      >
                        Wróć do listy
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Formularz edycji lub widok danych */}
              <div className="p-6 border rounded-lg bg-card">
                {editMode ? (
                  <div className="space-y-4">
                    <h3 className="font-medium mb-4">Edycja danych firmy</h3>
                    <div>
                      <Label htmlFor="editName">Nazwa firmy *</Label>
                      <Input
                        id="editName"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="editAddress">Adres</Label>
                      <Input
                        id="editAddress"
                        value={editAddress}
                        onChange={(e) => setEditAddress(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="editPostalCode">Kod pocztowy</Label>
                        <Input
                          id="editPostalCode"
                          value={editPostalCode}
                          onChange={(e) => setEditPostalCode(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="editCity">Miasto</Label>
                        <Input
                          id="editCity"
                          value={editCity}
                          onChange={(e) => setEditCity(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="editCountry">Kraj</Label>
                      <Input
                        id="editCountry"
                        value={editCountry}
                        onChange={(e) => setEditCountry(e.target.value)}
                        className="mt-1"
                      />
                    </div>

                    {/* Osoba kontaktowa */}
                    <div className="pt-4 border-t mt-4">
                      <h4 className="font-medium mb-4">Osoba kontaktowa</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="editContactPerson">Imię i nazwisko</Label>
                          <Input
                            id="editContactPerson"
                            value={editContactPerson}
                            onChange={(e) => setEditContactPerson(e.target.value)}
                            placeholder="np. Jan Kowalski"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="editContactPosition">Stanowisko</Label>
                          <Input
                            id="editContactPosition"
                            value={editContactPosition}
                            onChange={(e) => setEditContactPosition(e.target.value)}
                            placeholder="np. Kierownik Działu HR"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="editContactEmail">E-mail</Label>
                          <Input
                            id="editContactEmail"
                            type="email"
                            value={editContactEmail}
                            onChange={(e) => setEditContactEmail(e.target.value)}
                            placeholder="np. jan.kowalski@firma.pl"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="editContactPhone">Telefon</Label>
                          <Input
                            id="editContactPhone"
                            value={editContactPhone}
                            onChange={(e) => setEditContactPhone(e.target.value)}
                            placeholder="np. 600 123 456"
                            className="mt-1"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Warunki płatności */}
                    <div className="pt-4 border-t mt-4">
                      <h4 className="font-medium mb-4">Warunki płatności</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="editPaymentTermDays">Termin płatności (dni)</Label>
                          <select
                            id="editPaymentTermDays"
                            value={editPaymentTermDays}
                            onChange={(e) => setEditPaymentTermDays(e.target.value)}
                            className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                          >
                            <option value="0">Gotówka / przedpłata</option>
                            <option value="7">7 dni</option>
                            <option value="14">14 dni</option>
                            <option value="21">21 dni</option>
                            <option value="30">30 dni</option>
                            <option value="45">45 dni</option>
                            <option value="60">60 dni</option>
                            <option value="90">90 dni</option>
                          </select>
                        </div>
                        <div>
                          <Label htmlFor="editCreditLimit">Limit kredytowy (zł)</Label>
                          <Input
                            id="editCreditLimit"
                            type="number"
                            min="0"
                            step="0.01"
                            value={editCreditLimit}
                            onChange={(e) => setEditCreditLimit(e.target.value)}
                            placeholder="np. 10000.00"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="editBillingEmail">E-mail do faktur</Label>
                          <Input
                            id="editBillingEmail"
                            type="email"
                            value={editBillingEmail}
                            onChange={(e) => setEditBillingEmail(e.target.value)}
                            placeholder="np. faktury@firma.pl"
                            className="mt-1"
                          />
                        </div>
                      </div>
                      <div className="mt-4">
                        <Label htmlFor="editBillingNotes">Uwagi do rozliczeń</Label>
                        <textarea
                          id="editBillingNotes"
                          value={editBillingNotes}
                          onChange={(e) => setEditBillingNotes(e.target.value)}
                          placeholder="np. Faktura zbiorcza na koniec miesiąca..."
                          rows={2}
                          className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        />
                      </div>
                    </div>

                    {/* Opiekun handlowy */}
                    <div className="pt-4 border-t mt-4">
                      <h4 className="font-medium mb-4">Opiekun handlowy</h4>
                      <div>
                        <Label htmlFor="editAccountManager">Przypisany pracownik</Label>
                        <select
                          id="editAccountManager"
                          value={editAccountManagerId}
                          onChange={(e) => setEditAccountManagerId(e.target.value)}
                          className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                        >
                          <option value="">— Brak przypisanego opiekuna —</option>
                          {accountManagers.map((mgr) => (
                            <option key={mgr.id} value={mgr.id}>
                              {mgr.name} ({mgr.role}) — {mgr.managedCompaniesCount} firm
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-muted-foreground mt-1">
                          Pracownik hotelu odpowiedzialny za współpracę z tą firmą
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <Button onClick={handleSaveEdit} disabled={editLoading}>
                        {editLoading ? "Zapisywanie..." : "Zapisz zmiany"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEditMode(false);
                          setEditName(selectedCompany.name);
                          setEditAddress(selectedCompany.address ?? "");
                          setEditPostalCode(selectedCompany.postalCode ?? "");
                          setEditCity(selectedCompany.city ?? "");
                          setEditCountry(selectedCompany.country);
                          setEditContactPerson(selectedCompany.contactPerson ?? "");
                          setEditContactEmail(selectedCompany.contactEmail ?? "");
                          setEditContactPhone(selectedCompany.contactPhone ?? "");
                          setEditContactPosition(selectedCompany.contactPosition ?? "");
                          setEditPaymentTermDays(selectedCompany.paymentTermDays.toString());
                          setEditCreditLimit(selectedCompany.creditLimit?.toString() ?? "");
                          setEditBillingEmail(selectedCompany.billingEmail ?? "");
                          setEditBillingNotes(selectedCompany.billingNotes ?? "");
                          setEditAccountManagerId(selectedCompany.accountManagerId ?? "");
                        }}
                      >
                        Anuluj
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs text-muted-foreground">Adres</p>
                          <p className="font-medium">{selectedCompany.address ?? "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Kod pocztowy</p>
                          <p className="font-medium">{selectedCompany.postalCode ?? "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Miasto</p>
                          <p className="font-medium">{selectedCompany.city ?? "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Kraj</p>
                          <p className="font-medium">{selectedCompany.country}</p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs text-muted-foreground">Dodano</p>
                          <p className="font-medium">
                            {new Date(selectedCompany.createdAt).toLocaleDateString("pl-PL")}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Ostatnia aktualizacja</p>
                          <p className="font-medium">
                            {new Date(selectedCompany.updatedAt).toLocaleDateString("pl-PL")}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Liczba rezerwacji</p>
                          <p className="font-medium text-lg">{selectedCompany.reservationCount}</p>
                        </div>
                      </div>
                    </div>

                    {/* Osoba kontaktowa */}
                    {(selectedCompany.contactPerson || selectedCompany.contactEmail || selectedCompany.contactPhone) && (
                      <div className="pt-4 border-t">
                        <h4 className="font-medium mb-4">Osoba kontaktowa</h4>
                        <div className="grid md:grid-cols-4 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Imię i nazwisko</p>
                            <p className="font-medium">{selectedCompany.contactPerson ?? "—"}</p>
                          </div>
                          {selectedCompany.contactPosition && (
                            <div>
                              <p className="text-xs text-muted-foreground">Stanowisko</p>
                              <p className="font-medium">{selectedCompany.contactPosition}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-xs text-muted-foreground">E-mail</p>
                            <p className="font-medium">
                              {selectedCompany.contactEmail ? (
                                <a href={`mailto:${selectedCompany.contactEmail}`} className="text-primary hover:underline">
                                  {selectedCompany.contactEmail}
                                </a>
                              ) : "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Telefon</p>
                            <p className="font-medium">
                              {selectedCompany.contactPhone ? (
                                <a href={`tel:${selectedCompany.contactPhone}`} className="text-primary hover:underline">
                                  {selectedCompany.contactPhone}
                                </a>
                              ) : "—"}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Warunki płatności */}
                    <div className="pt-4 border-t">
                      <h4 className="font-medium mb-4">Warunki płatności</h4>
                      <div className="grid md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Termin płatności</p>
                          <p className="font-medium">
                            {selectedCompany.paymentTermDays === 0 
                              ? "Gotówka / przedpłata" 
                              : `${selectedCompany.paymentTermDays} dni`}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Limit kredytowy</p>
                          <p className="font-medium">
                            {selectedCompany.creditLimit !== null 
                              ? `${selectedCompany.creditLimit.toFixed(2)} zł` 
                              : "Bez limitu"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">E-mail do faktur</p>
                          <p className="font-medium">{selectedCompany.billingEmail ?? "—"}</p>
                        </div>
                        {selectedCompany.billingNotes && (
                          <div className="md:col-span-2">
                            <p className="text-xs text-muted-foreground">Uwagi do rozliczeń</p>
                            <p className="font-medium text-sm">{selectedCompany.billingNotes}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Opiekun handlowy */}
                    <div className="pt-4 border-t">
                      <h4 className="font-medium mb-4">Opiekun handlowy</h4>
                      <div>
                        <p className="text-xs text-muted-foreground">Przypisany pracownik</p>
                        {selectedCompany.accountManagerName ? (
                          <p className="font-medium">{selectedCompany.accountManagerName}</p>
                        ) : (
                          <p className="text-muted-foreground">— Brak przypisanego opiekuna —</p>
                        )}
                      </div>
                    </div>

                    {/* Rozrachunki - saldo należności */}
                    <div className="pt-4 border-t">
                      <h4 className="font-medium mb-4">Rozrachunki</h4>
                      {balanceLoading ? (
                        <p className="text-muted-foreground text-sm">Ładowanie danych...</p>
                      ) : companyBalance ? (
                        <div className="space-y-4">
                          {/* Podsumowanie */}
                          <div className="grid md:grid-cols-4 gap-4">
                            <div className="p-3 bg-muted rounded-lg">
                              <p className="text-xs text-muted-foreground">Łączna wartość rezerwacji</p>
                              <p className="text-lg font-bold">{companyBalance.totalRevenue.toFixed(2)} zł</p>
                              <p className="text-xs text-muted-foreground">{companyBalance.totalReservations} rezerwacji</p>
                            </div>
                            <div className="p-3 bg-muted rounded-lg">
                              <p className="text-xs text-muted-foreground">Opłacono</p>
                              <p className="text-lg font-bold text-green-600">{companyBalance.totalPaid.toFixed(2)} zł</p>
                            </div>
                            <div className={`p-3 rounded-lg ${companyBalance.totalOutstanding > 0 ? "bg-red-50 dark:bg-red-950" : "bg-muted"}`}>
                              <p className="text-xs text-muted-foreground">Saldo do zapłaty</p>
                              <p className={`text-lg font-bold ${companyBalance.totalOutstanding > 0 ? "text-red-600" : "text-green-600"}`}>
                                {companyBalance.totalOutstanding.toFixed(2)} zł
                              </p>
                            </div>
                            <div className={`p-3 rounded-lg ${companyBalance.isOverLimit ? "bg-red-50 dark:bg-red-950" : "bg-muted"}`}>
                              <p className="text-xs text-muted-foreground">Limit kredytowy</p>
                              {companyBalance.creditLimit !== null ? (
                                <>
                                  <p className={`text-lg font-bold ${companyBalance.isOverLimit ? "text-red-600" : ""}`}>
                                    {companyBalance.creditAvailable?.toFixed(2)} zł
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    z {companyBalance.creditLimit.toFixed(2)} zł dostępne
                                  </p>
                                  {companyBalance.isOverLimit && (
                                    <p className="text-xs text-red-600 font-medium mt-1">⚠ Przekroczony limit!</p>
                                  )}
                                </>
                              ) : (
                                <p className="text-sm text-muted-foreground">Bez limitu</p>
                              )}
                            </div>
                          </div>

                          {/* Podział wg statusu */}
                          <div className="grid md:grid-cols-4 gap-2 text-sm">
                            <div className="flex justify-between p-2 bg-muted/50 rounded">
                              <span className="text-muted-foreground">Potwierdzone:</span>
                              <span className="font-medium">{companyBalance.confirmedAmount.toFixed(2)} zł</span>
                            </div>
                            <div className="flex justify-between p-2 bg-muted/50 rounded">
                              <span className="text-muted-foreground">Aktywne pobyty:</span>
                              <span className="font-medium">{companyBalance.checkedInAmount.toFixed(2)} zł</span>
                            </div>
                            <div className="flex justify-between p-2 bg-muted/50 rounded">
                              <span className="text-muted-foreground">Zakończone:</span>
                              <span className="font-medium">{companyBalance.checkedOutAmount.toFixed(2)} zł</span>
                            </div>
                            <div className="flex justify-between p-2 bg-muted/50 rounded">
                              <span className="text-muted-foreground">Anulowane:</span>
                              <span className="font-medium">{companyBalance.cancelledAmount.toFixed(2)} zł</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-sm">Brak danych</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Rezerwacje firmy */}
              {!editMode && selectedCompany.reservations.length > 0 && (
                <div className="p-6 border rounded-lg bg-card">
                  <h3 className="font-medium mb-4">Rezerwacje ({selectedCompany.reservationCount})</h3>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium">Nr potwierdzenia</th>
                          <th className="px-4 py-2 text-left font-medium">Gość</th>
                          <th className="px-4 py-2 text-left font-medium">Pokój</th>
                          <th className="px-4 py-2 text-left font-medium">Check-in</th>
                          <th className="px-4 py-2 text-left font-medium">Check-out</th>
                          <th className="px-4 py-2 text-left font-medium">Status</th>
                          <th className="px-4 py-2 text-right font-medium">Kwota</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {selectedCompany.reservations.map((res) => (
                          <tr key={res.id} className="hover:bg-muted/50">
                            <td className="px-4 py-2 font-mono text-xs">
                              {res.confirmationNumber ?? "—"}
                            </td>
                            <td className="px-4 py-2">{res.guestName}</td>
                            <td className="px-4 py-2">{res.roomNumber}</td>
                            <td className="px-4 py-2">
                              {new Date(res.checkIn).toLocaleDateString("pl-PL")}
                            </td>
                            <td className="px-4 py-2">
                              {new Date(res.checkOut).toLocaleDateString("pl-PL")}
                            </td>
                            <td className="px-4 py-2">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                res.status === "CHECKED_IN" ? "bg-green-100 text-green-800" :
                                res.status === "CONFIRMED" ? "bg-blue-100 text-blue-800" :
                                res.status === "CHECKED_OUT" ? "bg-gray-100 text-gray-800" :
                                res.status === "CANCELLED" ? "bg-red-100 text-red-800" :
                                "bg-yellow-100 text-yellow-800"
                              }`}>
                                {res.status}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-right font-medium">
                              {res.totalAmount.toFixed(2)} zł
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Kontrakty korporacyjne */}
              {!editMode && (
                <div className="p-6 border rounded-lg bg-card">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium">
                      Kontrakty korporacyjne ({selectedCompany.contracts.length})
                    </h3>
                    <Button size="sm" onClick={handleShowContractForm}>
                      Dodaj kontrakt
                    </Button>
                  </div>

                  {/* Formularz kontraktu */}
                  {showContractForm && (
                    <div className="mb-6 p-4 border rounded-lg bg-muted/30">
                      <h4 className="font-medium mb-4">
                        {editingContract ? "Edytuj kontrakt" : "Nowy kontrakt"}
                      </h4>

                      {contractError && (
                        <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                          {contractError}
                        </div>
                      )}

                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <Label htmlFor="contractName">Nazwa kontraktu</Label>
                          <Input
                            id="contractName"
                            value={contractName}
                            onChange={(e) => setContractName(e.target.value)}
                            placeholder="np. Kontrakt 2026"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="contractRateCode">Kod cenowy</Label>
                          <select
                            id="contractRateCode"
                            value={contractRateCodeId}
                            onChange={(e) => setContractRateCodeId(e.target.value)}
                            className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                          >
                            <option value="">-- Brak --</option>
                            {rateCodes.map((rc) => (
                              <option key={rc.id} value={rc.id}>
                                {rc.code} - {rc.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <Label htmlFor="contractDiscount">Rabat (%)</Label>
                          <Input
                            id="contractDiscount"
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={contractDiscountPercent}
                            onChange={(e) => setContractDiscountPercent(e.target.value)}
                            placeholder="np. 15"
                            className="mt-1"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Rabat od cen standardowych
                          </p>
                        </div>
                        <div>
                          <Label htmlFor="contractFixedPrice">Stała cena za noc (zł)</Label>
                          <Input
                            id="contractFixedPrice"
                            type="number"
                            min="0"
                            step="0.01"
                            value={contractFixedPrice}
                            onChange={(e) => setContractFixedPrice(e.target.value)}
                            placeholder="np. 180.00"
                            className="mt-1"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Alternatywa dla rabatu procentowego
                          </p>
                        </div>
                        <div>
                          <Label htmlFor="contractValidFrom">Od daty *</Label>
                          <Input
                            id="contractValidFrom"
                            type="date"
                            value={contractValidFrom}
                            onChange={(e) => setContractValidFrom(e.target.value)}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="contractValidTo">Do daty *</Label>
                          <Input
                            id="contractValidTo"
                            type="date"
                            value={contractValidTo}
                            onChange={(e) => setContractValidTo(e.target.value)}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="contractMinNights">Min. noclegów rocznie</Label>
                          <Input
                            id="contractMinNights"
                            type="number"
                            min="0"
                            value={contractMinNights}
                            onChange={(e) => setContractMinNights(e.target.value)}
                            placeholder="np. 100"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="contractPaymentTermDays">Termin płatności (dni)</Label>
                          <Input
                            id="contractPaymentTermDays"
                            type="number"
                            min="0"
                            value={contractPaymentTermDays}
                            onChange={(e) => setContractPaymentTermDays(e.target.value)}
                            placeholder="np. 14"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="contractContactPerson">Osoba kontaktowa</Label>
                          <Input
                            id="contractContactPerson"
                            value={contractContactPerson}
                            onChange={(e) => setContractContactPerson(e.target.value)}
                            placeholder="np. Jan Kowalski"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="contractContactEmail">E-mail kontaktowy</Label>
                          <Input
                            id="contractContactEmail"
                            type="email"
                            value={contractContactEmail}
                            onChange={(e) => setContractContactEmail(e.target.value)}
                            placeholder="np. jan@firma.pl"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="contractContactPhone">Telefon kontaktowy</Label>
                          <Input
                            id="contractContactPhone"
                            value={contractContactPhone}
                            onChange={(e) => setContractContactPhone(e.target.value)}
                            placeholder="np. 600 123 456"
                            className="mt-1"
                          />
                        </div>
                        <div className="flex items-center gap-2 mt-6">
                          <input
                            id="contractIsActive"
                            type="checkbox"
                            checked={contractIsActive}
                            onChange={(e) => setContractIsActive(e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                          />
                          <Label htmlFor="contractIsActive">Kontrakt aktywny</Label>
                        </div>
                      </div>

                      <div className="mt-4">
                        <Label htmlFor="contractNotes">Notatki</Label>
                        <textarea
                          id="contractNotes"
                          value={contractNotes}
                          onChange={(e) => setContractNotes(e.target.value)}
                          placeholder="Dodatkowe uwagi do kontraktu..."
                          rows={2}
                          className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        />
                      </div>

                      <div className="flex gap-3 mt-4">
                        <Button onClick={handleSaveContract} disabled={contractSaving}>
                          {contractSaving ? "Zapisywanie..." : editingContract ? "Zapisz zmiany" : "Dodaj kontrakt"}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setShowContractForm(false);
                            resetContractForm();
                          }}
                        >
                          Anuluj
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Lista kontraktów */}
                  {selectedCompany.contracts.length === 0 && !showContractForm ? (
                    <p className="text-muted-foreground text-sm">
                      Brak kontraktów korporacyjnych. Kliknij "Dodaj kontrakt" aby utworzyć umowę.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {selectedCompany.contracts.map((contract) => {
                        const now = new Date();
                        const isExpired = new Date(contract.validTo) < now;
                        const isNotStarted = new Date(contract.validFrom) > now;
                        const isCurrentlyActive = contract.isActive && !isExpired && !isNotStarted;

                        return (
                          <div
                            key={contract.id}
                            className={`p-4 border rounded-lg ${
                              isCurrentlyActive
                                ? "border-green-200 bg-green-50"
                                : isExpired
                                ? "border-gray-200 bg-gray-50"
                                : "border-yellow-200 bg-yellow-50"
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="font-medium">
                                    {contract.name || "Kontrakt bez nazwy"}
                                  </h4>
                                  {isCurrentlyActive && (
                                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-200 text-green-800">
                                      Aktywny
                                    </span>
                                  )}
                                  {isExpired && (
                                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-600">
                                      Wygasły
                                    </span>
                                  )}
                                  {isNotStarted && (
                                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-200 text-yellow-800">
                                      Przyszły
                                    </span>
                                  )}
                                  {!contract.isActive && (
                                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-200 text-red-800">
                                      Nieaktywny
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {new Date(contract.validFrom).toLocaleDateString("pl-PL")} – {new Date(contract.validTo).toLocaleDateString("pl-PL")}
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditContract(contract)}
                                >
                                  Edytuj
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => handleDeleteContract(contract.id)}
                                >
                                  Usuń
                                </Button>
                              </div>
                            </div>
                            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              {contract.discountPercent !== null && (
                                <div>
                                  <p className="text-xs text-muted-foreground">Rabat</p>
                                  <p className="font-medium">{contract.discountPercent}%</p>
                                </div>
                              )}
                              {contract.fixedPricePerNight !== null && (
                                <div>
                                  <p className="text-xs text-muted-foreground">Stała cena/noc</p>
                                  <p className="font-medium">{contract.fixedPricePerNight.toFixed(2)} zł</p>
                                </div>
                              )}
                              {contract.rateCode && (
                                <div>
                                  <p className="text-xs text-muted-foreground">Kod cenowy</p>
                                  <p className="font-medium">{contract.rateCode.code}</p>
                                </div>
                              )}
                              <div>
                                <p className="text-xs text-muted-foreground">Termin płatności</p>
                                <p className="font-medium">{contract.paymentTermDays} dni</p>
                              </div>
                              {contract.minNightsPerYear !== null && (
                                <div>
                                  <p className="text-xs text-muted-foreground">Min. noclegów/rok</p>
                                  <p className="font-medium">{contract.minNightsPerYear}</p>
                                </div>
                              )}
                              {contract.contactPerson && (
                                <div>
                                  <p className="text-xs text-muted-foreground">Kontakt</p>
                                  <p className="font-medium">{contract.contactPerson}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Faktury zbiorcze */}
              {!editMode && (
                <div className="p-6 border rounded-lg bg-card">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium">Faktury zbiorcze</h3>
                    <Button
                      size="sm"
                      onClick={() => {
                        setShowInvoiceForm(!showInvoiceForm);
                        if (!showInvoiceForm) {
                          loadReservationsForInvoice();
                        }
                      }}
                    >
                      {showInvoiceForm ? "Anuluj" : "Nowa faktura zbiorcza"}
                    </Button>
                  </div>

                  {/* Formularz tworzenia faktury */}
                  {showInvoiceForm && (
                    <div className="mb-6 p-4 bg-muted rounded-lg">
                      <h4 className="font-medium mb-3">Wybierz rezerwacje do faktury</h4>
                      {invoiceReservationsLoading ? (
                        <p className="text-sm text-muted-foreground">Ładowanie rezerwacji...</p>
                      ) : invoiceReservations.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Brak rezerwacji do fakturowania</p>
                      ) : (
                        <>
                          <div className="border rounded-lg overflow-hidden mb-4 bg-background">
                            <table className="w-full text-sm">
                              <thead className="bg-muted">
                                <tr>
                                  <th className="px-3 py-2 text-left w-10">
                                    <input
                                      type="checkbox"
                                      checked={
                                        invoiceReservations.filter((r) => !r.hasInvoice).length > 0 &&
                                        invoiceReservations
                                          .filter((r) => !r.hasInvoice)
                                          .every((r) => selectedForInvoice.has(r.id))
                                      }
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setSelectedForInvoice(
                                            new Set(invoiceReservations.filter((r) => !r.hasInvoice).map((r) => r.id))
                                          );
                                        } else {
                                          setSelectedForInvoice(new Set());
                                        }
                                      }}
                                    />
                                  </th>
                                  <th className="px-3 py-2 text-left font-medium">Nr</th>
                                  <th className="px-3 py-2 text-left font-medium">Gość</th>
                                  <th className="px-3 py-2 text-left font-medium">Pokój</th>
                                  <th className="px-3 py-2 text-left font-medium">Daty</th>
                                  <th className="px-3 py-2 text-right font-medium">Kwota</th>
                                  <th className="px-3 py-2 text-center font-medium">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y">
                                {invoiceReservations.map((res) => (
                                  <tr
                                    key={res.id}
                                    className={`hover:bg-muted/50 ${res.hasInvoice ? "opacity-50" : ""}`}
                                  >
                                    <td className="px-3 py-2">
                                      <input
                                        type="checkbox"
                                        checked={selectedForInvoice.has(res.id)}
                                        disabled={res.hasInvoice}
                                        onChange={(e) => {
                                          const newSet = new Set(selectedForInvoice);
                                          if (e.target.checked) {
                                            newSet.add(res.id);
                                          } else {
                                            newSet.delete(res.id);
                                          }
                                          setSelectedForInvoice(newSet);
                                        }}
                                      />
                                    </td>
                                    <td className="px-3 py-2 font-mono text-xs">
                                      {res.confirmationNumber ?? "—"}
                                    </td>
                                    <td className="px-3 py-2">{res.guestName}</td>
                                    <td className="px-3 py-2">{res.roomNumber}</td>
                                    <td className="px-3 py-2 text-xs">
                                      {new Date(res.checkIn).toLocaleDateString("pl-PL")} -{" "}
                                      {new Date(res.checkOut).toLocaleDateString("pl-PL")}
                                      <span className="text-muted-foreground ml-1">({res.nights} nocy)</span>
                                    </td>
                                    <td className="px-3 py-2 text-right font-medium">
                                      {res.totalAmount.toFixed(2)} zł
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                      {res.hasInvoice ? (
                                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                                          Zafakturowano
                                        </span>
                                      ) : (
                                        <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded">
                                          Do faktury
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="text-sm">
                              Wybrano: <strong>{selectedForInvoice.size}</strong> rezerwacji,{" "}
                              suma:{" "}
                              <strong>
                                {invoiceReservations
                                  .filter((r) => selectedForInvoice.has(r.id))
                                  .reduce((sum, r) => sum + r.totalAmount, 0)
                                  .toFixed(2)}{" "}
                                zł
                              </strong>
                            </p>
                            <Button
                              onClick={handleCreateConsolidatedInvoice}
                              disabled={invoiceCreating || selectedForInvoice.size === 0}
                            >
                              {invoiceCreating ? "Tworzenie..." : "Wystaw fakturę zbiorczą"}
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Lista istniejących faktur */}
                  {consolidatedInvoicesLoading ? (
                    <p className="text-sm text-muted-foreground">Ładowanie faktur...</p>
                  ) : consolidatedInvoices.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Brak faktur zbiorczych</p>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium">Nr faktury</th>
                            <th className="px-3 py-2 text-left font-medium">Okres</th>
                            <th className="px-3 py-2 text-center font-medium">Pozycje</th>
                            <th className="px-3 py-2 text-right font-medium">Kwota brutto</th>
                            <th className="px-3 py-2 text-center font-medium">Termin</th>
                            <th className="px-3 py-2 text-center font-medium">Status</th>
                            <th className="px-3 py-2 text-right font-medium">Akcje</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {consolidatedInvoices.map((inv) => {
                            const isOverdue = inv.status === "ISSUED" && new Date(inv.dueDate) < new Date();
                            return (
                              <tr key={inv.id} className="hover:bg-muted/50">
                                <td className="px-3 py-2 font-mono text-xs">{inv.number}</td>
                                <td className="px-3 py-2 text-xs">
                                  {new Date(inv.periodFrom).toLocaleDateString("pl-PL")} -{" "}
                                  {new Date(inv.periodTo).toLocaleDateString("pl-PL")}
                                </td>
                                <td className="px-3 py-2 text-center">{inv.itemsCount}</td>
                                <td className="px-3 py-2 text-right font-medium">
                                  {inv.amountGross.toFixed(2)} zł
                                </td>
                                <td className="px-3 py-2 text-center text-xs">
                                  {new Date(inv.dueDate).toLocaleDateString("pl-PL")}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  {inv.status === "PAID" ? (
                                    <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded">
                                      Opłacona
                                    </span>
                                  ) : isOverdue ? (
                                    <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded">
                                      Przeterminowana
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-xs rounded">
                                      Wystawiona
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {inv.status !== "PAID" && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleMarkInvoicePaid(inv.id)}
                                    >
                                      Oznacz jako opłaconą
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Usuwanie firmy */}
              {!editMode && (
                <div className="p-6 border border-red-200 rounded-lg bg-red-50">
                  <h3 className="font-medium text-red-800 mb-2">Usuń firmę</h3>
                  <p className="text-sm text-red-700 mb-4">
                    Firma może zostać usunięta tylko jeśli nie ma powiązanych rezerwacji.
                  </p>
                  {!deleteConfirm ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeleteConfirm(true)}
                      disabled={selectedCompany.reservationCount > 0}
                    >
                      Usuń firmę
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleDelete}
                        disabled={deleteLoading}
                      >
                        {deleteLoading ? "Usuwanie..." : "Potwierdź usunięcie"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeleteConfirm(false)}
                      >
                        Anuluj
                      </Button>
                    </div>
                  )}
                  {selectedCompany.reservationCount > 0 && (
                    <p className="text-xs text-red-600 mt-2">
                      Nie można usunąć – firma ma {selectedCompany.reservationCount} powiązanych rezerwacji.
                    </p>
                  )}
                </div>
              )}
            </>
          ) : (
            <p className="text-muted-foreground">Wybierz firmę z listy.</p>
          )}
        </div>
      )}

      {/* === ZAKŁADKA: STATYSTYKI === */}
      {tab === "statystyki" && (
        <div className="space-y-6">
          {statsLoading ? (
            <p className="text-sm text-muted-foreground">Ładowanie statystyk...</p>
          ) : stats ? (
            <>
              {/* Karty statystyk */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-6 border rounded-lg bg-card">
                  <p className="text-sm text-muted-foreground mb-1">Wszystkie firmy</p>
                  <p className="text-3xl font-bold">{stats.totalCompanies}</p>
                </div>
                <div className="p-6 border rounded-lg bg-card">
                  <p className="text-sm text-muted-foreground mb-1">Z rezerwacjami</p>
                  <p className="text-3xl font-bold">{stats.companiesWithReservations}</p>
                </div>
              </div>

              {/* Top firmy */}
              <div className="p-6 border rounded-lg bg-card">
                <h3 className="font-medium mb-4">Top 5 firm wg liczby rezerwacji</h3>
                {stats.topCompaniesByReservations.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Brak danych</p>
                ) : (
                  <div className="space-y-3">
                    {stats.topCompaniesByReservations.map((c, idx) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted"
                        onClick={() => handleOpenDetails(c.id)}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-bold text-muted-foreground w-6">
                            {idx + 1}.
                          </span>
                          <div>
                            <p className="font-medium">{c.name}</p>
                            <p className="text-xs text-muted-foreground font-mono">
                              NIP: {formatNip(c.nip)}
                            </p>
                          </div>
                        </div>
                        <span className="text-lg font-bold text-primary">
                          {c.reservationCount} rez.
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Ostatnio dodane */}
              <div className="p-6 border rounded-lg bg-card">
                <h3 className="font-medium mb-4">Ostatnio dodane firmy</h3>
                {stats.recentlyAdded.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Brak danych</p>
                ) : (
                  <div className="space-y-2">
                    {stats.recentlyAdded.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted"
                        onClick={() => handleOpenDetails(c.id)}
                      >
                        <div>
                          <p className="font-medium">{c.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">
                            NIP: {formatNip(c.nip)}
                          </p>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {new Date(c.createdAt).toLocaleDateString("pl-PL")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">Nie udało się załadować statystyk.</p>
          )}
        </div>
      )}
    </div>
  );
}
