"use server";

import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { getSession, createSessionToken, createPending2FAToken, COOKIE_NAME } from "@/lib/auth";
import { getClientIp } from "@/lib/audit";
import { isPasswordExpired } from "@/lib/password-policy";

export type AuthResult =
  | { success: true }
  | { success: false; error: string }
  | { success: false; needTwoFactor: true; pendingToken: string };

const LOGIN_MAX_ATTEMPTS = Number(process.env.LOGIN_MAX_ATTEMPTS) || 5;
const LOGIN_LOCKOUT_MS = (Number(process.env.LOGIN_LOCKOUT_MINUTES) || 15) * 60 * 1000;
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();

function isLoginLocked(email: string): { locked: boolean; remainingMs?: number } {
  const entry = loginAttempts.get(email);
  if (!entry || entry.lockedUntil <= 0) return { locked: false };
  if (Date.now() < entry.lockedUntil) {
    return { locked: true, remainingMs: entry.lockedUntil - Date.now() };
  }
  loginAttempts.delete(email);
  return { locked: false };
}

function recordFailedLogin(email: string): void {
  const entry = loginAttempts.get(email);
  if (!entry) {
    loginAttempts.set(email, {
      count: 1,
      lockedUntil: LOGIN_MAX_ATTEMPTS <= 1 ? Date.now() + LOGIN_LOCKOUT_MS : 0,
    });
    return;
  }
  entry.count++;
  if (entry.count >= LOGIN_MAX_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOGIN_LOCKOUT_MS;
  }
}

function clearLoginAttempts(email: string): void {
  loginAttempts.delete(email);
}

/** Logowanie: weryfikacja hasła i ustawienie sesji w cookie */
export async function login(
  email: string,
  password: string
): Promise<AuthResult> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !password) {
    return { success: false, error: "Email i hasło wymagane." };
  }
  const lockCheck = isLoginLocked(trimmed);
  if (lockCheck.locked) {
    const mins = lockCheck.remainingMs != null ? Math.ceil(lockCheck.remainingMs / 60_000) : 15;
    return { success: false, error: `Zbyt wiele nieudanych prób. Spróbuj ponownie za ${mins} min.` };
  }
  const headersList = await headers();
  const ip = getClientIp(headersList);

  try {
    const user = await prisma.user.findUnique({ where: { email: trimmed } });
    if (!user) {
      recordFailedLogin(trimmed);
      await prisma.loginLog.create({
        data: { email: trimmed, userId: null, success: false, ipAddress: ip },
      });
      return { success: false, error: "Nieprawidłowy email lub hasło." };
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      recordFailedLogin(trimmed);
      await prisma.loginLog.create({
        data: { email: trimmed, userId: user.id, success: false, ipAddress: ip },
      });
      return { success: false, error: "Nieprawidłowy email lub hasło." };
    }
    clearLoginAttempts(trimmed);
    if (user.totpEnabled && user.totpSecret) {
      const pendingToken = await createPending2FAToken(user.id);
      return { success: false, needTwoFactor: true, pendingToken };
    }
    await prisma.loginLog.create({
      data: { email: user.email, userId: user.id, success: true, ipAddress: ip },
    });
    const passwordExpired = isPasswordExpired(user.passwordChangedAt);
    const session = await createSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      passwordExpired: passwordExpired || undefined,
    });
    const cookieStore = await cookies();
    cookieStore.set(session.name, session.value, session.options);
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd logowania",
    };
  }
}

/** Weryfikacja 2FA i utworzenie sesji. */
export async function verify2FA(
  pendingToken: string,
  code: string
): Promise<AuthResult> {
  const { verifyPending2FAToken } = await import("@/lib/auth");
  const parsed = await verifyPending2FAToken(pendingToken);
  if (!parsed) return { success: false, error: "Sesja wygasła. Zaloguj się ponownie." };
  const user = await prisma.user.findUnique({
    where: { id: parsed.userId },
    select: { id: true, email: true, name: true, role: true, totpSecret: true, totpEnabled: true, passwordChangedAt: true },
  });
  if (!user || !user.totpEnabled || !user.totpSecret) return { success: false, error: "Błąd weryfikacji." };
  const { verifyTotpToken } = await import("@/lib/totp");
  if (!verifyTotpToken(user.totpSecret, code)) return { success: false, error: "Nieprawidłowy kod." };
  const headersList = await headers();
  const ip = getClientIp(headersList);
  await prisma.loginLog.create({
    data: { email: user.email, userId: user.id, success: true, ipAddress: ip },
  });
  const passwordExpired = isPasswordExpired(user.passwordChangedAt);
  const session = await createSessionToken({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    passwordExpired: passwordExpired || undefined,
  });
  const cookieStore = await cookies();
  cookieStore.set(session.name, session.value, session.options);
  return { success: true };
}

/** Zmiana hasła (wymaga zalogowania). Walidacja według polityki haseł. */
export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: "Zaloguj się" };
  const { validatePassword } = await import("@/lib/password-policy");
  const validation = validatePassword(newPassword);
  if (!validation.valid) return { success: false, error: validation.error };
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return { success: false, error: "Użytkownik nie istnieje" };
  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) return { success: false, error: "Aktualne hasło jest nieprawidłowe." };
  const hash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: session.userId },
    data: { passwordHash: hash, passwordChangedAt: new Date() },
  });
  const sessionToken = await createSessionToken({
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });
  const cookieStore = await cookies();
  cookieStore.set(sessionToken.name, sessionToken.value, sessionToken.options);
  return { success: true };
}

/** Wylogowanie – usunięcie cookie sesji */
export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  redirect("/login");
}
