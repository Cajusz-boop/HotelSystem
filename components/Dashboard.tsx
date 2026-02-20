"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  BedDouble,
  Receipt,
  BarChart3,
  Car,
  LogIn,
  Search,
  Calendar,
  FileCheck,
  Moon,
  ClipboardCheck,
  UtensilsCrossed,
  Tent,
  Bike,
  Phone,
  CalendarDays,
  KeyRound,
  Globe,
  SlidersHorizontal,
  Printer,
  Share2,
  Wallet,
  Plug,
  Sofa,
  Wine,
  Droplets,
  Presentation,
  Calculator,
  Crown,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export type CategoryKey =
  | "Recepcja"
  | "Finanse"
  | "Raporty"
  | "Housekeeping"
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
  { bg: string; bgIcon: string; text: string; border: string; headerBg: string }
> = {
  Recepcja: {
    bg: "bg-blue-50/60 dark:bg-blue-950/20",
    bgIcon: "bg-blue-100 dark:bg-blue-900/40",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-200 dark:border-blue-800",
    headerBg: "bg-blue-100/80 dark:bg-blue-900/30",
  },
  Finanse: {
    bg: "bg-emerald-50/60 dark:bg-emerald-950/20",
    bgIcon: "bg-emerald-100 dark:bg-emerald-900/40",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-200 dark:border-emerald-800",
    headerBg: "bg-emerald-100/80 dark:bg-emerald-900/30",
  },
  Raporty: {
    bg: "bg-amber-50/60 dark:bg-amber-950/20",
    bgIcon: "bg-amber-100 dark:bg-amber-900/40",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-200 dark:border-amber-800",
    headerBg: "bg-amber-100/80 dark:bg-amber-900/30",
  },
  Housekeeping: {
    bg: "bg-orange-50/60 dark:bg-orange-950/20",
    bgIcon: "bg-orange-100 dark:bg-orange-900/40",
    text: "text-orange-700 dark:text-orange-300",
    border: "border-orange-200 dark:border-orange-800",
    headerBg: "bg-orange-100/80 dark:bg-orange-900/30",
  },
  "Wellness & SPA": {
    bg: "bg-rose-50/60 dark:bg-rose-950/20",
    bgIcon: "bg-rose-100 dark:bg-rose-900/40",
    text: "text-rose-700 dark:text-rose-300",
    border: "border-rose-200 dark:border-rose-800",
    headerBg: "bg-rose-100/80 dark:bg-rose-900/30",
  },
  Gastronomia: {
    bg: "bg-lime-50/60 dark:bg-lime-950/20",
    bgIcon: "bg-lime-100 dark:bg-lime-900/40",
    text: "text-lime-700 dark:text-lime-300",
    border: "border-lime-200 dark:border-lime-800",
    headerBg: "bg-lime-100/80 dark:bg-lime-900/30",
  },
  MICE: {
    bg: "bg-indigo-50/60 dark:bg-indigo-950/20",
    bgIcon: "bg-indigo-100 dark:bg-indigo-900/40",
    text: "text-indigo-700 dark:text-indigo-300",
    border: "border-indigo-200 dark:border-indigo-800",
    headerBg: "bg-indigo-100/80 dark:bg-indigo-900/30",
  },
  Infrastruktura: {
    bg: "bg-cyan-50/60 dark:bg-cyan-950/20",
    bgIcon: "bg-cyan-100 dark:bg-cyan-900/40",
    text: "text-cyan-700 dark:text-cyan-300",
    border: "border-cyan-200 dark:border-cyan-800",
    headerBg: "bg-cyan-100/80 dark:bg-cyan-900/30",
  },
  "Dla Właściciela": {
    bg: "bg-violet-50/60 dark:bg-violet-950/20",
    bgIcon: "bg-violet-100 dark:bg-violet-900/40",
    text: "text-violet-700 dark:text-violet-300",
    border: "border-violet-200 dark:border-violet-800",
    headerBg: "bg-violet-100/80 dark:bg-violet-900/30",
  },
  Narzędzia: {
    bg: "bg-gray-50/60 dark:bg-gray-950/20",
    bgIcon: "bg-gray-100 dark:bg-gray-900/40",
    text: "text-gray-700 dark:text-gray-300",
    border: "border-gray-200 dark:border-gray-800",
    headerBg: "bg-gray-100/80 dark:bg-gray-900/30",
  },
};

const CATEGORY_ORDER: CategoryKey[] = [
  "Recepcja",
  "Finanse",
  "Raporty",
  "Housekeeping",
  "Wellness & SPA",
  "Gastronomia",
  "MICE",
  "Infrastruktura",
  "Dla Właściciela",
  "Narzędzia",
];

const CATEGORY_DESCRIPTIONS: Record<CategoryKey, string> = {
  Recepcja: "Grafik, rezerwacje, pokoje, cennik, channel manager",
  Finanse: "Kasa, faktury, night audit, integracje księgowe",
  Raporty: "Raport dobowy, KPI, GUS, raport policyjny",
  Housekeeping: "Sprzątanie, minibar, statusy pokoi",
  "Wellness & SPA": "Zabiegi, sauna, basen",
  Gastronomia: "Stoliki, menu, zamówienia restauracyjne",
  MICE: "Konferencje, eventy, kosztorysy, zlecenia",
  Infrastruktura: "Parking, wypożyczalnia, camping",
  "Dla Właściciela": "Obłożenie, przychody, rozliczenia",
  Narzędzia: "Centrala telefoniczna, logowanie",
};

export const features: DashboardFeature[] = [
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
    id: "check-in",
    href: "/check-in",
    label: "Meldunek",
    description: "Formularz meldunkowy z MRZ — dostępny też jako link online dla gościa",
    category: "Recepcja",
    icon: KeyRound,
    guestStage: "pobyt",
  },
  {
    id: "pokoje",
    href: "/pokoje",
    label: "Pokoje",
    description: "Lista pokoi, statusy, przypisania, zarządzanie",
    category: "Recepcja",
    icon: BedDouble,
    guestStage: "pobyt",
  },
  {
    id: "booking",
    href: "/booking",
    label: "Silnik rezerwacji",
    description: "Rezerwacja online, sprawdzenie dostępności terminów",
    category: "Recepcja",
    icon: Globe,
    guestStage: "rezerwacja",
  },
  {
    id: "cennik",
    href: "/cennik",
    label: "Cennik",
    description: "Ceny pokoi, plany cenowe, kody rabatowe",
    category: "Recepcja",
    icon: Receipt,
    guestStage: "rezerwacja",
  },
  {
    id: "cennik-reguly",
    href: "/cennik/reguly-pochodne",
    label: "Reguły pochodne",
    description: "Automatyczne reguły cen zależnych od cennika bazowego",
    category: "Recepcja",
    icon: SlidersHorizontal,
    guestStage: "rezerwacja",
  },
  {
    id: "cennik-wydruk",
    href: "/cennik/wydruk",
    label: "Wydruk cennika",
    description: "Generowanie PDF cennika z datą lub cenami bazowymi",
    category: "Recepcja",
    icon: Printer,
    guestStage: "rezerwacja",
  },
  {
    id: "channel-manager",
    href: "/channel-manager",
    label: "Channel Manager",
    description: "Synchronizacja dostępności z Booking.com, Expedia i innymi kanałami",
    category: "Recepcja",
    icon: Share2,
    guestStage: "rezerwacja",
  },
  {
    id: "finance",
    href: "/finance",
    label: "Finanse",
    description: "Kasa, night audit, transakcje, JPK, faktury, płatności online",
    category: "Finanse",
    icon: Wallet,
    guestStage: "wyjazd",
  },
  {
    id: "finance-integracje",
    href: "/finance/integracje",
    label: "Integracje księgowe",
    description: "Eksport danych do systemów księgowych (Optima, Symfonia i inne)",
    category: "Finanse",
    icon: Plug,
    guestStage: "wyjazd",
  },
  {
    id: "reports",
    href: "/reports",
    label: "Raporty",
    description: "Raport dobowy, KPI, raport GUS, raport policyjny, statystyki",
    category: "Raporty",
    icon: BarChart3,
    guestStage: "wyjazd",
  },
  {
    id: "housekeeping",
    href: "/housekeeping",
    label: "Housekeeping",
    description: "Statusy sprzątania, lista zadań dla pokojowych, pokoje OOO",
    category: "Housekeeping",
    icon: Sofa,
    guestStage: "pobyt",
  },
  {
    id: "housekeeping-minibar",
    href: "/housekeeping/minibar",
    label: "Minibar",
    description: "Zarządzanie minibarami w pokojach, rozliczenia",
    category: "Housekeeping",
    icon: Wine,
    guestStage: "pobyt",
  },
  {
    id: "spa",
    href: "/spa",
    label: "SPA",
    description: "Zabiegi, sauna, basen — rezerwacja i grafik zabiegów",
    category: "Wellness & SPA",
    icon: Droplets,
    guestStage: "pobyt",
  },
  {
    id: "gastronomy",
    href: "/gastronomy",
    label: "Gastronomia",
    description: "Stoliki, menu, zamówienia — obciążenia na pokój z restauracji",
    category: "Gastronomia",
    icon: UtensilsCrossed,
    guestStage: "pobyt",
  },
  {
    id: "mice",
    href: "/mice",
    label: "MICE",
    description: "Konferencje, eventy, rezerwacja sal konferencyjnych",
    category: "MICE",
    icon: Presentation,
    guestStage: "pobyt",
  },
  {
    id: "mice-kosztorysy",
    href: "/mice/kosztorysy",
    label: "Kosztorysy",
    description: "Wyceny i kosztorysy eventów MICE",
    category: "MICE",
    icon: Calculator,
    guestStage: "rezerwacja",
  },
  {
    id: "mice-zlecenia",
    href: "/mice/zlecenia",
    label: "Zlecenia realizacji",
    description: "Zlecenia realizacji eventów — zadania dla obsługi",
    category: "MICE",
    icon: ClipboardCheck,
    guestStage: "pobyt",
  },
  {
    id: "parking",
    href: "/parking",
    label: "Parking",
    description: "Miejsca postojowe, szlaban, przypisanie do rezerwacji",
    category: "Infrastruktura",
    icon: Car,
    guestStage: "pobyt",
  },
  {
    id: "rentals",
    href: "/rentals",
    label: "Wypożyczalnia",
    description: "Wypożyczalnia sprzętu (rowery, kajaki, narty i inne)",
    category: "Infrastruktura",
    icon: Bike,
    guestStage: "pobyt",
  },
  {
    id: "camping",
    href: "/camping",
    label: "Camping",
    description: "Obsługa pola namiotowego, kempingu i domków",
    category: "Infrastruktura",
    icon: Tent,
    guestStage: "pobyt",
  },
  {
    id: "owner",
    href: "/owner",
    label: "Portal Właściciela",
    description: "Obłożenie, przychody, rozliczenia — widok dla właściciela obiektu",
    category: "Dla Właściciela",
    icon: Crown,
    guestStage: null,
  },
  {
    id: "ustawienia-centrala",
    href: "/ustawienia/centrala",
    label: "Centrala telefoniczna",
    description: "Integracja z centralą telefoniczną (Asterisk, 3CX)",
    category: "Narzędzia",
    icon: Phone,
    guestStage: null,
  },
  {
    id: "login",
    href: "/login",
    label: "Logowanie",
    description: "Zmień użytkownika lub zaloguj się ponownie",
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
    .replace(/[\u0300-\u036f]/g, "");
}

export function Dashboard() {
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<GuestStage | "all">("all");
  const [collapsedCategories, setCollapsedCategories] = useState<Set<CategoryKey>>(new Set());

  const toggleCategory = (cat: CategoryKey) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  const filtered = useMemo(() => {
    const q = normalize(search).trim();
    return features.filter((item) => {
      const matchSearch =
        !q ||
        normalize(item.label).includes(q) ||
        normalize(item.description).includes(q) ||
        normalize(item.category).includes(q);
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

  const isSearching = search.trim().length > 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Search bar + guest stage filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-72 min-w-0">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Szukaj funkcji..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9 text-sm"
            aria-label="Szukaj funkcji systemu"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card px-1 py-0.5">
          {GUEST_MAP_STAGES.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setStageFilter(key)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                stageFilter === key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              {label}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "funkcja" : "funkcji"}
        </span>
      </div>

      {/* Feature sections */}
      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Brak wyników. Zmień wyszukiwanie lub filtr etapu.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {byCategory.map(({ category, items }) => {
            const style = CATEGORY_STYLES[category];
            const isCollapsed = collapsedCategories.has(category) && !isSearching;
            return (
              <section key={category} className={cn("overflow-hidden rounded-xl border", style.border)}>
                {/* Category header */}
                <button
                  type="button"
                  onClick={() => toggleCategory(category)}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:opacity-80",
                    style.headerBg
                  )}
                >
                  {isCollapsed ? (
                    <ChevronRight className={cn("h-4 w-4 shrink-0", style.text)} />
                  ) : (
                    <ChevronDown className={cn("h-4 w-4 shrink-0", style.text)} />
                  )}
                  <div className="min-w-0 flex-1">
                    <h2 className={cn("text-sm font-bold uppercase tracking-wide", style.text)}>
                      {category}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {CATEGORY_DESCRIPTIONS[category]}
                    </p>
                  </div>
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", style.bgIcon, style.text)}>
                    {items.length}
                  </span>
                </button>

                {/* Feature cards grid */}
                {!isCollapsed && (
                  <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3">
                    {items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.id}
                          href={item.href}
                          className={cn(
                            "group relative flex items-start gap-3 rounded-lg border p-3 transition-shadow duration-150",
                            "hover:shadow-md",
                            "focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                            style.bg,
                            style.border
                          )}
                        >
                          <div
                            className={cn(
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                              style.bgIcon,
                              style.text
                            )}
                          >
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={cn("text-sm font-semibold leading-tight", style.text)}>
                              {item.label}
                            </p>
                            <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                              {item.description}
                            </p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
