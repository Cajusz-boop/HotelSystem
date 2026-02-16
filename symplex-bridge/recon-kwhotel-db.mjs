#!/usr/bin/env node
/**
 * recon-kwhotel-db.mjs
 *
 * Skrypt diagnostyczny — uruchom na komputerze z dostępem do bazy KW Hotel / Symplex.
 * Wyświetla listę baz, tabel i kluczowych struktur, żeby ustalić jak Bistro
 * przechowuje dane pokoi, gości i rachunków.
 *
 * Wymaga: mysql2 (npm install mysql2)
 *
 * Użycie:
 *   node symplex-bridge/recon-kwhotel-db.mjs
 *
 * ENV:
 *   KW_DATABASE_URL  — URL do bazy KW Hotel, np. mysql://root:pass@192.168.1.10:3306/kwhotel
 *                      Jeśli nie podasz nazwy bazy, skrypt wylistuje wszystkie bazy.
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

const KW_URL =
  process.env.KW_DATABASE_URL?.trim() ||
  "mysql://root@127.0.0.1:3306/kwhotel_import";

async function main() {
  console.log("=== Recon: baza KW Hotel / Symplex ===\n");
  console.log(`URL: ${KW_URL.replace(/:[^:@]+@/, ":***@")}\n`);

  const conn = await mysql.createConnection(KW_URL);

  // 1. Lista baz danych
  console.log("--- SHOW DATABASES ---");
  const [dbs] = await conn.query("SHOW DATABASES");
  for (const row of dbs) {
    const name = Object.values(row)[0];
    console.log(`  ${name}`);
  }

  // 2. Lista tabel w bieżącej bazie
  const [currentDb] = await conn.query("SELECT DATABASE() AS db");
  const dbName = currentDb[0]?.db;
  if (!dbName) {
    console.log(
      "\nBrak wybranej bazy. Podaj nazwę bazy w URL, np. mysql://root:pass@host:3306/NAZWA_BAZY"
    );
    await conn.end();
    return;
  }

  console.log(`\n--- TABELE w bazie: ${dbName} ---`);
  const [tables] = await conn.query("SHOW TABLES");
  const tableNames = tables.map((r) => Object.values(r)[0]);
  for (const t of tableNames) {
    console.log(`  ${t}`);
  }

  // 3. Struktura kluczowych tabel
  const interestingPatterns = [
    "room",
    "pokoj",
    "klient",
    "rezerw",
    "dokument",
    "rachunek",
    "faktur",
    "sprzedaz",
    "paragon",
    "pozycj",
    "poz_",
    "zamow",
    "kontrah",
    "hotel",
    "bistro",
    "gastro",
  ];

  const matchedTables = tableNames.filter((t) =>
    interestingPatterns.some((p) => t.toLowerCase().includes(p))
  );

  if (matchedTables.length > 0) {
    console.log(`\n--- STRUKTURA kluczowych tabel (${matchedTables.length}) ---`);
    for (const t of matchedTables) {
      console.log(`\n  >> ${t}`);
      const [cols] = await conn.query(`DESCRIBE \`${t}\``);
      for (const c of cols) {
        const nullable = c.Null === "YES" ? " NULL" : "";
        const key = c.Key === "PRI" ? " [PK]" : c.Key === "UNI" ? " [UQ]" : "";
        console.log(`     ${c.Field} ${c.Type}${nullable}${key}`);
      }
      // Pokaż liczbę rekordów
      try {
        const [cnt] = await conn.query(`SELECT COUNT(*) AS cnt FROM \`${t}\``);
        console.log(`     (${cnt[0].cnt} rekordów)`);
      } catch {
        console.log(`     (nie udało się policzyć rekordów)`);
      }
    }
  }

  // 4. Próbka aktywnych rezerwacji (status_id=2 = CHECKED_IN w KW Hotel)
  if (tableNames.includes("rezerwacje")) {
    console.log("\n--- AKTYWNE REZERWACJE (status_id=2, limit 5) ---");
    try {
      const [rows] = await conn.query(
        "SELECT RezerwacjaID, PokojID, KlientID, DataOd, DataDo, status_id, status2_id, Cena FROM rezerwacje WHERE status_id = 2 LIMIT 5"
      );
      if (rows.length === 0) {
        console.log("  Brak aktywnych rezerwacji (status_id=2).");
      } else {
        for (const r of rows) {
          console.log(`  Rez#${r.RezerwacjaID} Pokój=${r.PokojID} Klient=${r.KlientID} ${r.DataOd}→${r.DataDo} status=${r.status_id}/${r.status2_id} Cena=${r.Cena}`);
        }
      }
    } catch (e) {
      console.log(`  Błąd: ${e.message}`);
    }
  }

  // 5. Próbka dokumentów sprzedaży (szukamy rachunków Bistro)
  const docTables = tableNames.filter((t) =>
    /dokument|rachunek|faktur|sprzedaz|paragon/i.test(t)
  );
  if (docTables.length > 0) {
    console.log("\n--- PRÓBKA DOKUMENTÓW SPRZEDAŻY ---");
    for (const t of docTables) {
      console.log(`\n  >> ${t} (ostatnie 3 rekordy)`);
      try {
        const [rows] = await conn.query(`SELECT * FROM \`${t}\` ORDER BY 1 DESC LIMIT 3`);
        for (const r of rows) {
          console.log(`     ${JSON.stringify(r)}`);
        }
      } catch (e) {
        console.log(`     Błąd: ${e.message}`);
      }
    }
  }

  console.log("\n=== Recon zakończony ===");
  console.log("Skopiuj wynik i wklej do czatu — na tej podstawie napiszę skrypt synchronizacji.");

  await conn.end();
}

main().catch((e) => {
  console.error("Błąd połączenia:", e.message);
  console.error(
    "\nSprawdź KW_DATABASE_URL. Przykład: KW_DATABASE_URL=mysql://root:haslo@192.168.1.10:3306/kwhotel"
  );
  process.exit(1);
});
