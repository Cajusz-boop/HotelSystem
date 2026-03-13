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

// basePath dla instancji treningowej (/training) — pathname w request zawiera basePath
const BASE_PATH = process.env.NEXT_BASE_PATH ?? (process.env.NEXT_PUBLIC_APP_URL?.includes("/training") ? "/training" : "");

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

  // W production używaj wewnętrznego URL (127.0.0.1) — unika self-fetch przez sieć,
  // który mógł timeout'ować i powodować ~1 min opóźnienia logowania
  const port = process.env.PORT || "3000";
  const apiBase =
    process.env.NODE_ENV === "production"
      ? process.env.INTERNAL_ORIGIN || `http://127.0.0.1:${port}`
      : origin;

  try {
    const res = await fetch(`${apiBase}/api/auth/check-active?userId=${encodeURIComponent(userId)}`, {
      headers: { "x-internal-secret": process.env.SESSION_SECRET || "" },
      cache: "no-store",
      signal: AbortSignal.timeout(5000), // max 5s — unikaj długiego blokowania
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
 * 2. Gdy cache wygasł — fetch do /api/auth/is-disabled (baza = źródło prawdy).
 * 3. process.env.AUTH_DISABLED — tylko jako fallback przy błędzie fetcha.
 */
async function isAuthDisabled(request: NextRequest): Promise<boolean> {
  const cached = getAuthDisabledCache();
  if (cached !== undefined) return cached;

  // Najpierw fetch z bazy — wartość z UI ma priorytet nad process.env (ustawiane przy starcie)
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
      // Fetch nie zadziałał — fallback na env
    }
  }

  // Fallback: env (z config-snapshot przy starcie serwera)
  const fromEnv = process.env.AUTH_DISABLED === "true";
  setAuthDisabledCache(fromEnv);
  return fromEnv;
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  // pathname zawiera basePath (np. /training/login) — normalizujemy do ścieżki wewnętrznej
  const pathWithoutBase = BASE_PATH && path.startsWith(BASE_PATH) ? path.slice(BASE_PATH.length) || "/" : path;

  const loginPath = `${BASE_PATH}/login`;
  const changePasswordPath = `${BASE_PATH}/change-password`;

  // Nie sprawdzaj auth-disabled dla samego endpointu is-disabled (unikanie pętli)
  const isAuthCheckRoute = pathWithoutBase === "/api/auth/is-disabled";
  const authDisabled = isAuthCheckRoute ? false : await isAuthDisabled(request);

  if (pathWithoutBase.startsWith("/api/")) {
    if (pathWithoutBase === "/api/health" || isAuthCheckRoute || pathWithoutBase === "/api/auth/check-active") return NextResponse.next();

    // OAuth callback routes – muszą być dostępne z zewnątrz (redirect z Google)
    if (pathWithoutBase.startsWith("/api/auth/staff/google") || pathWithoutBase.startsWith("/api/auth/guest/google")) {
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
    if (pathWithoutBase === "/login") {
      return NextResponse.redirect(new URL(BASE_PATH || "/", request.url));
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
    (p) => pathWithoutBase === p || pathWithoutBase.startsWith(p + "/")
  );

  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    if (isPublic) return NextResponse.next();
    return NextResponse.redirect(new URL(loginPath, request.url));
  }

  let response = NextResponse.next();
  const origin = request.nextUrl.origin;

  try {
    // NAPRAWA 1: Weryfikacja JWT kryptograficznie (nie tylko parsowanie)
    const { payload } = await jwtVerify(token, getJWTSecret()) as { payload: SessionJWTPayload };

    // NAPRAWA 2: Sprawdzenie isActive
    // Szybkie sprawdzenie z JWT payload
    if (payload.isActive === false) {
      response = NextResponse.redirect(new URL(`${loginPath}?reason=inactive`, request.url));
      response.cookies.delete(COOKIE_NAME);
      response.cookies.delete(LAST_ACTIVITY_COOKIE);
      return response;
    }

    // Dokładne sprawdzenie z cache (co 5 minut) - tylko gdy mamy userId
    if (payload.userId) {
      const isActive = await checkUserActive(payload.userId, origin);
      if (!isActive) {
        response = NextResponse.redirect(new URL(`${loginPath}?reason=inactive`, request.url));
        response.cookies.delete(COOKIE_NAME);
        response.cookies.delete(LAST_ACTIVITY_COOKIE);
        return response;
      }
    }

    // Sprawdź czy hasło wygasło
    if (payload.passwordExpired === true) {
      if (pathWithoutBase !== "/change-password" && !pathWithoutBase.startsWith("/change-password/")) {
        return NextResponse.redirect(new URL(changePasswordPath, request.url));
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
      return NextResponse.redirect(new URL(`${loginPath}?timeout=1`, request.url));
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
    response = NextResponse.redirect(new URL(loginPath, request.url));
    response.cookies.delete(COOKIE_NAME);
    response.cookies.delete(LAST_ACTIVITY_COOKIE);
    return response;
  }
  return response;
}

export const config = {
  // Uruchamiaj dla stron i API – pomijaj statyczne zasoby, login i api/auth (z basePath: /training/login nie trafia w matcher)
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|login|training/login|api/auth|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js|woff2?|ttf|eot|ico)).*)"],
};
