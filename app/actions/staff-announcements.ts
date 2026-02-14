"use server";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";

export type StaffAnnouncementEntry = {
  id: string;
  title: string;
  body: string;
  authorId: string | null;
  authorName: string | null;
  createdAt: string;
  validUntil: string | null;
  isPinned: boolean;
};

export async function getStaffAnnouncements(options?: {
  limit?: number;
  onlyValid?: boolean; // hide expired (validUntil < today)
}): Promise<
  { success: true; data: StaffAnnouncementEntry[] } | { success: false; error: string }
> {
  const session = await getSession();
  if (!session) return { success: false, error: "Zaloguj się" };

  const limit = Math.min(options?.limit ?? 30, 100);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const where = options?.onlyValid
    ? { OR: [{ validUntil: null }, { validUntil: { gte: today } }] }
    : undefined;

  try {
    const list = await prisma.staffAnnouncement.findMany({
      where,
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
      take: limit,
      include: { author: { select: { name: true } } },
    });
    return {
      success: true,
      data: list.map((a) => ({
        id: a.id,
        title: a.title,
        body: a.body,
        authorId: a.authorId,
        authorName: a.author?.name ?? null,
        createdAt: a.createdAt.toISOString(),
        validUntil: a.validUntil ? a.validUntil.toISOString().slice(0, 10) : null,
        isPinned: a.isPinned,
      })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu ogłoszeń",
    };
  }
}

export async function createStaffAnnouncement(data: {
  title: string;
  body: string;
  validUntil?: string | null;
  isPinned?: boolean;
}): Promise<
  { success: true; data: StaffAnnouncementEntry } | { success: false; error: string }
> {
  const session = await getSession();
  if (!session) return { success: false, error: "Zaloguj się" };
  const allowed = await can(session.role, "admin.settings");
  if (!allowed) return { success: false, error: "Brak uprawnień" };

  const title = String(data.title ?? "").trim();
  const body = String(data.body ?? "").trim();
  if (!title) return { success: false, error: "Tytuł jest wymagany" };
  if (!body) return { success: false, error: "Treść jest wymagana" };

  const validUntil = data.validUntil?.trim()
    ? new Date(data.validUntil + "T23:59:59Z")
    : null;
  if (data.validUntil?.trim() && validUntil && Number.isNaN(validUntil.getTime())) {
    return { success: false, error: "Nieprawidłowa data ważności" };
  }

  try {
    const created = await prisma.staffAnnouncement.create({
      data: {
        title,
        body,
        authorId: session.userId,
        validUntil,
        isPinned: data.isPinned ?? false,
      },
      include: { author: { select: { name: true } } },
    });
    return {
      success: true,
      data: {
        id: created.id,
        title: created.title,
        body: created.body,
        authorId: created.authorId,
        authorName: created.author?.name ?? null,
        createdAt: created.createdAt.toISOString(),
        validUntil: created.validUntil ? created.validUntil.toISOString().slice(0, 10) : null,
        isPinned: created.isPinned,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd zapisu ogłoszenia",
    };
  }
}

export async function getCanManageAnnouncements(): Promise<{ success: true; canManage: boolean } | { success: false; error: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: "Zaloguj się" };
  const allowed = await can(session.role, "admin.settings");
  return { success: true, canManage: allowed };
}

export async function deleteStaffAnnouncement(id: string): Promise<{ success: true } | { success: false; error: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: "Zaloguj się" };
  const allowed = await can(session.role, "admin.settings");
  if (!allowed) return { success: false, error: "Brak uprawnień" };

  try {
    await prisma.staffAnnouncement.delete({ where: { id } });
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd usunięcia ogłoszenia",
    };
  }
}
