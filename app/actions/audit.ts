"use server";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";

export type AuditTrailItem = {
  id: string;
  timestamp: Date;
  userId: string | null;
  userName: string | null;
  actionType: string;
  entityType: string;
  entityId: string | null;
  oldValue: unknown;
  newValue: unknown;
  ipAddress: string | null;
};

export async function getAuditTrail(params: {
  fromDate?: string;
  toDate?: string;
  entityType?: string;
  userId?: string;
  limit?: number;
}): Promise<
  { success: true; data: AuditTrailItem[] } | { success: false; error: string }
> {
  const session = await getSession();
  if (!session) return { success: false, error: "Zaloguj się" };
  const allowed = await can(session.role, "reports.view");
  if (!allowed) return { success: false, error: "Brak uprawnień do raportów" };

  const limit = Math.min(params.limit ?? 500, 2000);
  const where: Parameters<typeof prisma.auditLog.findMany>[0]["where"] = {};

  if (params.fromDate || params.toDate) {
    const ts: { gte?: Date; lte?: Date } = {};
    if (params.fromDate) {
      const from = new Date(params.fromDate + "T00:00:00.000Z");
      if (!Number.isNaN(from.getTime())) ts.gte = from;
    }
    if (params.toDate) {
      const to = new Date(params.toDate + "T23:59:59.999Z");
      if (!Number.isNaN(to.getTime())) ts.lte = to;
    }
    if (Object.keys(ts).length > 0) where.timestamp = ts;
  }
  if (params.entityType?.trim()) where.entityType = params.entityType.trim();
  if (params.userId?.trim()) where.userId = params.userId.trim();

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { timestamp: "desc" },
    take: limit,
  });

  const userIds = [...new Set(logs.map((l) => l.userId).filter(Boolean))] as string[];
  const users =
    userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true },
        })
      : [];
  const userMap = new Map(users.map((u) => [u.id, u.name]));

  const data: AuditTrailItem[] = logs.map((l) => ({
    id: l.id,
    timestamp: l.timestamp,
    userId: l.userId,
    userName: l.userId ? userMap.get(l.userId) ?? null : null,
    actionType: l.actionType,
    entityType: l.entityType,
    entityId: l.entityId,
    oldValue: l.oldValue,
    newValue: l.newValue,
    ipAddress: l.ipAddress,
  }));

  return { success: true, data };
}

/** Lista typów encji występujących w AuditLog (do filtra). */
export async function getAuditEntityTypes(): Promise<
  { success: true; data: string[] } | { success: false; error: string }
> {
  const session = await getSession();
  if (!session) return { success: false, error: "Zaloguj się" };
  const allowed = await can(session.role, "reports.view");
  if (!allowed) return { success: false, error: "Brak uprawnień" };

  const result = await prisma.auditLog.groupBy({
    by: ["entityType"],
    orderBy: { entityType: "asc" },
  });
  return { success: true, data: result.map((r) => r.entityType) };
}

export type UserForReport = { id: string; name: string; email: string };

/** Lista użytkowników do raportu akcji (wymaga reports.view). */
export async function getUsersForActionsReport(): Promise<
  { success: true; data: UserForReport[] } | { success: false; error: string }
> {
  const session = await getSession();
  if (!session) return { success: false, error: "Zaloguj się" };
  const allowed = await can(session.role, "reports.view");
  if (!allowed) return { success: false, error: "Brak uprawnień" };
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
  return { success: true, data: users };
}

export type LoginLogItem = {
  id: string;
  userId: string | null;
  email: string;
  loggedAt: Date;
  ipAddress: string | null;
  success: boolean;
  userName: string | null;
};

/** Raport logowań użytkowników (wymaga reports.view). */
export async function getLoginReport(params: {
  fromDate?: string;
  toDate?: string;
  email?: string;
  limit?: number;
}): Promise<
  { success: true; data: LoginLogItem[] } | { success: false; error: string }
> {
  const session = await getSession();
  if (!session) return { success: false, error: "Zaloguj się" };
  const allowed = await can(session.role, "reports.view");
  if (!allowed) return { success: false, error: "Brak uprawnień do raportów" };

  const limit = Math.min(params.limit ?? 500, 2000);
  const where: Parameters<typeof prisma.loginLog.findMany>[0]["where"] = {};

  if (params.fromDate || params.toDate) {
    const loggedAt: { gte?: Date; lte?: Date } = {};
    if (params.fromDate) {
      const from = new Date(params.fromDate + "T00:00:00.000Z");
      if (!Number.isNaN(from.getTime())) loggedAt.gte = from;
    }
    if (params.toDate) {
      const to = new Date(params.toDate + "T23:59:59.999Z");
      if (!Number.isNaN(to.getTime())) loggedAt.lte = to;
    }
    if (Object.keys(loggedAt).length > 0) where.loggedAt = loggedAt;
  }
  if (params.email?.trim()) where.email = { contains: params.email.trim() };

  const logs = await prisma.loginLog.findMany({
    where,
    orderBy: { loggedAt: "desc" },
    take: limit,
  });

  const userIds = [...new Set(logs.map((l) => l.userId).filter(Boolean))] as string[];
  const users =
    userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true },
        })
      : [];
  const userMap = new Map(users.map((u) => [u.id, u.name]));

  const data: LoginLogItem[] = logs.map((l) => ({
    id: l.id,
    userId: l.userId,
    email: l.email,
    loggedAt: l.loggedAt,
    ipAddress: l.ipAddress,
    success: l.success,
    userName: l.userId ? userMap.get(l.userId) ?? null : null,
  }));

  return { success: true, data };
}
