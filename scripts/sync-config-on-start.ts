/**
 * Uruchamiany automatycznie przed `npm run dev`.
 * Zawsze importuje config-snapshot.json do bazy — snapshot z repo jest źródłem prawdy.
 */
import "dotenv/config";
import { existsSync } from "fs";
import { join } from "path";

const SNAPSHOT_PATH = join(__dirname, "..", "prisma", "config-snapshot.json");

async function main() {
  if (!existsSync(SNAPSHOT_PATH)) {
    console.log("[sync-config] Brak config-snapshot.json — pomijam.");
    return;
  }

  try {
    console.log("[sync-config] Importuję konfigurację z config-snapshot.json...");
    const { execSync } = await import("child_process");
    execSync("npx tsx prisma/config-import.ts", {
      stdio: "inherit",
      cwd: join(__dirname, ".."),
    });
    console.log("[sync-config] Gotowe.");
  } catch (e) {
    console.warn("[sync-config] Nie udało się zsynchronizować:", (e as Error).message);
  }
}

main();
