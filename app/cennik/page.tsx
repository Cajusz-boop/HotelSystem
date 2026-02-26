"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getRoomsForCennik,
  updateRoomPrice,
  getPriceChangeHistory,
  getRoomTypes,
  ensureRoomTypes,
  updateRoomTypeBasePrice,
  updateRoomTypeName,
  updateRoomTypeSortOrder,
  updateRoomType,
  getRatePlans,
  createRatePlan,
  deleteRatePlan,
  copyRatePlansFromYearToYear,
  type CennikRoom,
  type PriceChangeEntry,
  type RoomTypeForCennik,
  type RatePlanForCennik,
} from "@/app/actions/rooms";
import {
  getRateCodes,
  createRateCode,
  deleteRateCode,
  type RateCodeForUi,
} from "@/app/actions/rate-codes";
import { getCennikConfig, updateCennikConfig, type CennikConfigForUi } from "@/app/actions/cennik-config";
import { getPackagesForCennik, type PackageForCennik } from "@/app/actions/packages";
import { toast } from "sonner";
import { Receipt, Printer, FileText, History, ChevronDown, ChevronUp, Download, Upload, Calendar, Trash2, Tag, CalendarDays, Users, UtensilsCrossed, Moon, Settings2 } from "lucide-react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { AgeGroupsTab } from "./components/age-groups-tab";
import { ServiceRatesTab } from "./components/service-rates-tab";
import { LongStayTab } from "./components/long-stay-tab";
import { SeasonsTab } from "./components/seasons-tab";

const STATUS_LABELS: Record<string, string> = {
  CLEAN: "Czysty",
  DIRTY: "Do sprzątania",
  OOO: "OOO",
  INSPECTION: "Do sprawdzenia",
  INSPECTED: "Sprawdzony",
  CHECKOUT_PENDING: "Oczekuje wymeldowania",
  MAINTENANCE: "Do naprawy",
};

export default function CennikPage() {
  const [rooms, setRooms] = useState<CennikRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPrice, setEditingPrice] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceChangeEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [roomTypes, setRoomTypes] = useState<RoomTypeForCennik[]>([]);
  const [editingTypePrice, setEditingTypePrice] = useState<Record<string, string>>({});
  const [editingTypeName, setEditingTypeName] = useState<Record<string, string>>({});
  const [editingTypeSortOrder, setEditingTypeSortOrder] = useState<Record<string, string>>({});
  const [savingTypeId, setSavingTypeId] = useState<string | null>(null);
  const [savingTypeNameId, setSavingTypeNameId] = useState<string | null>(null);
  const [savingTypeSortOrderId, setSavingTypeSortOrderId] = useState<string | null>(null);
  const [editingTypeDetails, setEditingTypeDetails] = useState<RoomTypeForCennik | null>(null);
  const [typeDetailsDesc, setTypeDetailsDesc] = useState("");
  const [typeDetailsVisibleInStats, setTypeDetailsVisibleInStats] = useState(true);
  const [typeDetailsTransEn, setTypeDetailsTransEn] = useState("");
  const [typeDetailsTransDe, setTypeDetailsTransDe] = useState("");
  const [typeDetailsMaxOccupancy, setTypeDetailsMaxOccupancy] = useState("");
  const [typeDetailsBeds, setTypeDetailsBeds] = useState("");
  const [savingTypeDetails, setSavingTypeDetails] = useState(false);
  const [ratePlans, setRatePlans] = useState<RatePlanForCennik[]>([]);
  const [newPlanRoomTypeId, setNewPlanRoomTypeId] = useState("");
  const [newPlanFrom, setNewPlanFrom] = useState("");
  const [newPlanTo, setNewPlanTo] = useState("");
  const [newPlanPrice, setNewPlanPrice] = useState("");
  const [addingPlan, setAddingPlan] = useState(false);
  const [rateCodes, setRateCodes] = useState<RateCodeForUi[]>([]);
  const [newCodeCode, setNewCodeCode] = useState("");
  const [newCodeName, setNewCodeName] = useState("");
  const [newCodePrice, setNewCodePrice] = useState("");
  const [addingCode, setAddingCode] = useState(false);
  const [cennikConfig, setCennikConfig] = useState<CennikConfigForUi | null>(null);
  const [configCurrency, setConfigCurrency] = useState("PLN");
  const [configVat, setConfigVat] = useState("0");
  const [configNetto, setConfigNetto] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [newPlanMinStay, setNewPlanMinStay] = useState("");
  const [newPlanMaxStay, setNewPlanMaxStay] = useState("");
  const [newPlanNonRefund, setNewPlanNonRefund] = useState(false);
  const [newPlanWeekendHoliday, setNewPlanWeekendHoliday] = useState(false);
  const [copyFromYear, setCopyFromYear] = useState(String(new Date().getFullYear()));
  const [copyToYear, setCopyToYear] = useState(String(new Date().getFullYear() + 1));
  const [copying, setCopying] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [packages, setPackages] = useState<PackageForCennik[]>([]);

  const LOAD_TIMEOUT_MS = 15_000;

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    const loadTask = async (): Promise<void> => {
      await ensureRoomTypes();
      const [roomsRes, typesRes, plansRes, codesRes] = await Promise.all([
        getRoomsForCennik(),
        getRoomTypes(),
        getRatePlans().then((r) => r).catch(() => ({ success: true as const, data: [] as RatePlanForCennik[] })),
        getRateCodes().then((r) => r).catch(() => ({ success: true as const, data: [] as RateCodeForUi[] })),
      ]);
      if (roomsRes.success && roomsRes.data) {
        setRooms(roomsRes.data);
        setEditingPrice(
          roomsRes.data.reduce<Record<string, string>>((acc, r) => {
            acc[r.id] = r.price != null ? String(r.price) : "";
            return acc;
          }, {})
        );
      } else {
        setLoadError(roomsRes.success ? null : roomsRes.error ?? "Błąd ładowania pokoi");
        toast.error(roomsRes.success ? undefined : roomsRes.error);
      }
      if (typesRes.success && typesRes.data) {
        setRoomTypes(typesRes.data);
        setEditingTypePrice(
          typesRes.data.reduce<Record<string, string>>((acc, t) => {
            acc[t.id] = t.basePrice != null ? String(t.basePrice) : "";
            return acc;
          }, {})
        );
        setEditingTypeName(
          typesRes.data.reduce<Record<string, string>>((acc, t) => {
            acc[t.id] = t.name ?? "";
            return acc;
          }, {})
        );
        setEditingTypeSortOrder(
          typesRes.data.reduce<Record<string, string>>((acc, t) => {
            acc[t.id] = String(t.sortOrder ?? 0);
            return acc;
          }, {})
        );
      }
      if (plansRes.success && plansRes.data) setRatePlans(plansRes.data);
      if (codesRes.success && codesRes.data) setRateCodes(codesRes.data);
      const configRes = await getCennikConfig();
      if (configRes.success && configRes.data) {
        setCennikConfig(configRes.data);
        setConfigCurrency(configRes.data.currency);
        setConfigVat(String(configRes.data.vatPercent));
        setConfigNetto(configRes.data.pricesAreNetto);
      }
      const packagesRes = await getPackagesForCennik();
      if (packagesRes.success && packagesRes.data) setPackages(packagesRes.data);
    };
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Przekroczono limit czasu (15 s). Sprawdź połączenie z bazą.")), LOAD_TIMEOUT_MS)
      );
      await Promise.race([loadTask(), timeoutPromise]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Nie udało się załadować cennika.";
      setLoadError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = newCodeCode.trim().toUpperCase();
    const name = newCodeName.trim();
    if (!code || !name) {
      toast.error("Kod i nazwa wymagane.");
      return;
    }
    const price = newCodePrice.trim() ? parseFloat(newCodePrice.replace(",", ".")) : undefined;
    if (price !== undefined && (Number.isNaN(price) || price < 0)) {
      toast.error("Cena musi być liczbą nieujemną.");
      return;
    }
    setAddingCode(true);
    const result = await createRateCode({ code, name, price });
    setAddingCode(false);
    if (result.success && result.data) {
      setRateCodes((prev) => [...prev, result.data!]);
      setNewCodeCode("");
      setNewCodeName("");
      setNewCodePrice("");
      toast.success("Kod stawki dodany.");
    } else {
      toast.error("error" in result ? result.error : "Błąd dodawania kodu stawki");
    }
  };

  const handleCopyRatePlans = async () => {
    const from = parseInt(copyFromYear, 10);
    const to = parseInt(copyToYear, 10);
    if (Number.isNaN(from) || Number.isNaN(to) || from === to) {
      toast.error("Podaj dwa różne lata.");
      return;
    }
    setCopying(true);
    const result = await copyRatePlansFromYearToYear(from, to);
    setCopying(false);
    if (result.success && result.data) {
      toast.success(`Skopiowano ${result.data.copied} stawek sezonowych z ${from} na ${to}.`);
      load();
    } else {
      toast.error("error" in result ? result.error : "Błąd");
    }
  };

  const handleDeleteRateCode = async (id: string) => {
    const result = await deleteRateCode(id);
    if (result.success) {
      setRateCodes((prev) => prev.filter((c) => c.id !== id));
      toast.success("Kod stawki usunięty.");
    } else toast.error("error" in result ? result.error : "Błąd");
  };

  useEffect(() => {
    load();
  }, []);

  const handleSavePrice = async (roomId: string) => {
    const raw = editingPrice[roomId]?.trim().replace(",", ".");
    const value = raw === "" ? null : parseFloat(raw);
    if (value !== null && (Number.isNaN(value) || value < 0)) {
      toast.error("Wprowadź poprawną cenę (liczba ≥ 0).");
      return;
    }
    setSavingId(roomId);
    const result = await updateRoomPrice(roomId, value ?? 0);
    setSavingId(null);
    if (result.success) {
      toast.success("Cena zapisana.");
      setRooms((prev) =>
        prev.map((r) => (r.id === roomId ? { ...r, price: value } : r))
      );
      getPriceChangeHistory(30).then((r) => {
        if (r.success && r.data) setPriceHistory(r.data);
      });
    } else {
      toast.error("error" in result ? result.error : "Błąd");
    }
  };

  const handleSaveTypePrice = async (roomTypeId: string) => {
    const raw = editingTypePrice[roomTypeId]?.trim().replace(",", ".");
    const value = raw === "" ? 0 : parseFloat(raw);
    if (Number.isNaN(value) || value < 0) {
      toast.error("Wprowadź poprawną cenę (liczba ≥ 0).");
      return;
    }
    setSavingTypeId(roomTypeId);
    const result = await updateRoomTypeBasePrice(roomTypeId, value);
    setSavingTypeId(null);
    if (result.success) {
      toast.success("Cena typu zapisana.");
      setRoomTypes((prev) =>
        prev.map((t) => (t.id === roomTypeId ? { ...t, basePrice: value } : t))
      );
      load();
    } else {
      toast.error("error" in result ? result.error : "Błąd");
    }
  };

  const handleAddRatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlanRoomTypeId || !newPlanFrom || !newPlanTo) {
      toast.error("Wypełnij typ pokoju i zakres dat.");
      return;
    }
    const price = parseFloat(newPlanPrice.replace(",", "."));
    if (Number.isNaN(price) || price < 0) {
      toast.error("Wprowadź poprawną cenę.");
      return;
    }
    const minStay = newPlanMinStay.trim() ? parseInt(newPlanMinStay, 10) : undefined;
    const maxStay = newPlanMaxStay.trim() ? parseInt(newPlanMaxStay, 10) : undefined;
    setAddingPlan(true);
    const result = await createRatePlan({
      roomTypeId: newPlanRoomTypeId,
      validFrom: newPlanFrom,
      validTo: newPlanTo,
      price,
      minStayNights: minStay ?? null,
      maxStayNights: maxStay ?? null,
      isNonRefundable: newPlanNonRefund,
      isWeekendHoliday: newPlanWeekendHoliday,
    });
    setAddingPlan(false);
    if (result.success && result.data) {
      setRatePlans((prev) => [...prev, result.data!]);
      setNewPlanRoomTypeId("");
      setNewPlanFrom("");
      setNewPlanTo("");
      setNewPlanPrice("");
      setNewPlanMinStay("");
      setNewPlanMaxStay("");
      setNewPlanNonRefund(false);
      setNewPlanWeekendHoliday(false);
      toast.success("Stawka sezonowa dodana.");
    } else {
      toast.error("error" in result ? result.error : "Błąd");
    }
  };

  const handleSaveConfig = async () => {
    const vat = parseFloat(configVat.replace(",", "."));
    if (Number.isNaN(vat) || vat < 0 || vat > 100) {
      toast.error("VAT musi być liczbą 0–100.");
      return;
    }
    setSavingConfig(true);
    const result = await updateCennikConfig({
      currency: configCurrency.trim() || "PLN",
      vatPercent: vat,
      pricesAreNetto: configNetto,
    });
    setSavingConfig(false);
    if (result.success && result.data) {
      setCennikConfig(result.data);
      toast.success("Ustawienia zapisane.");
    } else {
      toast.error("error" in result ? result.error : "Błąd");
    }
  };

  const handleDeleteRatePlan = async (id: string) => {
    const result = await deleteRatePlan(id);
    if (result.success) {
      setRatePlans((prev) => prev.filter((p) => p.id !== id));
      toast.success("Stawka usunięta.");
    } else toast.error("error" in result ? result.error : "Błąd");
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-8 p-8 pl-[13rem]">
        <h1 className="text-2xl font-semibold">Cennik</h1>
        <p className="text-muted-foreground">Ładowanie…</p>
        <p className="text-xs text-muted-foreground">(max 15 s – jeśli dłużej, pojawi się błąd i przycisk „Ponów”)</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col gap-6 p-8 pl-[13rem]">
        <h1 className="text-2xl font-semibold">Cennik</h1>
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
          <p className="mb-2 text-sm font-medium text-destructive">Błąd ładowania danych</p>
          <p className="mb-4 text-sm text-muted-foreground">{loadError}</p>
          <Button type="button" onClick={() => load()}>
            Ponów
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 p-8 pl-[13rem]">
      <h1 className="flex items-center gap-2 text-2xl font-semibold">
        <Receipt className="h-7 w-7" />
        Cennik pokoi
      </h1>
      <p className="text-sm text-muted-foreground">
        Cena pokoju = nadpisanie (jeśli ustawione) lub cena bazowa typu. Stawki sezonowe nadpisują w podanym zakresie dat. Zmiany w dzienniku audytu.
      </p>

      <Tabs defaultValue="plany" className="w-full">
        <TabsList className="flex flex-wrap gap-1 h-auto p-1">
          <TabsTrigger value="plany" className="gap-1">
            <Calendar className="h-4 w-4" />
            Plany cenowe
          </TabsTrigger>
          <TabsTrigger value="dzienne" className="gap-1">
            <CalendarDays className="h-4 w-4" />
            Ceny dzienne
          </TabsTrigger>
          <TabsTrigger value="sezony" className="gap-1">
            <Moon className="h-4 w-4" />
            Sezony
          </TabsTrigger>
          <TabsTrigger value="grupy" className="gap-1">
            <Users className="h-4 w-4" />
            Grupy wiekowe
          </TabsTrigger>
          <TabsTrigger value="uslugi" className="gap-1">
            <UtensilsCrossed className="h-4 w-4" />
            Usługi stałe
          </TabsTrigger>
          <TabsTrigger value="dlugie" className="gap-1">
            <Moon className="h-4 w-4" />
            Długie pobyty
          </TabsTrigger>
          <Button asChild variant="ghost" size="sm" className="gap-1">
            <Link href="/cennik/reguly-pochodne">
              Reguły pochodne
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="gap-1">
            <Link href="/cennik/wydruk">
              <FileText className="h-4 w-4" />
              Wydruk
            </Link>
          </Button>
        </TabsList>

        <TabsContent value="plany" className="mt-4 space-y-8">
      <div className="rounded-lg border bg-card p-4 print:hidden">
        <h2 className="mb-3 text-sm font-semibold">Ustawienia (waluta, VAT, netto/brutto)</h2>
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Waluta</Label>
            <Input
              value={configCurrency}
              onChange={(e) => setConfigCurrency(e.target.value)}
              className="w-20"
              placeholder="PLN"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">VAT (%)</Label>
            <Input
              type="text"
              inputMode="decimal"
              value={configVat}
              onChange={(e) => setConfigVat(e.target.value)}
              className="w-16"
              placeholder="0"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={configNetto}
              onChange={(e) => setConfigNetto(e.target.checked)}
              className="rounded"
            />
            Ceny netto
          </label>
          <Button size="sm" disabled={savingConfig} onClick={handleSaveConfig}>
            {savingConfig ? "…" : "Zapisz ustawienia"}
          </Button>
        </div>
        {cennikConfig && (
          <p className="mt-2 text-xs text-muted-foreground">
            Obecnie: {cennikConfig.currency}, VAT {cennikConfig.vatPercent}%, {cennikConfig.pricesAreNetto ? "netto" : "brutto"}.
          </p>
        )}
      </div>

      {roomTypes.length > 0 && (
        <div className="rounded-lg border bg-card p-4 print:hidden">
          <h2 className="mb-3 text-sm font-semibold">Ceny wg typu pokoju (bazowe)</h2>
          <div className="flex flex-wrap gap-4">
            {[...roomTypes]
              .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
              .map((t) => (
              <div key={t.id} className="flex flex-wrap items-center gap-2">
                <Label className="w-8 text-muted-foreground">Kolejność</Label>
                <Input
                  type="number"
                  min={0}
                  value={editingTypeSortOrder[t.id] ?? ""}
                  onChange={(e) =>
                    setEditingTypeSortOrder((prev) => ({ ...prev, [t.id]: e.target.value }))
                  }
                  className="w-16"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={savingTypeSortOrderId === t.id}
                  onClick={async () => {
                    const raw = (editingTypeSortOrder[t.id] ?? "").trim();
                    const value = raw === "" ? 0 : parseInt(raw, 10);
                    if (Number.isNaN(value) || value < 0) {
                      toast.error("Kolejność: liczba całkowita nieujemna.");
                      return;
                    }
                    setSavingTypeSortOrderId(t.id);
                    const result = await updateRoomTypeSortOrder(t.id, value);
                    setSavingTypeSortOrderId(null);
                    if (result.success) {
                      toast.success("Kolejność zapisana.");
                      setRoomTypes((prev) =>
                        prev.map((x) => (x.id === t.id ? { ...x, sortOrder: value } : x))
                      );
                    } else {
                      toast.error("error" in result ? result.error : "Błąd");
                    }
                  }}
                >
                  {savingTypeSortOrderId === t.id ? "…" : "Zapisz"}
                </Button>
                <span className="w-20 font-medium">{t.name}</span>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={editingTypePrice[t.id] ?? ""}
                  onChange={(e) =>
                    setEditingTypePrice((prev) => ({ ...prev, [t.id]: e.target.value }))
                  }
                  placeholder="0"
                  className="w-24"
                />
                <Label className="text-muted-foreground">PLN</Label>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={savingTypeId === t.id}
                  onClick={() => handleSaveTypePrice(t.id)}
                >
                  {savingTypeId === t.id ? "…" : "Zapisz cenę"}
                </Button>
                <Input
                  value={editingTypeName[t.id] ?? ""}
                  onChange={(e) =>
                    setEditingTypeName((prev) => ({ ...prev, [t.id]: e.target.value }))
                  }
                  placeholder="Nazwa typu"
                  className="w-32"
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={savingTypeNameId === t.id}
                  onClick={async () => {
                    const name = (editingTypeName[t.id] ?? "").trim();
                    if (!name) {
                      toast.error("Nazwa wymagana.");
                      return;
                    }
                    setSavingTypeNameId(t.id);
                    const result = await updateRoomTypeName(t.id, name);
                    setSavingTypeNameId(null);
                    if (result.success) {
                      toast.success("Nazwa zapisana.");
                      setRoomTypes((prev) =>
                        prev.map((x) => (x.id === t.id ? { ...x, name } : x))
                      );
                    } else {
                      toast.error("error" in result ? result.error : "Błąd");
                    }
                  }}
                >
                  {savingTypeNameId === t.id ? "…" : "Zapisz nazwę"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditingTypeDetails(t);
                    setTypeDetailsDesc(t.description ?? "");
                    setTypeDetailsVisibleInStats(t.visibleInStats ?? true);
                    setTypeDetailsTransEn((t.translations as Record<string, string>)?.["en"] ?? "");
                    setTypeDetailsTransDe((t.translations as Record<string, string>)?.["de"] ?? "");
                    setTypeDetailsMaxOccupancy(t.maxOccupancy != null ? String(t.maxOccupancy) : "");
                    setTypeDetailsBeds(t.bedsDescription ?? "");
                  }}
                  title="Opis, statystyki, tłumaczenia"
                >
                  <Settings2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dialog szczegółów typu pokoju (opis, widoczny w statystykach, tłumaczenia) */}
      <Dialog open={!!editingTypeDetails} onOpenChange={(open) => !open && setEditingTypeDetails(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Szczegóły typu: {editingTypeDetails?.name}</DialogTitle>
          </DialogHeader>
          {editingTypeDetails && (
            <div className="space-y-4 py-2">
              <div>
                <Label className="text-xs">Opis</Label>
                <textarea
                  className="mt-1 w-full rounded border border-input bg-background px-3 py-2 text-sm min-h-[60px]"
                  value={typeDetailsDesc}
                  onChange={(e) => setTypeDetailsDesc(e.target.value)}
                  placeholder="np. Pokój z balkonem i widokiem na jezioro"
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="type-visible-in-stats"
                  checked={typeDetailsVisibleInStats}
                  onCheckedChange={(v) => setTypeDetailsVisibleInStats(v === true)}
                />
                <Label htmlFor="type-visible-in-stats" className="text-sm font-normal cursor-pointer">
                  Widoczny w statystykach obłożenia
                </Label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Maks. osób</Label>
                  <Input
                    type="number"
                    min={1}
                    value={typeDetailsMaxOccupancy}
                    onChange={(e) => setTypeDetailsMaxOccupancy(e.target.value)}
                    placeholder="—"
                  />
                </div>
                <div>
                  <Label className="text-xs">Łóżka (np. 2×DB)</Label>
                  <Input
                    value={typeDetailsBeds}
                    onChange={(e) => setTypeDetailsBeds(e.target.value)}
                    placeholder="2×DB"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Tłumaczenia nazwy</Label>
                <div className="mt-1 flex gap-2">
                  <Input
                    placeholder="EN"
                    value={typeDetailsTransEn}
                    onChange={(e) => setTypeDetailsTransEn(e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    placeholder="DE"
                    value={typeDetailsTransDe}
                    onChange={(e) => setTypeDetailsTransDe(e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTypeDetails(null)}>
              Anuluj
            </Button>
            <Button
              disabled={savingTypeDetails || !editingTypeDetails}
              onClick={async () => {
                if (!editingTypeDetails) return;
                setSavingTypeDetails(true);
                const maxOcc = typeDetailsMaxOccupancy.trim() ? parseInt(typeDetailsMaxOccupancy, 10) : null;
                const result = await updateRoomType(editingTypeDetails.id, {
                  description: typeDetailsDesc.trim() || null,
                  visibleInStats: typeDetailsVisibleInStats,
                  maxOccupancy: maxOcc != null && !Number.isNaN(maxOcc) ? maxOcc : null,
                  bedsDescription: typeDetailsBeds.trim() || null,
                  translations:
                    typeDetailsTransEn.trim() || typeDetailsTransDe.trim()
                      ? { en: typeDetailsTransEn.trim(), de: typeDetailsTransDe.trim() }
                      : null,
                });
                setSavingTypeDetails(false);
                if (result.success) {
                  toast.success("Zapisano.");
                  setRoomTypes((prev) =>
                    prev.map((x) =>
                      x.id === editingTypeDetails.id
                        ? {
                            ...x,
                            description: typeDetailsDesc.trim() || undefined,
                            visibleInStats: typeDetailsVisibleInStats,
                            maxOccupancy: maxOcc != null && !Number.isNaN(maxOcc) ? maxOcc : undefined,
                            bedsDescription: typeDetailsBeds.trim() || undefined,
                            translations:
                              typeDetailsTransEn.trim() || typeDetailsTransDe.trim()
                                ? { en: typeDetailsTransEn.trim(), de: typeDetailsTransDe.trim() }
                                : undefined,
                          }
                        : x
                    )
                  );
                  setEditingTypeDetails(null);
                } else {
                  toast.error("error" in result ? result.error : "Błąd zapisu");
                }
              }}
            >
              {savingTypeDetails ? "…" : "Zapisz"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="rounded-lg border bg-card p-4 print:hidden">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Tag className="h-4 w-4" />
          Kody stawek (BB, RO, Net…)
        </h2>
        {rateCodes.length > 0 && (
          <div className="mb-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-1 font-medium">Kod</th>
                  <th className="py-1 font-medium">Nazwa</th>
                  <th className="py-1 font-medium">Cena (PLN/dobę)</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {rateCodes.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="py-1 font-medium">{c.code}</td>
                    <td className="py-1">{c.name}</td>
                    <td className="py-1">{c.price != null ? c.price.toFixed(2) : "–"}</td>
                    <td className="py-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => handleDeleteRateCode(c.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <form onSubmit={handleAddRateCode} className="flex flex-wrap items-end gap-2">
          <Input
            placeholder="Kod (np. BB)"
            value={newCodeCode}
            onChange={(e) => setNewCodeCode(e.target.value.toUpperCase())}
            className="w-24"
            maxLength={10}
          />
          <Input
            placeholder="Nazwa (np. Śniadanie)"
            value={newCodeName}
            onChange={(e) => setNewCodeName(e.target.value)}
            className="w-40"
          />
          <Input
            type="text"
            inputMode="decimal"
            placeholder="Cena (opcjonalnie)"
            value={newCodePrice}
            onChange={(e) => setNewCodePrice(e.target.value)}
            className="w-24"
          />
          <Button type="submit" size="sm" disabled={addingCode}>
            {addingCode ? "…" : "Dodaj"}
          </Button>
        </form>
      </div>

      <div className="rounded-lg border bg-card p-4 print:hidden">
        <h2 className="mb-3 text-sm font-semibold">Cennik pakietów</h2>
        {packages.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-1 font-medium">Kod</th>
                  <th className="py-1 font-medium">Nazwa</th>
                  <th className="py-1 font-medium">Cena (PLN)</th>
                  <th className="py-1 font-medium">Składniki</th>
                </tr>
              </thead>
              <tbody>
                {packages.map((pkg) => (
                  <tr key={pkg.id} className="border-b last:border-0">
                    <td className="py-1 font-medium">{pkg.code}</td>
                    <td className="py-1">{pkg.name}</td>
                    <td className="py-1">
                      {pkg.totalPrice != null ? pkg.totalPrice.toFixed(2) : pkg.components.length > 0
                        ? pkg.components.reduce((s, c) => s + c.unitPrice * c.quantity, 0).toFixed(2)
                        : "–"}
                    </td>
                    <td className="py-1 text-muted-foreground">
                      {pkg.components.map((c) => `${c.label} × ${c.quantity}`).join(", ") || "–"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">Brak zdefiniowanych pakietów. Dodaj pakiety (np. room + śniadanie) w bazie.</p>
        )}
      </div>

      {roomTypes.length > 0 && (
        <div className="rounded-lg border bg-card p-4 print:hidden">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Calendar className="h-4 w-4" />
            Stawki sezonowe (okresy)
          </h2>
          {ratePlans.length > 0 && (
            <div className="mb-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-1 font-medium">Typ</th>
                    <th className="py-1 font-medium">Od</th>
                    <th className="py-1 font-medium">Do</th>
                    <th className="py-1 font-medium">Cena (PLN)</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {ratePlans.map((p) => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="py-1">{p.roomTypeName}</td>
                      <td className="py-1">{p.validFrom}</td>
                      <td className="py-1">{p.validTo}</td>
                      <td className="py-1">{p.price.toFixed(2)}</td>
                      <td className="py-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => handleDeleteRatePlan(p.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <form onSubmit={handleAddRatePlan} className="flex flex-wrap items-end gap-2">
            <select
              value={newPlanRoomTypeId}
              onChange={(e) => setNewPlanRoomTypeId(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              required
            >
              <option value="">Typ pokoju</option>
              {roomTypes.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <Input
              type="date"
              value={newPlanFrom}
              onChange={(e) => setNewPlanFrom(e.target.value)}
              className="w-36"
              required
            />
            <Input
              type="date"
              value={newPlanTo}
              onChange={(e) => setNewPlanTo(e.target.value)}
              className="w-36"
              required
            />
            <Input
              type="text"
              inputMode="decimal"
              placeholder="Cena"
              value={newPlanPrice}
              onChange={(e) => setNewPlanPrice(e.target.value)}
              className="w-24"
              required
            />
            <Input
              type="number"
              min={0}
              placeholder="Min nocy"
              value={newPlanMinStay}
              onChange={(e) => setNewPlanMinStay(e.target.value)}
              className="w-20"
            />
            <Input
              type="number"
              min={0}
              placeholder="Max nocy"
              value={newPlanMaxStay}
              onChange={(e) => setNewPlanMaxStay(e.target.value)}
              className="w-20"
            />
            <label className="flex items-center gap-1 text-sm whitespace-nowrap">
              <input
                type="checkbox"
                checked={newPlanNonRefund}
                onChange={(e) => setNewPlanNonRefund(e.target.checked)}
                className="rounded"
              />
              Niezwrotna
            </label>
            <label className="flex items-center gap-1 text-sm whitespace-nowrap">
              <input
                type="checkbox"
                checked={newPlanWeekendHoliday}
                onChange={(e) => setNewPlanWeekendHoliday(e.target.checked)}
                className="rounded"
              />
              Weekend/święto
            </label>
            <Button type="submit" size="sm" disabled={addingPlan}>
              {addingPlan ? "…" : "Dodaj"}
            </Button>
          </form>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Kopiuj stawki na rok:</span>
            <Input
              type="number"
              min={2020}
              max={2030}
              value={copyFromYear}
              onChange={(e) => setCopyFromYear(e.target.value)}
              className="w-20"
            />
            <span className="text-sm">→</span>
            <Input
              type="number"
              min={2020}
              max={2030}
              value={copyToYear}
              onChange={(e) => setCopyToYear(e.target.value)}
              className="w-20"
            />
            <Button size="sm" variant="outline" disabled={copying} onClick={handleCopyRatePlans}>
              {copying ? "…" : "Kopiuj"}
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 print:hidden">
        <Button asChild variant="outline" size="sm">
          <Link href="/cennik/wydruk">
            <FileText className="mr-2 h-4 w-4" />
            Widok do wydruku / dla gościa
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/cennik/wydruk" target="_blank" rel="noopener noreferrer">
            <Printer className="mr-2 h-4 w-4" />
            Drukuj cennik
          </Link>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const headers = ["Nr pokoju", "Typ", "Status", "Cena (PLN/dobę)"];
            const rows = rooms.map((r) => [
              r.number,
              r.type,
              STATUS_LABELS[r.status] ?? r.status,
              r.price != null ? String(r.price) : "",
            ]);
            const csv = ["\uFEFF" + headers.join(";"), ...rows.map((row) => row.join(";"))].join("\n");
            const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `cennik-${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          <Download className="mr-2 h-4 w-4" />
          Eksport CSV
        </Button>
        <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium ring-offset-background hover:bg-accent hover:text-accent-foreground">
          <Upload className="h-4 w-4" />
          Import CSV
          <input
            type="file"
            accept=".csv"
            className="sr-only"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const text = await file.text();
              const lines = text.replace(/\r\n/g, "\n").split("\n").filter(Boolean);
              if (lines.length < 2) {
                toast.error("Plik CSV musi zawierać nagłówek i co najmniej jeden wiersz.");
                e.target.value = "";
                return;
              }
              const sep = lines[0].includes(";") ? ";" : ",";
              const header = lines[0].toLowerCase();
              const numIdx = header.split(sep).findIndex((c) => c.includes("nr") || c.includes("pokój") || c === "number");
              const priceIdx = header.split(sep).findIndex((c) => c.includes("cena") || c.includes("price"));
              if (numIdx === -1 || priceIdx === -1) {
                toast.error("CSV musi mieć kolumny: Nr pokoju (lub number), Cena (lub price).");
                e.target.value = "";
                return;
              }
              let ok = 0;
              for (let i = 1; i < lines.length; i++) {
                const cells = lines[i].split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
                const number = cells[numIdx];
                const priceStr = cells[priceIdx]?.replace(",", ".");
                const price = priceStr ? parseFloat(priceStr) : NaN;
                if (!number) continue;
                const room = rooms.find((r) => r.number === number);
                if (!room) continue;
                if (!Number.isFinite(price) || price < 0) continue;
                const result = await updateRoomPrice(room.id, price);
                if (result.success) ok++;
              }
              toast.success(`Zaimportowano ${ok} cen.`);
              load();
              e.target.value = "";
            }}
          />
        </label>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 font-medium">Nr pokoju</th>
              <th className="px-4 py-3 font-medium">Typ</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Cena (PLN / dobę)</th>
              <th className="w-24 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rooms.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="px-4 py-2 font-medium">{r.number}</td>
                <td className="px-4 py-2">{r.type}</td>
                <td className="px-4 py-2">{STATUS_LABELS[r.status] ?? r.status}</td>
                <td className="px-4 py-2">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={editingPrice[r.id] ?? ""}
                        onChange={(e) =>
                          setEditingPrice((prev) => ({ ...prev, [r.id]: e.target.value }))
                        }
                        placeholder={r.typeBasePrice != null ? String(r.typeBasePrice) : "0"}
                        className="w-28"
                      />
                      <Label className="text-muted-foreground shrink-0">PLN</Label>
                    </div>
                    {r.price == null && r.typeBasePrice != null && (
                      <span className="text-xs text-muted-foreground">Obecnie: z typu ({r.typeBasePrice} PLN)</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={savingId === r.id}
                    onClick={() => handleSavePrice(r.id)}
                  >
                    {savingId === r.id ? "Zapisywanie…" : "Zapisz"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="print:hidden">
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => {
            setHistoryOpen((v) => !v);
            if (!historyOpen && priceHistory.length === 0) {
              getPriceChangeHistory(30).then((r) => {
                if (r.success && r.data) setPriceHistory(r.data);
              });
            }
          }}
        >
          {historyOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          <History className="h-4 w-4" />
          Historia zmian cen
        </Button>
        {historyOpen && (
          <div className="mt-3 overflow-x-auto rounded-lg border bg-muted/20 p-4">
            {priceHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">Brak wpisów lub ładowanie…</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 font-medium">Data i godzina</th>
                    <th className="py-2 font-medium">Pokój</th>
                    <th className="py-2 font-medium">Stara cena (PLN)</th>
                    <th className="py-2 font-medium">Nowa cena (PLN)</th>
                  </tr>
                </thead>
                <tbody>
                  {priceHistory.map((h, i) => (
                    <tr key={`${h.roomId}-${h.timestamp}-${i}`} className="border-b last:border-0">
                      <td className="py-1.5">
                        {new Date(h.timestamp).toLocaleString("pl-PL")}
                      </td>
                      <td className="py-1.5 font-medium">{h.roomNumber}</td>
                      <td className="py-1.5">{h.oldPrice != null ? h.oldPrice.toFixed(2) : "–"}</td>
                      <td className="py-1.5">{h.newPrice != null ? h.newPrice.toFixed(2) : "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
        </TabsContent>

        <TabsContent value="dzienne" className="mt-4">
          <p className="text-muted-foreground text-sm">
            Siatka cen dziennych (nadpisania na konkretny dzień) — w przygotowaniu. Na razie używaj planów cenowych i nadpisań w tabeli pokoi.
          </p>
        </TabsContent>

        <TabsContent value="sezony" className="mt-4">
          <SeasonsTab />
        </TabsContent>

        <TabsContent value="grupy" className="mt-4">
          <AgeGroupsTab />
        </TabsContent>

        <TabsContent value="uslugi" className="mt-4">
          <ServiceRatesTab />
        </TabsContent>

        <TabsContent value="dlugie" className="mt-4">
          <LongStayTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
