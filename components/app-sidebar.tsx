"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  Building2,
  Car,
  Sparkles,
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SessionPayload } from "@/lib/auth";
import { logout } from "@/app/actions/auth";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { PropertySwitcher } from "@/components/property-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useI18n } from "@/components/i18n-provider";

const navItems: Array<{
  href: string;
  labelKey?: string;
  label?: string;
  icon: typeof LayoutDashboard;
  permission?: string;
  children?: Array<{ href: string; labelKey?: string; label?: string }>;
}> = [
  { href: "/", labelKey: "sidebar.panel", icon: LayoutDashboard, permission: "module.dashboard" },
  {
    href: "/front-office",
    labelKey: "sidebar.reception",
    icon: Briefcase,
    permission: "module.front_office",
    children: [{ href: "/front-office/kwhotel", labelKey: "sidebar.receptionKwhotel" }],
  },
  { href: "/check-in", labelKey: "sidebar.checkIn", icon: UserPlus, permission: "module.check_in" },
  { href: "/zmiana", labelKey: "sidebar.shiftHandover", icon: ClipboardList },
  { href: "/guests", labelKey: "sidebar.guests", icon: Users, permission: "module.guests" },
  { href: "/firmy", labelKey: "sidebar.companies", icon: Building2, permission: "module.companies" },
  { href: "/biura-podrozy", labelKey: "sidebar.travelAgents", icon: Plane, permission: "module.travel_agents" },
  { href: "/pokoje", labelKey: "sidebar.rooms", icon: BedDouble, permission: "module.rooms" },
  {
    href: "/cennik",
    labelKey: "sidebar.rates",
    icon: Receipt,
    permission: "module.rates",
    children: [{ href: "/cennik/reguly-pochodne", labelKey: "sidebar.derivedRules" }],
  },
  {
    href: "/housekeeping",
    labelKey: "sidebar.housekeeping",
    icon: Sparkles,
    permission: "module.housekeeping",
    children: [
      { href: "/housekeeping/minibar", labelKey: "sidebar.minibar" },
      { href: "/meals", labelKey: "sidebar.meals" },
      { href: "/housekeeping/laundry", labelKey: "sidebar.laundry" },
    ],
  },
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
  { href: "/reports", labelKey: "sidebar.reports", icon: BarChart3, permission: "module.reports" },
  { href: "/pomoc", labelKey: "sidebar.help", icon: HelpCircle },
  { href: "/channel-manager", labelKey: "sidebar.channelManager", icon: Briefcase, permission: "module.channel_manager" },
  { href: "/parking", labelKey: "sidebar.parking", icon: Car, permission: "module.parking" },
  {
    href: "/mice",
    labelKey: "sidebar.mice",
    icon: Briefcase,
    permission: "module.mice",
    children: [
      { href: "/mice/eventy", labelKey: "sidebar.miceEvents" },
      { href: "/mice/kosztorysy", labelKey: "sidebar.miceQuotes" },
      { href: "/mice/zlecenia", labelKey: "sidebar.miceOrders" },
      { href: "/spa", labelKey: "sidebar.spa" },
      { href: "/gastronomy", labelKey: "sidebar.gastronomy" },
      { href: "/room-service", labelKey: "sidebar.roomService" },
      { href: "/transfers", labelKey: "sidebar.transfers" },
      { href: "/attractions", labelKey: "sidebar.attractions" },
      { href: "/rentals", labelKey: "sidebar.rentals" },
      { href: "/camping", labelKey: "sidebar.camping" },
    ],
  },
  { href: "/owner", labelKey: "sidebar.ownerPortal", icon: LogIn, permission: "owner.portal" },
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
      { href: "/ustawienia/2fa", labelKey: "sidebar.twoFa" },
      { href: "/wydarzenia", labelKey: "sidebar.eventsCalendar" },
      { href: "/ogloszenia", labelKey: "sidebar.announcements" },
    ],
  },
];

function filterNavItems(
  items: typeof navItems,
  permissions: string[] | null
): typeof navItems {
  if (permissions === null) return items;
  if (permissions.length === 0) return items;
  const set = new Set(permissions);
  return items.filter((item) => !item.permission || set.has(item.permission));
}

function NavLinks({
  pathname,
  onLinkClick,
  permissions,
}: {
  pathname: string;
  onLinkClick?: () => void;
  permissions: string[] | null;
}) {
  const { t } = useI18n();
  const items = filterNavItems(navItems, permissions);
  return (
    <>
      {items.map(({ href, labelKey, label, icon: Icon, children }) => {
        const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
        const displayLabel = labelKey ? t(labelKey) : (label ?? href);
        return (
          <div key={href}>
            <Link
              href={href}
              onClick={onLinkClick}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {displayLabel}
            </Link>
            {children?.map((child) => {
              const isChildActive = pathname === child.href;
              const childLabel = child.labelKey ? t(child.labelKey) : (child.label ?? child.href);
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  onClick={onLinkClick}
                  className={cn(
                    "ml-6 flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors",
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
    </>
  );
}

function SessionBlock({
  session,
  onLinkClick,
}: {
  session: SessionPayload | null;
  onLinkClick?: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="mt-auto border-t border-border pt-3">
      <div className="flex items-center gap-2 px-2 pb-2">
        <ThemeToggle />
        <span className="text-xs text-muted-foreground">{t("sidebar.theme")}</span>
        <LanguageSwitcher />
      </div>
      {session ? (
        <form action={logout}>
          <button
            type="submit"
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {t("sidebar.logout")} ({session.name})
          </button>
        </form>
      ) : (
        <Link
          href="/login"
          onClick={onLinkClick}
          className={cn(
            "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          )}
        >
          <LogIn className="h-5 w-5 shrink-0" />
          {t("sidebar.login")}
        </Link>
      )}
    </div>
  );
}

export function AppSidebar({
  session,
  permissions,
}: {
  session: SessionPayload | null;
  permissions: string[] | null;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobile = () => setMobileOpen(false);

  return (
    <>
      {/* Desktop: stały sidebar (od md w górę) */}
      <aside className="fixed left-0 top-0 z-30 hidden h-screen w-52 flex-col border-r border-border bg-card md:flex">
        <nav className="flex flex-col gap-1 p-3">
          <PropertySwitcher />
          <NavLinks pathname={pathname} permissions={permissions} />
          <SessionBlock session={session} />
        </nav>
      </aside>

      {/* Mobile: pasek z hamburgerem + Sheet z menu */}
      <header className="fixed left-0 right-0 top-0 z-40 flex h-14 items-center justify-between gap-2 border-b border-border bg-card px-3 md:hidden">
        <div className="flex items-center gap-2">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Otwórz menu">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex w-64 flex-col p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Menu</SheetTitle>
            </SheetHeader>
            <nav className="flex flex-1 flex-col gap-1 p-3">
              <PropertySwitcher />
              <NavLinks pathname={pathname} onLinkClick={closeMobile} permissions={permissions} />
              <SessionBlock session={session} onLinkClick={closeMobile} />
            </nav>
          </SheetContent>
        </Sheet>
        <span className="text-sm font-semibold">Hotel PMS</span>
        </div>
        <ThemeToggle />
      </header>
    </>
  );
}
