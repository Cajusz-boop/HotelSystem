/**
 * Mock driver dla terminala płatniczego
 * Używany do developmentu i testów
 */

import type {
  PaymentTerminalDriver,
  TerminalConfig,
  TerminalStatusResult,
  PaymentRequest,
  PaymentResult,
  BatchCloseRequest,
  BatchCloseResult,
  PrintRequest,
  PrintResult,
  CardType,
  CardEntryMode,
} from "./types";

// Symulowane opóźnienie operacji (ms)
const MOCK_DELAY_MIN = 500;
const MOCK_DELAY_MAX = 2000;

// Liczniki symulacji
let mockTransactionCounter = 1;
let mockBatchCounter = 1;
let mockBatchTransactions: Array<{
  id: string;
  amount: number;
  type: "CREDIT" | "DEBIT";
  timestamp: Date;
}> = [];

// Symulowana konfiguracja
let currentConfig: TerminalConfig | null = null;
let isConnected = false;

// Symulowane karty testowe
const TEST_CARDS: Array<{
  pattern: string;
  type: CardType;
  approved: boolean;
  message?: string;
}> = [
  { pattern: "4111", type: "VISA", approved: true },
  { pattern: "5500", type: "MASTERCARD", approved: true },
  { pattern: "3400", type: "AMEX", approved: true },
  { pattern: "4000", type: "VISA", approved: false, message: "Niewystarczające środki" },
  { pattern: "5100", type: "MASTERCARD", approved: false, message: "Karta zablokowana" },
];

/**
 * Symuluje opóźnienie operacji
 */
function simulateDelay(): Promise<void> {
  const delay = Math.floor(
    Math.random() * (MOCK_DELAY_MAX - MOCK_DELAY_MIN) + MOCK_DELAY_MIN
  );
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Generuje losowy numer karty (zamaskowany)
 */
function generateMockCardNumber(): string {
  const last4 = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
  return `****${last4}`;
}

/**
 * Generuje losowy kod autoryzacji
 */
function generateAuthCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Generuje numer referencyjny
 */
function generateReferenceNumber(): string {
  return String(Date.now()).slice(-12);
}

/**
 * Losuje typ karty
 */
function getRandomCardType(): CardType {
  const types: CardType[] = ["VISA", "MASTERCARD", "VISA", "MASTERCARD", "AMEX"];
  return types[Math.floor(Math.random() * types.length)];
}

/**
 * Losuje metodę wprowadzenia karty
 */
function getRandomEntryMode(): CardEntryMode {
  const modes: CardEntryMode[] = ["CHIP", "CONTACTLESS", "CHIP", "CONTACTLESS", "SWIPE"];
  return modes[Math.floor(Math.random() * modes.length)];
}

/**
 * Symuluje wynik płatności
 */
function simulatePaymentResult(request: PaymentRequest): PaymentResult {
  // 90% transakcji jest zatwierdzanych
  const isApproved = Math.random() < 0.9;
  const cardType = getRandomCardType();
  const entryMode = getRandomEntryMode();
  const transactionId = `MOCK-${String(mockTransactionCounter++).padStart(8, "0")}`;
  const now = new Date();

  if (!isApproved) {
    const declineReasons = [
      { code: "51", message: "Niewystarczające środki" },
      { code: "14", message: "Nieprawidłowy numer karty" },
      { code: "54", message: "Karta wygasła" },
      { code: "57", message: "Transakcja niedozwolona" },
      { code: "91", message: "Bank wydawcy niedostępny" },
    ];
    const reason = declineReasons[Math.floor(Math.random() * declineReasons.length)];
    
    return {
      success: false,
      status: "DECLINED",
      transactionId,
      cardType,
      cardNumber: generateMockCardNumber(),
      cardEntryMode: entryMode,
      errorCode: reason.code,
      errorMessage: reason.message,
      transactionTime: now,
    };
  }

  // Zatwierdzona transakcja
  const approvedAmount = request.allowPartialApproval && Math.random() < 0.1
    ? Math.floor(request.amount * 0.8)  // Częściowe zatwierdzenie
    : request.amount;
  
  const tipAmount = request.requestTip ? Math.floor(request.amount * 0.1) : 0;

  // Dodaj do batch'a
  mockBatchTransactions.push({
    id: transactionId,
    amount: approvedAmount,
    type: request.transactionType === "REFUND" ? "DEBIT" : "CREDIT",
    timestamp: now,
  });

  return {
    success: true,
    status: "APPROVED",
    transactionId,
    authCode: generateAuthCode(),
    referenceNumber: generateReferenceNumber(),
    approvedAmount,
    tipAmount,
    totalAmount: approvedAmount + tipAmount,
    cardType,
    cardNumber: generateMockCardNumber(),
    cardholderName: "JAN KOWALSKI",
    cardEntryMode: entryMode,
    cardExpiryDate: "12/27",
    receiptData: {
      merchantCopy: generateReceiptText(true, {
        transactionId,
        amount: approvedAmount,
        cardType,
        entryMode,
        authCode: generateAuthCode(),
        time: now,
      }),
      customerCopy: generateReceiptText(false, {
        transactionId,
        amount: approvedAmount,
        cardType,
        entryMode,
        authCode: generateAuthCode(),
        time: now,
      }),
      merchantName: "Hotel Test",
      terminalId: currentConfig?.terminalId || "MOCK001",
      transactionDate: now.toLocaleDateString("pl-PL"),
      transactionTime: now.toLocaleTimeString("pl-PL"),
      aid: "A0000000031010",
      tvr: "0000008000",
      tsi: "E800",
    },
    transactionTime: now,
  };
}

/**
 * Generuje tekst paragonu
 */
function generateReceiptText(
  isMerchant: boolean,
  data: {
    transactionId: string;
    amount: number;
    cardType: CardType;
    entryMode: CardEntryMode;
    authCode: string;
    time: Date;
  }
): string {
  const lines = [
    "================================",
    "        HOTEL TEST              ",
    "    ul. Testowa 123             ",
    "    00-001 Warszawa             ",
    "================================",
    "",
    `Terminal: ${currentConfig?.terminalId || "MOCK001"}`,
    `Data: ${data.time.toLocaleDateString("pl-PL")}`,
    `Czas: ${data.time.toLocaleTimeString("pl-PL")}`,
    "",
    `Transakcja: ${data.transactionId}`,
    `Typ: SPRZEDAŻ`,
    `Karta: ${data.cardType}`,
    `Metoda: ${data.entryMode}`,
    "",
    `KWOTA: ${(data.amount / 100).toFixed(2)} PLN`,
    "",
    `Kod aut.: ${data.authCode}`,
    "",
    isMerchant ? "KOPIA MERCHANTA" : "KOPIA KLIENTA",
    "",
    "STATUS: ZATWIERDZONO",
    "================================",
  ];
  return lines.join("\n");
}

/**
 * Mock driver implementujący PaymentTerminalDriver
 */
export const mockDriver: PaymentTerminalDriver = {
  async initialize(config: TerminalConfig): Promise<boolean> {
    await simulateDelay();
    currentConfig = config;
    isConnected = true;
    console.log(`[MOCK TERMINAL] Initialized with config:`, config);
    return true;
  },

  async getStatus(): Promise<TerminalStatusResult> {
    await simulateDelay();
    
    if (!isConnected) {
      return {
        success: false,
        status: "OFFLINE",
        errorMessage: "Terminal nie jest połączony",
      };
    }

    return {
      success: true,
      status: "IDLE",
      terminalId: currentConfig?.terminalId || "MOCK001",
      terminalModel: "Mock Terminal v1.0",
      firmwareVersion: "1.0.0-mock",
      lastTransaction: mockBatchTransactions.length > 0
        ? mockBatchTransactions[mockBatchTransactions.length - 1].timestamp
        : undefined,
      batteryLevel: 100,
      paperStatus: "OK",
      connectionType: "ETHERNET",
    };
  },

  async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    await simulateDelay();
    
    if (!isConnected) {
      return {
        success: false,
        status: "ERROR",
        errorCode: "NOT_CONNECTED",
        errorMessage: "Terminal nie jest połączony",
      };
    }

    if (request.amount <= 0) {
      return {
        success: false,
        status: "ERROR",
        errorCode: "INVALID_AMOUNT",
        errorMessage: "Kwota musi być większa od zera",
      };
    }

    console.log(`[MOCK TERMINAL] Processing payment: ${request.amount / 100} PLN`);
    return simulatePaymentResult(request);
  },

  async processPreAuth(request: PaymentRequest): Promise<PaymentResult> {
    await simulateDelay();
    
    if (!isConnected) {
      return {
        success: false,
        status: "ERROR",
        errorCode: "NOT_CONNECTED",
        errorMessage: "Terminal nie jest połączony",
      };
    }

    console.log(`[MOCK TERMINAL] Processing pre-auth: ${request.amount / 100} PLN`);
    const result = simulatePaymentResult({ ...request, transactionType: "PREAUTH" });
    if (result.success) {
      result.status = "APPROVED";
    }
    return result;
  },

  async capturePreAuth(request: PaymentRequest): Promise<PaymentResult> {
    await simulateDelay();
    
    if (!isConnected) {
      return {
        success: false,
        status: "ERROR",
        errorCode: "NOT_CONNECTED",
        errorMessage: "Terminal nie jest połączony",
      };
    }

    if (!request.originalTransactionId) {
      return {
        success: false,
        status: "ERROR",
        errorCode: "MISSING_ORIGINAL",
        errorMessage: "Wymagany jest ID oryginalnej transakcji",
      };
    }

    console.log(`[MOCK TERMINAL] Capturing pre-auth: ${request.originalTransactionId}`);
    return simulatePaymentResult({ ...request, transactionType: "CAPTURE" });
  },

  async voidTransaction(request: PaymentRequest): Promise<PaymentResult> {
    await simulateDelay();
    
    if (!isConnected) {
      return {
        success: false,
        status: "ERROR",
        errorCode: "NOT_CONNECTED",
        errorMessage: "Terminal nie jest połączony",
      };
    }

    if (!request.originalTransactionId) {
      return {
        success: false,
        status: "ERROR",
        errorCode: "MISSING_ORIGINAL",
        errorMessage: "Wymagany jest ID oryginalnej transakcji",
      };
    }

    console.log(`[MOCK TERMINAL] Voiding transaction: ${request.originalTransactionId}`);
    
    // Usuń z batch'a jeśli istnieje
    mockBatchTransactions = mockBatchTransactions.filter(
      (t) => t.id !== request.originalTransactionId
    );

    return {
      success: true,
      status: "APPROVED",
      transactionId: `VOID-${String(mockTransactionCounter++).padStart(8, "0")}`,
      authCode: generateAuthCode(),
      referenceNumber: generateReferenceNumber(),
      transactionTime: new Date(),
    };
  },

  async processRefund(request: PaymentRequest): Promise<PaymentResult> {
    await simulateDelay();
    
    if (!isConnected) {
      return {
        success: false,
        status: "ERROR",
        errorCode: "NOT_CONNECTED",
        errorMessage: "Terminal nie jest połączony",
      };
    }

    if (request.amount <= 0) {
      return {
        success: false,
        status: "ERROR",
        errorCode: "INVALID_AMOUNT",
        errorMessage: "Kwota zwrotu musi być większa od zera",
      };
    }

    console.log(`[MOCK TERMINAL] Processing refund: ${request.amount / 100} PLN`);
    return simulatePaymentResult({ ...request, transactionType: "REFUND" });
  },

  async closeBatch(request: BatchCloseRequest): Promise<BatchCloseResult> {
    await simulateDelay();
    
    if (!isConnected) {
      return {
        success: false,
        errorCode: "NOT_CONNECTED",
        errorMessage: "Terminal nie jest połączony",
      };
    }

    const batchNumber = `BATCH-${String(mockBatchCounter++).padStart(6, "0")}`;
    const creditTx = mockBatchTransactions.filter((t) => t.type === "CREDIT");
    const debitTx = mockBatchTransactions.filter((t) => t.type === "DEBIT");

    const result: BatchCloseResult = {
      success: true,
      batchNumber,
      transactionCount: mockBatchTransactions.length,
      totalAmount: mockBatchTransactions.reduce((sum, t) => 
        sum + (t.type === "CREDIT" ? t.amount : -t.amount), 0
      ),
      creditCount: creditTx.length,
      creditAmount: creditTx.reduce((sum, t) => sum + t.amount, 0),
      debitCount: debitTx.length,
      debitAmount: debitTx.reduce((sum, t) => sum + t.amount, 0),
      reportData: generateBatchReport(batchNumber, mockBatchTransactions),
      closedAt: new Date(),
    };

    console.log(`[MOCK TERMINAL] Batch closed: ${batchNumber}, ${result.transactionCount} transactions`);
    
    // Wyczyść batch
    mockBatchTransactions = [];

    return result;
  },

  async print(request: PrintRequest): Promise<PrintResult> {
    await simulateDelay();
    
    if (!isConnected) {
      return {
        success: false,
        errorCode: "NOT_CONNECTED",
        errorMessage: "Terminal nie jest połączony",
      };
    }

    console.log(`[MOCK TERMINAL] Printing:\n${request.content}`);
    return { success: true };
  },

  async cancelOperation(): Promise<boolean> {
    console.log(`[MOCK TERMINAL] Operation cancelled`);
    return true;
  },

  async disconnect(): Promise<void> {
    isConnected = false;
    currentConfig = null;
    console.log(`[MOCK TERMINAL] Disconnected`);
  },
};

/**
 * Generuje raport batch'a
 */
function generateBatchReport(
  batchNumber: string,
  transactions: typeof mockBatchTransactions
): string {
  const creditTx = transactions.filter((t) => t.type === "CREDIT");
  const debitTx = transactions.filter((t) => t.type === "DEBIT");
  const creditTotal = creditTx.reduce((sum, t) => sum + t.amount, 0);
  const debitTotal = debitTx.reduce((sum, t) => sum + t.amount, 0);

  const lines = [
    "================================",
    "     RAPORT ZAMKNIĘCIA DNIA     ",
    "================================",
    "",
    `Numer batch: ${batchNumber}`,
    `Data: ${new Date().toLocaleDateString("pl-PL")}`,
    `Czas: ${new Date().toLocaleTimeString("pl-PL")}`,
    "",
    "--------------------------------",
    "SPRZEDAŻ:",
    `  Liczba transakcji: ${creditTx.length}`,
    `  Suma: ${(creditTotal / 100).toFixed(2)} PLN`,
    "",
    "ZWROTY:",
    `  Liczba transakcji: ${debitTx.length}`,
    `  Suma: ${(debitTotal / 100).toFixed(2)} PLN`,
    "",
    "--------------------------------",
    `NETTO: ${((creditTotal - debitTotal) / 100).toFixed(2)} PLN`,
    "================================",
  ];
  return lines.join("\n");
}

/**
 * Resetuje stan mocka (dla testów)
 */
export function resetMockState(): void {
  mockTransactionCounter = 1;
  mockBatchCounter = 1;
  mockBatchTransactions = [];
  isConnected = false;
  currentConfig = null;
}

export default mockDriver;
