#!/usr/bin/env node
import { readFileSync } from "fs";
import { createConnection } from "mysql2/promise";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => {
      const [k, ...v] = l.split("=");
      return [k, v.join("=").trim().replace(/^["']|["']$/g, "")];
    })
);
const url = env.DATABASE_URL;
if (!url) {
  console.error("Brak DATABASE_URL w .env");
  process.exit(1);
}

const conn = await createConnection(url.replace("mysql://", "mysql2://"));

const [invoices] = await conn.execute("SELECT number FROM Invoice ORDER BY number");
const [counters] = await conn.execute(
  "SELECT documentType, year, month, lastSequence FROM DocumentNumberCounter WHERE documentType IN ('INVOICE','CONSOLIDATED_INVOICE') ORDER BY year, month"
);
const [config] = await conn.execute(
  "SELECT prefix, `separator`, sequenceStart FROM DocumentNumberingConfig WHERE documentType='INVOICE' LIMIT 1"
);

console.log("=== NUMERY FAKTUR ===");
console.log(invoices.map((r) => r.number).join("\n") || "(brak)");
console.log("\n=== LICZNIKI ===");
console.table(counters);
console.log("\n=== KONFIG INVOICE ===");
console.log(config[0] || "brak");

const parseSeq = (num) => {
  const parts = String(num).split("/");
  const last = parseInt(parts[parts.length - 1], 10);
  return isNaN(last) ? 0 : last;
};
const used = new Set(invoices.map((r) => parseSeq(r.number)).filter((n) => n > 0));
const seqStart = (config[0]?.sequenceStart ?? 1);
let nextFree = seqStart;
while (used.has(nextFree)) nextFree++;
const maxUsed = Math.max(0, ...used);
const gaps = [];
for (let n = seqStart; n <= maxUsed; n++) if (!used.has(n)) gaps.push(n);

console.log("\n=== NASTĘPNY WOLNY NUMER ===");
const year = new Date().getFullYear();
console.log(`FV/${year}/${String(nextFree).padStart(4, "0")} (seq: ${nextFree})`);
console.log("\n=== LUKI (numery do wykorzystania) ===");
console.log(gaps.length ? gaps.join(", ") : "brak luk");

await conn.end();
