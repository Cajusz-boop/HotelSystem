"use client";

import { useState, useEffect, useCallback } from "react";
import { DishAutocomplete } from "./dish-autocomplete";
import { DishesView } from "./dishes-view";
import { EventTypeFieldsConfig } from "./event-type-fields-config";

type MenuPackageSection = {
  id?: string;
  code: string;
  label: string;
  type: "fixed" | "wybor";
  choiceLimit?: number | null;
  dishes: string[];
  dishIds?: string[];
};

type MenuPackageSurcharge = {
  id?: string;
  code: string;
  label: string;
  pricePerPerson?: number | null;
  flatPrice?: number | null;
  hasChoice?: boolean;
  choiceLimit?: number | null;
  options?: string[] | null;
  description?: string | null;
};

type ApiPackage = {
  id: string;
  code: string;
  name: string;
  price: number | { toNumber?: () => number };
  eventTypes: string[];
  isActive: boolean;
  sections: { id: string; code: string; label: string; type: string; choiceLimit?: number | null; dishes: string[]; dishIds?: string[] | null }[];
  surcharges: { id: string; code: string; label: string; pricePerPerson?: number | null; flatPrice?: number | null; hasChoice?: boolean; choiceLimit?: number | null; options?: string[] | null; description?: string | null }[];
  rules?: string[] | null;
};

const EVENT_TYPES = [
  { value: "WESELE", label: "Wesele" },
  { value: "KOMUNIA", label: "Komunia" },
  { value: "CHRZCINY", label: "Chrzciny" },
  { value: "URODZINY", label: "Urodziny" },
  { value: "STYPA", label: "Stypa" },
  { value: "FIRMOWA", label: "Firmowa" },
  { value: "SYLWESTER", label: "Sylwester" },
  { value: "INNE", label: "Inne" },
];

const toNum = (v: number | { toNumber?: () => number } | null | undefined): number =>
  v != null && typeof v === "object" && "toNumber" in v ? (v as { toNumber: () => number }).toNumber() : Number(v ?? 0);

function parseDishes(text: string): string[] {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function MenuPackagesView({
  onEventTypeFieldsConfigChange,
}: {
  onEventTypeFieldsConfigChange?: (config: Record<string, Record<string, boolean>>) => void;
} = {}) {
  const [subTab, setSubTab] = useState<"pakiety" | "slownik" | "formularze">("pakiety");
  const [packages, setPackages] = useState<ApiPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ApiPackage | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    code: "",
    price: "",
    eventTypes: [] as string[],
    sections: [] as MenuPackageSection[],
    surcharges: [] as MenuPackageSurcharge[],
    rules: [] as string[],
    isActive: true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/menu-packages?includeInactive=true");
      const data = await res.json();
      setPackages(Array.isArray(data) ? data : []);
    } catch {
      setPackages([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setForm({
      name: "",
      code: "",
      price: "",
      eventTypes: [],
      sections: [],
      surcharges: [],
      rules: [],
      isActive: true,
    });
    setEditing(null);
    setCreating(false);
    setError(null);
  };

  const startCreate = () => {
    setForm({
      name: "Nowy pakiet",
      code: `pkg_${Date.now()}`,
      price: "0",
      eventTypes: [],
      sections: [],
      surcharges: [],
      rules: [],
      isActive: true,
    });
    setCreating(true);
    setEditing(null);
  };

  const startEdit = (pkg: ApiPackage) => {
    setForm({
      name: pkg.name,
      code: pkg.code,
      price: String(toNum(pkg.price)),
      eventTypes: Array.isArray(pkg.eventTypes) ? [...pkg.eventTypes] : [],
      sections: (pkg.sections || []).map((s) => {
        const dishIds = Array.isArray(s.dishIds) ? s.dishIds.filter(Boolean) : [];
        const dishes = Array.isArray(s.dishes) ? s.dishes : [];
        return {
          code: s.code,
          label: s.label,
          type: (s.type || "fixed") as "fixed" | "wybor",
          choiceLimit: s.choiceLimit ?? null,
          dishes,
          dishIds: dishIds.length ? dishIds : undefined,
        };
      }),
      surcharges: (pkg.surcharges || []).map((s) => ({
        code: s.code,
        label: s.label,
        pricePerPerson: s.pricePerPerson != null ? toNum(s.pricePerPerson) : null,
        flatPrice: s.flatPrice != null ? toNum(s.flatPrice) : null,
        hasChoice: s.hasChoice ?? false,
        choiceLimit: s.choiceLimit ?? null,
        options: Array.isArray(s.options) ? [...s.options] : null,
        description: s.description ?? null,
      })),
      rules: Array.isArray(pkg.rules) ? [...pkg.rules] : [],
      isActive: pkg.isActive ?? true,
    });
    setEditing(pkg);
    setCreating(false);
  };

  const toggleEventType = (val: string) => {
    setForm((f) => ({
      ...f,
      eventTypes: f.eventTypes.includes(val) ? f.eventTypes.filter((e) => e !== val) : [...f.eventTypes, val],
    }));
  };

  const addSection = () => {
    setForm((f) => ({
      ...f,
      sections: [...f.sections, { code: `sekcja_${f.sections.length}`, label: `Sekcja ${f.sections.length + 1}`, type: "wybor", choiceLimit: 1, dishes: [], dishIds: [] }],
    }));
  };

  const updateSection = (i: number, upd: Partial<MenuPackageSection>) => {
    setForm((f) => {
      const s = [...f.sections];
      s[i] = { ...s[i], ...upd };
      return { ...f, sections: s };
    });
  };

  const removeSection = (i: number) => {
    setForm((f) => ({ ...f, sections: f.sections.filter((_, idx) => idx !== i) }));
  };

  const addSurcharge = () => {
    setForm((f) => ({
      ...f,
      surcharges: [...f.surcharges, { code: `doplata_${f.surcharges.length}`, label: `Dopłata ${f.surcharges.length + 1}`, pricePerPerson: null, flatPrice: null, hasChoice: false }],
    }));
  };

  const updateSurcharge = (i: number, upd: Partial<MenuPackageSurcharge>) => {
    setForm((f) => {
      const s = [...f.surcharges];
      s[i] = { ...s[i], ...upd };
      return { ...f, surcharges: s };
    });
  };

  const removeSurcharge = (i: number) => {
    setForm((f) => ({ ...f, surcharges: f.surcharges.filter((_, idx) => idx !== i) }));
  };

  const addRule = () => {
    setForm((f) => ({ ...f, rules: [...f.rules, ""] }));
  };

  const updateRule = (i: number, val: string) => {
    setForm((f) => {
      const r = [...f.rules];
      r[i] = val;
      return { ...f, rules: r };
    });
  };

  const removeRule = (i: number) => {
    setForm((f) => ({ ...f, rules: f.rules.filter((_, idx) => idx !== i) }));
  };

  const handleSave = async () => {
    setError(null);
    if (!form.name.trim()) {
      setError("Podaj nazwę pakietu.");
      return;
    }
    if (!form.code.trim()) {
      setError("Podaj kod pakietu.");
      return;
    }
    const price = parseFloat(form.price);
    if (isNaN(price) || price < 0) {
      setError("Podaj poprawną cenę (liczba >= 0).");
      return;
    }

    const body = {
      name: form.name.trim(),
      code: form.code.trim(),
      price,
      eventTypes: form.eventTypes,
      isActive: form.isActive,
      sortOrder: 0,
      rules: form.rules.filter(Boolean).length ? form.rules.filter(Boolean) : null,
      sections: form.sections.map((s) => {
        const dishIds = Array.isArray(s.dishIds) ? s.dishIds.filter(Boolean) : [];
        const dishes = Array.isArray(s.dishes) ? s.dishes : parseDishes(typeof s.dishes === "string" ? (s.dishes as unknown as string) : "");
        return {
          code: s.code.trim() || `sekcja_${s.label}`,
          label: s.label.trim() || "Sekcja",
          type: s.type,
          choiceLimit: s.type === "wybor" ? (s.choiceLimit ?? 1) : null,
          dishes: dishIds.length ? [] : dishes,
          dishIds: dishIds.length ? dishIds : undefined,
        };
      }),
      surcharges: form.surcharges.map((s) => ({
        code: s.code.trim() || `doplata_${s.label}`,
        label: s.label.trim() || "Dopłata",
        pricePerPerson: s.pricePerPerson != null && s.pricePerPerson > 0 ? s.pricePerPerson : null,
        flatPrice: s.flatPrice != null && s.flatPrice > 0 ? s.flatPrice : null,
        hasChoice: s.hasChoice ?? false,
        choiceLimit: s.hasChoice ? (s.choiceLimit ?? null) : null,
        options: s.hasChoice && Array.isArray(s.options) && s.options.length ? s.options : null,
        description: s.description?.trim() || null,
      })),
    };

    setSaving(true);
    try {
      if (editing) {
        const res = await fetch(`/api/menu-packages/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Błąd zapisu");
        await load();
        resetForm();
      } else {
        const res = await fetch("/api/menu-packages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Błąd tworzenia");
        await load();
        resetForm();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Wystąpił błąd.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (pkg: ApiPackage) => {
    if (!confirm(`Usunąć pakiet „${pkg.name}"? Będzie oznaczony jako nieaktywny.`)) return;
    try {
      await fetch(`/api/menu-packages/${pkg.id}`, { method: "DELETE" });
      await load();
      if (editing?.id === pkg.id) resetForm();
    } catch {
      setError("Błąd usuwania.");
    }
  };

  const showForm = creating || editing;

  return (
    <div style={{ padding: "24px", maxWidth: "1100px", margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px", borderBottom: "2px solid #e5e7eb", paddingBottom: "12px" }}>
        <button onClick={() => setSubTab("pakiety")} style={{ padding: "8px 16px", border: "none", background: subTab === "pakiety" ? "#3b82f6" : "transparent", color: subTab === "pakiety" ? "white" : "#6b7280", borderRadius: "8px", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}>
          Pakiety menu
        </button>
        <button onClick={() => setSubTab("slownik")} style={{ padding: "8px 16px", border: "none", background: subTab === "slownik" ? "#3b82f6" : "transparent", color: subTab === "slownik" ? "white" : "#6b7280", borderRadius: "8px", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}>
          Słownik dań
        </button>
        <button onClick={() => setSubTab("formularze")} style={{ padding: "8px 16px", border: "none", background: subTab === "formularze" ? "#3b82f6" : "transparent", color: subTab === "formularze" ? "white" : "#6b7280", borderRadius: "8px", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}>
          Typy formularzy
        </button>
      </div>

      {subTab === "slownik" && <DishesView />}

      {subTab === "formularze" && (
        <EventTypeFieldsConfig onConfigChange={onEventTypeFieldsConfigChange} />
      )}

      {subTab === "pakiety" && (
        <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: 800, color: "#1e1e1e", margin: 0 }}>Pakiety menu</h2>
        <div style={{ display: "flex", gap: "8px" }}>
          {!showForm && (
            <button onClick={startCreate} style={{ background: "#3b82f6", color: "white", border: "none", borderRadius: "8px", padding: "10px 18px", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}>
              + Nowy pakiet
            </button>
          )}
        </div>
      </div>

      {showForm ? (
        <div style={{ background: "white", border: "2px solid #3b82f6", borderRadius: "12px", padding: "24px", marginBottom: "24px" }}>
          <div style={{ fontSize: "16px", fontWeight: 800, marginBottom: "20px", color: "#1e1e1e" }}>{editing ? "Edycja pakietu" : "Nowy pakiet"}</div>
          {error && (
            <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: "8px", padding: "12px", marginBottom: "16px", color: "#991b1b", fontWeight: 600 }}>
              {error}
            </div>
          )}

          <div style={{ display: "grid", gap: "16px", marginBottom: "20px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#374151", marginBottom: "4px" }}>Nazwa</label>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={{ width: "100%", padding: "10px 12px", border: "2px solid #e5e7eb", borderRadius: "8px", fontSize: "14px" }} placeholder="np. Pakiet Premium" />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#374151", marginBottom: "4px" }}>Kod (unikalny)</label>
                <input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} style={{ width: "100%", padding: "10px 12px", border: "2px solid #e5e7eb", borderRadius: "8px", fontSize: "14px" }} placeholder="np. wesele_290" disabled={!!editing} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#374151", marginBottom: "4px" }}>Cena zł/os</label>
                <input type="number" min={0} step={1} value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} style={{ width: "100%", padding: "10px 12px", border: "2px solid #e5e7eb", borderRadius: "8px", fontSize: "14px" }} />
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: "8px", flexWrap: "wrap" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "14px" }}>
                  <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
                  Aktywny (widoczny w wyborze)
                </label>
              </div>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#374151", marginBottom: "8px" }}>Typy imprez</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {EVENT_TYPES.map((t) => (
                  <label key={t.value} style={{ display: "flex", alignItems: "center", gap: "4px", cursor: "pointer", padding: "6px 12px", background: form.eventTypes.includes(t.value) ? "#eff6ff" : "#f3f4f6", borderRadius: "8px", border: `1px solid ${form.eventTypes.includes(t.value) ? "#3b82f6" : "#e5e7eb"}`, fontSize: "13px" }}>
                    <input type="checkbox" checked={form.eventTypes.includes(t.value)} onChange={() => toggleEventType(t.value)} />
                    {t.label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "20px", marginBottom: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <div style={{ fontSize: "14px", fontWeight: 800, color: "#374151" }}>Sekcje menu</div>
              <button onClick={addSection} style={{ background: "#10b981", color: "white", border: "none", borderRadius: "6px", padding: "6px 14px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                + Dodaj sekcję
              </button>
            </div>
            {form.sections.map((sec, i) => (
              <div key={i} style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: "10px", padding: "16px", marginBottom: "12px" }}>
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "10px" }}>
                  <input value={sec.label} onChange={(e) => updateSection(i, { label: e.target.value })} placeholder="Nazwa sekcji" style={{ flex: 1, minWidth: "120px", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: "6px", fontSize: "13px" }} />
                  <select value={sec.type} onChange={(e) => updateSection(i, { type: e.target.value as "fixed" | "wybor" })} style={{ padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: "6px", fontSize: "13px" }}>
                    <option value="fixed">Stałe (w cenie)</option>
                    <option value="wybor">Wybór (klient wybiera X z listy)</option>
                  </select>
                  {sec.type === "wybor" && (
                    <input type="number" min={1} value={sec.choiceLimit ?? 1} onChange={(e) => updateSection(i, { choiceLimit: parseInt(e.target.value) || 1 })} placeholder="Limit" style={{ width: "70px", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: "6px", fontSize: "13px" }} />
                  )}
                  <button onClick={() => removeSection(i)} style={{ background: "#ef4444", color: "white", border: "none", borderRadius: "6px", padding: "6px 12px", fontSize: "12px", cursor: "pointer" }}>
                    Usuń
                  </button>
                </div>
                <div>
                  <label style={{ fontSize: "11px", color: "#6b7280", display: "block", marginBottom: "4px" }}>
                    Dania (wybierz ze słownika — <a href="#" onClick={(e) => { e.preventDefault(); setSubTab("slownik"); }} style={{ color: "#3b82f6", textDecoration: "underline" }}>dodaj do słownika</a>)
                  </label>
                  {(sec.dishes?.length ?? 0) > 0 && !(sec.dishIds?.length ?? 0) && (
                    <div style={{ fontSize: "12px", color: "#92400e", background: "#fefce8", padding: "8px 10px", borderRadius: "6px", marginBottom: "8px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                      <span>Stary format: {sec.dishes.join(", ")}</span>
                      <button
                        type="button"
                        onClick={async () => {
                          const raw = sec.dishes || [];
                          const names = raw.flatMap((s) => String(s).split(",").map((x) => x.trim()).filter(Boolean));
                          if (!names.length) return;
                          try {
                            const res = await fetch("/api/dishes/ensure", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ names }),
                            });
                            const items = await res.json();
                            if (Array.isArray(items) && items.length) {
                              updateSection(i, { dishIds: items.map((x: { id: string }) => x.id), dishes: items.map((x: { name: string }) => x.name) });
                            }
                          } catch { /* ignore */ }
                        }}
                        style={{ background: "#3b82f6", color: "white", border: "none", borderRadius: "6px", padding: "6px 12px", fontSize: "12px", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}
                      >
                        Dodaj te dania do słownika
                      </button>
                    </div>
                  )}
                  <DishAutocomplete
                    value={(sec.dishIds || []).map((id, idx) => ({ id, name: (sec.dishes || [])[idx] ?? id }))}
                    onChange={(items) => updateSection(i, { dishIds: items.map((x) => x.id), dishes: items.map((x) => x.name) })}
                    placeholder="Wpisz aby wyszukać danie ze słownika"
                  />
                </div>
              </div>
            ))}
          </div>

          <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "20px", marginBottom: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <div style={{ fontSize: "14px", fontWeight: 800, color: "#374151" }}>Dopłaty</div>
              <button onClick={addSurcharge} style={{ background: "#8b5cf6", color: "white", border: "none", borderRadius: "6px", padding: "6px 14px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                + Dopłata
              </button>
            </div>
            {form.surcharges.map((sur, i) => (
              <div key={i} style={{ background: "#f5f3ff", border: "1px solid #e9e5ff", borderRadius: "10px", padding: "12px 16px", marginBottom: "10px", display: "grid", gridTemplateColumns: "1fr auto auto auto auto", gap: "10px", alignItems: "center" }}>
                <input value={sur.label} onChange={(e) => updateSurcharge(i, { label: e.target.value })} placeholder="Nazwa dopłaty" style={{ padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: "6px", fontSize: "13px" }} />
                <input type="number" min={0} placeholder="zł/os" value={sur.pricePerPerson ?? ""} onChange={(e) => updateSurcharge(i, { pricePerPerson: e.target.value ? parseFloat(e.target.value) : null })} style={{ width: "80px", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: "6px", fontSize: "13px" }} />
                <input type="number" min={0} placeholder="zł ryczałt" value={sur.flatPrice ?? ""} onChange={(e) => updateSurcharge(i, { flatPrice: e.target.value ? parseFloat(e.target.value) : null })} style={{ width: "90px", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: "6px", fontSize: "13px" }} />
                <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", cursor: "pointer" }}>
                  <input type="checkbox" checked={sur.hasChoice ?? false} onChange={(e) => updateSurcharge(i, { hasChoice: e.target.checked })} />
                  Opcje
                </label>
                <button onClick={() => removeSurcharge(i)} style={{ background: "#ef4444", color: "white", border: "none", borderRadius: "6px", padding: "6px 10px", fontSize: "12px", cursor: "pointer" }}>
                  Usuń
                </button>
                {sur.hasChoice && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <input
                      value={Array.isArray(sur.options) ? sur.options.join(", ") : ""}
                      onChange={(e) => updateSurcharge(i, { options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                      placeholder="Opcje (po przecinku)"
                      style={{ width: "100%", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: "6px", fontSize: "13px" }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: "20px", marginBottom: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <div style={{ fontSize: "14px", fontWeight: 800, color: "#374151" }}>Regulamin (opcjonalnie)</div>
              <button onClick={addRule} style={{ background: "#64748b", color: "white", border: "none", borderRadius: "6px", padding: "6px 12px", fontSize: "12px", cursor: "pointer" }}>
                + Punkt
              </button>
            </div>
            {form.rules.map((r, i) => (
              <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                <input value={r} onChange={(e) => updateRule(i, e.target.value)} placeholder="Punkt regulaminu" style={{ flex: 1, padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: "6px", fontSize: "13px" }} />
                <button onClick={() => removeRule(i)} style={{ background: "#ef4444", color: "white", border: "none", borderRadius: "6px", padding: "6px 10px", fontSize: "12px", cursor: "pointer" }}>
                  Usuń
                </button>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: "12px" }}>
            <button onClick={handleSave} disabled={saving} style={{ background: saving ? "#9ca3af" : "#3b82f6", color: "white", border: "none", borderRadius: "8px", padding: "12px 24px", fontSize: "14px", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer" }}>
              {saving ? "Zapisywanie…" : "Zapisz"}
            </button>
            <button onClick={resetForm} style={{ background: "white", color: "#374151", border: "2px solid #e5e7eb", borderRadius: "8px", padding: "10px 22px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
              Anuluj
            </button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "#6b7280", fontSize: "14px" }}>Ładowanie pakietów…</div>
      ) : packages.length === 0 ? (
        <div style={{ padding: "48px", textAlign: "center", background: "#f9fafb", borderRadius: "12px", border: "1px dashed #d1d5db" }}>
          <div style={{ fontSize: "40px", marginBottom: "12px" }}>🍽️</div>
          <div style={{ fontSize: "16px", fontWeight: 700, color: "#374151", marginBottom: "8px" }}>Brak pakietów</div>
          <div style={{ fontSize: "14px", color: "#6b7280", marginBottom: "16px" }}>Kliknij „Nowy pakiet”, aby utworzyć pierwszą definicję menu.</div>
          <button onClick={startCreate} style={{ background: "#3b82f6", color: "white", border: "none", borderRadius: "8px", padding: "10px 20px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
            + Nowy pakiet
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 18px",
                background: pkg.isActive ? "white" : "#f9fafb",
                border: `2px solid ${pkg.isActive ? "#e5e7eb" : "#d1d5db"}`,
                borderRadius: "10px",
                opacity: pkg.isActive ? 1 : 0.8,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "16px", fontWeight: 700, color: "#1e1e1e" }}>{pkg.name}</span>
                  <span style={{ fontSize: "12px", color: "#6b7280" }}>{pkg.code}</span>
                  {!pkg.isActive && <span style={{ background: "#ef4444", color: "white", fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "4px" }}>Nieaktywny</span>}
                  <span style={{ background: "#10b981", color: "white", fontSize: "13px", fontWeight: 800, padding: "2px 10px", borderRadius: "6px" }}>{toNum(pkg.price)} zł/os</span>
                </div>
                <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
                  Typy: {(Array.isArray(pkg.eventTypes) ? pkg.eventTypes : []).join(", ") || "—"} · {pkg.sections?.length ?? 0} sekcji · {pkg.surcharges?.length ?? 0} dopłat
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                <button onClick={() => startEdit(pkg)} style={{ background: "#3b82f6", color: "white", border: "none", borderRadius: "6px", padding: "8px 14px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                  Edytuj
                </button>
                {pkg.isActive && (
                  <button onClick={() => handleDelete(pkg)} style={{ background: "#ef4444", color: "white", border: "none", borderRadius: "6px", padding: "8px 14px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                    Dezaktywuj
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
        </>
      )}
    </div>
  );
}
