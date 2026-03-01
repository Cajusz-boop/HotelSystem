import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify, type JWTPayload } from "jose";
import { getAuthDisabledCache, setAuthDisabledCache, isAuthCacheLoaded } from "@/lib/auth-disabled-cache";

const COOKIE_NAME = "pms_session";
const LAST_ACTIVITY_COOKIE = "pms_last_activity";
const IDLE_TIMEOUT_MINUTES = Number(process.env.SESSION_IDLE_TIMEOUT_MINUTES) || 30;

const API_IP_WHITELIST = (process.env.API_IP_WHITELIST ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

interface SessionJWTPayload extends JWTPayload {
  userId: string;
  email: string;
  name: string;
  role: string;
  isActive?: boolean;
  passwordExpired?: boolean;
}

function getJWTSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET ?? "dev-secret-change-in-production";
  return new TextEncoder().encode(secret);
}

const userStatusCache = new Map<string, { isActive: boolean; cachedAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minut

async function checkUserActive(userId: string, origin: string): Promise<boolean> {
  const now = Date.now();
  const cached = userStatusCache.get(userId);

  if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
    return cached.isActive;
  }

  try {
    const res = await fetch(`${origin}/api/auth/check-active?userId=${encodeURIComponent(userId)}`, {
      headers: { "x-internal-secret": process.env.SESSION_SECRET || "" },
      cache: "no-store",
    });

    if (!res.ok) return true; // fail-open

    const data = await res.json();
    userStatusCache.set(userId, { isActive: data.isActive, cachedAt: now });

    // Cleanup starych wpisów (memory leak prevention)
    if (userStatusCache.size > 500) {
      for (const [key, val] of userStatusCache.entries()) {
        if (now - val.cachedAt > CACHE_TTL_MS) userStatusCache.delete(key);
      }
    }

    return data.isActive;
  } catch {
    console.error(`[Middleware] Failed to check isActive for ${userId}`);
    return true; // fail-open
  }
}

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
    if (path === "/api/health" || isAuthCheckRoute || path === "/api/auth/check-active") return NextResponse.next();

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

  let response = NextResponse.next();
  const origin = request.nextUrl.origin;

  try {
    // NAPRAWA 1: Weryfikacja JWT kryptograficznie (nie tylko parsowanie)
    const { payload } = await jwtVerify(token, getJWTSecret()) as { payload: SessionJWTPayload };

    // NAPRAWA 2: Sprawdzenie isActive
    // Szybkie sprawdzenie z JWT payload
    if (payload.isActive === false) {
      response = NextResponse.redirect(new URL("/login?reason=inactive", request.url));
      response.cookies.delete(COOKIE_NAME);
      response.cookies.delete(LAST_ACTIVITY_COOKIE);
      return response;
    }

    // Dokładne sprawdzenie z cache (co 5 minut) - tylko gdy mamy userId
    if (payload.userId) {
      const isActive = await checkUserActive(payload.userId, origin);
      if (!isActive) {
        response = NextResponse.redirect(new URL("/login?reason=inactive", request.url));
        response.cookies.delete(COOKIE_NAME);
        response.cookies.delete(LAST_ACTIVITY_COOKIE);
        return response;
      }
    }

    // Sprawdź czy hasło wygasło
    if (payload.passwordExpired === true) {
      if (path !== "/change-password" && !path.startsWith("/change-password/")) {
        return NextResponse.redirect(new URL("/change-password", request.url));
      }
    }

    // Idle timeout check
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
    // Token nieprawidłowy, wygasły lub sfabrykowany → redirect na /login
    response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete(COOKIE_NAME);
    response.cookies.delete(LAST_ACTIVITY_COOKIE);
    return response;
  }
  return response;
}

export const config = {
  // Uruchamiaj dla stron i API – pomijaj statyczne zasoby (_next, favicon, obrazy, fonty, CSS/JS)
  matcher: ["/((?!_next|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js|woff2?|ttf|eot|ico)).*)"],
};
