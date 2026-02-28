#!/usr/bin/env node
/**
 * sync.mjs — Synchronizacja HotelSystem → Bistro POS (Symplex Small Business SB4)
 *
 * Generuje plik Rezerwacje.txt z listą zameldowanych gości.
 * Bistro czyta ten plik przy otwieraniu okna "Klient hotelowy".
 *
 * ENV:
 *   OCCUPIED_ROOMS_URL  — URL API HotelSystem (GET /api/v1/external/occupied-rooms)
 *   EXTERNAL_API_KEY    — klucz API
 *   OUTPUT_PATH         — ścieżka do pliku Rezerwacje.txt (domyślnie W:\Rezerwacje.txt)
 *   SYNC_LOG_FILE       — ścieżka do pliku logów (opcjonalnie)
 *
 * Użycie:
 *   node symplex-bridge/sync.mjs
 */

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

const OCCUPIED_ROOMS_URL = process.env.OCCUPIED_ROOMS_URL?.trim();
const EXTERNAL_API_KEY = process.env.EXTERNAL_API_KEY?.trim();
const OUTPUT_PATH = process.env.OUTPUT_PATH?.trim() || "W:\\Rezerwacje.txt";
const LOG_FILE = process.env.SYNC_LOG_FILE?.trim();

// Mapowanie numerów pokoi HotelSystem → ID pokoi KWHotel
// ID 17 nie istnieje, ID 19 = "NOWA BAZA NOCLE" (ignorowane)
const ROOM_MAP = {
  "001": { id: 1, name: "001 " },
  "002": { id: 2, name: "002 " },
  "003": { id: 3, name: "003 " },
  "004": { id: 4, name: "004 " },
  "005": { id: 5, name: "005 " },
  "006": { id: 6, name: "006 " },
  "007": { id: 7, name: "007 " },
  "008": { id: 8, name: "008 " },
  "009": { id: 9, name: "009 " },
  "010": { id: 10, name: "010 " },
  "011": { id: 11, name: "011 " },
  "012": { id: 12, name: "012" },
  "013": { id: 13, name: "013 " },
  "014": { id: 14, name: "014 " },
  "015": { id: 15, name: "015 " },
  "016": { id: 16, name: "016 " },
  "SI 020": { id: 18, name: "SI 020 " },
  "SI 021": { id: 20, name: "SI 021 " },
  "SI 022": { id: 21, name: "SI 022 " },
  "SI 023": { id: 22, name: "SI 023 " },
  "SI 024": { id: 23, name: "SI 024 " },
  "SI 025": { id: 24, name: "SI 025 " },
  "SI 026": { id: 25, name: "SI 026 " },
  "SI 027": { id: 26, name: "SI 027 " },
  "SI 028": { id: 27, name: "SI 028 " },
  "SI 029": { id: 28, name: "SI 029 " },
  "SI 030": { id: 29, name: "SI 030 " },
  "SI 031": { id: 30, name: "SI 031 " },
};

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

// ---------------------------------------------------------------------------
// Walidacja
// ---------------------------------------------------------------------------

function validateConfig() {
  const errors = [];
  if (!OCCUPIED_ROOMS_URL) errors.push("Brak OCCUPIED_ROOMS_URL");
  if (!EXTERNAL_API_KEY) errors.push("Brak EXTERNAL_API_KEY");
  if (errors.length > 0) {
    log("ERROR", "Brakujące zmienne środowiskowe:");
    errors.forEach((e) => log("ERROR", `  - ${e}`));
    log("INFO", "Ustaw zmienne w pliku .env bridge'a lub jako zmienne środowiskowe.");
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Generowanie ID rezerwacji
// ---------------------------------------------------------------------------

/**
 * Generuje numeryczny ID rezerwacji z prefixem "1" (format KWHotel).
 * Używa hash z reservationId jeśli dostępne, lub timestampu.
 */
function generateReservationId(room) {
  if (room.kwhotelReservationId) {
    return `1${room.kwhotelReservationId}`;
  }
  
  // Hash z reservationId (UUID) → 6-cyfrowy numer
  if (room.reservationId) {
    let hash = 0;
    for (let i = 0; i < room.reservationId.length; i++) {
      hash = ((hash << 5) - hash) + room.reservationId.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }
    const num = Math.abs(hash) % 900000 + 100000; // 100000-999999
    return `1${num}`;
  }
  
  // Fallback: timestamp
  return `1${Date.now() % 1000000}`;
}

// ---------------------------------------------------------------------------
// Główna funkcja synchronizacji
// ---------------------------------------------------------------------------

async function sync() {
  log("INFO", "=== Synchronizacja HotelSystem → Bistro (Rezerwacje.txt) ===");
  log("INFO", `Ścieżka docelowa: ${OUTPUT_PATH}`);

  // 1. Pobierz zajęte pokoje z API
  log("INFO", `Pobieranie danych z: ${OCCUPIED_ROOMS_URL}`);
  
  const response = await fetch(OCCUPIED_ROOMS_URL, {
    headers: { "X-API-Key": EXTERNAL_API_KEY },
  });
  
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`API zwróciło ${response.status}: ${body.substring(0, 200)}`);
  }
  
  const data = await response.json();
  const rooms = data.rooms || [];
  
  log("INFO", `Pobrano ${rooms.length} pokoi z API (data: ${data.date})`);

  // 2. Filtruj tylko zameldowanych gości (CHECKED_IN)
  const checkedInRooms = rooms.filter(r => r.status === "CHECKED_IN" || r.status === "CONFIRMED");
  log("INFO", `Zameldowanych gości: ${checkedInRooms.length}`);

  // 3. Generuj linie pliku
  const lines = [];
  let skipped = 0;
  
  for (const room of checkedInRooms) {
    const roomNumber = room.roomNumber?.trim();
    const guestName = room.guestName?.trim();
    
    if (!roomNumber || !guestName) {
      log("WARN", `Pominięto pokój bez danych: roomNumber=${roomNumber}, guestName=${guestName}`);
      skipped++;
      continue;
    }
    
    // Znajdź mapowanie pokoju
    const mapping = ROOM_MAP[roomNumber];
    if (!mapping) {
      log("WARN", `Nieznany pokój: ${roomNumber} (gość: ${guestName}) — pominięto`);
      skipped++;
      continue;
    }
    
    const roomId = mapping.id;
    const roomName = mapping.name;
    const rezId = generateReservationId(room);
    
    // Daty w formacie YYYY-MM-DD
    const checkIn = room.checkIn ? room.checkIn.split("T")[0] : new Date().toISOString().split("T")[0];
    const checkOut = room.checkOut ? room.checkOut.split("T")[0] : new Date(Date.now() + 86400000).toISOString().split("T")[0];
    
    // Format linii: ROOM_NAME ;GUEST_NAME;1RESERVATION_ID;ROOM_INTERNAL_ID;CHECK_IN_DATE;CHECK_OUT_DATE 14:00
    const line = `${roomName};${guestName};${rezId};${roomId};${checkIn};${checkOut} 14:00`;
    lines.push(line);
    
    log("DEBUG", `  ${roomNumber}: ${guestName} (rez: ${rezId})`);
  }

  // 4. Zapisz plik z UTF-8 BOM
  const BOM = "\uFEFF";
  const content = lines.length > 0 
    ? BOM + lines.join("\r\n") + "\r\n"
    : BOM; // Pusty plik z samym BOM jeśli brak gości
  
  try {
    fs.writeFileSync(OUTPUT_PATH, content, "utf8");
    log("INFO", `Zapisano ${lines.length} rekordów do ${OUTPUT_PATH}`);
  } catch (err) {
    if (err.code === "ENOENT") {
      // Spróbuj utworzyć folder nadrzędny
      const dir = path.dirname(OUTPUT_PATH);
      log("WARN", `Folder ${dir} nie istnieje, próbuję utworzyć...`);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(OUTPUT_PATH, content, "utf8");
      log("INFO", `Zapisano ${lines.length} rekordów do ${OUTPUT_PATH}`);
    } else {
      throw err;
    }
  }

  if (skipped > 0) {
    log("WARN", `Pominięto ${skipped} rekordów (brak mapowania lub danych)`);
  }
  
  log("INFO", "=== Synchronizacja zakończona ===");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

validateConfig();

sync().catch((e) => {
  log("ERROR", `Błąd krytyczny: ${e.message}`);
  if (e.stack) {
    log("DEBUG", e.stack);
  }
  process.exit(1);
});
