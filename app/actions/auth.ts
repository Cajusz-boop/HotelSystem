"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { createSessionToken, COOKIE_NAME } from "@/lib/auth";

export type AuthResult = { success: true } | { success: false; error: string };

/** Logowanie: weryfikacja hasła i ustawienie sesji w cookie */
export async function login(
  email: string,
  password: string
): Promise<AuthResult> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !password) {
    return { success: false, error: "Email i hasło wymagane." };
  }
  try {
    const user = await prisma.user.findUnique({ where: { email: trimmed } });
    if (!user) {
      return { success: false, error: "Nieprawidłowy email lub hasło." };
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return { success: false, error: "Nieprawidłowy email lub hasło." };
    }
    const session = await createSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
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

/** Wylogowanie – usunięcie cookie sesji */
export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  redirect("/login");
}
