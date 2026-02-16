#!/usr/bin/env node
/**
 * Bridge: przetwarza pliki z folderu (eksport Symplex Bistro / EDI) i wysyła
 * obciążenia na pokój do API postingu systemu hotelowego.
 *
 * Obsługuje dwa formaty:
 *   1. Prosty CSV:  roomNumber;amount;description
 *   2. Rozszerzony (z pozycjami):  roomNumber;amount;receiptNumber;cashier;item1Name:qty:price|item2Name:qty:price|...
 *
 * ENV: POSTING_URL, EXTERNAL_API_KEY, SYMPLEX_WATCH_DIR, SYMPLEX_PROCESSED_DIR
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const POSTING_URL = process.env.POSTING_URL?.trim();
const EXTERNAL_API_KEY = process.env.EXTERNAL_API_KEY?.trim();
const WATCH_DIR = process.env.SYMPLEX_WATCH_DIR?.trim() || path.join(__dirname, "incoming");
const PROCESSED_DIR = process.env.SYMPLEX_PROCESSED_DIR?.trim() || path.join(WATCH_DIR, "processed");

if (!POSTING_URL) {
  console.error("Brak POSTING_URL. Ustaw np. POSTING_URL=https://twoj-hotel.example.com/api/v1/external/posting");
  process.exit(1);
}
if (!EXTERNAL_API_KEY) {
  console.error("Brak EXTERNAL_API_KEY. Ustaw klucz zgodny z EXTERNAL_API_KEY w .env aplikacji hotelowej.");
  process.exit(1);
}

/**
 * Parsuje pozycje w formacie: "Zupa dnia:1:15.00|Kotlet:2:35.00|Kawa:1:8.00"
 * Zwraca tablicę { name, quantity, unitPrice }.
 */
function parseItems(itemsStr) {
  if (!itemsStr || !itemsStr.trim()) return [];
  return itemsStr.split("|").map((part) => {
    const segments = part.split(":");
    const name = segments[0]?.trim() || "Pozycja";
    const quantity = parseInt(segments[1], 10) || 1;
    const unitPrice = parseFloat((segments[2] || "0").replace(",", ".")) || 0;
    return { name, quantity, unitPrice };
  }).filter((it) => it.name && it.unitPrice > 0);
}

/**
 * Parsuje linię – obsługuje dwa formaty:
 *   Prosty:     roomNumber;amount;description
 *   Rozszerzony: roomNumber;amount;receiptNumber;cashier;items
 *
 * Rozpoznanie: jeśli 5+ pól i pole[4] zawiera ":" → format rozszerzony.
 */
function parseLine(line) {
  const t = line.trim();
  if (!t) return null;
  const parts = t.split(";").map((p) => p.trim());
  if (parts.length < 2) return null;

  const roomNumber = parts[0];
  const amount = parseFloat(parts[1].replace(",", "."));
  if (!roomNumber || Number.isNaN(amount) || amount <= 0) return null;

  // Format rozszerzony: roomNumber;amount;receiptNumber;cashier;items
  if (parts.length >= 5 && parts[4]?.includes(":")) {
    const receiptNumber = parts[2] || undefined;
    const cashierName = parts[3] || undefined;
    const items = parseItems(parts[4]);
    const description = items.length > 0
      ? `Restauracja (${items.length} poz.)`
      : parts[2] || "Restauracja";
    return { roomNumber, amount, description, receiptNumber, cashierName, items };
  }

  // Format prosty: roomNumber;amount;description
  const description = parts[2] || "Restauracja";
  return { roomNumber, amount, description, items: [] };
}

/**
 * Parsuje plik tekstowy – obsługuje oba formaty.
 */
function parseFile(content) {
  const lines = content.split(/\r?\n/);
  const rows = [];
  for (const line of lines) {
    const row = parseLine(line);
    if (row) rows.push(row);
  }
  return rows;
}

async function postToApi(row) {
  const payload = {
    roomNumber: row.roomNumber,
    amount: row.amount,
    type: "RESTAURANT",
    description: row.description,
    posSystem: "Symplex Bistro",
  };
  if (row.items?.length > 0) payload.items = row.items;
  if (row.receiptNumber) payload.receiptNumber = row.receiptNumber;
  if (row.cashierName) payload.cashierName = row.cashierName;

  const res = await fetch(POSTING_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": EXTERNAL_API_KEY,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function processFile(filePath) {
  const name = path.basename(filePath);
  const content = fs.readFileSync(filePath, "utf8");
  const rows = parseFile(content);
  if (rows.length === 0) {
    console.log(`[symplex-bridge] ${name}: brak poprawnych linii, przenoszę do processed`);
    ensureDir(PROCESSED_DIR);
    fs.renameSync(filePath, path.join(PROCESSED_DIR, name));
    return;
  }
  let ok = 0;
  let err = 0;
  for (const row of rows) {
    try {
      const result = await postToApi(row);
      ok++;
      const itemsInfo = row.items?.length ? ` (${row.items.length} pozycji)` : "";
      console.log(`[symplex-bridge] ${name}: pokój ${row.roomNumber} ${row.amount} PLN${itemsInfo} – OK [txId: ${result.transactionId}]`);
    } catch (e) {
      err++;
      console.error(`[symplex-bridge] ${name}: pokój ${row.roomNumber} – błąd:`, e.message);
    }
  }
  ensureDir(PROCESSED_DIR);
  fs.renameSync(filePath, path.join(PROCESSED_DIR, name));
  console.log(`[symplex-bridge] ${name}: wysłano ${ok}, błędów ${err}`);
}

async function main() {
  if (!fs.existsSync(WATCH_DIR)) {
    console.log(`[symplex-bridge] Folder ${WATCH_DIR} nie istnieje. Utwórz go i wrzuć pliki do przetworzenia.`);
    return;
  }
  const files = fs.readdirSync(WATCH_DIR).filter((f) => {
    const full = path.join(WATCH_DIR, f);
    return fs.statSync(full).isFile() && !f.startsWith(".");
  });
  if (files.length === 0) {
    console.log(`[symplex-bridge] Brak plików w ${WATCH_DIR}`);
    return;
  }
  for (const f of files) {
    await processFile(path.join(WATCH_DIR, f));
  }
}

main().catch((e) => {
  console.error("[symplex-bridge]", e);
  process.exit(1);
});
