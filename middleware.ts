import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAuthDisabledCache, setAuthDisabledCache, isAuthCacheLoaded } from "@/lib/auth-disabled-cache";

const COOKIE_NAME = "pms_session";
const LAST_ACTIVITY_COOKIE = "pms_last_activity";
const IDLE_TIMEOUT_MINUTES = Number(process.env.SESSION_IDLE_TIMEOUT_MINUTES) || 30;

const API_IP_WHITELIST = (process.env.API_IP_WHITELIST ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Sprawdza czy logowanie jest wyłączone.
 * 1. Czyta z globalThis cache (zero latencji) — ustawianego przez server action.
 * 2. process.env.AUTH_DISABLED — ustawiane przez next.config.js z config-snapshot.json.
 * 3. Jeśli cache nie załadowany — fetch do /api/auth/is-disabled.
 */
async function isAuthDisabled(request: NextRequest): Promise<boolean> {
  const cached = getAuthDisabledCache();
  if (cached !== undefined) return cached;

  if (process.env.AUTH_DISABLED === "true") {
    setAuthDisabledCache(true);
    return true;
  }

  if (!isAuthCacheLoaded()) {
    try {
      const origin = request.nextUrl.origin;
      const res = await fetch(`${origin}/api/auth/is-disabled`, {
        cache: "no-store",
        headers: { "x-internal": "1" },
      });
      if (res.ok) {
        const data = await res.json();
        const disabled = data?.disabled === true;
        setAuthDisabledCache(disabled);
        return disabled;
      }
    } catch {
      // Fetch nie zadziałał
    }
    setAuthDisabledCache(false);
  }

  return false;
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Nie sprawdzaj auth-disabled dla samego endpointu is-disabled (unikanie pętli)
  const isAuthCheckRoute = path === "/api/auth/is-disabled";
  const authDisabled = isAuthCheckRoute ? false : await isAuthDisabled(request);

  if (path.startsWith("/api/")) {
    if (path === "/api/health" || isAuthCheckRoute) return NextResponse.next();

    // OAuth callback routes – muszą być dostępne z zewnątrz (redirect z Google)
    if (path.startsWith("/api/auth/staff/google") || path.startsWith("/api/auth/guest/google")) {
      return NextResponse.next();
    }

    if (!authDisabled && API_IP_WHITELIST.length > 0) {
      const ip = getClientIp(request);
      if (!API_IP_WHITELIST.includes(ip)) {
        return new NextResponse("Forbidden: IP not allowed", { status: 403 });
      }
    }
    return NextResponse.next();
  }

  // Gdy logowanie wyłączone — przepuść wszystkie strony bez sprawdzania sesji
  if (authDisabled) {
    // Jeśli użytkownik wchodzi na /login — przekieruj na dashboard (nie ma sensu logować się w trybie demo)
    if (path === "/login") {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  const publicPaths = [
    "/login",
    "/change-password",
    "/pay",
    "/check-in/guest",
    "/guest-app",
    "/api-docs",
    "/sprzatanie",
  ];
  const isPublic = publicPaths.some(
    (p) => path === p || path.startsWith(p + "/")
  );

  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    if (isPublic) return NextResponse.next();
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const response = NextResponse.next();

  try {
    const parts = token.split(".");
    if (parts.length !== 3) return NextResponse.next();
    const payload = JSON.parse(atob(parts[1]));
    if (payload.passwordExpired === true) {
      // Nie przekierowuj na /change-password, gdy użytkownik już na niej jest (unikanie pętli)
      if (path !== "/change-password" && !path.startsWith("/change-password/")) {
        return NextResponse.redirect(new URL("/change-password", request.url));
      }
    }

    const lastActivity = request.cookies.get(LAST_ACTIVITY_COOKIE)?.value;
    const lastTs = lastActivity ? parseInt(lastActivity, 10) : 0;
    const now = Date.now();
    const idleMs = IDLE_TIMEOUT_MINUTES * 60 * 1000;
    const hasValidActivity = !Number.isNaN(lastTs) && lastTs > 0;
    if (hasValidActivity && now - lastTs > idleMs) {
      response.cookies.set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
      response.cookies.set(LAST_ACTIVITY_COOKIE, "", { path: "/", maxAge: 0 });
      return NextResponse.redirect(new URL("/login?timeout=1", request.url));
    }

    response.cookies.set(LAST_ACTIVITY_COOKIE, String(now), {
      path: "/",
      maxAge: IDLE_TIMEOUT_MINUTES * 60,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  } catch {
    // ignore
  }
  return response;
}

export const config = {
  // Uruchamiaj dla stron i API – pomijaj statyczne zasoby (_next, favicon, obrazy, fonty, CSS/JS)
  matcher: ["/((?!_next|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js|woff2?|ttf|eot|ico)).*)"],
};
