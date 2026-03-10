"use client";

import { useState, useEffect, useCallback } from "react";

type DishRecord = {
  id: string;
  name: string;
  code?: string | null;
  defaultPrice: number | { toNumber?: () => number };
  vatRate: number | { toNumber?: () => number };
  category?: string | null;
  gtuCode?: string | null;
  isActive: boolean;
};

const toNum = (v: number | { toNumber?: () => number } | null | undefined): number =>
  v != null && typeof v === "object" && "toNumber" in v ? (v as { toNumber: () => number }).toNumber() : Number(v ?? 0);

const CATEGORIES = ["Zupa", "Danie główne", "Przystawka", "Deser", "Napoje", "Inne"];

export function DishesView() {
  const [dishes, setDishes] = useState<DishRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<DishRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    code: "",
    defaultPrice: "0",
    vatRate: "0.08",
    category: "",
    gtuCode: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = search ? `/api/dishes?includeInactive=true&q=${encodeURIComponent(search)}` : "/api/dishes?includeInactive=true";
      const res = await fetch(url);
      const data = await res.json();
      setDishes(Array.isArray(data) ? data : []);
      if (!res.ok) console.error("[DishesView] API error:", res.status, data);
    } catch (e) {
      setDishes([]);
      console.error("[DishesView] Fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  const resetForm = () => {
    setForm({ name: "", code: "", defaultPrice: "0", vatRate: "0.08", category: "", gtuCode: "" });
    setEditing(null);
    setCreating(false);
    setError(null);
  };

  const startCreate = () => {
    setForm({ name: "", code: "", defaultPrice: "0", vatRate: "0.08", category: "", gtuCode: "" });
    setCreating(true);
    setEditing(null);
  };

  const startEdit = (d: DishRecord) => {
    setForm({
      name: d.name,
      code: d.code ?? "",
      defaultPrice: String(toNum(d.defaultPrice)),
      vatRate: String(toNum(d.vatRate)),
      category: d.category ?? "",
      gtuCode: d.gtuCode ?? "",
    });
    setEditing(d);
    setCreating(false);
  };

  const handleSave = async () => {
    setError(null);
    const name = form.name.trim();
    if (!name) {
      setError("Nazwa jest wymagana.");
      return;
    }
    const defaultPrice = parseFloat(form.defaultPrice);
    const vatRate = parseFloat(form.vatRate);
    if (isNaN(defaultPrice) || defaultPrice < 0) {
      setError("Podaj poprawną cenę.");
      return;
    }

    setSaving(true);
    try {
      const body = {
        name,
        code: form.code.trim() || undefined,
        defaultPrice,
        vatRate: isNaN(vatRate) ? 0.08 : vatRate,
        category: form.category.trim() || undefined,
        gtuCode: form.gtuCode.trim() || undefined,
      };
      if (editing) {
        const res = await fetch(`/api/dishes/${editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Błąd zapisu");
      } else {
        const res = await fetch("/api/dishes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Błąd tworzenia");
      }
      await load();
      resetForm();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Wystąpił błąd.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (d: DishRecord) => {
    if (!confirm(`Dezaktywować danie „${d.name}"?`)) return;
    try {
      await fetch(`/api/dishes/${d.id}`, { method: "DELETE" });
      await load();
      if (editing?.id === d.id) resetForm();
    } catch {
      setError("Błąd dezaktywacji.");
    }
  };

  const showForm = creating || editing;

  return (
    <div style={{ padding: "24px", maxWidth: "900px", margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: 800, color: "#1e1e1e", margin: 0 }}>Słownik dań</h2>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Szukaj..."
            style={{ padding: "8px 12px", border: "2px solid #e5e7eb", borderRadius: "8px", fontSize: "14px", width: "180px" }}
          />
          {!showForm && (
            <button onClick={startCreate} style={{ background: "#3b82f6", color: "white", border: "none", borderRadius: "8px", padding: "10px 18px", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}>
              + Nowe danie
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <div style={{ background: "white", border: "2px solid #3b82f6", borderRadius: "12px", padding: "24px", marginBottom: "24px" }}>
          <div style={{ fontSize: "16px", fontWeight: 800, marginBottom: "20px" }}>{editing ? "Edycja dania" : "Nowe danie"}</div>
          {error && (
            <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: "8px", padding: "12px", marginBottom: "16px", color: "#991b1b", fontWeight: 600 }}>
              {error}
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#374151", marginBottom: "4px" }}>Nazwa *</label>
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={{ width: "100%", padding: "10px 12px", border: "2px solid #e5e7eb", borderRadius: "8px", fontSize: "14px" }} placeholder="np. Zupa pomidorowa" />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#374151", marginBottom: "4px" }}>Kod</label>
              <input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} style={{ width: "100%", padding: "10px 12px", border: "2px solid #e5e7eb", borderRadius: "8px", fontSize: "14px" }} placeholder="np. zupa_pom" />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#374151", marginBottom: "4px" }}>Cena (zł)</label>
              <input type="number" min={0} step={0.01} value={form.defaultPrice} onChange={(e) => setForm((f) => ({ ...f, defaultPrice: e.target.value }))} style={{ width: "100%", padding: "10px 12px", border: "2px solid #e5e7eb", borderRadius: "8px", fontSize: "14px" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#374151", marginBottom: "4px" }}>VAT (np. 0.08)</label>
              <input type="number" min={0} max={1} step={0.01} value={form.vatRate} onChange={(e) => setForm((f) => ({ ...f, vatRate: e.target.value }))} style={{ width: "100%", padding: "10px 12px", border: "2px solid #e5e7eb", borderRadius: "8px", fontSize: "14px" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#374151", marginBottom: "4px" }}>Kategoria</label>
              <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} style={{ width: "100%", padding: "10px 12px", border: "2px solid #e5e7eb", borderRadius: "8px", fontSize: "14px" }}>
                <option value="">—</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#374151", marginBottom: "4px" }}>Kod GTU</label>
              <input value={form.gtuCode} onChange={(e) => setForm((f) => ({ ...f, gtuCode: e.target.value }))} style={{ width: "100%", padding: "10px 12px", border: "2px solid #e5e7eb", borderRadius: "8px", fontSize: "14px" }} />
            </div>
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
      )}

      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>Ładowanie…</div>
      ) : dishes.length === 0 ? (
        <div style={{ padding: "48px", textAlign: "center", background: "#f9fafb", borderRadius: "12px", border: "1px dashed #d1d5db" }}>
          <div style={{ fontSize: "40px", marginBottom: "12px" }}>🍽️</div>
          <div style={{ fontSize: "16px", fontWeight: 700, color: "#374151", marginBottom: "8px" }}>Brak dań w słowniku</div>
          <div style={{ fontSize: "14px", color: "#6b7280", marginBottom: "16px" }}>Dodaj pierwsze danie, aby korzystać z autouzupełniania w pakietach menu.</div>
          <button onClick={startCreate} style={{ background: "#3b82f6", color: "white", border: "none", borderRadius: "8px", padding: "10px 20px", fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
            + Nowe danie
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {dishes.map((d) => (
            <div
              key={d.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "12px 16px",
                background: d.isActive ? "white" : "#f9fafb",
                border: `1px solid ${d.isActive ? "#e5e7eb" : "#d1d5db"}`,
                borderRadius: "10px",
                opacity: d.isActive ? 1 : 0.75,
              }}
            >
              <div>
                <span style={{ fontSize: "15px", fontWeight: 700, color: "#1e1e1e" }}>{d.name}</span>
                {d.category && <span style={{ marginLeft: "10px", fontSize: "12px", color: "#6b7280" }}>{d.category}</span>}
                <span style={{ marginLeft: "10px", background: "#10b981", color: "white", fontSize: "12px", fontWeight: 700, padding: "2px 8px", borderRadius: "4px" }}>{toNum(d.defaultPrice)} zł</span>
                {!d.isActive && <span style={{ marginLeft: "8px", background: "#ef4444", color: "white", fontSize: "11px", padding: "2px 6px", borderRadius: "4px" }}>Nieaktywne</span>}
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={() => startEdit(d)} style={{ background: "#3b82f6", color: "white", border: "none", borderRadius: "6px", padding: "6px 12px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                  Edytuj
                </button>
                {d.isActive && (
                  <button onClick={() => handleDeactivate(d)} style={{ background: "#ef4444", color: "white", border: "none", borderRadius: "6px", padding: "6px 12px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                    Dezaktywuj
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
