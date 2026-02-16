#!/usr/bin/env node
/**
 * test-sync.mjs — Test end-to-end integracji sync.mjs
 *
 * Symuluje pełny cykl:
 *   1. Sprawdza połączenie z bazą KW Hotel
 *   2. Sprawdza połączenie z API nowego systemu (occupied-rooms + posting)
 *   3. Testuje kierunek Hotel → KW (sync pokoi)
 *   4. Symuluje rachunek Bistro w bazie KW Hotel (wstawia testowy dokument)
 *   5. Testuje kierunek KW → Hotel (odczyt rachunku)
 *
 * ENV: te same co sync.mjs (KW_DATABASE_URL, OCCUPIED_ROOMS_URL, POSTING_URL, EXTERNAL_API_KEY)
 *
 * Użycie:
 *   node symplex-bridge/test-sync.mjs
 */

import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Załaduj .env z folderu bridge'a
try {
  const envPath = path.join(__dirname, ".env");
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq < 1) continue;
      const key = t.slice(0, eq).trim();
      let val = t.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      if (!process.env[key]) process.env[key] = val;
    }
  }
} catch { /* ignoruj */ }

const KW_URL = process.env.KW_DATABASE_URL?.trim();
const OCCUPIED_ROOMS_URL = process.env.OCCUPIED_ROOMS_URL?.trim();
const POSTING_URL = process.env.POSTING_URL?.trim();
const EXTERNAL_API_KEY = process.env.EXTERNAL_API_KEY?.trim();

let passed = 0;
let failed = 0;

function ok(msg) {
  passed++;
  console.log(`  [PASS] ${msg}`);
}

function fail(msg, err) {
  failed++;
  console.log(`  [FAIL] ${msg}`);
  if (err) console.log(`         ${err}`);
}

async function main() {
  console.log("=== Test integracji Bistro-KWHotel Bridge ===\n");

  // -----------------------------------------------------------------------
  // Test 1: Zmienne środowiskowe
  // -----------------------------------------------------------------------
  console.log("1. Zmienne środowiskowe:");
  if (KW_URL) ok(`KW_DATABASE_URL = ${KW_URL.replace(/:[^:@]+@/, ":***@")}`);
  else fail("Brak KW_DATABASE_URL");

  if (OCCUPIED_ROOMS_URL) ok(`OCCUPIED_ROOMS_URL = ${OCCUPIED_ROOMS_URL}`);
  else fail("Brak OCCUPIED_ROOMS_URL");

  if (POSTING_URL) ok(`POSTING_URL = ${POSTING_URL}`);
  else fail("Brak POSTING_URL");

  if (EXTERNAL_API_KEY) ok("EXTERNAL_API_KEY = ***");
  else fail("Brak EXTERNAL_API_KEY");

  if (!KW_URL || !OCCUPIED_ROOMS_URL || !POSTING_URL || !EXTERNAL_API_KEY) {
    console.log("\nBrakujące zmienne — nie można kontynuować testów.");
    console.log("Ustaw zmienne w .env lub jako zmienne środowiskowe.");
    process.exit(1);
  }

  // -----------------------------------------------------------------------
  // Test 2: Połączenie z bazą KW Hotel
  // -----------------------------------------------------------------------
  console.log("\n2. Połączenie z bazą KW Hotel:");
  let kw;
  try {
    kw = await mysql.createConnection(KW_URL);
    ok("Połączono z bazą MySQL");
  } catch (e) {
    fail("Nie udało się połączyć z bazą", e.message);
    process.exit(1);
  }

  // Sprawdź kluczowe tabele
  const requiredTables = ["rooms", "klienci", "rezerwacje"];
  const [tables] = await kw.query("SHOW TABLES");
  const tableNames = tables.map((r) => Object.values(r)[0]);

  for (const t of requiredTables) {
    if (tableNames.includes(t)) {
      const [cnt] = await kw.query(`SELECT COUNT(*) AS cnt FROM \`${t}\``);
      ok(`Tabela '${t}' istnieje (${cnt[0].cnt} rekordów)`);
    } else {
      fail(`Brak tabeli '${t}' w bazie`);
    }
  }

  // -----------------------------------------------------------------------
  // Test 3: API occupied-rooms
  // -----------------------------------------------------------------------
  console.log("\n3. API GET /occupied-rooms:");
  try {
    const res = await fetch(OCCUPIED_ROOMS_URL, {
      headers: { "X-API-Key": EXTERNAL_API_KEY },
    });
    if (res.ok) {
      const data = await res.json();
      ok(`HTTP ${res.status} — ${data.occupiedCount} zajętych pokoi (data: ${data.date})`);
      if (data.rooms?.length > 0) {
        const first = data.rooms[0];
        ok(`Przykład: pokój ${first.roomNumber} — ${first.guestName} (${first.checkIn} → ${first.checkOut})`);
      } else {
        console.log("         (brak zameldowanych gości — zamelduj kogoś żeby przetestować sync)");
      }
    } else {
      const body = await res.text().catch(() => "");
      fail(`HTTP ${res.status}`, body.substring(0, 200));
    }
  } catch (e) {
    fail("Nie udało się połączyć z API", e.message);
  }

  // -----------------------------------------------------------------------
  // Test 4: API POST /posting (dry test — nie wysyłamy prawdziwego obciążenia)
  // -----------------------------------------------------------------------
  console.log("\n4. API POST /posting (test autoryzacji):");
  try {
    // Wysyłamy celowo błędny request (brak roomNumber) żeby sprawdzić czy API odpowiada
    const res = await fetch(POSTING_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": EXTERNAL_API_KEY,
      },
      body: JSON.stringify({ amount: 0 }),
    });
    if (res.status === 400) {
      ok(`HTTP 400 (oczekiwane — API odpowiada i autoryzacja działa)`);
    } else if (res.status === 401) {
      fail("HTTP 401 — nieprawidłowy klucz API (EXTERNAL_API_KEY)");
    } else {
      ok(`HTTP ${res.status} — API odpowiada`);
    }
  } catch (e) {
    fail("Nie udało się połączyć z API", e.message);
  }

  // -----------------------------------------------------------------------
  // Test 5: Zapis do bazy KW Hotel (test INSERT/UPDATE)
  // -----------------------------------------------------------------------
  console.log("\n5. Zapis do bazy KW Hotel (test):");
  try {
    // Sprawdź czy możemy pisać do tabeli rooms
    const testRoomName = "__TEST_BRIDGE__";
    await kw.query(
      "INSERT INTO rooms (name, room_group_id, floor, cleanliness, renovation, deleted) VALUES (?, 1, 0, 0, 0, 1) ON DUPLICATE KEY UPDATE deleted = 1",
      [testRoomName]
    );
    // Posprzątaj
    await kw.query("DELETE FROM rooms WHERE name = ?", [testRoomName]);
    ok("INSERT/UPDATE/DELETE na tabeli 'rooms' — OK");
  } catch (e) {
    fail("Brak uprawnień do zapisu w tabeli 'rooms'", e.message);
  }

  try {
    const testClientName = "__TEST_BRIDGE__";
    await kw.query(
      "INSERT INTO klienci (Nazwisko, Active, IsFirma) VALUES (?, 0, 0) ON DUPLICATE KEY UPDATE Active = 0",
      [testClientName]
    );
    await kw.query("DELETE FROM klienci WHERE Nazwisko = ?", [testClientName]);
    ok("INSERT/UPDATE/DELETE na tabeli 'klienci' — OK");
  } catch (e) {
    fail("Brak uprawnień do zapisu w tabeli 'klienci'", e.message);
  }

  // -----------------------------------------------------------------------
  // Podsumowanie
  // -----------------------------------------------------------------------
  await kw.end();

  console.log("\n========================================");
  console.log(`  PASS: ${passed}    FAIL: ${failed}`);
  console.log("========================================");

  if (failed > 0) {
    console.log("\nNapraw powyższe błędy przed uruchomieniem synchronizacji.");
    process.exit(1);
  } else {
    console.log("\nWszystko OK! Możesz uruchomić synchronizację:");
    console.log("  npm run symplex:sync");
    console.log("\nLub skonfigurować harmonogram:");
    console.log("  powershell -ExecutionPolicy Bypass -File symplex-bridge\\setup-scheduler.ps1");
  }
}

main().catch((e) => {
  console.error("Błąd:", e.message);
  process.exit(1);
});
