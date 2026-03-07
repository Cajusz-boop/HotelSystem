/**
 * Migracja: ConsolidatedInvoice → Invoice (jednorazowa).
 * Model ConsolidatedInvoice został usunięty – faktury zbiorcze to teraz Invoice (sourceType=CONSOLIDATED).
 * Ten skrypt jest nieaktualny – pozostawiony dla dokumentacji.
 */
import { prisma } from "../lib/db";

async function main() {
  console.log("Model ConsolidatedInvoice został usunięty. Faktury zbiorcze są teraz w Invoice (sourceType=CONSOLIDATED).");
  console.log("Migracja nie jest wymagana.");
  return;

  /* eslint-disable @typescript-eslint/no-unused-vars */
  const consolidated: never[] = [];
  if (consolidated.length === 0) {
    console.log("Brak faktur zbiorczych do migracji.");
    return;
  }

  console.log(`Migracja ${consolidated.length} faktur zbiorczych...`);

  for (const ci of consolidated) {
    // Sprawdź czy numer nie jest już użyty w Invoice
    const existing = await prisma.invoice.findUnique({
      where: { number: ci.number },
    });
    if (existing) {
      console.warn(`Pomijam ${ci.number} – numer już istnieje w Invoice`);
      continue;
    }

    const inv = await prisma.invoice.create({
      data: {
        sourceType: "CONSOLIDATED",
        companyId: ci.companyId,
        number: ci.number,
        amountNet: ci.amountNet,
        amountVat: ci.amountVat,
        amountGross: ci.amountGross,
        vatRate: ci.vatRate,
        buyerNip: ci.buyerNip,
        buyerName: ci.buyerName,
        buyerAddress: ci.buyerAddress,
        buyerPostalCode: ci.buyerPostalCode,
        buyerCity: ci.buyerCity,
        issuedAt: ci.issuedAt,
        deliveryDate: ci.deliveryDate,
        paymentDueDate: ci.dueDate,
        paymentDays: ci.paymentTermDays,
        paymentBreakdown: ci.paymentBreakdown,
        notes: ci.notes,
        consolidatedStatus: ci.status,
        paidAt: ci.paidAt,
        periodFrom: ci.periodFrom,
        periodTo: ci.periodTo,
        lineItems: {
          create: {
            description: "Usługa hotelowa",
            quantity: 1,
            unit: "szt.",
            unitPrice: ci.amountNet,
            vatRate: ci.vatRate,
            amountNet: ci.amountNet,
            amountVat: ci.amountVat,
            amountGross: ci.amountGross,
            sortOrder: 0,
          },
        },
        invoiceReservations: {
          create: ci.items.map((item) => ({
            reservationId: item.reservationId,
            guestName: item.guestName,
            roomNumber: item.roomNumber,
            checkIn: item.checkIn,
            checkOut: item.checkOut,
            nights: item.nights,
            amountNet: item.amountNet,
            amountVat: item.amountVat,
            amountGross: item.amountGross,
            description: item.description,
          })),
        },
      },
    });
    console.log(`  Migrowano: ${ci.number} → Invoice ${inv.id}`);
  }

  console.log("Migracja zakończona.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
