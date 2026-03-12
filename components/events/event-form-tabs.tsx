"use client";

import { useMemo } from "react";
import { MenuTab } from "@/components/events/menu-modul";

const EVENT_TYPES = [
  { value: "WESELE", label: "Wesele" },
  { value: "KOMUNIA", label: "Komunia" },
  { value: "CHRZCINY", label: "Chrzciny" },
  { value: "URODZINY", label: "Urodziny - Rocznice" },
  { value: "STYPA", label: "Stypa" },
  { value: "FIRMOWA", label: "Firmowa" },
  { value: "SYLWESTER", label: "Sylwester" },
  { value: "INNE", label: "Inne" },
] as const;

/** Fallback – używany gdy eventTypeFieldsConfig nie jest przekazany. */
const EVENT_TYPE_FIELDS_CONFIG: Record<string, Record<string, boolean>> = {
  WESELE: {
    clientName: true, clientPhone: true, clientEmail: true, eventDate: true,
    roomName: true, addPoprawiny: true, depositAmount: true, depositDueDate: true, depositPaid: true,
    timeStart: true, timeEnd: true, churchTime: true, adultsCount: true,
    children03: true, children47: true, orchestraCount: true, cameramanCount: true, photographerCount: true,
    cakesAndDesserts: true, cakeOrderedAt: true, cakeArrivalTime: true, cakeServedAt: true,
    drinksArrival: true, drinksStorage: true, champagneStorage: true, firstBottlesBy: true, alcoholAtTeamTable: true,
    cakesSwedishTable: true, fruitsSwedishTable: true, ownFlowers: true, ownVases: true,
    placeCards: true, placeCardsLayout: true, decorationColor: true, tableLayout: true,
    brideGroomTable: true, orchestraTable: true, breadWelcomeBy: true, extraAttractions: true,
    specialRequests: true, facebookConsent: true, ownNapkins: true, dutyPerson: true,
    assignedTo: true, afterpartyEnabled: true, afterpartyTimeFrom: true, afterpartyTimeTo: true,
    afterpartyGuests: true, afterpartyMenu: true, afterpartyMusic: true, notes: true,
  },
  KOMUNIA: {
    clientName: true, clientPhone: true, clientEmail: true, eventDate: true,
    roomName: true, addPoprawiny: false, depositAmount: true, depositDueDate: true, depositPaid: true,
    timeStart: true, timeEnd: true, churchTime: false, adultsCount: true,
    children03: true, children47: true, orchestraCount: true, cameramanCount: true, photographerCount: true,
    cakesAndDesserts: true, cakeOrderedAt: true, cakeArrivalTime: true, cakeServedAt: true,
    drinksArrival: true, drinksStorage: true, champagneStorage: true, firstBottlesBy: true, alcoholAtTeamTable: true,
    cakesSwedishTable: true, fruitsSwedishTable: true, ownFlowers: true, ownVases: true,
    placeCards: true, placeCardsLayout: true, decorationColor: true, tableLayout: true,
    brideGroomTable: false, orchestraTable: false, breadWelcomeBy: true, extraAttractions: true,
    specialRequests: true, facebookConsent: true, ownNapkins: true, dutyPerson: true,
    assignedTo: true, afterpartyEnabled: false, afterpartyTimeFrom: false, afterpartyTimeTo: false,
    afterpartyGuests: false, afterpartyMenu: false, afterpartyMusic: false, notes: true,
  },
  CHRZCINY: {
    clientName: true, clientPhone: true, clientEmail: true, eventDate: true,
    roomName: true, addPoprawiny: false, depositAmount: true, depositDueDate: true, depositPaid: true,
    timeStart: true, timeEnd: true, churchTime: false, adultsCount: true,
    children03: true, children47: true, orchestraCount: false, cameramanCount: false, photographerCount: false,
    cakesAndDesserts: true, cakeOrderedAt: true, cakeArrivalTime: true, cakeServedAt: true,
    drinksArrival: true, drinksStorage: true, champagneStorage: false, firstBottlesBy: false, alcoholAtTeamTable: false,
    cakesSwedishTable: true, fruitsSwedishTable: true, ownFlowers: true, ownVases: true,
    placeCards: false, placeCardsLayout: false, decorationColor: false, tableLayout: true,
    brideGroomTable: false, orchestraTable: false, breadWelcomeBy: true, extraAttractions: true,
    specialRequests: true, facebookConsent: true, ownNapkins: false, dutyPerson: true,
    assignedTo: true, afterpartyEnabled: false, afterpartyTimeFrom: false, afterpartyTimeTo: false,
    afterpartyGuests: false, afterpartyMenu: false, afterpartyMusic: false, notes: true,
  },
  URODZINY: {
    clientName: true, clientPhone: true, clientEmail: true, eventDate: true,
    roomName: true, addPoprawiny: false, depositAmount: true, depositDueDate: true, depositPaid: true,
    timeStart: true, timeEnd: true, churchTime: false, adultsCount: true,
    children03: true, children47: true, orchestraCount: true, cameramanCount: true, photographerCount: true,
    cakesAndDesserts: true, cakeOrderedAt: true, cakeArrivalTime: true, cakeServedAt: true,
    drinksArrival: true, drinksStorage: true, champagneStorage: true, firstBottlesBy: true, alcoholAtTeamTable: true,
    cakesSwedishTable: true, fruitsSwedishTable: true, ownFlowers: true, ownVases: true,
    placeCards: true, placeCardsLayout: true, decorationColor: true, tableLayout: true,
    brideGroomTable: false, orchestraTable: false, breadWelcomeBy: true, extraAttractions: true,
    specialRequests: true, facebookConsent: true, ownNapkins: true, dutyPerson: true,
    assignedTo: true, afterpartyEnabled: true, afterpartyTimeFrom: true, afterpartyTimeTo: true,
    afterpartyGuests: true, afterpartyMenu: true, afterpartyMusic: true, notes: true,
  },
  STYPA: {
    clientName: true, clientPhone: true, clientEmail: true, eventDate: true,
    roomName: true, addPoprawiny: false, depositAmount: true, depositDueDate: true, depositPaid: true,
    timeStart: true, timeEnd: true, churchTime: false, adultsCount: true,
    children03: false, children47: false, orchestraCount: false, cameramanCount: false, photographerCount: false,
    cakesAndDesserts: false, cakeOrderedAt: false, cakeArrivalTime: false, cakeServedAt: false,
    drinksArrival: false, drinksStorage: false, champagneStorage: false, firstBottlesBy: false, alcoholAtTeamTable: false,
    cakesSwedishTable: false, fruitsSwedishTable: false, ownFlowers: false, ownVases: false,
    placeCards: false, placeCardsLayout: false, decorationColor: false, tableLayout: true,
    brideGroomTable: false, orchestraTable: false, breadWelcomeBy: false, extraAttractions: false,
    specialRequests: true, facebookConsent: false, ownNapkins: false, dutyPerson: true,
    assignedTo: true, afterpartyEnabled: false, afterpartyTimeFrom: false, afterpartyTimeTo: false,
    afterpartyGuests: false, afterpartyMenu: false, afterpartyMusic: false, notes: true,
  },
  FIRMOWA: {
    clientName: true, clientPhone: true, clientEmail: true, eventDate: true,
    roomName: true, addPoprawiny: false, depositAmount: true, depositDueDate: true, depositPaid: true,
    timeStart: true, timeEnd: true, churchTime: false, adultsCount: true,
    children03: false, children47: false, orchestraCount: true, cameramanCount: true, photographerCount: true,
    cakesAndDesserts: true, cakeOrderedAt: false, cakeArrivalTime: false, cakeServedAt: false,
    drinksArrival: true, drinksStorage: true, champagneStorage: false, firstBottlesBy: false, alcoholAtTeamTable: true,
    cakesSwedishTable: true, fruitsSwedishTable: true, ownFlowers: false, ownVases: false,
    placeCards: false, placeCardsLayout: false, decorationColor: false, tableLayout: true,
    brideGroomTable: false, orchestraTable: false, breadWelcomeBy: false, extraAttractions: true,
    specialRequests: true, facebookConsent: false, ownNapkins: false, dutyPerson: true,
    assignedTo: true, afterpartyEnabled: false, afterpartyTimeFrom: false, afterpartyTimeTo: false,
    afterpartyGuests: false, afterpartyMenu: false, afterpartyMusic: false, notes: true,
  },
  SYLWESTER: {
    clientName: true, clientPhone: true, clientEmail: true, eventDate: true,
    roomName: true, addPoprawiny: false, depositAmount: true, depositDueDate: true, depositPaid: true,
    timeStart: true, timeEnd: true, churchTime: false, adultsCount: true,
    children03: true, children47: true, orchestraCount: true, cameramanCount: true, photographerCount: true,
    cakesAndDesserts: true, cakeOrderedAt: false, cakeArrivalTime: false, cakeServedAt: false,
    drinksArrival: true, drinksStorage: true, champagneStorage: true, firstBottlesBy: true, alcoholAtTeamTable: true,
    cakesSwedishTable: true, fruitsSwedishTable: true, ownFlowers: true, ownVases: true,
    placeCards: true, placeCardsLayout: true, decorationColor: true, tableLayout: true,
    brideGroomTable: false, orchestraTable: false, breadWelcomeBy: true, extraAttractions: true,
    specialRequests: true, facebookConsent: true, ownNapkins: true, dutyPerson: true,
    assignedTo: true, afterpartyEnabled: true, afterpartyTimeFrom: true, afterpartyTimeTo: true,
    afterpartyGuests: true, afterpartyMenu: true, afterpartyMusic: true, notes: true,
  },
  INNE: {
    clientName: true, clientPhone: true, clientEmail: true, eventDate: true,
    roomName: true, addPoprawiny: false, depositAmount: true, depositDueDate: true, depositPaid: true,
    timeStart: true, timeEnd: true, churchTime: false, adultsCount: true,
    children03: true, children47: true, orchestraCount: true, cameramanCount: true, photographerCount: true,
    cakesAndDesserts: true, cakeOrderedAt: true, cakeArrivalTime: true, cakeServedAt: true,
    drinksArrival: true, drinksStorage: true, champagneStorage: true, firstBottlesBy: true, alcoholAtTeamTable: true,
    cakesSwedishTable: true, fruitsSwedishTable: true, ownFlowers: true, ownVases: true,
    placeCards: true, placeCardsLayout: true, decorationColor: true, tableLayout: true,
    brideGroomTable: false, orchestraTable: false, breadWelcomeBy: true, extraAttractions: true,
    specialRequests: true, facebookConsent: true, ownNapkins: true, dutyPerson: true,
    assignedTo: true, afterpartyEnabled: false, afterpartyTimeFrom: false, afterpartyTimeTo: false,
    afterpartyGuests: false, afterpartyMenu: false, afterpartyMusic: false, notes: true,
  },
};

const ROOMS_DATA = [
  { name: "Sala Złota", capacity: 120 },
  { name: "Sala Diamentowa", capacity: 80 },
  { name: "Restauracja", capacity: 60 },
  { name: "Pokój 10", capacity: 15 },
  { name: "Pokój 30", capacity: 30 },
  { name: "Wiata", capacity: 50 },
  { name: "Do ustalenia", capacity: null as number | null },
] as const;
const ROOMS = ROOMS_DATA.map((r) => r.name);

const TIME_OPTIONS = (() => {
  const opts: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      opts.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return opts;
})();

const inputStyle = {
  width: "100%",
  padding: "10px 14px",
  border: "1px solid #ddd",
  borderRadius: "4px",
  fontSize: "15px",
  outline: "none" as const,
  fontFamily: "inherit",
};
const labelStyle = { fontSize: "13px", fontWeight: 700, color: "#888", textTransform: "uppercase" as const, display: "block" as const, marginBottom: "6px" };

function TimeSelect({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <div style={{ marginBottom: "12px" }}>
      <label style={labelStyle}>{label}</label>
      <select
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...inputStyle, background: "white" }}
      >
        <option value="">--:--</option>
        {TIME_OPTIONS.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
    </div>
  );
}

function YesNoButton({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
      <span style={{ flex: 1, fontSize: "12px", color: "#555" }}>{label}</span>
      <button
        type="button"
        onClick={() => onChange(true)}
        style={{
          padding: "4px 12px",
          borderRadius: "3px",
          fontSize: "11px",
          fontWeight: 600,
          cursor: "pointer",
          background: value === true ? "#1e1e1e" : "white",
          color: value === true ? "white" : "#999",
          border: `1px solid ${value === true ? "#1e1e1e" : "#ddd"}`,
        }}
      >
        Tak
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        style={{
          padding: "4px 12px",
          borderRadius: "3px",
          fontSize: "11px",
          fontWeight: 600,
          cursor: "pointer",
          background: value === false ? "#1e1e1e" : "white",
          color: value === false ? "white" : "#999",
          border: `1px solid ${value === false ? "#1e1e1e" : "#ddd"}`,
        }}
      >
        Nie
      </button>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", compact }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  compact?: boolean;
}) {
  return (
    <div style={{ marginBottom: compact ? "0" : "16px" }}>
      <label style={labelStyle}>{label}</label>
      <input
        type={type}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={inputStyle}
      />
    </div>
  );
}

function NumField({ label, value, onChange, placeholder, style: s }: {
  label: string;
  value: number | string;
  onChange: (v: number | "") => void;
  placeholder?: string;
  style?: React.CSSProperties;
}) {
  const str = value === "" ? "" : String(value);
  return (
    <div style={{ marginBottom: "12px", ...s }}>
      <label style={labelStyle}>{label}</label>
      <input
        type="number"
        min={0}
        value={str}
        onChange={(e) => { const v = e.target.value; onChange(v === "" ? "" : (parseInt(v, 10) || 0)); }}
        placeholder={placeholder}
        style={{ ...inputStyle, width: "100px", ...s }}
      />
    </div>
  );
}

export type EventFormTabState = {
  eventType: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  eventDate: string;
  roomName: string;
  addPoprawiny: boolean;
  poprawinyDate: string;
  poprawinyGuestCount: number | "";
  depositAmount: string;
  depositPaid: boolean;
  depositDueDate: string;
  timeStart: string;
  timeEnd: string;
  churchTime: string;
  adultsCount: number | "";
  children03: number | "";
  children47: number | "";
  orchestraCount: number | "";
  cameramanCount: number | "";
  photographerCount: number | "";
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
  placeCards: boolean;
  placeCardsLayout: string;
  decorationColor: string;
  tableLayout: string;
  brideGroomTable: string;
  orchestraTable: string;
  breadWelcomeBy: string;
  extraAttractions: string;
  specialRequests: string;
  facebookConsent: boolean;
  ownNapkins: boolean;
  dutyPerson: string;
  assignedTo: string;
  afterpartyEnabled: boolean;
  afterpartyTimeFrom: string;
  afterpartyTimeTo: string;
  afterpartyGuests: number | "";
  afterpartyMenu: string;
  afterpartyMusic: string;
  notes: string;
};

export const EMPTY_EVENT_FORM: EventFormTabState = {
  eventType: "WESELE",
  clientName: "",
  clientPhone: "",
  clientEmail: "",
  eventDate: "",
  roomName: "",
  addPoprawiny: false,
  poprawinyDate: "",
  poprawinyGuestCount: "",
  depositAmount: "",
  depositPaid: false,
  depositDueDate: "",
  timeStart: "",
  timeEnd: "",
  churchTime: "",
  adultsCount: "",
  children03: "",
  children47: "",
  orchestraCount: "",
  cameramanCount: "",
  photographerCount: "",
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
  placeCards: false,
  placeCardsLayout: "",
  decorationColor: "",
  tableLayout: "",
  brideGroomTable: "",
  orchestraTable: "",
  breadWelcomeBy: "",
  extraAttractions: "",
  specialRequests: "",
  facebookConsent: false,
  ownNapkins: false,
  dutyPerson: "",
  assignedTo: "",
  afterpartyEnabled: false,
  afterpartyTimeFrom: "",
  afterpartyTimeTo: "",
  afterpartyGuests: "",
  afterpartyMenu: "",
  afterpartyMusic: "",
  notes: "",
};

export function EventFormTabs({
  tab,
  form,
  update,
  menuData,
  onMenuSave,
  evForMenu,
  eventTypeFieldsConfig,
}: {
  tab: "dane" | "goscie" | "menu" | "szczegoly";
  form: EventFormTabState;
  update: <K extends keyof EventFormTabState>(k: K, v: EventFormTabState[K]) => void;
  menuData?: Record<string, unknown> | null;
  onMenuSave?: (d: Record<string, unknown>) => void;
  evForMenu?: { type: string; client?: string | null; date: string; guests?: number | null };
  eventTypeFieldsConfig?: Record<string, Record<string, boolean>>;
}) {
  const cfg = eventTypeFieldsConfig?.[form.eventType] ?? EVENT_TYPE_FIELDS_CONFIG[form.eventType] ?? EVENT_TYPE_FIELDS_CONFIG["INNE"];
  const isVisible = (pole: string): boolean =>
    cfg?.[pole] ?? true;

  const totalGuests = useMemo(() => {
    const a = form.adultsCount === "" ? 0 : Number(form.adultsCount) || 0;
    const c03 = form.children03 === "" ? 0 : Number(form.children03) || 0;
    const c47 = form.children47 === "" ? 0 : Number(form.children47) || 0;
    return a + c03 + c47;
  }, [form.adultsCount, form.children03, form.children47]);

  const rooms = form.roomName ? form.roomName.split(/,\s*/).filter(Boolean) : [];
  const toggleRoom = (r: string) => {
    const next = rooms.includes(r) ? rooms.filter((x) => x !== r) : [...rooms, r];
    update("roomName", next.join(", "));
  };

  if (tab === "dane") {
    return (
      <div style={{ padding: "16px 20px" }}>
        <div style={{ marginBottom: "16px" }}>
          <label style={labelStyle}>Typ imprezy</label>
          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
            {EVENT_TYPES.map((t) => {
              const active = form.eventType === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => update("eventType", t.value)}
                  style={{
                    padding: "8px 18px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    border: `1px solid ${active ? "#1e1e1e" : "#ddd"}`,
                    background: active ? "#1e1e1e" : "white",
                    color: active ? "white" : "#666",
                    fontSize: "15px",
                    fontWeight: 600,
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
        <Field label="Imię i nazwisko klienta" value={form.clientName} onChange={(v) => update("clientName", v)} placeholder="np. Jan Kowalski" />
        <Field label="Telefon" value={form.clientPhone} onChange={(v) => update("clientPhone", v)} placeholder="np. 500 123 456" type="tel" />
        {isVisible("clientEmail") && <Field label="Email klienta" value={form.clientEmail} onChange={(v) => update("clientEmail", v)} placeholder="np. jan@kowalski.pl" type="email" />}
        <Field label="Data imprezy" value={form.eventDate} onChange={(v) => update("eventDate", v)} type="date" />
        <div style={{ marginBottom: "16px" }}>
          <label style={labelStyle}>Sale (można wybrać kilka)</label>
          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
            {ROOMS.map((r) => {
              const active = rooms.includes(r);
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => toggleRoom(r)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    border: `1px solid ${active ? "#1e1e1e" : "#ddd"}`,
                    background: active ? "#1e1e1e" : "white",
                    color: active ? "white" : "#666",
                    fontSize: "15px",
                    fontWeight: 600,
                  }}
                >
                  {r}
                </button>
              );
            })}
          </div>
        </div>
        {isVisible("addPoprawiny") && (
          <>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px", fontSize: "12px", color: "#666", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={form.addPoprawiny}
                onChange={(e) => {
                  update("addPoprawiny", e.target.checked);
                  if (e.target.checked && form.eventDate) {
                    const d = new Date(form.eventDate + "T12:00:00");
                    d.setDate(d.getDate() + 1);
                    update("poprawinyDate", d.toISOString().slice(0, 10));
                  }
                }}
              />
              Dodaj poprawiny (dzień po weselu)
            </label>
            {form.addPoprawiny && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px", paddingLeft: "16px", borderLeft: "2px solid #eee" }}>
                <Field label="Data poprawin" value={form.poprawinyDate} onChange={(v) => update("poprawinyDate", v)} type="date" />
                <div>
                  <label style={labelStyle}>Liczba gości na poprawinach</label>
                  <input
                    type="number"
                    min={0}
                    value={form.poprawinyGuestCount === "" ? "" : form.poprawinyGuestCount}
                    onChange={(e) => update("poprawinyGuestCount", e.target.value === "" ? "" : parseInt(e.target.value, 10))}
                    style={inputStyle}
                  />
                </div>
              </div>
            )}
          </>
        )}
        {isVisible("depositAmount") && <Field label="Zadatek (zł)" value={form.depositAmount} onChange={(v) => update("depositAmount", v)} placeholder="np. 1500,50" />}
        {isVisible("depositDueDate") && <Field label="Termin płatności zadatku" value={form.depositDueDate} onChange={(v) => update("depositDueDate", v)} type="date" />}
        {isVisible("depositPaid") && (
        <div style={{ display: "flex", gap: "8px", marginTop: "12px", marginBottom: "16px" }}>
          <button
            type="button"
            onClick={() => update("depositPaid", true)}
            style={{
              padding: "6px 14px",
              borderRadius: "4px",
              cursor: "pointer",
              border: `1px solid ${form.depositPaid ? "#1e1e1e" : "#ddd"}`,
              background: form.depositPaid ? "#1e1e1e" : "white",
              color: form.depositPaid ? "white" : "#666",
              fontSize: "12px",
              fontWeight: 600,
            }}
          >
            ✅ Zapłacony
          </button>
          <button
            type="button"
            onClick={() => update("depositPaid", false)}
            style={{
              padding: "6px 14px",
              borderRadius: "4px",
              cursor: "pointer",
              border: `1px solid ${!form.depositPaid ? "#1e1e1e" : "#ddd"}`,
              background: !form.depositPaid ? "#1e1e1e" : "white",
              color: !form.depositPaid ? "white" : "#666",
              fontSize: "12px",
              fontWeight: 600,
            }}
          >
            ❌ Niezapłacony
          </button>
        </div>
        )}
      </div>
    );
  }

  if (tab === "goscie") {
    return (
      <div style={{ padding: "16px 20px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "16px" }}>
          <TimeSelect label="Godzina rozpoczęcia" value={form.timeStart} onChange={(v) => update("timeStart", v)} />
          <TimeSelect label="Godzina zakończenia" value={form.timeEnd} onChange={(v) => update("timeEnd", v)} />
          {isVisible("churchTime") && <TimeSelect label="Godzina kościoła" value={form.churchTime} onChange={(v) => update("churchTime", v)} />}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "12px", marginBottom: "16px" }}>
          <NumField label="Dorośli" value={form.adultsCount} onChange={(v) => update("adultsCount", v)} />
          {isVisible("children03") && <NumField label="Dzieci 0–3" value={form.children03} onChange={(v) => update("children03", v)} />}
          {isVisible("children47") && <NumField label="Dzieci 4–7" value={form.children47} onChange={(v) => update("children47", v)} />}
          <div style={{ marginBottom: "12px" }}>
            <label style={labelStyle}>Łącznie</label>
            <div style={{ padding: "8px 12px", fontSize: "14px", fontWeight: 700, color: "#1e1e1e" }}>
              {totalGuests || "—"}
            </div>
          </div>
        </div>
        {(() => {
          const selectedRooms = form.roomName ? form.roomName.split(/,\s*/).filter(Boolean) : [];
          const guests = totalGuests || 0;
          const warnings: string[] = [];
          selectedRooms.forEach((rn) => {
            const rd = ROOMS_DATA.find((r) => r.name === rn);
            if (rd && rd.capacity != null && guests > rd.capacity) {
              warnings.push(`${rn}: max ${rd.capacity} os., wpisano ${guests}`);
            }
          });
          if (warnings.length === 0) return null;
          return (
            <div style={{ background: "#fff3e0", border: "1px solid #ffcc80", borderRadius: "4px", padding: "6px 10px", fontSize: "11px", color: "#e65100", marginTop: "12px" }}>
              ⚠️ {warnings.join(" · ")}
            </div>
          );
        })()}
        {(isVisible("orchestraCount") || isVisible("cameramanCount") || isVisible("photographerCount")) && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginTop: "16px" }}>
            {isVisible("orchestraCount") && <NumField label="Orkiestra/DJ (os.)" value={form.orchestraCount} onChange={(v) => update("orchestraCount", v)} />}
            {isVisible("cameramanCount") && <NumField label="Kamerzysta" value={form.cameramanCount} onChange={(v) => update("cameramanCount", v)} />}
            {isVisible("photographerCount") && <NumField label="Fotograf" value={form.photographerCount} onChange={(v) => update("photographerCount", v)} />}
          </div>
        )}
      </div>
    );
  }

  if (tab === "menu") {
    return (
      <div style={{ padding: "16px 20px" }}>
        {evForMenu && onMenuSave && (
          <div style={{ marginBottom: "20px" }}>
            <MenuTab ev={evForMenu} savedMenu={menuData as { pakietId?: string | null; wybory?: Record<string, string[]>; doplaty?: Record<string, boolean>; dopWybory?: Record<string, string[]>; notatka?: string } | null} onSave={onMenuSave} />
          </div>
        )}
        {isVisible("cakesAndDesserts") && (
          <div>
            <label style={labelStyle}>Torty i desery</label>
            <textarea
              value={form.cakesAndDesserts}
              onChange={(e) => update("cakesAndDesserts", e.target.value)}
              rows={3}
              placeholder="Opis tortów i deserów…"
              style={{ ...inputStyle, resize: "vertical", minHeight: "60px" }}
            />
          </div>
        )}
        {(isVisible("cakeOrderedAt") || isVisible("cakeArrivalTime") || isVisible("cakeServedAt") || isVisible("drinksArrival") || isVisible("drinksStorage") || isVisible("champagneStorage") || isVisible("firstBottlesBy") || isVisible("alcoholAtTeamTable")) && (
          <>
            <div style={{ marginTop: "20px", marginBottom: "12px", fontSize: "11px", fontWeight: 700, color: "#888", borderTop: "1px solid #eee", paddingTop: "16px" }}>
              ─── Tort i napoje ───
            </div>
            {isVisible("cakeOrderedAt") && <Field label="Tort – gdzie zamówiony" value={form.cakeOrderedAt} onChange={(v) => update("cakeOrderedAt", v)} placeholder="np. Cukiernia X" />}
            {(isVisible("cakeArrivalTime") || isVisible("cakeServedAt")) && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                {isVisible("cakeArrivalTime") && <TimeSelect label="Przyjazd tortu" value={form.cakeArrivalTime} onChange={(v) => update("cakeArrivalTime", v)} />}
                {isVisible("cakeServedAt") && <TimeSelect label="Podanie tortu" value={form.cakeServedAt} onChange={(v) => update("cakeServedAt", v)} />}
              </div>
            )}
            {(isVisible("drinksArrival") || isVisible("drinksStorage") || isVisible("champagneStorage") || isVisible("firstBottlesBy") || isVisible("alcoholAtTeamTable")) && (
              <>
                <div style={{ marginTop: "12px", marginBottom: "8px", fontSize: "11px", fontWeight: 700, color: "#888" }}>Napoje</div>
                {isVisible("drinksArrival") && <Field label="Dostarczenie napojów" value={form.drinksArrival} onChange={(v) => update("drinksArrival", v)} />}
                {isVisible("drinksStorage") && <Field label="Przechowywanie napojów" value={form.drinksStorage} onChange={(v) => update("drinksStorage", v)} />}
                {isVisible("champagneStorage") && <Field label="Przechowywanie szampana" value={form.champagneStorage} onChange={(v) => update("champagneStorage", v)} />}
                {isVisible("firstBottlesBy") && <Field label="Pierwsze butelki serwuje" value={form.firstBottlesBy} onChange={(v) => update("firstBottlesBy", v)} />}
                {isVisible("alcoholAtTeamTable") && <YesNoButton label="Napoje na stole zespołu" value={form.alcoholAtTeamTable} onChange={(v) => update("alcoholAtTeamTable", v)} />}
              </>
            )}
          </>
        )}
      </div>
    );
  }

  if (tab === "szczegoly") {
    return (
      <div style={{ padding: "16px 20px" }}>
        <div style={{ marginBottom: "12px", fontSize: "11px", fontWeight: 700, color: "#888" }}>─── Dekoracje i układ ───</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px", marginBottom: "16px" }}>
          {isVisible("cakesSwedishTable") && <YesNoButton label="Ciasta — stół szwedzki" value={form.cakesSwedishTable} onChange={(v) => update("cakesSwedishTable", v)} />}
          {isVisible("fruitsSwedishTable") && <YesNoButton label="Owoce — stół szwedzki" value={form.fruitsSwedishTable} onChange={(v) => update("fruitsSwedishTable", v)} />}
          {isVisible("ownFlowers") && <YesNoButton label="Własne kwiaty" value={form.ownFlowers} onChange={(v) => update("ownFlowers", v)} />}
          {isVisible("ownVases") && <YesNoButton label="Własne wazony" value={form.ownVases} onChange={(v) => update("ownVases", v)} />}
          {isVisible("placeCards") && <YesNoButton label="Winietki" value={form.placeCards} onChange={(v) => update("placeCards", v)} />}
        </div>
        {isVisible("placeCardsLayout") && form.placeCards && <Field label="Układ winietek" value={form.placeCardsLayout} onChange={(v) => update("placeCardsLayout", v)} />}
        {isVisible("decorationColor") && <Field label="Kolor przewodni dekoracji" value={form.decorationColor} onChange={(v) => update("decorationColor", v)} />}
        {isVisible("tableLayout") && (
          <div>
            <label style={labelStyle}>Układ stołów</label>
            <textarea value={form.tableLayout} onChange={(e) => update("tableLayout", e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
          </div>
        )}
        {isVisible("brideGroomTable") && <Field label="Stół Pary Młodej" value={form.brideGroomTable} onChange={(v) => update("brideGroomTable", v)} />}
        {isVisible("orchestraTable") && <Field label="Stół orkiestry" value={form.orchestraTable} onChange={(v) => update("orchestraTable", v)} />}
        {isVisible("breadWelcomeBy") && <Field label="Powitanie chlebem — kto?" value={form.breadWelcomeBy} onChange={(v) => update("breadWelcomeBy", v)} />}

        <div style={{ marginTop: "20px", marginBottom: "12px", fontSize: "11px", fontWeight: 700, color: "#888" }}>─── Dodatkowe ───</div>
        {isVisible("extraAttractions") && (
          <div>
            <label style={labelStyle}>Dodatkowe atrakcje</label>
            <textarea value={form.extraAttractions} onChange={(e) => update("extraAttractions", e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
          </div>
        )}
        {isVisible("specialRequests") && (
          <div>
            <label style={labelStyle}>Specjalne życzenia</label>
            <textarea value={form.specialRequests} onChange={(e) => update("specialRequests", e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
          </div>
        )}
        {isVisible("facebookConsent") && <YesNoButton label="Zgoda na Facebook" value={form.facebookConsent} onChange={(v) => update("facebookConsent", v)} />}
        {isVisible("ownNapkins") && <YesNoButton label="Własne serwetki" value={form.ownNapkins} onChange={(v) => update("ownNapkins", v)} />}
        {isVisible("dutyPerson") && <Field label="Osoba dyżurna" value={form.dutyPerson} onChange={(v) => update("dutyPerson", v)} />}
        {isVisible("assignedTo") && <Field label="Opiekun imprezy" value={form.assignedTo} onChange={(v) => update("assignedTo", v)} placeholder="np. Marta Kowalska" />}

        {isVisible("afterpartyEnabled") && (
          <>
            <div style={{ marginTop: "20px", marginBottom: "12px", fontSize: "11px", fontWeight: 700, color: "#888" }}>─── Afterparty ───</div>
            <YesNoButton label="Afterparty" value={form.afterpartyEnabled} onChange={(v) => update("afterpartyEnabled", v)} />
            {form.afterpartyEnabled && (
              <>
                {(isVisible("afterpartyTimeFrom") || isVisible("afterpartyTimeTo")) && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    {isVisible("afterpartyTimeFrom") && <TimeSelect label="Od" value={form.afterpartyTimeFrom} onChange={(v) => update("afterpartyTimeFrom", v)} />}
                    {isVisible("afterpartyTimeTo") && <TimeSelect label="Do" value={form.afterpartyTimeTo} onChange={(v) => update("afterpartyTimeTo", v)} />}
                  </div>
                )}
                {isVisible("afterpartyGuests") && <NumField label="Liczba gości afterparty" value={form.afterpartyGuests} onChange={(v) => update("afterpartyGuests", v)} />}
                {isVisible("afterpartyMenu") && (
                  <div>
                    <label style={labelStyle}>Menu afterparty</label>
                    <textarea value={form.afterpartyMenu} onChange={(e) => update("afterpartyMenu", e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
                  </div>
                )}
                {isVisible("afterpartyMusic") && <Field label="Muzyka afterparty" value={form.afterpartyMusic} onChange={(v) => update("afterpartyMusic", v)} />}
              </>
            )}
          </>
        )}

        {isVisible("notes") && (
          <>
            <div style={{ marginTop: "20px", marginBottom: "12px", fontSize: "11px", fontWeight: 700, color: "#888" }}>─── Notatki ───</div>
            <textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} rows={4} placeholder="Dodatkowe informacje..." style={{ ...inputStyle, resize: "vertical" }} />
          </>
        )}
      </div>
    );
  }

  return null;
}
