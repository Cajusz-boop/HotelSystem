import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import type { AuditActionType } from "@prisma/client";

export interface AuditParams {
  userId?: string;
  actionType: AuditActionType;
  entityType: string;
  entityId?: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

/** Zapisuje wpis do tabeli AuditLog – ślad rewizyjny dla mutacji. userId z sesji, jeśli nie podany. */
export async function createAuditLog(params: AuditParams): Promise<void> {
  const session = await getSession();
  const userId = params.userId ?? session?.userId ?? null;
  await prisma.auditLog.create({
    data: {
      userId,
      actionType: params.actionType,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      oldValue: (params.oldValue ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      newValue: (params.newValue ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      ipAddress: params.ipAddress ?? null,
    },
  });
}

/** Pobiera adres IP z nagłówków request (Next.js headers) */
export function getClientIp(headers: Headers | undefined): string | null {
  if (!headers) return null;
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    null
  );
}
