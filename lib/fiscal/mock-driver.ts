import type {
  FiscalDriver,
  FiscalInvoiceRequest,
  FiscalInvoiceResult,
  FiscalReceiptRequest,
  FiscalReceiptResult,
} from "./types";

/**
 * Sterownik symulacyjny kasy fiskalnej.
 * W development/test zapisuje dane paragonu do logu (w produkcji można wyłączyć lub przekierować do pliku).
 */
const mockDriver: FiscalDriver = {
  name: "mock",

  async printReceipt(request: FiscalReceiptRequest): Promise<FiscalReceiptResult> {
    const lines = [
      "========== PARAGON FISKALNY (MOCK) ==========",
      `Transakcja: ${request.transactionId}`,
      `Rezerwacja: ${request.reservationId}`,
      `Typ płatności: ${request.paymentType}`,
      request.description ? `Opis: ${request.description}` : null,
      "Pozycje:",
      ...request.items.map(
        (i) =>
          `  - ${i.name} x ${i.quantity} = ${(i.unitPrice * i.quantity).toFixed(2)} PLN`
      ),
      `SUMA: ${request.totalAmount.toFixed(2)} PLN`,
      "=============================================",
    ].filter(Boolean);

    if (process.env.NODE_ENV !== "test") {
      // eslint-disable-next-line no-console
      console.log("[FISCAL MOCK]", lines.join("\n"));
    }

    return {
      success: true,
      receiptNumber: `MOCK-${request.transactionId.slice(-8)}`,
    };
  },

  async printInvoice(request: FiscalInvoiceRequest): Promise<FiscalInvoiceResult> {
    const lines = [
      "========== FAKTURA FISKALNA (MOCK) ==========",
      `Rezerwacja: ${request.reservationId}`,
      `Nabywca: ${request.company.name}, NIP ${request.company.nip}`,
      request.company.address
        ? `Adres: ${[request.company.address, request.company.postalCode, request.company.city]
            .filter(Boolean)
            .join(" ")}`
        : null,
      "Pozycje:",
      ...request.items.map(
        (i) =>
          `  - ${i.name} x ${i.quantity} = ${(i.unitPrice * i.quantity).toFixed(2)} PLN`
      ),
      `SUMA: ${request.totalAmount.toFixed(2)} PLN`,
      "=============================================",
    ].filter(Boolean);

    if (process.env.NODE_ENV !== "test") {
      // eslint-disable-next-line no-console
      console.log("[FISCAL MOCK INVOICE]", lines.join("\n"));
    }

    return {
      success: true,
      invoiceNumber: `MOCK-FV-${request.reservationId.slice(-8)}`,
    };
  },
};

export default mockDriver;
