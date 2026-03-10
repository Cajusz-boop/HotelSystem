"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { MenuTab } from "@/components/events/menu-modul";
import { EventFormTabs, EMPTY_EVENT_FORM, type EventFormTabState } from "@/components/events/event-form-tabs";
import { MenuPackagesView } from "@/components/centrum-sprzedazy/menu-packages-view";

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
  email: string | null;
  room: string | null;
  guests: number | null;
  deposit: number | null;
  paid: boolean;
  depositDueDate: string | null;
  status: string;
  notes: string;
  pop: boolean;
  parentEventId: string | null;
  menu?: Record<string, unknown> | null;
  eventNumber: string | null;
  quoteId: string | null;
  checklistDocId: string | null;
  menuDocId: string | null;
  googleCalendarEventId: string | null;
  googleCalendarCalId: string | null;
  googleCalendarSynced: boolean;
  googleCalendarSyncedAt: Date | string | null;
  googleCalendarError: string | null;
  adultsCount?: number | null;
  children03?: number | null;
  children47?: number | null;
  orchestraCount?: number | null;
  cameramanCount?: number | null;
  photographerCount?: number | null;
  churchTime?: string | null;
  brideGroomTable?: string | null;
  orchestraTable?: string | null;
  packageId?: string | null;
  cakesAndDesserts?: string | null;
  cakeOrderedAt?: string | null;
  cakeArrivalTime?: string | null;
  cakeServedAt?: string | null;
  drinksArrival?: string | null;
  drinksStorage?: string | null;
  champagneStorage?: string | null;
  firstBottlesBy?: string | null;
  alcoholAtTeamTable?: boolean | null;
  cakesSwedishTable?: boolean | null;
  fruitsSwedishTable?: boolean | null;
  ownFlowers?: boolean | null;
  ownVases?: boolean | null;
  decorationColor?: string | null;
  placeCards?: boolean | null;
  placeCardsLayout?: string | null;
  tableLayout?: string | null;
  breadWelcomeBy?: string | null;
  extraAttractions?: string | null;
  specialRequests?: string | null;
  facebookConsent?: boolean | null;
  ownNapkins?: boolean | null;
  dutyPerson?: string | null;
  afterpartyEnabled?: boolean | null;
  afterpartyTimeFrom?: string | null;
  afterpartyTimeTo?: string | null;
  afterpartyGuests?: number | null;
  afterpartyMenu?: string | null;
  afterpartyMusic?: string | null;
  assignedTo?: string | null;
  checklist?: Record<string, boolean> | null;
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
    email: (record.clientEmail as string) ?? null,
    room: (record.roomName as string) ?? null,
    guests: record.guestCount != null ? Number(record.guestCount) : null,
    deposit: depNum,
    paid: Boolean(record.depositPaid),
    depositDueDate: (record.depositDueDate as string) ?? null,
    status: (record.status as string) ?? "DRAFT",
    notes: (record.notes as string) ?? "",
    pop: Boolean(record.isPoprawiny),
    parentEventId: (record.parentEventId as string) ?? null,
    menu: (record.menu as Record<string, unknown> | null) ?? null,
    eventNumber: (record.eventNumber as string) ?? null,
    quoteId: (record.quoteId as string) ?? null,
    checklistDocId: (record.checklistDocId as string) ?? null,
    menuDocId: (record.menuDocId as string) ?? null,
    googleCalendarEventId: (record.googleCalendarEventId as string) ?? null,
    googleCalendarCalId: (record.googleCalendarCalId as string) ?? null,
    googleCalendarSynced: Boolean(record.googleCalendarSynced),
    googleCalendarSyncedAt: (record.googleCalendarSyncedAt as Date | string | null) ?? null,
    googleCalendarError: (record.googleCalendarError as string) ?? null,
    adultsCount: record.adultsCount != null ? Number(record.adultsCount) : null,
    children03: record.children03 != null ? Number(record.children03) : null,
    children47: record.children47 != null ? Number(record.children47) : null,
    orchestraCount: record.orchestraCount != null ? Number(record.orchestraCount) : null,
    cameramanCount: record.cameramanCount != null ? Number(record.cameramanCount) : null,
    photographerCount: record.photographerCount != null ? Number(record.photographerCount) : null,
    churchTime: (record.churchTime as string) ?? null,
    brideGroomTable: (record.brideGroomTable as string) ?? null,
    orchestraTable: (record.orchestraTable as string) ?? null,
    packageId: (record.packageId as string) ?? null,
    cakesAndDesserts: (record.cakesAndDesserts as string) ?? null,
    cakeOrderedAt: (record.cakeOrderedAt as string) ?? null,
    cakeArrivalTime: (record.cakeArrivalTime as string) ?? null,
    cakeServedAt: (record.cakeServedAt as string) ?? null,
    drinksArrival: (record.drinksArrival as string) ?? null,
    drinksStorage: (record.drinksStorage as string) ?? null,
    champagneStorage: (record.champagneStorage as string) ?? null,
    firstBottlesBy: (record.firstBottlesBy as string) ?? null,
    alcoholAtTeamTable: record.alcoholAtTeamTable != null ? Boolean(record.alcoholAtTeamTable) : null,
    cakesSwedishTable: record.cakesSwedishTable != null ? Boolean(record.cakesSwedishTable) : null,
    fruitsSwedishTable: record.fruitsSwedishTable != null ? Boolean(record.fruitsSwedishTable) : null,
    ownFlowers: record.ownFlowers != null ? Boolean(record.ownFlowers) : null,
    ownVases: record.ownVases != null ? Boolean(record.ownVases) : null,
    decorationColor: (record.decorationColor as string) ?? null,
    placeCards: record.placeCards != null ? Boolean(record.placeCards) : null,
    placeCardsLayout: (record.placeCardsLayout as string) ?? null,
    tableLayout: (record.tableLayout as string) ?? null,
    breadWelcomeBy: (record.breadWelcomeBy as string) ?? null,
    extraAttractions: (record.extraAttractions as string) ?? null,
    specialRequests: (record.specialRequests as string) ?? null,
    facebookConsent: record.facebookConsent != null ? Boolean(record.facebookConsent) : null,
    ownNapkins: record.ownNapkins != null ? Boolean(record.ownNapkins) : null,
    dutyPerson: (record.dutyPerson as string) ?? null,
    afterpartyEnabled: record.afterpartyEnabled != null ? Boolean(record.afterpartyEnabled) : null,
    afterpartyTimeFrom: (record.afterpartyTimeFrom as string) ?? null,
    afterpartyTimeTo: (record.afterpartyTimeTo as string) ?? null,
    afterpartyGuests: record.afterpartyGuests != null ? Number(record.afterpartyGuests) : null,
    afterpartyMenu: (record.afterpartyMenu as string) ?? null,
    afterpartyMusic: (record.afterpartyMusic as string) ?? null,
    assignedTo: (record.assignedTo as string) ?? null,
    checklist: (record.checklist as Record<string, boolean>) ?? null,
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
function getRoomColor(roomStr: string | null | undefined): string {
  if (!roomStr) return "#94a3b8";
  const first = roomStr.split(",")[0]?.trim();
  return first && RC[first] ? RC[first] : "#94a3b8";
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
const CHECKLIST_ITEMS = [
  { id: "menu", label: "Menu uzupełnione", auto: (ev: EventRecord) => ev.menu != null },
  { id: "deposit", label: "Zadatek opłacony", auto: (ev: EventRecord) => ev.paid },
  { id: "guests", label: "Liczba gości potwierdzona", auto: (ev: EventRecord) => (ev.guests ?? 0) > 0 },
  { id: "room", label: "Sala potwierdzona", auto: (ev: EventRecord) => !!(ev.room && ev.room !== "Do ustalenia") },
  { id: "phone", label: "Telefon kontaktowy", auto: (ev: EventRecord) => !!ev.phone },
  { id: "email", label: "Email klienta", auto: (ev: EventRecord) => !!ev.email },
  { id: "hours", label: "Godziny ustalone", auto: (ev: EventRecord) => !!ev.tf },
  { id: "cake", label: "Tort zamówiony", auto: null },
  { id: "flowers", label: "Kwiaty zamówione", auto: null },
  { id: "dj", label: "DJ/orkiestra potwierdzone", auto: null },
  { id: "seating", label: "Układ stołów gotowy", auto: null },
  { id: "final", label: "Potwierdzenie końcowe z klientem", auto: null },
] as const;

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
  if (days < 0) return { t: `${Math.abs(days)}d temu`, bg: "#e2e8f0", tx: "#374151", hot: false };
  if (days === 0) return { t: "DZIŚ!", bg: "#ef4444", tx: "#fff", hot: true };
  if (days === 1) return { t: "JUTRO", bg: "#f97316", tx: "#fff", hot: true };
  if (days <= 7) return { t: `za ${days}d`, bg: "#fef3c7", tx: "#92400e", hot: true };
  if (days <= 30) return { t: `za ${days}d`, bg: "#dbeafe", tx: "#1e40af", hot: false };
  return { t: `za ${days}d`, bg: "#f1f5f9", tx: "#374151", hot: false };
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
            background: "#1e1e1e",
            color: "white",
            borderRadius: "4px",
            padding: "8px 18px",
            fontSize: "12px",
            fontWeight: 500,
            boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
            whiteSpace: "nowrap",
            animation: "toastIn 0.22s ease",
          }}
        >
          {t.msg}
        </div>
      ))}
    </div>
  );
}

function TypeBadge({ type, pop, room, small }: { type: string; pop: boolean; room?: string | null; small?: boolean }) {
  const c = getEventColor({ type, room });
  return (
    <span style={{ background: c.bg, color: c.tx, border: `1px solid ${c.bd}`, borderRadius: "3px", padding: small ? "1px 5px" : "2px 8px", fontSize: small ? "10px" : "11px", fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0 }}>
      {pop ? "Poprawiny" : TL[type] ?? type}
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

function PhoneBtn({ phone, client, date, compact }: { phone: string | null; client?: string | null; date?: string | null; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  if (!phone) return <span style={{ fontSize: "11px", color: "#111827" }}>—</span>;
  const copy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard?.writeText(phone.replace(/\s/g, "")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  };
  const tel = phone.replace(/\s/g, "");
  const waNum = phone.replace(/[\s\+\-]/g, "").replace(/^0/, "48");
  const waText = encodeURIComponent(`Dzień dobry, ${client || ""}. W sprawie rezerwacji na ${date ? fmtDate(date) : ""} w Hotelu Łabędź.`);
  const smsBody = encodeURIComponent(`Hotel Łabędź - dot. imprezy ${date ? fmtDate(date) : ""}`);

  if (compact) {
    return (
      <div onClick={(e) => e.stopPropagation()} style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
        <a href={`tel:${tel}`} style={{ fontSize: "15px", color: "#1976d2", textDecoration: "none", fontWeight: 500 }}>{phone}</a>
        <a href={`https://wa.me/${waNum}?text=${waText}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: "11px", color: "#25d366", fontWeight: 600, textDecoration: "none", border: "1px solid #25d366", borderRadius: "3px", padding: "1px 6px" }}>WhatsApp</a>
        <a href={`sms:${tel}?body=${smsBody}`} style={{ fontSize: "11px", color: "#111827", textDecoration: "none", border: "1px solid #ddd", borderRadius: "3px", padding: "1px 6px" }}>SMS</a>
        <button onClick={copy} title="Kopiuj numer" style={{ background: "none", border: "none", cursor: "pointer", fontSize: "11px", color: copied ? "#2e7d32" : "#374151" }}>{copied ? "✓" : "⎘"}</button>
      </div>
    );
  }
  return (
    <div onClick={(e) => e.stopPropagation()} style={{ display: "inline-flex", alignItems: "center" }}>
      <a href={`tel:${tel}`} style={{ fontSize: "12px", color: "#1976d2", textDecoration: "none", fontWeight: 500 }}>{phone}</a>
      <button onClick={copy} title="Kopiuj numer" style={{ marginLeft: "4px", background: "none", border: "none", cursor: "pointer", fontSize: "11px", color: copied ? "#2e7d32" : "#374151" }}>{copied ? "✓" : "⎘"}</button>
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
      <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle(ev.id);
          }}
          title={ev.paid ? "Kliknij: oznacz jako NIEopłacony" : "Kliknij: oznacz jako OPŁACONY"}
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: "15px", fontWeight: 600, color: ev.paid ? "#2e7d32" : "#c62828", whiteSpace: "nowrap" }}
        >
          {ev.paid ? "✓" : "—"} {fmtZl(ev.deposit)}
        </button>
        {ev.deposit && !ev.paid && ev.depositDueDate && new Date(ev.depositDueDate) < new Date() && (
          <span style={{ fontSize: "10px", color: "#c62828", fontWeight: 700 }}>przeterminowany!</span>
        )}
      </span>
    );
  }
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onOpen(ev.id);
      }}
      style={{ background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: "15px", color: "#111827" }}
    >
      + zadatek
    </button>
  );
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
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", zIndex: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div ref={ref} style={{ background: "white", borderRadius: "8px", width: "340px", boxShadow: "0 4px 24px rgba(0,0,0,0.12)" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid #e5e5e5" }}>
          <div style={{ fontSize: "14px", fontWeight: 700, color: "#1e1e1e" }}>{existingAmt != null ? "Zmień zadatek" : "Dodaj zadatek"}</div>
        </div>
        <div style={{ padding: "16px 18px" }}>
          <label style={{ fontSize: "11px", fontWeight: 600, color: "#111827", display: "block", marginBottom: "4px" }}>Kwota (zł)</label>
          <input ref={inp} type="text" inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value)} onKeyDown={(e) => e.key === "Enter" && save()} placeholder="np. 1500,50" style={{ width: "100%", padding: "8px 12px", boxSizing: "border-box", border: "1px solid #ddd", borderRadius: "4px", fontSize: "14px", outline: "none" }} />
          <div style={{ fontSize: "10px", color: "#111827", marginTop: "4px" }}>Wpisz kwotę z przecinkiem lub kropką</div>
        </div>
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px", padding: "0 18px" }}>
          {[true, false].map((p) => (
            <button key={String(p)} onClick={() => setPaid(p)} style={{ flex: 1, padding: "8px", border: `1px solid ${p === paid ? (p ? "#a5d6a7" : "#ffcc80") : "#e5e5e5"}`, background: p === paid ? (p ? "#e8f5e9" : "#fff3e0") : "white", borderRadius: "3px", cursor: "pointer", fontSize: "11px", fontWeight: 600, color: p === paid ? (p ? "#2e7d32" : "#e65100") : "#374151" }}>
              {p ? "Opłacony" : "Nieopłacony"}
            </button>
          ))}
        </div>
        <div style={{ padding: "12px 18px", borderTop: "1px solid #e5e5e5", display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ background: "white", border: "1px solid #ddd", borderRadius: "4px", padding: "6px 14px", fontSize: "12px", fontWeight: 600, color: "#111827", cursor: "pointer" }}>Anuluj</button>
          <button onClick={save} style={{ background: "#1e1e1e", color: "white", border: "none", borderRadius: "4px", padding: "6px 16px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>Zapisz</button>
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
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", zIndex: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div ref={ref} style={{ background: "white", borderRadius: "8px", width: "360px", boxShadow: "0 4px 24px rgba(0,0,0,0.12)" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e5e5" }}>
          <div style={{ fontSize: "16px", fontWeight: 700, color: "#1e1e1e" }}>Anulować imprezę?</div>
        </div>
        <div style={{ padding: "16px 20px", fontSize: "13px", color: "#111827", lineHeight: 1.6 }}>
          <strong style={{ color: "#1e1e1e" }}>{clientName ?? "—"}</strong> — status zostanie zmieniony na ANULOWANE. Możesz przywrócić imprezę później.
        </div>
        <div style={{ padding: "12px 20px", borderTop: "1px solid #e5e5e5", display: "flex", gap: "8px", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ background: "white", border: "1px solid #ddd", borderRadius: "4px", padding: "6px 14px", fontSize: "12px", fontWeight: 600, color: "#111827", cursor: "pointer" }}>Wróć</button>
          <button onClick={onConfirm} style={{ background: "#c62828", color: "white", border: "none", borderRadius: "4px", padding: "6px 14px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>Tak, anuluj</button>
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

function CreateEventField({ label, value, onChange, placeholder, type = "text", compact = false }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  compact?: boolean;
}) {
  return (
    <div style={{ marginBottom: compact ? "0" : "16px" }}>
      <label style={{ fontSize: "11px", fontWeight: 700, color: "#111827", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>{label}</label>
      <input type={type} value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: "100%", padding: "8px 12px", border: "1px solid #ddd", borderRadius: "4px", fontSize: "13px", outline: "none", fontFamily: "inherit" }}
        onFocus={(e) => { e.currentTarget.style.borderColor = "#999"; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = "#ddd"; }} />
    </div>
  );
}

function evToFullForm(e: EventRecord): EventFormTabState {
  return {
    ...EMPTY_EVENT_FORM,
    eventType: e.type || "WESELE",
    clientName: e.client ?? "",
    clientPhone: e.phone ?? "",
    clientEmail: e.email ?? "",
    eventDate: e.date ?? "",
    roomName: e.room ?? "",
    addPoprawiny: false,
    poprawinyDate: "",
    poprawinyGuestCount: "",
    depositAmount: e.deposit != null ? String(e.deposit) : "",
    depositPaid: e.paid ?? false,
    depositDueDate: e.depositDueDate ?? "",
    timeStart: e.tf ?? "",
    timeEnd: e.tt ?? "",
    churchTime: e.churchTime ?? "",
    adultsCount: e.adultsCount ?? "",
    children03: e.children03 ?? "",
    children47: e.children47 ?? "",
    orchestraCount: e.orchestraCount ?? "",
    cameramanCount: e.cameramanCount ?? "",
    photographerCount: e.photographerCount ?? "",
    cakesAndDesserts: e.cakesAndDesserts ?? "",
    cakeOrderedAt: e.cakeOrderedAt ?? "",
    cakeArrivalTime: e.cakeArrivalTime ?? "",
    cakeServedAt: e.cakeServedAt ?? "",
    drinksArrival: e.drinksArrival ?? "",
    drinksStorage: e.drinksStorage ?? "",
    champagneStorage: e.champagneStorage ?? "",
    firstBottlesBy: e.firstBottlesBy ?? "",
    alcoholAtTeamTable: e.alcoholAtTeamTable ?? false,
    cakesSwedishTable: e.cakesSwedishTable ?? false,
    fruitsSwedishTable: e.fruitsSwedishTable ?? false,
    ownFlowers: e.ownFlowers ?? false,
    ownVases: e.ownVases ?? false,
    placeCards: e.placeCards ?? false,
    placeCardsLayout: e.placeCardsLayout ?? "",
    decorationColor: e.decorationColor ?? "",
    tableLayout: e.tableLayout ?? "",
    brideGroomTable: e.brideGroomTable ?? "",
    orchestraTable: e.orchestraTable ?? "",
    breadWelcomeBy: e.breadWelcomeBy ?? "",
    extraAttractions: e.extraAttractions ?? "",
    specialRequests: e.specialRequests ?? "",
    facebookConsent: e.facebookConsent ?? false,
    ownNapkins: e.ownNapkins ?? false,
    dutyPerson: e.dutyPerson ?? "",
    assignedTo: e.assignedTo ?? "",
    afterpartyEnabled: e.afterpartyEnabled ?? false,
    afterpartyTimeFrom: e.afterpartyTimeFrom ?? "",
    afterpartyTimeTo: e.afterpartyTimeTo ?? "",
    afterpartyGuests: e.afterpartyGuests ?? "",
    afterpartyMenu: e.afterpartyMenu ?? "",
    afterpartyMusic: e.afterpartyMusic ?? "",
    notes: e.notes ?? "",
  };
}

function toCreatePayload(form: EventFormTabState, menuData: Record<string, unknown> | null): Record<string, unknown> {
  const dateVal = form.eventDate || new Date().toISOString().split("T")[0];
  const guestCount = (Number(form.adultsCount) || 0) + (Number(form.children03) || 0) + (Number(form.children47) || 0) || null;
  return {
    eventType: form.eventType,
    clientName: form.clientName || "Nowa impreza",
    clientPhone: form.clientPhone || null,
    clientEmail: form.clientEmail || null,
    dateFrom: dateVal,
    eventDate: dateVal,
    dateTo: dateVal,
    roomName: form.roomName || "Do ustalenia",
    guestCount,
    adultsCount: form.adultsCount === "" ? null : Number(form.adultsCount),
    children03: form.children03 === "" ? null : Number(form.children03),
    children47: form.children47 === "" ? null : Number(form.children47),
    timeStart: form.timeStart || null,
    timeEnd: form.timeEnd || null,
    churchTime: form.churchTime || null,
    orchestraCount: form.orchestraCount === "" ? null : Number(form.orchestraCount),
    cameramanCount: form.cameramanCount === "" ? null : Number(form.cameramanCount),
    photographerCount: form.photographerCount === "" ? null : Number(form.photographerCount),
    packageId: (menuData as { pakietId?: string } | null)?.pakietId ?? null,
    cakesAndDesserts: form.cakesAndDesserts || null,
    cakeOrderedAt: form.cakeOrderedAt || null,
    cakeArrivalTime: form.cakeArrivalTime || null,
    cakeServedAt: form.cakeServedAt || null,
    drinksArrival: form.drinksArrival || null,
    drinksStorage: form.drinksStorage || null,
    champagneStorage: form.champagneStorage || null,
    firstBottlesBy: form.firstBottlesBy || null,
    alcoholAtTeamTable: form.alcoholAtTeamTable,
    cakesSwedishTable: form.cakesSwedishTable,
    fruitsSwedishTable: form.fruitsSwedishTable,
    ownFlowers: form.ownFlowers,
    ownVases: form.ownVases,
    placeCards: form.placeCards,
    placeCardsLayout: form.placeCardsLayout || null,
    decorationColor: form.decorationColor || null,
    tableLayout: form.tableLayout || null,
    brideGroomTable: form.brideGroomTable || null,
    orchestraTable: form.orchestraTable || null,
    breadWelcomeBy: form.breadWelcomeBy || null,
    extraAttractions: form.extraAttractions || null,
    specialRequests: form.specialRequests || null,
    facebookConsent: form.facebookConsent,
    ownNapkins: form.ownNapkins,
    dutyPerson: form.dutyPerson || null,
    assignedTo: form.assignedTo || null,
    afterpartyEnabled: form.afterpartyEnabled,
    afterpartyTimeFrom: form.afterpartyTimeFrom || null,
    afterpartyTimeTo: form.afterpartyTimeTo || null,
    afterpartyGuests: form.afterpartyGuests === "" ? null : Number(form.afterpartyGuests),
    afterpartyMenu: form.afterpartyMenu || null,
    afterpartyMusic: form.afterpartyMusic || null,
    notes: form.notes || "",
    depositAmount: form.depositAmount ? parseFloat(String(form.depositAmount).replace(",", ".")) : null,
    depositPaid: form.depositPaid,
    depositDueDate: form.depositDueDate || null,
    addPoprawiny: form.eventType === "WESELE" && form.addPoprawiny,
    poprawinyDate: form.addPoprawiny ? form.poprawinyDate : null,
    poprawinyGuestCount: form.addPoprawiny && form.poprawinyGuestCount !== "" ? Number(form.poprawinyGuestCount) : null,
    status: "DRAFT",
    ...(menuData && { menu: menuData }),
  };
}

function toEditPayload(form: EventFormTabState, menuData: Record<string, unknown> | null, status: string, depositPaid: boolean): Record<string, unknown> {
  const dateVal = form.eventDate || new Date().toISOString().split("T")[0];
  const guestCount = (Number(form.adultsCount) || 0) + (Number(form.children03) || 0) + (Number(form.children47) || 0) || null;
  return {
    eventType: form.eventType,
    clientName: form.clientName || "Nowa impreza",
    clientPhone: form.clientPhone || null,
    clientEmail: form.clientEmail || null,
    dateFrom: dateVal,
    eventDate: dateVal,
    dateTo: dateVal,
    roomName: form.roomName || "Do ustalenia",
    guestCount,
    adultsCount: form.adultsCount === "" ? null : Number(form.adultsCount),
    children03: form.children03 === "" ? null : Number(form.children03),
    children47: form.children47 === "" ? null : Number(form.children47),
    timeStart: form.timeStart || null,
    timeEnd: form.timeEnd || null,
    churchTime: form.churchTime || null,
    orchestraCount: form.orchestraCount === "" ? null : Number(form.orchestraCount),
    cameramanCount: form.cameramanCount === "" ? null : Number(form.cameramanCount),
    photographerCount: form.photographerCount === "" ? null : Number(form.photographerCount),
    packageId: (menuData as { pakietId?: string } | null)?.pakietId ?? null,
    cakesAndDesserts: form.cakesAndDesserts || null,
    cakeOrderedAt: form.cakeOrderedAt || null,
    cakeArrivalTime: form.cakeArrivalTime || null,
    cakeServedAt: form.cakeServedAt || null,
    drinksArrival: form.drinksArrival || null,
    drinksStorage: form.drinksStorage || null,
    champagneStorage: form.champagneStorage || null,
    firstBottlesBy: form.firstBottlesBy || null,
    alcoholAtTeamTable: form.alcoholAtTeamTable,
    cakesSwedishTable: form.cakesSwedishTable,
    fruitsSwedishTable: form.fruitsSwedishTable,
    ownFlowers: form.ownFlowers,
    ownVases: form.ownVases,
    placeCards: form.placeCards,
    placeCardsLayout: form.placeCardsLayout || null,
    decorationColor: form.decorationColor || null,
    tableLayout: form.tableLayout || null,
    brideGroomTable: form.brideGroomTable || null,
    orchestraTable: form.orchestraTable || null,
    breadWelcomeBy: form.breadWelcomeBy || null,
    extraAttractions: form.extraAttractions || null,
    specialRequests: form.specialRequests || null,
    facebookConsent: form.facebookConsent,
    ownNapkins: form.ownNapkins,
    dutyPerson: form.dutyPerson || null,
    assignedTo: form.assignedTo || null,
    afterpartyEnabled: form.afterpartyEnabled,
    afterpartyTimeFrom: form.afterpartyTimeFrom || null,
    afterpartyTimeTo: form.afterpartyTimeTo || null,
    afterpartyGuests: form.afterpartyGuests === "" ? null : Number(form.afterpartyGuests),
    afterpartyMenu: form.afterpartyMenu || null,
    afterpartyMusic: form.afterpartyMusic || null,
    notes: form.notes || "",
    depositAmount: form.depositAmount ? parseFloat(String(form.depositAmount).replace(",", ".")) : null,
    depositPaid,
    depositDueDate: form.depositDueDate || null,
    status,
    ...(menuData && { menu: menuData }),
  };
}

function CreateEventModal({
  open,
  initialDate,
  onClose,
  onCreated,
  showToast,
}: {
  open: boolean;
  initialDate: string;
  onClose: () => void;
  onCreated: (created: Record<string, unknown>) => void;
  showToast: (msg: string) => void;
}) {
  const [tab, setTab] = useState<"dane" | "goscie" | "menu" | "szczegoly">("dane");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<EventFormTabState>(() => ({ ...EMPTY_EVENT_FORM, eventDate: initialDate || "" }));
  const [menuData, setMenuData] = useState<Record<string, unknown> | null>(null);
  const updateForm = useCallback(<K extends keyof EventFormTabState>(k: K, v: EventFormTabState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
  }, []);

  useEffect(() => {
    if (open) {
      setForm({ ...EMPTY_EVENT_FORM, eventDate: initialDate || "" });
      setMenuData(null);
      setTab("dane");
    }
  }, [open, initialDate]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (open) document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, onClose]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = toCreatePayload(form, menuData);
      const res = await fetch("/api/event-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const created = await res.json();
        onCreated(created);
        onClose();
      } else {
        const err = await res.text();
        alert("Błąd zapisu: " + err);
      }
    } catch (e) {
      alert("Błąd połączenia: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const tc = TC[form.eventType] || TC.INNE;
  const typeLabel = TL[form.eventType] || "Inne";
  const evForMenu = { type: form.eventType, client: form.clientName, date: form.eventDate || new Date().toISOString().split("T")[0], guests: (form.adultsCount === "" ? 0 : Number(form.adultsCount) || 0) + (form.children03 === "" ? 0 : Number(form.children03) || 0) + (form.children47 === "" ? 0 : Number(form.children47) || 0) || null };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", zIndex: 8000, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "40px" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "white", borderRadius: "8px", width: "660px", maxWidth: "95vw", maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 4px 24px rgba(0,0,0,0.12)" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e5e5", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <span style={{ background: tc.bg, color: tc.tx, border: `1px solid ${tc.bd}`, borderRadius: "3px", padding: "2px 8px", fontSize: "11px", fontWeight: 700 }}>{typeLabel}</span>
            <span style={{ fontSize: "10px", color: "#f57c00", fontWeight: 600, border: "1px solid #f57c0033", borderRadius: "3px", padding: "1px 6px" }}>Nowa</span>
          </div>
          <div style={{ fontSize: "16px", fontWeight: 700, color: "#1e1e1e" }}>Nowa impreza</div>
          {form.eventDate && <div style={{ fontSize: "12px", color: "#111827", marginTop: "2px" }}>{fmtLong(form.eventDate)}</div>}
        </div>
        <div style={{ display: "flex", borderBottom: "1px solid #e5e5e5", padding: "0 20px", flexShrink: 0 }}>
          {(["dane", "goscie", "menu", "szczegoly"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{ padding: "8px 16px", border: "none", background: "transparent", borderBottom: tab === t ? "2px solid #1e1e1e" : "2px solid transparent", color: tab === t ? "#1e1e1e" : "#374151", fontSize: "13px", fontWeight: tab === t ? 700 : 500, cursor: "pointer", marginBottom: "-1px" }}
            >
              {t === "dane" ? "Dane" : t === "goscie" ? "Goście i czas" : t === "menu" ? "Menu i tort" : "Szczegóły"}
            </button>
          ))}
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          <EventFormTabs tab={tab} form={form} update={updateForm} menuData={menuData} onMenuSave={(d) => { setMenuData(d); showToast("Menu zapisane"); }} evForMenu={evForMenu} />
        </div>
        <div style={{ padding: "12px 20px", borderTop: "1px solid #e5e5e5", display: "flex", gap: "8px", justifyContent: "flex-end", flexShrink: 0 }}>
          <button onClick={onClose} style={{ background: "white", border: "1px solid #ddd", borderRadius: "4px", padding: "8px 16px", fontSize: "12px", fontWeight: 600, color: "#111827", cursor: "pointer" }}>Anuluj</button>
          <button onClick={handleSave} disabled={saving} style={{ background: "#1e1e1e", color: "white", border: "none", borderRadius: "4px", padding: "8px 20px", fontSize: "12px", fontWeight: 600, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>{saving ? "Zapisuję..." : "Zapisz imprezę"}</button>
        </div>
      </div>
    </div>
  );
}

function EventDetailModal({
  evId,
  events,
  onClose,
  handlers,
  showToast,
  onOpenModal,
  onRefresh,
}: {
  evId: string;
  events: EventRecord[];
  onClose: () => void;
  handlers: Handlers;
  showToast: (msg: string, type?: string) => void;
  onOpenModal?: (id: string) => void;
  onRefresh?: () => void;
}) {
  const ev = events.find((e) => e.id === evId);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<EventFormTabState>(EMPTY_EVENT_FORM);
  const [editSaving, setEditSaving] = useState(false);
  const [editNote, setEditNote] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [showDep, setShowDep] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [zakladka, setZakladka] = useState<"dane" | "goscie" | "menu" | "szczegoly" | "zadania">("dane");
  const [editMenuData, setEditMenuData] = useState<Record<string, unknown> | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const subOpen = showDep || showCancel;
  const updateEditForm = useCallback(<K extends keyof EventFormTabState>(k: K, v: EventFormTabState[K]) => {
    setEditForm((f) => ({ ...f, [k]: v }));
  }, []);

  useEffect(() => {
    setNoteText(ev?.notes ?? "");
  }, [ev?.notes]);
  useEffect(() => {
    setZakladka("szczegoly");
    setEditMode(false);
  }, [ev?.id]);
  useEffect(() => {
    if (ev) {
      setEditForm(evToFullForm(ev));
      setEditMenuData(null);
    }
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

  const handleChecklistToggle = async (itemId: string, checked: boolean) => {
    const next = { ...(ev.checklist ?? {}), [itemId]: checked };
    try {
      const res = await fetch(`/api/event-orders/${ev.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checklist: next }),
      });
      if (res.ok) {
        onRefresh?.();
        showToast(checked ? "Zaznaczono" : "Odznaczono");
      } else {
        showToast("Błąd zapisu", "err");
      }
    } catch {
      showToast("Błąd zapisu", "err");
    }
  };

  const handleSaveEdit = async () => {
    setEditSaving(true);
    try {
      const body = toEditPayload(editForm, editMenuData ?? ev.menu ?? null, ev.status, ev.paid);
      const res = await fetch(`/api/event-orders/${ev.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        onRefresh?.();
        setEditMode(false);
        showToast("Zapisano zmiany");
      } else {
        const err = await res.text();
        alert("Błąd zapisu: " + err);
      }
    } catch (e) {
      alert("Błąd połączenia: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setEditSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditForm(evToFullForm(ev));
    setEditMode(false);
    setZakladka("szczegoly");
  };

  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", zIndex: 500, display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "60px" }}>
        <div ref={ref} style={{ background: "white", borderRadius: "8px", width: "100%", maxWidth: "560px", maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 4px 24px rgba(0,0,0,0.12)", overflowY: "auto" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e5e5", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center", marginBottom: "4px" }}>
                  <TypeBadge type={ev.type} pop={ev.pop} room={ev.room} />
                  {ev.eventNumber && <span style={{ fontSize: "11px", color: "#111827", fontWeight: 500 }}>{ev.eventNumber}</span>}
                  <StatusBadge status={ev.status} />
                  <span style={{ background: db.bg, color: db.tx, borderRadius: "3px", padding: "1px 6px", fontSize: "10px", fontWeight: 600 }}>{db.t}</span>
                </div>
                <div style={{ fontSize: "16px", fontWeight: 700, color: "#1e1e1e", lineHeight: 1.25, wordBreak: "break-word" }}>{ev.client ?? "—"}</div>
                <div style={{ fontSize: "12px", color: "#111827", marginTop: "2px" }}>{fmtLong(ev.date)}{(ev.tf || ev.tt) ? ` · ${ev.tf ?? "?"}–${ev.tt ?? "?"}` : ""}{ev.assignedTo && <span style={{ marginLeft: "8px", fontSize: "10px", color: "#111827" }}>👤 {ev.assignedTo}</span>}</div>
              </div>
              <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "20px", color: "#111827", cursor: "pointer", alignSelf: "flex-start" }}>×</button>
            </div>
          </div>
          <div style={{ display: "flex", borderBottom: "1px solid #e5e5e5", marginLeft: "20px", marginRight: "20px", gap: "0" }}>
            {(editMode
              ? ([["dane", "Dane"], ["goscie", "Goście i czas"], ["menu", "Menu i tort"], ["szczegoly", "Szczegóły"], ["zadania", "Zadania"]] as const)
              : ([["szczegoly", "Szczegóły"], ["menu", "Menu"], ["zadania", "Zadania"]] as const)
            ).map(([t, label]) => (
              <button
                key={t}
                onClick={() => setZakladka(t)}
                style={{
                  padding: "8px 16px",
                  border: "none",
                  borderBottom: zakladka === t ? "2px solid #1e1e1e" : "2px solid transparent",
                  background: "none",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: zakladka === t ? 700 : 500,
                  color: zakladka === t ? "#1e1e1e" : "#374151",
                  marginBottom: "-1px",
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
            {zakladka === "zadania" ? (
              <div style={{ padding: "16px 20px" }}>
                {CHECKLIST_ITEMS.map((item) => {
                  const autoChecked = item.auto ? item.auto(ev) : false;
                  const manualChecked = ev.checklist?.[item.id] ?? false;
                  const checked = autoChecked || manualChecked;
                  return (
                    <label key={item.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 0", borderBottom: "1px solid #f5f5f5", cursor: "pointer" }}>
                      <input type="checkbox" checked={checked} disabled={!!autoChecked} onChange={() => { if (!autoChecked) handleChecklistToggle(item.id, !manualChecked); }} />
                      <span style={{ fontSize: "12px", color: checked ? "#2e7d32" : "#374151", textDecoration: checked ? "line-through" : "none" }}>{item.label}</span>
                      {autoChecked && <span style={{ fontSize: "9px", color: "#111827" }}>auto</span>}
                    </label>
                  );
                })}
                <div style={{ marginTop: "8px", fontSize: "11px", color: "#111827" }}>
                  {CHECKLIST_ITEMS.filter((i) => (i.auto ? i.auto(ev) : false) || ev.checklist?.[i.id]).length}/{CHECKLIST_ITEMS.length} gotowe
                </div>
              </div>
            ) : editMode ? (
              <EventFormTabs
                tab={zakladka}
                form={editForm}
                update={updateEditForm}
                menuData={editMenuData ?? ev.menu ?? null}
                onMenuSave={(d) => { setEditMenuData(d); handlers.updateMenu(evId, d).then(() => { showToast("Menu zapisane"); onRefresh?.(); }); }}
                evForMenu={{ type: editForm.eventType, client: editForm.clientName, date: editForm.eventDate || ev.date, guests: (editForm.adultsCount === "" ? 0 : Number(editForm.adultsCount) || 0) + (editForm.children03 === "" ? 0 : Number(editForm.children03) || 0) + (editForm.children47 === "" ? 0 : Number(editForm.children47) || 0) || null }}
              />
            ) : zakladka === "szczegoly" ? (
            <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "12px" }}>
            {ev.phone ? (
              <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                <a href={`tel:${ev.phone.replace(/\s/g, "")}`} style={{ fontSize: "12px", color: "#1976d2", textDecoration: "none" }}>📞 {ev.phone}</a>
                <a href={`https://wa.me/${ev.phone.replace(/[\s\+\-]/g, "").replace(/^0/, "48")}?text=${encodeURIComponent(`Dzień dobry, ${ev.client || ""}. W sprawie rezerwacji na ${fmtDate(ev.date)} w Hotelu Łabędź.`)}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: "11px", color: "#25d366", fontWeight: 600, textDecoration: "none", border: "1px solid #25d366", borderRadius: "3px", padding: "4px 10px" }}>WhatsApp</a>
                <a href={`sms:${ev.phone.replace(/\s/g, "")}?body=${encodeURIComponent(`Hotel Łabędź - dot. imprezy ${fmtDate(ev.date)}`)}`} style={{ fontSize: "11px", color: "#111827", textDecoration: "none", border: "1px solid #ddd", borderRadius: "3px", padding: "4px 10px" }}>SMS</a>
              </div>
            ) : (
              <div style={{ background: "#f8fafc", border: "2px dashed #e2e8f0", borderRadius: "12px", padding: "12px", textAlign: "center", color: "#111827", fontSize: "13px" }}>📵 Brak numeru telefonu</div>
            )}
            {ev.email && (
              <div style={{ display: "flex", gap: "6px", alignItems: "center", padding: "10px 14px", background: "#f8fafc", borderRadius: "12px" }}>
                <a href={`mailto:${ev.email}`} style={{ color: "#1976d2", fontSize: "12px", textDecoration: "none", fontWeight: 600 }}>{ev.email}</a>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(ev.email!).then(() => showToast("Email skopiowany"))}
                  style={{ fontSize: "10px", color: "#111827", background: "white", border: "1px solid #ddd", borderRadius: "3px", padding: "2px 6px", cursor: "pointer" }}
                >Kopiuj</button>
              </div>
            )}
            <div style={{ background: "#f8fafc", borderRadius: "12px", padding: "14px" }}>
              <div style={{ fontSize: "10px", fontWeight: 900, color: "#111827", letterSpacing: "2px", marginBottom: "9px" }}>STATUS</div>
              <div style={{ display: "flex", gap: "8px" }}>
                {["CONFIRMED", "DRAFT", "DONE"].map((s) => (
                  <button key={s} onClick={() => doStatus(s)} style={{ flex: 1, padding: "9px 12px", background: ev.status === s ? SC[s].bg : "white", border: `2px solid ${ev.status === s ? SC[s].bd : "#e2e8f0"}`, borderRadius: "9px", cursor: "pointer", fontSize: "13px", fontWeight: 800, color: ev.status === s ? SC[s].tx : "#374151", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                    <StatusDot status={s} />{SC[s].label}{ev.status === s ? " ✓" : ""}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ background: "#f8fafc", borderRadius: "12px", padding: "14px" }}>
              <div style={{ fontSize: "10px", fontWeight: 900, color: "#111827", letterSpacing: "2px", marginBottom: "9px" }}>SZCZEGÓŁY</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                {[["🏛 Sala", ev.room ?? "—"], ["👥 Goście", ev.guests ? ev.guests + " osób" : "—"], ["⏰ Godziny", (ev.tf || ev.tt) ? `${ev.tf ?? "?"}–${ev.tt ?? "?"}` : "—"], ["📊 Status", SC[ev.status]?.label ?? "—"]].map(([l, v]) => (
                  <div key={l}><div style={{ fontSize: "10px", color: "#111827", fontWeight: 700, marginBottom: "2px" }}>{l}</div><div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>{v}</div></div>
                ))}
              </div>
            </div>
            <>
            <div style={{ background: "#f8fafc", borderRadius: "12px", padding: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "9px" }}>
                <div style={{ fontSize: "10px", fontWeight: 900, color: "#111827", letterSpacing: "2px" }}>ZADATEK</div>
                <button onClick={() => setShowDep(true)} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "7px", padding: "4px 10px", cursor: "pointer", fontSize: "11px", fontWeight: 700, color: "#3b82f6" }}>{ev.deposit != null ? "✏️ Zmień" : "+ Dodaj"}</button>
              </div>
              {ev.deposit != null ? (
                <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                  <div style={{ fontSize: "22px", fontWeight: 900, color: ev.paid ? "#166534" : "#991b1b" }}>{ev.paid ? "✅" : "❌"} {fmtZl(ev.deposit)}</div>
                  {ev.deposit && !ev.paid && ev.depositDueDate && new Date(ev.depositDueDate) < new Date() && (
                    <span style={{ fontSize: "10px", color: "#c62828", fontWeight: 700 }}>Zadatek przeterminowany!</span>
                  )}
                  <button onClick={doToggleDep} style={{ background: ev.paid ? "#fef2f2" : "#f0fdf4", border: `1.5px solid ${ev.paid ? "#fca5a5" : "#86efac"}`, borderRadius: "9px", padding: "7px 14px", cursor: "pointer", fontSize: "12px", fontWeight: 800, color: ev.paid ? "#991b1b" : "#166534" }}>{ev.paid ? "↩ Cofnij" : "✅ Oznacz opłacony"}</button>
                </div>
              ) : (
                <div style={{ color: "#111827", fontSize: "13px", fontStyle: "italic" }}>Brak zadatku — kliknij Dodaj</div>
              )}
            </div>
            <div style={{ background: "#f8fafc", borderRadius: "12px", padding: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "9px" }}>
                <div style={{ fontSize: "10px", fontWeight: 900, color: "#111827", letterSpacing: "2px" }}>NOTATKA</div>
                {!editNote && <button onClick={() => setEditNote(true)} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "7px", padding: "4px 10px", cursor: "pointer", fontSize: "11px", fontWeight: 700, color: "#111827" }}>✏️ Edytuj</button>}
              </div>
              {editNote ? (
                <div>
                  <textarea ref={noteRef} value={noteText} onChange={(e) => setNoteText(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); setEditNote(false); } if (e.key === "Enter" && e.ctrlKey) doSaveNote(); }} style={{ width: "100%", minHeight: "80px", padding: "10px", border: "2px solid #3b82f6", borderRadius: "9px", fontSize: "13px", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit", lineHeight: 1.6, outline: "none" }} />
                  <div style={{ display: "flex", gap: "8px", marginTop: "8px", alignItems: "center" }}>
                    <button onClick={doSaveNote} style={{ background: "#3b82f6", color: "white", border: "none", borderRadius: "8px", padding: "8px 18px", cursor: "pointer", fontSize: "13px", fontWeight: 800 }}>Zapisz</button>
                    <button onClick={() => { setEditNote(false); setNoteText(ev.notes ?? ""); }} style={{ background: "white", border: "1.5px solid #e2e8f0", borderRadius: "8px", padding: "8px 14px", cursor: "pointer", fontSize: "13px", color: "#111827" }}>Anuluj</button>
                    <span style={{ fontSize: "11px", color: "#111827" }}>Ctrl+Enter</span>
                  </div>
                </div>
              ) : (
                <div onClick={() => setEditNote(true)} style={{ fontSize: "13px", color: ev.notes ? "#0f172a" : "#374151", lineHeight: 1.6, cursor: "text", whiteSpace: "pre-wrap", minHeight: "32px", padding: "8px", background: "white", border: "1.5px dashed #e2e8f0", borderRadius: "8px" }}>{ev.notes || "Brak notatki — kliknij aby dodać..."}</div>
              )}
            </div>
            </>
            {ev.quoteId ? (
              <div style={{ background: "#f5f3ff", border: "1.5px solid #a78bfa", borderRadius: "10px", padding: "10px 14px", display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "18px" }}>💰</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "10px", fontWeight: 900, color: "#7c3aed", letterSpacing: "1px" }}>KOSZTORYS</div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#4c1d95" }}>Powiązany kosztorys</div>
                </div>
                <button onClick={() => window.open(`/mice/kosztorysy`, "_blank")} style={{ background: "#7c3aed", color: "white", border: "none", borderRadius: "7px", padding: "6px 12px", cursor: "pointer", fontSize: "11px", fontWeight: 800 }}>📋 Otwórz kosztorys</button>
              </div>
            ) : (
              <div style={{ background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: "10px", padding: "10px 14px" }}>
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch("/api/mice/kosztorysy", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          name: `${ev.client ?? "Klient"} — ${TL[ev.type] ?? "Impreza"} ${fmtDate(ev.date)}`,
                          items: ev.menu ? [{ name: "Pakiet menu", quantity: ev.guests ?? 1, unitPrice: 0, amount: 0 }] : [],
                        }),
                      });
                      if (!res.ok) throw new Error("Błąd tworzenia");
                      const quote = await res.json();
                      await fetch(`/api/event-orders/${ev.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ quoteId: quote.id }),
                      });
                      onRefresh?.();
                      showToast("Kosztorys utworzony");
                    } catch {
                      showToast("Błąd tworzenia kosztorysu", "err");
                    }
                  }}
                  style={{ background: "white", border: "1px solid #ddd", borderRadius: "7px", padding: "6px 14px", fontSize: "11px", fontWeight: 600, color: "#111827", cursor: "pointer" }}
                >📋 Utwórz kosztorys</button>
              </div>
            )}
            {(() => {
              const hasLink = ev.googleCalendarEventId && ev.googleCalendarCalId;
              const hasError = !!ev.googleCalendarError;
              const lastSync = ev.googleCalendarSyncedAt;
              let bg: string, borderColor: string, icon: string, text: string, textColor: string;
              if (!hasLink) {
                bg = "#fff3e0"; borderColor = "#ffcc80"; icon = "⚠️";
                text = "Nie powiązane z Google Calendar"; textColor = "#e65100";
              } else if (hasError) {
                bg = "#ffebee"; borderColor = "#ef9a9a"; icon = "❌";
                text = "Błąd synchronizacji"; textColor = "#c62828";
              } else if (!lastSync) {
                bg = "#fff8e1"; borderColor = "#ffe082"; icon = "📅";
                text = "Zaimportowane z GCal — opis zaktualizuje się przy edycji"; textColor = "#f57f17";
              } else {
                bg = "#e8f5e9"; borderColor = "#a5d6a7"; icon = "✅";
                text = "Zsynchronizowane z Google Calendar"; textColor = "#2e7d32";
              }
              return (
                <div style={{ background: bg, border: `1px solid ${borderColor}`, borderRadius: "6px", padding: "8px 12px", display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: textColor, marginTop: "12px" }}>
                  <span>{icon}</span>
                  <span style={{ flex: 1 }}>{text}</span>
                  {hasLink && !lastSync && (
                    <button
                      onClick={async () => {
                        const res = await fetch(`/api/event-orders/${ev.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ forceGcalSync: true }),
                        });
                        if (res.ok) {
                          showToast("Zsynchronizowano opis z Google Calendar");
                          onRefresh?.();
                        } else {
                          showToast("Błąd synchronizacji", "err");
                        }
                      }}
                      style={{ background: "white", border: `1px solid ${borderColor}`, borderRadius: "4px", padding: "3px 10px", fontSize: "11px", fontWeight: 600, color: textColor, cursor: "pointer", whiteSpace: "nowrap" }}
                    >
                      Synchronizuj teraz
                    </button>
                  )}
                  {hasLink && (
                    <button
                      onClick={() => {
                        const eid = btoa(`${ev.googleCalendarEventId} ${ev.googleCalendarCalId}`);
                        window.open(`https://calendar.google.com/calendar/event?eid=${eid}`, "_blank");
                      }}
                      style={{ background: "white", border: `1px solid ${borderColor}`, borderRadius: "4px", padding: "3px 10px", fontSize: "11px", fontWeight: 600, color: textColor, cursor: "pointer", whiteSpace: "nowrap" }}
                    >
                      Otwórz w GCal
                    </button>
                  )}
                </div>
              );
            })()}
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
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <button onClick={() => { setEditForm(evToFullForm(ev)); setEditMode(true); setZakladka("dane"); }} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", background: "white", border: "1.5px solid #e2e8f0", borderRadius: "10px", padding: "12px", fontSize: "13px", fontWeight: 700, color: "#0f172a", cursor: "pointer" }}>✏️ Edytuj</button>
              <div style={{ marginTop: "12px", padding: "8px 12px", background: "#f9fafb", borderRadius: "4px", border: "1px solid #f0f0f0", fontSize: "12px" }}>
                <div style={{ fontWeight: 700, color: "#111827", marginBottom: "4px" }}>Dokumenty</div>
                {ev.checklistDocId ? (
                  <a href={`https://docs.google.com/document/d/${ev.checklistDocId}`} target="_blank" rel="noopener noreferrer" style={{ color: "#1976d2", fontSize: "11px", display: "block" }}>📄 Checklista Google Docs</a>
                ) : (
                  <span style={{ color: "#111827", fontSize: "11px" }}>Checklista: brak (tworzona przy zapisie)</span>
                )}
                {ev.menuDocId ? (
                  <a href={`https://docs.google.com/document/d/${ev.menuDocId}`} target="_blank" rel="noopener noreferrer" style={{ color: "#1976d2", fontSize: "11px", display: "block", marginTop: "2px" }}>📄 Menu Google Docs</a>
                ) : (
                  <span style={{ color: "#111827", fontSize: "11px", display: "block", marginTop: "2px" }}>Menu Docs: brak</span>
                )}
              </div>
              <button onClick={() => {
                const tc = getEventColor(ev);
                const menuSummary = ev.menu ? "Menu zapisane" : "Menu nie wybrane";
                const html = `<!DOCTYPE html><html><head><title>Karta imprezy — ${ev.client ?? "—"}</title><style>body{font-family:Arial,sans-serif;padding:20px;font-size:13px}h1{font-size:18px;margin-bottom:4px}h2{font-size:14px;color:#666;margin-top:16px;border-bottom:1px solid #ddd;padding-bottom:4px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px}.label{font-weight:bold;color:#888;font-size:11px;text-transform:uppercase}.value{font-size:13px;margin-bottom:8px}.notes{background:#f5f5f5;padding:10px;border-radius:4px;white-space:pre-wrap;margin-top:8px}.badge{display:inline-block;padding:2px 10px;border-radius:3px;font-weight:bold;font-size:12px;background:${tc.bg};color:${tc.tx};border:1px solid ${tc.bd}}@media print{body{padding:0}}</style></head><body><div style="display:flex;justify-content:space-between;align-items:center"><div><h1>${ev.client ?? "—"}</h1><span class="badge">${TL[ev.type] ?? "Inne"}</span>${ev.eventNumber ? '<span style="margin-left:8px;color:#999">' + ev.eventNumber + "</span>" : ""}</div><div style="text-align:right;font-size:12px;color:#666">Hotel Łabędź<br/>Wydrukowano: ${new Date().toLocaleDateString("pl-PL")}</div></div><h2>Dane imprezy</h2><div class="grid"><div><div class="label">Data</div><div class="value">${fmtLong(ev.date)}</div></div><div><div class="label">Sala</div><div class="value">${ev.room ?? "—"}</div></div><div><div class="label">Goście</div><div class="value">${ev.guests ? ev.guests + " os." : "—"}</div></div><div><div class="label">Godziny</div><div class="value">${ev.tf || ev.tt ? (ev.tf || "?") + "–" + (ev.tt || "?") : "—"}</div></div><div><div class="label">Telefon</div><div class="value">${ev.phone ?? "—"}</div></div><div><div class="label">Email</div><div class="value">${ev.email ?? "—"}</div></div><div><div class="label">Zadatek</div><div class="value">${ev.deposit != null ? fmtZl(ev.deposit) + (ev.paid ? " ✓" : " ✗") : "—"}</div></div><div><div class="label">Status</div><div class="value">${(SC[ev.status] ?? {}).label ?? ev.status ?? "—"}</div></div></div>${ev.notes ? '<h2>Notatki</h2><div class="notes">' + ev.notes + "</div>" : ""}<h2>Menu</h2><div style="font-size:12px;color:#666">${menuSummary}</div><div style="margin-top:40px;border-top:1px solid #ddd;padding-top:8px;font-size:10px;color:#ccc">Wygenerowano z Centrum Sprzedaży · Hotel Łabędź</div></body></html>`;
                const w = window.open("", "_blank");
                if (w) { w.document.write(html); w.document.close(); w.print(); }
              }} style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", background: "white", border: "1px solid #ddd", borderRadius: "4px", padding: "6px 14px", fontSize: "11px", fontWeight: 600, color: "#111827", cursor: "pointer" }}>🖨 Drukuj kartę</button>
            </div>
            </div>
            ) : (
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
          <div style={{ padding: "12px 20px", borderTop: "1px solid #e5e5e5", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
            {editMode ? (
              <>
                <button onClick={handleCancelEdit} style={{ background: "white", border: "1px solid #ddd", borderRadius: "4px", padding: "6px 14px", cursor: "pointer", fontSize: "11px", fontWeight: 600, color: "#111827" }}>Anuluj edycję</button>
                <button onClick={handleSaveEdit} disabled={editSaving} style={{ background: "#1e1e1e", color: "white", border: "none", borderRadius: "4px", padding: "6px 20px", cursor: "pointer", fontSize: "11px", fontWeight: 600, opacity: editSaving ? 0.6 : 1 }}>{editSaving ? "Zapisuję..." : "Zapisz"}</button>
              </>
            ) : (
              <>
                {ev.status === "CANCELLED" ? (
                  <button onClick={doRestore} style={{ background: "white", border: "1px solid #ddd", borderRadius: "4px", padding: "6px 14px", cursor: "pointer", fontSize: "11px", fontWeight: 600, color: "#2e7d32" }}>Przywróć imprezę</button>
                ) : (
                  <button onClick={() => setShowCancel(true)} style={{ background: "white", border: "1px solid #ddd", borderRadius: "4px", padding: "6px 14px", cursor: "pointer", fontSize: "11px", fontWeight: 600, color: "#c62828" }}>Anuluj imprezę</button>
                )}
                <button onClick={onClose} style={{ background: "#1e1e1e", color: "white", border: "none", borderRadius: "4px", padding: "6px 16px", cursor: "pointer", fontSize: "11px", fontWeight: 600 }}>Zamknij</button>
              </>
            )}
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
  const cancelled = ev.status === "CANCELLED";
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (expanded) ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [expanded]);
  const leftBorder = cancelled ? "#ddd" : c.bd;
  const tc = c;
  return (
    <div ref={ref} id={`ev-${ev.id}`} onClick={onToggle} style={{
      display: "grid",
      gridTemplateColumns: "60px 95px minmax(200px,1fr) 150px 70px 90px minmax(100px,1fr) 110px 120px 20px",
      padding: "14px 16px",
      borderBottom: "1px solid #3b82f6",
      borderLeft: `3px solid ${leftBorder}`,
      cursor: "pointer",
      alignItems: "center",
      gap: "8px",
      fontSize: "16px",
      opacity: cancelled ? 0.45 : 1,
      background: "white",
    }} onMouseEnter={(e) => { if (!cancelled) e.currentTarget.style.background = "#fafafa"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "white"; }}>
      <div style={{ fontSize: "15px", color: "#111827" }}>{ev.eventNumber ?? "—"}</div>
      <div>
        <div style={{ fontWeight: 600, color: "#1e1e1e", fontSize: "16px" }}>{fmtDate(ev.date)}</div>
        <div style={{ fontSize: "14px", fontWeight: 600, color: days === 0 ? "#e53935" : days <= 7 && days > 0 ? "#f57c00" : "#555" }}>
          {days === 0 ? "dziś" : days === 1 ? "jutro" : days > 0 ? `za ${days} d` : `${Math.abs(days)} d temu`}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
        <span style={{
          background: tc.bg, color: tc.tx, border: `1px solid ${tc.bd}`,
          borderRadius: "3px", padding: "4px 10px", fontSize: "14px", fontWeight: 700,
          whiteSpace: "nowrap", flexShrink: 0,
        }}>{ev.pop ? "Poprawiny" : TL[ev.type] ?? ev.type}</span>
        <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "16px" }}>{ev.client ?? "—"}</span>
        {ev.assignedTo && <span style={{ fontSize: "14px", color: "#111827" }}>👤 {ev.assignedTo}</span>}
        {ev.status === "DRAFT" && <span style={{ fontSize: "14px", color: "#f57c00", fontWeight: 600, flexShrink: 0 }}>Szkic</span>}
      </div>
      <div style={{ fontSize: "16px", color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={ev.room ?? ""}>{ev.room ?? "—"}</div>
      <div style={{ fontSize: "16px", color: "#111827" }}>{ev.guests ? `${ev.guests} os.` : "—"}</div>
      <div style={{ fontSize: "16px", color: "#111827" }}>{ev.tf || ev.tt ? `${ev.tf ?? "?"}–${ev.tt ?? "?"}` : "—"}</div>
      <div style={{ fontSize: "16px", color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontStyle: ev.notes ? "normal" : "italic" }} title={ev.notes ?? ""}>{ev.notes || "brak notatki"}</div>
      <div style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
        <DepositChip ev={ev} onToggle={onDepositToggle} onOpen={onDepositOpen} />
      </div>
      <div onClick={(e) => e.stopPropagation()}><PhoneBtn phone={ev.phone} client={ev.client} date={ev.date} compact /></div>
      <span style={{ color: "#111827", fontSize: "18px", textAlign: "right", transition: "transform 0.15s", transform: expanded ? "rotate(90deg)" : "none" }}>›</span>
      {expanded && (
        <div style={{ gridColumn: "1 / -1", marginTop: "8px", paddingTop: "8px", borderTop: "1px solid #3b82f6", display: "flex", gap: "16px", alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 200px", fontSize: "16px", color: "#111827", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{ev.notes || "Brak notatki."}</div>
          <button onClick={(e) => { e.stopPropagation(); onOpenModal(ev.id); }} style={{ background: "#3b82f6", color: "white", border: "none", borderRadius: "4px", padding: "8px 18px", fontSize: "15px", fontWeight: 600, cursor: "pointer" }}>Szczegóły</button>
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
      <div style={{ textAlign: "center", padding: "60px", color: "#111827" }}>
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
        <div style={{ textAlign: "center", padding: "48px", color: "#111827" }}>
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
                    <div style={{ fontSize: "12px", color: "#111827", marginTop: "3px" }}>
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
  const col = getRoomColor(room);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.25)",
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
          borderRadius: "8px",
          width: "400px",
          maxHeight: "75vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 18px",
            borderBottom: "1px solid #e5e5e5",
            flexShrink: 0,
          }}
        >
          <div style={{ color: "#1e1e1e", fontWeight: 700, fontSize: "16px" }}>{day} {monthLabel} · {room}</div>
          <div style={{ color: "#111827", fontSize: "14px", marginTop: "2px" }}>{plural(events.length)}</div>
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
                  <span style={{ fontWeight: 800, fontSize: "15px", color: "#0f172a" }}>{ev.client ?? "—"}</span>
                </div>
                <div style={{ fontSize: "13px", color: "#111827", marginTop: "3px" }}>
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
            borderTop: "1px solid #e5e5e5",
            flexShrink: 0,
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={onClose}
            style={{
              background: "#1e1e1e",
              color: "white",
              border: "none",
              borderRadius: "4px",
              padding: "6px 16px",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "12px",
            }}
          >
            Zamknij
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
      <button onClick={onToday} style={{ background: "#f1f5f9", border: "2px solid #e2e8f0", borderRadius: "9px", padding: "9px 16px", cursor: "pointer", fontSize: "15px", fontWeight: 800, color: "#111827" }}>Dzisiaj</button>
    </div>
  );
}

function FreeDatesView({ events, month, year, onMonthChange, onCreateWithDate }: { events: EventRecord[]; month: number; year: number; onMonthChange: (fn: (p: number) => number) => void; onCreateWithDate: (dateStr: string, room?: string) => void }) {
  const [selectedRoom, setSelectedRoom] = useState("Sala Złota");
  const dInM = new Date(year, month + 1, 0).getDate();
  const firstDow = new Date(year, month, 1).getDay();
  const startOffset = firstDow === 0 ? 6 : firstDow - 1;
  const todayD = TODAY.getFullYear() === year && TODAY.getMonth() === month ? TODAY.getDate() : null;

  const roomEvs = events.filter((e) => {
    const d = new Date(e.date + "T00:00:00");
    return d.getFullYear() === year && d.getMonth() === month && (e.room ?? "").includes(selectedRoom) && e.status !== "CANCELLED";
  });
  const busyDays = new Set(roomEvs.map((e) => new Date(e.date + "T00:00:00").getDate()));

  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= dInM; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <div style={{ padding: "0 20px 48px" }}>
      <MonthNav month={month} year={year} onPrev={() => onMonthChange((p) => p - 1)} onNext={() => onMonthChange((p) => p + 1)} onToday={() => onMonthChange(() => 0)} />
      <div style={{ display: "flex", gap: "6px", marginBottom: "14px", flexWrap: "wrap" }}>
        {ROOMS.filter((r) => r !== "Do ustalenia").map((r) => (
          <button key={r} onClick={() => setSelectedRoom(r)} style={{ padding: "10px 18px", borderRadius: "6px", fontSize: "15px", fontWeight: 600, border: `2px solid ${selectedRoom === r ? "#1e1e1e" : "#ddd"}`, background: selectedRoom === r ? "#1e1e1e" : "white", color: selectedRoom === r ? "white" : "#111827", cursor: "pointer" }}>{r}</button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: "3px", marginBottom: "3px" }}>
        {["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Ndz"].map((d) => (
          <div key={d} style={{ textAlign: "center", fontSize: "15px", fontWeight: 700, color: "#111827", padding: "8px 0" }}>{d}</div>
        ))}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: "3px", marginBottom: "3px" }}>
          {week.map((day, di) => {
            if (day === null) return <div key={di} style={{ background: "#f9fafb", minHeight: "54px", borderRadius: "6px" }} />;
            const isPast = new Date(year, month, day) < TODAY;
            const busy = busyDays.has(day);
            const isToday = day === todayD;
            const bg = isPast ? "#f1f5f9" : busy ? "#fef2f2" : "#f0fdf4";
            const borderColor = busy ? "#fca5a5" : isPast ? "#3b82f6" : "#86efac";
            return (
              <div key={di} onClick={() => { if (!isPast && !busy) { const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`; onCreateWithDate(dateStr, selectedRoom); } }} style={{ background: bg, border: `1px solid ${borderColor}`, borderRadius: "6px", minHeight: "54px", padding: "8px", display: "flex", alignItems: "center", justifyContent: "center", cursor: isPast || busy ? "default" : "pointer", fontSize: "18px", fontWeight: 700, color: isPast ? "#374151" : busy ? "#dc2626" : "#166534" }}>
                {day}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function CalendarMonthView({ events, month, year, onOpenModal, onMonthChange, onCreateWithDate }: { events: EventRecord[]; month: number; year: number; onOpenModal: (id: string) => void; onMonthChange: (fn: (p: number) => number) => void; onCreateWithDate?: (dateStr: string) => void }) {
  const [popupDay, setPopupDay] = useState<{ day: number; events: EventRecord[]; x: number; y: number } | null>(null);

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

  const maxVisible = 4;

  return (
    <div style={{ padding: "0 20px 48px" }}>
      <MonthNav month={month} year={year} onPrev={() => onMonthChange((p) => p - 1)} onNext={() => onMonthChange((p) => p + 1)} onToday={() => onMonthChange(() => 0)} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: "2px", marginBottom: "2px" }}>
        {["Pon", "Wt", "Śr", "Czw", "Pt", "Sob", "Ndz"].map((d) => (
          <div key={d} style={{ textAlign: "center", fontSize: "14px", fontWeight: 700, color: "#111827", padding: "6px 0" }}>{d}</div>
        ))}
      </div>

      {weeks.map((week, wi) => (
        <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: "2px", marginBottom: "2px" }}>
          {week.map((day, di) => {
            if (day === null) return <div key={di} style={{ background: "#f9fafb", minHeight: "130px", borderRadius: "6px" }} />;
            const dayEvs = monthEvs.filter((e) => new Date(e.date).getDate() === day);
            const isToday = day === todayD;
            const isWeekend = di >= 5;
            return (
              <div
                key={di}
                onClick={() => {
                  const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  onCreateWithDate ? onCreateWithDate(dateStr) : (window.location.href = `/events/new?date=${dateStr}`);
                }}
                style={{ background: isToday ? "#fef2f2" : isWeekend ? "#fafafa" : "white", border: `1px solid ${isToday ? "#fca5a5" : "#3b82f6"}`, borderRadius: "6px", minHeight: "130px", padding: "5px", display: "flex", flexDirection: "column", cursor: "pointer" }}
              >
                <div style={{ fontSize: "16px", fontWeight: 700, color: isToday ? "#ef4444" : "#64748b", marginBottom: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
                  {isToday && <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#ef4444" }} />}
                  {day}
                  {dayEvs.length > 0 && <span style={{ fontSize: "13px", color: "#111827", fontWeight: 700 }}>({dayEvs.length})</span>}
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "3px", overflow: "hidden" }}>
                  {dayEvs.slice(0, maxVisible).map((ev) => {
                    const tc = getEventColor(ev);
                    const emoji = TYPE_EMOJI[ev.type] ?? "📋";
                    return (
                      <div
                        key={ev.id}
                        onClick={(e) => { e.stopPropagation(); onOpenModal(ev.id); }}
                        style={{ background: tc.bg, borderLeft: `3px solid ${tc.bd}`, borderRadius: "3px", padding: "4px 6px", cursor: "pointer", fontSize: "15px", fontWeight: 600, color: tc.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: "1.35" }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = tc.bd + "22"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = tc.bg; }}
                      >
                        {emoji} {(ev.client ?? "").split(/\s+/).slice(0, 2).join(" ")}
                      </div>
                    );
                  })}
                  {dayEvs.length > maxVisible && (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setPopupDay({ day, events: dayEvs, x: e.clientX, y: e.clientY });
                      }}
                      style={{ fontSize: "13px", color: "#1976d2", fontWeight: 700, textAlign: "center", cursor: "pointer", padding: "3px", borderRadius: "3px" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "#e3f2fd"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      +{dayEvs.length - maxVisible} więcej
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {popupDay && (
        <div onClick={() => setPopupDay(null)} style={{ position: "fixed", inset: 0, zIndex: 7000, background: "rgba(0,0,0,0.15)" }}>
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "fixed",
              left: Math.min(popupDay.x, window.innerWidth - 320),
              top: Math.min(popupDay.y, window.innerHeight - 400),
              width: "300px",
              maxHeight: "380px",
              overflowY: "auto",
              background: "white",
              borderRadius: "8px",
              border: "1px solid #e5e5e5",
              boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
              padding: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px", paddingBottom: "8px", borderBottom: "1px solid #f0f0f0" }}>
              <span style={{ fontSize: "16px", fontWeight: 700, color: "#1e1e1e" }}>
                {popupDay.day} {MPL[month]} — {popupDay.events.length} imprez
              </span>
              <button onClick={() => setPopupDay(null)} style={{ background: "none", border: "none", fontSize: "16px", color: "#111827", cursor: "pointer" }}>×</button>
            </div>
            {popupDay.events.map((ev) => {
              const tc = getEventColor(ev);
              return (
                <div
                  key={ev.id}
                  onClick={() => { setPopupDay(null); onOpenModal(ev.id); }}
                  style={{
                    borderLeft: `3px solid ${tc.bd}`,
                    background: tc.bg,
                    borderRadius: "4px",
                    padding: "8px 12px",
                    marginBottom: "4px",
                    cursor: "pointer",
                    fontSize: "15px",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.8"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
                >
                  <div style={{ fontWeight: 700, color: tc.tx, fontSize: "16px" }}>{ev.client ?? "—"}</div>
                  <div style={{ fontSize: "13px", color: tc.tx + "88", marginTop: "2px" }}>
                    {ev.room ?? "—"} {ev.guests ? `· ${ev.guests} os.` : ""}
                  </div>
                </div>
              );
            })}
            <button
              onClick={() => {
                const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(popupDay.day).padStart(2, "0")}`;
                setPopupDay(null);
                onCreateWithDate ? onCreateWithDate(dateStr) : (window.location.href = `/events/new?date=${dateStr}`);
              }}
              style={{ width: "100%", marginTop: "6px", padding: "6px", background: "#f5f5f5", border: "1px dashed #ddd", borderRadius: "4px", fontSize: "11px", fontWeight: 600, color: "#111827", cursor: "pointer", textAlign: "center" }}
            >
              + Nowa impreza na ten dzień
            </button>
          </div>
        </div>
      )}
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
        <div style={{ position: "absolute", left: "28px", top: 0, bottom: 0, width: "2px", background: "#3b82f6" }} />

        {grouped.map(([dateStr, dayEvs]) => {
          const d = new Date(dateStr);
          const day = d.getDate();
          const dow = DPLS[d.getDay()];
          const days = daysTo(dateStr);
          const db = dayBadge(days);
          const isToday = days === 0;

          return (
            <div key={dateStr} style={{ marginBottom: "20px", position: "relative" }}>
              <div style={{ position: "absolute", left: "-44px", top: "8px", width: "34px", height: "34px", borderRadius: "50%", background: isToday ? "#ef4444" : "white", border: isToday ? "none" : "2px solid #3b82f6", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 2 }}>
                <div style={{ fontSize: "13px", fontWeight: 900, color: isToday ? "white" : "#0f172a", lineHeight: 1 }}>{day}</div>
                <div style={{ fontSize: "7px", fontWeight: 700, color: isToday ? "rgba(255,255,255,0.8)" : "#374151", lineHeight: 1 }}>{dow}</div>
              </div>

              <div style={{ marginBottom: "6px" }}>
                <span style={{ background: db.bg, color: db.tx, borderRadius: "5px", padding: "2px 8px", fontSize: "11px", fontWeight: 800 }}>{db.t}</span>
                <span style={{ fontSize: "11px", color: "#111827", marginLeft: "8px", fontWeight: 600 }}>{fmtLong(dateStr)} · {plural(dayEvs.length)}</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                {dayEvs.map((ev) => {
                  const tc = getEventColor(ev);
                  const emoji = TYPE_EMOJI[ev.type] ?? "📋";
                  return (
                    <div key={ev.id} onClick={() => onOpenModal(ev.id)}
                      style={{ background: "white", border: "1px solid #3b82f6", borderLeft: `4px solid ${tc.bd}`, borderRadius: "9px", padding: "10px 14px", cursor: "pointer", transition: "box-shadow 0.12s" }}
                      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 3px 14px ${tc.bd}33`; }}
                      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "16px" }}>{emoji}</span>
                        <span style={{ fontWeight: 800, fontSize: "14px", color: "#0f172a" }}>{ev.client ?? "—"}</span>
                        <TypeBadge type={ev.type} pop={ev.pop} room={ev.room} small />
                        <StatusDot status={ev.status} />
                      </div>
                      <div style={{ display: "flex", gap: "14px", marginTop: "5px", fontSize: "12px", color: "#111827", flexWrap: "wrap" }}>
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

      <div style={{ overflowX: "auto", background: "white", borderRadius: "12px", border: "1px solid #3b82f6" }}>
        <div style={{ display: "flex", position: "sticky" as const, top: 0, zIndex: 10, background: "white", borderBottom: "2px solid #3b82f6" }}>
          <div style={{ width: "80px", minWidth: "80px", padding: "12px 10px", fontSize: "16px", fontWeight: 900, color: "#111827" }}>DZIEŃ</div>
          {ROOMS.map((r) => (
            <div key={r} style={{ flex: 1, minWidth: "140px", padding: "12px 10px", textAlign: "center", fontSize: "16px", fontWeight: 800, color: "#111827", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
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
            <div key={d} style={{ display: "flex", borderBottom: "1px solid #3b82f6", background: isToday ? "#fef2f2" : isWeekend ? "#fafafa" : "white" }}>
              <div style={{ width: "80px", minWidth: "80px", padding: "8px", display: "flex", alignItems: "center", gap: "6px", borderRight: "1px solid #3b82f6" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: isToday ? "#ef4444" : "transparent", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: "18px", fontWeight: 900, color: isToday ? "white" : "#0f172a", lineHeight: 1 }}>{d}</span>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: isToday ? "rgba(255,255,255,0.8)" : "#374151", lineHeight: 1 }}>{dow}</span>
                </div>
              </div>
              {ROOMS.map((room) => {
                const key = `${d}-${room}`;
                const roomEvs = byDayRoom[key] ?? [];
                return (
                  <div key={room} style={{ flex: 1, minWidth: "140px", padding: "4px", borderRight: "1px solid #3b82f6", display: "flex", flexDirection: "column", gap: "3px" }}>
                    {roomEvs.map((ev) => {
                      const tc = getEventColor(ev);
                      const emoji = TYPE_EMOJI[ev.type] ?? "📋";
                      return (
                        <div key={ev.id} onClick={() => onOpenModal(ev.id)}
                          style={{ background: tc.bg, border: `1px solid ${tc.bd}`, borderRadius: "6px", padding: "5px 7px", cursor: "pointer" }}
                          onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 2px 8px ${tc.bd}44`; }}
                          onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}>
                          <div style={{ fontWeight: 800, color: tc.tx, fontSize: "16px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{emoji} {ev.client ?? "—"}</div>
                          <div style={{ fontSize: "14px", color: tc.tx + "99", marginTop: "3px" }}>👥{ev.guests ?? "—"} {ev.tf ? `· ${ev.tf}` : ""}</div>
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
        <button onClick={() => setWeekOffset(0)} style={{ background: "#f1f5f9", border: "2px solid #e2e8f0", borderRadius: "9px", padding: "9px 16px", cursor: "pointer", fontSize: "15px", fontWeight: 800, color: "#111827" }}>Dzisiaj</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: "8px" }}>
        {weekDays.map((date) => {
          const dateStr = date.toISOString().split("T")[0];
          const day = date.getDate();
          const dow = DPLS[date.getDay()];
          const isToday = date.toDateString() === TODAY.toDateString();
          const dayEvs = events.filter((e) => e.date === dateStr && e.status !== "CANCELLED");

          return (
            <div key={dateStr} style={{ background: isToday ? "#fef2f2" : "white", border: `1px solid ${isToday ? "#fca5a5" : "#3b82f6"}`, borderRadius: "12px", padding: "10px", minHeight: "220px", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px", paddingBottom: "8px", borderBottom: "1px solid #3b82f6" }}>
                <div style={{ width: "44px", height: "44px", borderRadius: "50%", background: isToday ? "#ef4444" : "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: "20px", fontWeight: 900, color: isToday ? "white" : "#0f172a" }}>{day}</span>
                </div>
                <div>
                  <div style={{ fontSize: "17px", fontWeight: 700, color: "#111827" }}>{dow}</div>
                  {dayEvs.length > 0 && <div style={{ fontSize: "16px", fontWeight: 800, color: "#0f172a" }}>{plural(dayEvs.length)}</div>}
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
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "18px" }}>{emoji}</span>
                        <span style={{ fontWeight: 800, fontSize: "17px", color: tc.tx, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{ev.client ?? "—"}</span>
                      </div>
                      <div style={{ display: "flex", gap: "8px", marginTop: "4px", fontSize: "15px", color: tc.tx + "99" }}>
                        <span>🏛 {ev.room?.replace("Sala ", "") ?? "—"}</span>
                        <span>👥{ev.guests ?? "—"}</span>
                        {ev.tf && <span>⏰{ev.tf}</span>}
                      </div>
                    </div>
                  );
                })}
                {dayEvs.length === 0 && (
                  <div style={{ textAlign: "center", padding: "24px", color: "#111827", fontSize: "16px" }}>Brak imprez</div>
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
        <button onClick={() => setOffset(0)} style={{ background: "#f1f5f9", border: "2px solid #e2e8f0", borderRadius: "9px", padding: "9px 16px", cursor: "pointer", fontSize: "15px", fontWeight: 800, color: "#111827" }}>Dzisiaj</button>
        <div style={{ marginLeft: "auto", display: "flex", gap: "12px", flexWrap: "wrap" }}>
          {ROOMS.map((r) => (
            <div key={r} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "16px", fontWeight: 700 }}>
              <span style={{ width: "11px", height: "11px", borderRadius: "3px", background: RC[r], display: "inline-block" }} />
              {r}
            </div>
          ))}
        </div>
      </div>
      <div style={{ background: "white", borderRadius: "13px", border: "1px solid #3b82f6", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", overflowX: "auto" }}>
        <div style={{ width: "100%" }}>
          <div style={{ display: "flex", borderBottom: "2px solid #3b82f6", position: "sticky", top: 0, zIndex: 20, background: "white" }}>
            <div style={{ width: LW, minWidth: LW, padding: "10px 12px", fontSize: "15px", fontWeight: 900, color: "#111827", letterSpacing: "1px", borderRight: "2px solid #3b82f6", background: "white" }}>SALA</div>
            {dayArr.map((d) => (
              <div key={d} style={{ width: CW, minWidth: CW, textAlign: "center", padding: "8px 0 6px", fontSize: "15px", fontWeight: d === todayD ? 900 : 600, color: d === todayD ? "#ef4444" : "#374151", background: d === todayD ? "#fef2f2" : isWknd(year, month, d) ? "#f9fafb" : "white", borderRight: "1px solid #3b82f6" }}>
                <div>{d}</div>
                <div style={{ fontSize: "13px", color: d === todayD ? "#ef4444" : "#374151" }}>{DPLS[new Date(year, month, d).getDay()]}</div>
              </div>
            ))}
          </div>
          {ROOMS.map((room) => {
            const col = getRoomColor(room);
            const rowEvs = monthEvs.filter((e) => {
              const norm = normalizeRoom(e.room);
              return norm.includes(room);
            });
            return (
              <div key={room} style={{ display: "flex", borderBottom: "1px solid #3b82f6", minHeight: RH, position: "relative" }}>
                <div style={{ width: LW, minWidth: LW, padding: "0 12px", display: "flex", alignItems: "center", gap: "8px", borderRight: "2px solid #3b82f6", background: "#fafafa", position: "sticky", left: 0, zIndex: 5 }}>
                  <span style={{ width: "12px", height: "12px", borderRadius: "3px", background: col, flexShrink: 0 }} />
                  <span style={{ fontSize: "16px", fontWeight: 800, color: "#111827" }}>{room}</span>
                </div>
                <div style={{ display: "flex", flex: 1, position: "relative" }}>
                  {dayArr.map((d) => <div key={d} style={{ width: CW, minWidth: CW, borderRight: "1px solid #3b82f6", background: d === todayD ? "rgba(239,68,68,0.05)" : isWknd(year, month, d) ? "#f9fafb" : "transparent" }} />)}
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
                              borderRadius: "3px",
                              border: `1.5px solid ${tc.bd}`,
                              cursor: "pointer",
                              overflow: "hidden",
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
                                fontSize: "14px",
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
                              <div style={{ fontSize: "12px", fontWeight: 700, color: tc.bd, lineHeight: 1 }}>{ev.guests ? ev.guests + " os" : ""}</div>
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
                                      fontSize: "12px",
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
                            borderRadius: "3px",
                            border: "1px solid #e5e5e5",
                            cursor: "pointer",
                            overflow: "hidden",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            zIndex: 4,
                            transition: "transform 0.15s, box-shadow 0.15s",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = "scale(1.05)";
                            e.currentTarget.style.zIndex = "20";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "scale(1)";
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
                          <div style={{ fontSize: count > 9 ? "16px" : "20px", fontWeight: 700, color: "#1e1e1e", lineHeight: 1, marginTop: "2px" }}>{count}</div>
                          <div style={{ fontSize: "10px", fontWeight: 600, color: "#111827", lineHeight: 1, marginTop: "2px" }}>{label}</div>
                        </div>,
                      ];
                    });
                  })()}
                </div>
              </div>
            );
          })}
          <div style={{ display: "flex", background: "#f8fafc", borderTop: "2px solid #3b82f6" }}>
            <div style={{ width: LW, minWidth: LW, padding: "9px 12px", fontSize: "12px", fontWeight: 900, color: "#111827", letterSpacing: "1px", borderRight: "2px solid #3b82f6", position: "sticky", left: 0, zIndex: 5, background: "#f8fafc" }}>RAZEM</div>
            {dayArr.map((d) => {
              const cnt = monthEvs.filter((e) => new Date(e.date).getDate() === d).length;
              return (
                <div key={d} style={{ width: CW, minWidth: CW, display: "flex", alignItems: "center", justifyContent: "center", borderRight: "1px solid #3b82f6", background: d === todayD ? "#fef2f2" : isWknd(year, month, d) ? "#f1f5f9" : "transparent" }}>
                  {cnt > 0 && (
                    <span
                      style={{
                        background: cnt > 10 ? "#ef4444" : cnt > 5 ? "#f59e0b" : "#1e293b",
                        color: "white",
                        borderRadius: "50%",
                        width: "22px",
                        height: "22px",
                        fontSize: "12px",
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
        <div style={{ textAlign: "center", padding: "48px", color: "#111827" }}>
          <div style={{ fontSize: "36px", marginBottom: "8px" }}>📅</div>
          <div style={{ fontSize: "15px", fontWeight: 700 }}>Brak imprez w tym miesiącu</div>
        </div>
      ) : (
        <div style={{ marginTop: "18px" }}>
          <div style={{ fontSize: "13px", fontWeight: 900, color: "#111827", letterSpacing: "2px", marginBottom: "10px" }}>IMPREZY W MIESIĄCU ({monthEvs.length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            {monthEvs.map((ev) => {
              const c = getEventColor(ev);
              const db = dayBadge(daysTo(ev.date));
              return (
                <div key={ev.id} onClick={() => onOpenModal(ev.id)} style={{ background: "white", border: "1px solid #3b82f6", borderLeft: `4px solid ${c.bd}`, borderRadius: "9px", padding: "9px 13px", cursor: "pointer", transition: "box-shadow 0.15s" }} onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 4px 16px ${c.bd}33`; }} onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "9px", flexWrap: "wrap" }}>
                    <div style={{ minWidth: "86px", flexShrink: 0 }}>
                      <div style={{ fontSize: "15px", fontWeight: 800, color: "#0f172a" }}>{fmtDate(ev.date)}</div>
                      <span style={{ background: db.bg, color: db.tx, borderRadius: "4px", padding: "1px 5px", fontSize: "11px", fontWeight: 800 }}>{db.t}</span>
                    </div>
                    <TypeBadge type={ev.type} pop={ev.pop} room={ev.room} />
                    <div style={{ fontWeight: 700, color: "#0f172a", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: "100px", fontSize: "15px" }}>{ev.client ?? "—"}</div>
                    <div style={{ fontSize: "13px", color: "#111827", whiteSpace: "nowrap", flexShrink: 0 }}>🏛 {ev.room ?? "—"}</div>
                    <div style={{ fontSize: "13px", color: "#111827", whiteSpace: "nowrap", flexShrink: 0 }}>👥 {ev.guests ?? "—"}</div>
                    <PhoneBtn phone={ev.phone} client={ev.client} date={ev.date} compact />
                  </div>
                  <div style={{ marginTop: "5px", paddingTop: "5px", borderTop: "1px solid #3b82f6", display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: ev.deposit != null ? (ev.paid ? "#166534" : "#991b1b") : "#374151" }}>{ev.deposit != null ? (ev.paid ? "✅ " + fmtZl(ev.deposit) : "❌ " + fmtZl(ev.deposit)) : "brak zadatku"}</span>
                    {ev.notes && <span style={{ fontSize: "13px", color: "#111827" }}>· 📝 {ev.notes}</span>}
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
  const [specialFilter, setSpecialFilter] = useState<"unpaid" | null>(null);
  const [sort, setSort] = useState("date");
  const [tab, setTab] = useState<"lista" | "kalendarz" | "wolne" | "os" | "sale" | "tydzien" | "gantt" | "kosztorysy" | "pakiety">("lista");
  const [ganttOffset, setGanttOffset] = useState(0);
  const ganttBase = new Date(TODAY.getFullYear(), TODAY.getMonth() + ganttOffset, 1);
  const ganttYear = ganttBase.getFullYear();
  const ganttMonth = ganttBase.getMonth();
  const [expId, setExpId] = useState<string | null>(null);
  const [modalId, setModalId] = useState<string | null>(null);
  const [depId, setDepId] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createDate, setCreateDate] = useState("");
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

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("centrum_prefs") || "{}");
      if (saved.tab && ["lista", "kalendarz", "wolne", "os", "sale", "tydzien", "gantt", "kosztorysy", "pakiety"].includes(saved.tab)) setTab(saved.tab);
      if (saved.fType) setFType(saved.fType);
      if (saved.fStatus) setFStatus(saved.fStatus);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    localStorage.setItem("centrum_prefs", JSON.stringify({ tab, fType, fStatus }));
  }, [tab, fType, fStatus]);

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
      if (specialFilter === "unpaid") {
        return e.deposit != null && !e.paid && d >= 0 && d <= 60;
      }
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
  }, [events, search, fType, fStatus, archive, sort, specialFilter]);

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

  const handleExport = async () => {
    const { exportToExcel } = await import("@/lib/export-excel");
    const data = filtered.map((ev) => ({
      Nr: ev.eventNumber || "",
      Data: fmtDate(ev.date),
      Typ: TL[ev.type] ?? ev.type ?? "Inne",
      Klient: ev.client || "",
      Telefon: ev.phone || "",
      Email: ev.email || "",
      Sala: ev.room || "",
      Goście: ev.guests ?? "",
      Godziny: ev.tf && ev.tt ? `${ev.tf}-${ev.tt}` : "",
      Zadatek: ev.deposit != null ? Number(ev.deposit) : "",
      Opłacony: ev.paid ? "TAK" : ev.deposit ? "NIE" : "",
      Status: (SC[ev.status] ?? {}).label ?? ev.status ?? "",
      Notatka: ev.notes || "",
    }));
    await exportToExcel(data, "Imprezy", `imprezy-${new Date().toISOString().split("T")[0]}.xlsx`);
    showToast("Eksport zakończony");
  };
  const anyFilter = search || fType !== "ALL" || fStatus !== "ACTIVE" || archive || specialFilter;

  if (loading) {
    return (
      <div style={{ fontFamily: "'Source Sans 3','Segoe UI',system-ui,sans-serif", background: "#f0f4f8", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
          <div style={{ width: "40px", height: "40px", border: "4px solid #e2e8f0", borderTopColor: "#3b82f6", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          <div style={{ fontSize: "14px", fontWeight: 600, color: "#111827" }}>Ładowanie imprez…</div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ fontFamily: "'Source Sans 3','Segoe UI',system-ui,sans-serif", background: "#f0f4f8", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", padding: "32px" }}>
          <div style={{ fontSize: "18px", fontWeight: 700, color: "#991b1b", marginBottom: "12px" }}>Błąd pobierania</div>
          <div style={{ fontSize: "14px", color: "#111827", marginBottom: "20px" }}>{error}</div>
          <button onClick={fetchEvents} style={{ background: "#3b82f6", color: "white", border: "none", borderRadius: "9px", padding: "12px 24px", cursor: "pointer", fontSize: "14px", fontWeight: 700 }}>Spróbuj ponownie</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'Source Sans 3','Segoe UI',system-ui,-apple-system,sans-serif", background: "#fff", minHeight: "100vh", color: "#1e1e1e" }}>
      <style>{`@keyframes toastIn{from{opacity:0;transform:translate(-50%,10px)}to{opacity:1;transform:translate(-50%,0)}} *{box-sizing:border-box} input::placeholder{color:#555}`}</style>
      <div style={{ background: "white", padding: "14px 24px", borderBottom: "2px solid #3b82f6", display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap", position: "sticky", top: 0, zIndex: 100 }}>
        <div>
          <div style={{ fontSize: "18px", fontWeight: 700, color: "#1e1e1e" }}>Centrum Sprzedaży</div>
          <div style={{ fontSize: "15px", color: "#111827" }}>Hotel Łabędź · {events.filter((e) => e.status !== "CANCELLED").length} imprez</div>
        </div>
        <div style={{ display: "flex", gap: "12px", fontSize: "15px", color: "#111827" }}>
          {stats.thisWeek > 0 && <span style={{ color: "#e53935", fontWeight: 600 }}>{stats.thisWeek} ten tyg.</span>}
          {stats.unpaid > 0 && <span style={{ color: "#f57c00", fontWeight: 600 }}>{stats.unpaid} nieopł. ({fmtZl(stats.sumUnpaid)})</span>}
          {stats.drafts > 0 && <span>{stats.drafts} szkiców</span>}
        </div>
        <div style={{ display: "flex", marginLeft: "auto", borderBottom: "1px solid #3b82f6" }}>
          {[
            ["lista", "Lista"],
            ["kalendarz", "Kalendarz"],
            ["wolne", "Wolne terminy"],
            ["os", "Oś czasu"],
            ["sale", "Sale×Dni"],
            ["tydzien", "Tydzień"],
            ["gantt", "Gantt"],
            ["kosztorysy", "Kosztorysy"],
            ["pakiety", "Pakiety menu"],
          ].map(([t, l]) => (
            <button key={t} onClick={() => setTab(t as typeof tab)} style={{ padding: "10px 16px", border: "none", background: "transparent", cursor: "pointer", borderBottom: tab === t ? "2px solid #3b82f6" : "2px solid transparent", color: tab === t ? "#1e1e1e" : "#111827", fontSize: "15px", fontWeight: tab === t ? 700 : 500, marginBottom: "-1px" }}>{l}</button>
          ))}
        </div>
        <button onClick={() => { setCreateDate(""); setCreateModalOpen(true); }} style={{ background: "#3b82f6", color: "white", border: "none", borderRadius: "4px", padding: "7px 14px", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>+ Nowa impreza</button>
      </div>
      {weekEvs.length > 0 && (
        <div style={{ borderBottom: "1px solid #3b82f6", padding: "10px 24px", display: "flex", gap: "10px", alignItems: "center", overflowX: "auto", fontSize: "15px" }}>
          <span style={{ color: "#e53935", fontWeight: 700, whiteSpace: "nowrap" }}>Ten tydzień:</span>
          {weekEvs.map((e) => {
            const tc = getEventColor(e);
            return (
              <button key={e.id} onClick={() => { setTab("lista"); setFStatus("ACTIVE"); setFType("ALL"); setExpId(e.id); }} style={{ background: "white", border: `1px solid ${tc.bd}`, borderRadius: "5px", padding: "6px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontSize: "15px", whiteSpace: "nowrap" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "2px", background: tc.bd }} />
                <strong style={{ color: "#1e1e1e" }}>{e.client ?? "—"}</strong>
                <span style={{ color: "#111827" }}>{fmtDate(e.date)}</span>
              </button>
            );
          })}
        </div>
      )}
      {tab === "lista" && (
        <>
          <div style={{ padding: "10px 24px", display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center", borderBottom: "1px solid #3b82f6" }}>
            <button onClick={() => { setSpecialFilter(null); setFType("ALL"); }} style={{ padding: "8px 16px", borderRadius: "5px", border: `1px solid ${fType === "ALL" && !specialFilter ? "#3b82f6" : "#e5e5e5"}`, background: fType === "ALL" && !specialFilter ? "#eff6ff" : "white", color: fType === "ALL" && !specialFilter ? "#1e40af" : "#111827", fontSize: "15px", fontWeight: 600, cursor: "pointer" }}>
              Wszystkie {Object.values(typeCounts).reduce((a, v) => a + v, 0)}
            </button>
            {Object.entries(TL).map(([type, label]) => {
              const cnt = typeCounts[type] ?? 0;
              if (!cnt && fType !== type) return null;
              const c = TC[type];
              const active = fType === type;
              return (
                <button key={type} onClick={() => { setSpecialFilter(null); setFType(active ? "ALL" : type); }} style={{ padding: "8px 16px", borderRadius: "5px", border: `1px solid ${active ? c.bd : "#e5e5e5"}`, background: active ? c.bg : "white", color: active ? c.tx : "#111827", fontSize: "15px", fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  <span style={{ width: "5px", height: "5px", borderRadius: "2px", background: c.bd }} />{label} {cnt}
                </button>
              );
            })}
            <button onClick={() => { setFStatus("ALL"); setFType("ALL"); setSpecialFilter("unpaid"); }} style={{ padding: "8px 16px", borderRadius: "5px", fontSize: "15px", fontWeight: 600, border: "1px solid #c62828", color: "#c62828", background: "white", cursor: "pointer" }}>💰 Do przypomnienia ({stats.unpaid})</button>
            <div style={{ flex: 1 }} />
            <input ref={searchRef} value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape" && !modalId) clearSearch(); }} placeholder="Szukaj..." style={{ width: "200px", padding: "6px 12px", border: "1px solid #3b82f6", borderRadius: "3px", fontSize: "13px", outline: "none" }} />
            {search && <button onClick={clearSearch} type="button" style={{ padding: "6px 10px", marginLeft: "4px", background: "none", border: "1px solid #ddd", borderRadius: "3px", cursor: "pointer", fontSize: "13px" }}>×</button>}
            <div style={{ display: "flex", border: "1px solid #3b82f6", borderRadius: "3px", overflow: "hidden" }}>
              {[["ACTIVE", "Aktywne"], ["CONFIRMED", "Potwierdzone"], ["DRAFT", "Szkice"], ["DONE", "Zakończone"], ["CANCELLED", "Anulowane"], ["ALL", "Wszystkie"]].map(([s, l]) => (
                <button key={s} onClick={() => { setSpecialFilter(null); setFStatus(s); }} type="button" style={{ padding: "5px 10px", border: "none", borderRight: "1px solid #3b82f6", background: fStatus === s ? "#eff6ff" : "white", fontSize: "12px", fontWeight: fStatus === s ? 700 : 500, color: fStatus === s ? "#1e40af" : "#555", cursor: "pointer" }}>{l}{s === "CANCELLED" && stats.cancelled > 0 ? ` (${stats.cancelled})` : ""}</button>
              ))}
            </div>
            <button onClick={handleExport} type="button" style={{ padding: "6px 12px", borderRadius: "3px", fontSize: "13px", fontWeight: 600, border: "1px solid #3b82f6", color: "#1e40af", background: "white", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>📥 Eksport</button>
            <select value={sort} onChange={(e) => setSort(e.target.value)} style={{ padding: "6px 12px", border: "1px solid #ddd", borderRadius: "3px", fontSize: "13px", background: "white", cursor: "pointer", color: "#111827", flexShrink: 0 }}>
              <option value="date">Data ↑</option>
              <option value="client">Klient A–Z</option>
              <option value="type">Typ + Data</option>
            </select>
            <button onClick={() => setArchive(!archive)} type="button" style={{ padding: "6px 12px", border: `1px solid ${archive ? "#3b82f6" : "#ddd"}`, borderRadius: "3px", background: archive ? "#eff6ff" : "white", cursor: "pointer", fontSize: "13px", fontWeight: 600, color: archive ? "#1e40af" : "#4a4a4a", whiteSpace: "nowrap", flexShrink: 0 }}>{archive ? "✓ " : ""}Archiwum</button>
            {anyFilter && <button onClick={() => { setSearch(""); setFType("ALL"); setFStatus("ACTIVE"); setArchive(false); setSpecialFilter(null); }} type="button" style={{ padding: "6px 12px", border: "1px solid #ddd", borderRadius: "3px", background: "white", cursor: "pointer", fontSize: "13px", fontWeight: 600, color: "#c62828", whiteSpace: "nowrap", flexShrink: 0 }}>Wyczyść</button>}
          </div>
          {filtered.length === 0 && search && fType !== "ALL" && (
            <div style={{ margin: "0 20px 6px", background: "#fef3c7", border: "1px solid #fde68a", borderRadius: "9px", padding: "9px 14px", fontSize: "13px", color: "#92400e", fontWeight: 600 }}>
              ⚠️ Filtrujesz po <strong>{TL[fType]}</strong> i szukasz <strong>"{search}"</strong>. <button onClick={() => setFType("ALL")} type="button" style={{ background: "none", border: "none", cursor: "pointer", color: "#1d4ed8", fontWeight: 800, textDecoration: "underline", padding: 0 }}>Usuń filtr typu</button>
            </div>
          )}
          <div style={{ padding: "0 24px 48px" }}>
            {filtered.length > 0 && (
              <div style={{
                display: "grid",
                gridTemplateColumns: "60px 95px minmax(200px,1fr) 150px 70px 90px minmax(100px,1fr) 110px 120px 20px",
                padding: "12px 16px",
                borderBottom: "2px solid #3b82f6",
                fontSize: "14px", fontWeight: 700, color: "#1e40af",
                textTransform: "uppercase", letterSpacing: "0.5px",
                gap: "8px",
                background: "#eff6ff",
              }}>
                <span>Nr</span>
                <span>Data</span>
                <span>Klient</span>
                <span>Sala</span>
                <span>Goście</span>
                <span>Godziny</span>
                <span>Notatka</span>
                <span style={{ textAlign: "right" }}>Zadatek</span>
                <span>Telefon</span>
                <span></span>
              </div>
            )}
            {filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: "70px 20px" }}>
                <div style={{ fontSize: "44px", marginBottom: "10px" }}>🔍</div>
                <div style={{ fontSize: "17px", fontWeight: 800, color: "#111827" }}>Brak wyników</div>
                <div style={{ fontSize: "13px", color: "#111827", marginTop: "6px" }}>{search ? <>Nic nie pasuje do <strong>"{search}"</strong></> : "Spróbuj zmienić filtry"}</div>
                {anyFilter && <button onClick={() => { setSearch(""); setFType("ALL"); setFStatus("ACTIVE"); setArchive(false); setSpecialFilter(null); }} type="button" style={{ marginTop: "14px", background: "#3b82f6", color: "white", border: "none", borderRadius: "9px", padding: "10px 22px", cursor: "pointer", fontSize: "13px", fontWeight: 800 }}>Wyczyść wszystkie filtry</button>}
              </div>
            ) : (
              filtered.map((ev) => (
                <EventCard key={ev.id} ev={ev} expanded={expId === ev.id} onToggle={() => setExpId(expId === ev.id ? null : ev.id)} onOpenModal={openModal} onDepositToggle={handleDepToggle} onDepositOpen={(id) => setDepId(id)} />
              ))
            )}
          </div>
        </>
      )}
      {tab === "wolne" && <FreeDatesView events={filtered} month={ganttMonth} year={ganttYear} onMonthChange={setGanttOffset} onCreateWithDate={(dateStr, room) => { setCreateDate(dateStr); setCreateModalOpen(true); /* room could prefill form */ }} />}
      {tab === "kalendarz" && <CalendarMonthView events={filtered} month={ganttMonth} year={ganttYear} onOpenModal={openModal} onMonthChange={setGanttOffset} onCreateWithDate={(dateStr) => { setCreateDate(dateStr); setCreateModalOpen(true); }} />}
      {tab === "os" && <TimelineView events={filtered} onOpenModal={openModal} />}
      {tab === "sale" && <HeatmapView events={filtered} month={ganttMonth} year={ganttYear} onOpenModal={openModal} onMonthChange={setGanttOffset} />}
      {tab === "tydzien" && <WeekView events={filtered} onOpenModal={openModal} />}
      {tab === "gantt" && <GanttView events={events} onOpenModal={openModal} />}
      {tab === "kosztorysy" && <KosztorysyView />}
      {tab === "pakiety" && <MenuPackagesView />}
      {modalId && <EventDetailModal evId={modalId} events={events} onClose={() => setModalId(null)} handlers={handlers} showToast={showToast} onOpenModal={openModal} onRefresh={fetchEvents} />}
      {createModalOpen && (
        <CreateEventModal
          open={createModalOpen}
          initialDate={createDate}
          onClose={() => setCreateModalOpen(false)}
          onCreated={(created) => {
            const mapped = mapApiToEvent(created);
            setEvents((prev) => [...prev, mapped]);
            showToast(`Impreza "${(created.clientName as string) ?? "Nowa impreza"}" utworzona`);
            setModalId(String(created.id));
          }}
          showToast={showToast}
        />
      )}
      {depId && !modalId && <DepositModal existingAmt={events.find((e) => e.id === depId)?.deposit ?? null} onSave={handleDepSaveFromList} onClose={() => setDepId(null)} />}
      <Toasts toasts={toasts} />
    </div>
  );
}
