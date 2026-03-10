"use server";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import {
  getSessionSettingsFromEnv,
  mergeSessionSettings,
  type SessionSettings,
} from "@/lib/session-settings";

export async function getSessionSettings(): Promise<
  { success: true; data: SessionSettings } | { success: false; error: string }
> {
  const session = await getSession();
  if (!session) return { success: false, error: "Zaloguj się" };
  const allowed = await can(session.role, "admin.settings");
  if (!allowed) return { success: false, error: "Brak uprawnień" };

  const envSettings = getSessionSettingsFromEnv();
  const row = await prisma.hotelConfig.findUnique({ where: { id: "default" } });
  const dbSettings = (row?.sessionSettings ?? null) as { screenLockMinutes?: number; hardLogoutMinutes?: number } | null;
  const data = mergeSessionSettings(envSettings, dbSettings);

  return { success: true, data };
}

export async function updateSessionSettings(data: Partial<SessionSettings>): Promise<
  { success: true } | { success: false; error: string }
> {
  const session = await getSession();
  if (!session) return { success: false, error: "Zaloguj się" };
  const allowed = await can(session.role, "admin.settings");
  if (!allowed) return { success: false, error: "Brak uprawnień" };

  const row = await prisma.hotelConfig.findUnique({ where: { id: "default" } });
  const current = (row?.sessionSettings ?? {}) as Record<string, number>;
  const next: Record<string, number> = { ...current };

  if (typeof data.screenLockMinutes === "number" && data.screenLockMinutes >= 0) {
    next.screenLockMinutes = data.screenLockMinutes;
  }
  if (typeof data.hardLogoutMinutes === "number" && data.hardLogoutMinutes > 0) {
    next.hardLogoutMinutes = data.hardLogoutMinutes;
  }

  await prisma.hotelConfig.upsert({
    where: { id: "default" },
    create: { id: "default", name: "", sessionSettings: next },
    update: { sessionSettings: next },
  });

  return { success: true };
}
