#!/usr/bin/env npx tsx
/**
 * Usuwa próbne faktury o numerach 8–15 i resetuje licznik, aby następna faktura miała numer 8.
 *
 * Uruchomienie:
 *   npx tsx scripts/delete-trial-invoices-8-15.ts --yes
 *
 * UWAGA: Operacja nieodwracalna. Przed produkcją zrób backup bazy.
 */
import "dotenv/config";
import { prisma } from "../lib/db";

const TRIAL_NUMBERS = [8, 9, 10, 11, 12, 13, 14, 15];
const NEXT_NUMBER = 8; // następna faktura będzie miała ten numer

async function main() {
  console.log("=== Usuwanie próbnych faktur (numery 8–15) i reset licznika ===\n");

  const confirm = process.argv.includes("--yes") || process.argv.includes("-y");
  if (!confirm) {
    console.log("Użycie: npx tsx scripts/delete-trial-invoices-8-15.ts --yes");
    console.log("  Flaga --yes jest wymagana – operacja jest nieodwracalna.\n");
    process.exit(1);
  }

  // Obsługa obu formatów: FV/2026/0008 (roczny) oraz FV/008/03/K (miesięczny)
  const exactAnnual = TRIAL_NUMBERS.map((n) => `FV/2026/${String(n).padStart(4, "0")}`);
  const prefixMonthly = TRIAL_NUMBERS.map((n) => `FV/${String(n).padStart(3, "0")}/`);

  const toDelete = await prisma.invoice.findMany({
    where: {
      OR: [
        ...exactAnnual.map((num) => ({ number: num })),
        ...prefixMonthly.map((p) => ({ number: { startsWith: p } })),
      ],
    },
    select: { id: true, number: true, amountGross: true, buyerName: true },
  });

  if (toDelete.length === 0) {
    console.log("Brak faktur do usunięcia (numery 8–15 nie występują w bazie).");
    console.log("Możesz ustawić Początek numeracji na 8 w Ustawieniach → Numeracja.\n");
    return;
  }

  console.log("Znalezione faktury do usunięcia:");
  for (const inv of toDelete) {
    console.log(`  - ${inv.number} | ${inv.buyerName} | ${inv.amountGross} PLN`);
  }
  console.log(`\nŁącznie: ${toDelete.length} faktur.\n`);

  await prisma.$transaction(async (tx) => {
    const ids = toDelete.map((i) => i.id);

    // 1. Usuń wpisy KSeF (kolejka retry) dla tych faktur
    const ksef = await tx.ksefPendingSend.deleteMany({ where: { invoiceId: { in: ids } } });
    if (ksef.count > 0) console.log(`  KsefPendingSend: usunięto ${ksef.count} wpisów`);

    // 2. Odłącz CashDocument i Transaction od tych faktur
    await tx.cashDocument.updateMany({ where: { invoiceId: { in: ids } }, data: { invoiceId: null } });
    await tx.transaction.updateMany({ where: { invoiceId: { in: ids } }, data: { invoiceId: null } });

    // 3. Zeruj advanceInvoiceId (FINAL -> ADVANCE) jeśli wskazuje na usuwane
    await tx.invoice.updateMany({
      where: { advanceInvoiceId: { in: ids } },
      data: { advanceInvoiceId: null },
    });

    // 4. Usuń korekty (cascade) i faktury
    await tx.invoiceCorrection.deleteMany({ where: { invoiceId: { in: ids } } });
    await tx.invoiceLineItem.deleteMany({ where: { invoiceId: { in: ids } } });
    await tx.invoice.deleteMany({ where: { id: { in: ids } } });

    console.log(`  Usunięto ${ids.length} faktur.`);

    // 5. Ustaw licznik INVOICE na 7, aby następna faktura miała numer 8
    const year = new Date().getFullYear();
    const month = new Date().getMonth() + 1; // 1-12 dla formatu miesięcznego

    // Szukaj licznika: miesięczny (month=3) lub roczny (month=0)
    const counter =
      (await tx.documentNumberCounter.findUnique({
        where: { documentType_year_month: { documentType: "INVOICE", year, month } },
      })) ??
      (await tx.documentNumberCounter.findUnique({
        where: { documentType_year_month: { documentType: "INVOICE", year, month: 0 } },
      }));

    if (counter) {
      await tx.documentNumberCounter.update({
        where: { id: counter.id },
        data: { lastSequence: NEXT_NUMBER - 1 },
      });
      console.log(`  Licznik INVOICE: lastSequence = ${NEXT_NUMBER - 1} → następna faktura: ${NEXT_NUMBER}`);
    } else {
      await tx.documentNumberCounter.create({
        data: { documentType: "INVOICE", year, month, lastSequence: NEXT_NUMBER - 1 },
      });
      console.log(`  Utworzono licznik INVOICE: następna faktura: ${NEXT_NUMBER}`);
    }
  });

  console.log("\nGotowe. Następna wystawiona faktura będzie miała numer 8.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
