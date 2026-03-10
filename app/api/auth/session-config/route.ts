import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSessionSettingsFromEnv, mergeSessionSettings } from "@/lib/session-settings";
import { prisma } from "@/lib/db";

/** GET – zwraca konfigurację sesji (screen lock, hard logout) dla zalogowanego klienta. */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const envSettings = getSessionSettingsFromEnv();
  const row = await prisma.hotelConfig.findUnique({ where: { id: "default" } });
  const dbSettings = (row?.sessionSettings ?? null) as { screenLockMinutes?: number; hardLogoutMinutes?: number } | null;
  const settings = mergeSessionSettings(envSettings, dbSettings);

  return NextResponse.json(settings);
}
