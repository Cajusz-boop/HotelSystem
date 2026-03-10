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
  padding: "8px 12px",
  border: "1px solid #ddd",
  borderRadius: "4px",
  fontSize: "13px",
  outline: "none" as const,
  fontFamily: "inherit",
};
const labelStyle = { fontSize: "11px", fontWeight: 700, color: "#888", textTransform: "uppercase" as const, display: "block" as const, marginBottom: "4px" };

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
}: {
  tab: "dane" | "goscie" | "menu" | "szczegoly";
  form: EventFormTabState;
  update: <K extends keyof EventFormTabState>(k: K, v: EventFormTabState[K]) => void;
  menuData?: Record<string, unknown> | null;
  onMenuSave?: (d: Record<string, unknown>) => void;
  evForMenu?: { type: string; client?: string | null; date: string; guests?: number | null };
}) {
  const showChurch = form.eventType === "WESELE";
  const showBrideOrchestra = form.eventType === "WESELE";
  const showAfterparty = form.eventType === "WESELE" || form.eventType === "URODZINY";
  const hideTortNapoje = form.eventType === "STYPA";
  const showPoprawiny = form.eventType === "WESELE";

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
                    padding: "6px 14px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    border: `1px solid ${active ? "#1e1e1e" : "#ddd"}`,
                    background: active ? "#1e1e1e" : "white",
                    color: active ? "white" : "#666",
                    fontSize: "12px",
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
        <Field label="Email klienta" value={form.clientEmail} onChange={(v) => update("clientEmail", v)} placeholder="np. jan@kowalski.pl" type="email" />
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
                    padding: "6px 12px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    border: `1px solid ${active ? "#1e1e1e" : "#ddd"}`,
                    background: active ? "#1e1e1e" : "white",
                    color: active ? "white" : "#666",
                    fontSize: "12px",
                    fontWeight: 600,
                  }}
                >
                  {r}
                </button>
              );
            })}
          </div>
        </div>
        {showPoprawiny && (
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
        <Field label="Zadatek (zł)" value={form.depositAmount} onChange={(v) => update("depositAmount", v)} placeholder="np. 1500,50" />
        <Field label="Termin płatności zadatku" value={form.depositDueDate} onChange={(v) => update("depositDueDate", v)} type="date" />
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
      </div>
    );
  }

  if (tab === "goscie") {
    return (
      <div style={{ padding: "16px 20px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "16px" }}>
          <TimeSelect label="Godzina rozpoczęcia" value={form.timeStart} onChange={(v) => update("timeStart", v)} />
          <TimeSelect label="Godzina zakończenia" value={form.timeEnd} onChange={(v) => update("timeEnd", v)} />
          {showChurch && <TimeSelect label="Godzina kościoła" value={form.churchTime} onChange={(v) => update("churchTime", v)} />}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "12px", marginBottom: "16px" }}>
          <NumField label="Dorośli" value={form.adultsCount} onChange={(v) => update("adultsCount", v)} />
          <NumField label="Dzieci 0–3" value={form.children03} onChange={(v) => update("children03", v)} />
          <NumField label="Dzieci 4–7" value={form.children47} onChange={(v) => update("children47", v)} />
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginTop: "16px" }}>
          <NumField label="Orkiestra/DJ (os.)" value={form.orchestraCount} onChange={(v) => update("orchestraCount", v)} />
          <NumField label="Kamerzysta" value={form.cameramanCount} onChange={(v) => update("cameramanCount", v)} />
          <NumField label="Fotograf" value={form.photographerCount} onChange={(v) => update("photographerCount", v)} />
        </div>
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
        {!hideTortNapoje && (
          <>
            <div style={{ marginTop: "20px", marginBottom: "12px", fontSize: "11px", fontWeight: 700, color: "#888", borderTop: "1px solid #eee", paddingTop: "16px" }}>
              ─── Tort i napoje ───
            </div>
            <Field label="Tort – gdzie zamówiony" value={form.cakeOrderedAt} onChange={(v) => update("cakeOrderedAt", v)} placeholder="np. Cukiernia X" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <TimeSelect label="Przyjazd tortu" value={form.cakeArrivalTime} onChange={(v) => update("cakeArrivalTime", v)} />
              <TimeSelect label="Podanie tortu" value={form.cakeServedAt} onChange={(v) => update("cakeServedAt", v)} />
            </div>
            <div style={{ marginTop: "12px", marginBottom: "8px", fontSize: "11px", fontWeight: 700, color: "#888" }}>Napoje</div>
            <Field label="Dostarczenie napojów" value={form.drinksArrival} onChange={(v) => update("drinksArrival", v)} />
            <Field label="Przechowywanie napojów" value={form.drinksStorage} onChange={(v) => update("drinksStorage", v)} />
            <Field label="Przechowywanie szampana" value={form.champagneStorage} onChange={(v) => update("champagneStorage", v)} />
            <Field label="Pierwsze butelki serwuje" value={form.firstBottlesBy} onChange={(v) => update("firstBottlesBy", v)} />
            <YesNoButton label="Napoje na stole zespołu" value={form.alcoholAtTeamTable} onChange={(v) => update("alcoholAtTeamTable", v)} />
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
          <YesNoButton label="Ciasta — stół szwedzki" value={form.cakesSwedishTable} onChange={(v) => update("cakesSwedishTable", v)} />
          <YesNoButton label="Owoce — stół szwedzki" value={form.fruitsSwedishTable} onChange={(v) => update("fruitsSwedishTable", v)} />
          <YesNoButton label="Własne kwiaty" value={form.ownFlowers} onChange={(v) => update("ownFlowers", v)} />
          <YesNoButton label="Własne wazony" value={form.ownVases} onChange={(v) => update("ownVases", v)} />
          <YesNoButton label="Winietki" value={form.placeCards} onChange={(v) => update("placeCards", v)} />
        </div>
        {form.placeCards && <Field label="Układ winietek" value={form.placeCardsLayout} onChange={(v) => update("placeCardsLayout", v)} />}
        <Field label="Kolor przewodni dekoracji" value={form.decorationColor} onChange={(v) => update("decorationColor", v)} />
        <div>
          <label style={labelStyle}>Układ stołów</label>
          <textarea value={form.tableLayout} onChange={(e) => update("tableLayout", e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
        </div>
        {showBrideOrchestra && (
          <>
            <Field label="Stół Pary Młodej" value={form.brideGroomTable} onChange={(v) => update("brideGroomTable", v)} />
            <Field label="Stół orkiestry" value={form.orchestraTable} onChange={(v) => update("orchestraTable", v)} />
          </>
        )}
        <Field label="Powitanie chlebem — kto?" value={form.breadWelcomeBy} onChange={(v) => update("breadWelcomeBy", v)} />

        <div style={{ marginTop: "20px", marginBottom: "12px", fontSize: "11px", fontWeight: 700, color: "#888" }}>─── Dodatkowe ───</div>
        <div>
          <label style={labelStyle}>Dodatkowe atrakcje</label>
          <textarea value={form.extraAttractions} onChange={(e) => update("extraAttractions", e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
        </div>
        <div>
          <label style={labelStyle}>Specjalne życzenia</label>
          <textarea value={form.specialRequests} onChange={(e) => update("specialRequests", e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
        </div>
        <YesNoButton label="Zgoda na Facebook" value={form.facebookConsent} onChange={(v) => update("facebookConsent", v)} />
        <YesNoButton label="Własne serwetki" value={form.ownNapkins} onChange={(v) => update("ownNapkins", v)} />
        <Field label="Osoba dyżurna" value={form.dutyPerson} onChange={(v) => update("dutyPerson", v)} />
        <Field label="Opiekun imprezy" value={form.assignedTo} onChange={(v) => update("assignedTo", v)} placeholder="np. Marta Kowalska" />

        {showAfterparty && (
          <>
            <div style={{ marginTop: "20px", marginBottom: "12px", fontSize: "11px", fontWeight: 700, color: "#888" }}>─── Afterparty ───</div>
            <YesNoButton label="Afterparty" value={form.afterpartyEnabled} onChange={(v) => update("afterpartyEnabled", v)} />
            {form.afterpartyEnabled && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <TimeSelect label="Od" value={form.afterpartyTimeFrom} onChange={(v) => update("afterpartyTimeFrom", v)} />
                  <TimeSelect label="Do" value={form.afterpartyTimeTo} onChange={(v) => update("afterpartyTimeTo", v)} />
                </div>
                <NumField label="Liczba gości afterparty" value={form.afterpartyGuests} onChange={(v) => update("afterpartyGuests", v)} />
                <div>
                  <label style={labelStyle}>Menu afterparty</label>
                  <textarea value={form.afterpartyMenu} onChange={(e) => update("afterpartyMenu", e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
                </div>
                <Field label="Muzyka afterparty" value={form.afterpartyMusic} onChange={(v) => update("afterpartyMusic", v)} />
              </>
            )}
          </>
        )}

        <div style={{ marginTop: "20px", marginBottom: "12px", fontSize: "11px", fontWeight: 700, color: "#888" }}>─── Notatki ───</div>
        <textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} rows={4} placeholder="Dodatkowe informacje..." style={{ ...inputStyle, resize: "vertical" }} />
      </div>
    );
  }

  return null;
}
