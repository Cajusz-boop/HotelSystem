"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  BedDouble,
  Receipt,
  DollarSign,
  BarChart3,
  Car,
  LogIn,
  Search,
  Calendar,
  FileCheck,
  Moon,
  ClipboardList,
  ClipboardCheck,
  UtensilsCrossed,
  Tent,
  Bike,
  BookOpen,
  CreditCard,
  FileText,
  Phone,
  CalendarDays,
  Building2,
  KeyRound,
  Smartphone,
  Contact,
  Globe,
  SlidersHorizontal,
  Printer,
  Share2,
  Wallet,
  Plug,
  Sofa,
  Wine,
  Droplets,
  Users,
  Presentation,
  Calculator,
  Crown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

// --- Kategorie wyłonione z głębokiego skanu (KROK 2) ---
export type CategoryKey =
  | "Panel"
  | "Recepcja"
  | "Finanse"
  | "Raporty"
  | "Gospodarka"
  | "Wellness & SPA"
  | "Gastronomia"
  | "MICE"
  | "Infrastruktura"
  | "Dla Właściciela"
  | "Narzędzia";

export type GuestStage = "rezerwacja" | "pobyt" | "wyjazd";

export type DashboardFeature = {
  id: string;
  href: string;
  label: string;
  description: string;
  category: CategoryKey;
  icon: React.ComponentType<{ className?: string }>;
  guestStage: GuestStage | null;
};

const CATEGORY_STYLES: Record<
  CategoryKey,
  { bg: string; bgIcon: string; text: string; border: string }
> = {
  Panel: {
    bg: "bg-slate-50",
    bgIcon: "bg-slate-100",
    text: "text-slate-700",
    border: "border-slate-200",
  },
  Recepcja: {
    bg: "bg-blue-50",
    bgIcon: "bg-blue-100",
    text: "text-blue-600",
    border: "border-blue-200",
  },
  Finanse: {
    bg: "bg-emerald-50",
    bgIcon: "bg-emerald-100",
    text: "text-emerald-600",
    border: "border-emerald-200",
  },
  Raporty: {
    bg: "bg-amber-50",
    bgIcon: "bg-amber-100",
    text: "text-amber-700",
    border: "border-amber-200",
  },
  Gospodarka: {
    bg: "bg-orange-50",
    bgIcon: "bg-orange-100",
    text: "text-orange-600",
    border: "border-orange-200",
  },
  "Wellness & SPA": {
    bg: "bg-rose-50",
    bgIcon: "bg-rose-100",
    text: "text-rose-600",
    border: "border-rose-200",
  },
  Gastronomia: {
    bg: "bg-lime-50",
    bgIcon: "bg-lime-100",
    text: "text-lime-700",
    border: "border-lime-200",
  },
  MICE: {
    bg: "bg-indigo-50",
    bgIcon: "bg-indigo-100",
    text: "text-indigo-600",
    border: "border-indigo-200",
  },
  Infrastruktura: {
    bg: "bg-cyan-50",
    bgIcon: "bg-cyan-100",
    text: "text-cyan-700",
    border: "border-cyan-200",
  },
  "Dla Właściciela": {
    bg: "bg-violet-50",
    bgIcon: "bg-violet-100",
    text: "text-violet-600",
    border: "border-violet-200",
  },
  Narzędzia: {
    bg: "bg-gray-50",
    bgIcon: "bg-gray-100",
    text: "text-gray-600",
    border: "border-gray-200",
  },
};

// Kolejność wyświetlania grup
const CATEGORY_ORDER: CategoryKey[] = [
  "Panel",
  "Recepcja",
  "Finanse",
  "Raporty",
  "Gospodarka",
  "Wellness & SPA",
  "Gastronomia",
  "MICE",
  "Infrastruktura",
  "Dla Właściciela",
  "Narzędzia",
];

// --- PEŁNA MAPA NAWIGACJI: wszystkie widoki znalezione w kodzie (KROK 1 + 2) ---
export const features: DashboardFeature[] = [
  {
    id: "panel",
    href: "/",
    label: "Centrum Dowodzenia",
    description: "Przegląd dnia, KPI, nawigacja po systemie",
    category: "Panel",
    icon: LayoutDashboard,
    guestStage: null,
  },
  {
    id: "front-office",
    href: "/front-office",
    label: "Recepcja (grafik)",
    description: "Grafik rezerwacji, meldunki, zarządzanie pobytem",
    category: "Recepcja",
    icon: CalendarDays,
    guestStage: "pobyt",
  },
  {
    id: "front-office-kwhotel",
    href: "/front-office/kwhotel",
    label: "Recepcja Kwhotel",
    description: "Widok recepcji dla Kwhotel",
    category: "Recepcja",
    icon: Building2,
    guestStage: "pobyt",
  },
  {
    id: "check-in",
    href: "/check-in",
    label: "Meldunek",
    description: "Formularz meldunkowy (MRZ, Parse & Forget)",
    category: "Recepcja",
    icon: KeyRound,
    guestStage: "pobyt",
  },
  {
    id: "meldunek-online",
    href: "/check-in",
    label: "Meldunek online (gość)",
    description: "Link do formularza meldunku online wysyłany gościom",
    category: "Recepcja",
    icon: Smartphone,
    guestStage: "pobyt",
  },
  {
    id: "karta-goscia",
    href: "/front-office",
    label: "Karta gościa",
    description: "Otwórz rezerwację na grafiku recepcji, aby wejść w kartę gościa",
    category: "Recepcja",
    icon: Contact,
    guestStage: "pobyt",
  },
  {
    id: "pokoje",
    href: "/pokoje",
    label: "Pokoje",
    description: "Lista pokoi, statusy, zarządzanie",
    category: "Recepcja",
    icon: BedDouble,
    guestStage: "pobyt",
  },
  {
    id: "booking",
    href: "/booking",
    label: "Silnik rezerwacji",
    description: "Rezerwacja online, sprawdzenie dostępności",
    category: "Recepcja",
    icon: Globe,
    guestStage: "rezerwacja",
  },
  {
    id: "cennik",
    href: "/cennik",
    label: "Cennik",
    description: "Ceny pokoi, plany cenowe, kody cenowe",
    category: "Recepcja",
    icon: Receipt,
    guestStage: "rezerwacja",
  },
  {
    id: "cennik-reguly",
    href: "/cennik/reguly-pochodne",
    label: "Reguły pochodne",
    description: "Reguły cen pochodnych",
    category: "Recepcja",
    icon: SlidersHorizontal,
    guestStage: "rezerwacja",
  },
  {
    id: "cennik-wydruk",
    href: "/cennik/wydruk",
    label: "Wydruk cennika",
    description: "Wydruk cennika (z datą lub ceny bazowe)",
    category: "Recepcja",
    icon: Printer,
    guestStage: "rezerwacja",
  },
  {
    id: "channel-manager",
    href: "/channel-manager",
    label: "Channel Manager",
    description: "Synchronizacja z kanałami sprzedaży",
    category: "Recepcja",
    icon: Share2,
    guestStage: "rezerwacja",
  },
  {
    id: "finance",
    href: "/finance",
    label: "Finanse",
    description: "Kasa, night audit, transakcje, JPK, faktury",
    category: "Finanse",
    icon: Wallet,
    guestStage: "wyjazd",
  },
  {
    id: "finance-integracje",
    href: "/finance/integracje",
    label: "Integracje księgowe",
    description: "Integracje z systemami księgowymi",
    category: "Finanse",
    icon: Plug,
    guestStage: "wyjazd",
  },
  {
    id: "platnosc-online",
    href: "/finance",
    label: "Płatność online (gość)",
    description: "Link do płatności dla gościa generowany w module Finanse",
    category: "Finanse",
    icon: CreditCard,
    guestStage: "wyjazd",
  },
  {
    id: "reports",
    href: "/reports",
    label: "Raporty",
    description: "Raport dobowy, KPI, raport GUS, raport policyjny",
    category: "Raporty",
    icon: BarChart3,
    guestStage: "wyjazd",
  },
  {
    id: "housekeeping",
    href: "/housekeeping",
    label: "Gospodarka pokoi",
    description: "Statusy sprzątania, OOO, minibar",
    category: "Gospodarka",
    icon: Sofa,
    guestStage: "pobyt",
  },
  {
    id: "housekeeping-minibar",
    href: "/housekeeping/minibar",
    label: "Minibar",
    description: "Zarządzanie minibarem",
    category: "Gospodarka",
    icon: Wine,
    guestStage: "pobyt",
  },
  {
    id: "spa",
    href: "/spa",
    label: "SPA",
    description: "Zabiegi, sauna, basen – moduł SPA",
    category: "Wellness & SPA",
    icon: Droplets,
    guestStage: "pobyt",
  },
  {
    id: "gastronomy",
    href: "/gastronomy",
    label: "Gastronomia",
    description: "Stoliki, menu, zamówienia – moduł gastronomiczny",
    category: "Gastronomia",
    icon: UtensilsCrossed,
    guestStage: "pobyt",
  },
  {
    id: "mice",
    href: "/mice",
    label: "MICE",
    description: "Konferencje, eventy, sale",
    category: "MICE",
    icon: Presentation,
    guestStage: "pobyt",
  },
  {
    id: "mice-kosztorysy",
    href: "/mice/kosztorysy",
    label: "Kosztorysy",
    description: "Lista kosztorysów MICE",
    category: "MICE",
    icon: Calculator,
    guestStage: "rezerwacja",
  },
  {
    id: "mice-zlecenia",
    href: "/mice/zlecenia",
    label: "Zlecenia realizacji",
    description: "Zlecenia realizacji MICE",
    category: "MICE",
    icon: ClipboardCheck,
    guestStage: "pobyt",
  },
  {
    id: "parking",
    href: "/parking",
    label: "Parking",
    description: "Parking, szlaban, miejsca postojowe",
    category: "Infrastruktura",
    icon: Car,
    guestStage: "pobyt",
  },
  {
    id: "rentals",
    href: "/rentals",
    label: "Wypożyczalnia",
    description: "Wypożyczalnia sprzętu",
    category: "Infrastruktura",
    icon: Bike,
    guestStage: "pobyt",
  },
  {
    id: "camping",
    href: "/camping",
    label: "Camping",
    description: "Obsługa pola namiotowego / kempingu",
    category: "Infrastruktura",
    icon: Tent,
    guestStage: "pobyt",
  },
  {
    id: "owner",
    href: "/owner",
    label: "Portal Właściciela",
    description: "Obłożenie, przychody, rozliczenia dla właściciela",
    category: "Dla Właściciela",
    icon: Crown,
    guestStage: null,
  },
  {
    id: "ustawienia-centrala",
    href: "/ustawienia/centrala",
    label: "Centrala telefoniczna",
    description: "Integracja z centralą (Asterisk, 3CX)",
    category: "Narzędzia",
    icon: Phone,
    guestStage: null,
  },
  {
    id: "login",
    href: "/login",
    label: "Logowanie",
    description: "Zaloguj się do systemu",
    category: "Narzędzia",
    icon: LogIn,
    guestStage: null,
  },
];

const GUEST_MAP_STAGES: { key: GuestStage | "all"; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "all", label: "Wszystkie", icon: LayoutDashboard },
  { key: "rezerwacja", label: "Rezerwacja", icon: Calendar },
  { key: "pobyt", label: "Pobyt", icon: Moon },
  { key: "wyjazd", label: "Wyjazd", icon: FileCheck },
];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function Dashboard() {
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<GuestStage | "all">("all");

  const filtered = useMemo(() => {
    const q = normalize(search).trim();
    return features.filter((item) => {
      const matchSearch =
        !q ||
        normalize(item.label).includes(q) ||
        normalize(item.description).includes(q);
      const matchStage =
        stageFilter === "all" ||
        item.guestStage === null ||
        item.guestStage === stageFilter;
      return matchSearch && matchStage;
    });
  }, [search, stageFilter]);

  const byCategory = useMemo(() => {
    const map = new Map<CategoryKey, DashboardFeature[]>();
    for (const cat of CATEGORY_ORDER) {
      map.set(cat, []);
    }
    for (const f of filtered) {
      const list = map.get(f.category) ?? [];
      list.push(f);
      map.set(f.category, list);
    }
    return CATEGORY_ORDER.map((cat) => ({ category: cat, items: map.get(cat) ?? [] })).filter(
      (g) => g.items.length > 0
    );
  }, [filtered]);

  return (
    <div className="flex h-[calc(100vh-8rem)] max-h-[720px] flex-col gap-2">
      {/* Pasek: wyszukiwarka + mapa gościa w jednej linii */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 py-1">
        <div className="relative w-64 min-w-0">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Szukaj..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-7 text-sm"
            aria-label="Szukaj"
          />
        </div>
        <div className="flex items-center gap-1 rounded-md border border-border bg-card px-1 py-0.5">
          {GUEST_MAP_STAGES.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setStageFilter(key)}
              className={cn(
                "flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors",
                stageFilter === key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-3 w-3 shrink-0" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Działy w 2 lub 3 kolumnach – jedna kolumna = jeden dział (kategoria) */}
      <div
        className="min-h-0 flex-1 overflow-auto"
        style={{
          columnCount: byCategory.length <= 4 ? 2 : 3,
          columnGap: "1rem",
        }}
      >
        {filtered.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            Brak wyników. Zmień wyszukiwanie lub etap.
          </p>
        ) : (
          byCategory.map(({ category, items }) => {
            const style = CATEGORY_STYLES[category];
            return (
              <section
                key={category}
                className="break-inside-avoid mb-4 flex flex-col gap-1.5"
              >
                <h2 className={cn("text-xs font-semibold uppercase tracking-wider px-0.5", style.text)}>
                  — {category} —
                </h2>
                <div
                  className="grid gap-1.5"
                  style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}
                >
                  {items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        title={`${item.label} – ${item.description}`}
                        className={cn(
                          "group flex flex-col rounded-lg border-2 p-1.5 transition-all duration-150",
                          "hover:shadow hover:-translate-y-0.5 focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                          "min-w-0 aspect-square w-full",
                          style.bg,
                          style.border
                        )}
                      >
                        <div
                          className={cn(
                            "flex flex-1 min-h-0 w-full items-center justify-center rounded-md",
                            style.bgIcon,
                            style.text
                          )}
                        >
                          <Icon className="h-6 w-6 shrink-0" />
                        </div>
                        <span
                          className={cn(
                            "mt-0.5 truncate text-center text-xs font-semibold leading-tight",
                            style.text
                          )}
                        >
                          {item.label}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
