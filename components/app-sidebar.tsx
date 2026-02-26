"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  Car,
  Sparkles,
  SprayCan,
  DollarSign,
  BarChart3,
  UserPlus,
  Users,
  Receipt,
  BedDouble,
  Plane,
  Settings,
  LogIn,
  LogOut,
  Menu,
  ClipboardList,
  HelpCircle,
  Globe,
  UtensilsCrossed,
  Palmtree,
  CalendarDays,
  Megaphone,
  Tent,
  ConciergeBell,
  Bike,
  ChevronDown,
  MoreHorizontal,
  BookOpen,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SessionPayload } from "@/lib/auth";
import { logout } from "@/app/actions/auth";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { PropertySwitcher } from "@/components/property-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useI18n } from "@/components/i18n-provider";

const SECTIONS_STATE_KEY = "pms-sidebar-sections";
const ICON_RAIL_WIDTH = "w-12"; // 48px
const _ICON_RAIL_REM = "3rem";

type NavItem = {
  href: string;
  labelKey?: string;
  label?: string;
  icon: LucideIcon;
  permission?: string | string[];
  children?: Array<{ href: string; labelKey?: string; label?: string }>;
};

type NavSection = {
  id: string;
  sectionKey?: string;
  defaultOpen?: boolean;
  items: NavItem[];
};

/** Items shown in the icon rail (desktop only) — first/main item per section. */
type RailItem = {
  href: string;
  labelKey: string;
  icon: LucideIcon;
  permission?: string | string[];
};

const navSections: NavSection[] = [
  {
    id: "dashboard",
    items: [
      { href: "/", labelKey: "sidebar.panel", icon: LayoutDashboard, permission: "module.dashboard" },
    ],
  },
  {
    id: "front-office",
    sectionKey: "sidebar.sectionFrontOffice",
    defaultOpen: true,
    items: [
      {
        href: "/front-office",
        labelKey: "sidebar.reception",
        icon: Briefcase,
        permission: "module.front_office",
      },
      { href: "/check-in", labelKey: "sidebar.checkIn", icon: UserPlus, permission: "module.check_in" },
      { href: "/zmiana", labelKey: "sidebar.shiftHandover", icon: ClipboardList },
      { href: "/ksiega-meldunkowa", labelKey: "sidebar.logbook", icon: BookOpen },
    ],
  },
  {
    id: "sales",
    sectionKey: "sidebar.sectionSales",
    defaultOpen: true,
    items: [
      {
        href: "/kontrahenci",
        labelKey: "sidebar.contractors",
        icon: Users,
        permission: ["module.guests", "module.companies"],
        children: [
          { href: "/kontrahenci?tab=goscie", labelKey: "sidebar.guests" },
          { href: "/kontrahenci?tab=firmy", labelKey: "sidebar.companies" },
        ],
      },
      { href: "/biura-podrozy", labelKey: "sidebar.travelAgents", icon: Plane, permission: "module.travel_agents" },
      { href: "/channel-manager", labelKey: "sidebar.channelManager", icon: Globe, permission: "module.channel_manager" },
    ],
  },
  {
    id: "rooms",
    sectionKey: "sidebar.sectionRooms",
    defaultOpen: true,
    items: [
      { href: "/pokoje", labelKey: "sidebar.rooms", icon: BedDouble, permission: "module.rooms" },
      {
        href: "/cennik",
        labelKey: "sidebar.rates",
        icon: Receipt,
        permission: "module.rates",
        children: [{ href: "/cennik/reguly-pochodne", labelKey: "sidebar.derivedRules" }],
      },
    ],
  },
  {
    id: "housekeeping",
    sectionKey: "sidebar.sectionHousekeeping",
    defaultOpen: true,
    items: [
      {
        href: "/housekeeping",
        labelKey: "sidebar.housekeeping",
        icon: SprayCan,
        permission: "module.housekeeping",
        children: [
          { href: "/housekeeping/minibar", labelKey: "sidebar.minibar" },
          { href: "/meals", labelKey: "sidebar.meals" },
          { href: "/housekeeping/laundry", labelKey: "sidebar.laundry" },
        ],
      },
      { href: "/parking", labelKey: "sidebar.parking", icon: Car, permission: "module.parking" },
    ],
  },
  {
    id: "services",
    sectionKey: "sidebar.sectionServices",
    defaultOpen: false,
    items: [
      { href: "/spa", labelKey: "sidebar.spa", icon: Sparkles, permission: "module.mice" },
      { href: "/gastronomy", labelKey: "sidebar.gastronomy", icon: UtensilsCrossed, permission: "module.mice" },
      { href: "/room-service", labelKey: "sidebar.roomService", icon: ConciergeBell, permission: "module.mice" },
      { href: "/transfers", labelKey: "sidebar.transfers", icon: Car, permission: "module.mice" },
      { href: "/attractions", labelKey: "sidebar.attractions", icon: Palmtree, permission: "module.mice" },
      { href: "/rentals", labelKey: "sidebar.rentals", icon: Bike, permission: "module.mice" },
      { href: "/camping", labelKey: "sidebar.camping", icon: Tent, permission: "module.mice" },
    ],
  },
  {
    id: "mice",
    sectionKey: "sidebar.sectionMice",
    defaultOpen: false,
    items: [
      {
        href: "/mice",
        labelKey: "sidebar.mice",
        icon: CalendarDays,
        permission: "module.mice",
        children: [
          { href: "/mice/eventy", labelKey: "sidebar.miceEvents" },
          { href: "/mice/kosztorysy", labelKey: "sidebar.miceQuotes" },
          { href: "/mice/zlecenia", labelKey: "sidebar.miceOrders" },
        ],
      },
    ],
  },
  {
    id: "finance",
    sectionKey: "sidebar.sectionFinance",
    defaultOpen: true,
    items: [
      {
        href: "/finance",
        labelKey: "sidebar.finance",
        icon: DollarSign,
        permission: "module.finance",
        children: [
          { href: "/finance/przypomnienia", labelKey: "sidebar.paymentReminders" },
          { href: "/finance/windykacja", labelKey: "sidebar.dunning" },
          { href: "/finance/integracje", labelKey: "sidebar.accountingIntegrations" },
        ],
      },
    ],
  },
  {
    id: "reports",
    sectionKey: "sidebar.sectionReports",
    defaultOpen: false,
    items: [
      { href: "/reports", labelKey: "sidebar.reports", icon: BarChart3, permission: "module.reports" },
      { href: "/wydarzenia", labelKey: "sidebar.eventsCalendar", icon: CalendarDays },
      { href: "/ogloszenia", labelKey: "sidebar.announcements", icon: Megaphone },
    ],
  },
  {
    id: "admin",
    sectionKey: "sidebar.sectionAdmin",
    defaultOpen: false,
    items: [
      {
        href: "/ustawienia",
        labelKey: "sidebar.settings",
        icon: Settings,
        permission: "admin.settings",
        children: [
          { href: "/ustawienia/szablony-email", labelKey: "sidebar.emailTemplates" },
          { href: "/ustawienia/dane-hotelu", labelKey: "sidebar.hotelData" },
          { href: "/ustawienia/pietra", labelKey: "sidebar.floors" },
          { href: "/ustawienia/uzytkownicy", labelKey: "sidebar.users" },
          { href: "/ustawienia/numeracja", label: "Numeracja dokumentów" },
          { href: "/ustawienia/asortyment", label: "Asortyment" },
          { href: "/ustawienia/kasa-fiskalna", labelKey: "sidebar.fiscalPrinter" },
          { href: "/ustawienia/2fa", labelKey: "sidebar.twoFa" },
        ],
      },
      { href: "/owner", labelKey: "sidebar.ownerPortal", icon: LogIn, permission: "owner.portal" },
      { href: "/pomoc", labelKey: "sidebar.help", icon: HelpCircle },
    ],
  },
];

const railItems: RailItem[] = [
  { href: "/", labelKey: "sidebar.panel", icon: LayoutDashboard, permission: "module.dashboard" },
  { href: "/front-office", labelKey: "sidebar.reception", icon: Briefcase, permission: "module.front_office" },
  { href: "/check-in", labelKey: "sidebar.checkIn", icon: UserPlus, permission: "module.check_in" },
  { href: "/kontrahenci", labelKey: "sidebar.contractors", icon: Users, permission: ["module.guests", "module.companies"] },
  { href: "/pokoje", labelKey: "sidebar.rooms", icon: BedDouble, permission: "module.rooms" },
  { href: "/housekeeping", labelKey: "sidebar.housekeeping", icon: SprayCan, permission: "module.housekeeping" },
  { href: "/finance", labelKey: "sidebar.finance", icon: DollarSign, permission: "module.finance" },
  { href: "/reports", labelKey: "sidebar.reports", icon: BarChart3, permission: "module.reports" },
  { href: "/ustawienia", labelKey: "sidebar.settings", icon: Settings, permission: "admin.settings" },
];

function filterNavSections(
  sections: NavSection[],
  permissions: string[] | null
): NavSection[] {
  if (permissions === null) return sections;
  if (permissions.length === 0) return sections;
  const set = new Set(permissions);
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (!item.permission) return true;
        if (Array.isArray(item.permission)) {
          return item.permission.some((p) => set.has(p));
        }
        return set.has(item.permission);
      }),
    }))
    .filter((section) => section.items.length > 0);
}

function filterRailItems(items: RailItem[], permissions: string[] | null): RailItem[] {
  if (permissions === null) return items;
  if (permissions.length === 0) return items;
  const set = new Set(permissions);
  return items.filter((item) => {
    if (!item.permission) return true;
    if (Array.isArray(item.permission)) {
      return item.permission.some((p) => set.has(p));
    }
    return set.has(item.permission);
  });
}

function sectionContainsPath(section: NavSection, pathname: string): boolean {
  return section.items.some((item) => {
    if (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)) return true;
    return item.children?.some((c) =>
      c.href.includes("?") ? false : pathname.startsWith(c.href)
    );
  });
}

function loadSectionsState(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(SECTIONS_STATE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveSectionsState(state: Record<string, boolean>) {
  try {
    localStorage.setItem(SECTIONS_STATE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

/* ── Icon Rail (desktop) ─────────────────────────── */

function IconRail({
  pathname,
  permissions,
  onMoreClick,
}: {
  pathname: string;
  permissions: string[] | null;
  onMoreClick: () => void;
}) {
  const { t } = useI18n();
  const items = filterRailItems(railItems, permissions);

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-30 hidden h-screen flex-col kw-sidebar md:flex",
        ICON_RAIL_WIDTH
      )}
    >
      <nav className="flex flex-1 flex-col items-center gap-0.5 overflow-y-auto overflow-x-hidden py-2 scrollbar-thin">
        {items.map(({ href, labelKey, icon: Icon }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
          const label = t(labelKey);
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={cn(
                "kw-sidebar-item flex h-9 w-9 items-center justify-center rounded-lg",
                isActive && "active"
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onMoreClick}
          title={t("sidebar.moreMenu")}
          className="kw-sidebar-item mt-1 flex h-9 w-9 items-center justify-center rounded-lg"
        >
          <MoreHorizontal className="h-[18px] w-[18px]" />
        </button>
      </nav>
      <div className="flex flex-col items-center gap-1 border-t border-white/10 py-2">
        <ThemeToggle variant="sidebar" />
      </div>
    </aside>
  );
}

/* ── Full NavLinks (drawer) ──────────────────────── */

function NavLinks({
  pathname,
  fullUrl,
  onLinkClick,
  permissions,
  session,
}: {
  pathname: string;
  fullUrl: string;
  onLinkClick?: () => void;
  permissions: string[] | null;
  session: SessionPayload | null;
}) {
  const { t } = useI18n();
  const sections = filterNavSections(navSections, permissions);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const stored = loadSectionsState();
    const initial: Record<string, boolean> = {};
    for (const s of navSections) {
      if (!s.sectionKey) continue;
      if (stored[s.id] !== undefined) {
        initial[s.id] = stored[s.id];
      } else {
        initial[s.id] = s.defaultOpen ?? true;
      }
    }
    return initial;
  });

  useEffect(() => {
    for (const section of navSections) {
      if (!section.sectionKey) continue;
      if (sectionContainsPath(section, pathname) && !openSections[section.id]) {
        setOpenSections((prev) => {
          const next = { ...prev, [section.id]: true };
          saveSectionsState(next);
          return next;
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const toggleSection = useCallback((id: string) => {
    setOpenSections((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      saveSectionsState(next);
      return next;
    });
  }, []);

  return (
    <>
      {sections.map((section) => {
        const sectionLabel = section.sectionKey ? t(section.sectionKey) : undefined;
        const isOpen = openSections[section.id] ?? true;
        const hasActiveItem = sectionContainsPath(section, pathname);

        return (
          <div key={section.id}>
            {sectionLabel && (
              <button
                type="button"
                onClick={() => toggleSection(section.id)}
                className={cn(
                  "mt-3 mb-0.5 flex w-full items-center justify-between rounded px-3 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors",
                  hasActiveItem
                    ? "text-muted-foreground"
                    : "text-muted-foreground/50 hover:text-muted-foreground"
                )}
              >
                {sectionLabel}
                <ChevronDown
                  className={cn(
                    "h-3 w-3 transition-transform duration-200",
                    isOpen ? "rotate-0" : "-rotate-90"
                  )}
                />
              </button>
            )}
            {(!sectionLabel || isOpen) && (
              <div className="flex flex-col gap-0.5">
                {section.items.map(({ href, labelKey, label, icon: Icon, children }) => {
                  const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
                  const displayLabel = labelKey ? t(labelKey) : (label ?? href);
                  return (
                    <div key={href}>
                      <Link
                        href={href}
                        onClick={onLinkClick}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                          isActive
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {displayLabel}
                      </Link>
                      {isActive && (session?.role !== "HOUSEKEEPING" || href !== "/housekeeping") && children?.map((child) => {
                        const isChildActive = child.href.includes("?")
                          ? fullUrl === child.href
                          : pathname === child.href;
                        const childLabel = child.labelKey ? t(child.labelKey) : (child.label ?? child.href);
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={onLinkClick}
                            className={cn(
                              "ml-7 flex items-center gap-2 rounded-lg px-3 py-1 text-xs transition-colors",
                              isChildActive
                                ? "bg-primary/90 text-primary-foreground font-medium"
                                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                            )}
                          >
                            {childLabel}
                          </Link>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

/* ── Session Block (drawer footer) ───────────────── */

function SessionBlock({
  session,
  onLinkClick,
}: {
  session: SessionPayload | null;
  onLinkClick?: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="mt-auto border-t border-border pt-2">
      <div className="flex items-center gap-2 px-2 pb-1">
        <LanguageSwitcher />
      </div>
      {session ? (
        <form action={logout}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className="truncate text-xs">{t("sidebar.logout")} ({session.name})</span>
          </button>
        </form>
      ) : (
        <Link
          href="/login"
          onClick={onLinkClick}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <LogIn className="h-4 w-4 shrink-0" />
          {t("sidebar.login")}
        </Link>
      )}
    </div>
  );
}

/* ── Main export ─────────────────────────────────── */

export function AppSidebar({
  session,
  permissions,
}: {
  session: SessionPayload | null;
  permissions: string[] | null;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const search = searchParams.toString();
  const fullUrl = search ? `${pathname}?${search}` : pathname;
  const closeDrawer = () => setDrawerOpen(false);
  const openDrawer = () => setDrawerOpen(true);

  return (
    <>
      {/* Desktop: icon rail + overlay drawer */}
      <IconRail pathname={pathname} permissions={permissions} onMoreClick={openDrawer} />

      {/* Mobile: topbar with hamburger */}
      <header className="fixed left-0 right-0 top-0 z-40 flex h-11 items-center justify-between gap-2 border-b border-border bg-card px-3 md:hidden" style={{ borderBottomColor: 'hsl(var(--kw-header-border))' }}>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Otwórz menu" onClick={openDrawer}>
            <Menu className="h-5 w-5" />
          </Button>
          <img src="/logo.png" alt="Hotel Łabędź" className="h-8 w-auto rounded" />
        </div>
      </header>

      {/* Drawer — shared between mobile hamburger and desktop "more" button */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="flex w-72 flex-col p-0 border-r border-[hsl(var(--kw-header-border))]">
          <SheetHeader className="sr-only">
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto scrollbar-thin px-2 py-3">
            <PropertySwitcher />
            <NavLinks
              pathname={pathname}
              fullUrl={fullUrl}
              onLinkClick={closeDrawer}
              permissions={permissions}
              session={session}
            />
            <SessionBlock session={session} onLinkClick={closeDrawer} />
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}
