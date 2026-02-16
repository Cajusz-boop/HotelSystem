"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getAllTravelAgents,
  getTravelAgentById,
  createTravelAgent,
  updateTravelAgent,
  deleteTravelAgent,
  getTravelAgentStats,
  getTravelAgentBalance,
  type TravelAgentForList,
  type TravelAgentDetails,
  type TravelAgentBalance,
} from "@/app/actions/travel-agents";
import { getRateCodes } from "@/app/actions/companies";

type Tab = "lista" | "dodaj" | "szczegoly" | "statystyki";

export default function BiuraPodrozyPage() {
  // Aktywna zakładka
  const [tab, setTab] = useState<Tab>("lista");

  // === LISTA AGENTÓW ===
  const [agents, setAgents] = useState<TravelAgentForList[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<"name" | "code" | "commissionPercent" | "reservationCount" | "createdAt">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [activeOnly, setActiveOnly] = useState(false);
  const pageSize = 20;

  // === DODAWANIE AGENTA ===
  const [addCode, setAddCode] = useState("");
  const [addName, setAddName] = useState("");
  const [addNip, setAddNip] = useState("");
  const [addAddress, setAddAddress] = useState("");
  const [addPostalCode, setAddPostalCode] = useState("");
  const [addCity, setAddCity] = useState("");
  const [addCountry, setAddCountry] = useState("POL");
  const [addContactPerson, setAddContactPerson] = useState("");
  const [addContactEmail, setAddContactEmail] = useState("");
  const [addContactPhone, setAddContactPhone] = useState("");
  const [addWebsite, setAddWebsite] = useState("");
  const [addCommissionPercent, setAddCommissionPercent] = useState("10");
  const [addCommissionType, setAddCommissionType] = useState<"NET" | "GROSS">("NET");
  const [addPaymentTermDays, setAddPaymentTermDays] = useState("14");
  const [addCreditLimit, setAddCreditLimit] = useState("");
  const [addRateCodeId, setAddRateCodeId] = useState("");
  const [addUseNetRates, setAddUseNetRates] = useState(true);
  const [addDiscountPercent, setAddDiscountPercent] = useState("");
  const [addIataNumber, setAddIataNumber] = useState("");
  const [addLicenseNumber, setAddLicenseNumber] = useState("");
  const [addNotes, setAddNotes] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);

  // === SZCZEGÓŁY AGENTA ===
  const [selectedAgent, setSelectedAgent] = useState<TravelAgentDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editCode, setEditCode] = useState("");
  const [editName, setEditName] = useState("");
  const [editNip, setEditNip] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editPostalCode, setEditPostalCode] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editCountry, setEditCountry] = useState("");
  const [editContactPerson, setEditContactPerson] = useState("");
  const [editContactEmail, setEditContactEmail] = useState("");
  const [editContactPhone, setEditContactPhone] = useState("");
  const [editWebsite, setEditWebsite] = useState("");
  const [editCommissionPercent, setEditCommissionPercent] = useState("");
  const [editCommissionType, setEditCommissionType] = useState<"NET" | "GROSS">("NET");
  const [editPaymentTermDays, setEditPaymentTermDays] = useState("14");
  const [editCreditLimit, setEditCreditLimit] = useState("");
  const [editRateCodeId, setEditRateCodeId] = useState("");
  const [editUseNetRates, setEditUseNetRates] = useState(true);
  const [editDiscountPercent, setEditDiscountPercent] = useState("");
  const [editIataNumber, setEditIataNumber] = useState("");
  const [editLicenseNumber, setEditLicenseNumber] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editIsActive, setEditIsActive] = useState(true);
  const [editLoading, setEditLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // === ROZRACHUNKI ===
  const [agentBalance, setAgentBalance] = useState<TravelAgentBalance | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  // === RATE CODES ===
  const [rateCodes, setRateCodes] = useState<Array<{ id: string; code: string; name: string; price: number | null }>>([]);
  const [rateCodesLoaded, setRateCodesLoaded] = useState(false);

  // === STATYSTYKI ===
  const [stats, setStats] = useState<{
    totalAgents: number;
    activeAgents: number;
    agentsWithReservations: number;
    topAgentsByReservations: Array<{
      id: string;
      code: string;
      name: string;
      reservationCount: number;
      totalCommission: number;
    }>;
    recentlyAdded: Array<{ id: string; code: string; name: string; createdAt: Date }>;
  } | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // === ŁADOWANIE DANYCH ===

  const loadAgents = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await getAllTravelAgents({
      query,
      limit: pageSize,
      offset: (page - 1) * pageSize,
      sortBy,
      sortOrder,
      activeOnly,
    });
    setLoading(false);
    if (res.success && res.data) {
      setAgents(res.data.agents);
      setTotal(res.data.total);
    } else {
      setError(res.error ?? "Błąd ładowania");
    }
  }, [query, page, sortBy, sortOrder, activeOnly]);

  const loadRateCodes = useCallback(async () => {
    if (rateCodesLoaded) return;
    const res = await getRateCodes();
    if (res.success) {
      setRateCodes(res.data);
      setRateCodesLoaded(true);
    }
  }, [rateCodesLoaded]);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    const res = await getTravelAgentStats();
    setStatsLoading(false);
    if (res.success && res.data) {
      setStats(res.data);
    }
  }, []);

  useEffect(() => {
    if (tab === "lista") {
      loadAgents();
    } else if (tab === "statystyki") {
      loadStats();
    } else if (tab === "dodaj" || tab === "szczegoly") {
      loadRateCodes();
    }
  }, [tab, loadAgents, loadStats, loadRateCodes]);

  // Debounce search
  useEffect(() => {
    if (tab !== "lista") return;
    const timer = setTimeout(() => {
      setPage(1);
      loadAgents();
    }, 300);
    return () => clearTimeout(timer);
  }, [query, sortBy, sortOrder, activeOnly, tab, loadAgents]);

  // === TWORZENIE AGENTA ===

  const resetAddForm = () => {
    setAddCode("");
    setAddName("");
    setAddNip("");
    setAddAddress("");
    setAddPostalCode("");
    setAddCity("");
    setAddCountry("POL");
    setAddContactPerson("");
    setAddContactEmail("");
    setAddContactPhone("");
    setAddWebsite("");
    setAddCommissionPercent("10");
    setAddCommissionType("NET");
    setAddPaymentTermDays("14");
    setAddCreditLimit("");
    setAddRateCodeId("");
    setAddUseNetRates(true);
    setAddDiscountPercent("");
    setAddIataNumber("");
    setAddLicenseNumber("");
    setAddNotes("");
    setAddError(null);
    setAddSuccess(null);
  };

  const handleSaveAgent = async () => {
    setAddError(null);
    setAddSuccess(null);

    if (!addCode.trim()) {
      setAddError("Kod agenta jest wymagany");
      return;
    }
    if (!addName.trim()) {
      setAddError("Nazwa biura jest wymagana");
      return;
    }

    setSaveLoading(true);
    const res = await createTravelAgent({
      code: addCode,
      name: addName,
      nip: addNip || null,
      address: addAddress || null,
      postalCode: addPostalCode || null,
      city: addCity || null,
      country: addCountry || "POL",
      contactPerson: addContactPerson || null,
      contactEmail: addContactEmail || null,
      contactPhone: addContactPhone || null,
      website: addWebsite || null,
      commissionPercent: parseFloat(addCommissionPercent) || 10,
      commissionType: addCommissionType,
      paymentTermDays: parseInt(addPaymentTermDays, 10) || 14,
      creditLimit: addCreditLimit ? parseFloat(addCreditLimit) : null,
      rateCodeId: addRateCodeId || null,
      useNetRates: addUseNetRates,
      discountPercent: addDiscountPercent ? parseFloat(addDiscountPercent) : null,
      iataNumber: addIataNumber || null,
      licenseNumber: addLicenseNumber || null,
      notes: addNotes || null,
    });
    setSaveLoading(false);

    if (res.success) {
      setAddSuccess(`Biuro podróży "${addName}" zostało dodane.`);
      resetAddForm();
      loadAgents();
    } else {
      setAddError(res.error ?? "Błąd zapisu");
    }
  };

  // === SZCZEGÓŁY AGENTA ===

  const handleOpenDetails = async (agentId: string) => {
    setDetailsLoading(true);
    setSelectedAgent(null);
    setEditMode(false);
    setDeleteConfirm(false);
    setTab("szczegoly");
    loadRateCodes();

    const res = await getTravelAgentById(agentId);
    setDetailsLoading(false);

    if (res.success && res.data) {
      const agent = res.data;
      setSelectedAgent(agent);
      setEditCode(agent.code);
      setEditName(agent.name);
      setEditNip(agent.nip ?? "");
      setEditAddress(agent.address ?? "");
      setEditPostalCode(agent.postalCode ?? "");
      setEditCity(agent.city ?? "");
      setEditCountry(agent.country);
      setEditContactPerson(agent.contactPerson ?? "");
      setEditContactEmail(agent.contactEmail ?? "");
      setEditContactPhone(agent.contactPhone ?? "");
      setEditWebsite(agent.website ?? "");
      setEditCommissionPercent(agent.commissionPercent.toString());
      setEditCommissionType(agent.commissionType as "NET" | "GROSS");
      setEditPaymentTermDays(agent.paymentTermDays.toString());
      setEditCreditLimit(agent.creditLimit?.toString() ?? "");
      setEditRateCodeId(agent.rateCodeId ?? "");
      setEditUseNetRates(agent.useNetRates);
      setEditDiscountPercent(agent.discountPercent?.toString() ?? "");
      setEditIataNumber(agent.iataNumber ?? "");
      setEditLicenseNumber(agent.licenseNumber ?? "");
      setEditNotes(agent.notes ?? "");
      setEditIsActive(agent.isActive);

      // Załaduj rozrachunki
      setBalanceLoading(true);
      setAgentBalance(null);
      const balanceRes = await getTravelAgentBalance(agentId);
      setBalanceLoading(false);
      if (balanceRes.success && balanceRes.data) {
        setAgentBalance(balanceRes.data);
      }
    } else {
      setError(res.error ?? "Błąd ładowania");
      setTab("lista");
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedAgent) return;
    if (!editCode.trim()) {
      setError("Kod agenta jest wymagany");
      return;
    }
    if (!editName.trim()) {
      setError("Nazwa biura jest wymagana");
      return;
    }

    setEditLoading(true);
    setError(null);

    const res = await updateTravelAgent(selectedAgent.id, {
      code: editCode,
      name: editName,
      nip: editNip || null,
      address: editAddress || null,
      postalCode: editPostalCode || null,
      city: editCity || null,
      country: editCountry || "POL",
      contactPerson: editContactPerson || null,
      contactEmail: editContactEmail || null,
      contactPhone: editContactPhone || null,
      website: editWebsite || null,
      commissionPercent: parseFloat(editCommissionPercent) || 10,
      commissionType: editCommissionType,
      paymentTermDays: parseInt(editPaymentTermDays, 10) || 14,
      creditLimit: editCreditLimit ? parseFloat(editCreditLimit) : null,
      rateCodeId: editRateCodeId || null,
      useNetRates: editUseNetRates,
      discountPercent: editDiscountPercent ? parseFloat(editDiscountPercent) : null,
      iataNumber: editIataNumber || null,
      licenseNumber: editLicenseNumber || null,
      notes: editNotes || null,
      isActive: editIsActive,
    });

    setEditLoading(false);

    if (res.success) {
      setEditMode(false);
      handleOpenDetails(selectedAgent.id);
    } else {
      setError(res.error ?? "Błąd zapisu");
    }
  };

  const handleDelete = async () => {
    if (!selectedAgent) return;
    setDeleteLoading(true);
    const res = await deleteTravelAgent(selectedAgent.id);
    setDeleteLoading(false);

    if (res.success) {
      setTab("lista");
      loadAgents();
    } else {
      setError(res.error ?? "Błąd usuwania");
    }
  };

  // === POMOCNICZE ===

  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
    setPage(1);
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Biura Podróży / Agenci</h1>
        <Link href="/">
          <Button variant="outline">Powrót</Button>
        </Link>
      </div>

      {/* Zakładki */}
      <div className="flex gap-2 mb-6 border-b pb-2">
        <Button
          variant={tab === "lista" ? "default" : "ghost"}
          onClick={() => setTab("lista")}
        >
          Lista agentów
        </Button>
        <Button
          variant={tab === "dodaj" ? "default" : "ghost"}
          onClick={() => {
            resetAddForm();
            setTab("dodaj");
          }}
        >
          Dodaj agenta
        </Button>
        <Button
          variant={tab === "statystyki" ? "default" : "ghost"}
          onClick={() => setTab("statystyki")}
        >
          Statystyki
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* LISTA AGENTÓW */}
      {tab === "lista" && (
        <div className="space-y-4">
          <div className="flex gap-4 items-center">
            <Input
              placeholder="Szukaj (kod, nazwa, miasto, IATA)..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="max-w-sm"
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={activeOnly}
                onChange={(e) => setActiveOnly(e.target.checked)}
              />
              Tylko aktywni
            </label>
            <span className="text-sm text-muted-foreground">
              {total} agentów
            </span>
          </div>

          {loading ? (
            <p className="text-muted-foreground">Ładowanie...</p>
          ) : agents.length === 0 ? (
            <p className="text-muted-foreground">Brak agentów.</p>
          ) : (
            <>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th
                        className="px-4 py-2 text-left font-medium cursor-pointer hover:bg-muted/80"
                        onClick={() => handleSort("code")}
                      >
                        Kod {sortBy === "code" && (sortOrder === "asc" ? "↑" : "↓")}
                      </th>
                      <th
                        className="px-4 py-2 text-left font-medium cursor-pointer hover:bg-muted/80"
                        onClick={() => handleSort("name")}
                      >
                        Nazwa {sortBy === "name" && (sortOrder === "asc" ? "↑" : "↓")}
                      </th>
                      <th className="px-4 py-2 text-left font-medium">Miasto</th>
                      <th
                        className="px-4 py-2 text-right font-medium cursor-pointer hover:bg-muted/80"
                        onClick={() => handleSort("commissionPercent")}
                      >
                        Prowizja {sortBy === "commissionPercent" && (sortOrder === "asc" ? "↑" : "↓")}
                      </th>
                      <th
                        className="px-4 py-2 text-right font-medium cursor-pointer hover:bg-muted/80"
                        onClick={() => handleSort("reservationCount")}
                      >
                        Rezerwacje {sortBy === "reservationCount" && (sortOrder === "asc" ? "↑" : "↓")}
                      </th>
                      <th className="px-4 py-2 text-center font-medium">Status</th>
                      <th className="px-4 py-2 text-right font-medium">Akcje</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {agents.map((agent) => (
                      <tr key={agent.id} className="hover:bg-muted/50">
                        <td className="px-4 py-2 font-mono">{agent.code}</td>
                        <td className="px-4 py-2 font-medium">{agent.name}</td>
                        <td className="px-4 py-2">{agent.city ?? "—"}</td>
                        <td className="px-4 py-2 text-right">
                          {agent.commissionPercent}% ({agent.commissionType})
                        </td>
                        <td className="px-4 py-2 text-right">{agent.reservationCount}</td>
                        <td className="px-4 py-2 text-center">
                          {agent.isActive ? (
                            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                              Aktywny
                            </span>
                          ) : (
                            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                              Nieaktywny
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenDetails(agent.id)}
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
                <div className="flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                  >
                    Poprzednia
                  </Button>
                  <span className="text-sm">
                    Strona {page} z {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === totalPages}
                    onClick={() => setPage(page + 1)}
                  >
                    Następna
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* DODAJ AGENTA */}
      {tab === "dodaj" && (
        <div className="max-w-2xl space-y-6">
          {addSuccess && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
              {addSuccess}
            </div>
          )}
          {addError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {addError}
            </div>
          )}

          <div className="p-6 border rounded-lg bg-card space-y-6">
            <h2 className="text-lg font-semibold">Nowe biuro podróży / agent</h2>

            {/* Podstawowe dane */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="addCode">Kod agenta *</Label>
                <Input
                  id="addCode"
                  value={addCode}
                  onChange={(e) => setAddCode(e.target.value.toUpperCase())}
                  placeholder="np. ITAKA, TUI001"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="addName">Nazwa biura *</Label>
                <Input
                  id="addName"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="np. Itaka Sp. z o.o."
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="addNip">NIP</Label>
                <Input
                  id="addNip"
                  value={addNip}
                  onChange={(e) => setAddNip(e.target.value)}
                  placeholder="np. 1234567890"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="addCity">Miasto</Label>
                <Input
                  id="addCity"
                  value={addCity}
                  onChange={(e) => setAddCity(e.target.value)}
                  placeholder="np. Warszawa"
                  className="mt-1"
                />
              </div>
            </div>

            {/* Warunki finansowe */}
            <div className="pt-4 border-t">
              <h3 className="font-medium mb-4">Warunki finansowe</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="addCommissionPercent">Prowizja (%)</Label>
                  <Input
                    id="addCommissionPercent"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={addCommissionPercent}
                    onChange={(e) => setAddCommissionPercent(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="addCommissionType">Typ prowizji</Label>
                  <select
                    id="addCommissionType"
                    value={addCommissionType}
                    onChange={(e) => setAddCommissionType(e.target.value as "NET" | "GROSS")}
                    className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                  >
                    <option value="NET">NET (od ceny netto)</option>
                    <option value="GROSS">GROSS (od ceny brutto)</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="addPaymentTermDays">Termin płatności (dni)</Label>
                  <select
                    id="addPaymentTermDays"
                    value={addPaymentTermDays}
                    onChange={(e) => setAddPaymentTermDays(e.target.value)}
                    className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                  >
                    <option value="0">Gotówka / przedpłata</option>
                    <option value="7">7 dni</option>
                    <option value="14">14 dni</option>
                    <option value="30">30 dni</option>
                    <option value="60">60 dni</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="addCreditLimit">Limit kredytowy (zł)</Label>
                  <Input
                    id="addCreditLimit"
                    type="number"
                    min="0"
                    step="0.01"
                    value={addCreditLimit}
                    onChange={(e) => setAddCreditLimit(e.target.value)}
                    placeholder="np. 50000"
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            {/* Agent Rates */}
            <div className="pt-4 border-t">
              <h3 className="font-medium mb-4">Stawki agencyjne (Agent Rates)</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="addRateCodeId">Kod cenowy</Label>
                  <select
                    id="addRateCodeId"
                    value={addRateCodeId}
                    onChange={(e) => setAddRateCodeId(e.target.value)}
                    className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                  >
                    <option value="">— Brak —</option>
                    {rateCodes.map((rc) => (
                      <option key={rc.id} value={rc.id}>
                        {rc.code} - {rc.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="addDiscountPercent">Dodatkowy rabat (%)</Label>
                  <Input
                    id="addDiscountPercent"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={addDiscountPercent}
                    onChange={(e) => setAddDiscountPercent(e.target.value)}
                    placeholder="np. 5"
                    className="mt-1"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 mt-4">
                <input
                  type="checkbox"
                  checked={addUseNetRates}
                  onChange={(e) => setAddUseNetRates(e.target.checked)}
                />
                <span className="text-sm">Pokazuj ceny netto (bez marży)</span>
              </label>
            </div>

            {/* Identyfikatory */}
            <div className="pt-4 border-t">
              <h3 className="font-medium mb-4">Identyfikatory branżowe</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="addIataNumber">Numer IATA</Label>
                  <Input
                    id="addIataNumber"
                    value={addIataNumber}
                    onChange={(e) => setAddIataNumber(e.target.value)}
                    placeholder="np. 12345678"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="addLicenseNumber">Nr licencji</Label>
                  <Input
                    id="addLicenseNumber"
                    value={addLicenseNumber}
                    onChange={(e) => setAddLicenseNumber(e.target.value)}
                    placeholder="np. TP/123/2025"
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            {/* Kontakt */}
            <div className="pt-4 border-t">
              <h3 className="font-medium mb-4">Kontakt</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="addContactPerson">Osoba kontaktowa</Label>
                  <Input
                    id="addContactPerson"
                    value={addContactPerson}
                    onChange={(e) => setAddContactPerson(e.target.value)}
                    placeholder="np. Jan Kowalski"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="addContactEmail">E-mail</Label>
                  <Input
                    id="addContactEmail"
                    type="email"
                    value={addContactEmail}
                    onChange={(e) => setAddContactEmail(e.target.value)}
                    placeholder="np. kontakt@biuro.pl"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="addContactPhone">Telefon</Label>
                  <Input
                    id="addContactPhone"
                    value={addContactPhone}
                    onChange={(e) => setAddContactPhone(e.target.value)}
                    placeholder="np. 600 123 456"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="addWebsite">Strona www</Label>
                  <Input
                    id="addWebsite"
                    value={addWebsite}
                    onChange={(e) => setAddWebsite(e.target.value)}
                    placeholder="np. https://biuro.pl"
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button onClick={handleSaveAgent} disabled={saveLoading}>
                {saveLoading ? "Zapisywanie..." : "Dodaj agenta"}
              </Button>
              <Button variant="outline" onClick={() => setTab("lista")}>
                Anuluj
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* SZCZEGÓŁY AGENTA */}
      {tab === "szczegoly" && (
        <div className="space-y-6">
          {detailsLoading ? (
            <p className="text-muted-foreground">Ładowanie...</p>
          ) : selectedAgent ? (
            <>
              {/* Nagłówek */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">{selectedAgent.name}</h2>
                  <p className="text-muted-foreground">
                    Kod: {selectedAgent.code}
                    {selectedAgent.iataNumber && ` | IATA: ${selectedAgent.iataNumber}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  {!editMode && (
                    <>
                      <Button onClick={() => setEditMode(true)}>Edytuj</Button>
                      <Button
                        variant="outline"
                        onClick={() => setTab("lista")}
                      >
                        Powrót do listy
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Dane */}
              <div className="p-6 border rounded-lg bg-card">
                {editMode ? (
                  <div className="space-y-6">
                    {/* Formularz edycji */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="editCode">Kod agenta *</Label>
                        <Input
                          id="editCode"
                          value={editCode}
                          onChange={(e) => setEditCode(e.target.value.toUpperCase())}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="editName">Nazwa biura *</Label>
                        <Input
                          id="editName"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                    </div>

                    {/* Warunki finansowe */}
                    <div className="pt-4 border-t">
                      <h3 className="font-medium mb-4">Warunki finansowe</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="editCommissionPercent">Prowizja (%)</Label>
                          <Input
                            id="editCommissionPercent"
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={editCommissionPercent}
                            onChange={(e) => setEditCommissionPercent(e.target.value)}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="editCommissionType">Typ prowizji</Label>
                          <select
                            id="editCommissionType"
                            value={editCommissionType}
                            onChange={(e) => setEditCommissionType(e.target.value as "NET" | "GROSS")}
                            className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                          >
                            <option value="NET">NET</option>
                            <option value="GROSS">GROSS</option>
                          </select>
                        </div>
                        <div>
                          <Label htmlFor="editPaymentTermDays">Termin płatności</Label>
                          <select
                            id="editPaymentTermDays"
                            value={editPaymentTermDays}
                            onChange={(e) => setEditPaymentTermDays(e.target.value)}
                            className="mt-1 flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                          >
                            <option value="0">Gotówka</option>
                            <option value="7">7 dni</option>
                            <option value="14">14 dni</option>
                            <option value="30">30 dni</option>
                            <option value="60">60 dni</option>
                          </select>
                        </div>
                        <div>
                          <Label htmlFor="editCreditLimit">Limit kredytowy (zł)</Label>
                          <Input
                            id="editCreditLimit"
                            type="number"
                            min="0"
                            value={editCreditLimit}
                            onChange={(e) => setEditCreditLimit(e.target.value)}
                            className="mt-1"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Status */}
                    <div className="pt-4 border-t">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={editIsActive}
                          onChange={(e) => setEditIsActive(e.target.checked)}
                        />
                        <span>Agent aktywny</span>
                      </label>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <Button onClick={handleSaveEdit} disabled={editLoading}>
                        {editLoading ? "Zapisywanie..." : "Zapisz zmiany"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEditMode(false);
                          if (selectedAgent) {
                            setEditCode(selectedAgent.code);
                            setEditName(selectedAgent.name);
                            setEditCommissionPercent(selectedAgent.commissionPercent.toString());
                            setEditCommissionType(selectedAgent.commissionType as "NET" | "GROSS");
                          }
                        }}
                      >
                        Anuluj
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Widok danych */}
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs text-muted-foreground">Miasto</p>
                          <p className="font-medium">{selectedAgent.city ?? "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">NIP</p>
                          <p className="font-medium">{selectedAgent.nip ?? "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Strona www</p>
                          <p className="font-medium">
                            {selectedAgent.website ? (
                              <a href={selectedAgent.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                {selectedAgent.website}
                              </a>
                            ) : "—"}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs text-muted-foreground">Rezerwacje</p>
                          <p className="font-medium">{selectedAgent.reservationCount}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Utworzono</p>
                          <p className="font-medium">
                            {new Date(selectedAgent.createdAt).toLocaleDateString("pl-PL")}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Status</p>
                          <p className="font-medium">
                            {selectedAgent.isActive ? (
                              <span className="text-green-600">Aktywny</span>
                            ) : (
                              <span className="text-gray-500">Nieaktywny</span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Warunki finansowe */}
                    <div className="pt-4 border-t">
                      <h4 className="font-medium mb-4">Warunki finansowe</h4>
                      <div className="grid md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Prowizja</p>
                          <p className="font-medium text-lg">
                            {selectedAgent.commissionPercent}% ({selectedAgent.commissionType})
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Termin płatności</p>
                          <p className="font-medium">
                            {selectedAgent.paymentTermDays === 0
                              ? "Gotówka"
                              : `${selectedAgent.paymentTermDays} dni`}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Limit kredytowy</p>
                          <p className="font-medium">
                            {selectedAgent.creditLimit !== null
                              ? `${selectedAgent.creditLimit.toFixed(2)} zł`
                              : "Bez limitu"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Dodatkowy rabat</p>
                          <p className="font-medium">
                            {selectedAgent.discountPercent !== null
                              ? `${selectedAgent.discountPercent}%`
                              : "—"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Rozrachunki */}
                    <div className="pt-4 border-t">
                      <h4 className="font-medium mb-4">Rozrachunki (prowizje)</h4>
                      {balanceLoading ? (
                        <p className="text-muted-foreground text-sm">Ładowanie...</p>
                      ) : agentBalance ? (
                        <div className="grid md:grid-cols-4 gap-4">
                          <div className="p-3 bg-muted rounded-lg">
                            <p className="text-xs text-muted-foreground">Obrót (wartość rezerwacji)</p>
                            <p className="text-lg font-bold">{agentBalance.totalRevenue.toFixed(2)} zł</p>
                            <p className="text-xs text-muted-foreground">{agentBalance.totalReservations} rez.</p>
                          </div>
                          <div className="p-3 bg-muted rounded-lg">
                            <p className="text-xs text-muted-foreground">Naliczona prowizja</p>
                            <p className="text-lg font-bold">{agentBalance.totalCommission.toFixed(2)} zł</p>
                          </div>
                          <div className={`p-3 rounded-lg ${agentBalance.outstandingCommission > 0 ? "bg-amber-50 dark:bg-amber-950" : "bg-muted"}`}>
                            <p className="text-xs text-muted-foreground">Do wypłaty</p>
                            <p className={`text-lg font-bold ${agentBalance.outstandingCommission > 0 ? "text-amber-600" : ""}`}>
                              {agentBalance.outstandingCommission.toFixed(2)} zł
                            </p>
                          </div>
                          <div className="p-3 bg-muted rounded-lg">
                            <p className="text-xs text-muted-foreground">Wypłacono</p>
                            <p className="text-lg font-bold text-green-600">
                              {agentBalance.totalPaid.toFixed(2)} zł
                            </p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-sm">Brak danych</p>
                      )}
                    </div>

                    {/* Kontakt */}
                    {(selectedAgent.contactPerson || selectedAgent.contactEmail || selectedAgent.contactPhone) && (
                      <div className="pt-4 border-t">
                        <h4 className="font-medium mb-4">Kontakt</h4>
                        <div className="grid md:grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs text-muted-foreground">Osoba kontaktowa</p>
                            <p className="font-medium">{selectedAgent.contactPerson ?? "—"}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">E-mail</p>
                            <p className="font-medium">
                              {selectedAgent.contactEmail ? (
                                <a href={`mailto:${selectedAgent.contactEmail}`} className="text-primary hover:underline">
                                  {selectedAgent.contactEmail}
                                </a>
                              ) : "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Telefon</p>
                            <p className="font-medium">
                              {selectedAgent.contactPhone ? (
                                <a href={`tel:${selectedAgent.contactPhone}`} className="text-primary hover:underline">
                                  {selectedAgent.contactPhone}
                                </a>
                              ) : "—"}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Rezerwacje */}
              {!editMode && selectedAgent.reservations.length > 0 && (
                <div className="p-6 border rounded-lg bg-card">
                  <h3 className="font-medium mb-4">Rezerwacje ({selectedAgent.reservationCount})</h3>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium">Nr</th>
                          <th className="px-4 py-2 text-left font-medium">Gość</th>
                          <th className="px-4 py-2 text-left font-medium">Pokój</th>
                          <th className="px-4 py-2 text-left font-medium">Check-in</th>
                          <th className="px-4 py-2 text-left font-medium">Check-out</th>
                          <th className="px-4 py-2 text-left font-medium">Status</th>
                          <th className="px-4 py-2 text-right font-medium">Kwota</th>
                          <th className="px-4 py-2 text-right font-medium">Prowizja</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {selectedAgent.reservations.map((res) => (
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
                            <td className="px-4 py-2">{res.status}</td>
                            <td className="px-4 py-2 text-right">
                              {res.totalAmount.toFixed(2)} zł
                            </td>
                            <td className="px-4 py-2 text-right">
                              {res.agentCommission !== null
                                ? `${res.agentCommission.toFixed(2)} zł`
                                : `${((res.totalAmount * selectedAgent.commissionPercent) / 100).toFixed(2)} zł`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Usuwanie */}
              {!editMode && (
                <div className="p-6 border rounded-lg bg-card">
                  <h3 className="font-medium mb-4 text-red-600">Strefa niebezpieczna</h3>
                  {deleteConfirm ? (
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Czy na pewno chcesz usunąć agenta <strong>{selectedAgent.name}</strong>?
                        {selectedAgent.reservationCount > 0 && (
                          <span className="text-red-600">
                            {" "}Agent ma {selectedAgent.reservationCount} rezerwacji - nie można go usunąć.
                          </span>
                        )}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="destructive"
                          onClick={handleDelete}
                          disabled={deleteLoading || selectedAgent.reservationCount > 0}
                        >
                          {deleteLoading ? "Usuwanie..." : "Tak, usuń"}
                        </Button>
                        <Button variant="outline" onClick={() => setDeleteConfirm(false)}>
                          Anuluj
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      className="text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => setDeleteConfirm(true)}
                    >
                      Usuń agenta
                    </Button>
                  )}
                </div>
              )}
            </>
          ) : (
            <p className="text-muted-foreground">Agent nie znaleziony.</p>
          )}
        </div>
      )}

      {/* STATYSTYKI */}
      {tab === "statystyki" && (
        <div className="space-y-6">
          {statsLoading ? (
            <p className="text-muted-foreground">Ładowanie statystyk...</p>
          ) : stats ? (
            <>
              {/* Podsumowanie */}
              <div className="grid md:grid-cols-3 gap-4">
                <div className="p-6 border rounded-lg bg-card">
                  <p className="text-sm text-muted-foreground">Łącznie agentów</p>
                  <p className="text-3xl font-bold">{stats.totalAgents}</p>
                </div>
                <div className="p-6 border rounded-lg bg-card">
                  <p className="text-sm text-muted-foreground">Aktywnych</p>
                  <p className="text-3xl font-bold text-green-600">{stats.activeAgents}</p>
                </div>
                <div className="p-6 border rounded-lg bg-card">
                  <p className="text-sm text-muted-foreground">Z rezerwacjami</p>
                  <p className="text-3xl font-bold text-primary">{stats.agentsWithReservations}</p>
                </div>
              </div>

              {/* Top 5 */}
              <div className="p-6 border rounded-lg bg-card">
                <h3 className="font-medium mb-4">Top 5 agentów (wg liczby rezerwacji)</h3>
                {stats.topAgentsByReservations.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Brak danych</p>
                ) : (
                  <div className="space-y-2">
                    {stats.topAgentsByReservations.map((agent, idx) => (
                      <div
                        key={agent.id}
                        className="flex items-center justify-between p-3 bg-muted rounded-lg cursor-pointer hover:bg-muted/80"
                        onClick={() => handleOpenDetails(agent.id)}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-bold text-muted-foreground w-6">
                            {idx + 1}.
                          </span>
                          <div>
                            <p className="font-medium">{agent.name}</p>
                            <p className="text-xs text-muted-foreground">{agent.code}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{agent.reservationCount} rez.</p>
                          <p className="text-xs text-muted-foreground">
                            {agent.totalCommission.toFixed(2)} zł prowizji
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Ostatnio dodane */}
              <div className="p-6 border rounded-lg bg-card">
                <h3 className="font-medium mb-4">Ostatnio dodani</h3>
                {stats.recentlyAdded.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Brak</p>
                ) : (
                  <div className="space-y-2">
                    {stats.recentlyAdded.map((agent) => (
                      <div
                        key={agent.id}
                        className="flex items-center justify-between p-3 bg-muted rounded-lg cursor-pointer hover:bg-muted/80"
                        onClick={() => handleOpenDetails(agent.id)}
                      >
                        <div>
                          <p className="font-medium">{agent.name}</p>
                          <p className="text-xs text-muted-foreground">{agent.code}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(agent.createdAt).toLocaleDateString("pl-PL")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">Błąd ładowania statystyk.</p>
          )}
        </div>
      )}
    </div>
  );
}
