/**
 * Główny moduł integracji z terminalami płatniczymi
 * Obsługuje Ingenico, Verifone oraz mock driver
 */

import type {
  PaymentTerminalType,
  PaymentTerminalDriver,
  TerminalConfig,
  TerminalStatusResult,
  PaymentRequest,
  PaymentResult,
  BatchCloseRequest,
  BatchCloseResult,
  PrintRequest,
  PrintResult,
} from "./types";

// Re-export typów
export * from "./types";

// Lazy import driverów (dla optymalizacji)
let mockDriver: PaymentTerminalDriver | null = null;
let ingenicoDriver: PaymentTerminalDriver | null = null;
let verifoneDriver: PaymentTerminalDriver | null = null;

// Aktywny driver i konfiguracja
let activeDriver: PaymentTerminalDriver | null = null;
let activeConfig: TerminalConfig | null = null;

/**
 * Pobiera typ terminala z konfiguracji środowiska
 */
function getTerminalType(): PaymentTerminalType {
  const type = process.env.PAYMENT_TERMINAL_TYPE?.toUpperCase();
  if (type === "INGENICO") return "INGENICO";
  if (type === "VERIFONE") return "VERIFONE";
  return "MOCK";
}

/**
 * Pobiera konfigurację terminala z środowiska
 */
function getTerminalConfig(): TerminalConfig {
  const type = getTerminalType();
  
  return {
    type,
    terminalId: process.env.PAYMENT_TERMINAL_ID || "TERMINAL001",
    merchantId: process.env.PAYMENT_TERMINAL_MERCHANT_ID,
    host: process.env.PAYMENT_TERMINAL_HOST || "192.168.1.100",
    port: process.env.PAYMENT_TERMINAL_PORT 
      ? parseInt(process.env.PAYMENT_TERMINAL_PORT) 
      : (type === "INGENICO" ? 8000 : 12345),
    comPort: process.env.PAYMENT_TERMINAL_COM_PORT,
    baudRate: process.env.PAYMENT_TERMINAL_BAUD_RATE 
      ? parseInt(process.env.PAYMENT_TERMINAL_BAUD_RATE) 
      : 115200,
    timeout: process.env.PAYMENT_TERMINAL_TIMEOUT 
      ? parseInt(process.env.PAYMENT_TERMINAL_TIMEOUT) 
      : 120000,
    printReceipt: process.env.PAYMENT_TERMINAL_PRINT_RECEIPT !== "false",
    requestSignature: process.env.PAYMENT_TERMINAL_REQUEST_SIGNATURE === "true",
    allowContactless: process.env.PAYMENT_TERMINAL_ALLOW_CONTACTLESS !== "false",
    currency: process.env.PAYMENT_TERMINAL_CURRENCY || "PLN",
  };
}

/**
 * Ładuje odpowiedni driver
 */
async function loadDriver(type: PaymentTerminalType): Promise<PaymentTerminalDriver> {
  switch (type) {
    case "INGENICO":
      if (!ingenicoDriver) {
        const module = await import("./ingenico-driver");
        ingenicoDriver = module.default || module.ingenicoDriver;
      }
      return ingenicoDriver;
      
    case "VERIFONE":
      if (!verifoneDriver) {
        const module = await import("./verifone-driver");
        verifoneDriver = module.default || module.verifoneDriver;
      }
      return verifoneDriver;
      
    case "MOCK":
    default:
      if (!mockDriver) {
        const module = await import("./mock-driver");
        mockDriver = module.default || module.mockDriver;
      }
      return mockDriver;
  }
}

/**
 * Inicjalizuje połączenie z terminalem
 */
export async function initializeTerminal(customConfig?: Partial<TerminalConfig>): Promise<boolean> {
  const baseConfig = getTerminalConfig();
  const config: TerminalConfig = { ...baseConfig, ...customConfig };
  
  try {
    const driver = await loadDriver(config.type);
    const success = await driver.initialize(config);
    
    if (success) {
      activeDriver = driver;
      activeConfig = config;
    }
    
    return success;
  } catch (error) {
    console.error("[PAYMENT TERMINAL] Initialization error:", error);
    return false;
  }
}

/**
 * Sprawdza czy terminal jest zainicjalizowany
 */
export function isTerminalInitialized(): boolean {
  return activeDriver !== null;
}

/**
 * Pobiera aktywną konfigurację terminala
 */
export function getActiveConfig(): TerminalConfig | null {
  return activeConfig;
}

/**
 * Pobiera status terminala
 */
export async function getTerminalStatus(): Promise<TerminalStatusResult> {
  if (!activeDriver) {
    return {
      success: false,
      status: "OFFLINE",
      errorMessage: "Terminal nie jest zainicjalizowany",
    };
  }
  
  try {
    return await activeDriver.getStatus();
  } catch (error) {
    return {
      success: false,
      status: "ERROR",
      errorMessage: error instanceof Error ? error.message : "Błąd pobierania statusu",
    };
  }
}

/**
 * Przetwarza płatność na terminalu
 */
export async function processTerminalPayment(request: PaymentRequest): Promise<PaymentResult> {
  if (!activeDriver) {
    return {
      success: false,
      status: "ERROR",
      errorCode: "NOT_INITIALIZED",
      errorMessage: "Terminal nie jest zainicjalizowany",
    };
  }
  
  // Walidacja kwoty
  if (request.amount <= 0) {
    return {
      success: false,
      status: "ERROR",
      errorCode: "INVALID_AMOUNT",
      errorMessage: "Kwota musi być większa od zera",
    };
  }
  
  // Maksymalna kwota (1 milion PLN w groszach)
  if (request.amount > 100000000) {
    return {
      success: false,
      status: "ERROR",
      errorCode: "AMOUNT_TOO_HIGH",
      errorMessage: "Kwota przekracza maksymalny limit",
    };
  }
  
  try {
    switch (request.transactionType) {
      case "SALE":
        return await activeDriver.processPayment(request);
      case "PREAUTH":
        return await activeDriver.processPreAuth(request);
      case "CAPTURE":
        return await activeDriver.capturePreAuth(request);
      case "VOID":
        return await activeDriver.voidTransaction(request);
      case "REFUND":
        return await activeDriver.processRefund(request);
      default:
        return {
          success: false,
          status: "ERROR",
          errorCode: "INVALID_TYPE",
          errorMessage: `Nieznany typ transakcji: ${request.transactionType}`,
        };
    }
  } catch (error) {
    return {
      success: false,
      status: "ERROR",
      errorMessage: error instanceof Error ? error.message : "Błąd przetwarzania płatności",
    };
  }
}

/**
 * Przetwarza sprzedaż (skrót)
 */
export async function processSale(amount: number, options?: Partial<PaymentRequest>): Promise<PaymentResult> {
  return processTerminalPayment({
    amount,
    transactionType: "SALE",
    currency: activeConfig?.currency || "PLN",
    ...options,
  });
}

/**
 * Przetwarza pre-autoryzację (blokada środków)
 */
export async function processPreAuth(amount: number, options?: Partial<PaymentRequest>): Promise<PaymentResult> {
  return processTerminalPayment({
    amount,
    transactionType: "PREAUTH",
    currency: activeConfig?.currency || "PLN",
    ...options,
  });
}

/**
 * Przechwytuje pre-autoryzację (pobiera środki)
 */
export async function capturePreAuth(
  originalTransactionId: string,
  amount: number,
  originalAuthCode?: string
): Promise<PaymentResult> {
  return processTerminalPayment({
    amount,
    transactionType: "CAPTURE",
    originalTransactionId,
    originalAuthCode,
    currency: activeConfig?.currency || "PLN",
  });
}

/**
 * Anuluje transakcję (void)
 */
export async function voidTransaction(
  originalTransactionId: string,
  amount?: number,
  originalAuthCode?: string
): Promise<PaymentResult> {
  return processTerminalPayment({
    amount: amount || 0,
    transactionType: "VOID",
    originalTransactionId,
    originalAuthCode,
    currency: activeConfig?.currency || "PLN",
  });
}

/**
 * Przetwarza zwrot
 */
export async function processRefund(
  amount: number,
  originalTransactionId?: string,
  options?: Partial<PaymentRequest>
): Promise<PaymentResult> {
  return processTerminalPayment({
    amount,
    transactionType: "REFUND",
    originalTransactionId,
    currency: activeConfig?.currency || "PLN",
    ...options,
  });
}

/**
 * Zamyka batch dzienny na terminalu
 */
export async function closeTerminalBatch(request?: BatchCloseRequest): Promise<BatchCloseResult> {
  if (!activeDriver) {
    return {
      success: false,
      errorCode: "NOT_INITIALIZED",
      errorMessage: "Terminal nie jest zainicjalizowany",
    };
  }
  
  try {
    return await activeDriver.closeBatch(request || {});
  } catch (error) {
    return {
      success: false,
      errorMessage: error instanceof Error ? error.message : "Błąd zamknięcia batch'a",
    };
  }
}

/**
 * Drukuje na terminalu
 */
export async function printOnTerminal(request: PrintRequest): Promise<PrintResult> {
  if (!activeDriver) {
    return {
      success: false,
      errorCode: "NOT_INITIALIZED",
      errorMessage: "Terminal nie jest zainicjalizowany",
    };
  }
  
  if (!activeDriver.print) {
    return {
      success: false,
      errorCode: "NOT_SUPPORTED",
      errorMessage: "Terminal nie obsługuje drukowania",
    };
  }
  
  try {
    return await activeDriver.print(request);
  } catch (error) {
    return {
      success: false,
      errorMessage: error instanceof Error ? error.message : "Błąd drukowania",
    };
  }
}

/**
 * Anuluje bieżącą operację na terminalu
 */
export async function cancelTerminalOperation(): Promise<boolean> {
  if (!activeDriver || !activeDriver.cancelOperation) {
    return false;
  }
  
  try {
    return await activeDriver.cancelOperation();
  } catch {
    return false;
  }
}

/**
 * Rozłącza terminal
 */
export async function disconnectTerminal(): Promise<void> {
  if (activeDriver) {
    try {
      await activeDriver.disconnect();
    } catch (error) {
      console.error("[PAYMENT TERMINAL] Disconnect error:", error);
    }
    activeDriver = null;
    activeConfig = null;
  }
}

/**
 * Sprawdza dostępność funkcji terminala
 */
export function getTerminalCapabilities(): {
  initialized: boolean;
  type: PaymentTerminalType | null;
  supportsPrint: boolean;
  supportsCancel: boolean;
  supportsPreAuth: boolean;
  supportsContactless: boolean;
} {
  return {
    initialized: activeDriver !== null,
    type: activeConfig?.type || null,
    supportsPrint: activeDriver?.print !== undefined,
    supportsCancel: activeDriver?.cancelOperation !== undefined,
    supportsPreAuth: true, // Wszystkie drivery obsługują pre-auth
    supportsContactless: activeConfig?.allowContactless !== false,
  };
}

/**
 * Formatuje kwotę do wyświetlenia
 */
export function formatAmount(amountInCents: number, currency: string = "PLN"): string {
  const amount = amountInCents / 100;
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency,
  }).format(amount);
}

/**
 * Konwertuje kwotę PLN na grosze
 */
export function toTerminalAmount(amountInPLN: number): number {
  return Math.round(amountInPLN * 100);
}

/**
 * Konwertuje grosze na kwotę PLN
 */
export function fromTerminalAmount(amountInCents: number): number {
  return amountInCents / 100;
}
