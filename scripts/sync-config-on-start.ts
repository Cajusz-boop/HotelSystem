/**
 * Uruchamiany automatycznie przed `npm run dev`.
 * Sprawdza czy config-snapshot.json jest nowszy niż baza i importuje różnice.
 * Dzięki temu po `git pull` konfiguracja z drugiego komputera trafia do bazy automatycznie.
 */
import "dotenv/config";
import { existsSync, readFileSync, statSync } from "fs";
import { join } from "path";

const SNAPSHOT_PATH = join(__dirname, "..", "prisma", "config-snapshot.json");

async function main() {
  if (!existsSync(SNAPSHOT_PATH)) return;

  const { prisma } = await import("../lib/db");

  try {
    const snapshot = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf-8"));
    const snapshotDate = snapshot._exportedAt ? new Date(snapshot._exportedAt) : statSync(SNAPSHOT_PATH).mtime;

    const dbConfig = await prisma.hotelConfig.findUnique({
      where: { id: "default" },
      select: { updatedAt: true },
    });

    if (dbConfig && dbConfig.updatedAt >= snapshotDate) {
      return;
    }

    console.log("[sync-config] Snapshot nowszy niż baza — importuję konfigurację...");
    const { execSync } = await import("child_process");
    execSync("npx tsx prisma/config-import.ts", {
      stdio: "inherit",
      cwd: join(__dirname, ".."),
    });
    console.log("[sync-config] Gotowe.");
  } catch (e) {
    console.warn("[sync-config] Nie udało się zsynchronizować:", (e as Error).message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
