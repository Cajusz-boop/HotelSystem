#!/usr/bin/env node
/**
 * sync.mjs — Dwukierunkowy synchronizator: nowy system hotelowy ↔ baza KW Hotel (Bistro)
 *
 * Kierunek 1 (Hotel → Bistro):
 *   Pobiera zajęte pokoje z API nowego systemu i zapisuje je do tabel KW Hotel
 *   (rooms, klienci, rezerwacje), żeby Bistro widziało aktualną listę pokoi z gośćmi.
 *
 * Kierunek 2 (Bistro → Hotel):
 *   Czyta nowe dokumenty sprzedaży (rachunki "na pokój") z bazy KW Hotel
 *   i wysyła je do API nowego systemu (POST /api/v1/external/posting).
 *
 * ENV:
 *   KW_DATABASE_URL     — URL do bazy KW Hotel (mysql://user:pass@host:port/db)
 *   OCCUPIED_ROOMS_URL  — URL API nowego systemu (GET /api/v1/external/occupied-rooms)
 *   POSTING_URL         — URL API nowego systemu (POST /api/v1/external/posting)
 *   EXTERNAL_API_KEY    — klucz API (wspólny dla obu endpointów)
 *   SYNC_DIRECTION      — "both" (domyślnie), "to-kw", "from-kw"
 *   SYNC_LOG_FILE       — ścieżka do pliku logów (opcjonalnie)
 *
 * Użycie:
 *   node symplex-bridge/sync.mjs                    # oba kierunki
 *   node symplex-bridge/sync.mjs --to-kw            # tylko pokoje → KW Hotel
 *   node symplex-bridge/sync.mjs --from-kw          # tylko rachunki → nowy system
 *   node symplex-bridge/sync.mjs --recon            # diagnostyka bazy
 */

import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Załaduj .env z folderu bridge'a (symplex-bridge/.env)
loadDotenv(path.join(__dirname, ".env"));

function loadDotenv(filePath) {
  try {
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx < 1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  } catch {
    // ignoruj błędy ładowania .env
  }
}

// ---------------------------------------------------------------------------
// Konfiguracja
// ---------------------------------------------------------------------------

const KW_URL = process.env.KW_DATABASE_URL?.trim();
const OCCUPIED_ROOMS_URL = process.env.OCCUPIED_ROOMS_URL?.trim();
const POSTING_URL = process.env.POSTING_URL?.trim();
const EXTERNAL_API_KEY = process.env.EXTERNAL_API_KEY?.trim();
const LOG_FILE = process.env.SYNC_LOG_FILE?.trim();

const args = process.argv.slice(2);
const directionArg = args.find((a) => a.startsWith("--"));
const DIRECTION =
  directionArg === "--to-kw"
    ? "to-kw"
    : directionArg === "--from-kw"
      ? "from-kw"
      : directionArg === "--recon"
        ? "recon"
        : process.env.SYNC_DIRECTION?.trim() || "both";

// Plik stanu — zapamiętuje ostatnio przetworzony ID rachunku
const STATE_FILE = path.join(__dirname, ".sync-state.json");

// ---------------------------------------------------------------------------
// Logowanie
// ---------------------------------------------------------------------------

function log(level, msg) {
  const ts = new Date().toISOString();
  const line = `[${ts}] [${level}] ${msg}`;
  console.log(line);
  if (LOG_FILE) {
    try {
      fs.appendFileSync(LOG_FILE, line + "\n");
    } catch {
      // ignoruj błędy zapisu logów
    }
  }
}

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    }
  } catch {
    // ignoruj
  }
  return { lastProcessedDocId: 0, lastSyncTime: null };
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ---------------------------------------------------------------------------
// Walidacja
// ---------------------------------------------------------------------------

function validateConfig() {
  const errors = [];
  if (!KW_URL) errors.push("Brak KW_DATABASE_URL");
  if (DIRECTION !== "from-kw" && !OCCUPIED_ROOMS_URL)
    errors.push("Brak OCCUPIED_ROOMS_URL (wymagany dla kierunku to-kw/both)");
  if (DIRECTION !== "to-kw" && !POSTING_URL)
    errors.push("Brak POSTING_URL (wymagany dla kierunku from-kw/both)");
  if (!EXTERNAL_API_KEY) errors.push("Brak EXTERNAL_API_KEY");
  if (errors.length > 0) {
    log("ERROR", "Brakujące zmienne środowiskowe:");
    errors.forEach((e) => log("ERROR", `  - ${e}`));
    log(
      "INFO",
      "Ustaw zmienne w pliku .env bridge'a lub jako zmienne środowiskowe."
    );
    process.exit(1);
  }
}

// =========================================================================
// KIERUNEK 1: Hotel → KW Hotel (pokoje z gośćmi)
// =========================================================================

/**
 * Pobiera zajęte pokoje z API nowego systemu i synchronizuje do bazy KW Hotel.
 *
 * Strategia:
 *  1. Pobierz listę zajętych pokoi z GET /api/v1/external/occupied-rooms
 *  2. Dla każdego pokoju upewnij się, że istnieje w tabeli `rooms`
 *  3. Dla każdego gościa upewnij się, że istnieje w tabeli `klienci`
 *  4. Utwórz/aktualizuj rezerwację w tabeli `rezerwacje` ze status_id=2 (CHECKED_IN)
 *  5. Zamknij stare rezerwacje (status_id=2) dla pokoi, które nie są już zajęte
 */
async function syncRoomsToKw(kw) {
  log("INFO", "=== Kierunek 1: Hotel → KW Hotel (pokoje) ===");

  // Pobierz zajęte pokoje z API
  const res = await fetch(OCCUPIED_ROOMS_URL, {
    headers: { "X-API-Key": EXTERNAL_API_KEY },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `API occupied-rooms zwróciło ${res.status}: ${body.substring(0, 200)}`
    );
  }
  const data = await res.json();
  const occupiedRooms = data.rooms || [];
  log("INFO", `Pobrano ${occupiedRooms.length} zajętych pokoi z API (data: ${data.date})`);

  if (occupiedRooms.length === 0) {
    // Zamknij wszystkie aktywne rezerwacje w KW Hotel
    const [result] = await kw.query(
      "UPDATE rezerwacje SET status_id = 3 WHERE status_id = 2"
    );
    if (result.changedRows > 0) {
      log("INFO", `Zamknięto ${result.changedRows} rezerwacji (brak zajętych pokoi)`);
    }
    return;
  }

  // Pobierz istniejące pokoje z KW Hotel
  const [kwRooms] = await kw.query(
    "SELECT id, name FROM rooms WHERE deleted = 0"
  );
  const roomByName = new Map();
  for (const r of kwRooms) {
    roomByName.set(r.name.trim(), r.id);
  }

  // Pobierz istniejących klientów z KW Hotel (szukamy po nazwisku)
  const [kwClients] = await kw.query(
    "SELECT KlientID, Nazwisko FROM klienci WHERE Active = 1"
  );
  const clientByName = new Map();
  for (const c of kwClients) {
    clientByName.set(c.Nazwisko?.trim(), c.KlientID);
  }

  // Pobierz aktywne rezerwacje z KW Hotel
  const [kwActiveRez] = await kw.query(
    "SELECT RezerwacjaID, PokojID, KlientID FROM rezerwacje WHERE status_id = 2"
  );
  const activeRezByRoom = new Map();
  for (const r of kwActiveRez) {
    activeRezByRoom.set(r.PokojID, r);
  }

  // Znajdź max ID-ki do generowania nowych
  const [maxRoom] = await kw.query("SELECT COALESCE(MAX(id), 0) AS m FROM rooms");
  let nextRoomId = maxRoom[0].m + 1;

  const [maxClient] = await kw.query(
    "SELECT COALESCE(MAX(KlientID), 0) AS m FROM klienci"
  );
  let nextClientId = maxClient[0].m + 1;

  const [maxRez] = await kw.query(
    "SELECT COALESCE(MAX(RezerwacjaID), 0) AS m FROM rezerwacje"
  );
  let nextRezId = maxRez[0].m + 1;

  // Zbiór pokoi, które są teraz zajęte (KW room ID)
  const occupiedKwRoomIds = new Set();

  let created = 0;
  let updated = 0;
  let roomsCreated = 0;
  let clientsCreated = 0;

  for (const room of occupiedRooms) {
    const roomNumber = room.roomNumber?.trim();
    const guestName = room.guestName?.trim();
    if (!roomNumber || !guestName) continue;

    // 1. Upewnij się, że pokój istnieje w KW Hotel
    let kwRoomId = roomByName.get(roomNumber);
    if (!kwRoomId) {
      kwRoomId = nextRoomId++;
      await kw.query(
        `INSERT INTO rooms (id, name, room_group_id, floor, cleanliness, renovation, deleted)
         VALUES (?, ?, 1, 0, 0, 0, 0)
         ON DUPLICATE KEY UPDATE deleted = 0`,
        [kwRoomId, roomNumber]
      );
      roomByName.set(roomNumber, kwRoomId);
      roomsCreated++;
    }
    occupiedKwRoomIds.add(kwRoomId);

    // 2. Upewnij się, że gość istnieje w KW Hotel
    let kwClientId = clientByName.get(guestName);
    if (!kwClientId) {
      kwClientId = nextClientId++;
      await kw.query(
        `INSERT INTO klienci (KlientID, Nazwisko, Active, IsFirma)
         VALUES (?, ?, 1, 0)
         ON DUPLICATE KEY UPDATE Nazwisko = VALUES(Nazwisko), Active = 1`,
        [kwClientId, guestName]
      );
      clientByName.set(guestName, kwClientId);
      clientsCreated++;
    }

    // 3. Utwórz/aktualizuj rezerwację
    const checkIn = room.checkIn || new Date().toISOString().slice(0, 10);
    const checkOut = room.checkOut || new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const pax = room.pax || 1;

    const existingRez = activeRezByRoom.get(kwRoomId);
    if (existingRez) {
      // Aktualizuj istniejącą rezerwację
      await kw.query(
        `UPDATE rezerwacje SET KlientID = ?, DataOd = ?, DataDo = ?, Osob = ?, status_id = 2
         WHERE RezerwacjaID = ?`,
        [kwClientId, checkIn, checkOut, pax, existingRez.RezerwacjaID]
      );
      updated++;
    } else {
      // Utwórz nową rezerwację
      const rezId = nextRezId++;
      await kw.query(
        `INSERT INTO rezerwacje (RezerwacjaID, PokojID, KlientID, DataOd, DataDo, Osob, status_id, status2_id, Cena, cena_noc)
         VALUES (?, ?, ?, ?, ?, ?, 2, 0, 0, 0)`,
        [rezId, kwRoomId, kwClientId, checkIn, checkOut, pax]
      );
      created++;
    }
  }

  // 4. Zamknij rezerwacje dla pokoi, które nie są już zajęte
  let closed = 0;
  for (const [roomId, rez] of activeRezByRoom) {
    if (!occupiedKwRoomIds.has(roomId)) {
      await kw.query(
        "UPDATE rezerwacje SET status_id = 3 WHERE RezerwacjaID = ?",
        [rez.RezerwacjaID]
      );
      closed++;
    }
  }

  log(
    "INFO",
    `Pokoje: ${roomsCreated} nowych, Goście: ${clientsCreated} nowych`
  );
  log(
    "INFO",
    `Rezerwacje: ${created} utworzono, ${updated} zaktualizowano, ${closed} zamknięto`
  );
}

// =========================================================================
// KIERUNEK 2: KW Hotel → Hotel (rachunki z Bistro)
// =========================================================================

/**
 * Czyta dokumenty sprzedaży z bazy KW Hotel i wysyła do API nowego systemu.
 *
 * Strategia adaptacyjna — skrypt automatycznie wykrywa strukturę bazy:
 *  - Szuka tabel z rachunkami/dokumentami (dokumenty, dokumenty_sprzedazy, rachunki, itp.)
 *  - Czyta nowe rekordy (ID > ostatnio przetworzony)
 *  - Parsuje pozycje z powiązanej tabeli pozycji
 *  - Wysyła POST /api/v1/external/posting
 *  - Zapisuje ostatni przetworzony ID do pliku stanu
 */
async function syncBillsFromKw(kw) {
  log("INFO", "=== Kierunek 2: KW Hotel → Hotel (rachunki) ===");

  const state = loadState();

  // Wykryj tabelę z dokumentami sprzedaży
  const docTable = await detectDocumentTable(kw);
  if (!docTable) {
    log(
      "WARN",
      "Nie znaleziono tabeli z dokumentami sprzedaży w bazie KW Hotel. " +
        "Uruchom recon (node symplex-bridge/sync.mjs --recon) żeby zbadać strukturę bazy."
    );
    return;
  }

  log("INFO", `Tabela dokumentów: ${docTable.table} (ID: ${docTable.idCol})`);

  // Pobierz nowe dokumenty
  const lastId = state.lastProcessedDocId || 0;
  const [docs] = await kw.query(
    `SELECT * FROM \`${docTable.table}\` WHERE \`${docTable.idCol}\` > ? ORDER BY \`${docTable.idCol}\` ASC LIMIT 100`,
    [lastId]
  );

  if (docs.length === 0) {
    log("INFO", "Brak nowych dokumentów do przetworzenia.");
    return;
  }

  log("INFO", `Znaleziono ${docs.length} nowych dokumentów (od ID > ${lastId})`);

  // Wykryj tabelę pozycji
  const posTable = await detectPositionsTable(kw, docTable);

  let ok = 0;
  let err = 0;
  let maxProcessedId = lastId;

  for (const doc of docs) {
    const docId = doc[docTable.idCol];
    try {
      const posting = await buildPostingFromDoc(kw, doc, docTable, posTable);
      if (!posting) {
        log("DEBUG", `Dok#${docId}: pominięto (nie dotyczy pokoju)`);
        maxProcessedId = Math.max(maxProcessedId, docId);
        continue;
      }

      const result = await postToHotelApi(posting);
      ok++;
      log(
        "INFO",
        `Dok#${docId}: pokój ${posting.roomNumber} ${posting.amount} PLN → txId: ${result.transactionId}`
      );
    } catch (e) {
      err++;
      log("ERROR", `Dok#${docId}: ${e.message}`);
    }
    maxProcessedId = Math.max(maxProcessedId, docId);
  }

  // Zapisz stan
  state.lastProcessedDocId = maxProcessedId;
  state.lastSyncTime = new Date().toISOString();
  saveState(state);

  log("INFO", `Przetworzono: ${ok} OK, ${err} błędów. Ostatni ID: ${maxProcessedId}`);
}

/**
 * Wykrywa tabelę z dokumentami sprzedaży w bazie KW Hotel.
 * Szuka tabel o nazwach pasujących do wzorców.
 */
async function detectDocumentTable(kw) {
  const [tables] = await kw.query("SHOW TABLES");
  const tableNames = tables.map((r) => Object.values(r)[0]);

  // Wzorce nazw tabel z dokumentami sprzedaży (od najbardziej prawdopodobnych)
  const patterns = [
    "dokumenty_sprzedazy",
    "dokumenty",
    "rachunki",
    "faktury",
    "paragony",
    "sprzedaz",
    "dok_sprzedazy",
  ];

  let tableName = null;
  for (const p of patterns) {
    const match = tableNames.find(
      (t) => t.toLowerCase() === p || t.toLowerCase().includes(p)
    );
    if (match) {
      tableName = match;
      break;
    }
  }

  if (!tableName) return null;

  // Wykryj kolumnę ID i kolumnę z numerem pokoju
  const [cols] = await kw.query(`DESCRIBE \`${tableName}\``);
  const colNames = cols.map((c) => c.Field);

  // Kolumna ID (PK)
  const pkCol = cols.find((c) => c.Key === "PRI");
  const idCol = pkCol ? pkCol.Field : colNames[0];

  // Kolumna z numerem pokoju / klienta
  const roomCol =
    colNames.find((c) => /pokoj|room|nrpokoju|pokojid/i.test(c)) ||
    colNames.find((c) => /klient|kontrah/i.test(c)) ||
    null;

  // Kolumna z kwotą
  const amountCol =
    colNames.find((c) => /brutto|wartosc|kwota|suma|amount|total/i.test(c)) ||
    colNames.find((c) => /cena|netto/i.test(c)) ||
    null;

  // Kolumna z numerem dokumentu
  const docNumCol =
    colNames.find((c) => /nrdok|numer|nr_dok|numer_dok/i.test(c)) || null;

  // Kolumna z datą
  const dateCol =
    colNames.find((c) => /data|date|created|czas/i.test(c)) || null;

  return {
    table: tableName,
    idCol,
    roomCol,
    amountCol,
    docNumCol,
    dateCol,
    allCols: colNames,
  };
}

/**
 * Wykrywa tabelę z pozycjami dokumentów.
 */
async function detectPositionsTable(kw, docTable) {
  const [tables] = await kw.query("SHOW TABLES");
  const tableNames = tables.map((r) => Object.values(r)[0]);

  const patterns = [
    "pozycje_dokumentow",
    "pozycje_sprzedazy",
    "pozycje",
    "dok_pozycje",
    "poz_dokumenty",
    "poz_sprzedazy",
    "items",
  ];

  let tableName = null;
  for (const p of patterns) {
    const match = tableNames.find(
      (t) => t.toLowerCase() === p || t.toLowerCase().includes(p)
    );
    if (match) {
      tableName = match;
      break;
    }
  }

  if (!tableName) return null;

  const [cols] = await kw.query(`DESCRIBE \`${tableName}\``);
  const colNames = cols.map((c) => c.Field);

  // Kolumna łącząca z dokumentem
  const docFkCol =
    colNames.find((c) => /dok.*id|document.*id|faktura.*id|rachunek.*id/i.test(c)) ||
    colNames.find((c) => c.toLowerCase().includes(docTable.idCol.toLowerCase())) ||
    colNames.find((c) => /id_dok|iddok/i.test(c)) ||
    null;

  // Kolumna z nazwą pozycji
  const nameCol =
    colNames.find((c) => /nazwa|name|towar|opis/i.test(c)) || null;

  // Kolumna z ilością
  const qtyCol =
    colNames.find((c) => /ilosc|qty|quantity|il/i.test(c)) || null;

  // Kolumna z ceną
  const priceCol =
    colNames.find((c) => /cena|price|cena_jed|cenajed/i.test(c)) || null;

  return {
    table: tableName,
    docFkCol,
    nameCol,
    qtyCol,
    priceCol,
    allCols: colNames,
  };
}

/**
 * Buduje obiekt postingu z rekordu dokumentu.
 * Zwraca null jeśli dokument nie dotyczy pokoju.
 */
async function buildPostingFromDoc(kw, doc, docTable, posTable) {
  // Wyciągnij numer pokoju
  let roomNumber = null;

  if (docTable.roomCol) {
    const rawVal = doc[docTable.roomCol];
    if (rawVal != null) {
      const str = String(rawVal).trim();
      // Jeśli to ID pokoju (liczba), przetłumacz na numer pokoju
      if (/^\d+$/.test(str) && docTable.roomCol.toLowerCase().includes("id")) {
        try {
          const [rooms] = await kw.query(
            "SELECT name FROM rooms WHERE id = ?",
            [parseInt(str, 10)]
          );
          if (rooms.length > 0) roomNumber = rooms[0].name.trim();
        } catch {
          roomNumber = str;
        }
      } else {
        roomNumber = str;
      }
    }
  }

  // Jeśli nie znaleziono numeru pokoju, szukaj w uwagach/opisie
  if (!roomNumber) {
    for (const col of docTable.allCols) {
      const val = doc[col];
      if (typeof val === "string") {
        const match = val.match(/pok[oó]j\s*[:=]?\s*(\d+)/i);
        if (match) {
          roomNumber = match[1];
          break;
        }
      }
    }
  }

  if (!roomNumber) return null;

  // Wyciągnij kwotę
  let amount = 0;
  if (docTable.amountCol) {
    amount = parseFloat(doc[docTable.amountCol]) || 0;
  }
  if (amount <= 0) return null;

  // Wyciągnij numer dokumentu
  const receiptNumber = docTable.docNumCol
    ? String(doc[docTable.docNumCol] || "").trim() || undefined
    : undefined;

  // Pobierz pozycje
  const items = [];
  if (posTable && posTable.docFkCol) {
    const docId = doc[docTable.idCol];
    try {
      const [positions] = await kw.query(
        `SELECT * FROM \`${posTable.table}\` WHERE \`${posTable.docFkCol}\` = ?`,
        [docId]
      );
      for (const pos of positions) {
        const name = posTable.nameCol
          ? String(pos[posTable.nameCol] || "Pozycja").trim()
          : "Pozycja";
        const quantity = posTable.qtyCol
          ? parseFloat(pos[posTable.qtyCol]) || 1
          : 1;
        const unitPrice = posTable.priceCol
          ? parseFloat(pos[posTable.priceCol]) || 0
          : 0;
        if (unitPrice > 0) {
          items.push({ name, quantity, unitPrice });
        }
      }
    } catch {
      // tabela pozycji niedostępna — kontynuuj bez pozycji
    }
  }

  return {
    roomNumber,
    amount,
    type: "RESTAURANT",
    description: items.length > 0
      ? `Restauracja (${items.length} poz.)`
      : "Restauracja",
    receiptNumber,
    posSystem: "Symplex Bistro",
    items: items.length > 0 ? items : undefined,
  };
}

/**
 * Wysyła obciążenie do API nowego systemu.
 */
async function postToHotelApi(posting) {
  const res = await fetch(POSTING_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": EXTERNAL_API_KEY,
    },
    body: JSON.stringify(posting),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

// =========================================================================
// RECON — diagnostyka bazy
// =========================================================================

async function recon(kw) {
  log("INFO", "=== Diagnostyka bazy KW Hotel ===\n");

  const [dbs] = await kw.query("SHOW DATABASES");
  log("INFO", "Bazy danych:");
  for (const row of dbs) log("INFO", `  ${Object.values(row)[0]}`);

  const [currentDb] = await kw.query("SELECT DATABASE() AS db");
  const dbName = currentDb[0]?.db;
  if (!dbName) {
    log("ERROR", "Brak wybranej bazy. Podaj nazwę bazy w KW_DATABASE_URL.");
    return;
  }

  log("INFO", `\nTabele w bazie ${dbName}:`);
  const [tables] = await kw.query("SHOW TABLES");
  const tableNames = tables.map((r) => Object.values(r)[0]);
  for (const t of tableNames) log("INFO", `  ${t}`);

  // Struktura kluczowych tabel
  const patterns = [
    "room", "pokoj", "klient", "rezerw", "dokument", "rachunek",
    "faktur", "sprzedaz", "paragon", "pozycj", "kontrah",
  ];
  const matched = tableNames.filter((t) =>
    patterns.some((p) => t.toLowerCase().includes(p))
  );

  if (matched.length > 0) {
    log("INFO", `\nStruktura kluczowych tabel (${matched.length}):`);
    for (const t of matched) {
      log("INFO", `\n  >> ${t}`);
      const [cols] = await kw.query(`DESCRIBE \`${t}\``);
      for (const c of cols) {
        const key = c.Key === "PRI" ? " [PK]" : c.Key === "UNI" ? " [UQ]" : "";
        log("INFO", `     ${c.Field} ${c.Type}${key}`);
      }
      try {
        const [cnt] = await kw.query(`SELECT COUNT(*) AS cnt FROM \`${t}\``);
        log("INFO", `     (${cnt[0].cnt} rekordów)`);
      } catch {
        // ignoruj
      }
    }
  }

  // Próbka aktywnych rezerwacji
  if (tableNames.includes("rezerwacje")) {
    log("INFO", "\nAktywne rezerwacje (status_id=2, limit 5):");
    try {
      const [rows] = await kw.query(
        "SELECT RezerwacjaID, PokojID, KlientID, DataOd, DataDo, status_id FROM rezerwacje WHERE status_id = 2 LIMIT 5"
      );
      if (rows.length === 0) {
        log("INFO", "  Brak aktywnych rezerwacji.");
      } else {
        for (const r of rows) {
          log("INFO", `  Rez#${r.RezerwacjaID} Pokój=${r.PokojID} Klient=${r.KlientID} ${r.DataOd}→${r.DataDo}`);
        }
      }
    } catch (e) {
      log("ERROR", `  ${e.message}`);
    }
  }
}

// =========================================================================
// Main
// =========================================================================

async function main() {
  if (DIRECTION === "recon") {
    if (!KW_URL) {
      log("ERROR", "Brak KW_DATABASE_URL. Ustaw np. KW_DATABASE_URL=mysql://root:pass@192.168.1.10:3306/kwhotel");
      process.exit(1);
    }
    const kw = await mysql.createConnection(KW_URL);
    log("INFO", `Połączono z bazą: ${KW_URL.replace(/:[^:@]+@/, ":***@")}`);
    await recon(kw);
    await kw.end();
    return;
  }

  validateConfig();

  const kw = await mysql.createConnection(KW_URL);
  log("INFO", `Połączono z bazą KW Hotel: ${KW_URL.replace(/:[^:@]+@/, ":***@")}`);

  try {
    // Kierunek 1: Hotel → KW Hotel
    if (DIRECTION === "both" || DIRECTION === "to-kw") {
      await syncRoomsToKw(kw);
    }

    // Kierunek 2: KW Hotel → Hotel
    if (DIRECTION === "both" || DIRECTION === "from-kw") {
      await syncBillsFromKw(kw);
    }

    log("INFO", "=== Synchronizacja zakończona ===");
  } finally {
    await kw.end();
  }
}

main().catch((e) => {
  log("ERROR", `Błąd krytyczny: ${e.message}`);
  process.exit(1);
});
