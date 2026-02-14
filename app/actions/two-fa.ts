"use server";

import QRCode from "qrcode";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { generateTotpSecret, getTotpUri, verifyTotpToken } from "@/lib/totp";

export type Start2FAResult =
  | { success: true; otpauthUri: string; secret: string; qrDataUrl: string }
  | { success: false; error: string };

/** Rozpoczęcie konfiguracji 2FA: generuje secret i zwraca URI + QR (oraz secret do potwierdzenia). */
export async function start2FA(): Promise<Start2FAResult> {
  const session = await getSession();
  if (!session) return { success: false, error: "Zaloguj się" };
  const secret = generateTotpSecret();
  const otpauthUri = getTotpUri(session.email, secret);
  const qrDataUrl = await QRCode.toDataURL(otpauthUri, { width: 220 });
  return { success: true, otpauthUri, secret, qrDataUrl };
}

/** Potwierdzenie 2FA: weryfikacja kodu i zapis secretu w profilu użytkownika. */
export async function confirm2FA(
  secret: string,
  code: string
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: "Zaloguj się" };
  if (!verifyTotpToken(secret, code)) return { success: false, error: "Nieprawidłowy kod. Wprowadź aktualny kod z aplikacji." };
  await prisma.user.update({
    where: { id: session.userId },
    data: { totpSecret: secret, totpEnabled: true },
  });
  return { success: true };
}

/** Wyłączenie 2FA (wymaga zalogowanego użytkownika). */
export async function disable2FA(): Promise<{ success: true } | { success: false; error: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: "Zaloguj się" };
  await prisma.user.update({
    where: { id: session.userId },
    data: { totpSecret: null, totpEnabled: false },
  });
  return { success: true };
}

/** Czy użytkownik ma włączone 2FA. */
export async function get2FAStatus(): Promise<{ enabled: boolean } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Zaloguj się" };
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { totpEnabled: true },
  });
  return { enabled: user?.totpEnabled ?? false };
}
