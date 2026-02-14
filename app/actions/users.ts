"use server";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";

export type UserListItem = {
  id: string;
  email: string;
  name: string;
  role: string;
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
