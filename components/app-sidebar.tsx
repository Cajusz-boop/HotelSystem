"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Briefcase,
  Sparkles,
  DollarSign,
  BarChart3,
  UserPlus,
  Receipt,
  BedDouble,
  LogIn,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SessionPayload } from "@/lib/auth";
import { logout } from "@/app/actions/auth";

const navItems = [
  { href: "/", label: "Panel", icon: LayoutDashboard },
  { href: "/front-office", label: "Recepcja", icon: Briefcase },
  { href: "/check-in", label: "Meldunek", icon: UserPlus },
  { href: "/pokoje", label: "Pokoje", icon: BedDouble },
  { href: "/cennik", label: "Cennik", icon: Receipt },
  { href: "/housekeeping", label: "Gospodarka", icon: Sparkles },
  { href: "/finance", label: "Finanse", icon: DollarSign },
  { href: "/reports", label: "Raporty", icon: BarChart3 },
];

export function AppSidebar({ session }: { session: SessionPayload | null }) {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-30 flex h-screen w-52 flex-col border-r border-border bg-card">
      <nav className="flex flex-col gap-1 p-3">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {label}
            </Link>
          );
        })}
        <div className="mt-auto border-t border-border pt-3">
          {session ? (
            <form action={logout}>
              <button
                type="submit"
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <LogOut className="h-5 w-5 shrink-0" />
                Wyloguj ({session.name})
              </button>
            </form>
          ) : (
            <Link
              href="/login"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <LogIn className="h-5 w-5 shrink-0" />
              Zaloguj
            </Link>
          )}
        </div>
      </nav>
    </aside>
  );
}
