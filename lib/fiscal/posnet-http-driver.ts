import type {
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
} from "./types";
import {
  getCurrentPosnetModel,
  getPosnetModelConfig,
  getPaymentCodes,
  truncateTextForModel,
  formatLinesForModel,
  validateReceiptForModel,
  DEFAULT_VAT_RATES,
} from "./posnet-models";

function getEnvNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Sterownik POSNET przez HTTP do lokalnego "mostka" (bridge).
 *
 * Aplikacja Next.js (serwer) wysyła JSON z paragonem do usługi w sieci/LAN/localhost,
 * a ta usługa komunikuje się z urządzeniem POSNET (USB/COM/LAN) przy użyciu
 * sterownika producenta / OPOS / własnej implementacji.
 *
 * Obsługuje różne modele POSNET (Thermal, Ergo, NEO, Revo, itp.) z ich
 * specyficznymi ograniczeniami (szerokość linii, liczba pozycji, protokół).
 *
 * Wymagane zmienne:
 * - FISCAL_POSNET_ENDPOINT (np. http://127.0.0.1:9977/fiscal/print)
 * Opcjonalne:
 * - FISCAL_POSNET_API_KEY
 * - FISCAL_POSNET_TIMEOUT_MS
 * - FISCAL_POSNET_MODEL (thermal, thermal_hs, ergo, neo, revo, itp.)
 */
const baseUrl =
  (process.env.FISCAL_POSNET_ENDPOINT ?? "http://127.0.0.1:9977/fiscal/print").replace(
    /\/fiscal\/print\/?$/i,
    ""
  ) || "http://127.0.0.1:9977";
const receiptEndpoint = `${baseUrl}/fiscal/print`;
const invoiceEndpoint = `${baseUrl}/fiscal/invoice`;
const xReportEndpoint = `${baseUrl}/fiscal/report/x`;
const zReportEndpoint = `${baseUrl}/fiscal/report/z`;
const periodicReportEndpoint = `${baseUrl}/fiscal/report/periodic`;
const stornoEndpoint = `${baseUrl}/fiscal/storno`;
const apiKey = process.env.FISCAL_POSNET_API_KEY;
const timeoutMs = getEnvNumber("FISCAL_POSNET_TIMEOUT_MS", 8000);
// Dłuższy timeout dla raportów (mogą trwać dłużej)
const reportTimeoutMs = getEnvNumber("FISCAL_POSNET_REPORT_TIMEOUT_MS", 30000);

/**
 * Pobiera aktualny model POSNET i jego konfigurację.
 */
function getModelInfo() {
  const model = getCurrentPosnetModel();
  const config = getPosnetModelConfig(model);
  return { model, config };
}

/**
 * Mapuje typ płatności z systemu na kod POSNET (zależnie od wersji protokołu).
 */
function mapPaymentType(paymentType: string, model: PosnetModel): string {
  const config = getPosnetModelConfig(model);
  const codes = getPaymentCodes(config.protocolVersion);

  const typeUpper = paymentType.toUpperCase();
  switch (typeUpper) {
    case "CASH":
    case "GOTOWKA":
    case "GOTÓWKA":
      return codes.cash;
    case "CARD":
    case "KARTA":
      return codes.card;
    case "TRANSFER":
    case "PRZELEW":
      return codes.transfer;
    case "VOUCHER":
    case "BON":
      return codes.voucher;
    case "CREDIT":
    case "KREDYT":
      return codes.credit;
    case "CHECK":
    case "CZEK":
      return codes.check;
    default:
      // Dla posting, deposit itp. - traktuj jako gotówkę lub inne
      return codes.other;
  }
}

/**
 * Mapuje stawkę VAT na literę PTU.
 */
function mapVatRate(vatRate: number | undefined): string {
  if (vatRate === undefined || vatRate === null) {
    return DEFAULT_VAT_RATES.rateToLetter[8] ?? "B"; // Domyślnie 8% dla usług hotelowych
  }
  return DEFAULT_VAT_RATES.rateToLetter[vatRate] ?? DEFAULT_VAT_RATES.rateToLetter[23] ?? "A";
}

/**
 * Przygotowuje żądanie paragonu zgodne z ograniczeniami modelu.
 */
function prepareReceiptForModel(
  request: FiscalReceiptRequest,
  model: PosnetModel
): FiscalReceiptRequest & { 
  modelInfo: { model: PosnetModel; displayName: string; protocolVersion: 1 | 2 };
  posnetPaymentCode: string;
  warnings: string[];
} {
  const config = getPosnetModelConfig(model);
  const warnings = validateReceiptForModel(
    request.items,
    request.headerLines,
    request.footerLines,
    model
  );

  // Skróć nazwy pozycji
  const processedItems = request.items.map((item) => ({
    ...item,
    name: truncateTextForModel(item.name, model, "itemName"),
    vatLetter: mapVatRate(item.vatRate),
  }));

  // Ogranicz liczbę pozycji
  const maxItems = config.maxItemsPerReceipt;
  const limitedItems = maxItems > 0 ? processedItems.slice(0, maxItems) : processedItems;

  // Przetwórz nagłówek i stopkę
  const processedHeader = request.headerLines
    ? formatLinesForModel(request.headerLines, model, "header")
    : undefined;
  const processedFooter = request.footerLines
    ? formatLinesForModel(request.footerLines, model, "footer")
    : undefined;

  return {
    ...request,
    items: limitedItems,
    headerLines: processedHeader,
    footerLines: processedFooter,
    modelInfo: {
      model,
      displayName: config.displayName,
      protocolVersion: config.protocolVersion,
    },
    posnetPaymentCode: mapPaymentType(request.paymentType, model),
    warnings,
  };
}

/**
 * Przygotowuje żądanie faktury zgodne z ograniczeniami modelu.
 */
function prepareInvoiceForModel(
  request: FiscalInvoiceRequest,
  model: PosnetModel
): FiscalInvoiceRequest & {
  modelInfo: { model: PosnetModel; displayName: string; protocolVersion: 1 | 2 };
  warnings: string[];
} {
  const config = getPosnetModelConfig(model);
  const warnings: string[] = [];

  if (!config.supportsInvoice) {
    warnings.push(
      `Model ${config.displayName} nie obsługuje druku faktur. ` +
      `Faktura zostanie wydrukowana jako paragon z NIP.`
    );
  }

  // Skróć nazwy pozycji
  const processedItems = request.items.map((item) => ({
    ...item,
    name: truncateTextForModel(item.name, model, "itemName"),
    vatLetter: mapVatRate(item.vatRate),
  }));

  return {
    ...request,
    items: processedItems,
    modelInfo: {
      model,
      displayName: config.displayName,
      protocolVersion: config.protocolVersion,
    },
    warnings,
  };
}

const posnetHttpDriver: FiscalDriver = {
  name: "posnet",

  async printReceipt(request: FiscalReceiptRequest): Promise<FiscalReceiptResult> {
    const { model, config } = getModelInfo();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      // Przygotuj żądanie zgodne z ograniczeniami modelu
      const preparedRequest = prepareReceiptForModel(request, model);

      // Loguj ostrzeżenia (do debugowania)
      if (preparedRequest.warnings.length > 0) {
        console.warn(
          `[POSNET ${config.displayName}] Ostrzeżenia:`,
          preparedRequest.warnings
        );
      }

      const res = await fetch(receiptEndpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(apiKey ? { "x-api-key": apiKey } : {}),
        },
        body: JSON.stringify(preparedRequest),
        signal: controller.signal,
      });

      const data = (await res.json().catch(() => null)) as unknown;

      if (!res.ok) {
        const errorMessage =
          typeof (data as { error?: unknown } | null)?.error === "string"
            ? (data as { error: string }).error
            : `POSNET bridge HTTP ${res.status}`;
        const errorCode =
          typeof (data as { errorCode?: unknown } | null)?.errorCode === "string"
            ? (data as { errorCode: string }).errorCode
            : undefined;
        return { 
          success: false, 
          error: `[${config.displayName}] ${errorMessage}`,
          errorCode,
        };
      }

      if (data && typeof (data as { success?: unknown }).success === "boolean") {
        const result = data as FiscalReceiptResult;
        return result;
      }

      // Bridge nie zwrócił standardowego formatu – uznajemy sukces, ale bez numeru.
      return { success: true };
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.name === "AbortError"
            ? `Timeout POSNET bridge (${timeoutMs} ms) - model: ${config.displayName}`
            : e.message
          : "Błąd połączenia z POSNET bridge";
      return { success: false, error: msg };
    } finally {
      clearTimeout(timeout);
    }
  },

  async printInvoice(request: FiscalInvoiceRequest): Promise<FiscalInvoiceResult> {
    const { model, config } = getModelInfo();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    // Sprawdź, czy model obsługuje faktury
    if (!config.supportsInvoice) {
      return {
        success: false,
        error: `Model ${config.displayName} nie obsługuje druku faktur na kasie fiskalnej. ` +
               `Użyj modelu z obsługą faktur (np. Ergo, NEO, Revo) lub wydrukuj fakturę na zwykłej drukarce.`,
        errorCode: "MODEL_NO_INVOICE_SUPPORT",
      };
    }

    try {
      // Przygotuj żądanie zgodne z ograniczeniami modelu
      const preparedRequest = prepareInvoiceForModel(request, model);

      // Loguj ostrzeżenia
      if (preparedRequest.warnings.length > 0) {
        console.warn(
          `[POSNET ${config.displayName}] Ostrzeżenia faktury:`,
          preparedRequest.warnings
        );
      }

      const res = await fetch(invoiceEndpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(apiKey ? { "x-api-key": apiKey } : {}),
        },
        body: JSON.stringify(preparedRequest),
        signal: controller.signal,
      });

      const data = (await res.json().catch(() => null)) as unknown;

      if (!res.ok) {
        const errorMessage =
          typeof (data as { error?: unknown } | null)?.error === "string"
            ? (data as { error: string }).error
            : `POSNET bridge HTTP ${res.status}`;
        const errorCode =
          typeof (data as { errorCode?: unknown } | null)?.errorCode === "string"
            ? (data as { errorCode: string }).errorCode
            : undefined;
        return { 
          success: false, 
          error: `[${config.displayName}] ${errorMessage}`,
          errorCode,
        };
      }

      if (data && typeof (data as { success?: unknown }).success === "boolean") {
        const result = data as FiscalInvoiceResult;
        return result;
      }

      return { success: true };
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.name === "AbortError"
            ? `Timeout POSNET bridge (${timeoutMs} ms) - model: ${config.displayName}`
            : e.message
          : "Błąd połączenia z POSNET bridge";
      return { success: false, error: msg };
    } finally {
      clearTimeout(timeout);
    }
  },

  /**
   * Drukuje raport X (niefiskalny) – informacyjny, nie zamyka dnia.
   * Wywołuje endpoint /fiscal/report/x na bridge.
   */
  async printXReport(request?: FiscalReportRequest): Promise<FiscalReportResult> {
    const { config } = getModelInfo();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), reportTimeoutMs);

    try {
      const res = await fetch(xReportEndpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(apiKey ? { "x-api-key": apiKey } : {}),
        },
        body: JSON.stringify({
          fetchData: request?.fetchData ?? false,
          operatorNote: request?.operatorNote,
          model: config.model,
        }),
        signal: controller.signal,
      });

      const data = (await res.json().catch(() => null)) as unknown;

      if (!res.ok) {
        const errorMessage =
          typeof (data as { error?: unknown } | null)?.error === "string"
            ? (data as { error: string }).error
            : `POSNET bridge HTTP ${res.status}`;
        const errorCode =
          typeof (data as { errorCode?: unknown } | null)?.errorCode === "string"
            ? (data as { errorCode: string }).errorCode
            : undefined;
        return {
          success: false,
          error: `[${config.displayName}] Raport X: ${errorMessage}`,
          errorCode,
        };
      }

      if (data && typeof (data as { success?: unknown }).success === "boolean") {
        const result = data as FiscalReportResult;
        return result;
      }

      return { success: true };
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.name === "AbortError"
            ? `Timeout raportu X (${reportTimeoutMs} ms) - model: ${config.displayName}`
            : e.message
          : "Błąd generowania raportu X";
      return { success: false, error: msg };
    } finally {
      clearTimeout(timeout);
    }
  },

  /**
   * Drukuje raport Z (fiskalny) – zamyka dobę, zeruje liczniki.
   * Wywołuje endpoint /fiscal/report/z na bridge.
   * 
   * UWAGA: Raport Z jest nieodwracalny i wymagany prawem.
   * Powinien być wykonany raz dziennie przed północą.
   */
  async printZReport(request?: FiscalReportRequest): Promise<FiscalReportResult> {
    const { config } = getModelInfo();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), reportTimeoutMs);

    try {
      const res = await fetch(zReportEndpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(apiKey ? { "x-api-key": apiKey } : {}),
        },
        body: JSON.stringify({
          fetchData: request?.fetchData ?? false,
          operatorNote: request?.operatorNote,
          model: config.model,
        }),
        signal: controller.signal,
      });

      const data = (await res.json().catch(() => null)) as unknown;

      if (!res.ok) {
        const errorMessage =
          typeof (data as { error?: unknown } | null)?.error === "string"
            ? (data as { error: string }).error
            : `POSNET bridge HTTP ${res.status}`;
        const errorCode =
          typeof (data as { errorCode?: unknown } | null)?.errorCode === "string"
            ? (data as { errorCode: string }).errorCode
            : undefined;
        return {
          success: false,
          error: `[${config.displayName}] Raport Z: ${errorMessage}`,
          errorCode,
        };
      }

      if (data && typeof (data as { success?: unknown }).success === "boolean") {
        const result = data as FiscalReportResult;
        return result;
      }

      return { success: true };
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.name === "AbortError"
            ? `Timeout raportu Z (${reportTimeoutMs} ms) - model: ${config.displayName}`
            : e.message
          : "Błąd generowania raportu Z";
      return { success: false, error: msg };
    } finally {
      clearTimeout(timeout);
    }
  },

  /**
   * Drukuje raport okresowy/miesięczny – zestawienie raportów Z z wybranego okresu.
   * Wywołuje endpoint /fiscal/report/periodic na bridge.
   */
  async printPeriodicReport(request: PeriodicReportRequest): Promise<PeriodicReportResult> {
    const { config } = getModelInfo();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), reportTimeoutMs);

    try {
      const res = await fetch(periodicReportEndpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(apiKey ? { "x-api-key": apiKey } : {}),
        },
        body: JSON.stringify({
          reportType: request.reportType,
          dateFrom: request.dateFrom.toISOString(),
          dateTo: request.dateTo.toISOString(),
          month: request.month,
          year: request.year,
          fetchData: request.fetchData ?? false,
          operatorNote: request.operatorNote,
          model: config.model,
        }),
        signal: controller.signal,
      });

      const data = (await res.json().catch(() => null)) as unknown;

      if (!res.ok) {
        const errorMessage =
          typeof (data as { error?: unknown } | null)?.error === "string"
            ? (data as { error: string }).error
            : `POSNET bridge HTTP ${res.status}`;
        const errorCode =
          typeof (data as { errorCode?: unknown } | null)?.errorCode === "string"
            ? (data as { errorCode: string }).errorCode
            : undefined;
        return {
          success: false,
          error: `[${config.displayName}] Raport okresowy: ${errorMessage}`,
          errorCode,
        };
      }

      if (data && typeof (data as { success?: unknown }).success === "boolean") {
        const result = data as PeriodicReportResult;
        return result;
      }

      return { success: true };
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.name === "AbortError"
            ? `Timeout raportu okresowego (${reportTimeoutMs} ms) - model: ${config.displayName}`
            : e.message
          : "Błąd generowania raportu okresowego";
      return { success: false, error: msg };
    } finally {
      clearTimeout(timeout);
    }
  },

  /**
   * Wykonuje storno (anulowanie) paragonu fiskalnego.
   * Wywołuje endpoint /fiscal/storno na bridge.
   * 
   * UWAGA: Storno to dokument korygujący, który nie usuwa oryginalnego paragonu
   * z pamięci fiskalnej. Wymaga podania numeru oryginalnego paragonu i powodu.
   * 
   * Przepisy wymagają zachowania dokumentacji storno.
   */
  async printStorno(request: FiscalStornoRequest): Promise<FiscalStornoResult> {
    const { model, config } = getModelInfo();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    // Walidacja wymaganych pól
    if (!request.originalReceiptNumber) {
      return {
        success: false,
        errorCode: "VALIDATION_ERROR",
        errorMessage: "Numer oryginalnego paragonu jest wymagany",
      };
    }

    if (!request.reason) {
      return {
        success: false,
        errorCode: "VALIDATION_ERROR",
        errorMessage: "Powód storna jest wymagany",
      };
    }

    if (request.amount === undefined || request.amount <= 0) {
      return {
        success: false,
        errorCode: "VALIDATION_ERROR",
        errorMessage: "Kwota storna musi być większa od zera",
      };
    }

    try {
      // Przygotuj pozycje z odpowiednimi kodami VAT
      const processedItems = request.items?.map((item) => ({
        ...item,
        name: truncateTextForModel(item.name, model, "itemName"),
        vatLetter: mapVatRate(item.vatRate),
      }));

      const res = await fetch(stornoEndpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(apiKey ? { "x-api-key": apiKey } : {}),
        },
        body: JSON.stringify({
          originalReceiptNumber: request.originalReceiptNumber,
          reason: request.reason,
          amount: request.amount,
          items: processedItems,
          operatorId: request.operatorId,
          operatorNote: request.operatorNote,
          model: model,
          protocolVersion: config.protocolVersion,
        }),
        signal: controller.signal,
      });

      const data = (await res.json().catch(() => null)) as unknown;

      if (!res.ok) {
        const errorMessage =
          typeof (data as { error?: unknown } | null)?.error === "string"
            ? (data as { error: string }).error
            : `POSNET bridge HTTP ${res.status}`;
        const errorCode =
          typeof (data as { errorCode?: unknown } | null)?.errorCode === "string"
            ? (data as { errorCode: string }).errorCode
            : undefined;
        return {
          success: false,
          errorCode,
          errorMessage: `[${config.displayName}] Storno: ${errorMessage}`,
        };
      }

      if (data && typeof (data as { success?: unknown }).success === "boolean") {
        const result = data as FiscalStornoResult;
        return result;
      }

      // Bridge nie zwrócił standardowego formatu – uznajemy sukces z minimalnym wynikiem
      return {
        success: true,
        originalReceiptNumber: request.originalReceiptNumber,
        stornoAmount: request.amount,
        stornoDate: new Date(),
      };
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.name === "AbortError"
            ? `Timeout storna POSNET (${timeoutMs} ms) - model: ${config.displayName}`
            : e.message
          : "Błąd połączenia z POSNET bridge podczas storna";
      return { success: false, errorMessage: msg };
    } finally {
      clearTimeout(timeout);
    }
  },
};

/**
 * Eksportuje informacje o aktualnym modelu POSNET (do diagnostyki).
 */
export function getPosnetDriverInfo() {
  const { model, config } = getModelInfo();
  return {
    model,
    displayName: config.displayName,
    maxLineWidth: config.maxLineWidth,
    supportsInvoice: config.supportsInvoice,
    supportsEReceipt: config.supportsEReceipt,
    protocolVersion: config.protocolVersion,
    endpoint: baseUrl,
  };
}

export default posnetHttpDriver;

