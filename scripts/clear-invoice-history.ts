#!/usr/bin/env npx tsx
/**
 * Kasowanie historii faktur – lokalnie i na produkcji (hotel.karczma-labedz.pl).
 * Usuwa: faktury VAT, dane KSeF (sesje, kolejka, batche), resetuje licznik numeracji.
 *
 * Uruchomienie:
 *   Lokalnie:       npx tsx scripts/clear-invoice-history.ts --yes
 *   Produkcja:      1) git push (żeby skrypt był na serwerze)
 *                   2) ssh hetzner "cd /var/www/hotel && npx tsx scripts/clear-invoice-history.ts --yes"
 *
 * UWAGA: Operacja nieodwracalna. Przed produkcją zrób backup bazy.
 */
import "dotenv/config";
import { prisma } from "../lib/db";

async function main() {
  console.log("=== Kasowanie historii faktur ===");

  const confirm = process.argv.includes("--yes") || process.argv.includes("-y");
  if (!confirm) {
    console.log("\nUżycie: npx tsx scripts/clear-invoice-history.ts --yes");
    console.log("  Flaga --yes (lub -y) jest wymagana – operacja jest nieodwracalna.\n");
    process.exit(1);
  }

  const result = await prisma.$transaction(async (tx) => {
    // 1. KSeF – kolejka retry
    const ksefPending = await tx.ksefPendingSend.deleteMany({});
    console.log(`  KsefPendingSend: usunięto ${ksefPending.count} wpisów`);

    // 2. KSeF – batche wysyłek
    const ksefBatches = await tx.ksefSentBatch.deleteMany({});
    console.log(`  KsefSentBatch: usunięto ${ksefBatches.count} wpisów`);

    // 3. KSeF – sesje
    const ksefSessions = await tx.ksefSession.deleteMany({});
    console.log(`  KsefSession: usunięto ${ksefSessions.count} sesji`);

    // 4. Odbierz powiązania z fakturami
    const cashDoc = await tx.cashDocument.updateMany({ where: { invoiceId: { not: null } }, data: { invoiceId: null } });
    console.log(`  CashDocument: odłączono ${cashDoc.count} od faktur`);

    const trans = await tx.transaction.updateMany({ where: { invoiceId: { not: null } }, data: { invoiceId: null } });
    console.log(`  Transaction: odłączono ${trans.count} od faktur`);

    // 5. Zeruj self-reference (FINAL -> ADVANCE)
    const adv = await tx.invoice.updateMany({ where: { advanceInvoiceId: { not: null } }, data: { advanceInvoiceId: null } });
    console.log(`  Invoice: zerowano advanceInvoiceId w ${adv.count} fakturach`);

    // 6. Usuń faktury (cascade: InvoiceLineItem, InvoiceCorrection)
    const invoices = await tx.invoice.deleteMany({});
    console.log(`  Invoice: usunięto ${invoices.count} faktur`);

    // 7. Reset licznika numeracji faktur
    const year = new Date().getFullYear();
    const counters = await tx.documentNumberCounter.findMany({ where: { documentType: "INVOICE" } });
    for (const c of counters) {
      await tx.documentNumberCounter.delete({ where: { id: c.id } });
    }
    console.log(`  DocumentNumberCounter: usunięto ${counters.length} liczników INVOICE`);

    return { invoices: invoices.count, ksefSessions: ksefSessions.count };
  });

  console.log("\nGotowe.");
  console.log(`  Usunięto ${result.invoices} faktur i ${result.ksefSessions} sesji KSeF.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
