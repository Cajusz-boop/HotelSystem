import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

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
}

/** Zwraca sesję z cookie (userId, email, name, role) lub null */
export async function getSession(): Promise<SessionPayload | null> {
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
    };
  } catch {
    return null;
  }
}

/** Tworzy token sesji i zwraca ustawienia cookie (do ustawienia w response) */
export async function createSessionToken(payload: {
  userId: string;
  email: string;
  name: string;
  role: string;
}): Promise<{ name: string; value: string; options: { httpOnly: true; secure: boolean; sameSite: "lax"; path: string; maxAge: number } }> {
  const exp = Math.floor(Date.now() / 1000) + SESSION_DURATION_DAYS * 24 * 60 * 60;
  const token = await new SignJWT({
    userId: payload.userId,
    email: payload.email,
    name: payload.name,
    role: payload.role,
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

export { COOKIE_NAME };
