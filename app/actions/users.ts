"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { getSession, hashPin } from "@/lib/auth";
import { can } from "@/lib/permissions";

const VALID_ROLES = ["RECEPTION", "MANAGER", "HOUSEKEEPING", "OWNER"] as const;

export type UserListItem = {
  id: string;
  email: string;
  name: string;
  role: string;
  hasPin: boolean;
  isActive: boolean;
  maxDiscountPercent: number | null;
  maxDiscountAmount: number | null;
  maxVoidAmount: number | null;
};

/** Lista użytkowników do zarządzania limitami (wymaga admin.users). */
export async function listUsersForAdmin(): Promise<
  { success: true; data: UserListItem[] } | { success: false; error: string }
> {
  const session = await getSession();
  if (!session) return { success: false, error: "Zaloguj się" };
  const allowed = await can(session.role, "admin.users");
  if (!allowed) return { success: false, error: "Brak uprawnień" };
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      pin: true,
      isActive: true,
      maxDiscountPercent: true,
      maxDiscountAmount: true,
      maxVoidAmount: true,
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });
  return {
    success: true,
    data: users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      hasPin: !!u.pin,
      isActive: u.isActive,
      maxDiscountPercent: u.maxDiscountPercent != null ? Number(u.maxDiscountPercent) : null,
      maxDiscountAmount: u.maxDiscountAmount != null ? Number(u.maxDiscountAmount) : null,
      maxVoidAmount: u.maxVoidAmount != null ? Number(u.maxVoidAmount) : null,
    })),
  };
}

/** Aktualizacja limitów rabatowych i void użytkownika (wymaga admin.users). */
export async function updateUserLimits(
  userId: string,
  maxDiscountPercent: number | null,
  maxDiscountAmount: number | null,
  maxVoidAmount: number | null
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: "Zaloguj się" };
  const allowed = await can(session.role, "admin.users");
  if (!allowed) return { success: false, error: "Brak uprawnień" };
  if (maxDiscountPercent != null && (maxDiscountPercent < 0 || maxDiscountPercent > 100)) {
    return { success: false, error: "Limit rabatu % musi być 0–100" };
  }
  if (maxDiscountAmount != null && maxDiscountAmount < 0) {
    return { success: false, error: "Limit rabatu kwotowego nie może być ujemny" };
  }
  if (maxVoidAmount != null && maxVoidAmount < 0) {
    return { success: false, error: "Limit void nie może być ujemny" };
  }
  await prisma.user.update({
    where: { id: userId },
    data: {
      ...(maxDiscountPercent !== undefined && { maxDiscountPercent: maxDiscountPercent }),
      ...(maxDiscountAmount !== undefined && { maxDiscountAmount: maxDiscountAmount }),
      ...(maxVoidAmount !== undefined && { maxVoidAmount: maxVoidAmount }),
    },
  });
  return { success: true };
}

/** Tworzenie nowego użytkownika (wymaga admin.users). */
export async function createUser(data: {
  email: string;
  name: string;
  role: string;
  password?: string;
}): Promise<{ success: true } | { success: false; error: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: "Zaloguj się" };
  const allowed = await can(session.role, "admin.users");
  if (!allowed) return { success: false, error: "Brak uprawnień" };

  const email = data.email.trim().toLowerCase();
  const name = data.name.trim();
  if (!email || !name) {
    return { success: false, error: "Email i imię są wymagane." };
  }
  if (!VALID_ROLES.includes(data.role as typeof VALID_ROLES[number])) {
    return { success: false, error: "Nieprawidłowa rola." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { success: false, error: "Użytkownik z tym adresem email już istnieje." };
  }

  const password = data.password?.trim() || crypto.randomUUID();
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: {
      email,
      name,
      role: data.role,
      passwordHash,
      passwordChangedAt: new Date(),
    },
  });

  return { success: true };
}

/** Aktualizacja danych użytkownika (wymaga admin.users). */
export async function updateUser(
  userId: string,
  data: {
    name?: string;
    role?: string;
    resetPassword?: string;
  }
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: "Zaloguj się" };
  const allowed = await can(session.role, "admin.users");
  if (!allowed) return { success: false, error: "Brak uprawnień" };

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { success: false, error: "Użytkownik nie istnieje." };

  if (data.role && !VALID_ROLES.includes(data.role as typeof VALID_ROLES[number])) {
    return { success: false, error: "Nieprawidłowa rola." };
  }

  const updateData: Record<string, unknown> = {};
  if (data.name?.trim()) updateData.name = data.name.trim();
  if (data.role) updateData.role = data.role;
  if (data.resetPassword?.trim()) {
    updateData.passwordHash = await bcrypt.hash(data.resetPassword.trim(), 10);
    updateData.passwordChangedAt = new Date();
  }

  await prisma.user.update({ where: { id: userId }, data: updateData });
  return { success: true };
}

/** Usunięcie użytkownika (wymaga admin.users, nie można usunąć siebie). */
export async function deleteUser(
  userId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: "Zaloguj się" };
  const allowed = await can(session.role, "admin.users");
  if (!allowed) return { success: false, error: "Brak uprawnień" };

  if (userId === session.userId) {
    return { success: false, error: "Nie możesz usunąć własnego konta." };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { success: false, error: "Użytkownik nie istnieje." };

  await prisma.user.delete({ where: { id: userId } });
  return { success: true };
}

/** Ustawienie lub zmiana PIN użytkownika (wymaga admin.users). */
export async function setUserPin(
  userId: string,
  pin: string | null
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: "Zaloguj się" };
  const allowed = await can(session.role, "admin.users");
  if (!allowed) return { success: false, error: "Brak uprawnień" };

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { success: false, error: "Użytkownik nie istnieje." };

  if (pin === null || pin === "") {
    await prisma.user.update({ where: { id: userId }, data: { pin: null } });
    return { success: true };
  }

  if (!/^\d{4}$/.test(pin)) {
    return { success: false, error: "PIN musi składać się z 4 cyfr." };
  }

  const pinHash = await hashPin(pin);
  await prisma.user.update({ where: { id: userId }, data: { pin: pinHash } });
  return { success: true };
}

/** Przełączenie statusu aktywności użytkownika (wymaga admin.users). */
export async function toggleUserActive(
  userId: string
): Promise<{ success: true; isActive: boolean } | { success: false; error: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: "Zaloguj się" };
  const allowed = await can(session.role, "admin.users");
  if (!allowed) return { success: false, error: "Brak uprawnień" };

  if (userId === session.userId) {
    return { success: false, error: "Nie możesz dezaktywować własnego konta." };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { success: false, error: "Użytkownik nie istnieje." };

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { isActive: !user.isActive },
  });
  return { success: true, isActive: updated.isActive };
}
