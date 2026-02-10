import type {
  FiscalConfig,
  FiscalDriver,
  FiscalInvoiceRequest,
  FiscalInvoiceResult,
  FiscalReceiptRequest,
  FiscalReceiptResult,
} from "./types";
import mockDriver from "./mock-driver";
import posnetHttpDriver from "./posnet-http-driver";

const FISCAL_ENABLED = process.env.FISCAL_ENABLED === "true";
const FISCAL_DRIVER = (process.env.FISCAL_DRIVER ?? "mock") as FiscalConfig["driver"];

function getDriver(): FiscalDriver {
  switch (FISCAL_DRIVER) {
    case "posnet":
      return posnetHttpDriver;
    case "novitus":
    case "elzab":
      // Placeholder: do implementacji sterowników sprzętowych
      return mockDriver;
    default:
      return mockDriver;
  }
}

/**
 * Czy integracja z kasą fiskalną jest włączona (FISCAL_ENABLED=true).
 */
export async function isFiscalEnabled(): Promise<boolean> {
  return FISCAL_ENABLED;
}

/**
 * Konfiguracja kasy (do wyświetlania w panelu / diagnostyce).
 */
export async function getFiscalConfig(): Promise<FiscalConfig> {
  return {
    enabled: FISCAL_ENABLED,
    driver: FISCAL_DRIVER,
    taxId: process.env.FISCAL_TAX_ID,
    pointName: process.env.FISCAL_POINT_NAME,
  };
}

/**
 * Wysyła paragon do kasy fiskalnej (jeśli włączona).
 * Wywoływane po utworzeniu transakcji w posting API i przy zaliczkach.
 * Nie rzuca – błąd kasy zwracany w wyniku; transakcja w systemie i tak istnieje.
 */
export async function printFiscalReceipt(
  request: FiscalReceiptRequest
): Promise<FiscalReceiptResult> {
  if (!FISCAL_ENABLED) {
    return { success: true };
  }

  const driver = getDriver();
  try {
    return await driver.printReceipt(request);
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd kasy fiskalnej",
    };
  }
}

/**
 * Buduje request paragonu z jednej pozycji (np. "Nocleg" / "Zaliczka").
 */
export async function buildReceiptRequest(params: {
  transactionId: string;
  reservationId: string;
  amount: number;
  type: string;
  description?: string;
  itemName?: string;
}): Promise<FiscalReceiptRequest> {
  const itemName =
    params.itemName ??
    (params.type === "DEPOSIT" ? "Zaliczka" : params.type === "ROOM" ? "Nocleg" : "Usługa");
  return {
    transactionId: params.transactionId,
    reservationId: params.reservationId,
    items: [{ name: itemName, quantity: 1, unitPrice: params.amount }],
    totalAmount: params.amount,
    paymentType: params.type,
    description: params.description,
  };
}

/**
 * Wysyła fakturę do kasy fiskalnej (POSNET itd.).
 * Wymaga powiązania rezerwacji z firmą (company) – dane z meldunku.
 */
export async function printFiscalInvoice(
  request: FiscalInvoiceRequest
): Promise<FiscalInvoiceResult> {
  if (!FISCAL_ENABLED) {
    return { success: true };
  }

  const driver = getDriver();
  if (!driver.printInvoice) {
    return { success: false, error: "Sterownik nie obsługuje druku faktur" };
  }

  try {
    return await driver.printInvoice(request);
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd druku faktury",
    };
  }
}
