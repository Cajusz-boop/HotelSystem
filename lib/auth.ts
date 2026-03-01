import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { getAuthDisabledCache } from "@/lib/auth-disabled-cache";

const COOKIE_NAME = "pms_session";
const SESSION_DURATION_DAYS = 7;

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET ?? "dev-secret-change-in-production";
  return new TextEncoder().encode(secret);
}

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  role: string;
  exp: number;
  /** Czy użytkownik jest aktywny */
  isActive?: boolean;
  /** Ustawione gdy hasło użytkownika wygasło – wymusza zmianę hasła */
  passwordExpired?: boolean;
}

/** Domyślna sesja gdy logowanie jest wyłączone — MANAGER ma pełne uprawnienia jak admin */
const ANONYMOUS_SESSION: SessionPayload = {
  userId: "anonymous",
  email: "admin@hotel.local",
  name: "Demo",
  role: "MANAGER",
  exp: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
};

/** Sprawdza czy auth jest wyłączone (cache + env fallback) */
function isAuthDisabled(): boolean {
  const cached = getAuthDisabledCache();
  if (cached !== undefined) return cached;
  return process.env.AUTH_DISABLED === "true";
}

/** Zwraca sesję z cookie (userId, email, name, role) lub null */
export async function getSession(): Promise<SessionPayload | null> {
  // Tryb bez logowania — zwróć sesję admina
  if (isAuthDisabled()) {
    return ANONYMOUS_SESSION;
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.exp != null && payload.exp * 1000 < Date.now()) return null;
    return {
      userId: payload.userId as string,
      email: payload.email as string,
      name: payload.name as string,
      role: payload.role as string,
      exp: payload.exp as number,
      isActive: payload.isActive !== false,
      passwordExpired: payload.passwordExpired === true,
    };
  } catch {
    return null;
  }
}

/** Tworzy token sesji i zwraca ustawienia cookie (do ustawienia w response) */
export async function createSessionToken(
  payload: {
    userId: string;
    email: string;
    name: string;
    role: string;
    isActive?: boolean;
    passwordExpired?: boolean;
  }
): Promise<{ name: string; value: string; options: { httpOnly: true; secure: boolean; sameSite: "lax"; path: string; maxAge: number } }> {
  const exp = Math.floor(Date.now() / 1000) + SESSION_DURATION_DAYS * 24 * 60 * 60;
  const token = await new SignJWT({
    userId: payload.userId,
    email: payload.email,
    name: payload.name,
    role: payload.role,
    isActive: payload.isActive ?? true,
    ...(payload.passwordExpired && { passwordExpired: true }),
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(exp)
    .sign(getSecret());
  return {
    name: COOKIE_NAME,
    value: token,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,
    },
  };
}

/** Token tymczasowy na krok 2FA (zawiera tylko userId), ważny 5 min. */
const PENDING_2FA_DURATION_SEC = 5 * 60;

export async function createPending2FAToken(userId: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + PENDING_2FA_DURATION_SEC;
  const token = await new SignJWT({ userId, purpose: "2fa" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(exp)
    .sign(getSecret());
  return token;
}

export async function verifyPending2FAToken(token: string): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.purpose !== "2fa" || !payload.userId) return null;
    return { userId: payload.userId as string };
  } catch {
    return null;
  }
}

/** Hashuje PIN (4 cyfry) */
export async function hashPin(pin: string): Promise<string> {
  const bcrypt = await import("bcryptjs");
  return bcrypt.default.hash(pin, 10);
}

/** Weryfikuje PIN */
export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  const bcrypt = await import("bcryptjs");
  return bcrypt.default.compare(pin, hash);
}

export { COOKIE_NAME };
