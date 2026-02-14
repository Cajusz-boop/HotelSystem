/**
 * Konfiguracja modeli drukarek fiskalnych POSNET.
 * 
 * Każdy model ma specyficzne parametry:
 * - Szerokość linii (znaki)
 * - Liczba linii nagłówka/stopki
 * - Obsługiwane funkcje (e-paragon, faktury, NIP na paragonie)
 * - Wersja protokołu
 * 
 * Dokumentacja:
 * - POSNET Thermal/Thermal HS: 40 znaków, protokół v1
 * - POSNET Ergo: 48 znaków, protokół v2
 * - POSNET NEO/NEO XL: 57/80 znaków, protokół v2, e-paragon
 * - POSNET Revo: 57 znaków, protokół v2, pełna obsługa KSeF
 */

import type { PosnetModel, PosnetModelConfig, PosnetPaymentCodes, PosnetVatRates } from "./types";

/**
 * Konfiguracje wszystkich obsługiwanych modeli POSNET.
 */
export const POSNET_MODELS: Record<PosnetModel, PosnetModelConfig> = {
  // --- Seria Thermal ---
  thermal: {
    model: "thermal",
    displayName: "POSNET Thermal",
    maxLineWidth: 40,
    maxHeaderLines: 6,
    maxFooterLines: 4,
    maxItemNameLength: 40,
    supportsEReceipt: false,
    supportsInvoice: false,
    supportsNipOnReceipt: true,
    supportsBarcode: false,
    supportsGraphics: false,
    maxItemsPerReceipt: 100,
    protocolVersion: 1,
    defaultBaudRate: 9600,
    manufacturerCode: "TH",
    notes: "Podstawowa drukarka termiczna. Szerokość papieru 57mm.",
  },

  thermal_hs: {
    model: "thermal_hs",
    displayName: "POSNET Thermal HS",
    maxLineWidth: 40,
    maxHeaderLines: 6,
    maxFooterLines: 4,
    maxItemNameLength: 40,
    supportsEReceipt: false,
    supportsInvoice: true,
    supportsNipOnReceipt: true,
    supportsBarcode: true,
    supportsGraphics: true,
    maxItemsPerReceipt: 200,
    protocolVersion: 1,
    defaultBaudRate: 115200,
    manufacturerCode: "THS",
    notes: "Szybsza wersja Thermal. Szerokość papieru 57mm. Obsługa grafik i kodów.",
  },

  // --- Seria Ergo ---
  ergo: {
    model: "ergo",
    displayName: "POSNET Ergo",
    maxLineWidth: 48,
    maxHeaderLines: 8,
    maxFooterLines: 6,
    maxItemNameLength: 48,
    supportsEReceipt: false,
    supportsInvoice: true,
    supportsNipOnReceipt: true,
    supportsBarcode: true,
    supportsGraphics: true,
    maxItemsPerReceipt: 300,
    protocolVersion: 2,
    defaultBaudRate: 115200,
    manufacturerCode: "ERG",
    notes: "Ergonomiczna drukarka. Szerokość papieru 80mm. Duży wyświetlacz.",
  },

  // --- Seria Bingo (przenośne) ---
  bingo: {
    model: "bingo",
    displayName: "POSNET Bingo",
    maxLineWidth: 32,
    maxHeaderLines: 4,
    maxFooterLines: 3,
    maxItemNameLength: 32,
    supportsEReceipt: false,
    supportsInvoice: false,
    supportsNipOnReceipt: true,
    supportsBarcode: false,
    supportsGraphics: false,
    maxItemsPerReceipt: 50,
    protocolVersion: 1,
    defaultBaudRate: 9600,
    manufacturerCode: "BIN",
    notes: "Przenośna drukarka. Szerokość papieru 57mm. Zasilanie bateryjne.",
  },

  bingo_hs: {
    model: "bingo_hs",
    displayName: "POSNET Bingo HS",
    maxLineWidth: 32,
    maxHeaderLines: 4,
    maxFooterLines: 3,
    maxItemNameLength: 32,
    supportsEReceipt: false,
    supportsInvoice: false,
    supportsNipOnReceipt: true,
    supportsBarcode: true,
    supportsGraphics: false,
    maxItemsPerReceipt: 100,
    protocolVersion: 1,
    defaultBaudRate: 115200,
    manufacturerCode: "BINHS",
    notes: "Przenośna drukarka szybka. Szerokość papieru 57mm. Bluetooth.",
  },

  // --- Seria Mobile ---
  mobile_hs: {
    model: "mobile_hs",
    displayName: "POSNET Mobile HS",
    maxLineWidth: 32,
    maxHeaderLines: 4,
    maxFooterLines: 3,
    maxItemNameLength: 32,
    supportsEReceipt: false,
    supportsInvoice: false,
    supportsNipOnReceipt: true,
    supportsBarcode: true,
    supportsGraphics: false,
    maxItemsPerReceipt: 100,
    protocolVersion: 1,
    defaultBaudRate: 115200,
    manufacturerCode: "MOBHS",
    notes: "Mobilna drukarka. Szerokość papieru 57mm. Wi-Fi/Bluetooth.",
  },

  // --- Seria NEO (nowa generacja) ---
  neo: {
    model: "neo",
    displayName: "POSNET NEO",
    maxLineWidth: 57,
    maxHeaderLines: 10,
    maxFooterLines: 8,
    maxItemNameLength: 56,
    supportsEReceipt: true,
    supportsInvoice: true,
    supportsNipOnReceipt: true,
    supportsBarcode: true,
    supportsGraphics: true,
    maxItemsPerReceipt: 500,
    protocolVersion: 2,
    defaultBaudRate: 115200,
    manufacturerCode: "NEO",
    notes: "Drukarka nowej generacji. Szerokość papieru 80mm. Obsługa e-paragonów.",
  },

  neo_xl: {
    model: "neo_xl",
    displayName: "POSNET NEO XL",
    maxLineWidth: 80,
    maxHeaderLines: 12,
    maxFooterLines: 10,
    maxItemNameLength: 80,
    supportsEReceipt: true,
    supportsInvoice: true,
    supportsNipOnReceipt: true,
    supportsBarcode: true,
    supportsGraphics: true,
    maxItemsPerReceipt: 1000,
    protocolVersion: 2,
    defaultBaudRate: 115200,
    manufacturerCode: "NEOXL",
    notes: "Szeroka drukarka NEO. Szerokość papieru 112mm. Dla dużych paragonów.",
  },

  // --- Seria Revo (z obsługą KSeF) ---
  revo: {
    model: "revo",
    displayName: "POSNET Revo",
    maxLineWidth: 57,
    maxHeaderLines: 10,
    maxFooterLines: 8,
    maxItemNameLength: 56,
    supportsEReceipt: true,
    supportsInvoice: true,
    supportsNipOnReceipt: true,
    supportsBarcode: true,
    supportsGraphics: true,
    maxItemsPerReceipt: 500,
    protocolVersion: 2,
    defaultBaudRate: 115200,
    manufacturerCode: "REVO",
    notes: "Drukarka z pełną obsługą e-paragonów i KSeF. Szerokość papieru 80mm.",
  },

  // --- Seria Trio (terminal+drukarka) ---
  trio: {
    model: "trio",
    displayName: "POSNET Trio",
    maxLineWidth: 48,
    maxHeaderLines: 8,
    maxFooterLines: 6,
    maxItemNameLength: 48,
    supportsEReceipt: true,
    supportsInvoice: true,
    supportsNipOnReceipt: true,
    supportsBarcode: true,
    supportsGraphics: true,
    maxItemsPerReceipt: 300,
    protocolVersion: 2,
    defaultBaudRate: 115200,
    manufacturerCode: "TRIO",
    notes: "Zintegrowane urządzenie 3w1. Terminal płatniczy + drukarka + kasa.",
  },

  // --- Seria Temo (ekonomiczna) ---
  temo_hs: {
    model: "temo_hs",
    displayName: "POSNET Temo HS",
    maxLineWidth: 40,
    maxHeaderLines: 6,
    maxFooterLines: 4,
    maxItemNameLength: 40,
    supportsEReceipt: false,
    supportsInvoice: true,
    supportsNipOnReceipt: true,
    supportsBarcode: true,
    supportsGraphics: true,
    maxItemsPerReceipt: 200,
    protocolVersion: 2,
    defaultBaudRate: 115200,
    manufacturerCode: "TEMO",
    notes: "Ekonomiczna drukarka. Szerokość papieru 57mm. Dobry stosunek ceny do jakości.",
  },

  // --- POSNET FV (dedykowana do faktur) ---
  fv: {
    model: "fv",
    displayName: "POSNET FV",
    maxLineWidth: 80,
    maxHeaderLines: 12,
    maxFooterLines: 10,
    maxItemNameLength: 80,
    supportsEReceipt: true,
    supportsInvoice: true,
    supportsNipOnReceipt: true,
    supportsBarcode: true,
    supportsGraphics: true,
    maxItemsPerReceipt: 1000,
    protocolVersion: 2,
    defaultBaudRate: 115200,
    manufacturerCode: "FV",
    notes: "Drukarka dedykowana do faktur. Szerokość papieru 112mm. Format A4.",
  },

  // --- Custom (konfiguracja z env) ---
  custom: {
    model: "custom",
    displayName: "Custom POSNET",
    maxLineWidth: 40,
    maxHeaderLines: 6,
    maxFooterLines: 4,
    maxItemNameLength: 40,
    supportsEReceipt: false,
    supportsInvoice: false,
    supportsNipOnReceipt: true,
    supportsBarcode: false,
    supportsGraphics: false,
    maxItemsPerReceipt: 100,
    protocolVersion: 1,
    defaultBaudRate: 9600,
    notes: "Niestandardowy model. Parametry konfigurowane przez zmienne środowiskowe.",
  },
};

/**
 * Domyślny model POSNET (jeśli nie określono w env).
 */
export const DEFAULT_POSNET_MODEL: PosnetModel = "thermal_hs";

/**
 * Kody płatności per model (starszy protokół v1 vs nowszy v2).
 */
export const POSNET_PAYMENT_CODES_V1: PosnetPaymentCodes = {
  cash: "0",
  card: "1",
  transfer: "2",
  voucher: "3",
  credit: "4",
  check: "5",
  other: "6",
};

export const POSNET_PAYMENT_CODES_V2: PosnetPaymentCodes = {
  cash: "GOTOWKA",
  card: "KARTA",
  transfer: "PRZELEW",
  voucher: "BON",
  credit: "KREDYT",
  check: "CZEK",
  other: "INNE",
};

/**
 * Pobiera kody płatności dla wersji protokołu.
 */
export function getPaymentCodes(protocolVersion: 1 | 2): PosnetPaymentCodes {
  return protocolVersion === 1 ? POSNET_PAYMENT_CODES_V1 : POSNET_PAYMENT_CODES_V2;
}

/**
 * Standardowe mapowanie stawek VAT na litery PTU (Polska).
 * A = 23%, B = 8%, C = 5%, D = 0%, E = zwolniony, F = nie podlega
 */
export const DEFAULT_VAT_RATES: PosnetVatRates = {
  rateToLetter: {
    23: "A",
    8: "B",
    5: "C",
    0: "D",
    // -1 oznacza zwolniony (ZW)
    [-1]: "E",
    // -2 oznacza nie podlega (NP)
    [-2]: "F",
  },
  letterToRate: {
    A: 23,
    B: 8,
    C: 5,
    D: 0,
    E: -1,
    F: -2,
  },
};

/**
 * Pobiera konfigurację dla modelu POSNET.
 * Jeśli model to "custom", nadpisuje domyślne wartości z env.
 */
export function getPosnetModelConfig(model: PosnetModel): PosnetModelConfig {
  const baseConfig = POSNET_MODELS[model] ?? POSNET_MODELS.thermal_hs;

  if (model !== "custom") {
    return baseConfig;
  }

  // Dla custom - nadpisz wartościami z env (jeśli podane)
  return {
    ...baseConfig,
    maxLineWidth: getEnvNumber("FISCAL_POSNET_MAX_LINE_WIDTH", baseConfig.maxLineWidth),
    maxHeaderLines: getEnvNumber("FISCAL_POSNET_MAX_HEADER_LINES", baseConfig.maxHeaderLines),
    maxFooterLines: getEnvNumber("FISCAL_POSNET_MAX_FOOTER_LINES", baseConfig.maxFooterLines),
    maxItemNameLength: getEnvNumber("FISCAL_POSNET_MAX_ITEM_NAME_LENGTH", baseConfig.maxItemNameLength),
    supportsEReceipt: process.env.FISCAL_POSNET_SUPPORTS_E_RECEIPT === "true",
    supportsInvoice: process.env.FISCAL_POSNET_SUPPORTS_INVOICE === "true",
    supportsNipOnReceipt: process.env.FISCAL_POSNET_SUPPORTS_NIP !== "false", // domyślnie true
    supportsBarcode: process.env.FISCAL_POSNET_SUPPORTS_BARCODE === "true",
    supportsGraphics: process.env.FISCAL_POSNET_SUPPORTS_GRAPHICS === "true",
    maxItemsPerReceipt: getEnvNumber("FISCAL_POSNET_MAX_ITEMS", baseConfig.maxItemsPerReceipt),
    protocolVersion: (getEnvNumber("FISCAL_POSNET_PROTOCOL_VERSION", 1) as 1 | 2),
    defaultBaudRate: getEnvNumber("FISCAL_POSNET_BAUD_RATE", baseConfig.defaultBaudRate),
  };
}

/**
 * Pobiera model POSNET z env lub zwraca domyślny.
 */
export function getCurrentPosnetModel(): PosnetModel {
  const envModel = process.env.FISCAL_POSNET_MODEL?.toLowerCase() as PosnetModel | undefined;
  if (envModel && envModel in POSNET_MODELS) {
    return envModel;
  }
  return DEFAULT_POSNET_MODEL;
}

/**
 * Sprawdza, czy model obsługuje daną funkcję.
 */
export function modelSupportsFeature(
  model: PosnetModel,
  feature: "eReceipt" | "invoice" | "nipOnReceipt" | "barcode" | "graphics"
): boolean {
  const config = getPosnetModelConfig(model);
  switch (feature) {
    case "eReceipt":
      return config.supportsEReceipt;
    case "invoice":
      return config.supportsInvoice;
    case "nipOnReceipt":
      return config.supportsNipOnReceipt;
    case "barcode":
      return config.supportsBarcode;
    case "graphics":
      return config.supportsGraphics;
    default:
      return false;
  }
}

/**
 * Skraca tekst do maksymalnej długości zgodnej z modelem.
 * Używa inteligentnego skracania (nie ucina w środku słowa).
 */
export function truncateTextForModel(text: string, model: PosnetModel, type: "line" | "itemName" = "line"): string {
  const config = getPosnetModelConfig(model);
  const maxLength = type === "itemName" ? config.maxItemNameLength : config.maxLineWidth;

  if (text.length <= maxLength) {
    return text;
  }

  // Skróć do maxLength-3 i dodaj "..."
  const truncated = text.slice(0, maxLength - 3);
  
  // Znajdź ostatnią spację, żeby nie ucinać w środku słowa
  const lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace > maxLength * 0.6) {
    return truncated.slice(0, lastSpace) + "...";
  }

  return truncated + "...";
}

/**
 * Formatuje nagłówek/stopkę zgodnie z ograniczeniami modelu.
 * Zwraca tablicę linii przygotowaną do wysłania.
 */
export function formatLinesForModel(
  lines: string[],
  model: PosnetModel,
  type: "header" | "footer"
): string[] {
  const config = getPosnetModelConfig(model);
  const maxLines = type === "header" ? config.maxHeaderLines : config.maxFooterLines;

  // Skróć każdą linię do max szerokości
  const formattedLines = lines.map((line) => truncateTextForModel(line, model, "line"));

  // Ogranicz liczbę linii
  if (formattedLines.length > maxLines) {
    return formattedLines.slice(0, maxLines);
  }

  return formattedLines;
}

/**
 * Waliduje żądanie paragonu pod kątem ograniczeń modelu.
 * Zwraca listę ostrzeżeń (puste = OK).
 */
export function validateReceiptForModel(
  items: { name: string; quantity: number; unitPrice: number }[],
  headerLines: string[] | undefined,
  footerLines: string[] | undefined,
  model: PosnetModel
): string[] {
  const config = getPosnetModelConfig(model);
  const warnings: string[] = [];

  // Sprawdź liczbę pozycji
  if (config.maxItemsPerReceipt > 0 && items.length > config.maxItemsPerReceipt) {
    warnings.push(
      `Model ${config.displayName} obsługuje max ${config.maxItemsPerReceipt} pozycji. ` +
      `Paragon zawiera ${items.length} pozycji.`
    );
  }

  // Sprawdź długość nazw pozycji
  for (const item of items) {
    if (item.name.length > config.maxItemNameLength) {
      warnings.push(
        `Nazwa pozycji "${item.name.slice(0, 20)}..." przekracza limit ${config.maxItemNameLength} znaków ` +
        `dla modelu ${config.displayName}. Zostanie skrócona.`
      );
    }
  }

  // Sprawdź nagłówek
  if (headerLines && headerLines.length > config.maxHeaderLines) {
    warnings.push(
      `Nagłówek zawiera ${headerLines.length} linii, ale model ${config.displayName} ` +
      `obsługuje max ${config.maxHeaderLines}. Nadmiarowe linie zostaną pominięte.`
    );
  }

  // Sprawdź stopkę
  if (footerLines && footerLines.length > config.maxFooterLines) {
    warnings.push(
      `Stopka zawiera ${footerLines.length} linii, ale model ${config.displayName} ` +
      `obsługuje max ${config.maxFooterLines}. Nadmiarowe linie zostaną pominięte.`
    );
  }

  return warnings;
}

/**
 * Pobiera listę wszystkich obsługiwanych modeli (do wyświetlenia w UI).
 */
export function getAllPosnetModels(): PosnetModelConfig[] {
  return Object.values(POSNET_MODELS);
}

/**
 * Pobiera listę modeli obsługujących e-paragony.
 */
export function getEReceiptCapableModels(): PosnetModelConfig[] {
  return Object.values(POSNET_MODELS).filter((m) => m.supportsEReceipt);
}

/**
 * Pobiera listę modeli obsługujących faktury.
 */
export function getInvoiceCapableModels(): PosnetModelConfig[] {
  return Object.values(POSNET_MODELS).filter((m) => m.supportsInvoice);
}

// --- Helpers ---

function getEnvNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}
