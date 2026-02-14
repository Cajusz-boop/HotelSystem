/**
 * Sesja gościa – JWT w cookie (po logowaniu SSO Google/Facebook).
 */

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export const GUEST_COOKIE_NAME = "guest_session";
const GUEST_SESSION_DAYS = 30;

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET ?? "dev-secret-change-in-production";
  return new TextEncoder().encode(secret);
}

export interface GuestSessionPayload {
  guestId: string;
  email: string | null;
  name: string;
  exp: number;
}

/** Zwraca sesję gościa z cookie lub null */
export async function getGuestSession(): Promise<GuestSessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(GUEST_COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.exp != null && payload.exp * 1000 < Date.now()) return null;
    return {
      guestId: payload.guestId as string,
      email: (payload.email as string) ?? null,
      name: payload.name as string,
      exp: payload.exp as number,
    };
  } catch {
    return null;
  }
}

/** Tworzy token sesji gościa i zwraca ustawienia cookie */
export async function createGuestSessionToken(payload: {
  guestId: string;
  email: string | null;
  name: string;
}): Promise<{ name: string; value: string; options: { httpOnly: boolean; secure: boolean; sameSite: "lax"; path: string; maxAge: number } }> {
  const exp = Math.floor(Date.now() / 1000) + GUEST_SESSION_DAYS * 24 * 60 * 60;
  const token = await new SignJWT({
    guestId: payload.guestId,
    email: payload.email ?? null,
    name: payload.name,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(exp)
    .sign(getSecret());
  return {
    name: GUEST_COOKIE_NAME,
    value: token,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: GUEST_SESSION_DAYS * 24 * 60 * 60,
    },
  };
}
