#!/usr/bin/env npx ts-node
/**
 * Sprawdza numerację faktur: istniejące numery, licznik, luki.
 * Uruchom na serwerze: npx ts-node scripts/check-invoice-numbers.ts
 * lub lokalnie z DATABASE_URL produkcyjną.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const year = new Date().getFullYear();
  const prefix = `FV/${year}/`;

  // 1. Numery faktur (roczne, format FV/YYYY/xxxx)
  const invoices = await prisma.invoice.findMany({
    where: { number: { startsWith: prefix } },
    select: { number: true },
    orderBy: { number: "asc" },
  });

  const allInvoices = await prisma.invoice.findMany({
    select: { number: true },
    orderBy: { number: "asc" },
  });

  // 2. Licznik
  const counters = await prisma.documentNumberCounter.findMany({
    where: { documentType: { in: ["INVOICE", "CONSOLIDATED_INVOICE"] } },
    orderBy: [{ year: "asc" }, { month: "asc" }],
  });

  // 3. Konfiguracja INVOICE
  const config = await prisma.documentNumberingConfig.findUnique({
    where: { documentType: "INVOICE" },
  });

  // Parsuj sekwencje z numerów FV/2025/0001
  const parseSeq = (num: string): number => {
    const parts = num.split("/");
    const last = parseInt(parts[parts.length - 1], 10);
    return isNaN(last) ? 0 : last;
  };

  const used = new Set(
    allInvoices.map((i) => parseSeq(i.number)).filter((n) => n > 0)
  );
  const seqStart = config?.sequenceStart ?? 1;
  let n = seqStart;
  const gaps: number[] = [];
  const maxUsed = Math.max(0, ...Array.from(used));
  while (n <= maxUsed) {
    if (!used.has(n)) gaps.push(n);
    n++;
  }
  const nextFree = (() => {
    let k = seqStart;
    while (used.has(k)) k++;
    return k;
  })();

  console.log("=== KONFIGURACJA INVOICE ===");
  console.log(
    JSON.stringify(
      config
        ? {
            prefix: config.prefix,
            separator: config.separator,
            yearFormat: config.yearFormat,
            sequencePadding: config.sequencePadding,
            sequenceStart: config.sequenceStart,
          }
        : "brak (domyślna)",
      null,
      2
    )
  );
  console.log("\n=== LICZNIKI DocumentNumberCounter ===");
  console.table(
    counters.map((c) => ({
      documentType: c.documentType,
      year: c.year,
      month: c.month,
      lastSequence: c.lastSequence,
    }))
  );
  console.log("\n=== WSZYSTKIE NUMERY FAKTUR (wszystkie lata) ===");
  console.log(
    allInvoices.length > 0
      ? allInvoices.map((i) => i.number).join("\n")
      : "(brak)"
  );
  console.log("\n=== NASTĘPNY WOLNY NUMER (min. luka lub max+1) ===");
  console.log(`${prefix}${String(nextFree).padStart(4, "0")} (seq: ${nextFree})`);
  console.log("\n=== LUKI (numery do wykorzystania) ===");
  console.log(gaps.length > 0 ? gaps.join(", ") : "brak luk");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
