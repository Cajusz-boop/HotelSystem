"use client";

import { useState, useEffect } from "react";
import { getEventTypeFieldsConfig, updateEventTypeFieldsConfig } from "@/app/actions/hotel-config";

const FIELD_LABELS: Record<string, string> = {
  showChurch:         "Godzina kościoła (ślub)",
  showBrideOrchestra: "Stół Pary Młodej i orkiestry",
  showAfterparty:     "Afterparty",
  showTortNapoje:     "Tort i napoje",
  showPoprawiny:      "Poprawiny",
  showZespol:         "Orkiestra / DJ / Fotograf / Kamerzysta",
  showDekoracje:      "Dekoracje (kwiaty, wazony, winietki, kolor)",
  showFacebook:       "Zgoda na publikację na Facebook",
};

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
                {ile}/{Object.keys(FIELD_LABELS).length}
              </span>
            </button>
          );
        })}
      </div>

      {/* Info ile pól aktywnych */}
      <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "12px" }}>
        Aktywne pola dla <strong>{EVENT_TYPES.find(t => t.value === aktywnyTyp)?.label}</strong>: {wlaczonePola} z {Object.keys(FIELD_LABELS).length}
      </div>

      {/* Lista pól z przełącznikami */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {Object.entries(FIELD_LABELS).map(([pole, label]) => {
          const wlaczone = aktywnaKonfig[pole] ?? false;
          return (
            <div
              key={pole}
              onClick={() => togglePole(pole)}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "14px 18px", borderRadius: "8px", cursor: "pointer",
                border: `1px solid ${wlaczone ? "#86efac" : "#e5e7eb"}`,
                background: wlaczone ? "#f0fdf4" : "#fafafa",
                transition: "border-color 0.15s, background 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = wlaczone ? "#4ade80" : "#cbd5e1"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = wlaczone ? "#86efac" : "#e5e7eb"; }}
            >
              <span style={{ fontSize: "14px", fontWeight: 500, color: "#111827" }}>
                {label}
              </span>
              {/* Toggle switch */}
              <div style={{
                width: "44px", height: "24px", borderRadius: "999px",
                background: wlaczone ? "#22c55e" : "#d1d5db",
                position: "relative", transition: "background 0.2s",
                flexShrink: 0,
              }}>
                <div style={{
                  position: "absolute", top: "3px",
                  left: wlaczone ? "23px" : "3px",
                  width: "18px", height: "18px", borderRadius: "999px",
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
}
