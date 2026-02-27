/**
 * extract-kwhotel-channel-manager.ts
 *
 * Skrypt do wyciągnięcia konfiguracji Channel Managera z bazy KWHotel.
 * Przeszukuje wszystkie tabele związane z integracjami, API, kanałami sprzedaży.
 *
 * Wymaga:
 *   1. Bazy `kwhotel_import` zaimportowanej z kw.sql (XAMPP MySQL)
 *   2. Pakietu mysql2: npm install mysql2 --save-dev
 *
 * Uruchomienie:
 *   npx tsx prisma/extract-kwhotel-channel-manager.ts
 *
 * Opcje środowiskowe:
 *   KW_DATABASE_URL  – URL do bazy KWHotel (domyślnie: mysql://root@127.0.0.1:3306/kwhotel_import)
 */

import "dotenv/config";
import mysql, { RowDataPacket } from "mysql2/promise";
import * as fs from "fs";

const KW_URL = process.env.KW_DATABASE_URL ?? "mysql://root@127.0.0.1:3306/kwhotel_import";

interface TableInfo extends RowDataPacket {
  TABLE_NAME: string;
}

interface ColumnInfo extends RowDataPacket {
  COLUMN_NAME: string;
  DATA_TYPE: string;
}

// Słowa kluczowe związane z Channel Managerem
const CM_KEYWORDS = [
  'channel', 'api', 'token', 'key', 'secret', 'wubook', 'channex', 'booking',
  'expedia', 'airbnb', 'sync', 'integration', 'external', 'online', 'ota',
  'cubilis', 'siteminder', 'beds24', 'webhook', 'endpoint', 'url', 'credential',
  'config', 'setting', 'opcje', 'konfiguracja', 'parametr', 'hotel_id', 'property_id'
];

async function main() {
  console.log("╔═══════════════════════════════════════════════════════════════╗");
  console.log("║  Ekstrakcja konfiguracji Channel Managera z KWHotel          ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝\n");

  const kw = await mysql.createConnection(KW_URL);
  console.log("✔ Połączono z bazą KWHotel\n");

  const results: Record<string, unknown> = {
    extractedAt: new Date().toISOString(),
    database: KW_URL.replace(/:[^:@]+@/, ':***@'), // ukryj hasło
    channelManagerConfig: {},
    bookingSources: [],
    apiSettings: [],
    relevantTables: [],
    allTables: [],
  };

  // 1. Pobierz listę wszystkich tabel
  console.log("=== 1. Lista wszystkich tabel w bazie ===\n");
  const dbName = KW_URL.split('/').pop()?.split('?')[0] || 'kwhotel_import';
  const [tables] = await kw.query<TableInfo[]>(
    `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ?`,
    [dbName]
  );

  results.allTables = tables.map(t => t.TABLE_NAME);
  console.log(`Znaleziono ${tables.length} tabel.\n`);

  // 2. Szukaj tabel związanych z Channel Managerem
  console.log("=== 2. Tabele potencjalnie związane z Channel Managerem ===\n");
  const relevantTables: string[] = [];

  for (const table of tables) {
    const tableName = table.TABLE_NAME.toLowerCase();
    const isRelevant = CM_KEYWORDS.some(kw => tableName.includes(kw));

    if (isRelevant) {
      relevantTables.push(table.TABLE_NAME);
      console.log(`  📁 ${table.TABLE_NAME}`);
    }
  }

  // Dodaj tabele które mogą zawierać konfigurację
  const configTables = ['opcje', 'settings', 'config', 'konfiguracja', 'parametry', 
    'rez_skad', 'channels', 'channel_manager', 'api_config', 'integrations'];
  
  for (const table of tables) {
    if (configTables.includes(table.TABLE_NAME.toLowerCase()) && !relevantTables.includes(table.TABLE_NAME)) {
      relevantTables.push(table.TABLE_NAME);
      console.log(`  📁 ${table.TABLE_NAME} (config table)`);
    }
  }

  results.relevantTables = relevantTables;

  // 3. Dla każdej znalezionej tabeli, pobierz strukturę i dane
  console.log("\n=== 3. Zawartość istotnych tabel ===\n");

  for (const tableName of relevantTables) {
    console.log(`\n--- Tabela: ${tableName} ---`);
    
    // Pobierz strukturę
    const [columns] = await kw.query<ColumnInfo[]>(
      `SELECT COLUMN_NAME, DATA_TYPE FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
      [dbName, tableName]
    );
    
    console.log(`Kolumny: ${columns.map(c => c.COLUMN_NAME).join(', ')}`);

    // Pobierz dane (max 100 wierszy)
    try {
      const [rows] = await kw.query<RowDataPacket[]>(
        `SELECT * FROM \`${tableName}\` LIMIT 100`
      );
      
      if (rows.length > 0) {
        console.log(`Wiersze: ${rows.length}`);
        (results.channelManagerConfig as Record<string, unknown>)[tableName] = {
          columns: columns.map(c => ({ name: c.COLUMN_NAME, type: c.DATA_TYPE })),
          rowCount: rows.length,
          data: rows,
        };
        
        // Wyświetl pierwsze 5 wierszy
        console.log("Przykładowe dane:");
        rows.slice(0, 5).forEach((row, i) => {
          console.log(`  [${i + 1}] ${JSON.stringify(row)}`);
        });
      } else {
        console.log("  (tabela pusta)");
      }
    } catch (err) {
      console.log(`  ⚠ Błąd odczytu: ${err}`);
    }
  }

  // 4. Szukaj kolumn z API/token/key w WSZYSTKICH tabelach
  console.log("\n=== 4. Szukanie kolumn z konfiguracją API we wszystkich tabelach ===\n");

  const apiColumns: Array<{ table: string; column: string; type: string; sampleValue: unknown }> = [];

  for (const table of tables) {
    const [columns] = await kw.query<ColumnInfo[]>(
      `SELECT COLUMN_NAME, DATA_TYPE FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
      [dbName, table.TABLE_NAME]
    );

    for (const col of columns) {
      const colName = col.COLUMN_NAME.toLowerCase();
      const hasApiKeyword = ['api', 'token', 'key', 'secret', 'password', 'credential', 
        'url', 'endpoint', 'webhook', 'channel_id', 'property_id', 'hotel_id', 'external']
        .some(kw => colName.includes(kw));

      if (hasApiKeyword) {
        // Pobierz przykładową wartość
        try {
          const [sample] = await kw.query<RowDataPacket[]>(
            `SELECT \`${col.COLUMN_NAME}\` FROM \`${table.TABLE_NAME}\` 
             WHERE \`${col.COLUMN_NAME}\` IS NOT NULL AND \`${col.COLUMN_NAME}\` != '' 
             LIMIT 1`
          );
          
          const sampleValue = sample.length > 0 ? sample[0][col.COLUMN_NAME] : null;
          
          apiColumns.push({
            table: table.TABLE_NAME,
            column: col.COLUMN_NAME,
            type: col.DATA_TYPE,
            sampleValue: sampleValue ? String(sampleValue).substring(0, 50) + (String(sampleValue).length > 50 ? '...' : '') : null,
          });

          console.log(`  🔑 ${table.TABLE_NAME}.${col.COLUMN_NAME} (${col.DATA_TYPE}) = ${sampleValue ? '"...' + String(sampleValue).substring(0, 30) + '..."' : 'NULL'}`);
        } catch {
          // ignoruj błędy
        }
      }
    }
  }

  results.apiSettings = apiColumns;

  // 5. Źródła rezerwacji (rez_skad) - lista kanałów OTA
  console.log("\n=== 5. Źródła rezerwacji (kanały OTA) ===\n");

  try {
    const [sources] = await kw.query<RowDataPacket[]>("SELECT * FROM rez_skad ORDER BY rsk_id");
    results.bookingSources = sources;
    
    console.log("Skonfigurowane kanały sprzedaży:");
    sources.forEach((s, i) => {
      console.log(`  ${i + 1}. [ID: ${s.rsk_id}] ${s.rsk_nazwa}`);
    });
  } catch {
    console.log("  Tabela rez_skad nie istnieje");
  }

  // 6. Szukaj tabel z "channel" w nazwie lub danych
  console.log("\n=== 6. Statystyki rezerwacji per kanał ===\n");

  try {
    const [channelStats] = await kw.query<RowDataPacket[]>(`
      SELECT 
        COALESCE(rs.rsk_nazwa, 'Nieznany') as kanal,
        COUNT(*) as liczba_rezerwacji,
        MIN(r.DataOd) as pierwsza_rezerwacja,
        MAX(r.DataOd) as ostatnia_rezerwacja
      FROM rezerwacje r
      LEFT JOIN rez_skad rs ON r.rez_rsk_id = rs.rsk_id
      GROUP BY r.rez_rsk_id, rs.rsk_nazwa
      ORDER BY liczba_rezerwacji DESC
    `);

    console.log("Rezerwacje wg kanału:");
    channelStats.forEach(s => {
      console.log(`  ${s.kanal}: ${s.liczba_rezerwacji} rezerwacji (${s.pierwsza_rezerwacja} - ${s.ostatnia_rezerwacja})`);
    });
    
    (results as Record<string, unknown>).channelStats = channelStats;
  } catch (err) {
    console.log(`  Błąd: ${err}`);
  }

  // 7. Zapisz wyniki do pliku JSON
  const outputPath = "prisma/kwhotel-channel-manager-config.json";
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), "utf-8");
  console.log(`\n✔ Wyniki zapisano do: ${outputPath}`);

  // 8. Podsumowanie
  console.log("\n╔═══════════════════════════════════════════════════════════════╗");
  console.log("║  PODSUMOWANIE                                                ║");
  console.log("╠═══════════════════════════════════════════════════════════════╣");
  console.log(`║  Tabel w bazie:           ${String(tables.length).padStart(5)}                          ║`);
  console.log(`║  Tabel z konfiguracją CM: ${String(relevantTables.length).padStart(5)}                          ║`);
  console.log(`║  Kolumn API/token/key:    ${String(apiColumns.length).padStart(5)}                          ║`);
  console.log(`║  Źródeł rezerwacji:       ${String((results.bookingSources as unknown[]).length).padStart(5)}                          ║`);
  console.log("╠═══════════════════════════════════════════════════════════════╣");
  console.log("║  Plik z wynikami: prisma/kwhotel-channel-manager-config.json ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝");

  console.log("\n📋 CO DALEJ:");
  console.log("   1. Przejrzyj plik JSON z wynikami");
  console.log("   2. Jeśli Channel Manager używa zewnętrznego API (np. Wubook, Channex),");
  console.log("      poszukaj plików konfiguracyjnych KW Hotel na serwerze/komputerze");
  console.log("   3. Sprawdź panel administracyjny KW Hotel → Ustawienia → Integracje");
  console.log("   4. Przekaż mi wyniki lub nazwę Channel Managera");

  await kw.end();
}

main().catch((e) => {
  console.error("❌ Błąd:", e);
  process.exit(1);
});
