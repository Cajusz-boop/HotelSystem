import type {
  FiscalConfig,
  FiscalDriver,
  FiscalInvoiceRequest,
  FiscalInvoiceResult,
  FiscalReceiptRequest,
  FiscalReceiptResult,
  FiscalReportRequest,
  FiscalReportResult,
  PeriodicReportRequest,
  PeriodicReportResult,
  FiscalStornoRequest,
  FiscalStornoResult,
  PosnetModel,
  PosnetModelConfig,
} from "./types";
import mockDriver from "./mock-driver";
import posnetHttpDriver, { getPosnetDriverInfo } from "./posnet-http-driver";
import novitusDriver from "./novitus-driver";
import elzabDriver from "./elzab-driver";
import {
  getCurrentPosnetModel,
  getPosnetModelConfig,
  getAllPosnetModels,
  getEReceiptCapableModels,
  getInvoiceCapableModels,
} from "./posnet-models";

const FISCAL_ENABLED = process.env.FISCAL_ENABLED === "true";
/** Domyślnie no-op (mock). Produkcja: ustaw FISCAL_DRIVER=posnet|novitus|elzab. */
const FISCAL_DRIVER = (process.env.FISCAL_DRIVER ?? "mock") as FiscalConfig["driver"];

function getDriver(): FiscalDriver {
  switch (FISCAL_DRIVER) {
    case "posnet":
      return posnetHttpDriver;
    case "novitus":
      return novitusDriver;
    case "elzab":
      return elzabDriver;
    default:
      return mockDriver; // no-op gdy brak drukarki
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
  const baseConfig: FiscalConfig = {
    enabled: FISCAL_ENABLED,
    driver: FISCAL_DRIVER,
    taxId: process.env.FISCAL_TAX_ID,
    pointName: process.env.FISCAL_POINT_NAME,
  };

  // Dodaj informacje o modelu POSNET, jeśli to aktywny sterownik
  if (FISCAL_DRIVER === "posnet") {
    const posnetModel = getCurrentPosnetModel();
    const posnetModelConfig = getPosnetModelConfig(posnetModel);
    return {
      ...baseConfig,
      posnetModel,
      posnetModelConfig,
    };
  }

  return baseConfig;
}

/**
 * Pobiera szczegółowe informacje o sterowniku POSNET (do diagnostyki/UI).
 */
export async function getPosnetInfo(): Promise<{
  currentModel: PosnetModel;
  currentModelConfig: PosnetModelConfig;
  driverInfo: ReturnType<typeof getPosnetDriverInfo>;
  allModels: PosnetModelConfig[];
  eReceiptCapableModels: PosnetModelConfig[];
  invoiceCapableModels: PosnetModelConfig[];
}> {
  const currentModel = getCurrentPosnetModel();
  const currentModelConfig = getPosnetModelConfig(currentModel);
  const driverInfo = getPosnetDriverInfo();

  return {
    currentModel,
    currentModelConfig,
    driverInfo,
    allModels: getAllPosnetModels(),
    eReceiptCapableModels: getEReceiptCapableModels(),
    invoiceCapableModels: getInvoiceCapableModels(),
  };
}

const FISCAL_RECEIPT_TIMEOUT_MS = Number(process.env.FISCAL_RECEIPT_TIMEOUT_MS ?? "15000") || 15000;

/**
 * Wysyła paragon do kasy fiskalnej (jeśli włączona).
 * Wywoływane po utworzeniu transakcji w posting API i przy zaliczkach.
 * Nie rzuca – błąd kasy zwracany w wyniku; transakcja w systemie i tak istnieje.
 * Timeout (domyślnie 15s) – przy odłączonej drukarence zwraca komunikat, nie zawieszenie.
 */
export async function printFiscalReceipt(
  request: FiscalReceiptRequest
): Promise<FiscalReceiptResult> {
  if (!FISCAL_ENABLED) {
    return { success: true };
  }

  const driver = getDriver();
  try {
    const result = await Promise.race([
      driver.printReceipt(request),
      new Promise<FiscalReceiptResult>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Timeout druku paragonu (${FISCAL_RECEIPT_TIMEOUT_MS} ms) – sprawdź połączenie z drukarką`)),
          FISCAL_RECEIPT_TIMEOUT_MS
        )
      ),
    ]);
    return result;
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd kasy fiskalnej",
    };
  }
}

/**
 * Buduje request paragonu z jednej pozycji (np. "Nocleg" / "Zaliczka").
 * Używa konfigurowalnego szablonu paragonu z bazy danych.
 */
export async function buildReceiptRequest(params: {
  transactionId: string;
  reservationId: string;
  amount: number;
  type: string;
  description?: string;
  itemName?: string;
  roomNumber?: string;
  guestName?: string;
  checkIn?: Date;
  checkOut?: Date;
}): Promise<FiscalReceiptRequest> {
  // Pobierz szablon do headerLines/footerLines
  const { buildFiscalItemName, getFiscalReceiptTemplate } = await import("@/app/actions/finance");
  const templateResult = await getFiscalReceiptTemplate();
  
  // Zbuduj nagłówek i stopkę z szablonu
  const headerLines: string[] = [];
  const footerLines: string[] = [];
  
  if (templateResult.success && templateResult.data) {
    const template = templateResult.data;
    if (template.headerLine1) headerLines.push(template.headerLine1);
    if (template.headerLine2) headerLines.push(template.headerLine2);
    if (template.headerLine3) headerLines.push(template.headerLine3);
    if (template.footerLine1) footerLines.push(template.footerLine1);
    if (template.footerLine2) footerLines.push(template.footerLine2);
    if (template.footerLine3) footerLines.push(template.footerLine3);
  }

  // Jeśli podano itemName, użyj go bezpośrednio
  if (params.itemName) {
    return {
      transactionId: params.transactionId,
      reservationId: params.reservationId,
      items: [{ name: params.itemName, quantity: 1, unitPrice: params.amount }],
      totalAmount: params.amount,
      paymentType: params.type,
      description: params.description,
      headerLines: headerLines.length > 0 ? headerLines : undefined,
      footerLines: footerLines.length > 0 ? footerLines : undefined,
    };
  }

  // Pobierz nazwę z szablonu
  const itemName = await buildFiscalItemName({
    type: params.type,
    roomNumber: params.roomNumber,
    guestName: params.guestName,
    checkIn: params.checkIn,
    checkOut: params.checkOut,
  });

  return {
    transactionId: params.transactionId,
    reservationId: params.reservationId,
    items: [{ name: itemName, quantity: 1, unitPrice: params.amount }],
    totalAmount: params.amount,
    paymentType: params.type,
    description: params.description,
    headerLines: headerLines.length > 0 ? headerLines : undefined,
    footerLines: footerLines.length > 0 ? footerLines : undefined,
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

/**
 * Drukuje raport X (niefiskalny) – informacyjny, nie zamyka dnia.
 * 
 * Raport X pokazuje aktualny stan kasy od ostatniego raportu Z:
 * - Sumę sprzedaży per stawka VAT
 * - Sumę płatności per typ
 * - Liczbę paragonów
 * 
 * Można drukować wielokrotnie w ciągu dnia.
 */
export async function printFiscalXReport(
  request?: FiscalReportRequest
): Promise<FiscalReportResult> {
  if (!FISCAL_ENABLED) {
    return { 
      success: true, 
      warning: "Integracja z kasą fiskalną jest wyłączona (FISCAL_ENABLED=false)" 
    };
  }

  const driver = getDriver();
  if (!driver.printXReport) {
    return { 
      success: false, 
      error: "Sterownik nie obsługuje druku raportu X",
      errorCode: "DRIVER_NO_X_REPORT_SUPPORT",
    };
  }

  try {
    return await driver.printXReport(request);
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd druku raportu X",
    };
  }
}

/**
 * Drukuje raport Z (fiskalny) – zamyka dobę, zeruje liczniki.
 * 
 * UWAGA: Raport Z jest nieodwracalny i wymagany prawem.
 * - Musi być wykonany raz dziennie (przed północą)
 * - Zeruje liczniki sprzedaży
 * - Zapisuje dane do pamięci fiskalnej
 * 
 * Raport Z powinien być drukowany w ramach procedury Night Audit.
 */
export async function printFiscalZReport(
  request?: FiscalReportRequest
): Promise<FiscalReportResult> {
  if (!FISCAL_ENABLED) {
    return { 
      success: true, 
      warning: "Integracja z kasą fiskalną jest wyłączona (FISCAL_ENABLED=false)" 
    };
  }

  const driver = getDriver();
  if (!driver.printZReport) {
    return { 
      success: false, 
      error: "Sterownik nie obsługuje druku raportu Z",
      errorCode: "DRIVER_NO_Z_REPORT_SUPPORT",
    };
  }

  try {
    return await driver.printZReport(request);
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd druku raportu Z",
    };
  }
}

/**
 * Drukuje raport okresowy/miesięczny – zestawienie raportów Z z wybranego okresu.
 * 
 * Raport okresowy jest wymagany do rozliczenia miesięcznego.
 * Pokazuje sumę wszystkich raportów Z z danego okresu.
 * 
 * @param request - Żądanie z zakresem dat lub miesiącem/rokiem
 */
export async function printFiscalPeriodicReport(
  request: PeriodicReportRequest
): Promise<PeriodicReportResult> {
  if (!FISCAL_ENABLED) {
    return { 
      success: true, 
      warning: "Integracja z kasą fiskalną jest wyłączona (FISCAL_ENABLED=false)" 
    };
  }

  const driver = getDriver();
  if (!driver.printPeriodicReport) {
    return { 
      success: false, 
      error: "Sterownik nie obsługuje druku raportów okresowych",
      errorCode: "DRIVER_NO_PERIODIC_REPORT_SUPPORT",
    };
  }

  try {
    return await driver.printPeriodicReport(request);
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd druku raportu okresowego",
    };
  }
}

/**
 * Wykonuje storno (anulowanie) paragonu fiskalnego.
 * 
 * Storno to dokument korygujący, który:
 * - NIE usuwa oryginalnego paragonu z pamięci fiskalnej
 * - Tworzy zapis korekty z odwołaniem do oryginału
 * - Jest wymagany przepisami przy zwrotach/korektach
 * 
 * @param request - Żądanie storna z numerem oryginalnego paragonu i powodem
 */
export async function printFiscalStorno(
  request: FiscalStornoRequest
): Promise<FiscalStornoResult> {
  if (!FISCAL_ENABLED) {
    return {
      success: false,
      errorCode: "FISCAL_DISABLED",
      error: "Integracja z kasą fiskalną jest wyłączona (FISCAL_ENABLED=false)",
    };
  }

  const driver = getDriver();
  if (!driver.printStorno) {
    return {
      success: false,
      errorCode: "DRIVER_NO_STORNO_SUPPORT",
      error: "Sterownik nie obsługuje operacji storna",
    };
  }

  try {
    return await driver.printStorno(request);
  } catch (e) {
    return {
      success: false,
      errorCode: "STORNO_ERROR",
      error: e instanceof Error ? e.message : "Błąd operacji storna",
    };
  }
}

/**
 * Sprawdza, czy sterownik obsługuje raporty fiskalne X, Z, okresowe i storno.
 */
export async function supportsFiscalReports(): Promise<{
  supportsXReport: boolean;
  supportsZReport: boolean;
  supportsPeriodicReport: boolean;
  supportsStorno: boolean;
}> {
  if (!FISCAL_ENABLED) {
    return { 
      supportsXReport: false, 
      supportsZReport: false, 
      supportsPeriodicReport: false,
      supportsStorno: false,
    };
  }

  const driver = getDriver();
  return {
    supportsXReport: !!driver.printXReport,
    supportsZReport: !!driver.printZReport,
    supportsPeriodicReport: !!driver.printPeriodicReport,
    supportsStorno: !!driver.printStorno,
  };
}
