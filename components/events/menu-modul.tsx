"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════
// PAKIETY MENU — z bazy danych (GET /api/menu-packages)
// ═══════════════════════════════════════════════════════════════

type ApiPackage = {
  id: string;
  code: string;
  name: string;
  price: number | { toNumber?: () => number };
  eventTypes: string[];
  sections: { code: string; label: string; type: string; choiceLimit?: number | null; dishes: string[] }[];
  surcharges: { code: string; label: string; pricePerPerson?: number | null; flatPrice?: number | null; hasChoice?: boolean; choiceLimit?: number | null; options?: string[] | null; description?: string | null }[];
  rules?: string[] | null;
};

type LegacyPackage = {
  id: string;
  typy: string[];
  nazwa: string;
  cena: number;
  sekcje: { id: string; label: string; typ: string; limit?: number; dania: string[] }[];
  doplaty: { id: string; label: string; cena?: number; stala?: number; wybor?: boolean; limit?: number; opcje?: string[]; opis?: string }[];
  regulamin: string[];
};

function toLegacy(p: ApiPackage): LegacyPackage {
  const priceNum = typeof p.price === "object" && p.price && "toNumber" in p.price ? (p.price as { toNumber: () => number }).toNumber() : Number(p.price);
  return {
    id: p.code,
    typy: p.eventTypes || [],
    nazwa: p.name,
    cena: priceNum,
    sekcje: (p.sections || []).map((s) => ({
      id: s.code,
      label: s.label,
      typ: s.type,
      ...(s.type === "wybor" && s.choiceLimit != null ? { limit: s.choiceLimit } : {}),
      dania: Array.isArray(s.dishes) ? s.dishes : [],
    })),
    doplaty: (p.surcharges || []).map((d) => {
      const pp = d.pricePerPerson != null ? (typeof d.pricePerPerson === "object" && "toNumber" in d.pricePerPerson ? (d.pricePerPerson as { toNumber: () => number }).toNumber() : Number(d.pricePerPerson)) : undefined;
      const fp = d.flatPrice != null ? (typeof d.flatPrice === "object" && "toNumber" in d.flatPrice ? (d.flatPrice as { toNumber: () => number }).toNumber() : Number(d.flatPrice)) : undefined;
      return {
        id: d.code,
        label: d.label,
        ...(pp != null && pp > 0 ? { cena: pp } : {}),
        ...(fp != null && fp > 0 ? { stala: fp } : {}),
        ...(d.hasChoice ? { wybor: true, limit: d.choiceLimit ?? undefined, opcje: d.options ?? undefined } : {}),
        ...(d.description ? { opis: d.description } : {}),
      };
    }),
    regulamin: Array.isArray(p.rules) ? p.rules : [],
  };
}

const fmtZl = (n: number | null | undefined) => (n != null ? n.toLocaleString("pl-PL") + "\u00a0zł" : "—");
const fmtDate = (d: string | Date) => new Date(d).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" });

type EvType = { type: string; client?: string | null; date: string; guests?: number | null };
type SavedMenu = { pakietId?: string | null; wybory?: Record<string, string[]>; doplaty?: Record<string, boolean>; dopWybory?: Record<string, string[]>; notatka?: string } | null;

function obliczCene(
  pakiet: LegacyPackage | undefined,
  doplaty: Record<string, boolean>,
  guestsOverride: number | null,
  evGuests: number | null | undefined
) {
  if (!pakiet) return { base: 0, dop: 0, perOsoba: 0, total: null, staleDop: 0 };
  const g = guestsOverride ?? evGuests ?? 0;
  const base = pakiet.cena;
  let dop = 0, staleDop = 0;
  (pakiet.doplaty || []).forEach((d: { id: string; stala?: number; cena?: number }) => {
    if (!doplaty[d.id]) return;
    if (d.stala) staleDop += d.stala;
    else dop += d.cena ?? 0;
  });
  const perOsoba = base + dop;
  const total = g > 0 ? perOsoba * g + staleDop : null;
  return { base, dop, perOsoba, total, staleDop, gosc: g };
}

type SekcjaWybor = { id: string; label: string; typ: string; limit: number; dania: string[] };
function statusWyborow(
  pakiet: LegacyPackage | undefined,
  wybory: Record<string, string[]>
) {
  if (!pakiet) return { todo: [] as SekcjaWybor[], done: 0, total: 0 };
  const wyborowe = pakiet.sekcje.filter((s) => s.typ === "wybor" && "limit" in s) as SekcjaWybor[];
  const done = wyborowe.filter((s) => (wybory[s.id] || []).length === s.limit).length;
  const todo = wyborowe.filter((s) => (wybory[s.id] || []).length < s.limit);
  return { todo, done, total: wyborowe.length };
}

function generatePrintHTML(
  pakiet: LegacyPackage,
  wybory: Record<string, string[]>,
  doplaty: Record<string, boolean>,
  dopWybory: Record<string, string[]>,
  notatka: string,
  ev: EvType,
  cena: ReturnType<typeof obliczCene>
) {
  const sekcjeHTML = pakiet.sekcje.map((s: { typ: string; id: string; label: string; dania: string[] }) => {
    const lista = s.typ === "fixed" ? s.dania : (wybory[s.id] || []);
    if (!lista.length) return "";
    const items = lista.map((d: string) => `<li>${d}</li>`).join("");
    return `<div class="sekcja"><div class="sekcja-label">${s.label.replace(/ \(.*\)/, "").toUpperCase()}</div><ul>${items}</ul></div>`;
  }).join("");
  const wybrDoplaty = (pakiet.doplaty || []).filter((d: { id: string }) => doplaty[d.id]);
  const doplatyHTML = wybrDoplaty.length
    ? `<div class="sekcja"><div class="sekcja-label">DOPŁATY</div><ul>${wybrDoplaty.map((d: { label: string; stala?: number; cena?: number; wybor?: boolean; id: string }) => {
        const wybrane = d.wybor && dopWybory[d.id]?.length ? ` — ${dopWybory[d.id].join(", ")}` : "";
        const cenaStr = d.stala ? ` (${fmtZl(d.stala)} ryczałt)` : (d.cena ?? 0) > 0 ? ` (+${d.cena} zł/os)` : "";
        return `<li>${d.label}${cenaStr}${wybrane}</li>`;
      }).join("")}</ul></div>`
    : "";
  const notatkaHTML = notatka ? `<div class="notatka">📝 ${notatka}</div>` : "";
  const cenaHTML = `<div class="cena-box"><div class="cena-wiersz"><span>Pakiet</span><span>${pakiet.cena} zł/os</span></div>${cena.dop > 0 ? `<div class="cena-wiersz"><span>Dopłaty</span><span>+${cena.dop} zł/os</span></div>` : ""}${cena.dop > 0 ? `<div class="cena-wiersz bold"><span>Łącznie na osobę</span><span>${cena.perOsoba} zł/os</span></div>` : ""}${(cena.gosc ?? 0) > 0 ? `<div class="cena-wiersz"><span>Gości</span><span>${cena.gosc ?? 0}</span></div>` : ""}${cena.staleDop > 0 ? `<div class="cena-wiersz"><span>Dopłaty ryczałtowe</span><span>+${fmtZl(cena.staleDop)}</span></div>` : ""}${cena.total != null ? `<div class="cena-total">RAZEM: ${fmtZl(cena.total)}</div>` : ""}</div>`;
  const regulaminHTML = pakiet.regulamin?.length ? `<div class="regulamin"><strong>Regulamin:</strong><br/>${pakiet.regulamin.map((r: string) => `• ${r}`).join("<br/>")}</div>` : "";
  return `<!DOCTYPE html><html lang="pl"><head><meta charset="utf-8"><title>Menu — ${ev.client}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Georgia,serif;padding:32px;color:#1e293b;max-width:720px;margin:0 auto}h1{font-size:22px;font-weight:bold;margin-bottom:4px}.subtitle{font-size:13px;color:#64748b;margin-bottom:24px}.sekcja{margin-bottom:16px}.sekcja-label{font-size:10px;font-weight:bold;color:#94a3b8;letter-spacing:2px;margin-bottom:5px;border-bottom:1px solid #e2e8f0;padding-bottom:3px}ul{padding-left:18px}li{font-size:13px;line-height:1.9}.notatka{background:#fefce8;border:1px solid #fde68a;border-radius:6px;padding:10px 14px;margin:16px 0;font-size:12px;color:#92400e}.cena-box{background:#f0fdf4;border:2px solid #86efac;border-radius:8px;padding:14px 18px;margin:20px 0}.cena-wiersz{display:flex;justify-content:space-between;font-size:13px;line-height:2}.cena-wiersz.bold{font-weight:bold;border-top:1px dashed #d1fae5;padding-top:4px}.cena-total{font-size:20px;font-weight:bold;color:#166534;border-top:2px solid #86efac;padding-top:10px;margin-top:6px}.regulamin{font-size:11px;color:#64748b;line-height:1.9;border-top:1px solid #e2e8f0;padding-top:14px;margin-top:14px}.footer{font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:10px;margin-top:20px}@media print{body{padding:16px}}</style></head><body><h1>${pakiet.nazwa} — ${pakiet.cena} zł/os</h1><div class="subtitle">${ev.client} · ${fmtDate(ev.date)}${ev.guests ? ` · ${ev.guests} osób` : ""}</div>${sekcjeHTML}${doplatyHTML}${notatkaHTML}${cenaHTML}${regulaminHTML}<div class="footer">Karczma Łabędź · Marta Aker: 721 434 939, 604 070 908</div></body></html>`;
}

export interface MenuEv {
  type: string;
  client?: string | null;
  date: string;
  guests?: number | null;
}

export function MenuTab({ ev, savedMenu, onSave }: { ev: MenuEv; savedMenu: SavedMenu; onSave?: (menuData: Record<string, unknown>) => void }) {
  const [pakietId, setPakietId] = useState<string | null>(savedMenu?.pakietId ?? null);
  const [wybory, setWybory] = useState<Record<string, string[]>>(savedMenu?.wybory ?? {});
  const [doplaty, setDoplaty] = useState<Record<string, boolean>>(savedMenu?.doplaty ?? {});
  const [dopWybory, setDopWybory] = useState<Record<string, string[]>>(savedMenu?.dopWybory ?? {});
  const [notatka, setNotatka] = useState(savedMenu?.notatka ?? "");
  const [guestsOvr, setGuestsOvr] = useState<number | null>(null);
  const [tryb, setTryb] = useState<"edycja" | "podglad">("edycja");
  const [zapisano, setZapisano] = useState(false);
  const [walidError, setWalidError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState<string | null>(null);
  const [allPackages, setAllPackages] = useState<LegacyPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    fetch("/api/menu-packages")
      .then((r) => r.json())
      .then((data: ApiPackage[]) => {
        setAllPackages(data.map(toLegacy));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!savedMenu) return;
    setPakietId(savedMenu.pakietId ?? null);
    setWybory(savedMenu.wybory ?? {});
    setDoplaty(savedMenu.doplaty ?? {});
    setDopWybory(savedMenu.dopWybory ?? {});
    setNotatka(savedMenu.notatka ?? "");
  }, [savedMenu]);

  const dostepne = useMemo(() => allPackages.filter((p) => p.typy.includes(ev.type)), [allPackages, ev.type]);
  const pakiet = useMemo(
    () => allPackages.find((p) => p.id === pakietId),
    [allPackages, pakietId]
  );
  const cena = useMemo(() => obliczCene(pakiet, doplaty, guestsOvr, ev.guests), [pakiet, doplaty, guestsOvr, ev.guests]);
  const statusWyb = useMemo(() => statusWyborow(pakiet, wybory), [pakiet, wybory]);

  const toggleWybor = useCallback((sekcjaId: string, danie: string, limit: number) => {
    setWybory((prev) => {
      const curr = prev[sekcjaId] || [];
      if (curr.includes(danie)) return { ...prev, [sekcjaId]: curr.filter((d) => d !== danie) };
      if (curr.length >= limit) return prev;
      return { ...prev, [sekcjaId]: [...curr, danie] };
    });
  }, []);

  const toggleDoplata = useCallback((id: string) => setDoplaty((prev) => ({ ...prev, [id]: !prev[id] })), []);
  const toggleDopWybor = useCallback((dopId: string, opcja: string, limit: number) => {
    setDopWybory((prev) => {
      const curr = prev[dopId] || [];
      if (curr.includes(opcja)) return { ...prev, [dopId]: curr.filter((o) => o !== opcja) };
      if (curr.length >= limit) return prev;
      return { ...prev, [dopId]: [...curr, opcja] };
    });
  }, []);
  const clearSekcja = useCallback((sekcjaId: string) => setWybory((prev) => ({ ...prev, [sekcjaId]: [] })), []);

  const handlePakietClick = (id: string) => {
    if (id === pakietId) return;
    const hasWybory = Object.values(wybory).some((v) => v.length > 0);
    if (hasWybory) { setConfirmReset(id); return; }
    doChangePakiet(id);
  };

  const doChangePakiet = (id: string) => {
    setPakietId(id); setWybory({}); setDoplaty({}); setDopWybory({});
    setConfirmReset(null); setWalidError(null);
  };

  const handleSave = () => {
    if (!pakiet) { setWalidError("Wybierz pakiet menu przed zapisaniem."); return; }
    const brakujace = statusWyb.todo.map((s) => {
      const curr = (wybory[s.id] || []).length;
      return `${s.label.replace(/ \(.*\)/, "")} (${curr}/${s.limit})`;
    });
    if (brakujace.length) {
      setWalidError("Uzupełnij wybory: " + brakujace.join(", "));
      return;
    }
    setWalidError(null);
    onSave?.({ pakietId, wybory, doplaty, dopWybory, notatka });
    setZapisano(true);
    setTimeout(() => setZapisano(false), 2500);
  };

  const handlePrint = () => {
    if (!pakiet) return;
    const html = generatePrintHTML(pakiet, wybory, doplaty, dopWybory, notatka, ev, cena);
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument || iframe.contentWindow!.document;
    doc.open(); doc.write(html); doc.close();
    setTimeout(() => iframe.contentWindow!.print(), 300);
  };

  const effGuests = guestsOvr ?? ev.guests;

  return (
    <div style={{ fontFamily: "'Source Sans 3','Segoe UI',system-ui,sans-serif", fontSize: "13px", padding: "0 20px 16px" }}>
      <iframe ref={iframeRef} style={{ display: "none" }} title="print" />
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "white", borderBottom: "1px solid #e2e8f0", padding: "10px 0 10px", marginBottom: "12px", display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", border: "1px solid #3b82f6", borderRadius: "4px", overflow: "hidden", flexShrink: 0 }}>
          {([["edycja", "Edycja"], ["podglad", "Podgląd"]] as const).map(([t, l]) => (
            <button key={t} onClick={() => setTryb(t)} style={{ padding: "6px 14px", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: tryb === t ? 700 : 500, background: tryb === t ? "#eff6ff" : "white", color: tryb === t ? "#1e40af" : "#374151" }}>{l}</button>
          ))}
        </div>
        {pakiet && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "5px 12px", flexShrink: 0 }}>
            <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600 }}>{cena.perOsoba} zł/os</span>
            {cena.total != null && <><span style={{ color: "#94a3b8" }}>×</span><span style={{ fontSize: "15px", fontWeight: 700, color: "#111827" }}>{fmtZl(cena.total)}</span></>}
            {cena.total == null && <span style={{ fontSize: "11px", color: "#94a3b8", fontStyle: "italic" }}>(wpisz gości →)</span>}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: "5px", flexShrink: 0 }}>
          <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600, whiteSpace: "nowrap" }}>gości:</span>
          <input type="number" min={1} max={999} value={guestsOvr ?? ev.guests ?? ""} onChange={(e) => { const v = parseInt(e.target.value); setGuestsOvr(isNaN(v) || v <= 0 ? null : v); }} style={{ width: "64px", padding: "5px 8px", border: "1px solid #e2e8f0", borderRadius: "4px", fontSize: "13px", fontWeight: 600, textAlign: "center", outline: "none" }} />
          {guestsOvr != null && guestsOvr !== ev.guests && <button onClick={() => setGuestsOvr(null)} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "4px", padding: "4px 7px", cursor: "pointer", fontSize: "11px", color: "#64748b", fontWeight: 600 }}>↩</button>}
        </div>
        {pakiet && statusWyb.total > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
            <div style={{ display: "flex", gap: "3px" }}>{Array.from({ length: statusWyb.total }, (_, i) => <div key={i} style={{ width: "10px", height: "10px", borderRadius: "2px", background: i < statusWyb.done ? "#3b82f6" : "#e2e8f0" }} />)}</div>
            <span style={{ fontSize: "11px", fontWeight: 700, color: statusWyb.done === statusWyb.total ? "#1e40af" : "#64748b" }}>{statusWyb.done}/{statusWyb.total}</span>
          </div>
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: "6px", flexShrink: 0 }}>
          {tryb === "podglad" && pakiet && <button onClick={handlePrint} style={{ background: "white", color: "#111827", border: "1px solid #e2e8f0", borderRadius: "4px", padding: "7px 14px", cursor: "pointer", fontSize: "12px", fontWeight: 600 }}>Drukuj</button>}
          <button onClick={handleSave} style={{ background: zapisano ? "#22c55e" : "#3b82f6", color: "white", border: "none", borderRadius: "4px", padding: "7px 16px", cursor: "pointer", fontSize: "12px", fontWeight: 600, transition: "background 0.25s", whiteSpace: "nowrap" }}>{zapisano ? "Zapisano!" : "Zapisz"}</button>
        </div>
      </div>
      {walidError && (
        <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: "6px", padding: "10px 14px", marginBottom: "10px", fontSize: "12px", color: "#991b1b", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px" }}>
          {walidError}
          <button onClick={() => setWalidError(null)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#991b1b", fontSize: "14px", fontWeight: 700 }}>×</button>
        </div>
      )}
      {tryb === "podglad" && (
        <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "20px 22px" }}>
          {!pakiet ? (
            <div style={{ textAlign: "center", padding: "48px 20px", color: "#64748b" }}><div style={{ fontSize: "32px", marginBottom: "10px" }}>🍽️</div><div style={{ fontSize: "14px", fontWeight: 600 }}>Wybierz pakiet w trybie edycji</div></div>
          ) : (
            <>
              <div style={{ fontSize: "18px", fontWeight: 700, color: "#1e1e1e", marginBottom: "2px" }}>{pakiet.nazwa} — {pakiet.cena} zł/os</div>
              <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "20px" }}>{ev.client} · {fmtDate(ev.date)}{effGuests ? ` · ${effGuests} osób` : ""}</div>
              {pakiet.sekcje.map((s: { id: string; typ: string; label: string; dania: string[] }) => {
                const lista = s.typ === "fixed" ? s.dania : (wybory[s.id] || []);
                if (!lista.length) return <div key={s.id} style={{ marginBottom: "10px", opacity: 0.4 }}><div style={{ fontSize: "10px", fontWeight: 900, color: "#111827", letterSpacing: "2px", marginBottom: "3px" }}>{s.label.replace(/ \(.*\)/, "").toUpperCase()} — BRAK WYBORU</div></div>;
                return (
                  <div key={s.id} style={{ marginBottom: "14px" }}>
                    <div style={{ fontSize: "10px", fontWeight: 900, color: "#111827", letterSpacing: "2px", marginBottom: "5px", borderBottom: "1px solid #f1f5f9", paddingBottom: "3px" }}>{s.label.replace(/ \(.*\)/, "").toUpperCase()}{s.typ === "fixed" ? <span style={{ marginLeft: "6px", color: "#22c55e", fontSize: "9px" }}>✓ W CENIE</span> : null}</div>
                    <ul style={{ margin: 0, paddingLeft: "16px" }}>{lista.map((d: string) => <li key={d} style={{ lineHeight: 1.9, color: "#0f172a" }}>{d}</li>)}</ul>
                  </div>
                );
              })}
              {(pakiet.doplaty || []).some((d: { id: string }) => doplaty[d.id]) && (
                <div style={{ marginBottom: "14px" }}>
                  <div style={{ fontSize: "10px", fontWeight: 900, color: "#111827", letterSpacing: "2px", marginBottom: "5px", borderBottom: "1px solid #f1f5f9", paddingBottom: "3px" }}>DOPŁATY</div>
                  {(pakiet.doplaty || []).filter((d: { id: string }) => doplaty[d.id]).map((d: { id: string; label: string; stala?: number; cena?: number; wybor?: boolean }) => (
                    <div key={d.id} style={{ lineHeight: 2, color: "#0f172a" }}>• {d.label}{d.stala ? ` — ${fmtZl(d.stala)} ryczałt` : (d.cena ?? 0) > 0 ? ` — +${d.cena} zł/os` : ""}{d.wybor && dopWybory[d.id]?.length ? <span style={{ color: "#64748b" }}> ({dopWybory[d.id].join(", ")})</span> : ""}</div>
                  ))}
                </div>
              )}
              {notatka && <div style={{ background: "#fefce8", border: "1px solid #fde68a", borderRadius: "6px", padding: "10px 14px", marginBottom: "14px", fontSize: "12px", color: "#92400e", lineHeight: 1.6 }}>📝 {notatka}</div>}
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "14px 16px", marginBottom: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#374151", lineHeight: 2.2 }}><span>Pakiet base:</span><span style={{ fontWeight: 600 }}>{pakiet.cena} zł/os</span></div>
                {cena.dop > 0 && <><div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#64748b", lineHeight: 2 }}><span>Dopłaty:</span><span style={{ fontWeight: 600 }}>+{cena.dop} zł/os</span></div><div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 700, borderTop: "1px dashed #e2e8f0", paddingTop: "4px", lineHeight: 2 }}><span>Łącznie/os:</span><span>{cena.perOsoba} zł</span></div></>}
                {effGuests != null && effGuests > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#374151", lineHeight: 2 }}><span>Gości:</span><span style={{ fontWeight: 600 }}>× {effGuests}</span></div>}
                {cena.staleDop > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#64748b", lineHeight: 2 }}><span>Ryczałt:</span><span style={{ fontWeight: 600 }}>+{fmtZl(cena.staleDop)}</span></div>}
                {cena.total != null && <div style={{ display: "flex", justifyContent: "space-between", fontSize: "18px", fontWeight: 700, color: "#111827", borderTop: "1px solid #e2e8f0", paddingTop: "8px", marginTop: "4px" }}><span>RAZEM</span><span>{fmtZl(cena.total)}</span></div>}
              </div>
              {pakiet.regulamin?.length ? <div style={{ fontSize: "11px", color: "#64748b", lineHeight: 1.9, borderTop: "1px solid #e2e8f0", paddingTop: "12px" }}><strong>Regulamin:</strong><br />{pakiet.regulamin.map((r, i) => <div key={i}>• {r}</div>)}</div> : null}
              <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "12px", borderTop: "1px solid #e2e8f0", paddingTop: "10px" }}>Karczma Łabędź · Marta Aker: 721 434 939, 604 070 908</div>
            </>
          )}
        </div>
      )}
      {tryb === "edycja" && (
        <>
          <div style={{ marginBottom: "12px" }}>
            <div style={{ fontSize: "10px", fontWeight: 900, color: "#111827", letterSpacing: "2px", marginBottom: "8px" }}>PAKIET MENU</div>
            {loading ? (
              <div style={{ padding: "20px", textAlign: "center", color: "#64748b", fontSize: "13px" }}>Ładowanie pakietów...</div>
            ) : dostepne.length === 0 ? (
              <div style={{ background: "#fef9c3", border: "1px solid #fde68a", borderRadius: "8px", padding: "14px", fontSize: "13px", color: "#92400e", fontWeight: 600 }}>Brak pakietów dla typu imprezy: <strong>{ev.type}</strong>. Skontaktuj się z Martą Aker aby ustalić menu indywidualnie.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {dostepne.map((p) => {
                  const aktywny = pakietId === p.id;
                  return (
                    <button key={p.id} onClick={() => handlePakietClick(p.id)} style={{ background: aktywny ? "#eff6ff" : "white", border: `1px solid ${aktywny ? "#3b82f6" : "#e2e8f0"}`, borderRadius: "8px", padding: "11px 14px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", textAlign: "left", transition: "border-color 0.12s" }}>
                      <span style={{ fontSize: "14px", fontWeight: 600, color: aktywny ? "#1e40af" : "#111827" }}>{aktywny ? "✓ " : ""}{p.nazwa}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0, marginLeft: "12px" }}>
                        <span style={{ fontSize: "11px", color: aktywny ? "#1e40af" : "#64748b" }}>{p.sekcje.filter((s: { typ: string }) => s.typ === "wybor").length} sekcji do wyboru</span>
                        <span style={{ background: aktywny ? "#3b82f6" : "#f8fafc", color: aktywny ? "white" : "#111827", border: `1px solid ${aktywny ? "#3b82f6" : "#e2e8f0"}`, borderRadius: "4px", padding: "3px 10px", fontSize: "13px", fontWeight: 600 }}>{p.cena} zł/os</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {pakiet && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
              <div style={{ fontSize: "10px", fontWeight: 900, color: "#111827", letterSpacing: "2px" }}>SKŁAD MENU</div>
              {pakiet.sekcje.map((sek) => {
                const limit = "limit" in sek ? (sek.limit as number) : 0;
                const wybrane = wybory[sek.id] || [];
                const pelne = sek.typ === "wybor" && wybrane.length === limit;
                const empty = sek.typ === "wybor" && wybrane.length === 0;
                return (
                  <div key={sek.id} style={{ background: "#f8fafc", border: `1px solid ${pelne ? "#86efac" : empty ? "#e2e8f0" : "#fde68a"}`, borderRadius: "8px", padding: "12px 14px", transition: "border-color 0.15s" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
                      <div style={{ fontSize: "12px", fontWeight: 600, color: "#111827", flex: 1 }}>{sek.typ === "fixed" ? <span style={{ color: "#22c55e", marginRight: "5px" }}>✓</span> : <span style={{ color: pelne ? "#22c55e" : empty ? "#64748b" : "#d97706", marginRight: "5px" }}>{pelne ? "●" : empty ? "○" : "◐"}</span>}{sek.label.replace(/ \(.*\)/, "")}{sek.typ === "fixed" ? <span style={{ marginLeft: "6px", fontSize: "10px", color: "#64748b", fontWeight: 600 }}>— w cenie</span> : null}</div>
                      {sek.typ === "wybor" && (
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ background: pelne ? "#f0fdf4" : empty ? "white" : "#fefce8", color: pelne ? "#166534" : empty ? "#64748b" : "#92400e", border: `1px solid ${pelne ? "#86efac" : empty ? "#e2e8f0" : "#fde68a"}`, borderRadius: "4px", padding: "2px 8px", fontSize: "11px", fontWeight: 600 }}>{pelne ? "✓ " : ""}{wybrane.length}/{limit}</span>
                          {wybrane.length > 0 && <button onClick={() => clearSekcja(sek.id)} title="Wyczyść sekcję" style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", fontSize: "11px", padding: "2px 4px", fontWeight: 600 }}>✕</button>}
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                      {sek.dania.map((d: string) => {
                        if (sek.typ === "fixed") return <span key={d} style={{ background: "#f1f5f9", color: "#374151", borderRadius: "4px", padding: "3px 9px", fontSize: "12px" }}>{d}</span>;
                        const sel = wybrane.includes(d);
                        const zablok = !sel && pelne;
                        return <button key={d} onClick={() => toggleWybor(sek.id, d, limit)} style={{ background: sel ? "#3b82f6" : zablok ? "#f8fafc" : "white", border: `1px solid ${sel ? "#3b82f6" : zablok ? "#f1f5f9" : "#e2e8f0"}`, borderRadius: "4px", padding: "4px 10px", cursor: zablok ? "not-allowed" : "pointer", fontSize: "12px", fontWeight: sel ? 600 : 400, color: sel ? "white" : zablok ? "#cbd5e1" : "#374151", transition: "border-color 0.1s" }}>{sel ? "✓ " : ""}{d}</button>;
                      })}
                    </div>
                    {pelne && sek.typ === "wybor" && <div style={{ marginTop: "7px", fontSize: "11px", color: "#166534", fontWeight: 600 }}>✓ Wybrano {limit} z {sek.dania.length} — odznacz danie aby zmienić</div>}
                  </div>
                );
              })}
            </div>
          )}
          {pakiet && (pakiet.doplaty || []).length > 0 && (
            <div style={{ marginBottom: "12px" }}>
              <div style={{ fontSize: "10px", fontWeight: 900, color: "#111827", letterSpacing: "2px", marginBottom: "8px" }}>DOPŁATY (opcjonalne)</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {(pakiet.doplaty || []).map((d: { id: string; label: string; opis?: string; stala?: number; cena?: number; wybor?: boolean; limit?: number; opcje?: string[] }) => (
                  <div key={d.id} style={{ background: "#f8fafc", border: `1px solid ${doplaty[d.id] ? "#3b82f6" : "#e2e8f0"}`, borderRadius: "8px", padding: "11px 14px", transition: "border-color 0.15s" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <button onClick={() => toggleDoplata(d.id)} style={{ width: "22px", height: "22px", borderRadius: "4px", border: "none", flexShrink: 0, cursor: "pointer", fontSize: "12px", fontWeight: 600, background: doplaty[d.id] ? "#3b82f6" : "#e2e8f0", color: doplaty[d.id] ? "white" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>✓</button>
                      <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 600, color: "#111827" }}>{d.label}</div>{d.opis ? <div style={{ fontSize: "11px", color: "#64748b", marginTop: "1px" }}>{d.opis}</div> : null}</div>
                      <span style={{ fontSize: "12px", fontWeight: 600, flexShrink: 0, color: d.stala ? "#111827" : "#1e40af", whiteSpace: "nowrap" }}>{d.stala ? fmtZl(d.stala) + " ryczałt" : (d.cena ?? 0) > 0 ? "+" + d.cena + " zł/os" : ""}</span>
                    </div>
                    {d.wybor && doplaty[d.id] && d.opcje && d.limit != null && (
                      <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid #f1f5f9" }}>
                        <div style={{ fontSize: "10px", color: "#64748b", fontWeight: 600, marginBottom: "6px" }}>Wybierz {d.limit} z {d.opcje.length}: <span style={{ marginLeft: "8px", fontWeight: 600, color: (dopWybory[d.id] || []).length === d.limit ? "#166534" : "#92400e" }}>{(dopWybory[d.id] || []).length}/{d.limit}</span></div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>{d.opcje.map((o: string) => { const sel = (dopWybory[d.id] || []).includes(o); const dLimit = d.limit ?? 0; const peln = !sel && (dopWybory[d.id] || []).length >= dLimit; return <button key={o} onClick={() => toggleDopWybor(d.id, o, dLimit)} style={{ background: sel ? "#3b82f6" : peln ? "#f8fafc" : "white", border: `1px solid ${sel ? "#3b82f6" : peln ? "#f1f5f9" : "#e2e8f0"}`, borderRadius: "4px", padding: "4px 10px", cursor: peln ? "not-allowed" : "pointer", fontSize: "12px", fontWeight: sel ? 600 : 400, color: sel ? "white" : peln ? "#cbd5e1" : "#374151" }}>{sel ? "✓ " : ""}{o}</button>; })}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {pakiet && (
            <div style={{ marginBottom: "12px" }}>
              <div style={{ fontSize: "10px", fontWeight: 900, color: "#111827", letterSpacing: "2px", marginBottom: "8px" }}>NOTATKA (opcjonalna)</div>
              <textarea value={notatka} onChange={(e) => setNotatka(e.target.value)} placeholder="Tort urodzinowy od klienta, alergeny, prośby specjalne, ustalenia z klientem..." style={{ width: "100%", minHeight: "72px", padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "13px", resize: "vertical", fontFamily: "inherit", lineHeight: 1.6, outline: "none", boxSizing: "border-box" }} />
            </div>
          )}
          {pakiet && (
            <div style={{ background: "#f8fafc", border: `1px solid ${cena.total != null ? "#e2e8f0" : "#e2e8f0"}`, borderRadius: "8px", padding: "14px" }}>
              <div style={{ fontSize: "10px", fontWeight: 900, color: "#111827", letterSpacing: "2px", marginBottom: "10px" }}>KALKULATOR CENY</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}><span style={{ color: "#374151" }}>{pakiet.nazwa}</span><span style={{ fontWeight: 600 }}>{pakiet.cena} zł/os</span></div>
                {(pakiet.doplaty || []).filter((d) => doplaty[d.id] && !d.stala && (d.cena ?? 0) > 0).map((d) => <div key={d.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#64748b" }}><span>+ {d.label}</span><span style={{ fontWeight: 600 }}>+{(d.cena ?? 0)} zł/os</span></div>)}
                {cena.dop > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", fontWeight: 600, borderTop: "1px dashed #e2e8f0", paddingTop: "4px", marginTop: "2px", color: "#111827" }}><span>Łącznie na osobę</span><span>{cena.perOsoba} zł</span></div>}
                {effGuests != null && effGuests > 0 ? <>{(pakiet.doplaty || []).filter((d) => doplaty[d.id] && d.stala).map((d) => <div key={d.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#64748b" }}><span>+ {d.label} (ryczałt)</span><span style={{ fontWeight: 600 }}>+{fmtZl(d.stala ?? 0)}</span></div>)}<div style={{ display: "flex", justifyContent: "space-between", fontSize: "18px", fontWeight: 700, color: "#111827", borderTop: "1px solid #e2e8f0", paddingTop: "10px", marginTop: "6px" }}><span>RAZEM</span><span>{fmtZl(cena.total)}</span></div></> : <div style={{ color: "#64748b", fontSize: "12px", fontStyle: "italic", borderTop: "1px solid #e2e8f0", paddingTop: "8px", marginTop: "4px" }}>Zmień liczbę gości powyżej aby zobaczyć łączną kwotę</div>}
              </div>
            </div>
          )}
        </>
      )}
      {confirmReset && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", zIndex: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "white", borderRadius: "8px", padding: "24px", width: "340px", boxShadow: "0 4px 24px rgba(0,0,0,0.12)", border: "1px solid #e5e5e5" }}>
            <div style={{ fontSize: "16px", fontWeight: 700, textAlign: "center", marginBottom: "8px", color: "#111827" }}>Zmienić pakiet?</div>
            <div style={{ fontSize: "13px", color: "#64748b", textAlign: "center", lineHeight: 1.6, marginBottom: "20px" }}>Zmiana pakietu usunie wszystkie dotychczas wybrane dania i dopłaty.</div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setConfirmReset(null)} style={{ flex: 1, background: "white", border: "1px solid #e2e8f0", borderRadius: "4px", padding: "10px", cursor: "pointer", fontSize: "13px", fontWeight: 600, color: "#374151" }}>Zostań</button>
              <button onClick={() => doChangePakiet(confirmReset)} style={{ flex: 1, background: "#ef4444", color: "white", border: "none", borderRadius: "4px", padding: "10px", cursor: "pointer", fontSize: "13px", fontWeight: 600 }}>Tak, zmień</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MenuTab;
