"use client";

import { useState, useEffect } from "react";
import { getEventTypeFieldsConfig, updateEventTypeFieldsConfig } from "@/app/actions/hotel-config";

type FieldDefinition = {
  label: string;
  tab: "dane" | "goscie" | "menu" | "szczegoly";
  alwaysVisible?: boolean;
};

const ALL_FIELDS: Record<string, FieldDefinition> = {
  // ZAKŁADKA: DANE
  clientName:          { label: "Imię i nazwisko klienta",    tab: "dane",      alwaysVisible: true },
  clientPhone:         { label: "Telefon",                     tab: "dane",      alwaysVisible: true },
  clientEmail:         { label: "Email klienta",               tab: "dane" },
  eventDate:           { label: "Data imprezy",                tab: "dane",      alwaysVisible: true },
  roomName:            { label: "Sale",                        tab: "dane",      alwaysVisible: true },
  addPoprawiny:        { label: "Poprawiny",                   tab: "dane" },
  depositAmount:       { label: "Zadatek (zł)",                tab: "dane" },
  depositDueDate:      { label: "Termin płatności zadatku",    tab: "dane" },
  depositPaid:         { label: "Status zadatku",              tab: "dane" },

  // ZAKŁADKA: GOŚCIE
  timeStart:           { label: "Godzina rozpoczęcia",         tab: "goscie",    alwaysVisible: true },
  timeEnd:             { label: "Godzina zakończenia",         tab: "goscie",    alwaysVisible: true },
  churchTime:          { label: "Godzina kościoła",            tab: "goscie" },
  adultsCount:         { label: "Dorośli",                     tab: "goscie",    alwaysVisible: true },
  children03:          { label: "Dzieci 0–3",                  tab: "goscie" },
  children47:          { label: "Dzieci 4–7",                  tab: "goscie" },
  orchestraCount:      { label: "Orkiestra/DJ (os.)",          tab: "goscie" },
  cameramanCount:      { label: "Kamerzysta",                  tab: "goscie" },
  photographerCount:   { label: "Fotograf",                    tab: "goscie" },

  // ZAKŁADKA: MENU
  cakesAndDesserts:    { label: "Torty i desery",              tab: "menu" },
  cakeOrderedAt:       { label: "Tort – gdzie zamówiony",      tab: "menu" },
  cakeArrivalTime:     { label: "Przyjazd tortu",              tab: "menu" },
  cakeServedAt:        { label: "Podanie tortu",               tab: "menu" },
  drinksArrival:       { label: "Dostarczenie napojów",        tab: "menu" },
  drinksStorage:       { label: "Przechowywanie napojów",      tab: "menu" },
  champagneStorage:    { label: "Przechowywanie szampana",     tab: "menu" },
  firstBottlesBy:      { label: "Pierwsze butelki serwuje",    tab: "menu" },
  alcoholAtTeamTable:  { label: "Napoje na stole zespołu",     tab: "menu" },

  // ZAKŁADKA: SZCZEGÓŁY
  cakesSwedishTable:   { label: "Ciasta — stół szwedzki",      tab: "szczegoly" },
  fruitsSwedishTable:  { label: "Owoce — stół szwedzki",       tab: "szczegoly" },
  ownFlowers:          { label: "Własne kwiaty",               tab: "szczegoly" },
  ownVases:            { label: "Własne wazony",               tab: "szczegoly" },
  placeCards:          { label: "Winietki",                    tab: "szczegoly" },
  placeCardsLayout:    { label: "Układ winietek",              tab: "szczegoly" },
  decorationColor:     { label: "Kolor przewodni dekoracji",   tab: "szczegoly" },
  tableLayout:         { label: "Układ stołów",                tab: "szczegoly" },
  brideGroomTable:     { label: "Stół Pary Młodej",            tab: "szczegoly" },
  orchestraTable:      { label: "Stół orkiestry",              tab: "szczegoly" },
  breadWelcomeBy:      { label: "Powitanie chlebem — kto?",    tab: "szczegoly" },
  extraAttractions:    { label: "Dodatkowe atrakcje",          tab: "szczegoly" },
  specialRequests:     { label: "Specjalne życzenia",          tab: "szczegoly" },
  facebookConsent:     { label: "Zgoda na Facebook",           tab: "szczegoly" },
  ownNapkins:          { label: "Własne serwetki",             tab: "szczegoly" },
  dutyPerson:          { label: "Osoba dyżurna",               tab: "szczegoly" },
  assignedTo:          { label: "Opiekun imprezy",             tab: "szczegoly" },
  afterpartyEnabled:   { label: "Afterparty",                  tab: "szczegoly" },
  afterpartyTimeFrom:  { label: "Afterparty – od",             tab: "szczegoly" },
  afterpartyTimeTo:    { label: "Afterparty – do",             tab: "szczegoly" },
  afterpartyGuests:    { label: "Liczba gości afterparty",     tab: "szczegoly" },
  afterpartyMenu:      { label: "Menu afterparty",             tab: "szczegoly" },
  afterpartyMusic:     { label: "Muzyka afterparty",           tab: "szczegoly" },
  notes:               { label: "Notatki",                     tab: "szczegoly" },
};

const TAB_LABELS: Record<string, string> = {
  dane:      "Dane",
  goscie:    "Goście i czas",
  menu:      "Menu i tort",
  szczegoly: "Szczegóły",
};

const TABS = ["dane", "goscie", "menu", "szczegoly"] as const;

const EVENT_TYPES = [
  { value: "WESELE",    label: "Wesele" },
  { value: "KOMUNIA",   label: "Komunia" },
  { value: "CHRZCINY",  label: "Chrzciny" },
  { value: "URODZINY",  label: "Urodziny" },
  { value: "STYPA",     label: "Stypa" },
  { value: "FIRMOWA",   label: "Firmowa" },
  { value: "SYLWESTER", label: "Sylwester" },
  { value: "INNE",      label: "Inne" },
];

export function EventTypeFieldsConfig({
  onConfigChange,
}: {
  onConfigChange?: (config: Record<string, Record<string, boolean>>) => void;
}) {
  const [config, setConfig] = useState<Record<string, Record<string, boolean>>>({});
  const [aktywnyTyp, setAktywnyTyp] = useState("WESELE");
  const [zapisywanie, setZapisywanie] = useState(false);
  const [zapisano, setZapisano] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEventTypeFieldsConfig().then(result => {
      if (result.success && result.data) {
        setConfig(result.data);
      } else {
        setError("Nie udało się pobrać konfiguracji");
      }
      setLoading(false);
    });
  }, []);

  const togglePole = (pole: string) => {
    setConfig(prev => {
      const next = {
        ...prev,
        [aktywnyTyp]: {
          ...prev[aktywnyTyp],
          [pole]: !prev[aktywnyTyp]?.[pole],
        },
      };
      return next;
    });
  };

  const handleSave = async () => {
    setZapisywanie(true);
    setError(null);
    try {
      const result = await updateEventTypeFieldsConfig(config);
      if (result.success) {
        setZapisano(true);
        onConfigChange?.(config);
        setTimeout(() => setZapisano(false), 2500);
      } else {
        setError(result.error ?? "Błąd zapisu");
      }
    } catch {
      setError("Błąd zapisu konfiguracji");
    } finally {
      setZapisywanie(false);
    }
  };

  if (loading) return (
    <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
      Ładowanie konfiguracji...
    </div>
  );

  const aktywnaKonfig = config[aktywnyTyp] ?? {};
  const wlaczonePola = Object.values(aktywnaKonfig).filter(Boolean).length;

  return (
    <div style={{ padding: "24px", maxWidth: "720px" }}>

      {/* Nagłówek */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#111827" }}>
            Typy formularzy
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748b" }}>
            Wybierz typ imprezy i włącz lub wyłącz pola w formularzu
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={zapisywanie}
          style={{
            background: zapisano ? "#22c55e" : "#3b82f6",
            color: "white", border: "none", borderRadius: "6px",
            padding: "10px 24px", cursor: zapisywanie ? "not-allowed" : "pointer",
            fontSize: "14px", fontWeight: 600, opacity: zapisywanie ? 0.7 : 1,
            transition: "background 0.2s",
          }}
        >
          {zapisano ? "✓ Zapisano!" : zapisywanie ? "Zapisywanie..." : "Zapisz zmiany"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: "6px", padding: "10px 14px", marginBottom: "16px", fontSize: "13px", color: "#991b1b" }}>
          {error}
        </div>
      )}

      {/* Zakładki typów imprez */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "20px" }}>
        {EVENT_TYPES.map(t => {
          const konfig = config[t.value] ?? {};
          const ile = Object.values(konfig).filter(Boolean).length;
          return (
            <button
              key={t.value}
              onClick={() => setAktywnyTyp(t.value)}
              style={{
                padding: "8px 16px", borderRadius: "6px",
                border: `1px solid ${aktywnyTyp === t.value ? "#3b82f6" : "#e5e7eb"}`,
                background: aktywnyTyp === t.value ? "#eff6ff" : "#fff",
                color: aktywnyTyp === t.value ? "#1e40af" : "#374151",
                fontWeight: aktywnyTyp === t.value ? 700 : 400,
                cursor: "pointer", fontSize: "13px",
                display: "flex", alignItems: "center", gap: "6px",
              }}
            >
              {t.label}
              <span style={{
                fontSize: "11px", fontWeight: 600,
                background: aktywnyTyp === t.value ? "#3b82f6" : "#f1f5f9",
                color: aktywnyTyp === t.value ? "white" : "#64748b",
                borderRadius: "999px", padding: "1px 7px",
              }}>
                {ile}/{Object.keys(ALL_FIELDS).length}
              </span>
            </button>
          );
        })}
      </div>

      {/* Info ile pól aktywnych */}
      <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "12px" }}>
        Aktywne pola dla <strong>{EVENT_TYPES.find(t => t.value === aktywnyTyp)?.label}</strong>: {wlaczonePola} z {Object.keys(ALL_FIELDS).length}
      </div>

      {/* Lista pól z przełącznikami, pogrupowana według zakładek */}
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {TABS.map(tabKey => {
          const polaWTab = Object.entries(ALL_FIELDS).filter(([, def]) => def.tab === tabKey);
          return (
            <div key={tabKey}>
              <div style={{
                fontSize: "11px", fontWeight: 700, color: "#9ca3af",
                letterSpacing: "0.08em", textTransform: "uppercase",
                marginBottom: "8px", paddingBottom: "6px",
                borderBottom: "1px solid #f3f4f6",
              }}>
                {TAB_LABELS[tabKey]}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {polaWTab.map(([pole, def]) => {
                  const wlaczone = aktywnaKonfig[pole] ?? false;
                  const zawsze = def.alwaysVisible ?? false;
                  return (
                    <div
                      key={pole}
                      onClick={() => !zawsze && togglePole(pole)}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "11px 16px", borderRadius: "7px", cursor: zawsze ? "default" : "pointer",
                        border: `1px solid ${zawsze ? "#e5e7eb" : wlaczone ? "#86efac" : "#e5e7eb"}`,
                        background: zawsze ? "#f8fafc" : wlaczone ? "#f0fdf4" : "#fafafa",
                        opacity: zawsze ? 0.7 : 1,
                        transition: "border-color 0.15s, background 0.15s",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "13px", fontWeight: 500, color: "#111827" }}>
                          {def.label}
                        </span>
                        {zawsze && (
                          <span style={{ fontSize: "10px", color: "#9ca3af", background: "#f1f5f9", padding: "1px 6px", borderRadius: "4px" }}>
                            zawsze
                          </span>
                        )}
                      </div>
                      <div style={{
                        width: "40px", height: "22px", borderRadius: "999px",
                        background: zawsze ? "#d1d5db" : wlaczone ? "#22c55e" : "#d1d5db",
                        position: "relative", transition: "background 0.2s", flexShrink: 0,
                      }}>
                        <div style={{
                          position: "absolute", top: "3px",
                          left: (zawsze || wlaczone) ? "21px" : "3px",
                          width: "16px", height: "16px", borderRadius: "999px",
                          background: "white", transition: "left 0.2s",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
