"use client";

import { useState, useEffect, useRef } from "react";

type DishItem = { id: string; name: string; defaultPrice?: number | { toNumber?: () => number } };
const toNum = (v: unknown): number =>
  v != null && typeof v === "object" && "toNumber" in (v as object) ? ((v as { toNumber: () => number }).toNumber()) : Number(v ?? 0);

export function DishAutocomplete({
  value,
  onChange,
  placeholder = "Szukaj lub wybierz danie",
}: {
  value: { id: string; name: string }[];
  onChange: (items: { id: string; name: string }[]) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<DishItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query.trim()) {
      setOptions([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/dishes?q=${encodeURIComponent(query)}&includeInactive=false`);
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        const filtered = list.filter((d: DishItem) => !value.some((v) => v.id === d.id));
        setOptions(filtered);
        setFocusedIndex(0);
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query, value]);

  useEffect(() => {
    const onOut = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onOut);
    return () => document.removeEventListener("mousedown", onOut);
  }, []);

  const add = (d: DishItem) => {
    onChange([...value, { id: d.id, name: d.name }]);
    setQuery("");
    setOptions([]);
    setOpen(false);
  };

  const remove = (id: string) => {
    onChange(value.filter((v) => v.id !== id));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || options.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && options[focusedIndex]) {
      e.preventDefault();
      add(options[focusedIndex]);
    }
  };

  return (
    <div ref={wrapperRef} style={{ position: "relative", width: "100%" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", padding: "8px 10px", border: "1px solid #e5e7eb", borderRadius: "6px", background: "white", minHeight: "42px" }}>
        {value.map((v) => (
          <span
            key={v.id}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              background: "#eff6ff",
              border: "1px solid #3b82f6",
              borderRadius: "6px",
              padding: "4px 8px",
              fontSize: "13px",
              fontWeight: 600,
              color: "#1e40af",
            }}
          >
            {v.name}
            <button type="button" onClick={() => remove(v.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: "0 2px", fontSize: "14px", color: "#6b7280", lineHeight: 1 }} title="Usuń">
              ×
            </button>
          </span>
        ))}
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? placeholder : "Dodaj kolejne…"}
          style={{ flex: 1, minWidth: "120px", border: "none", outline: "none", fontSize: "13px" }}
        />
      </div>
      {open && (query || options.length > 0) && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: "4px",
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            maxHeight: "220px",
            overflowY: "auto",
            zIndex: 50,
          }}
        >
          {loading ? (
            <div style={{ padding: "12px", color: "#6b7280", fontSize: "13px" }}>Szukam…</div>
          ) : options.length === 0 ? (
            <div style={{ padding: "12px", color: "#6b7280", fontSize: "13px" }}>{query ? "Brak wyników. Dodaj danie w słowniku." : "Wpisz aby wyszukać"}</div>
          ) : (
            options.map((d, i) => (
              <button
                key={d.id}
                type="button"
                onClick={() => add(d)}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "10px 14px",
                  border: "none",
                  background: i === focusedIndex ? "#eff6ff" : "transparent",
                  textAlign: "left",
                  fontSize: "14px",
                  cursor: "pointer",
                  color: "#1e1e1e",
                }}
              >
                <span style={{ fontWeight: 600 }}>{d.name}</span>
                {d.defaultPrice != null && <span style={{ marginLeft: "8px", color: "#6b7280", fontSize: "12px" }}>{toNum(d.defaultPrice)} zł</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
