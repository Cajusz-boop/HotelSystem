import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

const LAST_ACTIVITY_COOKIE = "pms_last_activity";
const IDLE_TIMEOUT_MINUTES = Number(process.env.SESSION_IDLE_TIMEOUT_MINUTES) || 480;

/**
 * POST – heartbeat sesji. Aktualizuje LAST_ACTIVITY_COOKIE.
 * Klient wywołuje co 20s, aby sesja nie wygasła.
 */
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  const now = Date.now();
  response.cookies.set(LAST_ACTIVITY_COOKIE, String(now), {
    path: "/",
    maxAge: IDLE_TIMEOUT_MINUTES * 60,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
