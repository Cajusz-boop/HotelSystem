"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const EVENT_TYPES = [
  { value: "WESELE", label: "Wesele" },
  { value: "KOMUNIA", label: "Komunia" },
  { value: "CHRZCINY", label: "Chrzciny" },
  { value: "URODZINY", label: "Urodziny" },
  { value: "STYPA", label: "Stypa" },
  { value: "FIRMOWA", label: "Firmowa" },
  { value: "INNE", label: "Inne" },
] as const;

const ROOMS = [
  { value: "Sala Duża", label: "Sala Duża" },
  { value: "Sala Mała", label: "Sala Mała" },
  { value: "Ogród", label: "Ogród" },
] as const;

export type EventFormData = {
  eventType: string;
  clientName: string;
  clientPhone: string;
  eventDate: string;
  dateFrom?: string;
  timeStart: string;
  timeEnd: string;
  roomName: string;
  guestCount: number | "";
  adultsCount: number | "";
  children03: number | "";
  children47: number | "";
  orchestraCount: number | "";
  cameramanCount: number | "";
  photographerCount: number | "";
  churchTime: string;
  brideGroomTable: string;
  orchestraTable: string;
  packageId: string;
  cakesAndDesserts: string;
  cakeOrderedAt: string;
  cakeArrivalTime: string;
  cakeServedAt: string;
  drinksArrival: string;
  drinksStorage: string;
  champagneStorage: string;
  firstBottlesBy: string;
  alcoholAtTeamTable: boolean;
  cakesSwedishTable: boolean;
  fruitsSwedishTable: boolean;
  ownFlowers: boolean;
  ownVases: boolean;
  decorationColor: string;
  placeCards: boolean;
  placeCardsLayout: string;
  tableLayout: string;
  breadWelcomeBy: string;
  extraAttractions: string;
  specialRequests: string;
  facebookConsent: boolean;
  ownNapkins: boolean;
  dutyPerson: string;
  afterpartyEnabled: boolean;
  afterpartyTimeFrom: string;
  afterpartyTimeTo: string;
  afterpartyGuests: number | "";
  afterpartyMenu: string;
  afterpartyMusic: string;
};

const EMPTY_FORM: EventFormData = {
  eventType: "WESELE",
  clientName: "",
  clientPhone: "",
  eventDate: "",
  timeStart: "",
  timeEnd: "",
  roomName: "",
  guestCount: "",
  adultsCount: "",
  children03: "",
  children47: "",
  orchestraCount: "",
  cameramanCount: "",
  photographerCount: "",
  churchTime: "",
  brideGroomTable: "",
  orchestraTable: "",
  packageId: "",
  cakesAndDesserts: "",
  cakeOrderedAt: "",
  cakeArrivalTime: "",
  cakeServedAt: "",
  drinksArrival: "",
  drinksStorage: "",
  champagneStorage: "",
  firstBottlesBy: "",
  alcoholAtTeamTable: false,
  cakesSwedishTable: false,
  fruitsSwedishTable: false,
  ownFlowers: false,
  ownVases: false,
  decorationColor: "",
  placeCards: false,
  placeCardsLayout: "",
  tableLayout: "",
  breadWelcomeBy: "",
  extraAttractions: "",
  specialRequests: "",
  facebookConsent: false,
  ownNapkins: false,
  dutyPerson: "",
  afterpartyEnabled: false,
  afterpartyTimeFrom: "",
  afterpartyTimeTo: "",
  afterpartyGuests: "",
  afterpartyMenu: "",
  afterpartyMusic: "",
};

function YesNoButton({
  value,
  onChange,
  label,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <div className="flex gap-2">
      <Button
        type="button"
        variant={value ? "default" : "outline"}
        className="h-12 min-w-[100px] text-base"
        onClick={() => onChange(true)}
      >
        TAK
      </Button>
      <Button
        type="button"
        variant={!value ? "default" : "outline"}
        className="h-12 min-w-[100px] text-base"
        onClick={() => onChange(false)}
      >
        NIE
      </Button>
      <span className="flex items-center text-base text-muted-foreground">{label}</span>
    </div>
  );
}

interface PackageOption {
  id: string;
  name: string;
}

interface StaffOption {
  id: string;
  name: string;
}

interface EventFormProps {
  eventId?: string;
  initialData?: Partial<EventFormData>;
  packages?: PackageOption[];
  staff?: StaffOption[];
}

export function EventForm({
  eventId,
  initialData,
  packages = [],
  staff = [],
}: EventFormProps) {
  const router = useRouter();
  const [section, setSection] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<EventFormData>(() => ({
    ...EMPTY_FORM,
    ...initialData,
  }));

  const update = useCallback(<K extends keyof EventFormData>(key: K, value: EventFormData[K]) => {
    setData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const totalSections = 8;

  // Walidacja
  const errors: Partial<Record<keyof EventFormData, string>> = {};
  if (!data.clientName?.trim()) errors.clientName = "Wymagane";
  if (!(data.eventDate || data.dateFrom)?.toString().trim()) errors.eventDate = "Wymagane";
  if (!data.timeStart?.trim()) errors.timeStart = "Wymagane";
  if (!data.roomName?.trim()) errors.roomName = "Wymagane";
  const gc = data.guestCount;
  if (gc !== "" && (typeof gc !== "number" || gc <= 0 || gc > 1500)) {
    errors.guestCount = "Liczba 1–1500";
  }
  if (data.adultsCount !== "" && typeof data.adultsCount === "number" && gc !== "" && typeof gc === "number" && data.adultsCount > gc) {
    errors.adultsCount = "≤ liczba gości";
  }
  const hasErrors = Object.keys(errors).length > 0;

  const toPayload = () => {
    const d = data;
    const eventDate = d.eventDate || d.dateFrom;
    const dateFrom = eventDate ? new Date(eventDate + "T12:00:00") : new Date();
    const dateTo = dateFrom;
    return {
      name: `${d.clientName} – ${eventDate ?? "?"}`,
      eventType: d.eventType,
      clientName: d.clientName,
      clientPhone: d.clientPhone || null,
      eventDate: eventDate || null,
      timeStart: d.timeStart || null,
      timeEnd: d.timeEnd || null,
      roomName: d.roomName || null,
      guestCount: d.guestCount === "" ? null : Number(d.guestCount),
      adultsCount: d.adultsCount === "" ? null : Number(d.adultsCount),
      children03: d.children03 === "" ? null : Number(d.children03),
      children47: d.children47 === "" ? null : Number(d.children47),
      orchestraCount: d.orchestraCount === "" ? null : Number(d.orchestraCount),
      cameramanCount: d.cameramanCount === "" ? null : Number(d.cameramanCount),
      photographerCount: d.photographerCount === "" ? null : Number(d.photographerCount),
      churchTime: d.churchTime || null,
      brideGroomTable: d.brideGroomTable || null,
      orchestraTable: d.orchestraTable || null,
      packageId: d.packageId || null,
      cakesAndDesserts: d.cakesAndDesserts || null,
      cakeOrderedAt: d.cakeOrderedAt || null,
      cakeArrivalTime: d.cakeArrivalTime || null,
      cakeServedAt: d.cakeServedAt || null,
      drinksArrival: d.drinksArrival || null,
      drinksStorage: d.drinksStorage || null,
      champagneStorage: d.champagneStorage || null,
      firstBottlesBy: d.firstBottlesBy || null,
      alcoholAtTeamTable: d.alcoholAtTeamTable,
      cakesSwedishTable: d.cakesSwedishTable,
      fruitsSwedishTable: d.fruitsSwedishTable,
      ownFlowers: d.ownFlowers,
      ownVases: d.ownVases,
      decorationColor: d.decorationColor || null,
      placeCards: d.placeCards,
      placeCardsLayout: d.placeCardsLayout || null,
      tableLayout: d.tableLayout || null,
      breadWelcomeBy: d.breadWelcomeBy || null,
      extraAttractions: d.extraAttractions || null,
      specialRequests: d.specialRequests || null,
      facebookConsent: d.facebookConsent,
      ownNapkins: d.ownNapkins,
      dutyPerson: d.dutyPerson || null,
      afterpartyEnabled: d.afterpartyEnabled,
      afterpartyTimeFrom: d.afterpartyTimeFrom || null,
      afterpartyTimeTo: d.afterpartyTimeTo || null,
      afterpartyGuests: d.afterpartyGuests === "" ? null : Number(d.afterpartyGuests),
      afterpartyMenu: d.afterpartyMenu || null,
      afterpartyMusic: d.afterpartyMusic || null,
      dateFrom: dateFrom.toISOString().slice(0, 10),
      dateTo: dateTo.toISOString().slice(0, 10),
      status: "DRAFT",
    };
  };

  const handleSubmit = async () => {
    if (hasErrors) {
      toast.error("Popraw błędy w formularzu");
      return;
    }
    setSubmitting(true);
    try {
      const payload = toPayload();
      const url = eventId ? `/api/event-orders/${eventId}` : "/api/event-orders";
      const method = eventId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Błąd zapisu");
      toast.success(eventId ? "Impreza zaktualizowana" : "Impreza zapisana");
      router.push(`/events/${json.id}`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Błąd zapisu");
    } finally {
      setSubmitting(false);
    }
  };

  const showChurch = data.eventType === "WESELE";
  const showBrideTable = data.eventType === "WESELE";
  const showOrchestraTable = data.eventType === "WESELE";
  const showAfterparty = data.eventType === "WESELE" || data.eventType === "URODZINY";
  const hideTortNapoje = data.eventType === "STYPA";

  const dateFrom = data.eventDate || data.dateFrom || "";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-lg border px-4 py-2 text-base">
        <span>Sekcja {section}/{totalSections}</span>
      </div>

      {section === 1 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Dane podstawowe</h2>
          <div>
            <Label className="text-base">Typ imprezy</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {EVENT_TYPES.map(({ value, label }) => (
                <Button
                  key={value}
                  type="button"
                  variant={data.eventType === value ? "default" : "outline"}
                  className="h-12 text-base"
                  onClick={() => update("eventType", value)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="clientName" className="text-base">Imię i nazwisko klienta</Label>
            <Input
              id="clientName"
              value={data.clientName}
              onChange={(e) => update("clientName", e.target.value)}
              className={cn("mt-1 h-12 text-base", errors.clientName && "border-destructive")}
              placeholder="np. Jan Kowalski"
            />
            {errors.clientName && <p className="text-sm text-destructive">{errors.clientName}</p>}
          </div>
          <div>
            <Label htmlFor="clientPhone" className="text-base">Telefon</Label>
            <Input
              id="clientPhone"
              type="tel"
              value={data.clientPhone}
              onChange={(e) => update("clientPhone", e.target.value)}
              className="mt-1 h-12 text-base"
              placeholder="np. 500 123 456"
            />
          </div>
          <div>
            <Label htmlFor="eventDate" className="text-base">Data imprezy</Label>
            <Input
              id="eventDate"
              type="date"
              value={data.eventDate}
              onChange={(e) => update("eventDate", e.target.value)}
              className={cn("mt-1 h-12 text-base max-w-xs", errors.eventDate && "border-destructive")}
            />
            {errors.eventDate && <p className="text-sm text-destructive">{errors.eventDate}</p>}
          </div>
          <div>
            <Label className="text-base">Sala</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {ROOMS.map(({ value, label }) => (
                <Button
                  key={value}
                  type="button"
                  variant={data.roomName === value ? "default" : "outline"}
                  className="h-12 text-base"
                  onClick={() => update("roomName", value)}
                >
                  {label}
                </Button>
              ))}
            </div>
            {errors.roomName && <p className="text-sm text-destructive">{errors.roomName}</p>}
          </div>
        </div>
      )}

      {section === 2 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Goście i czas</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="timeStart" className="text-base">Godzina rozpoczęcia</Label>
              <Input
                id="timeStart"
                type="time"
                value={data.timeStart}
                onChange={(e) => update("timeStart", e.target.value)}
                className={cn("mt-1 h-12 text-base", errors.timeStart && "border-destructive")}
              />
              {errors.timeStart && <p className="text-sm text-destructive">{errors.timeStart}</p>}
            </div>
            <div>
              <Label htmlFor="timeEnd" className="text-base">Godzina zakończenia</Label>
              <Input
                id="timeEnd"
                type="time"
                value={data.timeEnd}
                onChange={(e) => update("timeEnd", e.target.value)}
                className="mt-1 h-12 text-base"
              />
            </div>
          </div>
          {showChurch && (
            <div>
              <Label htmlFor="churchTime" className="text-base">Godzina kościoła</Label>
              <Input
                id="churchTime"
                type="time"
                value={data.churchTime}
                onChange={(e) => update("churchTime", e.target.value)}
                className="mt-1 h-12 text-base"
              />
            </div>
          )}
          <div>
            <Label htmlFor="guestCount" className="text-base">Liczba gości (łącznie)</Label>
            <Input
              id="guestCount"
              type="number"
              min={1}
              max={1500}
              value={data.guestCount}
              onChange={(e) => update("guestCount", e.target.value === "" ? "" : parseInt(e.target.value, 10))}
              className={cn("mt-1 h-16 text-2xl max-w-[200px]", errors.guestCount && "border-destructive")}
              placeholder="np. 80"
            />
            {errors.guestCount && <p className="text-sm text-destructive">{errors.guestCount}</p>}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="adultsCount" className="text-base">Dorośli</Label>
              <Input
                id="adultsCount"
                type="number"
                min={0}
                value={data.adultsCount}
                onChange={(e) => update("adultsCount", e.target.value === "" ? "" : parseInt(e.target.value, 10))}
                className={cn("mt-1 h-12 text-base", errors.adultsCount && "border-destructive")}
              />
              {errors.adultsCount && <p className="text-sm text-destructive">{errors.adultsCount}</p>}
            </div>
            <div>
              <Label htmlFor="children03" className="text-base">Dzieci 0-3</Label>
              <Input
                id="children03"
                type="number"
                min={0}
                value={data.children03}
                onChange={(e) => update("children03", e.target.value === "" ? "" : parseInt(e.target.value, 10))}
                className="mt-1 h-12 text-base"
              />
            </div>
            <div>
              <Label htmlFor="children47" className="text-base">Dzieci 4-7</Label>
              <Input
                id="children47"
                type="number"
                min={0}
                value={data.children47}
                onChange={(e) => update("children47", e.target.value === "" ? "" : parseInt(e.target.value, 10))}
                className="mt-1 h-12 text-base"
              />
            </div>
            <div>
              <Label htmlFor="orchestraCount" className="text-base">Orkiestra</Label>
              <Input
                id="orchestraCount"
                type="number"
                min={0}
                value={data.orchestraCount}
                onChange={(e) => update("orchestraCount", e.target.value === "" ? "" : parseInt(e.target.value, 10))}
                className="mt-1 h-12 text-base"
              />
            </div>
            <div>
              <Label htmlFor="cameramanCount" className="text-base">Kamerzysta</Label>
              <Input
                id="cameramanCount"
                type="number"
                min={0}
                value={data.cameramanCount}
                onChange={(e) => update("cameramanCount", e.target.value === "" ? "" : parseInt(e.target.value, 10))}
                className="mt-1 h-12 text-base"
              />
            </div>
            <div>
              <Label htmlFor="photographerCount" className="text-base">Fotograf</Label>
              <Input
                id="photographerCount"
                type="number"
                min={0}
                value={data.photographerCount}
                onChange={(e) => update("photographerCount", e.target.value === "" ? "" : parseInt(e.target.value, 10))}
                className="mt-1 h-12 text-base"
              />
            </div>
          </div>
        </div>
      )}

      {section === 3 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Menu</h2>
          <div>
            <Label htmlFor="packageId" className="text-base">Pakiet menu</Label>
            <select
              id="packageId"
              value={data.packageId}
              onChange={(e) => update("packageId", e.target.value)}
              className="mt-1 h-12 w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-base"
            >
              <option value="">— Wybierz pakiet —</option>
              {packages.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="cakesAndDesserts" className="text-base">Torty i desery</Label>
            <Textarea
              id="cakesAndDesserts"
              value={data.cakesAndDesserts}
              onChange={(e) => update("cakesAndDesserts", e.target.value)}
              className="mt-1 h-24 text-base"
              placeholder="Opis tortów i deserów…"
            />
          </div>
        </div>
      )}

      {section === 4 && !hideTortNapoje && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Tort i napoje</h2>
          <div>
            <Label htmlFor="cakeOrderedAt" className="text-base">Tort – gdzie zamówiony</Label>
            <Input
              id="cakeOrderedAt"
              value={data.cakeOrderedAt}
              onChange={(e) => update("cakeOrderedAt", e.target.value)}
              className="mt-1 h-12 text-base"
              placeholder="np. Cukiernia X"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="cakeArrivalTime" className="text-base">Tort – godzina przyjazdu</Label>
              <Input
                id="cakeArrivalTime"
                type="time"
                value={data.cakeArrivalTime}
                onChange={(e) => update("cakeArrivalTime", e.target.value)}
                className="mt-1 h-12 text-base"
              />
            </div>
            <div>
              <Label htmlFor="cakeServedAt" className="text-base">Tort – godzina podania</Label>
              <Input
                id="cakeServedAt"
                type="time"
                value={data.cakeServedAt}
                onChange={(e) => update("cakeServedAt", e.target.value)}
                className="mt-1 h-12 text-base"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="drinksArrival" className="text-base">Napoje – przyjazd</Label>
            <Input
              id="drinksArrival"
              value={data.drinksArrival}
              onChange={(e) => update("drinksArrival", e.target.value)}
              className="mt-1 h-12 text-base"
              placeholder="np. 14:00"
            />
          </div>
          <div>
            <Label htmlFor="drinksStorage" className="text-base">Napoje – przechowywanie</Label>
            <Input
              id="drinksStorage"
              value={data.drinksStorage}
              onChange={(e) => update("drinksStorage", e.target.value)}
              className="mt-1 h-12 text-base"
            />
          </div>
          <div>
            <Label htmlFor="champagneStorage" className="text-base">Szampan – przechowywanie</Label>
            <Input
              id="champagneStorage"
              value={data.champagneStorage}
              onChange={(e) => update("champagneStorage", e.target.value)}
              className="mt-1 h-12 text-base"
            />
          </div>
          <div>
            <Label htmlFor="firstBottlesBy" className="text-base">Pierwsze butelki otwiera</Label>
            <Input
              id="firstBottlesBy"
              value={data.firstBottlesBy}
              onChange={(e) => update("firstBottlesBy", e.target.value)}
              className="mt-1 h-12 text-base"
            />
          </div>
          <YesNoButton
            value={data.alcoholAtTeamTable}
            onChange={(v) => update("alcoholAtTeamTable", v)}
            label="Napoje na stole zespołu"
          />
        </div>
      )}

      {section === 4 && hideTortNapoje && (
        <div className="py-8 text-center text-muted-foreground">Sekcja „Tort i napoje” jest ukryta dla imprez typu Stypa.</div>
      )}

      {section === 5 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Dekoracje i układ</h2>
          <YesNoButton value={data.cakesSwedishTable} onChange={(v) => update("cakesSwedishTable", v)} label="Torty na stole szwedzkim" />
          <YesNoButton value={data.fruitsSwedishTable} onChange={(v) => update("fruitsSwedishTable", v)} label="Owoce na stole szwedzkim" />
          <YesNoButton value={data.ownFlowers} onChange={(v) => update("ownFlowers", v)} label="Własne kwiaty" />
          <YesNoButton value={data.ownVases} onChange={(v) => update("ownVases", v)} label="Własne wazony" />
          <div>
            <Label htmlFor="decorationColor" className="text-base">Kolor dekoracji</Label>
            <Input
              id="decorationColor"
              value={data.decorationColor}
              onChange={(e) => update("decorationColor", e.target.value)}
              className="mt-1 h-12 text-base"
              placeholder="np. biały, zielony"
            />
          </div>
          <YesNoButton value={data.placeCards} onChange={(v) => update("placeCards", v)} label="Winietki" />
          {data.placeCards && (
            <div>
              <Label htmlFor="placeCardsLayout" className="text-base">Układ winietki</Label>
              <Input
                id="placeCardsLayout"
                value={data.placeCardsLayout}
                onChange={(e) => update("placeCardsLayout", e.target.value)}
                className="mt-1 h-12 text-base"
              />
            </div>
          )}
          <div>
            <Label htmlFor="tableLayout" className="text-base">Układ stołów</Label>
            <Textarea
              id="tableLayout"
              value={data.tableLayout}
              onChange={(e) => update("tableLayout", e.target.value)}
              className="mt-1 h-24 text-base"
              placeholder="Opis układu stołów…"
            />
          </div>
          {showBrideTable && (
            <div>
              <Label htmlFor="brideGroomTable" className="text-base">Stół Pary Młodej</Label>
              <Input
                id="brideGroomTable"
                value={data.brideGroomTable}
                onChange={(e) => update("brideGroomTable", e.target.value)}
                className="mt-1 h-12 text-base"
              />
            </div>
          )}
          {showOrchestraTable && (
            <div>
              <Label htmlFor="orchestraTable" className="text-base">Stół orkiestry</Label>
              <Input
                id="orchestraTable"
                value={data.orchestraTable}
                onChange={(e) => update("orchestraTable", e.target.value)}
                className="mt-1 h-12 text-base"
              />
            </div>
          )}
          <div>
            <Label htmlFor="breadWelcomeBy" className="text-base">Chleb powitalny przez</Label>
            <Input
              id="breadWelcomeBy"
              value={data.breadWelcomeBy}
              onChange={(e) => update("breadWelcomeBy", e.target.value)}
              className="mt-1 h-12 text-base"
            />
          </div>
        </div>
      )}

      {section === 6 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Dodatkowe</h2>
          <div>
            <Label htmlFor="extraAttractions" className="text-base">Atrakcje dodatkowe</Label>
            <Textarea
              id="extraAttractions"
              value={data.extraAttractions}
              onChange={(e) => update("extraAttractions", e.target.value)}
              className="mt-1 h-24 text-base"
              placeholder="np. fotobudka, pokaz fajerwerków"
            />
          </div>
          <div>
            <Label htmlFor="specialRequests" className="text-base">Specjalne życzenia</Label>
            <Textarea
              id="specialRequests"
              value={data.specialRequests}
              onChange={(e) => update("specialRequests", e.target.value)}
              className="mt-1 h-24 text-base"
            />
          </div>
          <YesNoButton value={data.facebookConsent} onChange={(v) => update("facebookConsent", v)} label="Zgoda na Facebook" />
          <YesNoButton value={data.ownNapkins} onChange={(v) => update("ownNapkins", v)} label="Własne serwetki" />
          <div>
            <Label htmlFor="dutyPerson" className="text-base">Osoba dyżurna</Label>
            <select
              id="dutyPerson"
              value={data.dutyPerson}
              onChange={(e) => update("dutyPerson", e.target.value)}
              className="mt-1 h-12 w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-base"
            >
              <option value="">— Wybierz —</option>
              {staff.map((s) => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {section === 7 && showAfterparty && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Afterparty</h2>
          <YesNoButton value={data.afterpartyEnabled} onChange={(v) => update("afterpartyEnabled", v)} label="Afterparty" />
          {data.afterpartyEnabled && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="afterpartyTimeFrom" className="text-base">Godzina od</Label>
                  <Input
                    id="afterpartyTimeFrom"
                    type="time"
                    value={data.afterpartyTimeFrom}
                    onChange={(e) => update("afterpartyTimeFrom", e.target.value)}
                    className="mt-1 h-12 text-base"
                  />
                </div>
                <div>
                  <Label htmlFor="afterpartyTimeTo" className="text-base">Godzina do</Label>
                  <Input
                    id="afterpartyTimeTo"
                    type="time"
                    value={data.afterpartyTimeTo}
                    onChange={(e) => update("afterpartyTimeTo", e.target.value)}
                    className="mt-1 h-12 text-base"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="afterpartyGuests" className="text-base">Liczba gości afterparty</Label>
                <Input
                  id="afterpartyGuests"
                  type="number"
                  min={0}
                  value={data.afterpartyGuests}
                  onChange={(e) => update("afterpartyGuests", e.target.value === "" ? "" : parseInt(e.target.value, 10))}
                  className="mt-1 h-12 text-base max-w-[200px]"
                />
              </div>
              <div>
                <Label htmlFor="afterpartyMenu" className="text-base">Menu afterparty</Label>
                <Textarea
                  id="afterpartyMenu"
                  value={data.afterpartyMenu}
                  onChange={(e) => update("afterpartyMenu", e.target.value)}
                  className="mt-1 h-24 text-base"
                />
              </div>
              <div>
                <Label htmlFor="afterpartyMusic" className="text-base">Muzyka</Label>
                <Input
                  id="afterpartyMusic"
                  value={data.afterpartyMusic}
                  onChange={(e) => update("afterpartyMusic", e.target.value)}
                  className="mt-1 h-12 text-base"
                />
              </div>
            </>
          )}
        </div>
      )}

      {section === 7 && !showAfterparty && (
        <div className="py-8 text-center text-muted-foreground">Sekcja „Afterparty” jest dostępna tylko dla Wesel i Urodzin.</div>
      )}

      {section === 8 && (
        <div className="space-y-6">
          <h2 className="text-xl font-semibold">Podsumowanie</h2>
          <div className="rounded-lg border p-4 space-y-2 text-base">
            <p><strong>Typ:</strong> {EVENT_TYPES.find((t) => t.value === data.eventType)?.label ?? data.eventType}</p>
            <p><strong>Klient:</strong> {data.clientName || "—"}</p>
            <p><strong>Telefon:</strong> {data.clientPhone || "—"}</p>
            <p><strong>Data:</strong> {dateFrom || "—"}</p>
            <p><strong>Godziny:</strong> {data.timeStart || "—"} – {data.timeEnd || "—"}</p>
            <p><strong>Sala:</strong> {data.roomName || "—"}</p>
            <p><strong>Goście:</strong> {data.guestCount !== "" ? data.guestCount : "—"}</p>
            <p><strong>Pakiet:</strong> {packages.find((p) => p.id === data.packageId)?.name ?? "—"}</p>
            {data.afterpartyEnabled && (
              <p><strong>Afterparty:</strong> {data.afterpartyTimeFrom}–{data.afterpartyTimeTo}, {data.afterpartyGuests} os.</p>
            )}
          </div>
          <Button
            onClick={handleSubmit}
            disabled={submitting || hasErrors}
            className="h-12 px-8 text-base"
          >
            {submitting ? "Zapisywanie…" : "Zapisz imprezę i utwórz dokumenty"}
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between pt-4">
        <Button
          type="button"
          variant="outline"
          className="h-12 text-base"
          onClick={() => setSection((s) => Math.max(1, s - 1))}
          disabled={section <= 1}
        >
          ← Poprzednia
        </Button>
        {section < totalSections ? (
          <Button
            type="button"
            className="h-12 text-base"
            onClick={() => setSection((s) => Math.min(totalSections, s + 1))}
          >
            Następna →
          </Button>
        ) : null}
      </div>
    </div>
  );
}
