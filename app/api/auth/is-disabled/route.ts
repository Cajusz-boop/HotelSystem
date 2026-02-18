import { NextResponse } from "next/server";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { prisma } from "@/lib/db";
import { setAuthDisabledCache } from "@/lib/auth-disabled-cache";

export const dynamic = "force-dynamic";

const g = globalThis as unknown as { __configSnapshotImported?: boolean };

/**
 * Synchronizuje HotelConfig z config-snapshot.json (jednorazowo na proces).
 * Tworzy rekord jeśli nie istnieje, lub aktualizuje authDisabled jeśli snapshot ma inną wartość.
 */
async function ensureConfigFromSnapshot(): Promise<void> {
  if (g.__configSnapshotImported) return;
  g.__configSnapshotImported = true;

  try {
    const snapshotPath = join(process.cwd(), "prisma", "config-snapshot.json");
    if (!existsSync(snapshotPath)) return;

    const snapshot = JSON.parse(readFileSync(snapshotPath, "utf-8"));
    if (!snapshot.hotelConfig) return;

    const hc = snapshot.hotelConfig;
    delete hc.updatedAt;

    await prisma.hotelConfig.upsert({
      where: { id: "default" },
      create: hc,
      update: { authDisabled: hc.authDisabled ?? false },
    });
  } catch {
    // nie blokuj startu
  }
}

/**
 * Publiczny endpoint — zwraca czy logowanie jest wyłączone.
 * Wywoływany przez middleware przy pierwszym żądaniu po starcie serwera
 * (aby załadować cache z bazy). Potem middleware czyta z globalThis cache.
 */
export async function GET() {
  try {
    await ensureConfigFromSnapshot();

    const row = await prisma.hotelConfig.findUnique({
      where: { id: "default" },
      select: { authDisabled: true },
    });
    const disabled = row?.authDisabled ?? false;
    setAuthDisabledCache(disabled);
    return NextResponse.json({ disabled });
  } catch {
    return NextResponse.json({ disabled: false });
  }
}
