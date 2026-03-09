"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { MenuTab } from "@/components/events/menu-modul";

const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

type EventRecord = {
  id: string;
  date: string;
  tf: string | null;
  tt: string | null;
  type: string;
  client: string | null;
  phone: string | null;
  room: string | null;
  guests: number | null;
  deposit: number | null;
  paid: boolean;
  status: string;
  notes: string;
  pop: boolean;
  parentEventId: string | null;
  menu?: Record<string, unknown> | null;
  quoteId: string | null;
  checklistDocId: string | null;
  menuDocId: string | null;
  googleCalendarEventId: string | null;
  googleCalendarCalId: string | null;
  googleCalendarSynced: boolean;
};

function mapApiToEvent(record: Record<string, unknown>): EventRecord {
  const eventDate = record.eventDate as Date | string | null | undefined;
  const dateFrom = record.dateFrom as Date | string | null | undefined;
  const d = eventDate ?? dateFrom;
  const dateStr = d ? new Date(d).toISOString().split("T")[0] : "";
  const dep = record.depositAmount;
  const depNum = dep != null ? (typeof dep === "object" && dep !== null && "toNumber" in dep ? (dep as { toNumber: () => number }).toNumber() : Number(dep)) : null;
  return {
    id: String(record.id),
    date: dateStr,
    tf: (record.timeStart as string) ?? null,
    tt: (record.timeEnd as string) ?? null,
    type: (record.eventType as string) ?? "INNE",
    client: (record.clientName as string) ?? null,
    phone: (record.clientPhone as string) ?? null,
    room: (record.roomName as string) ?? null,
    guests: record.guestCount != null ? Number(record.guestCount) : null,
    deposit: depNum,
    paid: Boolean(record.depositPaid),
    status: (record.status as string) ?? "DRAFT",
    notes: (record.notes as string) ?? "",
    pop: Boolean(record.isPoprawiny),
    parentEventId: (record.parentEventId as string) ?? null,
    menu: (record.menu as Record<string, unknown> | null) ?? null,
    quoteId: (record.quoteId as string) ?? null,
    checklistDocId: (record.checklistDocId as string) ?? null,
    menuDocId: (record.menuDocId as string) ?? null,
    googleCalendarEventId: (record.googleCalendarEventId as string) ?? null,
    googleCalendarCalId: (record.googleCalendarCalId as string) ?? null,
    googleCalendarSynced: Boolean(record.googleCalendarSynced),
  };
}

const TC: Record<string, { bg: string; bd: string; tx: string; dot: string }> = {
  WESELE: { bg: "#FFF8E1", bd: "#F6BF26", tx: "#7B5E00", dot: "#F6BF26" },
  KOMUNIA: { bg: "#E8EAF6", bd: "#3F51B5", tx: "#1A237E", dot: "#3F51B5" },
  CHRZCINY: { bg: "#FCE4EC", bd: "#AD1457", tx: "#880E4F", dot: "#AD1457" },
  URODZINY: { bg: "#E3F2FD", bd: "#039BE5", tx: "#01579B", dot: "#039BE5" },
  STYPA: { bg: "#F3E5F5", bd: "#8E24AA", tx: "#4A148C", dot: "#8E24AA" },
  FIRMOWA: { bg: "#F5F5F5", bd: "#616161", tx: "#212121", dot: "#616161" },
  SYLWESTER: { bg: "#FFF8E1", bd: "#D4A017", tx: "#7B5E00", dot: "#D4A017" },
  INNE: { bg: "#FCE4EC", bd: "#C2185B", tx: "#880E4F", dot: "#C2185B" },
};
const TC_WESELE_DIAMENTOWA = { bg: "#E3F2FD", bd: "#039BE5", tx: "#01579B", dot: "#039BE5" };

function getEventColor(ev: { type: string; room?: string | null }) {
  if (ev.type === "WESELE" && ev.room?.includes("Diamentowa")) {
    return TC_WESELE_DIAMENTOWA;
  }
  return TC[ev.type] || TC.INNE;
}

const TYPE_EMOJI: Record<string, string> = {
  WESELE: "💒",
  KOMUNIA: "⛪",
  CHRZCINY: "👶",
  URODZINY: "🎂",
  STYPA: "🕯️",
  FIRMOWA: "💼",
  SYLWESTER: "🎆",
  INNE: "📋",
};

const TL: Record<string, string> = { WESELE: "Wesele", KOMUNIA: "Komunia", CHRZCINY: "Chrzciny", URODZINY: "Urodziny", STYPA: "Stypa", FIRMOWA: "Firmowa", SYLWESTER: "Sylwester", INNE: "Imprezy zapisowe" };
const TYPE_SHORT: Record<string, string> = {
  WESELE: "W",
  KOMUNIA: "K",
  CHRZCINY: "Ch",
  URODZINY: "U",
  STYPA: "S",
  FIRMOWA: "F",
  SYLWESTER: "Sy",
  INNE: "Iz",
};
const SC: Record<string, { label: string; bg: string; tx: string; bd: string; dot: string }> = {
  CONFIRMED: { label: "Potwierdzone", bg: "#f0fdf4", tx: "#166534", bd: "#86efac", dot: "#22c55e" },
  DRAFT: { label: "Szkic", bg: "#fefce8", tx: "#92400e", bd: "#fde68a", dot: "#eab308" },
  DONE: { label: "Zakończone", bg: "#f1f5f9", tx: "#334155", bd: "#cbd5e1", dot: "#64748b" },
  CANCELLED: { label: "Anulowane", bg: "#fef2f2", tx: "#991b1b", bd: "#fca5a5", dot: "#ef4444" },
};
const ROOMS = [
  "Sala Złota",
  "Sala Diamentowa",
  "Restauracja",
  "Pokój 10",
  "Pokój 30",
  "Wiata",
  "Do ustalenia",
];
const RC: Record<string, string> = {
  "Sala Złota": "#f59e0b",
  "Sala Diamentowa": "#8b5cf6",
  Restauracja: "#10b981",
  "Pokój 10": "#3b82f6",
  "Pokój 30": "#ec4899",
  Wiata: "#14b8a6",
  "Do ustalenia": "#94a3b8",
};

// Normalizacja nazw sal — mapowanie starych/nietypowych → aktualne
const ROOM_ALIASES: Record<string, string> = {
  "Sala Zlota": "Sala Złota",
  "Sala Duza": "Sala Złota",
  "Sala Duża": "Sala Złota",
  "Sala Testowa": "Do ustalenia",
};

function normalizeRoom(roomStr: string | null | undefined): string {
  if (!roomStr) return "Do ustalenia";
  let normalized = roomStr;
  for (const [alias, target] of Object.entries(ROOM_ALIASES)) {
    normalized = normalized.replace(alias, target);
  }
  return normalized;
}
const MPL = ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"];
const DPLS = ["N", "P", "W", "Ś", "C", "P", "S"];

const fmtDate = (d: string | Date) => new Date(d).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });
const fmtLong = (d: string | Date) => new Date(d).toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const fmtZl = (n: number | null) => (n != null ? n.toLocaleString("pl-PL") + "\u00a0zł" : "—");
const daysTo = (d: string) => {
  const target = new Date(d + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
};
const isWknd = (y: number, m: number, d: number) => {
  const w = new Date(y, m, d).getDay();
  return w === 0 || w === 6;
};

function dayBadge(days: number) {
  if (days < 0) return { t: `${Math.abs(days)}d temu`, bg: "#e2e8f0", tx: "#64748b", hot: false };
  if (days === 0) return { t: "DZIŚ!", bg: "#ef4444", tx: "#fff", hot: true };
  if (days === 1) return { t: "JUTRO", bg: "#f97316", tx: "#fff", hot: true };
  if (days <= 7) return { t: `za ${days}d`, bg: "#fef3c7", tx: "#92400e", hot: true };
  if (days <= 30) return { t: `za ${days}d`, bg: "#dbeafe", tx: "#1e40af", hot: false };
  return { t: `za ${days}d`, bg: "#f1f5f9", tx: "#64748b", hot: false };
}
function plural(n: number) {
  return n === 1 ? "1 impreza" : n < 5 ? `${n} imprezy` : `${n} imprez`;
}

function useEscape(fn: () => void, active = true) {
  useEffect(() => {
    if (!active) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") fn();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [fn, active]);
}

function useClickOutside(ref: React.RefObject<HTMLElement | null>, fn: () => void, active = true) {
  useEffect(() => {
    if (!active) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) fn();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [ref, fn, active]);
}

function useToast() {
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: string }[]>([]);
  const show = useCallback((msg: string, type = "ok") => {
    const id = Date.now();
    setToasts((p) => [...p, { id, msg, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 2800);
  }, []);
  return { toasts, show };
}

function Toasts({ toasts }: { toasts: { id: number; msg: string; type: string }[] }) {
  if (!toasts.length) return null;
  return (
    <div style={{ position: "fixed", bottom: "24px", left: "50%", transform: "translateX(-50%)", zIndex: 9000, display: "flex", flexDirection: "column", gap: "8px", alignItems: "center", pointerEvents: "none" }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          style={{
            background: t.type === "ok" ? "#1e293b" : t.type === "err" ? "#991b1b" : "#92400e",
            color: "white",
            borderRadius: "12px",
            padding: "11px 22px",
            fontSize: "14px",
            fontWeight: 700,
            boxShadow: "0 8px 32px rgba(0,0,0,0.28)",
            whiteSpace: "nowrap",
            animation: "toastIn 0.22s ease",
          }}
        >
          {t.type === "ok" ? "✅ " : t.type === "err" ? "❌ " : "⚠️ "}
          {t.msg}
        </div>
      ))}
    </div>
  );
}

function TypeBadge({ type, pop, room, small }: { type: string; pop: boolean; room?: string | null; small?: boolean }) {
  const c = getEventColor({ type, room });
  return (
    <span style={{ background: c.bg, color: c.tx, border: `1px solid ${c.bd}`, borderRadius: "5px", padding: small ? "1px 5px" : "2px 8px", fontSize: small ? "10px" : "11px", fontWeight: 800, whiteSpace: "nowrap", flexShrink: 0 }}>
      {pop ? "🎊 Poprawiny" : TL[type] ?? type}
    </span>
  );
}

function StatusDot({ status }: { status: string }) {
  const s = SC[status] ?? SC.DRAFT;
  return <span title={s.label} style={{ width: "9px", height: "9px", borderRadius: "50%", background: s.dot, display: "inline-block", flexShrink: 0 }} />;
}

function StatusBadge({ status }: { status: string }) {
  const s = SC[status] ?? SC.DRAFT;
  return <span style={{ background: s.bg, color: s.tx, border: `1px solid ${s.bd}`, borderRadius: "5px", padding: "2px 8px", fontSize: "11px", fontWeight: 700, whiteSpace: "nowrap" }}>{s.label}</span>;
}

function PhoneBtn({ phone }: { phone: string | null }) {
  const [copied, setCopied] = useState(false);
  if (!phone) return <span style={{ color: "#cbd5e1", fontSize: "12px", fontStyle: "italic" }}>brak tel.</span>;
  const copy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard?.writeText(phone.replace(/\s/g, "")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  };
  return (
    <div onClick={(e) => e.stopPropagation()} style={{ display: "inline-flex", alignItems: "center" }}>
      <a href={`tel:${phone.replace(/\s/g, "")}`} style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: "#f0fdf4", border: "1.5px solid #86efac", borderRadius: "7px 0 0 7px", padding: "5px 10px", color: "#166534", textDecoration: "none", fontSize: "12px", fontWeight: 700, whiteSpace: "nowrap" }}>
        📞 {phone}
      </a>
      <button onClick={copy} title="Kopiuj numer" style={{ background: copied ? "#22c55e" : "#f0fdf4", border: "1.5px solid #86efac", borderLeft: "none", borderRadius: "0 7px 7px 0", padding: "5px 7px", cursor: "pointer", fontSize: "12px", color: copied ? "white" : "#166534", fontWeight: 700, whiteSpace: "nowrap" }}>
        {copied ? "✓" : "⎘"}
      </button>
    </div>
  );
}

function DepositChip({
  ev,
  onToggle,
  onOpen,
}: {
  ev: EventRecord;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  if (ev.deposit != null) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle(ev.id);
        }}
        title={ev.paid ? "Kliknij: oznacz jako NIEopłacony" : "Kliknij: oznacz jako OPŁACONY"}
        style={{ background: ev.paid ? "#f0fdf4" : "#fef2f2", border: `1.5px solid ${ev.paid ? "#86efac" : "#fca5a5"}`, borderRadius: "7px", padding: "4px 10px", cursor: "pointer", fontSize: "12px", fontWeight: 700, color: ev.paid ? "#166534" : "#991b1b", display: "inline-flex", alignItems: "center", gap: "4px", whiteSpace: "nowrap" }}
      >
        {ev.paid ? "✅" : "❌"} {fmtZl(ev.deposit)}
      </button>
    );
  }
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onOpen(ev.id);
      }}
      style={{ background: "white", border: "1.5px dashed #cbd5e1", borderRadius: "7px", padding: "4px 10px", cursor: "pointer", fontSize: "12px", color: "#94a3b8", fontWeight: 600, whiteSpace: "nowrap" }}
    >
      + zadatek
    </button>
  );
}

function Pill({ bg, children }: { bg: string; children: React.ReactNode }) {
  return <span style={{ background: bg, color: "white", borderRadius: "7px", padding: "4px 10px", fontSize: "11px", fontWeight: 800, whiteSpace: "nowrap" }}>{children}</span>;
}

function DepositModal({
  existingAmt,
  onSave,
  onClose,
}: {
  existingAmt: number | null;
  onSave: (amt: number, paid: boolean) => void;
  onClose: () => void;
}) {
  const [amt, setAmt] = useState(existingAmt != null ? String(existingAmt) : "");
  const [paid, setPaid] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const inp = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", h, true);
    return () => window.removeEventListener("keydown", h, true);
  }, [onClose]);
  useClickOutside(ref, onClose);
  useEffect(() => {
    setTimeout(() => inp.current?.focus(), 50);
  }, []);
  const save = () => {
    const v = parseFloat(String(amt).replace(",", "."));
    if (!isNaN(v) && v > 0) onSave(v, paid);
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div ref={ref} style={{ background: "white", borderRadius: "16px", padding: "26px", width: "320px", boxShadow: "0 24px 64px rgba(0,0,0,0.3)" }}>
        <div style={{ fontSize: "17px", fontWeight: 900, color: "#0f172a", marginBottom: "16px" }}>💰 {existingAmt != null ? "Zmień zadatek" : "Dodaj zadatek"}</div>
        <div style={{ position: "relative", marginBottom: "12px" }}>
          <input ref={inp} type="number" min={0} value={amt} onChange={(e) => setAmt(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} placeholder="Kwota (zł)" style={{ width: "100%", padding: "12px 40px 12px 14px", boxSizing: "border-box", border: "2px solid #3b82f6", borderRadius: "9px", fontSize: "17px", fontWeight: 700, outline: "none" }} />
          <span style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", color: "#64748b", fontWeight: 800 }}>zł</span>
        </div>
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
          {[true, false].map((p) => (
            <button key={String(p)} onClick={() => setPaid(p)} style={{ flex: 1, padding: "10px", border: `2px solid ${p === paid ? (p ? "#22c55e" : "#ef4444") : "#e2e8f0"}`, background: p === paid ? (p ? "#f0fdf4" : "#fef2f2") : "white", borderRadius: "9px", cursor: "pointer", fontSize: "13px", fontWeight: 800, color: p === paid ? (p ? "#166534" : "#991b1b") : "#94a3b8" }}>
              {p ? "✅ Zapłacony" : "❌ Nieopłacony"}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={save} style={{ flex: 1, background: "#3b82f6", color: "white", border: "none", borderRadius: "9px", padding: "12px", cursor: "pointer", fontSize: "14px", fontWeight: 900 }}>
            Zapisz
          </button>
          <button onClick={onClose} style={{ background: "white", border: "2px solid #e2e8f0", borderRadius: "9px", padding: "12px 16px", cursor: "pointer", fontSize: "13px", color: "#64748b" }}>
            Anuluj
          </button>
        </div>
      </div>
    </div>
  );
}

function CancelConfirmModal({ clientName, onConfirm, onClose }: { clientName: string | null; onConfirm: () => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEscape(onClose);
  useClickOutside(ref, onClose);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div ref={ref} style={{ background: "white", borderRadius: "16px", padding: "28px", width: "360px", boxShadow: "0 24px 64px rgba(0,0,0,0.35)" }}>
        <div style={{ fontSize: "32px", textAlign: "center", marginBottom: "10px" }}>⚠️</div>
        <div style={{ fontSize: "17px", fontWeight: 900, color: "#0f172a", textAlign: "center", marginBottom: "8px" }}>Anulować imprezę?</div>
        <div style={{ fontSize: "14px", color: "#64748b", textAlign: "center", lineHeight: 1.6, marginBottom: "22px" }}>
          <strong style={{ color: "#0f172a" }}>{clientName ?? "—"}</strong>
          <br />
          Status zostanie zmieniony na ANULOWANE.
          <br />
          Możesz przywrócić imprezę później.
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={onClose} style={{ flex: 1, background: "white", border: "2px solid #e2e8f0", borderRadius: "10px", padding: "12px", cursor: "pointer", fontSize: "14px", fontWeight: 700, color: "#374151" }}>
            Wróć
          </button>
          <button onClick={onConfirm} style={{ flex: 1, background: "#ef4444", color: "white", border: "none", borderRadius: "10px", padding: "12px", cursor: "pointer", fontSize: "14px", fontWeight: 900 }}>
            Tak, anuluj
          </button>
        </div>
      </div>
    </div>
  );
}

type Handlers = {
  toggleDeposit: (id: string) => Promise<void>;
  setDeposit: (id: string, amt: number, paid: boolean) => Promise<void>;
  updateNote: (id: string, text: string) => Promise<void>;
  changeStatus: (id: string, status: string) => Promise<void>;
  updateMenu: (id: string, menuData: Record<string, unknown>) => Promise<void>;
};

function EventDetailModal({
  evId,
  events,
  onClose,
  handlers,
  showToast,
  onOpenModal,
}: {
  evId: string;
  events: EventRecord[];
  onClose: () => void;
  handlers: Handlers;
  showToast: (msg: string, type?: string) => void;
  onOpenModal?: (id: string) => void;
}) {
  const ev = events.find((e) => e.id === evId);
  const [editNote, setEditNote] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [showDep, setShowDep] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [zakladka, setZakladka] = useState<"szczegoly" | "menu">("szczegoly");
  const ref = useRef<HTMLDivElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const subOpen = showDep || showCancel;

  useEffect(() => {
    setNoteText(ev?.notes ?? "");
  }, [ev?.notes]);
  useEffect(() => {
    setZakladka("szczegoly");
  }, [ev?.id]);
  useEffect(() => {
    if (editNote) noteRef.current?.focus();
  }, [editNote]);
  useEscape(onClose, !subOpen);
  useClickOutside(ref, onClose, !subOpen);

  if (!ev) return null;
  const c = getEventColor(ev);
  const days = daysTo(ev.date);
  const db = dayBadge(days);

  const onErr = () => showToast("Błąd zapisu — zmiany cofnięte", "err");
  const doStatus = (s: string) => handlers.changeStatus(evId, s).then(() => showToast(`Status: ${SC[s]?.label ?? s}`)).catch(onErr);
  const doToggleDep = () => handlers.toggleDeposit(evId).then(() => showToast(ev.paid ? "Cofnięto — nieopłacony" : "Opłacony ✅")).catch(onErr);
  const doSaveDep = (a: number, p: boolean) => handlers.setDeposit(evId, a, p).then(() => { setShowDep(false); showToast(`Zadatek ${fmtZl(a)} ${p ? "opłacony" : "nieopłacony"}`); }).catch(onErr);
  const doSaveNote = () => handlers.updateNote(evId, noteText).then(() => { setEditNote(false); showToast("Notatka zapisana"); }).catch(onErr);
  const doCancel = () => handlers.changeStatus(evId, "CANCELLED").then(() => { setShowCancel(false); showToast("Impreza anulowana", "warn"); onClose(); }).catch(onErr);
  const doRestore = () => handlers.changeStatus(evId, "CONFIRMED").then(() => showToast("Impreza przywrócona ✅")).catch(onErr);

  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.7)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: "12px" }}>
        <div ref={ref} style={{ background: "white", borderRadius: "20px", width: "100%", maxWidth: "600px", maxHeight: "94vh", display: "flex", flexDirection: "column", boxShadow: "0 32px 80px rgba(0,0,0,0.5)" }}>
          <div style={{ background: `linear-gradient(135deg,${c.bd}20,${c.bg})`, borderBottom: `2px solid ${c.bd}40`, padding: "18px 20px", borderRadius: "20px 20px 0 0", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center", marginBottom: "7px" }}>
                  <TypeBadge type={ev.type} pop={ev.pop} room={ev.room} />
                  <StatusBadge status={ev.status} />
                  <span style={{ background: db.bg, color: db.tx, borderRadius: "5px", padding: "2px 7px", fontSize: "11px", fontWeight: 800 }}>{db.t}</span>
                </div>
                <div style={{ fontSize: "20px", fontWeight: 900, color: "#0f172a", lineHeight: 1.25, wordBreak: "break-word" }}>{ev.client ?? "—"}</div>
                <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
                  <span>📅 {fmtLong(ev.date)}</span>
                  {(ev.tf || ev.tt) && <span>⏰ {ev.tf ?? "?"}–{ev.tt ?? "?"}</span>}
                </div>
              </div>
              <button onClick={onClose} style={{ background: "rgba(0,0,0,0.07)", border: "none", borderRadius: "50%", width: "34px", height: "34px", cursor: "pointer", fontSize: "18px", color: "#64748b" }}>×</button>
            </div>
          </div>
          {/* Zakładki */}
          <div style={{ display: "flex", borderBottom: "2px solid #e2e8f0", marginBottom: "16px", marginLeft: "20px", marginRight: "20px", gap: "0" }}>
            {([
              ["szczegoly", "📋 Szczegóły"],
              ["menu", "🍽️ Menu"],
            ] as const).map(([t, label]) => (
              <button
                key={t}
                onClick={() => setZakladka(t)}
                style={{
                  padding: "10px 20px",
                  border: "none",
                  borderBottom: zakladka === t ? "3px solid #3b82f6" : "3px solid transparent",
                  background: "none",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: zakladka === t ? 800 : 500,
                  color: zakladka === t ? "#1e40af" : "#64748b",
                  marginBottom: "-2px",
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: "12px" }}>
            {zakladka === "szczegoly" && (
            <>
            {ev.phone ? (
              <a href={`tel:${ev.phone.replace(/\s/g, "")}`} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", background: "#f0fdf4", border: "2px solid #22c55e", borderRadius: "12px", padding: "14px", textDecoration: "none", fontSize: "16px", fontWeight: 900, color: "#166534" }}>📞 Zadzwoń: {ev.phone}</a>
            ) : (
              <div style={{ background: "#f8fafc", border: "2px dashed #e2e8f0", borderRadius: "12px", padding: "12px", textAlign: "center", color: "#94a3b8", fontSize: "13px" }}>📵 Brak numeru telefonu</div>
            )}
            <div style={{ background: "#f8fafc", borderRadius: "12px", padding: "14px" }}>
              <div style={{ fontSize: "10px", fontWeight: 900, color: "#94a3b8", letterSpacing: "2px", marginBottom: "9px" }}>STATUS</div>
              <div style={{ display: "flex", gap: "8px" }}>
                {["CONFIRMED", "DRAFT", "DONE"].map((s) => (
                  <button key={s} onClick={() => doStatus(s)} style={{ flex: 1, padding: "9px 12px", background: ev.status === s ? SC[s].bg : "white", border: `2px solid ${ev.status === s ? SC[s].bd : "#e2e8f0"}`, borderRadius: "9px", cursor: "pointer", fontSize: "13px", fontWeight: 800, color: ev.status === s ? SC[s].tx : "#64748b", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                    <StatusDot status={s} />{SC[s].label}{ev.status === s ? " ✓" : ""}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ background: "#f8fafc", borderRadius: "12px", padding: "14px" }}>
              <div style={{ fontSize: "10px", fontWeight: 900, color: "#94a3b8", letterSpacing: "2px", marginBottom: "9px" }}>SZCZEGÓŁY</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                {[["🏛 Sala", ev.room ?? "—"], ["👥 Goście", ev.guests ? ev.guests + " osób" : "—"], ["⏰ Godziny", (ev.tf || ev.tt) ? `${ev.tf ?? "?"}–${ev.tt ?? "?"}` : "—"], ["📊 Status", SC[ev.status]?.label ?? "—"]].map(([l, v]) => (
                  <div key={l}><div style={{ fontSize: "10px", color: "#94a3b8", fontWeight: 700, marginBottom: "2px" }}>{l}</div><div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>{v}</div></div>
                ))}
              </div>
            </div>
            {ev.quoteId && (
              <div style={{ background: "#f5f3ff", border: "1.5px solid #a78bfa", borderRadius: "10px", padding: "10px 14px", display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "18px" }}>💰</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "10px", fontWeight: 900, color: "#7c3aed", letterSpacing: "1px" }}>KOSZTORYS</div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#4c1d95" }}>Powiązany kosztorys: {ev.quoteId}</div>
                </div>
                <button onClick={() => { window.location.href = "/mice/kosztorysy"; }} style={{ background: "#7c3aed", color: "white", border: "none", borderRadius: "7px", padding: "6px 12px", cursor: "pointer", fontSize: "11px", fontWeight: 800 }}>Otwórz</button>
              </div>
            )}
            <div style={{ background: ev.googleCalendarSynced ? "#f0fdf4" : "#fefce8", border: `1.5px solid ${ev.googleCalendarSynced ? "#86efac" : "#fde68a"}`, borderRadius: "10px", padding: "10px 14px", display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "18px" }}>{ev.googleCalendarSynced ? "📅" : "⚠️"}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: ev.googleCalendarSynced ? "#166534" : "#92400e" }}>
                  {ev.googleCalendarSynced ? "Zsynchronizowane z Google Calendar" : "Nie zsynchronizowane z Google Calendar"}
                </div>
              </div>
              {ev.googleCalendarEventId && ev.googleCalendarCalId && (
                <button onClick={() => { window.open(`https://calendar.google.com/calendar/r/event/${ev.googleCalendarEventId}`, "_blank"); }} style={{ background: "white", border: "1.5px solid #e2e8f0", borderRadius: "7px", padding: "6px 12px", cursor: "pointer", fontSize: "11px", fontWeight: 700, color: "#3b82f6" }}>Otwórz w GCal</button>
              )}
            </div>
            {ev.pop && (
              <div style={{ background: "#fdf2f8", border: "1.5px solid #f9a8d4", borderRadius: "10px", padding: "10px 14px", display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "18px" }}>🎊</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#9d174d" }}>To są poprawiny</div>
                  {ev.parentEventId && (
                    <div style={{ fontSize: "11px", color: "#be185d" }}>Główne wesele: {events.find((e) => e.id === ev.parentEventId)?.client ?? ev.parentEventId}</div>
                  )}
                </div>
                {ev.parentEventId && onOpenModal && (
                  <button onClick={() => { onClose(); setTimeout(() => onOpenModal(ev.parentEventId!), 100); }} style={{ background: "#ec4899", color: "white", border: "none", borderRadius: "7px", padding: "6px 12px", cursor: "pointer", fontSize: "11px", fontWeight: 800 }}>Otwórz wesele</button>
                )}
              </div>
            )}
            <div style={{ background: "#f8fafc", borderRadius: "12px", padding: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "9px" }}>
                <div style={{ fontSize: "10px", fontWeight: 900, color: "#94a3b8", letterSpacing: "2px" }}>ZADATEK</div>
                <button onClick={() => setShowDep(true)} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "7px", padding: "4px 10px", cursor: "pointer", fontSize: "11px", fontWeight: 700, color: "#3b82f6" }}>{ev.deposit != null ? "✏️ Zmień" : "+ Dodaj"}</button>
              </div>
              {ev.deposit != null ? (
                <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                  <div style={{ fontSize: "22px", fontWeight: 900, color: ev.paid ? "#166534" : "#991b1b" }}>{ev.paid ? "✅" : "❌"} {fmtZl(ev.deposit)}</div>
                  <button onClick={doToggleDep} style={{ background: ev.paid ? "#fef2f2" : "#f0fdf4", border: `1.5px solid ${ev.paid ? "#fca5a5" : "#86efac"}`, borderRadius: "9px", padding: "7px 14px", cursor: "pointer", fontSize: "12px", fontWeight: 800, color: ev.paid ? "#991b1b" : "#166534" }}>{ev.paid ? "↩ Cofnij" : "✅ Oznacz opłacony"}</button>
                </div>
              ) : (
                <div style={{ color: "#94a3b8", fontSize: "13px", fontStyle: "italic" }}>Brak zadatku — kliknij Dodaj</div>
              )}
            </div>
            <div style={{ background: "#f8fafc", borderRadius: "12px", padding: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "9px" }}>
                <div style={{ fontSize: "10px", fontWeight: 900, color: "#94a3b8", letterSpacing: "2px" }}>NOTATKA</div>
                {!editNote && <button onClick={() => setEditNote(true)} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "7px", padding: "4px 10px", cursor: "pointer", fontSize: "11px", fontWeight: 700, color: "#64748b" }}>✏️ Edytuj</button>}
              </div>
              {editNote ? (
                <div>
                  <textarea ref={noteRef} value={noteText} onChange={(e) => setNoteText(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); setEditNote(false); } if (e.key === "Enter" && e.ctrlKey) doSaveNote(); }} style={{ width: "100%", minHeight: "80px", padding: "10px", border: "2px solid #3b82f6", borderRadius: "9px", fontSize: "13px", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit", lineHeight: 1.6, outline: "none" }} />
                  <div style={{ display: "flex", gap: "8px", marginTop: "8px", alignItems: "center" }}>
                    <button onClick={doSaveNote} style={{ background: "#3b82f6", color: "white", border: "none", borderRadius: "8px", padding: "8px 18px", cursor: "pointer", fontSize: "13px", fontWeight: 800 }}>Zapisz</button>
                    <button onClick={() => { setEditNote(false); setNoteText(ev.notes ?? ""); }} style={{ background: "white", border: "1.5px solid #e2e8f0", borderRadius: "8px", padding: "8px 14px", cursor: "pointer", fontSize: "13px", color: "#64748b" }}>Anuluj</button>
                    <span style={{ fontSize: "11px", color: "#94a3b8" }}>Ctrl+Enter</span>
                  </div>
                </div>
              ) : (
                <div onClick={() => setEditNote(true)} style={{ fontSize: "13px", color: ev.notes ? "#0f172a" : "#94a3b8", lineHeight: 1.6, cursor: "text", whiteSpace: "pre-wrap", minHeight: "32px", padding: "8px", background: "white", border: "1.5px dashed #e2e8f0", borderRadius: "8px" }}>{ev.notes || "Brak notatki — kliknij aby dodać..."}</div>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <a href={`/events/${ev.id}/edit`} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", background: "white", border: "1.5px solid #e2e8f0", borderRadius: "10px", padding: "12px", textDecoration: "none", fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>✏️ Edytuj formularz</a>
              <button onClick={() => { const docId = ev.menuDocId ?? ev.checklistDocId; if (docId) window.open(`https://docs.google.com/document/d/${docId}/edit`, "_blank"); else showToast("Dokumenty Google Docs — w przygotowaniu", "warn"); }} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", background: "white", border: "1.5px solid #e2e8f0", borderRadius: "10px", padding: "12px", cursor: "pointer", fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>📄 Dokumenty</button>
            </div>
            </>
            )}

            {zakladka === "menu" && (
              <MenuTab
                ev={{ type: ev.type, client: ev.client, date: ev.date, guests: ev.guests }}
                savedMenu={ev.menu ?? null}
                onSave={async (menuData) => {
                  try {
                    await handlers.updateMenu(ev.id, menuData);
                    showToast("Menu zapisane");
                  } catch {
                    showToast("Błąd zapisu menu", "err");
                  }
                }}
              />
            )}
          </div>
          <div style={{ padding: "13px 20px", background: "#f8fafc", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", borderRadius: "0 0 20px 20px", flexShrink: 0 }}>
            {ev.status === "CANCELLED" ? (
              <button onClick={doRestore} style={{ background: "#f0fdf4", border: "1.5px solid #86efac", borderRadius: "9px", padding: "8px 16px", cursor: "pointer", fontSize: "12px", fontWeight: 700, color: "#166534" }}>⟳ Przywróć imprezę</button>
            ) : (
              <button onClick={() => setShowCancel(true)} style={{ background: "#fef2f2", border: "1.5px solid #fca5a5", borderRadius: "9px", padding: "8px 16px", cursor: "pointer", fontSize: "12px", fontWeight: 700, color: "#991b1b" }}>🗑 Anuluj imprezę</button>
            )}
            <button onClick={onClose} style={{ background: "#1e293b", color: "white", border: "none", borderRadius: "9px", padding: "10px 24px", cursor: "pointer", fontSize: "13px", fontWeight: 700 }}>Zamknij <span style={{ opacity: 0.4, fontSize: "11px" }}>Esc</span></button>
          </div>
        </div>
      </div>
      {showDep && <DepositModal existingAmt={ev.deposit} onSave={doSaveDep} onClose={() => setShowDep(false)} />}
      {showCancel && <CancelConfirmModal clientName={ev.client} onConfirm={doCancel} onClose={() => setShowCancel(false)} />}
    </>
  );
}

function EventCard({
  ev,
  expanded,
  onToggle,
  onOpenModal,
  onDepositToggle,
  onDepositOpen,
}: {
  ev: EventRecord;
  expanded: boolean;
  onToggle: () => void;
  onOpenModal: (id: string) => void;
  onDepositToggle: (id: string) => void;
  onDepositOpen: (id: string) => void;
}) {
  const c = getEventColor(ev);
  const days = daysTo(ev.date);
  const db = dayBadge(days);
  const past = days < 0;
  const cancelled = ev.status === "CANCELLED";
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (expanded) ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [expanded]);
  const leftBorder = cancelled ? "#ef4444" : db.hot && !past ? "#f97316" : c.bd;
  return (
    <div ref={ref} id={`ev-${ev.id}`} style={{ background: cancelled ? "#fff8f8" : "white", border: "1px solid #e8edf2", borderLeft: `4px solid ${leftBorder}`, borderRadius: "11px", boxShadow: expanded ? `0 3px 16px ${c.bd}28` : "0 1px 3px rgba(0,0,0,0.05)", opacity: past && !cancelled ? 0.72 : 1, transition: "box-shadow 0.15s" }}>
      <div onClick={onToggle} style={{ padding: "10px 12px", cursor: "pointer", userSelect: "none" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "nowrap", overflow: "hidden" }}>
          <div style={{ flexShrink: 0, minWidth: "88px" }}>
            <div style={{ fontSize: "13px", fontWeight: 800, color: cancelled ? "#991b1b" : "#0f172a", textDecoration: cancelled ? "line-through" : "none" }}>{fmtDate(ev.date)}</div>
            <span style={{ display: "inline-block", background: db.bg, color: db.tx, borderRadius: "4px", padding: "1px 5px", fontSize: "9px", fontWeight: 800, marginTop: "2px" }}>{db.t}</span>
            {(ev.tf || ev.tt) && <div style={{ fontSize: "9px", color: "#94a3b8", marginTop: "1px" }}>⏰ {ev.tf ?? "?"}–{ev.tt ?? "?"}</div>}
          </div>
          <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: "3px", alignItems: "flex-start" }}>
            <TypeBadge type={ev.type} pop={ev.pop} room={ev.room} />
            {ev.status !== "CONFIRMED" && <StatusBadge status={ev.status} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "14px", fontWeight: 800, color: cancelled ? "#991b1b" : "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: cancelled ? "line-through" : "none" }}>{ev.client ?? "—"}</div>
            <div style={{ fontSize: "11px", color: "#64748b", marginTop: "1px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>🏛 {ev.room ?? "—"}{ev.guests ? ` · 👥 ${ev.guests} os.` : ""}{ev.notes ? <span style={{ marginLeft: "6px", color: "#94a3b8" }}>· 📝</span> : null}</div>
          </div>
          <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: "6px" }}>
            <StatusDot status={ev.status} />
            <span style={{ color: "#cbd5e1", fontSize: "10px", transition: "transform 0.18s", transform: expanded ? "rotate(180deg)" : "none", display: "block" }}>▼</span>
          </div>
        </div>
        <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "7px", flexWrap: "wrap" }}>
          <PhoneBtn phone={ev.phone} />
          <DepositChip ev={ev} onToggle={onDepositToggle} onOpen={onDepositOpen} />
        </div>
      </div>
      {expanded && (
        <div style={{ borderTop: `1px solid ${c.bd}28`, background: `linear-gradient(to bottom,${c.bg}60,white)`, padding: "11px 14px", display: "flex", gap: "10px", flexWrap: "wrap", borderRadius: "0 0 11px 11px" }}>
          <div style={{ flex: "1 1 220px" }}>
            <div style={{ fontSize: "9px", fontWeight: 900, color: "#94a3b8", letterSpacing: "2px", marginBottom: "5px" }}>NOTATKA</div>
            <div style={{ fontSize: "13px", color: ev.notes ? "#0f172a" : "#94a3b8", lineHeight: 1.6, background: "white", border: "1.5px dashed #e2e8f0", borderRadius: "8px", padding: "9px", whiteSpace: "pre-wrap", minHeight: "44px" }}>{ev.notes || "Brak notatki"}</div>
          </div>
          <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", gap: "6px", minWidth: "180px" }}>
            <div style={{ fontSize: "9px", fontWeight: 900, color: "#94a3b8", letterSpacing: "2px", marginBottom: "2px" }}>AKCJE</div>
            <button onClick={(e) => { e.stopPropagation(); onOpenModal(ev.id); }} style={{ background: "#3b82f6", color: "white", border: "none", borderRadius: "9px", padding: "9px 14px", cursor: "pointer", fontSize: "13px", fontWeight: 800 }}>🔍 Szczegóły i edycja</button>
            {ev.phone && <a href={`tel:${ev.phone.replace(/\s/g, "")}`} onClick={(e) => e.stopPropagation()} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "7px", background: "#f0fdf4", border: "1.5px solid #86efac", borderRadius: "9px", padding: "9px 14px", textDecoration: "none", fontSize: "13px", fontWeight: 700, color: "#166534" }}>📞 Zadzwoń</a>}
          </div>
        </div>
      )}
    </div>
  );
}

function KosztorysyView() {
  const [quotes, setQuotes] = useState<{ id: string; name: string; validUntil: string | null; totalAmount: number | null; items?: unknown[] }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/mice/kosztorysy")
      .then((r) => r.json())
      .then((data) => {
        setQuotes(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div style={{ textAlign: "center", padding: "60px", color: "#64748b" }}>
        <div style={{ fontSize: "24px", marginBottom: "10px" }}>⏳</div>
        <div style={{ fontWeight: 700 }}>Ładowanie kosztorysów...</div>
      </div>
    );

  return (
    <div style={{ padding: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div style={{ fontSize: "17px", fontWeight: 900, color: "#0f172a" }}>Kosztorysy grupowe</div>
        <button
          onClick={() => (window.location.href = "/mice/kosztorysy")}
          style={{ background: "#3b82f6", color: "white", border: "none", borderRadius: "9px", padding: "8px 16px", cursor: "pointer", fontSize: "13px", fontWeight: 800 }}
        >
          ✏️ Zarządzaj kosztorysami
        </button>
      </div>

      {quotes.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px", color: "#94a3b8" }}>
          <div style={{ fontSize: "36px", marginBottom: "8px" }}>💰</div>
          <div style={{ fontSize: "15px", fontWeight: 700 }}>Brak kosztorysów</div>
          <div style={{ fontSize: "13px", marginTop: "6px" }}>Utwórz kosztorys w zakładce Kosztorysy MICE</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {quotes.map((q) => {
            const amt = q.totalAmount != null ? (typeof q.totalAmount === "object" && q.totalAmount !== null && "toNumber" in q.totalAmount ? (q.totalAmount as { toNumber: () => number }).toNumber() : Number(q.totalAmount)) : null;
            return (
              <div
                key={q.id}
                style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "11px", padding: "14px 16px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: "14px", color: "#0f172a" }}>{q.name}</div>
                    <div style={{ fontSize: "12px", color: "#64748b", marginTop: "3px" }}>
                      Ważny do: {q.validUntil ? new Date(q.validUntil).toLocaleDateString("pl-PL") : "—"}
                      {" · "}
                      {((q.items as unknown[]) || []).length} pozycji
                    </div>
                  </div>
                  <div style={{ fontSize: "18px", fontWeight: 900, color: "#166534" }}>{amt != null ? fmtZl(amt) : "—"}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DayPopup({
  room,
  day,
  monthLabel,
  events,
  onClose,
  onOpenModal,
}: {
  room: string;
  day: number;
  monthLabel: string;
  events: EventRecord[];
  onClose: () => void;
  onOpenModal: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEscape(onClose);
  useClickOutside(ref, onClose);
  const col = RC[room] ?? "#94a3b8";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        zIndex: 600,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        ref={ref}
        style={{
          background: "white",
          borderRadius: "16px",
          width: "400px",
          maxHeight: "75vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 24px 64px rgba(0,0,0,0.35)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            background: `linear-gradient(135deg, ${col}, ${col}cc)`,
            padding: "14px 18px",
            flexShrink: 0,
          }}
        >
          <div style={{ color: "white", fontWeight: 900, fontSize: "15px" }}>
            📅 {day} {monthLabel} · {room}
          </div>
          <div style={{ color: "rgba(255,255,255,0.8)", fontSize: "12px", fontWeight: 600, marginTop: "2px" }}>{plural(events.length)}</div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
          {events.map((ev, i) => {
            const c = getEventColor(ev);
            return (
              <div
                key={ev.id}
                onClick={() => {
                  onClose();
                  onOpenModal(ev.id);
                }}
                style={{
                  padding: "10px 12px",
                  borderRadius: "9px",
                  cursor: "pointer",
                  borderLeft: `4px solid ${c.bd}`,
                  marginBottom: "4px",
                  background: i % 2 === 0 ? "#f8fafc" : "white",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = c.bg)}
                onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 === 0 ? "#f8fafc" : "white")}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <TypeBadge type={ev.type} pop={ev.pop} room={ev.room} small />
                  <span style={{ fontWeight: 800, fontSize: "13px", color: "#0f172a" }}>{ev.client ?? "—"}</span>
                </div>
                <div style={{ fontSize: "11px", color: "#64748b", marginTop: "3px" }}>
                  👥 {ev.guests ?? "—"} os.
                  {ev.phone && <span> · 📞 {ev.phone}</span>}
                  {ev.notes && <span> · 📝</span>}
                </div>
              </div>
            );
          })}
        </div>
        <div
          style={{
            padding: "10px 14px",
            borderTop: "1px solid #e2e8f0",
            flexShrink: 0,
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={onClose}
            style={{
              background: "#1e293b",
              color: "white",
              border: "none",
              borderRadius: "8px",
              padding: "8px 20px",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: "13px",
            }}
          >
            Zamknij <span style={{ opacity: 0.4, fontSize: "11px" }}>Esc</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function MonthNav({ month, year, onPrev, onNext, onToday }: { month: number; year: number; onPrev: () => void; onNext: () => void; onToday: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
      <button onClick={onPrev} style={{ background: "white", border: "2px solid #e2e8f0", borderRadius: "9px", padding: "7px 14px", cursor: "pointer", fontSize: "16px", fontWeight: 700 }}>←</button>
      <div style={{ fontSize: "19px", fontWeight: 900, color: "#0f172a", minWidth: "200px", textAlign: "center" }}>{MPL[month]} {year}</div>
      <button onClick={onNext} style={{ background: "white", border: "2px solid #e2e8f0", borderRadius: "9px", padding: "7px 14px", cursor: "pointer", fontSize: "16px", fontWeight: 700 }}>→</button>
      <button onClick={onToday} style={{ background: "#f1f5f9", border: "2px solid #e2e8f0", borderRadius: "9px", padding: "7px 12px", cursor: "pointer", fontSize: "12px", fontWeight: 800, color: "#64748b" }}>Dzisiaj</button>
    </div>
  );
}

function CalendarMonthView({ events, month, year, onOpenModal, onMonthChange }: { events: EventRecord[]; month: number; year: number; onOpenModal: (id: string) => void; onMonthChange: (fn: (p: number) => number) => void }) {
  const dInM = new Date(year, month + 1, 0).getDate();
  const firstDow = new Date(year, month, 1).getDay();
  const startOffset = firstDow === 0 ? 6 : firstDow - 1;
  const todayD = TODAY.getFullYear() === year && TODAY.getMonth() === month ? TODAY.getDate() : null;

  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= dInM; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const monthEvs = events.filter((e) => {
    const d = new Date(e.date);
    return d.getFullYear() === year && d.getMonth() === month && e.status !== "CANCELLED";
  });

  return (
    <div style={{ padding: "0 20px 48px" }}>
      <MonthNav month={month} year={year} onPrev={() => onMonthChange((p) => p - 1)} onNext={() => onMonthChange((p) => p + 1)} onToday={() => onMonthChange(() => 0)} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: "2px", marginBottom: "2px" }}>
        {["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Ndz"].map((d) => (
          <div key={d} style={{ textAlign: "center", fontSize: "11px", fontWeight: 700, color: "#94a3b8", padding: "6px 0" }}>{d}</div>
        ))}
      </div>

      {weeks.map((week, wi) => (
        <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: "2px", marginBottom: "2px" }}>
          {week.map((day, di) => {
            if (day === null) return <div key={di} style={{ background: "#f9fafb", minHeight: "100px", borderRadius: "6px" }} />;
            const dayEvs = monthEvs.filter((e) => new Date(e.date).getDate() === day);
            const isToday = day === todayD;
            const isWeekend = di >= 5;
            return (
              <div key={di} style={{ background: isToday ? "#fef2f2" : isWeekend ? "#fafafa" : "white", border: `1px solid ${isToday ? "#fca5a5" : "#f1f5f9"}`, borderRadius: "6px", minHeight: "100px", padding: "4px", display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: "12px", fontWeight: isToday ? 900 : 600, color: isToday ? "#ef4444" : "#64748b", marginBottom: "3px", display: "flex", alignItems: "center", gap: "4px" }}>
                  {isToday && <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#ef4444" }} />}
                  {day}
                  {dayEvs.length > 0 && <span style={{ fontSize: "9px", color: "#94a3b8", fontWeight: 700 }}>({dayEvs.length})</span>}
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px", overflow: "hidden" }}>
                  {dayEvs.slice(0, 4).map((ev) => {
                    const tc = getEventColor(ev);
                    const emoji = TYPE_EMOJI[ev.type] ?? "📋";
                    return (
                      <div key={ev.id} onClick={() => onOpenModal(ev.id)}
                        style={{ background: tc.bg, borderLeft: `3px solid ${tc.bd}`, borderRadius: "3px", padding: "1px 4px", cursor: "pointer", fontSize: "9px", fontWeight: 700, color: tc.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: "15px" }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = tc.bd + "22"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = tc.bg; }}>
                        {emoji} {(ev.client ?? "").split(/\s+/).slice(0, 2).join(" ")}
                      </div>
                    );
                  })}
                  {dayEvs.length > 4 && (
                    <div style={{ fontSize: "9px", color: "#94a3b8", fontWeight: 700, textAlign: "center", cursor: "pointer" }} onClick={() => onOpenModal(dayEvs[0].id)}>+{dayEvs.length - 4} więcej</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function TimelineView({ events, onOpenModal }: { events: EventRecord[]; onOpenModal: (id: string) => void }) {
  const grouped = useMemo(() => {
    const d: Record<string, EventRecord[]> = {};
    const future = events.filter((e) => e.status !== "CANCELLED" && daysTo(e.date) >= -7);
    future.forEach((ev) => {
      const key = ev.date;
      if (!d[key]) d[key] = [];
      d[key].push(ev);
    });
    return Object.entries(d).sort((a, b) => a[0].localeCompare(b[0])).slice(0, 30);
  }, [events]);

  return (
    <div style={{ padding: "0 20px 48px" }}>
      <div style={{ fontSize: "17px", fontWeight: 900, color: "#0f172a", marginBottom: "16px" }}>Nadchodzące imprezy</div>
      <div style={{ position: "relative", paddingLeft: "60px" }}>
        <div style={{ position: "absolute", left: "28px", top: 0, bottom: 0, width: "2px", background: "#e2e8f0" }} />

        {grouped.map(([dateStr, dayEvs]) => {
          const d = new Date(dateStr);
          const day = d.getDate();
          const dow = DPLS[d.getDay()];
          const days = daysTo(dateStr);
          const db = dayBadge(days);
          const isToday = days === 0;

          return (
            <div key={dateStr} style={{ marginBottom: "20px", position: "relative" }}>
              <div style={{ position: "absolute", left: "-44px", top: "8px", width: "34px", height: "34px", borderRadius: "50%", background: isToday ? "#ef4444" : "white", border: isToday ? "none" : "2px solid #e2e8f0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 2 }}>
                <div style={{ fontSize: "13px", fontWeight: 900, color: isToday ? "white" : "#0f172a", lineHeight: 1 }}>{day}</div>
                <div style={{ fontSize: "7px", fontWeight: 700, color: isToday ? "rgba(255,255,255,0.8)" : "#94a3b8", lineHeight: 1 }}>{dow}</div>
              </div>

              <div style={{ marginBottom: "6px" }}>
                <span style={{ background: db.bg, color: db.tx, borderRadius: "5px", padding: "2px 8px", fontSize: "11px", fontWeight: 800 }}>{db.t}</span>
                <span style={{ fontSize: "11px", color: "#94a3b8", marginLeft: "8px", fontWeight: 600 }}>{fmtLong(dateStr)} · {plural(dayEvs.length)}</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                {dayEvs.map((ev) => {
                  const tc = getEventColor(ev);
                  const emoji = TYPE_EMOJI[ev.type] ?? "📋";
                  return (
                    <div key={ev.id} onClick={() => onOpenModal(ev.id)}
                      style={{ background: "white", border: "1px solid #e8edf2", borderLeft: `4px solid ${tc.bd}`, borderRadius: "9px", padding: "10px 14px", cursor: "pointer", transition: "box-shadow 0.12s" }}
                      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 3px 14px ${tc.bd}33`; }}
                      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "16px" }}>{emoji}</span>
                        <span style={{ fontWeight: 800, fontSize: "14px", color: "#0f172a" }}>{ev.client ?? "—"}</span>
                        <TypeBadge type={ev.type} pop={ev.pop} room={ev.room} small />
                        <StatusDot status={ev.status} />
                      </div>
                      <div style={{ display: "flex", gap: "14px", marginTop: "5px", fontSize: "12px", color: "#64748b", flexWrap: "wrap" }}>
                        <span>🏛 {ev.room ?? "—"}</span>
                        <span>👥 {ev.guests ?? "—"} os.</span>
                        {(ev.tf || ev.tt) && <span>⏰ {ev.tf ?? "?"}–{ev.tt ?? "?"}</span>}
                        {ev.deposit != null && (
                          <span style={{ color: ev.paid ? "#166534" : "#991b1b", fontWeight: 700 }}>{ev.paid ? "✅" : "❌"} {fmtZl(ev.deposit)}</span>
                        )}
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

function HeatmapView({ events, month, year, onOpenModal, onMonthChange }: { events: EventRecord[]; month: number; year: number; onOpenModal: (id: string) => void; onMonthChange: (fn: (p: number) => number) => void }) {
  const todayD = TODAY.getFullYear() === year && TODAY.getMonth() === month ? TODAY.getDate() : null;

  const monthEvs = events.filter((e) => {
    const d = new Date(e.date);
    return d.getFullYear() === year && d.getMonth() === month && e.status !== "CANCELLED";
  });

  const byDayRoom: Record<string, EventRecord[]> = {};
  monthEvs.forEach((ev) => {
    const d = new Date(ev.date).getDate();
    ROOMS.forEach((room) => {
      if (normalizeRoom(ev.room).includes(room)) {
        const key = `${d}-${room}`;
        if (!byDayRoom[key]) byDayRoom[key] = [];
        byDayRoom[key].push(ev);
      }
    });
  });

  const daysWithEvents = [...new Set(monthEvs.map((e) => new Date(e.date).getDate()))].sort((a, b) => a - b);

  return (
    <div style={{ padding: "0 20px 48px" }}>
      <MonthNav month={month} year={year} onPrev={() => onMonthChange((p) => p - 1)} onNext={() => onMonthChange((p) => p + 1)} onToday={() => onMonthChange(() => 0)} />

      <div style={{ overflowX: "auto", background: "white", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", position: "sticky" as const, top: 0, zIndex: 10, background: "white", borderBottom: "2px solid #e2e8f0" }}>
          <div style={{ width: "80px", minWidth: "80px", padding: "10px 8px", fontSize: "10px", fontWeight: 900, color: "#94a3b8" }}>DZIEŃ</div>
          {ROOMS.map((r) => (
            <div key={r} style={{ flex: 1, minWidth: "140px", padding: "10px 8px", textAlign: "center", fontSize: "10px", fontWeight: 800, color: "#374151", display: "flex", alignItems: "center", justifyContent: "center", gap: "5px" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "3px", background: RC[r], display: "inline-block" }} />
              {r}
            </div>
          ))}
        </div>

        {daysWithEvents.map((d) => {
          const dow = DPLS[new Date(year, month, d).getDay()];
          const isToday = d === todayD;
          const isWeekend = [0, 6].includes(new Date(year, month, d).getDay());
          return (
            <div key={d} style={{ display: "flex", borderBottom: "1px solid #f1f5f9", background: isToday ? "#fef2f2" : isWeekend ? "#fafafa" : "white" }}>
              <div style={{ width: "80px", minWidth: "80px", padding: "8px", display: "flex", alignItems: "center", gap: "6px", borderRight: "1px solid #e2e8f0" }}>
                <div style={{ width: "30px", height: "30px", borderRadius: "50%", background: isToday ? "#ef4444" : "transparent", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: "13px", fontWeight: 900, color: isToday ? "white" : "#0f172a", lineHeight: 1 }}>{d}</span>
                  <span style={{ fontSize: "7px", fontWeight: 700, color: isToday ? "rgba(255,255,255,0.8)" : "#94a3b8", lineHeight: 1 }}>{dow}</span>
                </div>
              </div>
              {ROOMS.map((room) => {
                const key = `${d}-${room}`;
                const roomEvs = byDayRoom[key] ?? [];
                return (
                  <div key={room} style={{ flex: 1, minWidth: "140px", padding: "4px", borderRight: "1px solid #f3f4f6", display: "flex", flexDirection: "column", gap: "3px" }}>
                    {roomEvs.map((ev) => {
                      const tc = getEventColor(ev);
                      const emoji = TYPE_EMOJI[ev.type] ?? "📋";
                      return (
                        <div key={ev.id} onClick={() => onOpenModal(ev.id)}
                          style={{ background: tc.bg, border: `1px solid ${tc.bd}`, borderRadius: "6px", padding: "5px 7px", cursor: "pointer" }}
                          onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 2px 8px ${tc.bd}44`; }}
                          onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}>
                          <div style={{ fontWeight: 800, color: tc.tx, fontSize: "11px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{emoji} {ev.client ?? "—"}</div>
                          <div style={{ fontSize: "9px", color: tc.tx + "99", marginTop: "2px" }}>👥{ev.guests ?? "—"} {ev.tf ? `· ${ev.tf}` : ""}</div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({ events, onOpenModal }: { events: EventRecord[]; onOpenModal: (id: string) => void }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const startDate = new Date(TODAY);
  startDate.setDate(startDate.getDate() - startDate.getDay() + 1 + weekOffset * 7);

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    return d;
  });

  return (
    <div style={{ padding: "0 20px 48px" }}>
      <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "14px" }}>
        <button onClick={() => setWeekOffset((o) => o - 1)} style={{ background: "white", border: "2px solid #e2e8f0", borderRadius: "9px", padding: "7px 14px", cursor: "pointer", fontSize: "16px", fontWeight: 700 }}>←</button>
        <div style={{ fontSize: "17px", fontWeight: 900, color: "#0f172a", minWidth: "250px", textAlign: "center" }}>
          {weekDays[0].getDate()}–{weekDays[6].getDate()} {MPL[weekDays[0].getMonth()]} {weekDays[0].getFullYear()}
        </div>
        <button onClick={() => setWeekOffset((o) => o + 1)} style={{ background: "white", border: "2px solid #e2e8f0", borderRadius: "9px", padding: "7px 14px", cursor: "pointer", fontSize: "16px", fontWeight: 700 }}>→</button>
        <button onClick={() => setWeekOffset(0)} style={{ background: "#f1f5f9", border: "2px solid #e2e8f0", borderRadius: "9px", padding: "7px 12px", cursor: "pointer", fontSize: "12px", fontWeight: 800, color: "#64748b" }}>Dzisiaj</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: "8px" }}>
        {weekDays.map((date) => {
          const dateStr = date.toISOString().split("T")[0];
          const day = date.getDate();
          const dow = DPLS[date.getDay()];
          const isToday = date.toDateString() === TODAY.toDateString();
          const dayEvs = events.filter((e) => e.date === dateStr && e.status !== "CANCELLED");

          return (
            <div key={dateStr} style={{ background: isToday ? "#fef2f2" : "white", border: `1px solid ${isToday ? "#fca5a5" : "#e2e8f0"}`, borderRadius: "12px", padding: "10px", minHeight: "220px", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px", paddingBottom: "8px", borderBottom: "1px solid #f1f5f9" }}>
                <div style={{ width: "34px", height: "34px", borderRadius: "50%", background: isToday ? "#ef4444" : "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: "14px", fontWeight: 900, color: isToday ? "white" : "#0f172a" }}>{day}</span>
                </div>
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#64748b" }}>{dow}</div>
                  {dayEvs.length > 0 && <div style={{ fontSize: "11px", fontWeight: 800, color: "#0f172a" }}>{plural(dayEvs.length)}</div>}
                </div>
              </div>

              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "5px", overflow: "auto" }}>
                {dayEvs.map((ev) => {
                  const tc = getEventColor(ev);
                  const emoji = TYPE_EMOJI[ev.type] ?? "📋";
                  return (
                    <div key={ev.id} onClick={() => onOpenModal(ev.id)}
                      style={{ background: tc.bg, border: `1px solid ${tc.bd}`, borderRadius: "8px", padding: "7px 9px", cursor: "pointer" }}
                      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 2px 8px ${tc.bd}44`; }}
                      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                        <span style={{ fontSize: "13px" }}>{emoji}</span>
                        <span style={{ fontWeight: 800, fontSize: "12px", color: tc.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{ev.client ?? "—"}</span>
                      </div>
                      <div style={{ display: "flex", gap: "8px", marginTop: "3px", fontSize: "10px", color: tc.tx + "99" }}>
                        <span>🏛 {ev.room?.replace("Sala ", "") ?? "—"}</span>
                        <span>👥{ev.guests ?? "—"}</span>
                        {ev.tf && <span>⏰{ev.tf}</span>}
                      </div>
                    </div>
                  );
                })}
                {dayEvs.length === 0 && (
                  <div style={{ textAlign: "center", padding: "24px", color: "#d1d5db", fontSize: "11px" }}>Brak imprez</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GanttView({ events, onOpenModal }: { events: EventRecord[]; onOpenModal: (id: string) => void }) {
  const [offset, setOffset] = useState(0);
  const [popup, setPopup] = useState<{ room: string; day: number; events: EventRecord[] } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const base = new Date(TODAY.getFullYear(), TODAY.getMonth() + offset, 1);
  const year = base.getFullYear();
  const month = base.getMonth();
  const dInM = new Date(year, month + 1, 0).getDate();
  const todayD = TODAY.getFullYear() === year && TODAY.getMonth() === month ? TODAY.getDate() : null;
  const dayArr = Array.from({ length: dInM }, (_, i) => i + 1);
  const LW = 150;
  const RH = 62;

  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [offset]);

  const CW = containerWidth > 0 ? Math.max(34, Math.floor((containerWidth - LW - 20) / dInM)) : 34;
  const monthEvs = events.filter((e) => { const d = new Date(e.date); return d.getFullYear() === year && d.getMonth() === month && e.status !== "CANCELLED"; }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return (
    <div ref={containerRef} style={{ padding: "0 20px 48px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px", flexWrap: "wrap" }}>
        <button onClick={() => setOffset((o) => o - 1)} style={{ background: "white", border: "2px solid #e2e8f0", borderRadius: "9px", padding: "7px 14px", cursor: "pointer", fontSize: "16px", fontWeight: 700 }}>←</button>
        <div style={{ fontSize: "19px", fontWeight: 900, color: "#0f172a", minWidth: "200px", textAlign: "center" }}>{MPL[month]} {year}</div>
        <button onClick={() => setOffset((o) => o + 1)} style={{ background: "white", border: "2px solid #e2e8f0", borderRadius: "9px", padding: "7px 14px", cursor: "pointer", fontSize: "16px", fontWeight: 700 }}>→</button>
        <button onClick={() => setOffset(0)} style={{ background: "#f1f5f9", border: "2px solid #e2e8f0", borderRadius: "9px", padding: "7px 12px", cursor: "pointer", fontSize: "12px", fontWeight: 800, color: "#64748b" }}>Dzisiaj</button>
        <div style={{ marginLeft: "auto", display: "flex", gap: "12px", flexWrap: "wrap" }}>
          {ROOMS.map((r) => (
            <div key={r} style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", fontWeight: 700 }}>
              <span style={{ width: "11px", height: "11px", borderRadius: "3px", background: RC[r], display: "inline-block" }} />
              {r}
            </div>
          ))}
        </div>
      </div>
      <div style={{ background: "white", borderRadius: "13px", border: "1px solid #e2e8f0", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", overflowX: "auto" }}>
        <div style={{ width: "100%" }}>
          <div style={{ display: "flex", borderBottom: "2px solid #e2e8f0", position: "sticky", top: 0, zIndex: 20, background: "white" }}>
            <div style={{ width: LW, minWidth: LW, padding: "9px 12px", fontSize: "10px", fontWeight: 900, color: "#94a3b8", letterSpacing: "1px", borderRight: "2px solid #e2e8f0", background: "white" }}>SALA</div>
            {dayArr.map((d) => (
              <div key={d} style={{ width: CW, minWidth: CW, textAlign: "center", padding: "6px 0 4px", fontSize: "10px", fontWeight: d === todayD ? 900 : 600, color: d === todayD ? "#ef4444" : isWknd(year, month, d) ? "#94a3b8" : "#374151", background: d === todayD ? "#fef2f2" : isWknd(year, month, d) ? "#f9fafb" : "white", borderRight: "1px solid #f1f5f9" }}>
                <div>{d}</div>
                <div style={{ fontSize: "8px", color: d === todayD ? "#ef4444" : "#d1d5db" }}>{DPLS[new Date(year, month, d).getDay()]}</div>
              </div>
            ))}
          </div>
          {ROOMS.map((room) => {
            const col = RC[room] ?? "#94a3b8";
            const rowEvs = monthEvs.filter((e) => {
              const norm = normalizeRoom(e.room);
              return norm.includes(room);
            });
            return (
              <div key={room} style={{ display: "flex", borderBottom: "1px solid #f1f5f9", minHeight: RH, position: "relative" }}>
                <div style={{ width: LW, minWidth: LW, padding: "0 12px", display: "flex", alignItems: "center", gap: "7px", borderRight: "2px solid #e2e8f0", background: "#fafafa", position: "sticky", left: 0, zIndex: 5 }}>
                  <span style={{ width: "9px", height: "9px", borderRadius: "3px", background: col, flexShrink: 0 }} />
                  <span style={{ fontSize: "11px", fontWeight: 800, color: "#374151" }}>{room}</span>
                </div>
                <div style={{ display: "flex", flex: 1, position: "relative" }}>
                  {dayArr.map((d) => <div key={d} style={{ width: CW, minWidth: CW, borderRight: "1px solid #f1f5f9", background: d === todayD ? "rgba(239,68,68,0.05)" : isWknd(year, month, d) ? "#f9fafb" : "transparent" }} />)}
                  {(() => {
                    const byDay: Record<number, EventRecord[]> = {};
                    rowEvs.forEach((ev) => {
                      const d = new Date(ev.date).getDate();
                      if (!byDay[d]) byDay[d] = [];
                      byDay[d].push(ev);
                    });

                    return Object.entries(byDay).flatMap(([dayStr, dayEvs]) => {
                      const d = parseInt(dayStr);
                      const count = dayEvs.length;

                      if (count === 1) {
                        const ev = dayEvs[0];
                        const tc = getEventColor(ev);
                        return [
                          <div
                            key={ev.id}
                            onClick={() => onOpenModal(ev.id)}
                            title={`${ev.client ?? ""} — ${fmtDate(ev.date)}`}
                            style={{
                              position: "absolute",
                              left: (d - 1) * CW + 2,
                              top: 4,
                              width: CW - 4,
                              height: "calc(100% - 8px)",
                              background: tc.bg,
                              borderRadius: "5px",
                              border: `1.5px solid ${tc.bd}`,
                              cursor: "pointer",
                              overflow: "hidden",
                              boxShadow: `0 2px 8px ${tc.bd}44`,
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "2px",
                              zIndex: 4,
                              transition: "transform 0.12s,box-shadow 0.12s",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = "scale(1.08)";
                              e.currentTarget.style.zIndex = "15";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = "scale(1)";
                              e.currentTarget.style.zIndex = "4";
                            }}
                          >
                            <div
                              style={{
                                fontSize: "8px",
                                fontWeight: 900,
                                color: tc.tx,
                                lineHeight: 1.1,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                textAlign: "center",
                              }}
                            >
                              {(ev.client ?? "").split(/\s+/)[0]}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "2px", justifyContent: "center", marginTop: "1px" }}>
                              <div style={{ width: "4px", height: "4px", borderRadius: "50%", background: tc.bd }} />
                              <div style={{ fontSize: "7px", fontWeight: 700, color: tc.bd, lineHeight: 1 }}>{ev.guests ? ev.guests + "os" : ""}</div>
                            </div>
                          </div>,
                        ];
                      }

                      if (count <= 3) {
                        return [
                          <div
                            key={`stack-${room}-${d}`}
                            style={{
                              position: "absolute",
                              left: (d - 1) * CW + 2,
                              top: 4,
                              width: CW - 4,
                              height: "calc(100% - 8px)",
                              display: "flex",
                              flexDirection: "column",
                              gap: "1px",
                              zIndex: 4,
                            }}
                          >
                            {dayEvs.map((ev, i) => {
                              const tc = getEventColor(ev);
                              return (
                                <div
                                  key={ev.id}
                                  onClick={() => onOpenModal(ev.id)}
                                  title={ev.client ?? ""}
                                  style={{
                                    flex: 1,
                                    background: tc.bg,
                                    borderRadius: i === 0 ? "5px 5px 2px 2px" : i === count - 1 ? "2px 2px 5px 5px" : "2px",
                                    border: `1.5px solid ${tc.bd}`,
                                    overflow: "hidden",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    position: "relative",
                                    transition: "transform 0.12s",
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = "scale(1.1)";
                                    e.currentTarget.style.zIndex = "15";
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = "scale(1)";
                                    e.currentTarget.style.zIndex = "4";
                                  }}
                                >
                                  <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "3px", background: tc.bd }} />
                                  <div
                                    style={{
                                      fontSize: "7px",
                                      fontWeight: 900,
                                      color: tc.tx,
                                      textAlign: "center",
                                      lineHeight: 1.1,
                                      padding: "0 3px",
                                      overflow: "hidden",
                                    }}
                                  >
                                    {(ev.client ?? "").split(/\s+/)[0]}
                                  </div>
                                </div>
                              );
                            })}
                          </div>,
                        ];
                      }

                      const typeCounts: Record<string, number> = {};
                      dayEvs.forEach((ev) => {
                        typeCounts[ev.type] = (typeCounts[ev.type] ?? 0) + 1;
                      });
                      const sorted = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
                      const parts = sorted.slice(0, 2).map(([type, cnt]) => `${cnt}${TYPE_SHORT[type] ?? "?"}`);
                      const label = parts.join("+");

                      return [
                        <div
                          key={`bubble-${room}-${d}`}
                          onClick={() => setPopup({ room, day: d, events: dayEvs })}
                          title={`${count} imprez — kliknij żeby zobaczyć listę`}
                          style={{
                            position: "absolute",
                            left: (d - 1) * CW + 2,
                            top: 4,
                            width: CW - 4,
                            height: "calc(100% - 8px)",
                            background: "white",
                            borderRadius: "5px",
                            border: "1.5px solid #e2e8f0",
                            cursor: "pointer",
                            overflow: "hidden",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            zIndex: 4,
                            transition: "transform 0.15s, box-shadow 0.15s",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = "scale(1.15)";
                            e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.15)";
                            e.currentTarget.style.zIndex = "20";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "scale(1)";
                            e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.08)";
                            e.currentTarget.style.zIndex = "4";
                          }}
                        >
                          <div
                            style={{
                              position: "absolute",
                              top: 0,
                              left: 0,
                              right: 0,
                              height: "4px",
                              display: "flex",
                              borderRadius: "3px 3px 0 0",
                              overflow: "hidden",
                            }}
                          >
                            {sorted.map(([type, cnt]) => (
                              <div key={type} style={{ flex: cnt, background: (TC[type] ?? TC.INNE).bd, height: "100%" }} />
                            ))}
                          </div>
                          <div style={{ fontSize: count > 9 ? "15px" : "18px", fontWeight: 900, color: "#1e293b", lineHeight: 1, marginTop: "2px" }}>{count}</div>
                          <div style={{ fontSize: "7px", fontWeight: 800, color: "#64748b", lineHeight: 1, marginTop: "1px" }}>{label}</div>
                        </div>,
                      ];
                    });
                  })()}
                </div>
              </div>
            );
          })}
          <div style={{ display: "flex", background: "#f8fafc", borderTop: "2px solid #e2e8f0" }}>
            <div style={{ width: LW, minWidth: LW, padding: "7px 12px", fontSize: "9px", fontWeight: 900, color: "#64748b", letterSpacing: "1px", borderRight: "2px solid #e2e8f0", position: "sticky", left: 0, zIndex: 5, background: "#f8fafc" }}>RAZEM</div>
            {dayArr.map((d) => {
              const cnt = monthEvs.filter((e) => new Date(e.date).getDate() === d).length;
              return (
                <div key={d} style={{ width: CW, minWidth: CW, display: "flex", alignItems: "center", justifyContent: "center", borderRight: "1px solid #f1f5f9", background: d === todayD ? "#fef2f2" : isWknd(year, month, d) ? "#f1f5f9" : "transparent" }}>
                  {cnt > 0 && (
                    <span
                      style={{
                        background: cnt > 10 ? "#ef4444" : cnt > 5 ? "#f59e0b" : "#1e293b",
                        color: "white",
                        borderRadius: "50%",
                        width: "19px",
                        height: "19px",
                        fontSize: "9px",
                        fontWeight: 900,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {cnt}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {popup && (
        <DayPopup
          room={popup.room}
          day={popup.day}
          monthLabel={MPL[month]}
          events={popup.events}
          onClose={() => setPopup(null)}
          onOpenModal={(id) => {
            setPopup(null);
            onOpenModal(id);
          }}
        />
      )}
      {monthEvs.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px", color: "#94a3b8" }}>
          <div style={{ fontSize: "36px", marginBottom: "8px" }}>📅</div>
          <div style={{ fontSize: "15px", fontWeight: 700 }}>Brak imprez w tym miesiącu</div>
        </div>
      ) : (
        <div style={{ marginTop: "18px" }}>
          <div style={{ fontSize: "10px", fontWeight: 900, color: "#64748b", letterSpacing: "2px", marginBottom: "10px" }}>IMPREZY W MIESIĄCU ({monthEvs.length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            {monthEvs.map((ev) => {
              const c = getEventColor(ev);
              const db = dayBadge(daysTo(ev.date));
              return (
                <div key={ev.id} onClick={() => onOpenModal(ev.id)} style={{ background: "white", border: "1px solid #e2e8f0", borderLeft: `4px solid ${c.bd}`, borderRadius: "9px", padding: "9px 13px", cursor: "pointer", transition: "box-shadow 0.15s" }} onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 4px 16px ${c.bd}33`; }} onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "9px", flexWrap: "wrap" }}>
                    <div style={{ minWidth: "86px", flexShrink: 0 }}>
                      <div style={{ fontSize: "13px", fontWeight: 800, color: "#0f172a" }}>{fmtDate(ev.date)}</div>
                      <span style={{ background: db.bg, color: db.tx, borderRadius: "4px", padding: "1px 5px", fontSize: "9px", fontWeight: 800 }}>{db.t}</span>
                    </div>
                    <TypeBadge type={ev.type} pop={ev.pop} room={ev.room} />
                    <div style={{ fontWeight: 700, color: "#0f172a", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: "100px" }}>{ev.client ?? "—"}</div>
                    <div style={{ fontSize: "11px", color: "#64748b", whiteSpace: "nowrap", flexShrink: 0 }}>🏛 {ev.room ?? "—"}</div>
                    <div style={{ fontSize: "11px", color: "#64748b", whiteSpace: "nowrap", flexShrink: 0 }}>👥 {ev.guests ?? "—"}</div>
                    <PhoneBtn phone={ev.phone} />
                  </div>
                  <div style={{ marginTop: "5px", paddingTop: "5px", borderTop: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: ev.deposit != null ? (ev.paid ? "#166534" : "#991b1b") : "#94a3b8" }}>{ev.deposit != null ? (ev.paid ? "✅ " + fmtZl(ev.deposit) : "❌ " + fmtZl(ev.deposit)) : "brak zadatku"}</span>
                    {ev.notes && <span style={{ fontSize: "11px", color: "#64748b" }}>· 📝 {ev.notes}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function CentrumSprzedazy() {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [fType, setFType] = useState("ALL");
  const [fStatus, setFStatus] = useState("ACTIVE");
  const [archive, setArchive] = useState(false);
  const [sort, setSort] = useState("date");
  const [tab, setTab] = useState<"lista" | "kalendarz" | "os" | "sale" | "tydzien" | "gantt" | "kosztorysy">("lista");
  const [ganttOffset, setGanttOffset] = useState(0);
  const ganttBase = new Date(TODAY.getFullYear(), TODAY.getMonth() + ganttOffset, 1);
  const ganttYear = ganttBase.getFullYear();
  const ganttMonth = ganttBase.getMonth();
  const [expId, setExpId] = useState<string | null>(null);
  const [modalId, setModalId] = useState<string | null>(null);
  const [depId, setDepId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const { toasts, show: showToast } = useToast();

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/event-orders?all=1");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || res.statusText || "Błąd pobierania");
      if (data.error) throw new Error(data.error);
      setEvents((Array.isArray(data) ? data : []).map(mapApiToEvent));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Błąd pobierania danych");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const patchEvent = useCallback(async (id: string, body: Record<string, unknown>) => {
    const res = await fetch(`/api/event-orders/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error ?? "Błąd zapisu");
  }, []);

  const handlers: Handlers = useMemo(
    () => ({
      toggleDeposit: async (id) => {
        const ev = events.find((e) => e.id === id);
        if (!ev) return;
        const prevPaid = ev.paid;
        setEvents((p) => p.map((e) => (e.id === id ? { ...e, paid: !prevPaid } : e)));
        try {
          await patchEvent(id, { depositPaid: !prevPaid });
          await fetchEvents();
        } catch {
          setEvents((p) => p.map((e) => (e.id === id ? { ...e, paid: prevPaid } : e)));
          throw new Error("Błąd zapisu");
        }
      },
      setDeposit: async (id, amt, paid) => {
        const ev = events.find((e) => e.id === id);
        const prevDep = ev ? { amount: ev.deposit, paid: ev.paid } : null;
        if (ev) setEvents((p) => p.map((e) => (e.id === id ? { ...e, deposit: amt, paid } : e)));
        try {
          await patchEvent(id, { depositAmount: amt, depositPaid: paid });
          await fetchEvents();
        } catch {
          if (prevDep) setEvents((p) => p.map((e) => (e.id === id ? { ...e, deposit: prevDep.amount, paid: prevDep.paid } : e)));
          throw new Error("Błąd zapisu");
        }
      },
      updateNote: async (id, text) => {
        const ev = events.find((e) => e.id === id);
        const prevNote = ev?.notes ?? "";
        setEvents((p) => p.map((e) => (e.id === id ? { ...e, notes: text } : e)));
        try {
          await patchEvent(id, { notes: text });
          await fetchEvents();
        } catch {
          setEvents((p) => p.map((e) => (e.id === id ? { ...e, notes: prevNote } : e)));
          throw new Error("Błąd zapisu");
        }
      },
      changeStatus: async (id, status) => {
        const ev = events.find((e) => e.id === id);
        const prevStatus = ev?.status ?? "DRAFT";
        setEvents((p) => p.map((e) => (e.id === id ? { ...e, status } : e)));
        try {
          await patchEvent(id, { status });
          await fetchEvents();
        } catch {
          setEvents((p) => p.map((e) => (e.id === id ? { ...e, status: prevStatus } : e)));
          throw new Error("Błąd zapisu");
        }
      },
      updateMenu: async (id, menuData) => {
        const ev = events.find((e) => e.id === id);
        const prevMenu = ev?.menu ?? null;
        setEvents((p) => p.map((e) => (e.id === id ? { ...e, menu: menuData } : e)));
        try {
          await patchEvent(id, { menu: menuData });
          await fetchEvents();
        } catch {
          setEvents((p) => p.map((e) => (e.id === id ? { ...e, menu: prevMenu } : e)));
          throw new Error("Błąd zapisu");
        }
      },
    }),
    [events, patchEvent, fetchEvents]
  );

  const openModal = useCallback((id: string) => setModalId(id), []);

  const handleDepToggle = async (id: string) => {
    const ev = events.find((e) => e.id === id);
    if (!ev) return;
    try {
      await handlers.toggleDeposit(id);
      showToast(ev.paid ? "Oznaczono jako NIEopłacony" : "Opłacony ✅");
    } catch {
      showToast("Błąd zapisu — zmiany cofnięte", "err");
    }
  };

  const handleDepSaveFromList = async (a: number, pd: boolean) => {
    if (!depId) return;
    try {
      await handlers.setDeposit(depId, a, pd);
      setDepId(null);
      showToast(`Zadatek ${fmtZl(a)} ${pd ? "opłacony" : "nieopłacony"}`);
    } catch {
      showToast("Błąd zapisu — zmiany cofnięte", "err");
    }
  };

  const filtered = useMemo(() => {
    let list = events.filter((e) => {
      const d = daysTo(e.date);
      if (!archive && d < -14) return false;
      if (fStatus === "ACTIVE" && e.status === "CANCELLED") return false;
      if (fStatus === "CONFIRMED" && e.status !== "CONFIRMED") return false;
      if (fStatus === "DRAFT" && e.status !== "DRAFT") return false;
      if (fStatus === "DONE" && e.status !== "DONE") return false;
      if (fStatus === "CANCELLED" && e.status !== "CANCELLED") return false;
      if (fType !== "ALL" && e.type !== fType) return false;
      if (search) {
        const s = search.toLowerCase().trim();
        const norm = (x: string) => x.replace(/[\s+-]/g, "").replace(/^(48|0048)/, "");
        return (e.client?.toLowerCase().includes(s) || (e.phone && norm(e.phone).includes(norm(s))) || fmtDate(e.date).includes(s) || e.room?.toLowerCase().includes(s) || e.notes?.toLowerCase().includes(s));
      }
      return true;
    });
    if (sort === "date") list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    if (sort === "client") list.sort((a, b) => (a.client ?? "").localeCompare(b.client ?? "", "pl"));
    if (sort === "type") list.sort((a, b) => (a.type !== b.type ? a.type.localeCompare(b.type) : new Date(a.date).getTime() - new Date(b.date).getTime()));
    return list;
  }, [events, search, fType, fStatus, archive, sort]);

  const stats = useMemo(() => {
    const f = events.filter((e) => daysTo(e.date) >= 0 && e.status !== "CANCELLED");
    return {
      thisWeek: f.filter((e) => daysTo(e.date) <= 7).length,
      unpaid: f.filter((e) => e.deposit != null && !e.paid).length,
      noDeposit: f.filter((e) =>
        e.deposit == null &&
        ["WESELE", "KOMUNIA", "CHRZCINY", "URODZINY"].includes(e.type) &&
        daysTo(e.date) <= 60
      ).length,
      drafts: f.filter((e) => e.status === "DRAFT").length,
      sumPaid: f.filter((e) => e.deposit && e.paid).reduce((a, e) => a + (e.deposit ?? 0), 0),
      sumUnpaid: f.filter((e) => e.deposit && !e.paid).reduce((a, e) => a + (e.deposit ?? 0), 0),
      cancelled: events.filter((e) => e.status === "CANCELLED" && daysTo(e.date) >= -30).length,
    };
  }, [events]);

  const weekEvs = useMemo(() => events.filter((e) => { const d = daysTo(e.date); return d >= 0 && d <= 7 && e.status !== "CANCELLED"; }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()), [events]);

  const typeCounts = useMemo(() => {
    const base = events.filter((e) => {
      const d = daysTo(e.date);
      if (!archive && d < -14) return false;
      if (fStatus === "ACTIVE" && e.status === "CANCELLED") return false;
      if (fStatus === "CONFIRMED" && e.status !== "CONFIRMED") return false;
      if (fStatus === "DRAFT" && e.status !== "DRAFT") return false;
      if (fStatus === "DONE" && e.status !== "DONE") return false;
      if (fStatus === "CANCELLED" && e.status !== "CANCELLED") return false;
      return true;
    });
    return Object.keys(TL).reduce<Record<string, number>>((a, t) => { a[t] = base.filter((e) => e.type === t).length; return a; }, {});
  }, [events, archive, fStatus]);

  const clearSearch = () => { setSearch(""); searchRef.current?.focus(); };
  const anyFilter = search || fType !== "ALL" || fStatus !== "ACTIVE" || archive;

  if (loading) {
    return (
      <div style={{ fontFamily: "'DM Sans','Segoe UI',system-ui,sans-serif", background: "#f0f4f8", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
          <div style={{ width: "40px", height: "40px", border: "4px solid #e2e8f0", borderTopColor: "#3b82f6", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <div style={{ fontSize: "14px", fontWeight: 600, color: "#64748b" }}>Ładowanie imprez…</div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ fontFamily: "'DM Sans','Segoe UI',system-ui,sans-serif", background: "#f0f4f8", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", padding: "32px" }}>
          <div style={{ fontSize: "18px", fontWeight: 700, color: "#991b1b", marginBottom: "12px" }}>Błąd pobierania</div>
          <div style={{ fontSize: "14px", color: "#64748b", marginBottom: "20px" }}>{error}</div>
          <button onClick={fetchEvents} style={{ background: "#3b82f6", color: "white", border: "none", borderRadius: "9px", padding: "12px 24px", cursor: "pointer", fontSize: "14px", fontWeight: 700 }}>Spróbuj ponownie</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'DM Sans','Segoe UI',system-ui,sans-serif", background: "#f0f4f8", minHeight: "100vh" }}>
      <style>{`@keyframes toastIn{from{opacity:0;transform:translate(-50%,10px)}to{opacity:1;transform:translate(-50%,0)}} *{box-sizing:border-box}`}</style>
      <div style={{ background: "linear-gradient(135deg,#1e293b,#0f172a)", padding: "12px 20px", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", boxShadow: "0 4px 20px rgba(0,0,0,0.3)", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ flexShrink: 0 }}>
          <div style={{ color: "#475569", fontSize: "9px", fontWeight: 900, letterSpacing: "2px", textTransform: "uppercase" }}>Hotel Łabędź</div>
          <div style={{ color: "#f8fafc", fontSize: "19px", fontWeight: 900, letterSpacing: "-0.5px" }}>Centrum Sprzedaży</div>
        </div>
        <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
          {stats.thisWeek > 0 && <Pill bg="#ef4444">⚡ {stats.thisWeek} ten tyg.</Pill>}
          {stats.unpaid > 0 && <Pill bg="#f97316">💰 {stats.unpaid} nieopł. ({fmtZl(stats.sumUnpaid)})</Pill>}
          {stats.noDeposit > 0 && <Pill bg="#64748b">📋 {stats.noDeposit} bez zadatku</Pill>}
          {stats.drafts > 0 && <Pill bg="#eab308">📝 {stats.drafts} szkice</Pill>}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: "3px", background: "#0f172a", borderRadius: "9px", padding: "3px", flexWrap: "wrap" }}>
          {[
            ["lista", "📋 Lista"],
            ["kalendarz", "📅 Kalendarz"],
            ["os", "📋 Oś czasu"],
            ["sale", "🗓️ Sale×Dni"],
            ["tydzien", "📆 Tydzień"],
            ["gantt", "📊 Gantt"],
            ["kosztorysy", "💰 Kosztorysy"],
          ].map(([t, l]) => (
            <button key={t} onClick={() => setTab(t as typeof tab)} style={{ padding: "6px 12px", borderRadius: "7px", border: "none", cursor: "pointer", fontSize: "11px", fontWeight: 800, background: tab === t ? "white" : "transparent", color: tab === t ? "#0f172a" : "#64748b" }}>{l}</button>
          ))}
        </div>
        <a href="/events/new" style={{ background: "#3b82f6", color: "white", borderRadius: "9px", padding: "8px 16px", fontWeight: 900, fontSize: "13px", boxShadow: "0 2px 12px rgba(59,130,246,0.4)", whiteSpace: "nowrap", flexShrink: 0, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>+ Nowa impreza</a>
      </div>
      <div style={{ display: "flex", gap: "10px", padding: "4px 20px", flexWrap: "wrap", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
        {Object.entries(TC).map(([type, tc]) => (
          <div key={type} style={{ display: "flex", alignItems: "center", gap: "3px" }}>
            <span style={{ fontSize: "11px" }}>{TYPE_EMOJI[type]}</span>
            <span style={{ width: "8px", height: "8px", borderRadius: "3px", background: tc.bd, display: "inline-block" }} />
            <span style={{ fontSize: "10px", fontWeight: 700, color: "#64748b" }}>{TL[type]}</span>
          </div>
        ))}
      </div>
      {weekEvs.length > 0 && (
        <div style={{ background: "linear-gradient(90deg,#fff1f2,#fff7ed)", borderBottom: "2px solid #fca5a5", padding: "7px 20px", display: "flex", gap: "7px", alignItems: "center", overflowX: "auto" }}>
          <span style={{ fontSize: "10px", fontWeight: 900, color: "#ef4444", letterSpacing: "1px", whiteSpace: "nowrap", flexShrink: 0 }}>⚡ TEN TYDZIEŃ</span>
          {weekEvs.map((e) => (
            <button key={e.id} onClick={() => { setTab("lista"); setFStatus("ACTIVE"); setFType("ALL"); setExpId(e.id); }} style={{ background: "white", border: "1.5px solid #fca5a5", borderRadius: "7px", padding: "3px 9px", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", whiteSpace: "nowrap", flexShrink: 0 }}>
              <TypeBadge type={e.type} pop={e.pop} room={e.room} small />
              <strong style={{ color: "#0f172a" }}>{e.client ?? "—"}</strong>
              <span style={{ color: "#ef4444", fontWeight: 800 }}>{fmtDate(e.date)}</span>
            </button>
          ))}
        </div>
      )}
      {tab === "lista" && (
        <>
          <div style={{ padding: "10px 20px 0", display: "flex", gap: "5px", flexWrap: "wrap", alignItems: "center" }}>
            <button onClick={() => setFType("ALL")} style={{ background: fType === "ALL" ? "#1e293b" : "white", border: `2px solid ${fType === "ALL" ? "#1e293b" : "#e2e8f0"}`, borderRadius: "8px", padding: "5px 12px", cursor: "pointer", fontSize: "12px", fontWeight: 800, color: fType === "ALL" ? "white" : "#64748b", display: "flex", alignItems: "center", gap: "5px" }}>
              Wszystkie <span style={{ background: fType === "ALL" ? "rgba(255,255,255,0.2)" : "#f1f5f9", color: fType === "ALL" ? "white" : "#64748b", borderRadius: "4px", padding: "0 5px", fontSize: "11px", fontWeight: 900 }}>{Object.values(typeCounts).reduce((a, v) => a + v, 0)}</span>
            </button>
            {Object.entries(TL).map(([type, label]) => {
              const cnt = typeCounts[type] ?? 0;
              if (!cnt && fType !== type) return null;
              const c = TC[type];
              const active = fType === type;
              return (
                <button key={type} onClick={() => setFType(active ? "ALL" : type)} style={{ background: active ? c.bd : "white", border: `2px solid ${active ? c.bd : c.bd + "66"}`, borderRadius: "8px", padding: "5px 12px", cursor: "pointer", fontSize: "12px", fontWeight: 800, color: active ? "white" : c.tx, display: "flex", alignItems: "center", gap: "5px" }}>
                  <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: active ? "white" : c.dot, flexShrink: 0 }} />
                  {label}
                  <span style={{ background: active ? "rgba(255,255,255,0.22)" : c.bg, color: active ? "white" : c.tx, borderRadius: "4px", padding: "0 5px", fontSize: "11px", fontWeight: 900 }}>{cnt}</span>
                </button>
              );
            })}
          </div>
          <div style={{ padding: "8px 20px", display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 240px", position: "relative" }}>
              <span style={{ position: "absolute", left: "11px", top: "50%", transform: "translateY(-50%)", fontSize: "13px", opacity: 0.4 }}>🔍</span>
              <input ref={searchRef} value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape" && !modalId) clearSearch(); }} placeholder="Szukaj nazwisko, tel, data, sala, notatka..." style={{ width: "100%", padding: "9px 34px", border: "2px solid #e2e8f0", borderRadius: "9px", fontSize: "13px", background: "white", outline: "none" }} />
              {search && <button onClick={clearSearch} type="button" style={{ position: "absolute", right: "9px", top: "50%", transform: "translateY(-50%)", background: "#94a3b8", color: "white", border: "none", borderRadius: "50%", width: "18px", height: "18px", cursor: "pointer", fontSize: "12px", fontWeight: 900 }}>×</button>}
            </div>
            <div style={{ display: "flex", border: "2px solid #e2e8f0", borderRadius: "9px", overflow: "hidden", flexShrink: 0 }}>
              {[["ACTIVE", "Aktywne"], ["CONFIRMED", "Potwierdzone"], ["DRAFT", "Szkice"], ["DONE", "Zakończone"], ["CANCELLED", "Anulowane"], ["ALL", "Wszystkie"]].map(([s, l]) => (
                <button key={s} onClick={() => setFStatus(s)} type="button" style={{ padding: "8px 10px", border: "none", cursor: "pointer", fontSize: "11px", fontWeight: 700, background: fStatus === s ? "#1e293b" : "white", color: fStatus === s ? "white" : "#64748b", whiteSpace: "nowrap" }}>{l}{s === "CANCELLED" && stats.cancelled > 0 ? ` (${stats.cancelled})` : ""}</button>
              ))}
            </div>
            <select value={sort} onChange={(e) => setSort(e.target.value)} style={{ padding: "9px 10px", border: "2px solid #e2e8f0", borderRadius: "9px", fontSize: "12px", background: "white", cursor: "pointer", color: "#374151", fontWeight: 600, flexShrink: 0 }}>
              <option value="date">Data ↑</option>
              <option value="client">Klient A–Z</option>
              <option value="type">Typ + Data</option>
            </select>
            <button onClick={() => setArchive(!archive)} type="button" style={{ padding: "9px 12px", border: `2px solid ${archive ? "#1e293b" : "#e2e8f0"}`, borderRadius: "9px", background: archive ? "#1e293b" : "white", cursor: "pointer", fontSize: "11px", fontWeight: 800, color: archive ? "white" : "#64748b", whiteSpace: "nowrap", flexShrink: 0 }}>{archive ? "✓ " : ""}Archiwum</button>
            <div style={{ padding: "9px 12px", border: "2px solid #e2e8f0", borderRadius: "9px", background: "white", fontSize: "12px", fontWeight: 900, flexShrink: 0, color: filtered.length === 0 ? "#ef4444" : "#0f172a", whiteSpace: "nowrap" }}>{plural(filtered.length)}</div>
            {stats.sumPaid > 0 && <div style={{ padding: "9px 12px", border: "2px solid #86efac", borderRadius: "9px", background: "#f0fdf4", fontSize: "11px", fontWeight: 800, color: "#166534", whiteSpace: "nowrap", flexShrink: 0 }}>✅ {fmtZl(stats.sumPaid)}</div>}
            {anyFilter && <button onClick={() => { setSearch(""); setFType("ALL"); setFStatus("ACTIVE"); setArchive(false); }} type="button" style={{ padding: "9px 12px", border: "2px solid #fca5a5", borderRadius: "9px", background: "#fef2f2", cursor: "pointer", fontSize: "11px", fontWeight: 800, color: "#991b1b", whiteSpace: "nowrap", flexShrink: 0 }}>✕ Wyczyść</button>}
          </div>
          {filtered.length === 0 && search && fType !== "ALL" && (
            <div style={{ margin: "0 20px 6px", background: "#fef3c7", border: "1px solid #fde68a", borderRadius: "9px", padding: "9px 14px", fontSize: "13px", color: "#92400e", fontWeight: 600 }}>
              ⚠️ Filtrujesz po <strong>{TL[fType]}</strong> i szukasz <strong>"{search}"</strong>. <button onClick={() => setFType("ALL")} type="button" style={{ background: "none", border: "none", cursor: "pointer", color: "#1d4ed8", fontWeight: 800, textDecoration: "underline", padding: 0 }}>Usuń filtr typu</button>
            </div>
          )}
          <div style={{ padding: "4px 20px 48px", display: "flex", flexDirection: "column", gap: "5px" }}>
            {filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: "70px 20px" }}>
                <div style={{ fontSize: "44px", marginBottom: "10px" }}>🔍</div>
                <div style={{ fontSize: "17px", fontWeight: 800, color: "#475569" }}>Brak wyników</div>
                <div style={{ fontSize: "13px", color: "#94a3b8", marginTop: "6px" }}>{search ? <>Nic nie pasuje do <strong>"{search}"</strong></> : "Spróbuj zmienić filtry"}</div>
                {anyFilter && <button onClick={() => { setSearch(""); setFType("ALL"); setFStatus("ACTIVE"); setArchive(false); }} type="button" style={{ marginTop: "14px", background: "#3b82f6", color: "white", border: "none", borderRadius: "9px", padding: "10px 22px", cursor: "pointer", fontSize: "13px", fontWeight: 800 }}>Wyczyść wszystkie filtry</button>}
              </div>
            ) : (
              filtered.map((ev) => (
                <EventCard key={ev.id} ev={ev} expanded={expId === ev.id} onToggle={() => setExpId(expId === ev.id ? null : ev.id)} onOpenModal={openModal} onDepositToggle={handleDepToggle} onDepositOpen={(id) => setDepId(id)} />
              ))
            )}
          </div>
        </>
      )}
      {tab === "kalendarz" && <CalendarMonthView events={filtered} month={ganttMonth} year={ganttYear} onOpenModal={openModal} onMonthChange={setGanttOffset} />}
      {tab === "os" && <TimelineView events={filtered} onOpenModal={openModal} />}
      {tab === "sale" && <HeatmapView events={filtered} month={ganttMonth} year={ganttYear} onOpenModal={openModal} onMonthChange={setGanttOffset} />}
      {tab === "tydzien" && <WeekView events={filtered} onOpenModal={openModal} />}
      {tab === "gantt" && <GanttView events={events} onOpenModal={openModal} />}
      {tab === "kosztorysy" && <KosztorysyView />}
      {modalId && <EventDetailModal evId={modalId} events={events} onClose={() => setModalId(null)} handlers={handlers} showToast={showToast} onOpenModal={openModal} />}
      {depId && !modalId && <DepositModal existingAmt={events.find((e) => e.id === depId)?.deposit ?? null} onSave={handleDepSaveFromList} onClose={() => setDepId(null)} />}
      <Toasts toasts={toasts} />
    </div>
  );
}
