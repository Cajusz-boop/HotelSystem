import type {
  FiscalDriver,
  FiscalInvoiceRequest,
  FiscalInvoiceResult,
  FiscalReceiptRequest,
  FiscalReceiptResult,
  FiscalReportRequest,
  FiscalReportResult,
  FiscalReportData,
  FiscalVatSummary,
  FiscalPaymentSummary,
  PeriodicReportRequest,
  PeriodicReportResult,
  PeriodicReportData,
  PeriodicZReportEntry,
  FiscalStornoRequest,
  FiscalStornoResult,
} from "./types";

/** Liczniki dla symulacji raportów */
let mockXReportCounter = 1;
let mockZReportCounter = 1;
let mockPeriodicReportCounter = 1;
let mockStornoCounter = 1;
let mockReceiptCounter = 0;
let mockTotalGross = 0;
let mockTotalVat = 0;
let mockStornoAmount = 0;

/** Historia raportów Z (dla symulacji raportów okresowych) */
interface MockZReportHistory {
  reportNumber: string;
  date: Date;
  totalGross: number;
  totalVat: number;
  receiptCount: number;
  voidCount: number;
}
const mockZReportHistory: MockZReportHistory[] = [];

/** Historia paragonów (dla symulacji storna) */
interface MockReceiptHistory {
  receiptNumber: string;
  date: Date;
  amount: number;
  transactionId: string;
  isStornoed: boolean;
}
const mockReceiptHistory: MockReceiptHistory[] = [];

/**
 * Generuje przykładowe dane raportu (mock).
 */
function generateMockReportData(
  reportType: "X" | "Z",
  reportNumber: string
): FiscalReportData {
  const now = new Date();
  const periodStart = new Date(now);
  periodStart.setHours(0, 0, 0, 0);

  const vatSummary: FiscalVatSummary[] = [
    {
      vatLetter: "A",
      vatRate: 23,
      netAmount: mockTotalGross * 0.4 / 1.23,
      vatAmount: mockTotalGross * 0.4 - mockTotalGross * 0.4 / 1.23,
      grossAmount: mockTotalGross * 0.4,
    },
    {
      vatLetter: "B",
      vatRate: 8,
      netAmount: mockTotalGross * 0.6 / 1.08,
      vatAmount: mockTotalGross * 0.6 - mockTotalGross * 0.6 / 1.08,
      grossAmount: mockTotalGross * 0.6,
    },
  ];

  const paymentSummary: FiscalPaymentSummary[] = [
    {
      paymentType: "CASH",
      paymentName: "Gotówka",
      amount: mockTotalGross * 0.3,
      transactionCount: Math.floor(mockReceiptCounter * 0.3),
    },
    {
      paymentType: "CARD",
      paymentName: "Karta",
      amount: mockTotalGross * 0.7,
      transactionCount: Math.floor(mockReceiptCounter * 0.7),
    },
  ];

  return {
    reportType,
    reportNumber,
    generatedAt: now,
    periodStart: reportType === "Z" ? periodStart : undefined,
    periodEnd: reportType === "Z" ? now : undefined,
    totalGross: mockTotalGross,
    totalVat: mockTotalVat,
    totalNet: mockTotalGross - mockTotalVat,
    receiptCount: mockReceiptCounter,
    voidCount: 0,
    voidAmount: 0,
    vatSummary,
    paymentSummary,
    cashRegisterId: "MOCK-001",
  };
}

/**
 * Sterownik „bez druku" (no-op): nie wysyła danych do żadnej kasy, nie loguje.
 * Używany gdy FISCAL_DRIVER=mock lub gdy kasa jest wyłączona w konfiguracji.
 * Produkcja powinna ustawić FISCAL_DRIVER=posnet|novitus|elzab.
 */
const noOpDriver: FiscalDriver = {
  name: "mock",

  async printReceipt(request: FiscalReceiptRequest): Promise<FiscalReceiptResult> {
    // Aktualizuj liczniki do symulacji raportów
    mockReceiptCounter++;
    mockTotalGross += request.totalAmount;
    mockTotalVat += request.totalAmount * 0.08; // Zakładamy 8% VAT dla usług hotelowych

    const receiptNumber = `NOOP-${request.transactionId.slice(-8)}`;

    // Zapisz paragon do historii (dla symulacji storna)
    mockReceiptHistory.push({
      receiptNumber,
      date: new Date(),
      amount: request.totalAmount,
      transactionId: request.transactionId,
      isStornoed: false,
    });

    return {
      success: true,
      receiptNumber,
    };
  },

  async printInvoice(request: FiscalInvoiceRequest): Promise<FiscalInvoiceResult> {
    return {
      success: true,
      invoiceNumber: `NOOP-FV-${request.reservationId.slice(-8)}`,
    };
  },

  /**
   * Drukuje raport X (niefiskalny) – informacyjny, nie zamyka dnia.
   * W trybie mock zwraca symulowane dane.
   */
  async printXReport(request?: FiscalReportRequest): Promise<FiscalReportResult> {
    const reportNumber = `X-${String(mockXReportCounter++).padStart(6, "0")}`;
    const reportData = request?.fetchData
      ? generateMockReportData("X", reportNumber)
      : undefined;

    console.log(`[MOCK] Raport X #${reportNumber} wygenerowany`);

    return {
      success: true,
      reportNumber,
      reportData,
      warning: mockReceiptCounter === 0 ? "Brak transakcji od ostatniego raportu Z" : undefined,
    };
  },

  /**
   * Drukuje raport Z (fiskalny) – zamyka dobę, zeruje liczniki.
   * W trybie mock resetuje liczniki symulacji.
   */
  async printZReport(request?: FiscalReportRequest): Promise<FiscalReportResult> {
    const reportNumber = `Z-${String(mockZReportCounter++).padStart(6, "0")}`;
    const reportData = request?.fetchData
      ? generateMockReportData("Z", reportNumber)
      : undefined;

    const hadTransactions = mockReceiptCounter > 0;

    // Zapisz raport Z do historii (dla raportów okresowych)
    mockZReportHistory.push({
      reportNumber,
      date: new Date(),
      totalGross: mockTotalGross,
      totalVat: mockTotalVat,
      receiptCount: mockReceiptCounter,
      voidCount: 0,
    });

    // Reset liczników po raporcie Z
    mockReceiptCounter = 0;
    mockTotalGross = 0;
    mockTotalVat = 0;
    mockXReportCounter = 1;

    console.log(`[MOCK] Raport Z #${reportNumber} wygenerowany, liczniki wyzerowane`);

    return {
      success: true,
      reportNumber,
      reportData,
      warning: !hadTransactions ? "Raport Z bez transakcji (zerowy)" : undefined,
    };
  },

  /**
   * Drukuje raport okresowy/miesięczny – zestawienie raportów Z z wybranego okresu.
   * W trybie mock zwraca symulowane dane z historii raportów Z.
   */
  async printPeriodicReport(request: PeriodicReportRequest): Promise<PeriodicReportResult> {
    const reportNumber = `P-${String(mockPeriodicReportCounter++).padStart(6, "0")}`;
    
    // Ustal zakres dat
    let dateFrom: Date;
    let dateTo: Date;
    
    if (request.reportType === "MONTHLY" && request.month && request.year) {
      // Dla raportu miesięcznego - pierwszy i ostatni dzień miesiąca
      dateFrom = new Date(request.year, request.month - 1, 1, 0, 0, 0, 0);
      dateTo = new Date(request.year, request.month, 0, 23, 59, 59, 999);
    } else {
      dateFrom = new Date(request.dateFrom);
      dateFrom.setHours(0, 0, 0, 0);
      dateTo = new Date(request.dateTo);
      dateTo.setHours(23, 59, 59, 999);
    }

    // Filtruj raporty Z z zakresu dat
    const reportsInRange = mockZReportHistory.filter((r) => {
      const reportDate = new Date(r.date);
      return reportDate >= dateFrom && reportDate <= dateTo;
    });

    // Oblicz sumy
    const totalGross = reportsInRange.reduce((sum, r) => sum + r.totalGross, 0);
    const totalVat = reportsInRange.reduce((sum, r) => sum + r.totalVat, 0);
    const totalReceiptCount = reportsInRange.reduce((sum, r) => sum + r.receiptCount, 0);
    const totalVoidCount = reportsInRange.reduce((sum, r) => sum + r.voidCount, 0);

    // Przygotuj dane raportu
    const reportData: PeriodicReportData | undefined = request.fetchData
      ? {
          reportType: request.reportType,
          reportNumber,
          generatedAt: new Date(),
          periodStart: dateFrom,
          periodEnd: dateTo,
          zReportCount: reportsInRange.length,
          firstZReportNumber: reportsInRange[0]?.reportNumber,
          lastZReportNumber: reportsInRange[reportsInRange.length - 1]?.reportNumber,
          totalGross,
          totalVat,
          totalNet: totalGross - totalVat,
          totalReceiptCount,
          totalVoidCount,
          totalVoidAmount: 0,
          vatSummary: [
            {
              vatLetter: "A",
              vatRate: 23,
              netAmount: totalGross * 0.4 / 1.23,
              vatAmount: totalGross * 0.4 - totalGross * 0.4 / 1.23,
              grossAmount: totalGross * 0.4,
            },
            {
              vatLetter: "B",
              vatRate: 8,
              netAmount: totalGross * 0.6 / 1.08,
              vatAmount: totalGross * 0.6 - totalGross * 0.6 / 1.08,
              grossAmount: totalGross * 0.6,
            },
          ],
          zReports: reportsInRange.map((r) => ({
            reportNumber: r.reportNumber,
            date: r.date,
            totalGross: r.totalGross,
            totalVat: r.totalVat,
            receiptCount: r.receiptCount,
            voidCount: r.voidCount,
          })),
          cashRegisterId: "MOCK-001",
        }
      : undefined;

    const periodDesc = request.reportType === "MONTHLY" 
      ? `${request.month}/${request.year}`
      : `${dateFrom.toLocaleDateString()} - ${dateTo.toLocaleDateString()}`;

    console.log(
      `[MOCK] Raport okresowy #${reportNumber} za ${periodDesc}: ` +
      `${reportsInRange.length} raportów Z, suma brutto: ${totalGross.toFixed(2)} PLN`
    );

    return {
      success: true,
      reportNumber,
      reportData,
      warning: reportsInRange.length === 0 
        ? "Brak raportów Z w wybranym okresie" 
        : undefined,
    };
  },

  async printStorno(request: FiscalStornoRequest): Promise<FiscalStornoResult> {
    // Walidacja: sprawdź czy podano numer oryginalnego paragonu
    if (!request.originalReceiptNumber) {
      return {
        success: false,
        errorCode: "VALIDATION_ERROR",
        errorMessage: "Numer oryginalnego paragonu jest wymagany",
      };
    }

    // Walidacja: sprawdź powód storna
    if (!request.reason) {
      return {
        success: false,
        errorCode: "VALIDATION_ERROR",
        errorMessage: "Powód storna jest wymagany",
      };
    }

    // Walidacja: kwota storna
    if (request.amount === undefined || request.amount <= 0) {
      return {
        success: false,
        errorCode: "VALIDATION_ERROR",
        errorMessage: "Kwota storna musi być większa od zera",
      };
    }

    // Szukaj oryginalnego paragonu w historii
    const originalReceipt = mockReceiptHistory.find(
      (r) => r.receiptNumber === request.originalReceiptNumber
    );

    // Sprawdź czy paragon istnieje
    if (!originalReceipt) {
      // W trybie mock pozwalamy na storno bez historii (dla testów)
      console.log(
        `[MOCK] UWAGA: Oryginalny paragon ${request.originalReceiptNumber} nie znaleziony w historii mock`
      );
    } else {
      // Sprawdź czy paragon nie był już stornowany
      if (originalReceipt.isStornoed) {
        return {
          success: false,
          errorCode: "ALREADY_STORNOED",
          errorMessage: `Paragon ${request.originalReceiptNumber} został już wcześniej stornowany`,
        };
      }

      // Sprawdź czy kwota storna nie przekracza kwoty oryginalnego paragonu
      if (request.amount > originalReceipt.amount) {
        return {
          success: false,
          errorCode: "AMOUNT_EXCEEDED",
          errorMessage: `Kwota storna (${request.amount.toFixed(2)} PLN) przekracza kwotę oryginalnego paragonu (${originalReceipt.amount.toFixed(2)} PLN)`,
        };
      }

      // Oznacz paragon jako stornowany
      originalReceipt.isStornoed = true;
    }

    // Generuj numer dokumentu storna
    const stornoNumber = `STORNO-${String(mockStornoCounter++).padStart(6, "0")}`;

    // Aktualizuj statystyki
    mockStornoAmount += request.amount;

    // Mapowanie powodu storna na czytelny tekst
    const reasonDescriptions: Record<string, string> = {
      CUSTOMER_RETURN: "Zwrot towaru",
      OPERATOR_ERROR: "Błąd operatora",
      PRICE_CORRECTION: "Korekta ceny",
      DUPLICATE_TRANSACTION: "Duplikat transakcji",
      PAYMENT_ISSUE: "Problem z płatnością",
      CUSTOMER_COMPLAINT: "Reklamacja klienta",
      OTHER: "Inny powód",
    };

    console.log(
      `[MOCK] Storno #${stornoNumber} paragonu ${request.originalReceiptNumber}: ` +
      `${request.amount.toFixed(2)} PLN, powód: ${reasonDescriptions[request.reason] || request.reason}` +
      (request.operatorNote ? `, notatka: ${request.operatorNote}` : "")
    );

    // Symuluj czas wydruku
    await new Promise((resolve) => setTimeout(resolve, 50));

    return {
      success: true,
      stornoNumber,
      stornoAmount: request.amount,
      originalReceiptNumber: request.originalReceiptNumber,
      stornoDate: new Date(),
    };
  },
};

export default noOpDriver;
