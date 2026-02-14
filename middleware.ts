import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (path.startsWith("/api/")) {
    if (API_IP_WHITELIST.length > 0) {
      const ip = getClientIp(request);
      if (!API_IP_WHITELIST.includes(ip)) {
        return new NextResponse("Forbidden: IP not allowed", { status: 403 });
      }
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
      return NextResponse.redirect(new URL("/change-password", request.url));
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
  // Uruchamiaj dla wszystkich ścieżek oprócz _next i favicon (w tym /api/* – IP whitelist)
  matcher: ["/((?!_next|favicon\\.ico).*)"],
};
