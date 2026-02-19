#!/usr/bin/env node
/**
 * run-sync.mjs — Uruchamia pełną synchronizację Bistro ↔ Hotel:
 * 1. Karta dań (assortment → MenuItem)
 * 2. Rachunki na pokój (dokumenty Bistro → POST /posting)
 *
 * Wymaga skonfigurowania:
 *   - bistro-sync/.env (menu)
 *   - symplex-bridge/.env (rachunki, pokoje)
 *
 * Użycie:
 *   node bistro-sync/run-sync.mjs
 *
 * Uruchom w Harmonogramie Zadań co 2 min.
 */

import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

async function run(cmd, args = []) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, {
      cwd: root,
      stdio: "inherit",
      shell: true,
    });
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`exit ${code}`))));
    p.on("error", reject);
  });
}

async function main() {
  try {
    await run("node", ["bistro-sync/sync-menu.mjs", "--once"]);
  } catch (e) {
    console.error("[menu] błąd:", e.message);
  }
  try {
    await run("node", ["symplex-bridge/sync.mjs"]);
  } catch (e) {
    console.error("[symplex] błąd:", e.message);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
