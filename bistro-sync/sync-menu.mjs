#!/usr/bin/env node
/**
 * sync-menu.mjs — Synchronizacja karty dań z Bistro (assortment) → HotelSystem MenuItem
 *
 * Czyta z tabeli assortment (lub assertyment) w bazie Bistro i wysyła do API
 * POST /api/v1/external/menu-sync.
 *
 * ENV (bistro-sync/.env):
 *   BISTRO_DATABASE_URL  — mysql://admin:haslo@10.119.169.20:3306/kwhotel
 *   MENU_SYNC_URL        — https://hotel.karczma-labedz.pl/api/v1/external/menu-sync
 *   EXTERNAL_API_KEY     — klucz API (EXTERNAL_API_KEY z .env aplikacji)
 *
 * Użycie:
 *   node bistro-sync/sync-menu.mjs
 *   node bistro-sync/sync-menu.mjs --once   # jeden przebieg, bez pętli
 *
 * Harmonogram: uruchom co 5–10 min (np. Task Scheduler)
 */

import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadDotenv(filePath) {
  try {
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq < 1) continue;
      const key = t.slice(0, eq).trim();
      let val = t.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    /* ignoruj */
  }
}

loadDotenv(path.join(__dirname, ".env"));

const BISTRO_URL = process.env.BISTRO_DATABASE_URL?.trim();
const MENU_SYNC_URL = process.env.MENU_SYNC_URL?.trim();
const EXTERNAL_API_KEY = process.env.EXTERNAL_API_KEY?.trim();

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function validate() {
  const err = [];
  if (!BISTRO_URL) err.push("Brak BISTRO_DATABASE_URL");
  if (!MENU_SYNC_URL) err.push("Brak MENU_SYNC_URL");
  if (!EXTERNAL_API_KEY) err.push("Brak EXTERNAL_API_KEY");
  if (err.length) {
    log("BŁĄD: " + err.join(", "));
    process.exit(1);
  }
}

async function syncMenu() {
  validate();

  const conn = await mysql.createConnection(BISTRO_URL);
  try {
    const [tables] = await conn.query("SHOW TABLES");
    const names = tables.map((r) => Object.values(r)[0]);
    const tableName = names.find((t) => /^assortment$/i.test(t) || /^assertyment$/i.test(t));
    if (!tableName) {
      log("Nie znaleziono tabeli assortment/assertyment");
      return;
    }

    const [rows] = await conn.query(
      `SELECT AssortmentID, Nazwa, Brutto, Kategoria, \`GroupID\`, Active FROM \`${tableName}\` WHERE Active = 1`
    );

    const items = rows.map((r) => ({
      externalId: String(r.AssortmentID),
      name: String(r.Nazwa || "").trim() || "Bez nazwy",
      price: parseFloat(r.Brutto) || 0,
      category: String(r.Kategoria || "").trim() || "Inne",
    }));

    const valid = items.filter((i) => i.name !== "Bez nazwy" && i.price >= 0);
    if (valid.length === 0) {
      log("Brak aktywnych pozycji do synchronizacji");
      return;
    }

    const res = await fetch(MENU_SYNC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": EXTERNAL_API_KEY,
      },
      body: JSON.stringify({ items: valid }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `HTTP ${res.status}`);
    }

    log(`Karta dań: ${data.created ?? 0} nowych, ${data.updated ?? 0} zaktualizowanych (${valid.length} pozycji)`);
  } finally {
    await conn.end();
  }
}

async function main() {
  const once = process.argv.includes("--once");
  const intervalMinutes = parseInt(process.env.SYNC_INTERVAL_MINUTES || "5", 10) || 5;

  if (once) {
    await syncMenu();
    return;
  }

  log(`Start synchronizacji menu (co ${intervalMinutes} min)`);
  while (true) {
    try {
      await syncMenu();
    } catch (e) {
      log("Błąd: " + (e.message || e));
    }
    await new Promise((r) => setTimeout(r, intervalMinutes * 60 * 1000));
  }
}

main().catch((e) => {
  log("Krytyczny błąd: " + (e.message || e));
  process.exit(1);
});
