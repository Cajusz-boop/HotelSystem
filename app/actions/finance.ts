"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { createAuditLog, getClientIp } from "@/lib/audit";
import { autoExportConfigSnapshot } from "@/lib/config-snapshot";
import { blindDropSchema } from "@/lib/validations/schemas";
import {
  isFiscalEnabled,
  getFiscalConfig,
  printFiscalReceipt,
  buildReceiptRequest,
  printFiscalInvoice,
  printFiscalXReport,
  printFiscalZReport,
  printFiscalPeriodicReport,
  printFiscalStorno,
  supportsFiscalReports,
} from "@/lib/fiscal";
import type { 
  FiscalConfig,
  FiscalReportRequest, 
  FiscalReportResult,
  PeriodicReportRequest,
  PeriodicReportResult,
  FiscalStornoRequest,
  FiscalStornoResult,
  StornoReason,
} from "@/lib/fiscal/types";
import { getCennikConfig } from "@/app/actions/cennik-config";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getEffectivePricesBatch } from "@/app/actions/rooms";
import {
  VALID_PAYMENT_METHODS,
  type PaymentMethod,
  VALID_SETTLEMENT_STATUSES,
  type SettlementStatus,
  SUPPORTED_CURRENCIES,
  type SupportedCurrency,
  type ExchangeRateSource,
  VOUCHER_TYPES,
  type VoucherType,
  type VoucherStatus,
  type FolioCategory,
  type FolioItemStatus,
  FOLIO_BILL_TO,
  type FolioBillTo,
} from "@/lib/finance-constants";

const MANAGER_PIN = process.env.MANAGER_PIN ?? "1234";
/** Domyślne limity rabatowe (gdy użytkownik nie ma ustawionych): max % i max kwota PLN */
const DEFAULT_MAX_DISCOUNT_PERCENT = Number(process.env.DEFAULT_MAX_DISCOUNT_PERCENT) || 20;
const DEFAULT_MAX_DISCOUNT_AMOUNT = Number(process.env.DEFAULT_MAX_DISCOUNT_AMOUNT) || 500;
/** Domyślny limit void bez PIN (kwota w PLN); powyżej wymagany PIN managera */
const DEFAULT_MAX_VOID_AMOUNT = Number(process.env.DEFAULT_MAX_VOID_AMOUNT) || 500;

/** Limit prób PIN przy Void: po 3 błędnych blokada na 15 minut (per IP). */
const VOID_PIN_MAX_ATTEMPTS = 3;
const VOID_PIN_LOCKOUT_MS = 15 * 60 * 1000;
const voidPinAttempts = new Map<string, { count: number; firstFailedAt: number }>();

function isVoidPinLocked(ip: string): { locked: boolean; remainingMs?: number } {
  const entry = voidPinAttempts.get(ip);
  if (!entry || entry.count < VOID_PIN_MAX_ATTEMPTS) return { locked: false };
  const elapsed = Date.now() - entry.firstFailedAt;
  if (elapsed >= VOID_PIN_LOCKOUT_MS) {
    voidPinAttempts.delete(ip);
    return { locked: false };
  }
  return { locked: true, remainingMs: VOID_PIN_LOCKOUT_MS - elapsed };
}

function recordFailedVoidPinAttempt(ip: string): void {
  const entry = voidPinAttempts.get(ip);
  if (!entry) {
    voidPinAttempts.set(ip, { count: 1, firstFailedAt: Date.now() });
    return;
  }
  entry.count++;
  if (entry.count === 1) entry.firstFailedAt = Date.now();
}

function clearVoidPinAttempts(ip: string): void {
  voidPinAttempts.delete(ip);
}

// ============================================================
// DOCUMENT NUMBERING CONFIGURATION
// ============================================================

export type DocumentType = 
  | "INVOICE"           // FV - Faktura VAT
  | "CORRECTION"        // KOR - Korekta faktury
  | "CONSOLIDATED_INVOICE"  // FVZ - Faktura zbiorcza
  | "RECEIPT"           // R - Rachunek (nie-VAT)
  | "ACCOUNTING_NOTE"   // NK - Nota księgowa
  | "PROFORMA";         // PRO - Proforma

// Domyślne konfiguracje dla każdego typu dokumentu
const DEFAULT_NUMBERING_CONFIGS: Record<DocumentType, { prefix: string; description: string }> = {
  INVOICE: { prefix: "FV", description: "Faktura VAT" },
  CORRECTION: { prefix: "KOR", description: "Korekta faktury" },
  CONSOLIDATED_INVOICE: { prefix: "FVZ", description: "Faktura zbiorcza" },
  RECEIPT: { prefix: "R", description: "Rachunek (nie-VAT)" },
  ACCOUNTING_NOTE: { prefix: "NK", description: "Nota księgowa" },
  PROFORMA: { prefix: "PRO", description: "Proforma" },
};

export interface DocumentNumberingConfigData {
  id: string;
  documentType: string;
  prefix: string;
  separator: string;
  yearFormat: string;
  sequencePadding: number;
  resetYearly: boolean;
  description: string | null;
  exampleNumber: string | null;
}

/** Lista dozwolonych typów dokumentów do walidacji wejścia. */
const VALID_DOCUMENT_TYPES: DocumentType[] = [
  "INVOICE", "CORRECTION", "CONSOLIDATED_INVOICE", "RECEIPT", "ACCOUNTING_NOTE", "PROFORMA",
];

/**
 * Pobiera konfigurację numeracji dla danego typu dokumentu.
 * Jeśli nie istnieje, tworzy domyślną konfigurację.
 * @param documentType - typ dokumentu (INVOICE, RECEIPT, itd.)
 * @returns ActionResult z danymi konfiguracji lub komunikatem błędu
 */
export async function getDocumentNumberingConfig(
  documentType: DocumentType
): Promise<ActionResult<DocumentNumberingConfigData>> {
  try {
    if (!documentType || !VALID_DOCUMENT_TYPES.includes(documentType)) {
      return { success: false, error: "Nieprawidłowy typ dokumentu" };
    }
    let config = await prisma.documentNumberingConfig.findUnique({
      where: { documentType },
    });

    // Jeśli brak konfiguracji, utwórz domyślną
    if (!config) {
      const defaultConfig = DEFAULT_NUMBERING_CONFIGS[documentType];
      const year = new Date().getFullYear();
      const exampleNumber = `${defaultConfig.prefix}/${year}/0001`;

      config = await prisma.documentNumberingConfig.create({
        data: {
          documentType,
          prefix: defaultConfig.prefix,
          separator: "/",
          yearFormat: "YYYY",
          sequencePadding: 4,
          resetYearly: true,
          description: defaultConfig.description,
          exampleNumber,
        },
      });
    }

    return {
      success: true,
      data: {
        id: config.id,
        documentType: config.documentType,
        prefix: config.prefix,
        separator: config.separator,
        yearFormat: config.yearFormat,
        sequencePadding: config.sequencePadding,
        resetYearly: config.resetYearly,
        description: config.description,
        exampleNumber: config.exampleNumber,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu konfiguracji numeracji",
    };
  }
}

/**
 * Pobiera wszystkie konfiguracje numeracji (dla wszystkich typów dokumentów).
 * Tworzy brakujące konfiguracje z wartościami domyślnymi.
 * @returns ActionResult z tablicą konfiguracji lub komunikatem błędu
 */
export async function getAllDocumentNumberingConfigs(): Promise<ActionResult<DocumentNumberingConfigData[]>> {
  try {
    // Upewnij się, że wszystkie domyślne konfiguracje istnieją
    for (const [docType, defaultConfig] of Object.entries(DEFAULT_NUMBERING_CONFIGS)) {
      const existing = await prisma.documentNumberingConfig.findUnique({
        where: { documentType: docType },
      });
      if (!existing) {
        const year = new Date().getFullYear();
        const exampleNumber = `${defaultConfig.prefix}/${year}/0001`;
        await prisma.documentNumberingConfig.create({
          data: {
            documentType: docType,
            prefix: defaultConfig.prefix,
            separator: "/",
            yearFormat: "YYYY",
            sequencePadding: 4,
            resetYearly: true,
            description: defaultConfig.description,
            exampleNumber,
          },
        });
      }
    }

    const configs = await prisma.documentNumberingConfig.findMany({
      orderBy: { documentType: "asc" },
    });

    return {
      success: true,
      data: configs.map((c) => ({
        id: c.id,
        documentType: c.documentType,
        prefix: c.prefix,
        separator: c.separator,
        yearFormat: c.yearFormat,
        sequencePadding: c.sequencePadding,
        resetYearly: c.resetYearly,
        description: c.description,
        exampleNumber: c.exampleNumber,
      })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu konfiguracji numeracji",
    };
  }
}

/**
 * Aktualizuje konfigurację numeracji dla danego typu dokumentu.
 * @param documentType - typ dokumentu do aktualizacji
 * @param data - pola do aktualizacji (prefix, separator, yearFormat, sequencePadding, resetYearly)
 * @returns ActionResult z zaktualizowaną konfiguracją lub komunikatem błędu
 */
export async function updateDocumentNumberingConfig(
  documentType: DocumentType,
  data: {
    prefix?: string;
    separator?: string;
    yearFormat?: "YYYY" | "YY";
    sequencePadding?: number;
    resetYearly?: boolean;
  }
): Promise<ActionResult<DocumentNumberingConfigData>> {
  try {
    if (!documentType || !VALID_DOCUMENT_TYPES.includes(documentType)) {
      return { success: false, error: "Nieprawidłowy typ dokumentu" };
    }
    // Walidacja
    if (data.prefix !== undefined && data.prefix.trim().length === 0) {
      return { success: false, error: "Prefix nie może być pusty" };
    }
    if (data.sequencePadding !== undefined && (data.sequencePadding < 1 || data.sequencePadding > 10)) {
      return { success: false, error: "Długość sekwencji musi być między 1 a 10" };
    }

    // Upewnij się, że konfiguracja istnieje
    let config = await prisma.documentNumberingConfig.findUnique({
      where: { documentType },
    });

    if (!config) {
      const defaultConfig = DEFAULT_NUMBERING_CONFIGS[documentType];
      config = await prisma.documentNumberingConfig.create({
        data: {
          documentType,
          prefix: defaultConfig.prefix,
          separator: "/",
          yearFormat: "YYYY",
          sequencePadding: 4,
          resetYearly: true,
          description: defaultConfig.description,
        },
      });
    }

    // Przygotuj dane do aktualizacji
    const updateData: Record<string, unknown> = {};
    if (data.prefix !== undefined) updateData.prefix = data.prefix.trim().toUpperCase();
    if (data.separator !== undefined) updateData.separator = data.separator;
    if (data.yearFormat !== undefined) updateData.yearFormat = data.yearFormat;
    if (data.sequencePadding !== undefined) updateData.sequencePadding = data.sequencePadding;
    if (data.resetYearly !== undefined) updateData.resetYearly = data.resetYearly;

    // Wygeneruj przykładowy numer
    const prefix = (updateData.prefix as string) ?? config.prefix;
    const separator = (updateData.separator as string) ?? config.separator;
    const yearFormat = (updateData.yearFormat as string) ?? config.yearFormat;
    const padding = (updateData.sequencePadding as number) ?? config.sequencePadding;

    const year = new Date().getFullYear();
    const yearStr = yearFormat === "YY" ? String(year).slice(-2) : String(year);
    const exampleSeq = "1".padStart(padding, "0");
    updateData.exampleNumber = `${prefix}${separator}${yearStr}${separator}${exampleSeq}`;

    const updated = await prisma.documentNumberingConfig.update({
      where: { id: config.id },
      data: updateData,
    });

    revalidatePath("/finance");
    revalidatePath("/ustawienia");
    autoExportConfigSnapshot();

    return {
      success: true,
      data: {
        id: updated.id,
        documentType: updated.documentType,
        prefix: updated.prefix,
        separator: updated.separator,
        yearFormat: updated.yearFormat,
        sequencePadding: updated.sequencePadding,
        resetYearly: updated.resetYearly,
        description: updated.description,
        exampleNumber: updated.exampleNumber,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd aktualizacji konfiguracji numeracji",
    };
  }
}

/**
 * Generuje następny numer dokumentu dla danego typu.
 * Atomowa operacja - używa transakcji do uniknięcia duplikatów.
 * @param documentType - typ dokumentu (INVOICE, RECEIPT, PROFORMA, itd.)
 * @returns ActionResult z wygenerowanym numerem lub komunikatem błędu
 */
export async function generateNextDocumentNumber(documentType: DocumentType): Promise<ActionResult<string>> {
  try {
    if (!documentType || !VALID_DOCUMENT_TYPES.includes(documentType)) {
      return { success: false, error: "Nieprawidłowy typ dokumentu" };
    }
    const year = new Date().getFullYear();

    // Pobierz konfigurację (lub utwórz domyślną)
    const configResult = await getDocumentNumberingConfig(documentType);
    if (!configResult.success || !configResult.data) {
      // Fallback do starego formatu
      const defaultConfig = DEFAULT_NUMBERING_CONFIGS[documentType];
      return { success: true, data: `${defaultConfig.prefix}/${year}/0001` };
    }

    const config = configResult.data;

    // Atomowa operacja na liczniku
    const counter = await prisma.$transaction(async (tx) => {
    // Znajdź lub utwórz licznik dla tego typu i roku
    let counter = await tx.documentNumberCounter.findUnique({
      where: { documentType_year: { documentType, year } },
    });

    if (!counter) {
      // Sprawdź istniejące dokumenty, żeby nie zaczynać od 0 jeśli są stare dokumenty
      let existingMax = 0;

      // Zbuduj prefix do wyszukiwania
      const yearStr = config.yearFormat === "YY" ? String(year).slice(-2) : String(year);
      const searchPrefix = `${config.prefix}${config.separator}${yearStr}${config.separator}`;

      // Wyszukaj maksymalną sekwencję dla różnych typów dokumentów
      if (documentType === "INVOICE") {
        const existing = await tx.invoice.findMany({
          where: { number: { startsWith: searchPrefix } },
          orderBy: { number: "desc" },
          take: 1,
        });
        if (existing.length > 0) {
          const parts = existing[0].number.split(config.separator);
          const lastSeq = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(lastSeq)) existingMax = lastSeq;
        }
      } else if (documentType === "CORRECTION") {
        const existing = await tx.invoiceCorrection.findMany({
          where: { number: { startsWith: searchPrefix } },
          orderBy: { number: "desc" },
          take: 1,
        });
        if (existing.length > 0) {
          const parts = existing[0].number.split(config.separator);
          const lastSeq = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(lastSeq)) existingMax = lastSeq;
        }
      } else if (documentType === "CONSOLIDATED_INVOICE") {
        const existing = await tx.consolidatedInvoice.findMany({
          where: { number: { startsWith: searchPrefix } },
          orderBy: { number: "desc" },
          take: 1,
        });
        if (existing.length > 0) {
          const parts = existing[0].number.split(config.separator);
          const lastSeq = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(lastSeq)) existingMax = lastSeq;
        }
      } else if (documentType === "RECEIPT") {
        const existing = await tx.receipt.findMany({
          where: { number: { startsWith: searchPrefix } },
          orderBy: { number: "desc" },
          take: 1,
        });
        if (existing.length > 0) {
          const parts = existing[0].number.split(config.separator);
          const lastSeq = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(lastSeq)) existingMax = lastSeq;
        }
      } else if (documentType === "ACCOUNTING_NOTE") {
        const existing = await tx.accountingNote.findMany({
          where: { number: { startsWith: searchPrefix } },
          orderBy: { number: "desc" },
          take: 1,
        });
        if (existing.length > 0) {
          const parts = existing[0].number.split(config.separator);
          const lastSeq = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(lastSeq)) existingMax = lastSeq;
        }
      } else if (documentType === "PROFORMA") {
        const existing = await tx.proforma.findMany({
          where: { number: { startsWith: searchPrefix } },
          orderBy: { number: "desc" },
          take: 1,
        });
        if (existing.length > 0) {
          const parts = existing[0].number.split(config.separator);
          const lastSeq = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(lastSeq)) existingMax = lastSeq;
        }
      }

      // Utwórz nowy licznik
      counter = await tx.documentNumberCounter.create({
        data: {
          documentType,
          year,
          lastSequence: existingMax,
        },
      });
    }

    // Inkrementuj i zapisz
    const nextSeq = counter.lastSequence + 1;
    await tx.documentNumberCounter.update({
      where: { id: counter.id },
      data: { lastSequence: nextSeq },
    });

    return { ...counter, lastSequence: nextSeq };
  });

  // Zbuduj numer dokumentu
  const yearStr = config.yearFormat === "YY" ? String(year).slice(-2) : String(year);
  const seqStr = String(counter.lastSequence).padStart(config.sequencePadding, "0");

  return { success: true, data: `${config.prefix}${config.separator}${yearStr}${config.separator}${seqStr}` };
  } catch (e) {
    console.error("[generateNextDocumentNumber]", e);
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd generowania numeru dokumentu",
    };
  }
}

/**
 * Pobiera aktualny stan liczników numeracji dla wszystkich typów dokumentów i lat.
 * @returns ActionResult z tablicą { documentType, year, lastSequence } lub komunikatem błędu
 */
export async function getDocumentNumberCounters(): Promise<
  ActionResult<Array<{ documentType: string; year: number; lastSequence: number }>>
> {
  try {
    const counters = await prisma.documentNumberCounter.findMany({
      orderBy: [{ documentType: "asc" }, { year: "desc" }],
    });

    return {
      success: true,
      data: counters.map((c) => ({
        documentType: c.documentType,
        year: c.year,
        lastSequence: c.lastSequence,
      })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu liczników",
    };
  }
}

// ============================================================
// END DOCUMENT NUMBERING CONFIGURATION
// ============================================================

/**
 * Pobiera konfigurację kasy fiskalnej (server-only – unika bundlowania modułu „net” w kliencie).
 * @returns Promise z obiektem FiscalConfig (enabled, driver, taxId, pointName, posnetModel, itd.)
 */
export async function getFiscalConfigAction(): Promise<FiscalConfig> {
  return getFiscalConfig();
}

/**
 * Testuje połączenie z bridge'em POSNET (lub innym endpointem kasy fiskalnej).
 * Wywołuje GET /health na skonfigurowanym endpoincie.
 * @returns Obiekt z wynikiem testu: ok, czas odpowiedzi, szczegóły bridge'a
 */
export async function testFiscalConnectionAction(): Promise<{
  success: boolean;
  responseTimeMs?: number;
  bridgeInfo?: Record<string, unknown>;
  error?: string;
}> {
  const config = await getFiscalConfig();
  if (!config.enabled) {
    return { success: false, error: "Kasa fiskalna jest wyłączona (FISCAL_ENABLED=false). Ustaw FISCAL_ENABLED=true w pliku .env i zrestartuj serwer." };
  }

  if (config.driver === "mock") {
    return { success: true, responseTimeMs: 0, bridgeInfo: { mode: "mock", note: "Sterownik mock – symulacja bez fizycznej kasy. Paragony logowane w konsoli." } };
  }

  const endpoint = process.env.FISCAL_POSNET_ENDPOINT ?? "http://127.0.0.1:9977/fiscal/print";
  const baseUrl = endpoint.replace(/\/fiscal\/print\/?$/i, "") || "http://127.0.0.1:9977";
  const healthUrl = `${baseUrl}/health`;

  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(healthUrl, { signal: controller.signal });
    clearTimeout(timeout);
    const elapsed = Date.now() - start;

    if (!res.ok) {
      return { success: false, responseTimeMs: elapsed, error: `Bridge odpowiedział HTTP ${res.status}. Sprawdź czy bridge działa (npm run posnet:bridge).` };
    }

    const data = await res.json().catch(() => null);
    return {
      success: true,
      responseTimeMs: elapsed,
      bridgeInfo: data && typeof data === "object" ? data : undefined,
    };
  } catch (e) {
    const elapsed = Date.now() - start;
    const msg = e instanceof Error
      ? e.name === "AbortError"
        ? `Timeout (5s) – bridge nie odpowiada na ${healthUrl}`
        : e.message
      : "Błąd połączenia";
    return { success: false, responseTimeMs: elapsed, error: `${msg}. Uruchom bridge: npm run posnet:bridge` };
  }
}

/**
 * Sprawdza, czy sterownik obsługuje raporty fiskalne X, Z, okresowe i storno.
 * @returns Obiekt z flagami supportsXReport, supportsZReport, supportsPeriodicReport, supportsStorno
 */
export async function supportsFiscalReportsAction(): Promise<{
  supportsXReport: boolean;
  supportsZReport: boolean;
  supportsPeriodicReport: boolean;
  supportsStorno: boolean;
}> {
  return supportsFiscalReports();
}

/**
 * Drukuje raport X (niefiskalny) na kasie fiskalnej.
 * Raport X pokazuje aktualny stan kasy od ostatniego raportu Z (suma sprzedaży per VAT, płatności, liczba paragonów).
 * Można drukować wielokrotnie w ciągu dnia.
 * @param options - opcjonalnie fetchData (pobierz dane z kasy), operatorNote (notatka operatora)
 * @returns ActionResult z FiscalReportResult (reportNumber, reportData, success, error)
 */
export async function printFiscalXReportAction(
  options?: { fetchData?: boolean; operatorNote?: string }
): Promise<ActionResult<FiscalReportResult>> {
  const headersList = await headers();
  const ip = getClientIp(headersList);

  try {
    const request: FiscalReportRequest = {
      reportType: "X",
      fetchData: options?.fetchData ?? false,
      operatorNote: options?.operatorNote,
    };

    const result = await printFiscalXReport(request);

    // Loguj operację
    await createAuditLog({
      actionType: "CREATE",
      entityType: "FISCAL",
      entityId: result.reportNumber ?? "X_REPORT",
      newValue: {
        fiscalAction: "X_REPORT",
        success: result.success,
        reportNumber: result.reportNumber,
        error: result.error,
        warning: result.warning,
      },
      ipAddress: ip,
    });

    if (!result.success) {
      return { success: false, error: result.error || "Błąd druku raportu X" };
    }

    return { success: true, data: result };
  } catch (e) {
    console.error("[printFiscalXReportAction]", e);
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd druku raportu X",
    };
  }
}

/**
 * Drukuje raport Z (fiskalny) na kasie fiskalnej.
 * UWAGA: Raport Z jest nieodwracalny; musi być wykonany raz dziennie (przed północą), zeruje liczniki.
 * Raport Z powinien być drukowany w ramach procedury Night Audit.
 * @param options - opcjonalnie fetchData, operatorNote
 * @returns ActionResult z FiscalReportResult
 */
export async function printFiscalZReportAction(
  options?: { fetchData?: boolean; operatorNote?: string }
): Promise<ActionResult<FiscalReportResult>> {
  const headersList = await headers();
  const ip = getClientIp(headersList);

  try {
    const request: FiscalReportRequest = {
      reportType: "Z",
      fetchData: options?.fetchData ?? false,
      operatorNote: options?.operatorNote,
    };

    const result = await printFiscalZReport(request);

    // Loguj operację (raport Z jest szczególnie ważny)
    await createAuditLog({
      actionType: "CREATE",
      entityType: "FISCAL",
      entityId: result.reportNumber ?? "Z_REPORT",
      newValue: {
        fiscalAction: "Z_REPORT",
        success: result.success,
        reportNumber: result.reportNumber,
        error: result.error,
        warning: result.warning,
        ...(result.reportData && {
          totalGross: result.reportData.totalGross,
          totalVat: result.reportData.totalVat,
          receiptCount: result.reportData.receiptCount,
        }),
      },
      ipAddress: ip,
    });

    if (!result.success) {
      return { success: false, error: result.error || "Błąd druku raportu Z" };
    }

    return { success: true, data: result };
  } catch (e) {
    console.error("[printFiscalZReportAction]", e);
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd druku raportu Z",
    };
  }
}

/**
 * Drukuje raport okresowy/miesięczny na kasie fiskalnej.
 * Raport okresowy to zestawienie raportów Z z wybranego okresu; wymagany do rozliczenia miesięcznego.
 * @param options - reportType (PERIODIC|MONTHLY), dateFrom/dateTo lub month/year, fetchData, operatorNote
 * @returns ActionResult z PeriodicReportResult (reportNumber, reportData, success, error)
 */
export async function printFiscalPeriodicReportAction(
  options: {
    reportType?: "PERIODIC" | "MONTHLY";
    dateFrom?: Date | string;
    dateTo?: Date | string;
    month?: number;
    year?: number;
    fetchData?: boolean;
    operatorNote?: string;
  }
): Promise<ActionResult<PeriodicReportResult>> {
  const headersList = await headers();
  const ip = getClientIp(headersList);

  try {
    // Walidacja parametrów
    const reportType = options.reportType ?? "PERIODIC";
    
    let dateFrom: Date;
    let dateTo: Date;

    if (reportType === "MONTHLY") {
      const month = options.month ?? new Date().getMonth() + 1;
      const year = options.year ?? new Date().getFullYear();
      
      if (month < 1 || month > 12) {
        return { success: false, error: "Nieprawidłowy miesiąc (1-12)" };
      }
      if (year < 2000 || year > 2100) {
        return { success: false, error: "Nieprawidłowy rok" };
      }
      
      dateFrom = new Date(year, month - 1, 1);
      dateTo = new Date(year, month, 0); // Ostatni dzień miesiąca
    } else {
      if (!options.dateFrom || !options.dateTo) {
        return { success: false, error: "Wymagane daty: dateFrom i dateTo" };
      }
      
      dateFrom = options.dateFrom instanceof Date 
        ? options.dateFrom 
        : new Date(options.dateFrom);
      dateTo = options.dateTo instanceof Date 
        ? options.dateTo 
        : new Date(options.dateTo);
      
      if (isNaN(dateFrom.getTime()) || isNaN(dateTo.getTime())) {
        return { success: false, error: "Nieprawidłowy format daty" };
      }
      
      if (dateFrom > dateTo) {
        return { success: false, error: "Data początkowa musi być wcześniejsza niż końcowa" };
      }
      
      // Maksymalny zakres: 1 rok
      const maxRange = 365 * 24 * 60 * 60 * 1000;
      if (dateTo.getTime() - dateFrom.getTime() > maxRange) {
        return { success: false, error: "Maksymalny zakres raportu to 1 rok" };
      }
    }

    const request: PeriodicReportRequest = {
      reportType,
      dateFrom,
      dateTo,
      month: reportType === "MONTHLY" ? (options.month ?? new Date().getMonth() + 1) : undefined,
      year: reportType === "MONTHLY" ? (options.year ?? new Date().getFullYear()) : undefined,
      fetchData: options.fetchData ?? false,
      operatorNote: options.operatorNote,
    };

    const result = await printFiscalPeriodicReport(request);

    // Loguj operację
    const periodDesc = reportType === "MONTHLY"
      ? `${request.month}/${request.year}`
      : `${dateFrom.toLocaleDateString("pl-PL")} - ${dateTo.toLocaleDateString("pl-PL")}`;

    await createAuditLog({
      actionType: "CREATE",
      entityType: "FISCAL",
      entityId: result.reportNumber ?? "PERIODIC_REPORT",
      newValue: {
        fiscalAction: "PERIODIC_REPORT",
        success: result.success,
        reportNumber: result.reportNumber,
        reportType,
        period: periodDesc,
        error: result.error,
        warning: result.warning,
        ...(result.reportData && {
          zReportCount: result.reportData.zReportCount,
          totalGross: result.reportData.totalGross,
          totalVat: result.reportData.totalVat,
          totalReceiptCount: result.reportData.totalReceiptCount,
        }),
      },
      ipAddress: ip,
    });

    if (!result.success) {
      return { success: false, error: result.error || "Błąd druku raportu okresowego" };
    }

    return { success: true, data: result };
  } catch (e) {
    console.error("[printFiscalPeriodicReportAction]", e);
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd druku raportu okresowego",
    };
  }
}

/**
 * Wykonuje storno (anulowanie) paragonu fiskalnego. Storno tworzy zapis korekty z odwołaniem do oryginału; wymagane przy zwrotach.
 * @param options - originalReceiptNumber (wymagany), reason (StornoReason), amount (brutto), items (opcjonalne), operatorNote
 * @returns ActionResult z FiscalStornoResult (stornoNumber, success, error)
 */
export async function printFiscalStornoAction(
  options: {
    originalReceiptNumber: string;
    reason: StornoReason;
    amount: number;
    items?: Array<{
      name: string;
      quantity: number;
      unitPrice: number;
      vatRate?: number;
    }>;
    operatorId?: string;
    operatorNote?: string;
  }
): Promise<ActionResult<FiscalStornoResult>> {
  const headersList = await headers();
  const ip = getClientIp(headersList);

  try {
    // Walidacja wymaganych pól
    if (!options.originalReceiptNumber?.trim()) {
      return { success: false, error: "Numer oryginalnego paragonu jest wymagany" };
    }

    if (!options.reason) {
      return { success: false, error: "Powód storna jest wymagany" };
    }

    // Walidacja powodu storna (zgodne z lib/fiscal/types StornoReason)
    const validReasons: StornoReason[] = [
      "CUSTOMER_RETURN",
      "CUSTOMER_CANCEL",
      "OPERATOR_ERROR",
      "PRICE_ERROR",
      "QUANTITY_ERROR",
      "WRONG_ITEM",
      "DOUBLE_SCAN",
      "TECHNICAL_ERROR",
      "OTHER",
    ];
    if (!validReasons.includes(options.reason)) {
      return { 
        success: false, 
        error: `Nieprawidłowy powód storna. Dozwolone: ${validReasons.join(", ")}` 
      };
    }

    // Walidacja kwoty
    if (options.amount === undefined || options.amount === null) {
      return { success: false, error: "Kwota storna jest wymagana" };
    }
    if (typeof options.amount !== "number" || isNaN(options.amount)) {
      return { success: false, error: "Kwota storna musi być liczbą" };
    }
    if (options.amount <= 0) {
      return { success: false, error: "Kwota storna musi być większa od zera" };
    }

    // Walidacja pozycji (jeśli podano)
    if (options.items && options.items.length > 0) {
      for (const item of options.items) {
        if (!item.name?.trim()) {
          return { success: false, error: "Nazwa pozycji storna jest wymagana" };
        }
        if (typeof item.quantity !== "number" || item.quantity <= 0) {
          return { success: false, error: `Nieprawidłowa ilość dla pozycji: ${item.name}` };
        }
        if (typeof item.unitPrice !== "number" || item.unitPrice < 0) {
          return { success: false, error: `Nieprawidłowa cena dla pozycji: ${item.name}` };
        }
      }

      // Sprawdź, czy suma pozycji zgadza się z kwotą storna
      const itemsTotal = options.items.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0
      );
      // Tolerancja na błędy zaokrągleń (1 grosz)
      if (Math.abs(itemsTotal - options.amount) > 0.01) {
        return {
          success: false,
          error: `Suma pozycji (${itemsTotal.toFixed(2)} PLN) nie zgadza się z kwotą storna (${options.amount.toFixed(2)} PLN)`,
        };
      }
    }

    // Zbuduj żądanie storna (transactionId wymagane przez FiscalStornoRequest – pusty gdy brak powiązania)
    const request: FiscalStornoRequest = {
      originalReceiptNumber: options.originalReceiptNumber.trim(),
      transactionId: "",
      reason: options.reason,
      amount: options.amount,
      items: options.items,
      operatorNote: options.operatorNote,
    };

    // Wykonaj storno
    const result = await printFiscalStorno(request);

    // Mapowanie powodów storna na czytelny tekst (zgodne z lib/fiscal/types StornoReason)
    const reasonDescriptions: Record<StornoReason, string> = {
      CUSTOMER_RETURN: "Zwrot towaru",
      CUSTOMER_CANCEL: "Rezygnacja klienta",
      OPERATOR_ERROR: "Błąd operatora",
      PRICE_ERROR: "Błąd ceny",
      QUANTITY_ERROR: "Błąd ilości",
      WRONG_ITEM: "Pomyłka w pozycji",
      DOUBLE_SCAN: "Podwójne zeskanowanie",
      TECHNICAL_ERROR: "Błąd techniczny",
      OTHER: "Inny powód",
    };

    // Loguj operację (storno jest szczególnie ważne do audytu)
    await createAuditLog({
      actionType: "CREATE",
      entityType: "FISCAL",
      entityId: result.stornoNumber ?? options.originalReceiptNumber,
      newValue: {
        fiscalAction: "STORNO",
        success: result.success,
        originalReceiptNumber: options.originalReceiptNumber,
        stornoNumber: result.stornoNumber,
        stornoAmount: options.amount,
        reason: options.reason,
        reasonDescription: reasonDescriptions[options.reason],
        operatorNote: options.operatorNote,
        itemsCount: options.items?.length ?? 0,
        errorCode: result.errorCode,
        errorMessage: result.error,
      },
      ipAddress: ip,
    });

    if (!result.success) {
      return { 
        success: false, 
        error: result.error || "Błąd wykonania storna" 
      };
    }

    return { success: true, data: result };
  } catch (e) {
    console.error("[printFiscalStornoAction]", e);
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd wykonania storna",
    };
  }
}

function startOfToday(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Night Audit: zamyka dobę – zamraża transakcje z daty &lt; dziś (isReadOnly), oznacza rezerwacje No-show (CONFIRMED, checkIn &lt; dziś).
 * Można wykonać tylko raz na dobę.
 * @returns ActionResult z closedCount, noShowCount, reportSummary (transactionsClosed, totalAmount)
 */
export async function runNightAudit(): Promise<
  ActionResult<{ closedCount: number; noShowCount: number; reportSummary: Record<string, number> }>
> {
  const headersList = await headers();
  const ip = getClientIp(headersList);
  const today = startOfToday();
  const todayStr = today.toISOString().slice(0, 10);

  try {
    const alreadyRun = await prisma.auditLog.findFirst({
      where: {
        entityType: "NightAudit",
        entityId: { startsWith: todayStr },
      },
    });
    if (alreadyRun) {
      return {
        success: false,
        error: "Night Audit dla tej doby został już wykonany. Nie można zamknąć doby dwukrotnie.",
      };
    }

    const result = await prisma.transaction.updateMany({
      where: { createdAt: { lt: today } },
      data: { isReadOnly: true },
    });

    const noShowResult = await prisma.reservation.updateMany({
      where: {
        status: "CONFIRMED",
        checkIn: { lt: today },
      },
      data: { status: "NO_SHOW" },
    });

    const report = await prisma.transaction.aggregate({
      where: { createdAt: { lt: today } },
      _sum: { amount: true },
      _count: true,
    });

    await createAuditLog({
      actionType: "UPDATE",
      entityType: "NightAudit",
      entityId: today.toISOString(),
      newValue: {
        closedCount: result.count,
        noShowCount: noShowResult.count,
        totalAmount: report._sum.amount?.toString(),
        transactionCount: report._count,
      } as unknown as Record<string, unknown>,
      ipAddress: ip,
    });

    revalidatePath("/finance");
    revalidatePath("/reports");
    return {
      success: true,
      data: {
        closedCount: result.count,
        noShowCount: noShowResult.count,
        reportSummary: {
          transactionsClosed: result.count,
          totalAmount: Number(report._sum.amount ?? 0),
        },
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd Night Audit",
    };
  }
}

export interface ManagementReportRow {
  id: string;
  reservationId: string;
  amount: number;
  type: string;
  isReadOnly: boolean;
  createdAt: string;
}

export interface ManagementReportData {
  date: string;
  totalAmount: number;
  transactionCount: number;
  byType: Record<string, number>;
  transactions: ManagementReportRow[];
  currency: string;
  vatPercent: number;
}

/**
 * Raport dobowy (Management Report) – transakcje z danego dnia.
 * @param dateStr - data w formacie YYYY-MM-DD
 * @returns ActionResult z ManagementReportData (date, totalAmount, transactionCount, byType, transactions, currency, vatPercent)
 */
export async function getManagementReportData(
  dateStr: string
): Promise<ActionResult<ManagementReportData>> {
  if (!dateStr || typeof dateStr !== "string" || !dateStr.trim()) {
    return { success: false, error: "Data jest wymagana (format YYYY-MM-DD)" };
  }
  const session = await getSession();
  if (session) {
    const allowed = await can(session.role, "reports.management");
    if (!allowed) return { success: false, error: "Brak uprawnień do raportu dobowego" };
  }
  const dayStart = new Date(dateStr.trim() + "T00:00:00.000Z");
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
  if (Number.isNaN(dayStart.getTime())) {
    return { success: false, error: "Nieprawidłowa data (użyj YYYY-MM-DD)" };
  }
  try {
    const transactions = await prisma.transaction.findMany({
      where: { createdAt: { gte: dayStart, lt: dayEnd } },
      orderBy: { createdAt: "asc" },
    });
    let config: { currency: string | null; vatPercent: unknown } | null = null;
    try {
      config = await prisma.cennikConfig.findUnique({
        where: { id: "default" },
        select: { currency: true, vatPercent: true },
      });
    } catch (error) {
      console.error("[getManagementReportData] Config fetch error:", error instanceof Error ? error.message : String(error));
    }
    const currency = config?.currency ?? "PLN";
    const vatPercent = config?.vatPercent != null ? Number(config.vatPercent) : 0;
    const byType: Record<string, number> = {};
    let totalAmount = 0;
    for (const t of transactions) {
      const amt = Number(t.amount);
      totalAmount += amt;
      byType[t.type] = (byType[t.type] ?? 0) + amt;
    }
    return {
      success: true,
      data: {
        date: dateStr,
        totalAmount,
        transactionCount: transactions.length,
        byType,
        transactions: transactions.map((t) => ({
          id: t.id,
          reservationId: t.reservationId,
          amount: Number(t.amount),
          type: t.type,
          isReadOnly: t.isReadOnly,
          createdAt: t.createdAt.toISOString(),
        })),
        currency,
        vatPercent,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu raportu",
    };
  }
}

// ============================================================
// RAPORT PROWIZJI (biura podróży, OTA)
// ============================================================

export interface CommissionReportRow {
  agentId: string;
  agentCode: string;
  agentName: string;
  commissionPercent: number;
  reservationCount: number;
  totalRevenue: number;
  totalCommission: number;
}

export interface CommissionReportData {
  dateFrom: string;
  dateTo: string;
  currency: string;
  rows: CommissionReportRow[];
  totalRevenue: number;
  totalCommission: number;
}

/**
 * Raport prowizji dla agentów (biur podróży, OTA) – wg daty wymeldowania w okresie.
 * @param dateFrom - data początkowa YYYY-MM-DD
 * @param dateTo - data końcowa YYYY-MM-DD
 * @returns ActionResult z CommissionReportData (dateFrom, dateTo, currency, rows, totalRevenue, totalCommission)
 */
export async function getCommissionReport(
  dateFrom: string,
  dateTo: string
): Promise<ActionResult<CommissionReportData>> {
  if (!dateFrom || !dateTo || typeof dateFrom !== "string" || typeof dateTo !== "string") {
    return { success: false, error: "Wymagane daty dateFrom i dateTo (YYYY-MM-DD)" };
  }
  const from = new Date(dateFrom.trim() + "T00:00:00.000Z");
  const to = new Date(dateTo.trim() + "T23:59:59.999Z");
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return { success: false, error: "Nieprawidłowy zakres dat (użyj YYYY-MM-DD)" };
  }
  if (from > to) {
    return { success: false, error: "Data od nie może być późniejsza niż data do" };
  }
  try {
    let config: { currency: string | null } | null = null;
    try {
      config = await prisma.cennikConfig.findUnique({
        where: { id: "default" },
        select: { currency: true },
      });
    } catch (error) {
      console.error("[getCommissionReport] Config fetch error:", error instanceof Error ? error.message : String(error));
    }
    const currency = config?.currency ?? "PLN";

    const reservations = await prisma.reservation.findMany({
      where: {
        travelAgentId: { not: null },
        checkOut: { gte: from, lte: to },
      },
      include: {
        travelAgent: true,
        transactions: {
          where: {
            status: "ACTIVE",
            type: { in: ["ROOM", "LOCAL_TAX"] },
          },
        },
      },
    });

    const byAgent = new Map<
      string,
      { agent: NonNullable<(typeof reservations)[0]["travelAgent"]>; revenue: number; commission: number; count: number }
    >();

    for (const res of reservations) {
      const agent = res.travelAgent;
      if (!agent) continue;

      const revenue = res.transactions.reduce((sum, t) => sum + Number(t.amount), 0);
      const pct = res.agentCommission != null ? Number(res.agentCommission) : Number(agent.commissionPercent);
      const commission = (revenue * pct) / 100;

      const existing = byAgent.get(agent.id);
      if (existing) {
        existing.revenue += revenue;
        existing.commission += commission;
        existing.count += 1;
      } else {
        byAgent.set(agent.id, {
          agent,
          revenue,
          commission,
          count: 1,
        });
      }
    }

    const rows: CommissionReportRow[] = Array.from(byAgent.entries()).map(([, v]) => ({
      agentId: v.agent.id,
      agentCode: v.agent.code,
      agentName: v.agent.name,
      commissionPercent: Number(v.agent.commissionPercent),
      reservationCount: v.count,
      totalRevenue: v.revenue,
      totalCommission: v.commission,
    }));

    const totalRevenue = rows.reduce((s, r) => s + r.totalRevenue, 0);
    const totalCommission = rows.reduce((s, r) => s + r.totalCommission, 0);

    return {
      success: true,
      data: {
        dateFrom,
        dateTo,
        currency,
        rows,
        totalRevenue,
        totalCommission,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd generowania raportu prowizji",
    };
  }
}

/** Transakcje z dziś – do listy wyboru przy Void (GAP 3.2). */
export interface TransactionForList {
  id: string;
  type: string;
  amount: number;
  createdAt: string;
  isReadOnly: boolean;
}

/**
 * Pobiera listę transakcji z bieżącego dnia (do wyboru przy Void).
 * @returns ActionResult z tablicą TransactionForList (id, type, amount, createdAt, isReadOnly)
 */
export async function getTransactionsForToday(): Promise<
  ActionResult<TransactionForList[]>
> {
  const today = startOfToday();
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  try {
    const list = await prisma.transaction.findMany({
      where: { createdAt: { gte: today, lt: tomorrow } },
      orderBy: { createdAt: "desc" },
    });
    return {
      success: true,
      data: list.map((t) => ({
        id: t.id,
        type: t.type,
        amount: Number(t.amount),
        createdAt: t.createdAt.toISOString(),
        isReadOnly: t.isReadOnly,
      })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu listy transakcji",
    };
  }
}

/**
 * Suma gotówki (transakcje CASH) z bieżącego dnia – do Blind Drop.
 * @returns ActionResult z expectedCash (suma transakcji CASH na dziś)
 */
export async function getCashSumForToday(): Promise<
  ActionResult<{ expectedCash: number }>
> {
  const today = startOfToday();
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  try {
    const result = await prisma.transaction.aggregate({
      where: {
        type: "CASH",
        createdAt: { gte: today, lt: tomorrow },
      },
      _sum: { amount: true },
    });
    const expectedCash = Number(result._sum.amount ?? 0);
    return { success: true, data: { expectedCash } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu sumy gotówki",
    };
  }
}

/**
 * Blind Drop: porównanie policzonej gotówki z systemem; zapisuje wynik i zwraca różnicę.
 * @param countedCash - kwota policzonej gotówki (liczba)
 * @returns ActionResult z expectedCash, countedCash, difference, isShortage
 */
export async function submitBlindDrop(countedCash: number): Promise<
  ActionResult<{
    expectedCash: number;
    countedCash: number;
    difference: number;
    isShortage: boolean;
  }>
> {
  const parsed = blindDropSchema.safeParse({ countedCash });
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Nieprawidłowa kwota",
    };
  }

  const sumResult = await getCashSumForToday();
  if (!sumResult.success) {
    return { success: false, error: sumResult.error ?? "Błąd odczytu sumy gotówki" };
  }
  if (!sumResult.data) {
    return { success: false, error: "Brak danych sumy gotówki" };
  }

  const expectedCash = sumResult.data.expectedCash;
  const difference = parsed.data.countedCash - expectedCash;
  const isShortage = difference < 0;
  const absDifference = Math.abs(difference);

  let session: Awaited<ReturnType<typeof getSession>> = null;
  try {
    session = await getSession();
  } catch (error) {
    console.error("[submitBlindDrop] getSession error:", error instanceof Error ? error.message : String(error));
  }

  try {
    await prisma.blindDropRecord.create({
      data: {
        countedCash: parsed.data.countedCash,
        expectedCash,
        difference: absDifference,
        isShortage,
        performedByUserId: session?.userId ?? undefined,
      },
    });
  } catch (e) {
    console.error("[submitBlindDrop]", e);
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd zapisu Blind Drop",
    };
  }

  return {
    success: true,
    data: {
      expectedCash,
      countedCash: parsed.data.countedCash,
      difference: absDifference,
      isShortage,
    },
  };
}

/** Historia Blind Dropów (kto, kiedy, kwota, manko/superata). */
export interface BlindDropHistoryItem {
  id: string;
  performedAt: string;
  countedCash: number;
  expectedCash: number;
  difference: number;
  isShortage: boolean;
  performedByName: string | null;
}

/**
 * Historia Blind Dropów (kto, kiedy, kwota, manko/superata).
 * @param limit - maksymalna liczba wpisów (domyślnie 50, max 200)
 * @returns ActionResult z tablicą BlindDropHistoryItem
 */
export async function getBlindDropHistory(
  limit: number = 50
): Promise<ActionResult<BlindDropHistoryItem[]>> {
  const safeLimit = typeof limit !== "number" || limit < 1 ? 50 : Math.min(Math.floor(limit), 200);
  try {
    const records = await prisma.blindDropRecord.findMany({
      orderBy: { performedAt: "desc" },
      take: safeLimit,
      include: {
        performedBy: { select: { name: true } },
      },
    });
    return {
      success: true,
      data: records.map((r) => ({
        id: r.id,
        performedAt: r.performedAt.toISOString(),
        countedCash: Number(r.countedCash),
        expectedCash: Number(r.expectedCash),
        difference: Number(r.difference),
        isShortage: r.isShortage,
        performedByName: r.performedBy?.name ?? null,
      })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu historii Blind Drop",
    };
  }
}

// ============================================================
// REJESTRY VAT (sprzedaży / zakupów)
// ============================================================

export interface VatRegisterRow {
  invoiceId?: string;
  date: string;
  documentNumber: string;
  contractorNip: string;
  contractorName: string;
  netAmount: number;
  vatRate: number;
  vatAmount: number;
  grossAmount: number;
  /** Status KSeF (DRAFT, PENDING, ACCEPTED, REJECTED, VERIFICATION) – do badge na liście faktur */
  ksefStatus?: string | null;
  /** Komunikat błędu KSeF dla odrzuconych faktur */
  ksefErrorMessage?: string | null;
}

export interface VatRegisterData {
  dateFrom: string;
  dateTo: string;
  rows: VatRegisterRow[];
  totalNet: number;
  totalVat: number;
  totalGross: number;
}

/**
 * Rejestr sprzedaży VAT – faktury wystawione w okresie.
 * @param dateFrom - data początkowa YYYY-MM-DD
 * @param dateTo - data końcowa YYYY-MM-DD
 * @returns ActionResult z VatRegisterData (dateFrom, dateTo, rows, totalNet, totalVat, totalGross)
 */
export async function getVatSalesRegister(
  dateFrom: string,
  dateTo: string
): Promise<ActionResult<VatRegisterData>> {
  if (!dateFrom || !dateTo || typeof dateFrom !== "string" || typeof dateTo !== "string") {
    return { success: false, error: "Wymagane daty dateFrom i dateTo (YYYY-MM-DD)" };
  }
  const from = new Date(dateFrom.trim() + "T00:00:00.000Z");
  const to = new Date(dateTo.trim() + "T23:59:59.999Z");
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return { success: false, error: "Nieprawidłowy zakres dat (użyj YYYY-MM-DD)" };
  }
  if (from > to) {
    return { success: false, error: "Data od nie może być późniejsza niż data do" };
  }
  try {
    const start = new Date(from);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(to);
    end.setUTCHours(23, 59, 59, 999);

    const invoices = await prisma.invoice.findMany({
      where: { issuedAt: { gte: start, lte: end } },
      orderBy: { issuedAt: "asc" },
    });

    const rows: VatRegisterRow[] = invoices.map((i) => ({
      invoiceId: i.id,
      date: i.issuedAt.toISOString().slice(0, 10),
      documentNumber: i.number,
      contractorNip: i.buyerNip ?? "",
      contractorName: i.buyerName ?? "",
      netAmount: Number(i.amountNet),
      vatRate: Number(i.vatRate),
      vatAmount: Number(i.amountVat),
      grossAmount: Number(i.amountGross),
      ksefStatus: i.ksefStatus ?? null,
      ksefErrorMessage: i.ksefErrorMessage ?? null,
    }));

    const totalNet = rows.reduce((s, r) => s + r.netAmount, 0);
    const totalVat = rows.reduce((s, r) => s + r.vatAmount, 0);
    const totalGross = rows.reduce((s, r) => s + r.grossAmount, 0);

    return {
      success: true,
      data: {
        dateFrom,
        dateTo,
        rows,
        totalNet,
        totalVat,
        totalGross,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu rejestru sprzedaży VAT",
    };
  }
}

/**
 * Rejestr zakupów VAT – na razie bez modelu zakupów zwraca pusty rejestr.
 * @param dateFrom - data początkowa YYYY-MM-DD
 * @param dateTo - data końcowa YYYY-MM-DD
 * @returns ActionResult z VatRegisterData (puste rows gdy brak modelu zakupów)
 */
export async function getVatPurchasesRegister(
  dateFrom: string,
  dateTo: string
): Promise<ActionResult<VatRegisterData>> {
  if (!dateFrom || !dateTo || typeof dateFrom !== "string" || typeof dateTo !== "string") {
    return { success: false, error: "Wymagane daty dateFrom i dateTo (YYYY-MM-DD)" };
  }
  const from = new Date(dateFrom.trim() + "T00:00:00.000Z");
  const to = new Date(dateTo.trim() + "T23:59:59.999Z");
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return { success: false, error: "Nieprawidłowy zakres dat (użyj YYYY-MM-DD)" };
  }
  if (from > to) {
    return { success: false, error: "Data od nie może być późniejsza niż data do" };
  }
  try {
    return {
      success: true,
      data: {
        dateFrom,
        dateTo,
        rows: [],
        totalNet: 0,
        totalVat: 0,
        totalGross: 0,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu rejestru zakupów VAT",
    };
  }
}

// ============================================================
// KPiR (Księga Przychodów i Rozchodów)
// ============================================================

export interface KpirRow {
  date: string;
  description: string;
  documentNumber: string | null;
  income: number;
  expense: number;
}

export interface KpirData {
  dateFrom: string;
  dateTo: string;
  rows: KpirRow[];
  totalIncome: number;
  totalExpense: number;
}

/**
 * KPiR – księga przychodów i rozchodów na podstawie transakcji (przychody = wpływy, rozchody = zwroty/wydatki).
 * @param dateFrom - data początkowa YYYY-MM-DD
 * @param dateTo - data końcowa YYYY-MM-DD
 * @returns ActionResult z KpirData (dateFrom, dateTo, rows, totalIncome, totalExpense)
 */
export async function getKpirReport(
  dateFrom: string,
  dateTo: string
): Promise<ActionResult<KpirData>> {
  if (!dateFrom || !dateTo || typeof dateFrom !== "string" || typeof dateTo !== "string") {
    return { success: false, error: "Wymagane daty dateFrom i dateTo (YYYY-MM-DD)" };
  }
  const from = new Date(dateFrom.trim() + "T00:00:00.000Z");
  const to = new Date(dateTo.trim() + "T23:59:59.999Z");
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return { success: false, error: "Nieprawidłowy zakres dat (użyj YYYY-MM-DD)" };
  }
  if (from > to) {
    return { success: false, error: "Data od nie może być późniejsza niż data do" };
  }
  try {
    const start = new Date(from);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(to);
    end.setUTCHours(23, 59, 59, 999);

    const transactions = await prisma.transaction.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        status: "ACTIVE",
        type: { not: "VOID" },
      },
      include: {
        reservation: { select: { confirmationNumber: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    const rows: KpirRow[] = transactions.map((t) => {
      const amount = Number(t.amount);
      const desc =
        t.description ||
        `${t.type}${t.reservation?.confirmationNumber ? ` – ${t.reservation.confirmationNumber}` : ""}`;
      return {
        date: t.createdAt.toISOString().slice(0, 10),
        description: desc,
        documentNumber: null,
        income: amount > 0 ? amount : 0,
        expense: amount < 0 ? -amount : 0,
      };
    });

    const totalIncome = rows.reduce((s, r) => s + r.income, 0);
    const totalExpense = rows.reduce((s, r) => s + r.expense, 0);

    return {
      success: true,
      data: {
        dateFrom,
        dateTo,
        rows,
        totalIncome,
        totalExpense,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd generowania KPiR",
    };
  }
}

/**
 * Weryfikacja PIN managera (Void, operacje chronione).
 * @param pin - PIN managera (string)
 * @returns ActionResult z true przy poprawnym PIN, false + error przy błędnym
 */
export async function verifyManagerPin(pin: string): Promise<ActionResult<boolean>> {
  if (pin == null || typeof pin !== "string") {
    return { success: false, error: "PIN jest wymagany" };
  }
  if (pin === MANAGER_PIN) {
    return { success: true, data: true };
  }
  return { success: false, error: "Nieprawidłowy PIN" };
}

// ============================================================
// KASA ZMIANOWA (shift opening/closing balance)
// ============================================================

export interface CashShiftData {
  id: string;
  openedAt: string;
  closedAt: string | null;
  openingBalance: number;
  closingBalance: number | null;
  expectedCashAtClose: number | null;
  /** Oczekiwana gotówka na teraz (dla otwartej zmiany: openingBalance + wpływy/wypływy od otwarcia). */
  expectedCashForNow: number | null;
  difference: number | null;
  notes: string | null;
}

/**
 * Pobiera aktualnie otwartą zmianę kasową (bez closedAt).
 * @returns ActionResult z CashShiftData lub null gdy brak otwartej zmiany
 */
export async function getCurrentCashShift(): Promise<ActionResult<CashShiftData | null>> {
  try {
    const shift = await prisma.cashShift.findFirst({
      where: { closedAt: null },
      orderBy: { openedAt: "desc" },
    });
    if (!shift) {
      return { success: true, data: null };
    }
    const expectedCashForNow = await getExpectedCashForShift(shift);
    return {
      success: true,
      data: {
        id: shift.id,
        openedAt: shift.openedAt.toISOString(),
        closedAt: shift.closedAt?.toISOString() ?? null,
        openingBalance: Number(shift.openingBalance),
        closingBalance: shift.closingBalance != null ? Number(shift.closingBalance) : null,
        expectedCashAtClose: shift.expectedCashAtClose != null ? Number(shift.expectedCashAtClose) : null,
        expectedCashForNow,
        difference: shift.difference != null ? Number(shift.difference) : null,
        notes: shift.notes,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu zmiany",
    };
  }
}

/**
 * Oczekiwana gotówka w kasie na moment zamknięcia zmiany:
 * stan na otwarcie + suma transakcji gotówkowych (paymentMethod CASH) od openedAt.
 */
async function getExpectedCashForShift(shift: { openedAt: Date; openingBalance: unknown }): Promise<number> {
  const opening = Number(shift.openingBalance);
  const result = await prisma.transaction.aggregate({
    where: {
      paymentMethod: "CASH",
      status: "ACTIVE",
      createdAt: { gte: shift.openedAt },
    },
    _sum: { amount: true },
  });
  const netCash = Number(result._sum.amount ?? 0);
  return opening + netCash;
}

/**
 * Otwiera nową zmianę kasową (stan gotówki na początek). Tylko jedna zmiana może być otwarta.
 * @param openingBalance - kwota gotówki na otwarcie (>= 0)
 * @returns ActionResult z shiftId przy sukcesie
 */
export async function openCashShift(openingBalance: number): Promise<ActionResult<{ shiftId: string }>> {
  if (typeof openingBalance !== "number" || openingBalance < 0 || !Number.isFinite(openingBalance)) {
    return { success: false, error: "Nieprawidłowa kwota otwarcia" };
  }
  try {
    const existing = await prisma.cashShift.findFirst({
      where: { closedAt: null },
    });
    if (existing) {
      return { success: false, error: "Istnieje już otwarta zmiana. Zamknij ją przed otwarciem nowej." };
    }
    let session: Awaited<ReturnType<typeof getSession>> = null;
    try {
      session = await getSession();
    } catch (error) {
      console.error("[openCashShift] getSession error:", error instanceof Error ? error.message : String(error));
    }
    const shift = await prisma.cashShift.create({
      data: {
        openingBalance,
        openedByUserId: session?.userId ?? undefined,
      },
    });
    return { success: true, data: { shiftId: shift.id } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd otwarcia zmiany",
    };
  }
}

/**
 * Zamyka bieżącą zmianę kasową (policzona gotówka). Zapisuje closingBalance, expectedCashAtClose, difference, closedAt, notes.
 * @param countedCash - policzona kwota gotówki w kasie
 * @param notes - opcjonalna notatka przy zamknięciu
 * @returns ActionResult z shiftId, expectedCash, countedCash, difference, isShortage
 */
export async function closeCashShift(
  countedCash: number,
  notes?: string | null
): Promise<
  ActionResult<{
    shiftId: string;
    expectedCash: number;
    countedCash: number;
    difference: number;
    isShortage: boolean;
  }>
> {
  const parsed = blindDropSchema.safeParse({ countedCash });
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Nieprawidłowa kwota",
    };
  }
  try {
    const shift = await prisma.cashShift.findFirst({
      where: { closedAt: null },
      orderBy: { openedAt: "desc" },
    });
    if (!shift) {
      return { success: false, error: "Brak otwartej zmiany do zamknięcia" };
    }
    const expectedCash = await getExpectedCashForShift(shift);
    const difference = parsed.data.countedCash - expectedCash;
    let session: Awaited<ReturnType<typeof getSession>> = null;
    try {
      session = await getSession();
    } catch (error) {
      console.error("[closeCashShift] getSession error:", error instanceof Error ? error.message : String(error));
    }

    await prisma.cashShift.update({
      where: { id: shift.id },
      data: {
        closedAt: new Date(),
        closingBalance: parsed.data.countedCash,
        expectedCashAtClose: expectedCash,
        difference,
        closedByUserId: session?.userId ?? undefined,
        notes: notes?.trim() || undefined,
      },
    });

    return {
      success: true,
      data: {
        shiftId: shift.id,
        expectedCash,
        countedCash: parsed.data.countedCash,
        difference: Math.abs(difference),
        isShortage: difference < 0,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd zamknięcia zmiany",
    };
  }
}

// ============================================================
// RAPORT KASOWY (historia zmiany, raport po zmianie)
// ============================================================

export interface CashShiftHistoryItem {
  id: string;
  openedAt: string;
  closedAt: string | null;
  openingBalance: number;
  closingBalance: number | null;
  expectedCashAtClose: number | null;
  difference: number | null;
  notes: string | null;
}

/**
 * Lista zamkniętych zmian kasowych (ostatnie N) – do raportu kasowego.
 * @param limit - maksymalna liczba wpisów (domyślnie 30, max 100)
 * @returns ActionResult z tablicą CashShiftHistoryItem
 */
export async function getCashShiftHistory(limit = 30): Promise<ActionResult<CashShiftHistoryItem[]>> {
  const safeLimit = typeof limit !== "number" || limit < 1 ? 30 : Math.min(Math.floor(limit), 100);
  try {
    const shifts = await prisma.cashShift.findMany({
      where: { closedAt: { not: null } },
      orderBy: { closedAt: "desc" },
      take: safeLimit,
    });
    return {
      success: true,
      data: shifts.map((s) => ({
        id: s.id,
        openedAt: s.openedAt.toISOString(),
        closedAt: s.closedAt?.toISOString() ?? null,
        openingBalance: Number(s.openingBalance),
        closingBalance: s.closingBalance != null ? Number(s.closingBalance) : null,
        expectedCashAtClose: s.expectedCashAtClose != null ? Number(s.expectedCashAtClose) : null,
        difference: s.difference != null ? Number(s.difference) : null,
        notes: s.notes,
      })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu historii zmiany",
    };
  }
}

export interface CashShiftReportDetail {
  shift: CashShiftHistoryItem;
  /** Transakcje gotówkowe w okresie zmiany (od openedAt do closedAt). */
  cashTransactions: Array<{
    id: string;
    reservationId: string;
    amount: number;
    type: string;
    description: string | null;
    createdAt: string;
  }>;
}

/**
 * Raport kasowy dla jednej zmiany: szczegóły + lista transakcji gotówkowych.
 * @param shiftId - ID zmiany kasowej
 * @returns ActionResult z CashShiftReportDetail lub null gdy zmiana nie istnieje / nie jest zamknięta
 */
export async function getCashShiftReport(shiftId: string): Promise<ActionResult<CashShiftReportDetail | null>> {
  if (!shiftId || typeof shiftId !== "string" || !shiftId.trim()) {
    return { success: false, error: "ID zmiany jest wymagane" };
  }
  try {
    const shift = await prisma.cashShift.findUnique({
      where: { id: shiftId.trim() },
    });
    if (!shift || !shift.closedAt) {
      return { success: true, data: null };
    }
    const transactions = await prisma.transaction.findMany({
      where: {
        paymentMethod: "CASH",
        status: "ACTIVE",
        createdAt: { gte: shift.openedAt, lte: shift.closedAt },
      },
      orderBy: { createdAt: "asc" },
      select: { id: true, reservationId: true, amount: true, type: true, description: true, createdAt: true },
    });
    const shiftItem: CashShiftHistoryItem = {
      id: shift.id,
      openedAt: shift.openedAt.toISOString(),
      closedAt: shift.closedAt.toISOString(),
      openingBalance: Number(shift.openingBalance),
      closingBalance: Number(shift.closingBalance),
      expectedCashAtClose: shift.expectedCashAtClose != null ? Number(shift.expectedCashAtClose) : null,
      difference: shift.difference != null ? Number(shift.difference) : null,
      notes: shift.notes,
    };
    return {
      success: true,
      data: {
        shift: shiftItem,
        cashTransactions: transactions.map((t) => ({
          id: t.id,
          reservationId: t.reservationId,
          amount: Number(t.amount),
          type: t.type,
          description: t.description,
          createdAt: t.createdAt.toISOString(),
        })),
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu raportu kasowego",
    };
  }
}

/** Rejestracja płatności zaliczkowej (Przelew/Zadatek) – automatycznie „wystawiana” faktura zaliczkowa */
/** Dozwolone typy transakcji */
const VALID_TRANSACTION_TYPES = [
  "ROOM",       // Opłata za nocleg
  "DEPOSIT",    // Zaliczka / depozyt
  "VOID",       // Anulowanie
  "LOCAL_TAX",  // Opłata miejscowa / klimatyczna
  "MINIBAR",    // Minibar
  "GASTRONOMY", // Gastronomia / room service
  "SPA",        // Usługi SPA
  "PARKING",    // Parking
  "RENTAL",     // Wypożyczenie sprzętu
  "PHONE",      // Rozmowy telefoniczne
  "LAUNDRY",    // Pralnia
  "TRANSPORT",  // Transfer (lotnisko, dworzec)
  "ATTRACTION", // Wycieczki i atrakcje
  "DISCOUNT",   // Rabat (kwotowy lub procentowy – kwota ujemna)
  "REFUND",     // Zwrot płatności (kwota ujemna; tworzona przez refundPayment / refundSecurityDeposit)
  "OTHER",      // Inne usługi
] as const;

type TransactionType = typeof VALID_TRANSACTION_TYPES[number];

/** Szczegóły płatności podzielonej (split payment) */
export interface SplitPaymentDetail {
  method: PaymentMethod;
  amount: number;
  reference?: string;  // np. numer autoryzacji karty, numer przelewu
}

/** Szczegóły płatności w transakcji */
export interface PaymentDetails {
  methods?: SplitPaymentDetail[];  // dla SPLIT payment
  cardLastFour?: string;           // ostatnie 4 cyfry karty
  cardType?: string;               // VISA, MASTERCARD, AMEX, etc.
  authorizationCode?: string;      // kod autoryzacji
  terminalTransactionId?: string;  // ID transakcji z terminala
  transferReference?: string;      // numer przelewu
  voucherCode?: string;            // kod vouchera
  blikCode?: string;               // kod BLIK (maskowany)
}

/**
 * Waliduje szczegóły płatności dla split payment.
 */
function validateSplitPayment(
  amount: number,
  details: PaymentDetails
): { valid: boolean; error?: string } {
  if (!details.methods || details.methods.length === 0) {
    return { valid: false, error: "Płatność podzielona wymaga listy metod" };
  }

  if (details.methods.length < 2) {
    return { valid: false, error: "Płatność podzielona wymaga co najmniej 2 metod" };
  }

  // Sprawdź czy każda metoda jest prawidłowa
  for (const method of details.methods) {
    if (!VALID_PAYMENT_METHODS.includes(method.method)) {
      return { 
        valid: false, 
        error: `Nieprawidłowa metoda płatności: ${method.method}` 
      };
    }
    if (method.amount <= 0) {
      return { 
        valid: false, 
        error: `Kwota dla metody ${method.method} musi być większa od zera` 
      };
    }
    // Nie pozwól na zagnieżdżony SPLIT
    if (method.method === "SPLIT") {
      return { valid: false, error: "Nie można użyć SPLIT wewnątrz SPLIT" };
    }
  }

  // Sprawdź czy suma metod zgadza się z kwotą transakcji
  const methodsTotal = details.methods.reduce((sum, m) => sum + m.amount, 0);
  if (Math.abs(methodsTotal - amount) > 0.01) {
    return {
      valid: false,
      error: `Suma metod płatności (${methodsTotal.toFixed(2)} PLN) nie zgadza się z kwotą transakcji (${amount.toFixed(2)} PLN)`,
    };
  }

  return { valid: true };
}

/**
 * Rejestracja transakcji finansowej (uniwersalna funkcja).
 * Waliduje: reservationId (wymagane), amount (> 0, limit 1 mln), type (z listy), paymentMethod, paymentDetails (dla SPLIT).
 * @param params - reservationId, amount, type, paymentMethod (opcjonalnie), paymentDetails (opcjonalnie), description (opcjonalnie)
 * @returns ActionResult z transactionId, amount, paymentMethod
 */
export async function registerTransaction(
  params: {
    reservationId: string;
    amount: number;
    type: string;
    paymentMethod?: string;          // metoda płatności: CASH, CARD, TRANSFER, etc.
    paymentDetails?: PaymentDetails; // szczegóły płatności (dla SPLIT, karty, etc.)
    description?: string;
  }
): Promise<ActionResult<{ transactionId: string; amount: number; paymentMethod?: string }>> {
  const headersList = await headers();
  const ip = getClientIp(headersList);

  // Walidacja reservationId
  if (!params.reservationId || typeof params.reservationId !== "string") {
    return { success: false, error: "ID rezerwacji jest wymagane" };
  }
  if (params.reservationId.trim() === "") {
    return { success: false, error: "ID rezerwacji nie może być puste" };
  }

  // Walidacja kwoty
  if (params.amount === undefined || params.amount === null) {
    return { success: false, error: "Kwota transakcji jest wymagana" };
  }
  if (typeof params.amount !== "number" || !Number.isFinite(params.amount)) {
    return { success: false, error: "Kwota musi być prawidłową liczbą" };
  }
  if (params.amount <= 0) {
    return { success: false, error: "Kwota transakcji musi być większa od zera" };
  }
  // Maksymalna kwota transakcji (zabezpieczenie przed błędami)
  const MAX_TRANSACTION_AMOUNT = 1_000_000; // 1 mln PLN
  if (params.amount > MAX_TRANSACTION_AMOUNT) {
    return { 
      success: false, 
      error: `Kwota transakcji przekracza dozwolony limit (${MAX_TRANSACTION_AMOUNT.toLocaleString("pl-PL")} PLN)` 
    };
  }

  // Walidacja typu transakcji
  if (!params.type || typeof params.type !== "string") {
    return { success: false, error: "Typ transakcji jest wymagany" };
  }
  const normalizedType = params.type.trim().toUpperCase() as TransactionType;
  if (!VALID_TRANSACTION_TYPES.includes(normalizedType)) {
    return { 
      success: false, 
      error: `Nieprawidłowy typ transakcji: "${params.type}". Dozwolone: ${VALID_TRANSACTION_TYPES.join(", ")}` 
    };
  }

  // Walidacja metody płatności (opcjonalna)
  let normalizedPaymentMethod: PaymentMethod | undefined;
  if (params.paymentMethod) {
    normalizedPaymentMethod = params.paymentMethod.trim().toUpperCase() as PaymentMethod;
    if (!VALID_PAYMENT_METHODS.includes(normalizedPaymentMethod)) {
      return {
        success: false,
        error: `Nieprawidłowa metoda płatności: "${params.paymentMethod}". Dozwolone: ${VALID_PAYMENT_METHODS.join(", ")}`,
      };
    }

    // Walidacja szczegółów płatności dla SPLIT
    if (normalizedPaymentMethod === "SPLIT") {
      if (!params.paymentDetails) {
        return { success: false, error: "Płatność podzielona wymaga szczegółów (paymentDetails)" };
      }
      const splitValidation = validateSplitPayment(params.amount, params.paymentDetails);
      if (!splitValidation.valid) {
        return { success: false, error: splitValidation.error! };
      }
    }
  }

  try {
    // Sprawdź czy rezerwacja istnieje
    const reservation = await prisma.reservation.findUnique({
      where: { id: params.reservationId },
      select: { id: true, status: true },
    });

    if (!reservation) {
      return { success: false, error: `Rezerwacja o ID "${params.reservationId}" nie istnieje` };
    }

    // Opcjonalne ostrzeżenie: transakcja dla anulowanej rezerwacji
    if (reservation.status === "CANCELLED") {
      console.warn(
        `[registerTransaction] Tworzenie transakcji dla anulowanej rezerwacji: ${params.reservationId}`
      );
    }

    // Utwórz transakcję
    const tx = await prisma.transaction.create({
      data: {
        reservationId: params.reservationId,
        amount: params.amount,
        type: normalizedType,
        paymentMethod: normalizedPaymentMethod,
        paymentDetails: params.paymentDetails ? JSON.stringify(params.paymentDetails) : undefined,
        isReadOnly: false,
      },
    });

    // Audit log
    await createAuditLog({
      actionType: "CREATE",
      entityType: "Transaction",
      entityId: tx.id,
      newValue: {
        reservationId: params.reservationId,
        amount: tx.amount.toString(),
        type: normalizedType,
        paymentMethod: normalizedPaymentMethod,
        hasSplitPayment: normalizedPaymentMethod === "SPLIT",
        description: params.description,
      } as unknown as Record<string, unknown>,
      ipAddress: ip,
    });

    revalidatePath("/finance");
    revalidatePath("/reports");
    await updateReservationPaymentStatus(params.reservationId).catch((err) =>
      console.error("[updateReservationPaymentStatus]", err)
    );

    return {
      success: true,
      data: {
        transactionId: tx.id,
        amount: Number(tx.amount),
        paymentMethod: normalizedPaymentMethod,
      },
    };
  } catch (e) {
    console.error("[registerTransaction]", e);
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd rejestracji transakcji",
    };
  }
}

/**
 * Pobiera listę dostępnych metod płatności (do dropdown'ów w UI).
 * @returns ActionResult z tablicą { code, name, description } dla każdej metody
 */
export async function getAvailablePaymentMethods(): Promise<
  ActionResult<Array<{ code: PaymentMethod; name: string; description?: string }>>
> {
  const methods: Array<{ code: PaymentMethod; name: string; description?: string }> = [
    { code: "CASH", name: "Gotówka", description: "Płatność gotówką w kasie" },
    { code: "CARD", name: "Karta", description: "Karta płatnicza (Visa, Mastercard, Amex)" },
    { code: "TRANSFER", name: "Przelew", description: "Przelew bankowy" },
    { code: "VOUCHER", name: "Voucher", description: "Bon podarunkowy / voucher" },
    { code: "PREPAID", name: "Przedpłata", description: "Wcześniej wpłacona zaliczka" },
    { code: "BLIK", name: "BLIK", description: "Płatność kodem BLIK" },
    { code: "SPLIT", name: "Podzielona", description: "Płatność kilkoma metodami" },
    { code: "OTHER", name: "Inna", description: "Inna metoda płatności" },
  ];

  return { success: true, data: methods };
}

/**
 * Pobiera statystyki płatności dla danego zakresu dat (raporty kasowe).
 * @param params - dateFrom, dateTo (opcjonalne; domyślnie dziś)
 * @returns ActionResult z byMethod, totalCount, totalAmount
 */
export async function getPaymentStatistics(
  params: { dateFrom?: Date | string; dateTo?: Date | string }
): Promise<
  ActionResult<{
    byMethod: Array<{ method: string; count: number; total: number }>;
    totalCount: number;
    totalAmount: number;
  }>
> {
  try {
    // Ustal zakres dat
    let dateFrom: Date;
    let dateTo: Date;

    if (params.dateFrom && params.dateTo) {
      dateFrom = params.dateFrom instanceof Date 
        ? params.dateFrom 
        : new Date(params.dateFrom);
      dateTo = params.dateTo instanceof Date 
        ? params.dateTo 
        : new Date(params.dateTo);
    } else {
      // Domyślnie dzisiaj
      dateFrom = startOfToday();
      dateTo = new Date(dateFrom);
      dateTo.setUTCDate(dateTo.getUTCDate() + 1);
    }

    // Pobierz transakcje z zakresu dat
    const transactions = await prisma.transaction.findMany({
      where: {
        createdAt: { gte: dateFrom, lt: dateTo },
      },
      select: {
        amount: true,
        paymentMethod: true,
      },
    });

    // Grupuj po metodzie płatności
    const byMethodMap = new Map<string, { count: number; total: number }>();
    
    for (const tx of transactions) {
      const method = tx.paymentMethod || "UNKNOWN";
      const existing = byMethodMap.get(method) || { count: 0, total: 0 };
      existing.count++;
      existing.total += Number(tx.amount);
      byMethodMap.set(method, existing);
    }

    // Konwertuj na tablicę i posortuj
    const byMethod = Array.from(byMethodMap.entries())
      .map(([method, stats]) => ({
        method,
        count: stats.count,
        total: Math.round(stats.total * 100) / 100,
      }))
      .sort((a, b) => b.total - a.total);

    // Oblicz sumy
    const totalCount = transactions.length;
    const totalAmount = Math.round(
      transactions.reduce((sum, tx) => sum + Number(tx.amount), 0) * 100
    ) / 100;

    return {
      success: true,
      data: {
        byMethod,
        totalCount,
        totalAmount,
      },
    };
  } catch (e) {
    console.error("[getPaymentStatistics]", e);
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania statystyk płatności",
    };
  }
}

/**
 * Tworzy transakcję z płatnością podzieloną (split payment).
 * 
 * Umożliwia użycie kilku metod płatności dla jednej transakcji,
 * np. częściowo gotówką i częściowo kartą.
 * 
 * @example
 * // Płatność 500 PLN: 300 gotówką + 200 kartą
 * await createSplitPaymentTransaction({
 *   reservationId: "cuid123",
 *   type: "ROOM",
 *   methods: [
 *     { method: "CASH", amount: 300 },
 *     { method: "CARD", amount: 200, reference: "AUTH-123" }
 *   ],
 *   description: "Nocleg + śniadanie"
 * });
 * @param params - reservationId, type, methods (min. 2, max 10), description (opcjonalnie)
 * @returns ActionResult z transactionId, amount, paymentMethod "SPLIT", methodsBreakdown
 */
export async function createSplitPaymentTransaction(
  params: {
    reservationId: string;
    type: string;
    methods: Array<{
      method: PaymentMethod;
      amount: number;
      reference?: string;  // np. kod autoryzacji karty, nr przelewu
    }>;
    description?: string;
  }
): Promise<ActionResult<{ 
  transactionId: string; 
  amount: number; 
  paymentMethod: "SPLIT";
  methodsBreakdown: Array<{ method: string; amount: number }>;
}>> {
  const headersList = await headers();
  const ip = getClientIp(headersList);

  // Walidacja reservationId
  if (!params.reservationId || params.reservationId.trim() === "") {
    return { success: false, error: "ID rezerwacji jest wymagane" };
  }

  // Walidacja typu transakcji
  if (!params.type || typeof params.type !== "string") {
    return { success: false, error: "Typ transakcji jest wymagany" };
  }
  const normalizedType = params.type.trim().toUpperCase() as TransactionType;
  if (!VALID_TRANSACTION_TYPES.includes(normalizedType)) {
    return { 
      success: false, 
      error: `Nieprawidłowy typ transakcji: "${params.type}". Dozwolone: ${VALID_TRANSACTION_TYPES.join(", ")}` 
    };
  }

  // Walidacja metod płatności
  if (!params.methods || !Array.isArray(params.methods)) {
    return { success: false, error: "Lista metod płatności jest wymagana" };
  }
  if (params.methods.length < 2) {
    return { 
      success: false, 
      error: "Płatność podzielona wymaga co najmniej 2 metod płatności. Dla jednej metody użyj registerTransaction." 
    };
  }
  if (params.methods.length > 10) {
    return { success: false, error: "Maksymalnie 10 metod płatności w jednej transakcji" };
  }

  // Walidacja każdej metody
  for (const m of params.methods) {
    if (!VALID_PAYMENT_METHODS.includes(m.method)) {
      return { 
        success: false, 
        error: `Nieprawidłowa metoda płatności: "${m.method}". Dozwolone: ${VALID_PAYMENT_METHODS.join(", ")}` 
      };
    }
    if (m.method === "SPLIT") {
      return { success: false, error: "Nie można użyć SPLIT wewnątrz płatności podzielonej" };
    }
    if (typeof m.amount !== "number" || !Number.isFinite(m.amount)) {
      return { success: false, error: `Kwota dla metody ${m.method} musi być liczbą` };
    }
    if (m.amount <= 0) {
      return { success: false, error: `Kwota dla metody ${m.method} musi być większa od zera` };
    }
  }

  // Oblicz sumę
  const totalAmount = params.methods.reduce((sum, m) => sum + m.amount, 0);
  
  // Walidacja sumy
  if (totalAmount <= 0) {
    return { success: false, error: "Suma płatności musi być większa od zera" };
  }
  const MAX_TRANSACTION_AMOUNT = 1_000_000;
  if (totalAmount > MAX_TRANSACTION_AMOUNT) {
    return { 
      success: false, 
      error: `Suma płatności przekracza dozwolony limit (${MAX_TRANSACTION_AMOUNT.toLocaleString("pl-PL")} PLN)` 
    };
  }

  try {
    // Sprawdź czy rezerwacja istnieje
    const reservation = await prisma.reservation.findUnique({
      where: { id: params.reservationId },
      select: { id: true, status: true },
    });

    if (!reservation) {
      return { success: false, error: `Rezerwacja o ID "${params.reservationId}" nie istnieje` };
    }

    // Przygotuj szczegóły płatności
    const paymentDetails: PaymentDetails = {
      methods: params.methods.map(m => ({
        method: m.method,
        amount: m.amount,
        reference: m.reference,
      })),
    };

    // Utwórz transakcję
    const tx = await prisma.transaction.create({
      data: {
        reservationId: params.reservationId,
        amount: totalAmount,
        type: normalizedType,
        paymentMethod: "SPLIT",
        paymentDetails: JSON.stringify(paymentDetails),
        isReadOnly: false,
      },
    });

    // Audit log
    await createAuditLog({
      actionType: "CREATE",
      entityType: "Transaction",
      entityId: tx.id,
      newValue: {
        reservationId: params.reservationId,
        amount: tx.amount.toString(),
        type: normalizedType,
        paymentMethod: "SPLIT",
        methodsCount: params.methods.length,
        methodsBreakdown: params.methods.map(m => ({
          method: m.method,
          amount: m.amount,
        })),
        description: params.description,
      } as unknown as Record<string, unknown>,
      ipAddress: ip,
    });

    revalidatePath("/finance");
    revalidatePath("/reports");
    await updateReservationPaymentStatus(params.reservationId).catch((err) =>
      console.error("[updateReservationPaymentStatus]", err)
    );

    return {
      success: true,
      data: {
        transactionId: tx.id,
        amount: Number(tx.amount),
        paymentMethod: "SPLIT",
        methodsBreakdown: params.methods.map(m => ({
          method: m.method,
          amount: m.amount,
        })),
      },
    };
  } catch (e) {
    console.error("[createSplitPaymentTransaction]", e);
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd tworzenia transakcji z płatnością podzieloną",
    };
  }
}

/**
 * Pobiera szczegóły płatności podzielonej dla transakcji.
 * @param transactionId - ID transakcji
 * @returns ActionResult z transactionId, totalAmount, paymentMethod, methods (dla SPLIT)
 */
export async function getSplitPaymentDetails(
  transactionId: string
): Promise<ActionResult<{
  transactionId: string;
  totalAmount: number;
  paymentMethod: string;
  methods?: Array<{ method: string; amount: number; reference?: string }>;
}>> {
  if (!transactionId || typeof transactionId !== "string" || !transactionId.trim()) {
    return { success: false, error: "ID transakcji jest wymagane" };
  }
  try {
    const tx = await prisma.transaction.findUnique({
      where: { id: transactionId.trim() },
      select: {
        id: true,
        amount: true,
        paymentMethod: true,
        paymentDetails: true,
      },
    });

    if (!tx) {
      return { success: false, error: "Transakcja nie istnieje" };
    }

    let methods: Array<{ method: string; amount: number; reference?: string }> | undefined;
    
    if (tx.paymentMethod === "SPLIT" && tx.paymentDetails) {
      try {
        const details = typeof tx.paymentDetails === "string"
          ? JSON.parse(tx.paymentDetails)
          : tx.paymentDetails;
        methods = details.methods;
      } catch {
        // Błąd parsowania - ignorujemy
      }
    }

    return {
      success: true,
      data: {
        transactionId: tx.id,
        totalAmount: Number(tx.amount),
        paymentMethod: tx.paymentMethod || "UNKNOWN",
        methods,
      },
    };
  } catch (e) {
    console.error("[getSplitPaymentDetails]", e);
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania szczegółów płatności",
    };
  }
}

/**
 * Rejestruje płatność zaliczkową (DEPOSIT) dla rezerwacji; opcjonalnie drukuje paragon fiskalny.
 * @param reservationId - ID rezerwacji
 * @param amount - kwota zaliczki (> 0)
 * @returns ActionResult z transactionId, invoiceUrl
 */
export async function createDepositPayment(
  reservationId: string,
  amount: number
): Promise<ActionResult<{ transactionId: string; invoiceUrl: string }>> {
  if (!reservationId || typeof reservationId !== "string" || reservationId.trim() === "") {
    return { success: false, error: "ID rezerwacji jest wymagane" };
  }
  if (amount == null || typeof amount !== "number" || !Number.isFinite(amount)) {
    return { success: false, error: "Kwota musi być prawidłową liczbą" };
  }
  if (amount <= 0) {
    return { success: false, error: "Kwota musi być dodatnia" };
  }

  const headersList = await headers();
  const ip = getClientIp(headersList);

  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
    });
    if (!reservation) return { success: false, error: "Rezerwacja nie istnieje" };

    const tx = await prisma.transaction.create({
      data: {
        reservationId,
        amount,
        type: "DEPOSIT",
        isReadOnly: false,
      },
    });

    if (await isFiscalEnabled()) {
      const receiptRequest = await buildReceiptRequest({
        transactionId: tx.id,
        reservationId,
        amount: Number(tx.amount),
        type: "DEPOSIT",
        description: "Zaliczka",
        itemName: "Zaliczka",
      });
      const fiscalResult = await printFiscalReceipt(receiptRequest);
      if (!fiscalResult.success && fiscalResult.error) {
        console.error("[FISCAL] Błąd druku paragonu zaliczki:", fiscalResult.error);
      }
    }

    await createAuditLog({
      actionType: "CREATE",
      entityType: "Transaction",
      entityId: tx.id,
      newValue: {
        amount: tx.amount.toString(),
        type: "DEPOSIT",
        reservationId,
        depositInvoiceGenerated: true,
      } as unknown as Record<string, unknown>,
      ipAddress: ip,
    });

    revalidatePath("/finance");
    await updateReservationPaymentStatus(reservationId).catch((err) =>
      console.error("[updateReservationPaymentStatus]", err)
    );
    return {
      success: true,
      data: {
        transactionId: tx.id,
        invoiceUrl: `/api/finance/deposit-invoice/${tx.id}`,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd rejestracji zaliczki",
    };
  }
}

/** Nalicz opłatę miejscową (klimatyczną) za pobyt – stawka z Property, kwota = noce × PAX × stawka. Idempotentne: nie tworzy duplikatu. */
export async function chargeLocalTax(
  reservationId: string
): Promise<ActionResult<{ transactionId: string; amount: number; skipped?: boolean }>> {
  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { room: { include: { property: true } } },
    });
    if (!reservation) return { success: false, error: "Rezerwacja nie istnieje" };
    const alerts = reservation.alerts as { localTaxExempt?: boolean } | null;
    if (alerts?.localTaxExempt) {
      return {
        success: true,
        data: { transactionId: reservationId, amount: 0, skipped: true },
      };
    }
    const property = reservation.room?.property;
    if (!property) return { success: false, error: "Brak obiektu dla pokoju" };
    const rate = property.localTaxPerPersonPerNight;
    if (rate == null || Number(rate) <= 0) {
      return { success: false, error: "Opłata miejscowa nie jest skonfigurowana dla obiektu" };
    }
    const nights =
      Math.round(
        (new Date(reservation.checkOut).getTime() - new Date(reservation.checkIn).getTime()) /
          (24 * 60 * 60 * 1000)
      ) || 1;
    const pax = reservation.pax ?? 1;
    const amount = nights * pax * Number(rate);

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.transaction.findFirst({
        where: { reservationId, type: "LOCAL_TAX", status: "ACTIVE" },
      });
      if (existing) {
        return {
          success: true as const,
          data: { transactionId: existing.id, amount: Number(existing.amount), skipped: true },
        };
      }
      const newTx = await tx.transaction.create({
        data: {
          reservationId,
          amount,
          type: "LOCAL_TAX",
          isReadOnly: false,
        },
      });
      return {
        success: true as const,
        data: { transactionId: newTx.id, amount: Number(newTx.amount) },
      };
    });

    revalidatePath("/finance");
    revalidatePath("/reports");
    await updateReservationPaymentStatus(reservationId).catch((err) =>
      console.error("[updateReservationPaymentStatus]", err)
    );
    return result;
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd naliczania opłaty miejscowej",
    };
  }
}

/** Dolicza SpaBooking do rachunku rezerwacji – tworzy Transaction typu SPA. Idempotentne: nie tworzy duplikatu. */
export async function chargeSpaBookingToReservation(
  spaBookingId: string,
  reservationId?: string
): Promise<ActionResult<{ transactionId: string; amount: number; skipped?: boolean }>> {
  try {
    const booking = await prisma.spaBooking.findUnique({
      where: { id: spaBookingId },
      include: { resource: true },
    });
    if (!booking) return { success: false, error: "Rezerwacja SPA nie istnieje" };

    const targetReservationId = booking.reservationId ?? reservationId;
    if (!targetReservationId) {
      return { success: false, error: "Podaj rezerwację – SpaBooking nie jest powiązany z rezerwacją" };
    }

    const reservation = await prisma.reservation.findUnique({
      where: { id: targetReservationId },
    });
    if (!reservation) return { success: false, error: "Rezerwacja nie istnieje" };

    const amount = Number(booking.resource.price);
    const description = `SPA: ${booking.resource.name}`;

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.transaction.findFirst({
        where: {
          reservationId: targetReservationId,
          type: "SPA",
          status: "ACTIVE",
          externalRef: `spa:${spaBookingId}`,
        },
      });
      if (existing) {
        return {
          success: true as const,
          data: { transactionId: existing.id, amount: Number(existing.amount), skipped: true },
        };
      }
      const newTx = await tx.transaction.create({
        data: {
          reservationId: targetReservationId,
          amount,
          type: "SPA",
          description,
          quantity: 1,
          unitPrice: amount,
          category: "SPA",
          folioNumber: 1,
          status: "ACTIVE",
          externalRef: `spa:${spaBookingId}`,
        },
      });
      if (!booking.reservationId) {
        await tx.spaBooking.update({
          where: { id: spaBookingId },
          data: { reservationId: targetReservationId },
        });
      }
      return {
        success: true as const,
        data: { transactionId: newTx.id, amount: Number(newTx.amount) },
      };
    });

    revalidatePath("/finance");
    revalidatePath("/reports");
    revalidatePath("/spa");
    await updateReservationPaymentStatus(targetReservationId).catch((err) =>
      console.error("[updateReservationPaymentStatus]", err)
    );

    return result;
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd doliczania SPA do rachunku",
    };
  }
}

/** Dolicza zamówienie gastronomiczne (Order) do rachunku rezerwacji – Transaction typu GASTRONOMY. */
export async function chargeOrderToReservation(
  orderId: string
): Promise<ActionResult<{ transactionId: string; amount: number; skipped?: boolean }>> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { orderItems: { include: { menuItem: true } } },
    });
    if (!order) return { success: false, error: "Zamówienie nie istnieje" };
    if (!order.reservationId) return { success: false, error: "Zamówienie nie jest powiązane z rezerwacją" };

    const reservation = await prisma.reservation.findUnique({
      where: { id: order.reservationId },
      select: { status: true },
    });
    if (!reservation) return { success: false, error: "Rezerwacja nie istnieje" };
    if (reservation.status === "CHECKED_OUT") {
      return {
        success: false,
        error: "Nie można doliczyć zamówienia do wymeldowanej rezerwacji (status CHECKED_OUT).",
      };
    }

    const totalAmount = order.orderItems.reduce(
      (sum, i) => sum + Number(i.unitPrice ?? i.menuItem.price) * i.quantity,
      0
    );
    const rounded = Math.round(totalAmount * 100) / 100;
    if (rounded <= 0) return { success: false, error: "Zamówienie ma zerową wartość" };

    const itemNames = order.orderItems
      .map((i) => `${i.menuItem.name} × ${i.quantity}`)
      .join(", ");
    const description = `Zamówienie restauracyjne: ${itemNames}`;
    const orderReservationId = order.reservationId;

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.transaction.findFirst({
        where: {
          reservationId: orderReservationId,
          type: "GASTRONOMY",
          status: "ACTIVE",
          externalRef: `order:${orderId}`,
        },
      });
      if (existing) {
        return {
          success: true as const,
          data: { transactionId: existing.id, amount: Number(existing.amount), skipped: true },
        };
      }
      const newTx = await tx.transaction.create({
        data: {
          reservationId: orderReservationId,
          amount: rounded,
          type: "GASTRONOMY",
          description,
          quantity: 1,
          unitPrice: rounded,
          category: "F_B",
          subcategory: "RESTAURANT",
          folioNumber: 1,
          status: "ACTIVE",
          externalRef: `order:${orderId}`,
        },
      });
      return {
        success: true as const,
        data: { transactionId: newTx.id, amount: Number(newTx.amount) },
      };
    });

    revalidatePath("/finance");
    revalidatePath("/reports");
    revalidatePath("/gastronomy");
    await updateReservationPaymentStatus(orderReservationId).catch((err) =>
      console.error("[updateReservationPaymentStatus]", err)
    );

    return result;
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd doliczania zamówienia",
    };
  }
}

/** Obciążenie rachunku za posiłki (MealConsumption) – automatyczne lub ręczne. */
export async function chargeMealConsumptionsToReservation(
  reservationId: string,
  dateStr: string
): Promise<ActionResult<{ transactionIds: string[]; totalAmount: number }>> {
  try {
    const date = new Date(dateStr + "T12:00:00Z");
    if (Number.isNaN(date.getTime())) return { success: false, error: "Nieprawidłowa data" };

    const consumptions = await prisma.mealConsumption.findMany({
      where: { reservationId, date },
      include: { reservation: { include: { room: { include: { property: true } } } } },
    });
    if (consumptions.length === 0) {
      return { success: true, data: { transactionIds: [], totalAmount: 0 } };
    }

    const property = consumptions[0].reservation?.room?.property;
    const mealPrices = (property?.mealPrices as { breakfast?: number; lunch?: number; dinner?: number }) ?? {};
    const prices: Record<string, number> = {
      BREAKFAST: mealPrices.breakfast ?? 50,
      LUNCH: mealPrices.lunch ?? 80,
      DINNER: mealPrices.dinner ?? 80,
    };

    const transactionIds: string[] = [];
    let totalAmount = 0;
    const mealLabels: Record<string, string> = { BREAKFAST: "Śniadanie", LUNCH: "Obiad", DINNER: "Kolacja" };

    for (const c of consumptions) {
      const existing = await prisma.transaction.findFirst({
        where: {
          reservationId,
          status: "ACTIVE",
          externalRef: `meal:${c.id}`,
        },
      });
      if (existing) continue;

      const unitPrice = prices[c.mealType] ?? 50;
      const amount = Math.round(unitPrice * c.paxCount * 100) / 100;

      const tx = await prisma.transaction.create({
        data: {
          reservationId,
          amount,
          type: "GASTRONOMY",
          description: `${mealLabels[c.mealType] ?? c.mealType} × ${c.paxCount}`,
          quantity: c.paxCount,
          unitPrice,
          category: "F_B",
          subcategory: "MEAL",
          folioNumber: 1,
          status: "ACTIVE",
          externalRef: `meal:${c.id}`,
        },
      });
      transactionIds.push(tx.id);
      totalAmount += amount;
    }

    if (transactionIds.length > 0) {
      revalidatePath("/finance");
      revalidatePath("/reports");
      revalidatePath("/meals");
      await updateReservationPaymentStatus(reservationId).catch((err) =>
        console.error("[updateReservationPaymentStatus]", err)
      );
    }

    return { success: true, data: { transactionIds, totalAmount } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd obciążania posiłków",
    };
  }
}

/** Obciążenie rachunku pokoju za usługę restauracji (room service, bar). Generyczne – bez modelu Order. */
export async function chargeGastronomyToReservation(
  reservationId: string,
  amount: number,
  description: string
): Promise<ActionResult<{ transactionId: string; amount: number }>> {
  if (amount <= 0) return { success: false, error: "Kwota musi być większa od zera" };
  if (!description?.trim()) return { success: false, error: "Opis jest wymagany" };
  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
    });
    if (!reservation) return { success: false, error: "Rezerwacja nie istnieje" };

    const tx = await prisma.transaction.create({
      data: {
        reservationId,
        amount,
        type: "GASTRONOMY",
        description: description.trim(),
        quantity: 1,
        unitPrice: amount,
        category: "F_B",
        subcategory: "RESTAURANT",
        folioNumber: 1,
        status: "ACTIVE",
      },
    });

    revalidatePath("/finance");
    revalidatePath("/reports");
    await updateReservationPaymentStatus(reservationId).catch((err) =>
      console.error("[updateReservationPaymentStatus]", err)
    );

    return {
      success: true,
      data: { transactionId: tx.id, amount: Number(tx.amount) },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd doliczania gastronomii",
    };
  }
}

/** Dolicza zlecenie pralni do rachunku rezerwacji (gdy status → DELIVERED). */
export async function chargeLaundryOrderToReservation(
  laundryOrderId: string
): Promise<ActionResult<{ transactionId: string; amount: number; skipped?: boolean }>> {
  try {
    const order = await prisma.laundryOrder.findUnique({
      where: { id: laundryOrderId },
      include: { orderItems: { include: { laundryService: true } } },
    });
    if (!order) return { success: false, error: "Zlecenie pralni nie istnieje" };
    if (!order.reservationId) return { success: false, error: "Zlecenie nie jest powiązane z rezerwacją" };

    const totalAmount = order.orderItems.reduce((sum, i) => sum + Number(i.amount), 0);
    const rounded = Math.round(totalAmount * 100) / 100;
    if (rounded <= 0) return { success: false, error: "Zlecenie ma zerową wartość" };

    const itemNames = order.orderItems
      .map((i) => `${i.laundryService.name} × ${i.quantity}`)
      .join(", ");
    const description = `Pralnia: ${itemNames}`;

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.transaction.findFirst({
        where: {
          reservationId: order.reservationId,
          type: "LAUNDRY",
          status: "ACTIVE",
          externalRef: `laundryOrder:${laundryOrderId}`,
        },
      });
      if (existing) {
        return {
          success: true as const,
          data: { transactionId: existing.id, amount: Number(existing.amount), skipped: true },
        };
      }
      const newTx = await tx.transaction.create({
        data: {
          reservationId: order.reservationId,
          amount: rounded,
          type: "LAUNDRY",
          description,
          quantity: 1,
          unitPrice: rounded,
          category: "LAUNDRY",
          folioNumber: 1,
          status: "ACTIVE",
          externalRef: `laundryOrder:${laundryOrderId}`,
        },
      });
      return {
        success: true as const,
        data: { transactionId: newTx.id, amount: Number(newTx.amount) },
      };
    });

    revalidatePath("/housekeeping/laundry");
    revalidatePath("/finance");
    await updateReservationPaymentStatus(order.reservationId).catch((err) =>
      console.error("[updateReservationPaymentStatus]", err)
    );

    return result;
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd doliczania pralni",
    };
  }
}

/** Dolicza rezerwację transferu do rachunku (gdy status → DONE). */
export async function chargeTransferBookingToReservation(
  transferBookingId: string
): Promise<ActionResult<{ transactionId: string; amount: number; skipped?: boolean }>> {
  try {
    const booking = await prisma.transferBooking.findUnique({
      where: { id: transferBookingId },
    });
    if (!booking) return { success: false, error: "Rezerwacja transferu nie istnieje" };
    if (!booking.reservationId) return { success: false, error: "Transfer nie jest powiązany z rezerwacją" };

    const amount = Number(booking.price);
    if (amount <= 0) return { success: false, error: "Kwota transferu musi być większa od zera" };

    const typeLabel = booking.type === "AIRPORT" ? "Lotnisko" : "Dworzec";
    const dirLabel = booking.direction === "ARRIVAL" ? "Przyjazd" : "Wyjazd";
    const description = `Transfer ${typeLabel} – ${dirLabel}: ${booking.place}`;

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.transaction.findFirst({
        where: {
          reservationId: booking.reservationId,
          type: "TRANSPORT",
          status: "ACTIVE",
          externalRef: `transfer:${transferBookingId}`,
        },
      });
      if (existing) {
        return {
          success: true as const,
          data: { transactionId: existing.id, amount: Number(existing.amount), skipped: true },
        };
      }
      const newTx = await tx.transaction.create({
        data: {
          reservationId: booking.reservationId,
          amount,
          type: "TRANSPORT",
          description,
          quantity: 1,
          unitPrice: amount,
          category: "TRANSPORT",
          folioNumber: 1,
          status: "ACTIVE",
          externalRef: `transfer:${transferBookingId}`,
        },
      });
      await tx.transferBooking.update({
        where: { id: transferBookingId },
        data: { chargedAt: new Date() },
      });
      return {
        success: true as const,
        data: { transactionId: newTx.id, amount: Number(newTx.amount) },
      };
    });

    revalidatePath("/transfers");
    revalidatePath("/finance");
    await updateReservationPaymentStatus(booking.reservationId).catch((err) =>
      console.error("[updateReservationPaymentStatus]", err)
    );

    return result;
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd doliczania transferu",
    };
  }
}

/** Dolicza rezerwację wypożyczenia (RentalBooking) do rachunku rezerwacji – Transaction typu RENTAL. Idempotentne. */
export async function chargeRentalBookingToReservation(
  rentalBookingId: string
): Promise<ActionResult<{ transactionId: string; amount: number; skipped?: boolean }>> {
  try {
    const booking = await prisma.rentalBooking.findUnique({
      where: { id: rentalBookingId },
      include: { rentalItem: true },
    });
    if (!booking) return { success: false, error: "Rezerwacja wypożyczenia nie istnieje" };
    if (!booking.reservationId) return { success: false, error: "Wypożyczenie nie jest powiązane z rezerwacją" };

    const start = new Date(booking.startDate);
    const end = new Date(booking.endDate);
    start.setUTCHours(0, 0, 0, 0);
    end.setUTCHours(0, 0, 0, 0);
    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
    const pricePerDay = Number(booking.rentalItem.pricePerDay);
    const amount = Math.round(pricePerDay * days * booking.quantity * 100) / 100;
    if (amount <= 0) return { success: false, error: "Kwota wypożyczenia musi być większa od zera" };

    const description = `Wypożyczenie: ${booking.rentalItem.name} × ${booking.quantity} (${days} dni)`;
    const rentalReservationId = booking.reservationId;

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.transaction.findFirst({
        where: {
          reservationId: rentalReservationId,
          type: "RENTAL",
          status: "ACTIVE",
          externalRef: `rental:${rentalBookingId}`,
        },
      });
      if (existing) {
        return {
          success: true as const,
          data: { transactionId: existing.id, amount: Number(existing.amount), skipped: true },
        };
      }
      const newTx = await tx.transaction.create({
        data: {
          reservationId: rentalReservationId,
          amount,
          type: "RENTAL",
          description,
          quantity: booking.quantity,
          unitPrice: pricePerDay,
          category: "RENTAL",
          folioNumber: 1,
          status: "ACTIVE",
          externalRef: `rental:${rentalBookingId}`,
        },
      });
      return {
        success: true as const,
        data: { transactionId: newTx.id, amount: Number(newTx.amount) },
      };
    });

    revalidatePath("/rentals");
    revalidatePath("/finance");
    await updateReservationPaymentStatus(rentalReservationId).catch((err) =>
      console.error("[updateReservationPaymentStatus]", err)
    );

    return result;
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd doliczania wypożyczenia do rachunku",
    };
  }
}

/** Dolicza połączenie telefoniczne (PhoneCallLog) do rachunku rezerwacji – Transaction typu PHONE. Mapuje room→reservation gdy brak reservationId. Idempotentne. */
export async function chargePhoneCallLogToReservation(
  phoneCallLogId: string
): Promise<ActionResult<{ transactionId: string; amount: number; skipped?: boolean }>> {
  try {
    const { findReservationIdByRoomAndDate } = await import("@/lib/telephony");

    let log = await prisma.phoneCallLog.findUnique({
      where: { id: phoneCallLogId },
    });
    if (!log) return { success: false, error: "Wpis rozmowy nie istnieje" };

    let reservationId = log.reservationId;
    if (!reservationId && log.roomId) {
      reservationId = await findReservationIdByRoomAndDate(log.roomId, log.startedAt);
      if (reservationId) {
        await prisma.phoneCallLog.update({
          where: { id: phoneCallLogId },
          data: { reservationId },
        });
        log = { ...log, reservationId };
      }
    }
    if (!reservationId) {
      return { success: false, error: "Nie można przypisać rozmowy do rezerwacji (brak pokoju lub rezerwacji w tym dniu)" };
    }

    const cost = log.cost != null ? Number(log.cost) : 0;
    if (cost <= 0) {
      return { success: false, error: "Brak kosztu rozmowy do doliczenia" };
    }

    const startedStr = new Date(log.startedAt).toLocaleString("pl-PL", {
      dateStyle: "short",
      timeStyle: "short",
    });
    const description = `Telefon: ${startedStr} (${log.durationSec}s)`;

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.transaction.findFirst({
        where: {
          reservationId,
          type: "PHONE",
          status: "ACTIVE",
          externalRef: `phone:${phoneCallLogId}`,
        },
      });
      if (existing) {
        return {
          success: true as const,
          data: { transactionId: existing.id, amount: Number(existing.amount), skipped: true },
        };
      }
      const newTx = await tx.transaction.create({
        data: {
          reservationId,
          amount: cost,
          type: "PHONE",
          description,
          quantity: 1,
          unitPrice: cost,
          category: "PHONE",
          folioNumber: 1,
          status: "ACTIVE",
          externalRef: `phone:${phoneCallLogId}`,
        },
      });
      return {
        success: true as const,
        data: { transactionId: newTx.id, amount: Number(newTx.amount) },
      };
    });

    revalidatePath("/finance");
    await updateReservationPaymentStatus(reservationId).catch((err) =>
      console.error("[updateReservationPaymentStatus]", err)
    );

    return result;
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd doliczania rozmowy do rachunku",
    };
  }
}

/** Nalicza dopłaty (extras/surcharges) przypisane do rezerwacji – tworzy Transaction typu OTHER (category SURCHARGE) per dopłata. Idempotentne. */
export async function chargeReservationSurchargesToReservation(
  reservationId: string
): Promise<ActionResult<{ transactionIds: string[]; totalAmount: number }>> {
  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        reservationSurcharges: { include: { surchargeType: true } },
      },
    });
    if (!reservation) return { success: false, error: "Rezerwacja nie istnieje" };
    if (reservation.reservationSurcharges.length === 0) {
      return { success: true, data: { transactionIds: [], totalAmount: 0 } };
    }

    const checkIn = new Date(reservation.checkIn);
    const checkOut = new Date(reservation.checkOut);
    checkIn.setUTCHours(0, 0, 0, 0);
    checkOut.setUTCHours(0, 0, 0, 0);
    const nights = Math.max(1, Math.round((checkOut.getTime() - checkIn.getTime()) / 86400000));

    const result = await prisma.$transaction(async (tx) => {
      const transactionIds: string[] = [];
      let totalAmount = 0;

      for (const rs of reservation.reservationSurcharges) {
        const existing = await tx.transaction.findFirst({
          where: {
            reservationId,
            type: "OTHER",
            status: "ACTIVE",
            externalRef: `surcharge:${rs.id}`,
          },
        });
        if (existing) continue;

        const price = Number(rs.surchargeType.price);
        const qty = rs.quantity;
        let amount: number;
        if (rs.amountOverride != null) {
          amount = Math.round(Number(rs.amountOverride) * 100) / 100;
        } else if (rs.surchargeType.chargeType === "PER_NIGHT") {
          amount = Math.round(price * nights * qty * 100) / 100;
        } else {
          amount = Math.round(price * qty * 100) / 100;
        }
        if (amount <= 0) continue;

        const description =
          qty > 1
            ? `Dopłata: ${rs.surchargeType.name} × ${qty}${rs.surchargeType.chargeType === "PER_NIGHT" ? ` (${nights} nocy)` : ""}`
            : `Dopłata: ${rs.surchargeType.name}${rs.surchargeType.chargeType === "PER_NIGHT" ? ` (${nights} nocy)` : ""}`;

        const newTx = await tx.transaction.create({
          data: {
            reservationId,
            amount,
            type: "OTHER",
            description,
            quantity: qty,
            unitPrice: price,
            category: "SURCHARGE",
            folioNumber: 1,
            status: "ACTIVE",
            externalRef: `surcharge:${rs.id}`,
          },
        });
        transactionIds.push(newTx.id);
        totalAmount += amount;
      }

      return {
        success: true as const,
        data: { transactionIds, totalAmount },
      };
    });

    if (result.data.transactionIds.length > 0) {
      revalidatePath("/finance");
      await updateReservationPaymentStatus(reservationId).catch((err) =>
        console.error("[updateReservationPaymentStatus]", err)
      );
    }

    return result;
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd naliczania dopłat do rachunku",
    };
  }
}

/** Dolicza rezerwację wycieczki/atrakcji do rachunku (gdy status → DONE). */
export async function chargeAttractionBookingToReservation(
  attractionBookingId: string
): Promise<ActionResult<{ transactionId: string; amount: number; skipped?: boolean }>> {
  try {
    const booking = await prisma.attractionBooking.findUnique({
      where: { id: attractionBookingId },
      include: { attraction: true },
    });
    if (!booking) return { success: false, error: "Rezerwacja atrakcji nie istnieje" };
    if (!booking.reservationId) return { success: false, error: "Rezerwacja nie jest powiązana z pobytem" };

    const amount = Number(booking.amount);
    if (amount <= 0) return { success: false, error: "Kwota musi być większa od zera" };

    const description =
      booking.quantity > 1
        ? `Wycieczka: ${booking.attraction.name} × ${booking.quantity}`
        : `Wycieczka: ${booking.attraction.name}`;

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.transaction.findFirst({
        where: {
          reservationId: booking.reservationId,
          type: "ATTRACTION",
          status: "ACTIVE",
          externalRef: `attraction:${attractionBookingId}`,
        },
      });
      if (existing) {
        return {
          success: true as const,
          data: { transactionId: existing.id, amount: Number(existing.amount), skipped: true },
        };
      }
      const newTx = await tx.transaction.create({
        data: {
          reservationId: booking.reservationId,
          amount,
          type: "ATTRACTION",
          description,
          quantity: booking.quantity,
          unitPrice: booking.unitPrice,
          category: "OTHER",
          folioNumber: 1,
          status: "ACTIVE",
          externalRef: `attraction:${attractionBookingId}`,
        },
      });
      await tx.attractionBooking.update({
        where: { id: attractionBookingId },
        data: { chargedAt: new Date() },
      });
      return {
        success: true as const,
        data: { transactionId: newTx.id, amount: Number(newTx.amount) },
      };
    });

    revalidatePath("/attractions");
    revalidatePath("/finance");
    await updateReservationPaymentStatus(booking.reservationId).catch((err) =>
      console.error("[updateReservationPaymentStatus]", err)
    );

    return result;
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd doliczania atrakcji",
    };
  }
}

/** Automatyczne obciążenie za nocleg przy check-out (posting ROOM). Wywoływane z updateReservationStatus gdy status → CHECKED_OUT. */
export async function postRoomChargeOnCheckout(
  reservationId: string
): Promise<ActionResult<{ transactionId?: string; amount?: number; skipped?: boolean }>> {
  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { room: true },
    });
    if (!reservation) return { success: false, error: "Rezerwacja nie istnieje" };

    const existing = await prisma.transaction.count({
      where: {
        reservationId,
        type: "ROOM",
        status: "ACTIVE",
      },
    });
    if (existing > 0) {
      return { success: true, data: { skipped: true } };
    }

    const checkInDate = reservation.checkIn instanceof Date ? reservation.checkIn : new Date(reservation.checkIn);
    const checkOutDate = reservation.checkOut instanceof Date ? reservation.checkOut : new Date(reservation.checkOut);
    const checkInStr = checkInDate.toISOString().slice(0, 10);
    const checkOutStr = checkOutDate.toISOString().slice(0, 10);
    const checkIn = new Date(checkInStr + "T12:00:00Z");
    const checkOut = new Date(checkOutStr + "T12:00:00Z");
    const nights = Math.max(1, Math.round((checkOut.getTime() - checkIn.getTime()) / (24 * 60 * 60 * 1000)));
    const roomNumber = reservation.room?.number;
    if (!roomNumber) return { success: false, error: "Brak pokoju przy rezerwacji" };

    const dateStrs: string[] = [];
    for (let i = 0; i < nights; i++) {
      const d = new Date(checkIn);
      d.setUTCDate(d.getUTCDate() + i);
      dateStrs.push(d.toISOString().slice(0, 10));
    }
    const priceMap = await getEffectivePricesBatch(
      dateStrs.map((dateStr) => ({ roomNumber, dateStr }))
    );
    let totalAmount = 0;
    for (const dateStr of dateStrs) {
      const p = priceMap[`${roomNumber}-${dateStr}`];
      totalAmount += p ?? Number(reservation.room?.price ?? 0) ?? 0;
    }
    if (totalAmount <= 0) {
      return { success: false, error: "Nie udało się naliczyć noclegu – pokój nie ma przypisanej ceny. Ustaw cenę pokoju w konfiguracji." };
    }

    const description = `Nocleg ${checkInStr} - ${checkOutStr}`;
    const tx = await prisma.transaction.create({
      data: {
        reservationId,
        amount: totalAmount,
        type: "ROOM",
        description,
        quantity: 1,
        unitPrice: totalAmount,
        vatRate: 8,
        folioNumber: 1,
        status: "ACTIVE",
      },
    });
    revalidatePath("/finance");
    revalidatePath("/reports");
    revalidatePath("/front-office");
    await updateReservationPaymentStatus(reservationId).catch((err) =>
      console.error("[updateReservationPaymentStatus]", err)
    );
    return {
      success: true,
      data: { transactionId: tx.id, amount: Number(tx.amount) },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd obciążenia za nocleg",
    };
  }
}

/** Usunięcie transakcji (Void) – wymaga PIN managera. Limit 3 prób PIN, potem blokada 15 min (per IP). */
export async function voidTransaction(
  transactionId: string,
  managerPin: string
): Promise<ActionResult> {
  const headersList = await headers();
  const ip = getClientIp(headersList) ?? "unknown";

  const lockout = isVoidPinLocked(ip);
  if (lockout.locked) {
    const mins = lockout.remainingMs != null ? Math.ceil(lockout.remainingMs / 60_000) : 15;
    return {
      success: false,
      error: `Zbyt wiele błędnych prób PIN. Spróbuj ponownie za ${mins} min.`,
    };
  }

  const pinResult = await verifyManagerPin(managerPin);
  if (!pinResult.success) {
    recordFailedVoidPinAttempt(ip);
    return pinResult;
  }
  clearVoidPinAttempts(ip);

  try {
    const tx = await prisma.transaction.findUnique({
      where: { id: transactionId },
    });
    if (!tx) return { success: false, error: "Transakcja nie istnieje" };
    if (tx.isReadOnly) return { success: false, error: "Transakcja zamknięta (Night Audit)" };

    await prisma.transaction.delete({ where: { id: transactionId } });

    await createAuditLog({
      actionType: "DELETE",
      entityType: "Transaction",
      entityId: transactionId,
      oldValue: { amount: tx.amount.toString(), type: tx.type } as unknown as Record<string, unknown>,
      newValue: null,
      ipAddress: ip,
    });

    revalidatePath("/finance");
    await updateReservationPaymentStatus(tx.reservationId).catch((err) =>
      console.error("[updateReservationPaymentStatus]", err)
    );
    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd void transakcji",
    };
  }
}

/** Druk faktury na POSNET dla rezerwacji (wymaga firmy przy meldunku) */
export async function printInvoiceForReservation(
  reservationId: string
): Promise<ActionResult<{ invoiceNumber?: string }>> {
  try {
    let reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { company: true, transactions: true },
    });
    if (!reservation) {
      return { success: false, error: "Rezerwacja nie istnieje" };
    }
    if (!reservation.company) {
      return {
        success: false,
        error: "Brak firmy przy rezerwacji – wpisz NIP przy meldunku i zapisz rezerwację z firmą.",
      };
    }
    const nip = reservation.company.nip?.trim();
    if (!nip) {
      return {
        success: false,
        error: "Do druku faktury wymagany jest NIP nabywcy. Uzupełnij NIP w danych firmy przy rezerwacji.",
      };
    }

    // Auto-naliczanie noclegu: jeśli brak transakcji ROOM, nalicz automatycznie
    const hasRoomCharge = reservation.transactions.some(
      (t) => t.type === "ROOM" && Number(t.amount) > 0 && (t.status === "ACTIVE" || t.status == null)
    );
    if (!hasRoomCharge) {
      const roomChargeResult = await postRoomChargeOnCheckout(reservationId);
      if (roomChargeResult.success && roomChargeResult.data && !roomChargeResult.data.skipped) {
        const updatedRes = await prisma.reservation.findUnique({
          where: { id: reservationId },
          include: { company: true, transactions: true },
        });
        if (updatedRes) {
          reservation = updatedRes;
        }
      }
    }

    const totalAmount = reservation.transactions.reduce(
      (sum, t) => sum + Number(t.amount),
      0
    );
    const items = reservation.transactions.length
      ? reservation.transactions.map((t) => ({
          name: t.type === "ROOM" ? "Nocleg" : t.type === "DEPOSIT" ? "Zaliczka" : t.type === "LOCAL_TAX" ? "Opłata miejscowa" : t.type === "MINIBAR" ? "Minibar" : t.type,
          quantity: 1,
          unitPrice: Number(t.amount),
        }))
      : [{ name: "Usługa hotelowa", quantity: 1, unitPrice: totalAmount || 0 }];

    const company = reservation.company!;
    const invoiceRequest = {
      reservationId: reservation.id,
      company: {
        nip,
        name: company.name,
        address: company.address,
        postalCode: company.postalCode,
        city: company.city,
      },
      items,
      totalAmount: totalAmount || 0,
      description: "Faktura za pobyt",
    };

    const result = await printFiscalInvoice(invoiceRequest);
    if (!result.success) {
      return { success: false, error: result.error ?? "Nieznany błąd druku" };
    }
    return { success: true, data: { invoiceNumber: result.invoiceNumber } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd druku faktury",
    };
  }
}

/** Wystawia proformę dla rezerwacji (dokument przedpłatowy). */
export async function createProforma(
  reservationId: string,
  amount?: number
): Promise<ActionResult<{ id: string; number: string; amount: number }>> {
  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { transactions: true },
    });
    if (!reservation) return { success: false, error: "Rezerwacja nie istnieje" };
    const sumFromTransactions = reservation.transactions.reduce(
      (s, t) => s + Number(t.amount),
      0
    );
    const finalAmount = (amount ?? sumFromTransactions) || 0;
    if (finalAmount <= 0) return { success: false, error: "Kwota proformy musi być większa od zera" };

    // Generuj numer proformy z konfigurowalną numeracją
    const numberResult = await generateNextDocumentNumber("PROFORMA");
    if (!numberResult.success) return { success: false, error: numberResult.error };
    const number = numberResult.data;

    const proforma = await prisma.proforma.create({
      data: {
        reservationId,
        number,
        amount: finalAmount,
      },
    });
    revalidatePath("/finance");
    revalidatePath("/reports");
    return {
      success: true,
      data: {
        id: proforma.id,
        number: proforma.number,
        amount: Number(proforma.amount),
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd wystawiania proformy",
    };
  }
}

/** Lista proform dla rezerwacji. */
export async function getProformasForReservation(
  reservationId: string
): Promise<ActionResult<Array<{ id: string; number: string; amount: number; issuedAt: string }>>> {
  try {
    const list = await prisma.proforma.findMany({
      where: { reservationId },
      orderBy: { issuedAt: "desc" },
    });
    return {
      success: true,
      data: list.map((p) => ({
        id: p.id,
        number: p.number,
        amount: Number(p.amount),
        issuedAt: p.issuedAt.toISOString(),
      })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu proform",
    };
  }
}

/** Lista transakcji dla rezerwacji (KP/KW – do zakładki Dokumenty). */
export async function getTransactionsForReservation(
  reservationId: string
): Promise<
  ActionResult<
    Array<{ id: string; amount: number; type: string; createdAt: string; isReadOnly: boolean }>
  >
> {
  try {
    const list = await prisma.transaction.findMany({
      where: { reservationId },
      orderBy: { createdAt: "desc" },
    });
    return {
      success: true,
      data: list.map((t) => ({
        id: t.id,
        amount: Number(t.amount),
        type: t.type,
        createdAt: t.createdAt.toISOString(),
        isReadOnly: t.isReadOnly,
      })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu transakcji",
    };
  }
}

/** Wystawia fakturę VAT dla rezerwacji (numeracja FV/YYYY/SEQ, marża opcjonalnie). */
export async function createVatInvoice(
  reservationId: string,
  marginMode?: boolean
): Promise<
  ActionResult<{
    id: string;
    number: string;
    amountNet: number;
    amountVat: number;
    amountGross: number;
    issuedAt: string;
  }>
> {
  try {
    let reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { company: true, transactions: true },
    });
    if (!reservation) return { success: false, error: "Rezerwacja nie istnieje" };
    if (!reservation.company) {
      return {
        success: false,
        error: "Brak firmy przy rezerwacji – wpisz NIP przy meldunku i zapisz rezerwację z firmą.",
      };
    }
    const buyerNip = reservation.company.nip?.trim();
    if (!buyerNip) {
      return {
        success: false,
        error: "Do wystawienia faktury VAT wymagany jest NIP nabywcy. Uzupełnij NIP w danych firmy przy rezerwacji.",
      };
    }
    // Auto-naliczanie noclegu: jeśli brak transakcji ROOM, nalicz automatycznie
    const hasRoomCharge = reservation.transactions.some(
      (t) => t.type === "ROOM" && Number(t.amount) > 0 && (t.status === "ACTIVE" || t.status == null)
    );
    if (!hasRoomCharge) {
      const roomChargeResult = await postRoomChargeOnCheckout(reservationId);
      if (roomChargeResult.success && roomChargeResult.data && !roomChargeResult.data.skipped) {
        const updatedRes = await prisma.reservation.findUnique({
          where: { id: reservationId },
          include: { company: true, transactions: true },
        });
        if (updatedRes) {
          reservation = updatedRes;
        }
      }
    }

    // Rozliczenie końcowe: obciążenia minus rabaty minus zaliczki (faktura za przedpłatę z późniejszym rozliczeniem)
    const chargeTypes = ["ROOM", "LOCAL_TAX", "MINIBAR", "GASTRONOMY", "SPA", "PARKING", "RENTAL", "PHONE", "LAUNDRY", "TRANSPORT", "ATTRACTION", "OTHER"];
    const totalCharges = reservation.transactions
      .filter((t) => chargeTypes.includes(t.type) && Number(t.amount) > 0)
      .reduce((s, t) => s + Number(t.amount), 0);
    const totalDiscounts = reservation.transactions
      .filter((t) => t.type === "DISCOUNT")
      .reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
    const totalDeposits = reservation.transactions
      .filter((t) => t.type === "DEPOSIT" && Number(t.amount) > 0)
      .reduce((s, t) => s + Number(t.amount), 0);
    const totalGross = Math.round((totalCharges - totalDiscounts - totalDeposits) * 100) / 100;
    if (totalGross <= 0) return { success: false, error: "Suma do faktury (obciążenia minus zaliczki) musi być większa od zera. Sprawdź, czy pokój ma przypisaną cenę." };

    const configResult = await getCennikConfig();
    if (!configResult.success || !configResult.data) {
      return {
        success: false,
        error: !configResult.success && "error" in configResult ? configResult.error : "Błąd odczytu VAT",
      };
    }
    const { vatPercent, pricesAreNetto } = configResult.data;
    let amountNet: number;
    let amountVat: number;
    let amountGross: number;
    if (pricesAreNetto) {
      amountNet = totalGross;
      amountVat = Math.round((amountNet * vatPercent) / 100 * 100) / 100;
      amountGross = amountNet + amountVat;
    } else {
      amountGross = totalGross;
      amountNet = Math.round((amountGross / (1 + vatPercent / 100)) * 100) / 100;
      amountVat = amountGross - amountNet;
    }

    // Generuj numer faktury z konfigurowalną numeracją
    const numberResult = await generateNextDocumentNumber("INVOICE");
    if (!numberResult.success) return { success: false, error: numberResult.error };
    const number = numberResult.data;

    const buyerCompany = reservation.company!;
    const invoice = await prisma.invoice.create({
      data: {
        reservationId,
        number,
        amountNet,
        amountVat,
        amountGross,
        vatRate: vatPercent,
        marginMode: marginMode ?? false,
        buyerNip,
        buyerName: buyerCompany.name,
        buyerAddress: buyerCompany.address ?? null,
        buyerPostalCode: buyerCompany.postalCode ?? null,
        buyerCity: buyerCompany.city ?? null,
      },
    });
    revalidatePath("/finance");
    revalidatePath("/reports");
    return {
      success: true,
      data: {
        id: invoice.id,
        number: invoice.number,
        amountNet: Number(invoice.amountNet),
        amountVat: Number(invoice.amountVat),
        amountGross: Number(invoice.amountGross),
        issuedAt: invoice.issuedAt.toISOString(),
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd wystawiania faktury VAT",
    };
  }
}

/** Lista faktur VAT dla rezerwacji. */
export async function getInvoicesForReservation(
  reservationId: string
): Promise<
  ActionResult<
    Array<{
      id: string;
      number: string;
      amountGross: number;
      issuedAt: string;
    }>
  >
> {
  try {
    const list = await prisma.invoice.findMany({
      where: { reservationId },
      orderBy: { issuedAt: "desc" },
    });
    return {
      success: true,
      data: list.map((i) => ({
        id: i.id,
        number: i.number,
        amountGross: Number(i.amountGross),
        issuedAt: i.issuedAt.toISOString(),
      })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu faktur",
    };
  }
}

/** Wystawia korektę faktury (numeracja KOR/YYYY/SEQ). */
export async function createInvoiceCorrection(
  invoiceId: string,
  amountGross: number,
  reason?: string
): Promise<ActionResult<{ id: string; number: string; amountGross: number; issuedAt: string }>> {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
    });
    if (!invoice) return { success: false, error: "Faktura nie istnieje" };

    // Generuj numer korekty z konfigurowalną numeracją
    const numberResult = await generateNextDocumentNumber("CORRECTION");
    if (!numberResult.success) return { success: false, error: numberResult.error };
    const number = numberResult.data;

    const correction = await prisma.invoiceCorrection.create({
      data: {
        invoiceId,
        number,
        amountGross,
        reason: reason ?? null,
      },
    });
    revalidatePath("/finance");
    revalidatePath("/reports");
    return {
      success: true,
      data: {
        id: correction.id,
        number: correction.number,
        amountGross: Number(correction.amountGross),
        issuedAt: correction.issuedAt.toISOString(),
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd wystawiania korekty",
    };
  }
}

/** Lista korekt dla faktury. */
export async function getInvoiceCorrections(
  invoiceId: string
): Promise<
  ActionResult<
    Array<{ id: string; number: string; amountGross: number; reason: string | null; issuedAt: string }>
  >
> {
  try {
    const list = await prisma.invoiceCorrection.findMany({
      where: { invoiceId },
      orderBy: { issuedAt: "desc" },
    });
    return {
      success: true,
      data: list.map((c) => ({
        id: c.id,
        number: c.number,
        amountGross: Number(c.amountGross),
        reason: c.reason,
        issuedAt: c.issuedAt.toISOString(),
      })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu korekt",
    };
  }
}

/**
 * Sprawdza, czy fakturę można edytować (tylko gdy ksefStatus jest null lub DRAFT).
 * Po wysłaniu do KSeF (PENDING, SENT, ACCEPTED, REJECTED, VERIFICATION) edycja jest zablokowana.
 */
export async function ensureInvoiceEditable(
  invoiceId: string
): Promise<ActionResult<void>> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { id: true, ksefStatus: true, number: true },
  });
  if (!invoice) return { success: false, error: "Faktura nie istnieje" };
  const status = invoice.ksefStatus?.toUpperCase();
  if (status && status !== "DRAFT") {
    return {
      success: false,
      error: "Faktury wysłanej do KSeF nie można edytować (status: " + (invoice.ksefStatus ?? "") + ").",
    };
  }
  return { success: true, data: undefined };
}

/**
 * Aktualizacja danych faktury (numer, nabywca, kwoty). Dozwolona tylko gdy ksefStatus jest null lub DRAFT.
 */
export async function updateInvoice(
  invoiceId: string,
  data: {
    number?: string;
    amountNet?: number;
    amountVat?: number;
    amountGross?: number;
    vatRate?: number;
    marginMode?: boolean;
    buyerNip?: string;
    buyerName?: string;
    buyerAddress?: string | null;
    buyerPostalCode?: string | null;
    buyerCity?: string | null;
    issuedAt?: Date;
  }
): Promise<ActionResult<{ id: string; number: string }>> {
  const editable = await ensureInvoiceEditable(invoiceId);
  if (!editable.success) return editable;
  try {
    const updatePayload: Record<string, unknown> = {};
    if (data.number != null) updatePayload.number = data.number;
    if (data.amountNet != null) updatePayload.amountNet = data.amountNet;
    if (data.amountVat != null) updatePayload.amountVat = data.amountVat;
    if (data.amountGross != null) updatePayload.amountGross = data.amountGross;
    if (data.vatRate != null) updatePayload.vatRate = data.vatRate;
    if (data.marginMode != null) updatePayload.marginMode = data.marginMode;
    if (data.buyerNip != null) updatePayload.buyerNip = data.buyerNip;
    if (data.buyerName != null) updatePayload.buyerName = data.buyerName;
    if (data.buyerAddress !== undefined) updatePayload.buyerAddress = data.buyerAddress;
    if (data.buyerPostalCode !== undefined) updatePayload.buyerPostalCode = data.buyerPostalCode;
    if (data.buyerCity !== undefined) updatePayload.buyerCity = data.buyerCity;
    if (data.issuedAt != null) updatePayload.issuedAt = data.issuedAt;
    if (Object.keys(updatePayload).length === 0) {
      const inv = await prisma.invoice.findUnique({ where: { id: invoiceId }, select: { id: true, number: true } });
      return inv ? { success: true, data: { id: inv.id, number: inv.number } } : { success: false, error: "Faktura nie istnieje" };
    }
    const updated = await prisma.invoice.update({
      where: { id: invoiceId },
      data: updatePayload,
    });
    revalidatePath("/finance");
    revalidatePath("/reports");
    return { success: true, data: { id: updated.id, number: updated.number } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd aktualizacji faktury",
    };
  }
}

/** Pobiera fakturę VAT do wyświetlenia/PDF (np. do druku). Zwraca też isEditable (false gdy faktura wysłana do KSeF). */
export async function getInvoiceById(
  id: string
): Promise<
  ActionResult<{
    number: string;
    amountNet: number;
    amountVat: number;
    amountGross: number;
    vatRate: number;
    buyerNip: string;
    buyerName: string;
    buyerAddress: string | null;
    buyerPostalCode: string | null;
    buyerCity: string | null;
    issuedAt: string;
    isEditable: boolean;
  }>
> {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
    });
    if (!invoice) return { success: false, error: "Faktura nie istnieje" };
    const status = invoice.ksefStatus?.toUpperCase();
    const isEditable = !status || status === "DRAFT";
    return {
      success: true,
      data: {
        number: invoice.number,
        amountNet: Number(invoice.amountNet),
        amountVat: Number(invoice.amountVat),
        amountGross: Number(invoice.amountGross),
        vatRate: Number(invoice.vatRate),
        buyerNip: invoice.buyerNip,
        buyerName: invoice.buyerName,
        buyerAddress: invoice.buyerAddress,
        buyerPostalCode: invoice.buyerPostalCode,
        buyerCity: invoice.buyerCity,
        issuedAt: invoice.issuedAt.toISOString(),
        isEditable,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu faktury",
    };
  }
}

/** Generuje link do płatności online (Payment Link) – do wysłania mailem. Integracja PayU/Przelewy24 w przygotowaniu. */
export async function createPaymentLink(
  reservationId: string,
  amount: number,
  expiresInDays?: number
): Promise<ActionResult<{ id: string; url: string; token: string; amount: number; expiresAt: string | null }>> {
  if (amount <= 0) return { success: false, error: "Kwota musi być większa od zera" };
  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
    });
    if (!reservation) return { success: false, error: "Rezerwacja nie istnieje" };

    const { randomBytes } = await import("crypto");
    const token = randomBytes(12).toString("base64url");
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const link = await prisma.paymentLink.create({
      data: {
        reservationId,
        token,
        amount,
        status: "PENDING",
        expiresAt,
      },
    });
    revalidatePath("/finance");
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL ?? "";
    const url = baseUrl ? `${baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`}/pay/${token}` : `/pay/${token}`;
    return {
      success: true,
      data: {
        id: link.id,
        url,
        token: link.token,
        amount: Number(link.amount),
        expiresAt: link.expiresAt?.toISOString() ?? null,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd generowania linku do płatności",
    };
  }
}

/** Pobiera dane linku płatności po tokenie (dla strony /pay/[token]). */
export async function getPaymentLinkByToken(
  token: string
): Promise<ActionResult<{ id: string; amount: number; status: string; reservationId: string }>> {
  try {
    const link = await prisma.paymentLink.findUnique({
      where: { token },
    });
    if (!link) return { success: false, error: "Link nie istnieje lub wygasł" };
    if (link.status !== "PENDING") return { success: false, error: "Link został już wykorzystany" };
    if (link.expiresAt && new Date() > link.expiresAt) {
      return { success: false, error: "Link wygasł" };
    }
    return {
      success: true,
      data: {
        id: link.id,
        amount: Number(link.amount),
        status: link.status,
        reservationId: link.reservationId,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu linku",
    };
  }
}

/**
 * Automatyczne księgowanie wpłaty z bramki (PayU / Przelewy24 / Stripe).
 * Wywoływane z webhooka bramki lub z symulacji: tworzy transakcję DEPOSIT i ustawia PaymentLink na PAID.
 */
export async function registerPaymentFromLink(
  token: string,
  amount: number,
  provider?: string
): Promise<ActionResult<{ transactionId: string }>> {
  if (amount <= 0) return { success: false, error: "Kwota musi być większa od zera" };
  try {
    const link = await prisma.paymentLink.findUnique({
      where: { token },
    });
    if (!link) return { success: false, error: "Link nie istnieje" };
    if (link.status !== "PENDING") return { success: false, error: "Płatność już zarejestrowana" };
    if (link.expiresAt && new Date() > link.expiresAt) {
      return { success: false, error: "Link wygasł" };
    }
    const expectedAmount = Number(link.amount);
    if (Math.abs(amount - expectedAmount) > 0.01) {
      return { success: false, error: `Kwota niezgodna (oczekiwano ${expectedAmount.toFixed(2)} PLN)` };
    }
    const tx = await prisma.transaction.create({
      data: {
        reservationId: link.reservationId,
        amount,
        type: "DEPOSIT",
        isReadOnly: false,
      },
    });
    await prisma.paymentLink.update({
      where: { id: link.id },
      data: { status: "PAID" },
    });
    revalidatePath("/finance");
    revalidatePath("/reports");
    await updateReservationPaymentStatus(link.reservationId).catch((err) =>
      console.error("[updateReservationPaymentStatus]", err)
    );
    if (process.env.NODE_ENV === "development" && provider) {
      console.log("[PAYMENT] Wpłata zarejestrowana:", { transactionId: tx.id, amount });
    }
    return { success: true, data: { transactionId: tx.id } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd rejestracji wpłaty",
    };
  }
}

/** Lista preautoryzacji dla rezerwacji. */
export async function getCardPreauthsForReservation(
  reservationId: string
): Promise<
  ActionResult<Array<{ id: string; amount: number; status: string; createdAt: string }>>
> {
  try {
    const list = await prisma.cardPreauth.findMany({
      where: { reservationId },
      orderBy: { createdAt: "desc" },
    });
    return {
      success: true,
      data: list.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        status: p.status,
        createdAt: p.createdAt.toISOString(),
      })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu preautoryzacji",
    };
  }
}

/** Preautoryzacja karty: blokada środków na poczet rezerwacji (np. zniszczenia). */
export async function createCardPreauth(
  reservationId: string,
  amount: number,
  expiresInDays?: number
): Promise<ActionResult<{ id: string; amount: number; status: string }>> {
  if (amount <= 0) return { success: false, error: "Kwota musi być większa od zera" };
  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
    });
    if (!reservation) return { success: false, error: "Rezerwacja nie istnieje" };
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;
    const preauth = await prisma.cardPreauth.create({
      data: {
        reservationId,
        amount,
        status: "HOLD",
        expiresAt,
      },
    });
    revalidatePath("/finance");
    return {
      success: true,
      data: {
        id: preauth.id,
        amount: Number(preauth.amount),
        status: preauth.status,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd preautoryzacji",
    };
  }
}

/** Pobranie zablokowanych środków (finalizacja płatności). */
export async function captureCardPreauth(preauthId: string): Promise<ActionResult<{ transactionId: string }>> {
  try {
    const preauth = await prisma.cardPreauth.findUnique({
      where: { id: preauthId },
    });
    if (!preauth) return { success: false, error: "Preautoryzacja nie istnieje" };
    if (preauth.status !== "HOLD") return { success: false, error: "Blokada już wykorzystana lub zwolniona" };
    const tx = await prisma.transaction.create({
      data: {
        reservationId: preauth.reservationId,
        amount: preauth.amount,
        type: "DEPOSIT",
        isReadOnly: false,
      },
    });
    await prisma.cardPreauth.update({
      where: { id: preauthId },
      data: { status: "CAPTURED" },
    });
    revalidatePath("/finance");
    await updateReservationPaymentStatus(preauth.reservationId).catch((err) =>
      console.error("[updateReservationPaymentStatus]", err)
    );
    return { success: true, data: { transactionId: tx.id } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobrania środków",
    };
  }
}

/** Zwolnienie blokady (anulowanie preautoryzacji). */
export async function releaseCardPreauth(preauthId: string): Promise<ActionResult> {
  try {
    const preauth = await prisma.cardPreauth.findUnique({
      where: { id: preauthId },
    });
    if (!preauth) return { success: false, error: "Preautoryzacja nie istnieje" };
    if (preauth.status !== "HOLD") return { success: false, error: "Blokada już wykorzystana lub zwolniona" };
    await prisma.cardPreauth.update({
      where: { id: preauthId },
      data: { status: "RELEASED" },
    });
    revalidatePath("/finance");
    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd zwolnienia blokady",
    };
  }
}

// ============================================
// RACHUNKI (NIE-VAT) - dla podmiotów zwolnionych z VAT
// ============================================

/** Interfejs pozycji rachunku */
export interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

/** Interfejs danych rachunku do wyświetlenia */
export interface ReceiptData {
  id: string;
  number: string;
  amount: number;
  items: ReceiptItem[];
  buyerName: string;
  buyerAddress: string | null;
  buyerPostalCode: string | null;
  buyerCity: string | null;
  buyerNip: string | null;
  sellerName: string;
  sellerAddress: string | null;
  sellerPostalCode: string | null;
  sellerCity: string | null;
  sellerNip: string | null;
  vatExemptionBasis: string | null;
  paymentMethod: string | null;
  paymentDueDate: string | null;
  isPaid: boolean;
  paidAt: string | null;
  serviceDate: string | null;
  issuedAt: string;
  notes: string | null;
  reservationId: string;
}

/** Interfejs danych do tworzenia rachunku */
export interface CreateReceiptInput {
  reservationId: string;
  items?: ReceiptItem[];
  buyerName: string;
  buyerAddress?: string;
  buyerPostalCode?: string;
  buyerCity?: string;
  buyerNip?: string;
  sellerName?: string;
  sellerAddress?: string;
  sellerPostalCode?: string;
  sellerCity?: string;
  sellerNip?: string;
  vatExemptionBasis?: string;
  paymentMethod?: string;
  paymentDueDays?: number;
  serviceDate?: string;
  notes?: string;
}

/**
 * Wystawia rachunek (nie-VAT) dla rezerwacji.
 * Rachunek jest dokumentem dla podmiotów zwolnionych z VAT (art. 106b ust. 2 ustawy o VAT).
 * Numeracja: R/YYYY/SEQ
 */
export async function createReceipt(
  input: CreateReceiptInput
): Promise<ActionResult<{ id: string; number: string; amount: number }>> {
  const headersList = await headers();
  const ip = getClientIp(headersList);

  // Walidacja danych wejściowych
  if (!input.reservationId || !input.reservationId.trim()) {
    return { success: false, error: "Brak ID rezerwacji" };
  }
  if (!input.buyerName || !input.buyerName.trim()) {
    return { success: false, error: "Nazwa nabywcy jest wymagana" };
  }

  try {
    // Pobierz rezerwację z transakcjami i danymi pokoju/property
    const reservation = await prisma.reservation.findUnique({
      where: { id: input.reservationId },
      include: {
        transactions: true,
        guest: true,
        company: true,
        room: {
          include: { property: true },
        },
      },
    });
    if (!reservation) {
      return { success: false, error: "Rezerwacja nie istnieje" };
    }

    // Oblicz kwotę na podstawie transakcji lub przekazanych pozycji
    let items: ReceiptItem[] = [];
    let totalAmount = 0;

    if (input.items && input.items.length > 0) {
      // Użyj przekazanych pozycji
      items = input.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.quantity * item.unitPrice,
      }));
      totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
    } else {
      // Generuj pozycje z transakcji rezerwacji
      const txTypes: Record<string, string> = {
        ROOM: "Usługa noclegowa",
        DEPOSIT: "Zaliczka",
        LOCAL_TAX: "Opłata miejscowa",
        MINIBAR: "Minibar",
        SPA: "Usługa SPA",
        GASTRONOMY: "Usługa gastronomiczna",
        RENTAL: "Wypożyczenie",
        PARKING: "Parking",
      };
      
      if (reservation.transactions.length === 0) {
        return { success: false, error: "Brak transakcji do wystawienia rachunku. Najpierw zarejestruj płatność." };
      }

      items = reservation.transactions.map((tx) => ({
        name: txTypes[tx.type] || tx.type,
        quantity: 1,
        unitPrice: Number(tx.amount),
        amount: Number(tx.amount),
      }));
      totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
    }

    if (totalAmount <= 0) {
      return { success: false, error: "Kwota rachunku musi być większa od zera" };
    }

    // Dane sprzedawcy (z Property lub domyślne)
    const property = reservation.room?.property;
    const sellerName = input.sellerName || property?.name || "Hotel";
    const sellerAddress = input.sellerAddress || null;
    const sellerPostalCode = input.sellerPostalCode || null;
    const sellerCity = input.sellerCity || null;
    const sellerNip = input.sellerNip || null;

    // Podstawa zwolnienia (domyślnie podmiotowe dla małych firm)
    const vatExemptionBasis = input.vatExemptionBasis || "Zwolniony podmiotowo z VAT na podstawie art. 113 ust. 1 ustawy o VAT";

    // Generuj numer rachunku z konfigurowalną numeracją
    const numberResult = await generateNextDocumentNumber("RECEIPT");
    if (!numberResult.success) return { success: false, error: numberResult.error };
    const number = numberResult.data;

    // Oblicz termin płatności
    let paymentDueDate: Date | null = null;
    if (input.paymentDueDays && input.paymentDueDays > 0) {
      paymentDueDate = new Date();
      paymentDueDate.setDate(paymentDueDate.getDate() + input.paymentDueDays);
    }

    // Data usługi (domyślnie data check-in)
    let serviceDate: Date | null = null;
    if (input.serviceDate) {
      serviceDate = new Date(input.serviceDate);
      if (isNaN(serviceDate.getTime())) {
        return { success: false, error: "Nieprawidłowa data usługi" };
      }
    } else {
      serviceDate = new Date(reservation.checkIn);
    }

    // Utwórz rachunek
    const receipt = await prisma.receipt.create({
      data: {
        reservationId: input.reservationId,
        number,
        amount: totalAmount,
        items: JSON.parse(JSON.stringify(items)),
        buyerName: input.buyerName.trim(),
        buyerAddress: input.buyerAddress?.trim() || null,
        buyerPostalCode: input.buyerPostalCode?.trim() || null,
        buyerCity: input.buyerCity?.trim() || null,
        buyerNip: input.buyerNip?.trim() || null,
        sellerName,
        sellerAddress,
        sellerPostalCode,
        sellerCity,
        sellerNip,
        vatExemptionBasis,
        paymentMethod: input.paymentMethod || null,
        paymentDueDate,
        isPaid: false,
        serviceDate,
        notes: input.notes?.trim() || null,
      },
    });

    // Audit log
    await createAuditLog({
      actionType: "CREATE",
      entityType: "Receipt",
      entityId: receipt.id,
      newValue: {
        number: receipt.number,
        amount: totalAmount,
        buyerName: receipt.buyerName,
        reservationId: input.reservationId,
      } as unknown as Record<string, unknown>,
      ipAddress: ip,
    });

    revalidatePath("/finance");
    revalidatePath("/reports");

    return {
      success: true,
      data: {
        id: receipt.id,
        number: receipt.number,
        amount: totalAmount,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd wystawiania rachunku",
    };
  }
}

/** Pobiera listę rachunków dla rezerwacji. */
export async function getReceiptsForReservation(
  reservationId: string
): Promise<ActionResult<Array<{ id: string; number: string; amount: number; issuedAt: string; isPaid: boolean }>>> {
  try {
    const list = await prisma.receipt.findMany({
      where: { reservationId },
      orderBy: { issuedAt: "desc" },
    });
    return {
      success: true,
      data: list.map((r) => ({
        id: r.id,
        number: r.number,
        amount: Number(r.amount),
        issuedAt: r.issuedAt.toISOString(),
        isPaid: r.isPaid,
      })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu rachunków",
    };
  }
}

/** Pobiera rachunek po ID (do wyświetlenia/PDF). */
export async function getReceiptById(id: string): Promise<ActionResult<ReceiptData>> {
  try {
    const receipt = await prisma.receipt.findUnique({
      where: { id },
    });
    if (!receipt) {
      return { success: false, error: "Rachunek nie istnieje" };
    }

    // Parsuj pozycje z JSON
    let items: ReceiptItem[] = [];
    if (receipt.items) {
      try {
        items = receipt.items as unknown as ReceiptItem[];
      } catch {
        items = [];
      }
    }

    return {
      success: true,
      data: {
        id: receipt.id,
        number: receipt.number,
        amount: Number(receipt.amount),
        items,
        buyerName: receipt.buyerName,
        buyerAddress: receipt.buyerAddress,
        buyerPostalCode: receipt.buyerPostalCode,
        buyerCity: receipt.buyerCity,
        buyerNip: receipt.buyerNip,
        sellerName: receipt.sellerName,
        sellerAddress: receipt.sellerAddress,
        sellerPostalCode: receipt.sellerPostalCode,
        sellerCity: receipt.sellerCity,
        sellerNip: receipt.sellerNip,
        vatExemptionBasis: receipt.vatExemptionBasis,
        paymentMethod: receipt.paymentMethod,
        paymentDueDate: receipt.paymentDueDate?.toISOString().slice(0, 10) || null,
        isPaid: receipt.isPaid,
        paidAt: receipt.paidAt?.toISOString() || null,
        serviceDate: receipt.serviceDate?.toISOString().slice(0, 10) || null,
        issuedAt: receipt.issuedAt.toISOString(),
        notes: receipt.notes,
        reservationId: receipt.reservationId,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu rachunku",
    };
  }
}

/** Pobiera ostatnie rachunki (do strony Finanse). */
export async function getRecentReceipts(
  limit: number = 20
): Promise<ActionResult<Array<{
  id: string;
  number: string;
  amount: number;
  buyerName: string;
  issuedAt: string;
  isPaid: boolean;
  reservationId: string;
}>>> {
  try {
    const list = await prisma.receipt.findMany({
      orderBy: { issuedAt: "desc" },
      take: limit,
    });
    return {
      success: true,
      data: list.map((r) => ({
        id: r.id,
        number: r.number,
        amount: Number(r.amount),
        buyerName: r.buyerName,
        issuedAt: r.issuedAt.toISOString(),
        isPaid: r.isPaid,
        reservationId: r.reservationId,
      })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu rachunków",
    };
  }
}

/** Oznacza rachunek jako opłacony. */
export async function markReceiptAsPaid(
  receiptId: string
): Promise<ActionResult<{ id: string; paidAt: string }>> {
  const headersList = await headers();
  const ip = getClientIp(headersList);

  try {
    const receipt = await prisma.receipt.findUnique({
      where: { id: receiptId },
    });
    if (!receipt) {
      return { success: false, error: "Rachunek nie istnieje" };
    }
    if (receipt.isPaid) {
      return { success: false, error: "Rachunek jest już oznaczony jako opłacony" };
    }

    const paidAt = new Date();
    await prisma.receipt.update({
      where: { id: receiptId },
      data: { isPaid: true, paidAt },
    });

    await createAuditLog({
      actionType: "UPDATE",
      entityType: "Receipt",
      entityId: receiptId,
      oldValue: { isPaid: false } as unknown as Record<string, unknown>,
      newValue: { isPaid: true, paidAt: paidAt.toISOString() } as unknown as Record<string, unknown>,
      ipAddress: ip,
    });

    revalidatePath("/finance");
    return {
      success: true,
      data: { id: receiptId, paidAt: paidAt.toISOString() },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd oznaczania rachunku jako opłacony",
    };
  }
}

/** Oznacza rachunek jako nieopłacony (cofnięcie statusu). */
export async function markReceiptAsUnpaid(
  receiptId: string
): Promise<ActionResult> {
  const headersList = await headers();
  const ip = getClientIp(headersList);

  try {
    const receipt = await prisma.receipt.findUnique({
      where: { id: receiptId },
    });
    if (!receipt) {
      return { success: false, error: "Rachunek nie istnieje" };
    }
    if (!receipt.isPaid) {
      return { success: false, error: "Rachunek nie jest oznaczony jako opłacony" };
    }

    await prisma.receipt.update({
      where: { id: receiptId },
      data: { isPaid: false, paidAt: null },
    });

    await createAuditLog({
      actionType: "UPDATE",
      entityType: "Receipt",
      entityId: receiptId,
      oldValue: { isPaid: true, paidAt: receipt.paidAt?.toISOString() } as unknown as Record<string, unknown>,
      newValue: { isPaid: false, paidAt: null } as unknown as Record<string, unknown>,
      ipAddress: ip,
    });

    revalidatePath("/finance");
    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd cofania statusu płatności",
    };
  }
}

/** Usuwa rachunek (wymaga PIN managera). */
export async function deleteReceipt(
  receiptId: string,
  managerPin: string
): Promise<ActionResult> {
  const pinResult = await verifyManagerPin(managerPin);
  if (!pinResult.success) {
    return pinResult;
  }

  const headersList = await headers();
  const ip = getClientIp(headersList);

  try {
    const receipt = await prisma.receipt.findUnique({
      where: { id: receiptId },
    });
    if (!receipt) {
      return { success: false, error: "Rachunek nie istnieje" };
    }

    // Nie pozwól usunąć opłaconego rachunku bez wyraźnego potwierdzenia
    if (receipt.isPaid) {
      return { success: false, error: "Nie można usunąć opłaconego rachunku. Najpierw cofnij status płatności." };
    }

    await prisma.receipt.delete({ where: { id: receiptId } });

    await createAuditLog({
      actionType: "DELETE",
      entityType: "Receipt",
      entityId: receiptId,
      oldValue: {
        number: receipt.number,
        amount: receipt.amount.toString(),
        buyerName: receipt.buyerName,
      } as unknown as Record<string, unknown>,
      newValue: null,
      ipAddress: ip,
    });

    revalidatePath("/finance");
    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd usuwania rachunku",
    };
  }
}

// ============================================
// NOTY KSIĘGOWE (DEBIT/CREDIT NOTES)
// ============================================

/** Typy not księgowych */
export type AccountingNoteType = "DEBIT" | "CREDIT";

/** Kategorie not księgowych */
export type AccountingNoteCategory = "DAMAGES" | "PENALTY" | "INTEREST" | "DISCOUNT" | "COMPENSATION" | "OTHER";

/** Status noty księgowej */
export type AccountingNoteStatus = "ISSUED" | "PAID" | "CANCELLED" | "DISPUTED";

/** Interfejs danych noty do wyświetlenia */
export interface AccountingNoteData {
  id: string;
  number: string;
  type: AccountingNoteType;
  amount: number;
  title: string;
  description: string | null;
  category: string | null;
  issuerName: string;
  issuerAddress: string | null;
  issuerPostalCode: string | null;
  issuerCity: string | null;
  issuerNip: string | null;
  recipientName: string;
  recipientAddress: string | null;
  recipientPostalCode: string | null;
  recipientCity: string | null;
  recipientNip: string | null;
  currency: string;
  referenceDocument: string | null;
  referenceDate: string | null;
  dueDate: string | null;
  status: string;
  paidAt: string | null;
  issuedAt: string;
  reservationId: string | null;
  companyId: string | null;
  internalNotes: string | null;
}

/** Interfejs do tworzenia noty księgowej */
export interface CreateAccountingNoteInput {
  type: AccountingNoteType;
  amount: number;
  title: string;
  description?: string;
  category?: AccountingNoteCategory;
  recipientName: string;
  recipientAddress?: string;
  recipientPostalCode?: string;
  recipientCity?: string;
  recipientNip?: string;
  issuerName?: string;
  issuerAddress?: string;
  issuerPostalCode?: string;
  issuerCity?: string;
  issuerNip?: string;
  referenceDocument?: string;
  referenceDate?: string;
  dueDate?: string;
  reservationId?: string;
  companyId?: string;
  internalNotes?: string;
}

/**
 * Tworzy notę księgową (obciążeniową lub uznaniową).
 * Numeracja: NK/YYYY/SEQ (NK = Nota Księgowa)
 */
export async function createAccountingNote(
  input: CreateAccountingNoteInput
): Promise<ActionResult<{ id: string; number: string; amount: number; type: AccountingNoteType }>> {
  const headersList = await headers();
  const ip = getClientIp(headersList);

  // Walidacja danych wejściowych
  if (!input.type || !["DEBIT", "CREDIT"].includes(input.type)) {
    return { success: false, error: "Nieprawidłowy typ noty (DEBIT/CREDIT)" };
  }
  if (!input.amount || input.amount <= 0) {
    return { success: false, error: "Kwota musi być większa od zera" };
  }
  if (!input.title?.trim()) {
    return { success: false, error: "Tytuł noty jest wymagany" };
  }
  if (!input.recipientName?.trim()) {
    return { success: false, error: "Nazwa odbiorcy jest wymagana" };
  }

  try {
    // Jeśli podano reservationId, sprawdź czy istnieje
    if (input.reservationId) {
      const reservation = await prisma.reservation.findUnique({
        where: { id: input.reservationId },
      });
      if (!reservation) {
        return { success: false, error: "Rezerwacja nie istnieje" };
      }
    }

    // Jeśli podano companyId, sprawdź czy istnieje
    if (input.companyId) {
      const company = await prisma.company.findUnique({
        where: { id: input.companyId },
      });
      if (!company) {
        return { success: false, error: "Firma nie istnieje" };
      }
    }

    // Generuj numer noty z konfigurowalną numeracją
    const numberResult = await generateNextDocumentNumber("ACCOUNTING_NOTE");
    if (!numberResult.success) return { success: false, error: numberResult.error };
    const number = numberResult.data;

    // Parsuj datę referencyjną
    let referenceDate: Date | null = null;
    if (input.referenceDate) {
      referenceDate = new Date(input.referenceDate);
      if (isNaN(referenceDate.getTime())) {
        return { success: false, error: "Nieprawidłowa data referencji" };
      }
    }

    // Parsuj termin płatności
    let dueDate: Date | null = null;
    if (input.dueDate) {
      dueDate = new Date(input.dueDate);
      if (isNaN(dueDate.getTime())) {
        return { success: false, error: "Nieprawidłowy termin płatności" };
      }
    }

    // Dane wystawcy (domyślne jeśli nie podane)
    const issuerName = input.issuerName?.trim() || process.env.HOTEL_NAME || "Hotel";

    // Utwórz notę
    const note = await prisma.accountingNote.create({
      data: {
        number,
        type: input.type,
        amount: input.amount,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        category: input.category || null,
        issuerName,
        issuerAddress: input.issuerAddress?.trim() || null,
        issuerPostalCode: input.issuerPostalCode?.trim() || null,
        issuerCity: input.issuerCity?.trim() || null,
        issuerNip: input.issuerNip?.trim() || null,
        recipientName: input.recipientName.trim(),
        recipientAddress: input.recipientAddress?.trim() || null,
        recipientPostalCode: input.recipientPostalCode?.trim() || null,
        recipientCity: input.recipientCity?.trim() || null,
        recipientNip: input.recipientNip?.trim() || null,
        referenceDocument: input.referenceDocument?.trim() || null,
        referenceDate,
        dueDate,
        reservationId: input.reservationId || null,
        companyId: input.companyId || null,
        internalNotes: input.internalNotes?.trim() || null,
        status: "ISSUED",
      },
    });

    // Audit log
    await createAuditLog({
      actionType: "CREATE",
      entityType: "AccountingNote",
      entityId: note.id,
      newValue: {
        number: note.number,
        type: note.type,
        amount: input.amount,
        title: note.title,
        recipientName: note.recipientName,
      } as unknown as Record<string, unknown>,
      ipAddress: ip,
    });

    revalidatePath("/finance");
    return {
      success: true,
      data: {
        id: note.id,
        number: note.number,
        amount: input.amount,
        type: input.type,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd tworzenia noty księgowej",
    };
  }
}

/** Pobiera notę księgową po ID. */
export async function getAccountingNoteById(id: string): Promise<ActionResult<AccountingNoteData>> {
  try {
    const note = await prisma.accountingNote.findUnique({
      where: { id },
    });
    if (!note) {
      return { success: false, error: "Nota księgowa nie istnieje" };
    }

    return {
      success: true,
      data: {
        id: note.id,
        number: note.number,
        type: note.type as AccountingNoteType,
        amount: Number(note.amount),
        title: note.title,
        description: note.description,
        category: note.category,
        issuerName: note.issuerName,
        issuerAddress: note.issuerAddress,
        issuerPostalCode: note.issuerPostalCode,
        issuerCity: note.issuerCity,
        issuerNip: note.issuerNip,
        recipientName: note.recipientName,
        recipientAddress: note.recipientAddress,
        recipientPostalCode: note.recipientPostalCode,
        recipientCity: note.recipientCity,
        recipientNip: note.recipientNip,
        currency: note.currency,
        referenceDocument: note.referenceDocument,
        referenceDate: note.referenceDate?.toISOString().slice(0, 10) || null,
        dueDate: note.dueDate?.toISOString().slice(0, 10) || null,
        status: note.status,
        paidAt: note.paidAt?.toISOString() || null,
        issuedAt: note.issuedAt.toISOString(),
        reservationId: note.reservationId,
        companyId: note.companyId,
        internalNotes: note.internalNotes,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu noty księgowej",
    };
  }
}

/** Pobiera listę ostatnich not księgowych. */
export async function getRecentAccountingNotes(
  limit: number = 20
): Promise<ActionResult<Array<{
  id: string;
  number: string;
  type: string;
  amount: number;
  title: string;
  recipientName: string;
  status: string;
  issuedAt: string;
}>>> {
  try {
    const list = await prisma.accountingNote.findMany({
      orderBy: { issuedAt: "desc" },
      take: limit,
    });
    return {
      success: true,
      data: list.map((n) => ({
        id: n.id,
        number: n.number,
        type: n.type,
        amount: Number(n.amount),
        title: n.title,
        recipientName: n.recipientName,
        status: n.status,
        issuedAt: n.issuedAt.toISOString(),
      })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu not księgowych",
    };
  }
}

/** Oznacza notę księgową jako opłaconą. */
export async function markAccountingNoteAsPaid(noteId: string): Promise<ActionResult<{ paidAt: string }>> {
  const headersList = await headers();
  const ip = getClientIp(headersList);

  try {
    const note = await prisma.accountingNote.findUnique({
      where: { id: noteId },
    });
    if (!note) {
      return { success: false, error: "Nota księgowa nie istnieje" };
    }
    if (note.status === "PAID") {
      return { success: false, error: "Nota jest już oznaczona jako opłacona" };
    }
    if (note.status === "CANCELLED") {
      return { success: false, error: "Nie można oznaczyć anulowanej noty jako opłaconej" };
    }

    const paidAt = new Date();
    await prisma.accountingNote.update({
      where: { id: noteId },
      data: { status: "PAID", paidAt },
    });

    await createAuditLog({
      actionType: "UPDATE",
      entityType: "AccountingNote",
      entityId: noteId,
      oldValue: { status: note.status } as unknown as Record<string, unknown>,
      newValue: { status: "PAID", paidAt: paidAt.toISOString() } as unknown as Record<string, unknown>,
      ipAddress: ip,
    });

    revalidatePath("/finance");
    return { success: true, data: { paidAt: paidAt.toISOString() } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd oznaczania noty jako opłaconej",
    };
  }
}

/** Anuluje notę księgową. */
export async function cancelAccountingNote(
  noteId: string,
  reason?: string
): Promise<ActionResult> {
  const headersList = await headers();
  const ip = getClientIp(headersList);

  try {
    const note = await prisma.accountingNote.findUnique({
      where: { id: noteId },
    });
    if (!note) {
      return { success: false, error: "Nota księgowa nie istnieje" };
    }
    if (note.status === "CANCELLED") {
      return { success: false, error: "Nota jest już anulowana" };
    }
    if (note.status === "PAID") {
      return { success: false, error: "Nie można anulować opłaconej noty" };
    }

    const cancelledAt = new Date();
    await prisma.accountingNote.update({
      where: { id: noteId },
      data: {
        status: "CANCELLED",
        cancelledAt,
        cancelledReason: reason?.trim() || null,
      },
    });

    await createAuditLog({
      actionType: "UPDATE",
      entityType: "AccountingNote",
      entityId: noteId,
      oldValue: { status: note.status } as unknown as Record<string, unknown>,
      newValue: { status: "CANCELLED", cancelledAt: cancelledAt.toISOString(), reason } as unknown as Record<string, unknown>,
      ipAddress: ip,
    });

    revalidatePath("/finance");
    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd anulowania noty",
    };
  }
}

/** Pobiera noty księgowe dla rezerwacji. */
export async function getAccountingNotesForReservation(
  reservationId: string
): Promise<ActionResult<Array<{ id: string; number: string; type: string; amount: number; title: string; status: string; issuedAt: string }>>> {
  try {
    const list = await prisma.accountingNote.findMany({
      where: { reservationId },
      orderBy: { issuedAt: "desc" },
    });
    return {
      success: true,
      data: list.map((n) => ({
        id: n.id,
        number: n.number,
        type: n.type,
        amount: Number(n.amount),
        title: n.title,
        status: n.status,
        issuedAt: n.issuedAt.toISOString(),
      })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu not księgowych",
    };
  }
}

// ============================================================
// INVOICE TEMPLATE CONFIGURATION
// ============================================================

export interface InvoiceTemplateData {
  id: string;
  templateType: string;
  logoBase64: string | null;
  logoUrl: string | null;
  logoWidth: number;
  logoPosition: string;
  sellerName: string | null;
  sellerAddress: string | null;
  sellerPostalCode: string | null;
  sellerCity: string | null;
  sellerNip: string | null;
  sellerPhone: string | null;
  sellerEmail: string | null;
  sellerWebsite: string | null;
  sellerBankName: string | null;
  sellerBankAccount: string | null;
  headerText: string | null;
  footerText: string | null;
  paperSize: string;
  fontSize: number;
  fontFamily: string;
  primaryColor: string;
  accentColor: string;
  paymentTermsText: string | null;
  thanksText: string | null;
}

/**
 * Pobiera szablon faktury (tworzy domyślny jeśli nie istnieje).
 */
export async function getInvoiceTemplate(
  templateType: string = "DEFAULT"
): Promise<ActionResult<InvoiceTemplateData>> {
  try {
    let template = await prisma.invoiceTemplate.findUnique({
      where: { templateType },
    });

    // Jeśli brak szablonu, utwórz domyślny
    if (!template) {
      const hotelName = process.env.HOTEL_NAME ?? "Hotel";
      template = await prisma.invoiceTemplate.create({
        data: {
          templateType,
          sellerName: hotelName,
          footerText: "Dziękujemy za skorzystanie z naszych usług.",
          thanksText: "Zapraszamy ponownie!",
        },
      });
    }

    return {
      success: true,
      data: {
        id: template.id,
        templateType: template.templateType,
        logoBase64: template.logoBase64,
        logoUrl: template.logoUrl,
        logoWidth: template.logoWidth,
        logoPosition: template.logoPosition,
        sellerName: template.sellerName,
        sellerAddress: template.sellerAddress,
        sellerPostalCode: template.sellerPostalCode,
        sellerCity: template.sellerCity,
        sellerNip: template.sellerNip,
        sellerPhone: template.sellerPhone,
        sellerEmail: template.sellerEmail,
        sellerWebsite: template.sellerWebsite,
        sellerBankName: template.sellerBankName,
        sellerBankAccount: template.sellerBankAccount,
        headerText: template.headerText,
        footerText: template.footerText,
        paperSize: template.paperSize,
        fontSize: template.fontSize,
        fontFamily: template.fontFamily,
        primaryColor: template.primaryColor,
        accentColor: template.accentColor,
        paymentTermsText: template.paymentTermsText,
        thanksText: template.thanksText,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu szablonu faktury",
    };
  }
}

/**
 * Aktualizuje szablon faktury.
 */
export async function updateInvoiceTemplate(
  templateType: string,
  data: Partial<Omit<InvoiceTemplateData, "id" | "templateType">>
): Promise<ActionResult<InvoiceTemplateData>> {
  try {
    // Upewnij się, że szablon istnieje
    let template = await prisma.invoiceTemplate.findUnique({
      where: { templateType },
    });

    if (!template) {
      template = await prisma.invoiceTemplate.create({
        data: { templateType },
      });
    }

    // Przygotuj dane do aktualizacji (tylko pola które zostały podane)
    const updateData: Record<string, unknown> = {};
    
    if (data.logoBase64 !== undefined) updateData.logoBase64 = data.logoBase64;
    if (data.logoUrl !== undefined) updateData.logoUrl = data.logoUrl;
    if (data.logoWidth !== undefined) updateData.logoWidth = data.logoWidth;
    if (data.logoPosition !== undefined) updateData.logoPosition = data.logoPosition;
    if (data.sellerName !== undefined) updateData.sellerName = data.sellerName;
    if (data.sellerAddress !== undefined) updateData.sellerAddress = data.sellerAddress;
    if (data.sellerPostalCode !== undefined) updateData.sellerPostalCode = data.sellerPostalCode;
    if (data.sellerCity !== undefined) updateData.sellerCity = data.sellerCity;
    if (data.sellerNip !== undefined) updateData.sellerNip = data.sellerNip;
    if (data.sellerPhone !== undefined) updateData.sellerPhone = data.sellerPhone;
    if (data.sellerEmail !== undefined) updateData.sellerEmail = data.sellerEmail;
    if (data.sellerWebsite !== undefined) updateData.sellerWebsite = data.sellerWebsite;
    if (data.sellerBankName !== undefined) updateData.sellerBankName = data.sellerBankName;
    if (data.sellerBankAccount !== undefined) updateData.sellerBankAccount = data.sellerBankAccount;
    if (data.headerText !== undefined) updateData.headerText = data.headerText;
    if (data.footerText !== undefined) updateData.footerText = data.footerText;
    if (data.paperSize !== undefined) updateData.paperSize = data.paperSize;
    if (data.fontSize !== undefined) updateData.fontSize = data.fontSize;
    if (data.fontFamily !== undefined) updateData.fontFamily = data.fontFamily;
    if (data.primaryColor !== undefined) updateData.primaryColor = data.primaryColor;
    if (data.accentColor !== undefined) updateData.accentColor = data.accentColor;
    if (data.paymentTermsText !== undefined) updateData.paymentTermsText = data.paymentTermsText;
    if (data.thanksText !== undefined) updateData.thanksText = data.thanksText;

    const updated = await prisma.invoiceTemplate.update({
      where: { id: template.id },
      data: updateData,
    });

    revalidatePath("/finance");
    revalidatePath("/ustawienia");
    autoExportConfigSnapshot();

    return {
      success: true,
      data: {
        id: updated.id,
        templateType: updated.templateType,
        logoBase64: updated.logoBase64,
        logoUrl: updated.logoUrl,
        logoWidth: updated.logoWidth,
        logoPosition: updated.logoPosition,
        sellerName: updated.sellerName,
        sellerAddress: updated.sellerAddress,
        sellerPostalCode: updated.sellerPostalCode,
        sellerCity: updated.sellerCity,
        sellerNip: updated.sellerNip,
        sellerPhone: updated.sellerPhone,
        sellerEmail: updated.sellerEmail,
        sellerWebsite: updated.sellerWebsite,
        sellerBankName: updated.sellerBankName,
        sellerBankAccount: updated.sellerBankAccount,
        headerText: updated.headerText,
        footerText: updated.footerText,
        paperSize: updated.paperSize,
        fontSize: updated.fontSize,
        fontFamily: updated.fontFamily,
        primaryColor: updated.primaryColor,
        accentColor: updated.accentColor,
        paymentTermsText: updated.paymentTermsText,
        thanksText: updated.thanksText,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd aktualizacji szablonu faktury",
    };
  }
}

/**
 * Usuwa logo z szablonu.
 */
export async function removeInvoiceLogo(
  templateType: string = "DEFAULT"
): Promise<ActionResult<void>> {
  try {
    await prisma.invoiceTemplate.updateMany({
      where: { templateType },
      data: {
        logoBase64: null,
        logoUrl: null,
      },
    });

    revalidatePath("/finance");
    revalidatePath("/ustawienia");
    autoExportConfigSnapshot();

    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd usuwania logo",
    };
  }
}

// ============================================================
// FISCAL RECEIPT TEMPLATE CONFIGURATION
// ============================================================

export interface FiscalReceiptTemplateData {
  id: string;
  headerLine1: string | null;
  headerLine2: string | null;
  headerLine3: string | null;
  footerLine1: string | null;
  footerLine2: string | null;
  footerLine3: string | null;
  itemNameRoom: string;
  itemNameDeposit: string;
  itemNameMinibar: string;
  itemNameService: string;
  itemNameLocalTax: string;
  itemNameParking: string;
  defaultVatRate: number;
  includeRoomNumber: boolean;
  includeStayDates: boolean;
  roomNumberFormat: string;
}

/**
 * Pobiera szablon paragonu fiskalnego (tworzy domyślny jeśli nie istnieje).
 */
export async function getFiscalReceiptTemplate(): Promise<ActionResult<FiscalReceiptTemplateData>> {
  try {
    // Pobierz pierwszy (i jedyny) rekord lub utwórz domyślny
    let template = await prisma.fiscalReceiptTemplate.findFirst();

    if (!template) {
      const hotelName = process.env.HOTEL_NAME ?? "Hotel";
      template = await prisma.fiscalReceiptTemplate.create({
        data: {
          headerLine1: hotelName,
          footerLine1: "Dziękujemy za wizytę!",
          footerLine2: "Zapraszamy ponownie",
        },
      });
    }

    return {
      success: true,
      data: {
        id: template.id,
        headerLine1: template.headerLine1,
        headerLine2: template.headerLine2,
        headerLine3: template.headerLine3,
        footerLine1: template.footerLine1,
        footerLine2: template.footerLine2,
        footerLine3: template.footerLine3,
        itemNameRoom: template.itemNameRoom,
        itemNameDeposit: template.itemNameDeposit,
        itemNameMinibar: template.itemNameMinibar,
        itemNameService: template.itemNameService,
        itemNameLocalTax: template.itemNameLocalTax,
        itemNameParking: template.itemNameParking,
        defaultVatRate: template.defaultVatRate,
        includeRoomNumber: template.includeRoomNumber,
        includeStayDates: template.includeStayDates,
        roomNumberFormat: template.roomNumberFormat,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu szablonu paragonu",
    };
  }
}

/**
 * Aktualizuje szablon paragonu fiskalnego.
 */
export async function updateFiscalReceiptTemplate(
  data: Partial<Omit<FiscalReceiptTemplateData, "id">>
): Promise<ActionResult<FiscalReceiptTemplateData>> {
  try {
    // Upewnij się, że szablon istnieje
    let template = await prisma.fiscalReceiptTemplate.findFirst();

    if (!template) {
      template = await prisma.fiscalReceiptTemplate.create({
        data: {},
      });
    }

    // Przygotuj dane do aktualizacji
    const updateData: Record<string, unknown> = {};
    
    if (data.headerLine1 !== undefined) updateData.headerLine1 = data.headerLine1;
    if (data.headerLine2 !== undefined) updateData.headerLine2 = data.headerLine2;
    if (data.headerLine3 !== undefined) updateData.headerLine3 = data.headerLine3;
    if (data.footerLine1 !== undefined) updateData.footerLine1 = data.footerLine1;
    if (data.footerLine2 !== undefined) updateData.footerLine2 = data.footerLine2;
    if (data.footerLine3 !== undefined) updateData.footerLine3 = data.footerLine3;
    if (data.itemNameRoom !== undefined) updateData.itemNameRoom = data.itemNameRoom;
    if (data.itemNameDeposit !== undefined) updateData.itemNameDeposit = data.itemNameDeposit;
    if (data.itemNameMinibar !== undefined) updateData.itemNameMinibar = data.itemNameMinibar;
    if (data.itemNameService !== undefined) updateData.itemNameService = data.itemNameService;
    if (data.itemNameLocalTax !== undefined) updateData.itemNameLocalTax = data.itemNameLocalTax;
    if (data.itemNameParking !== undefined) updateData.itemNameParking = data.itemNameParking;
    if (data.defaultVatRate !== undefined) updateData.defaultVatRate = data.defaultVatRate;
    if (data.includeRoomNumber !== undefined) updateData.includeRoomNumber = data.includeRoomNumber;
    if (data.includeStayDates !== undefined) updateData.includeStayDates = data.includeStayDates;
    if (data.roomNumberFormat !== undefined) updateData.roomNumberFormat = data.roomNumberFormat;

    const updated = await prisma.fiscalReceiptTemplate.update({
      where: { id: template.id },
      data: updateData,
    });

    revalidatePath("/finance");
    revalidatePath("/ustawienia");
    autoExportConfigSnapshot();

    return {
      success: true,
      data: {
        id: updated.id,
        headerLine1: updated.headerLine1,
        headerLine2: updated.headerLine2,
        headerLine3: updated.headerLine3,
        footerLine1: updated.footerLine1,
        footerLine2: updated.footerLine2,
        footerLine3: updated.footerLine3,
        itemNameRoom: updated.itemNameRoom,
        itemNameDeposit: updated.itemNameDeposit,
        itemNameMinibar: updated.itemNameMinibar,
        itemNameService: updated.itemNameService,
        itemNameLocalTax: updated.itemNameLocalTax,
        itemNameParking: updated.itemNameParking,
        defaultVatRate: updated.defaultVatRate,
        includeRoomNumber: updated.includeRoomNumber,
        includeStayDates: updated.includeStayDates,
        roomNumberFormat: updated.roomNumberFormat,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd aktualizacji szablonu paragonu",
    };
  }
}

/**
 * Buduje nazwę pozycji na paragonie na podstawie szablonu i kontekstu.
 */
export async function buildFiscalItemName(params: {
  type: string;
  roomNumber?: string;
  guestName?: string;
  checkIn?: Date;
  checkOut?: Date;
}): Promise<string> {
  const templateResult = await getFiscalReceiptTemplate();
  
  // Fallback jeśli nie udało się pobrać szablonu
  if (!templateResult.success || !templateResult.data) {
    const fallbackNames: Record<string, string> = {
      ROOM: "Nocleg",
      DEPOSIT: "Zaliczka",
      MINIBAR: "Minibar",
      LOCAL_TAX: "Opłata miejscowa",
      PARKING: "Parking",
    };
    return fallbackNames[params.type] || "Usługa";
  }

  const template = templateResult.data;
  
  // Wybierz bazową nazwę dla typu transakcji
  let baseName: string;
  switch (params.type) {
    case "ROOM":
      baseName = template.itemNameRoom;
      break;
    case "DEPOSIT":
      baseName = template.itemNameDeposit;
      break;
    case "MINIBAR":
      baseName = template.itemNameMinibar;
      break;
    case "LOCAL_TAX":
      baseName = template.itemNameLocalTax;
      break;
    case "PARKING":
      baseName = template.itemNameParking;
      break;
    default:
      baseName = template.itemNameService;
  }

  // Dodaj numer pokoju jeśli włączone
  if (template.includeRoomNumber && params.roomNumber) {
    const roomPart = template.roomNumberFormat.replace("{roomNumber}", params.roomNumber);
    baseName = `${baseName} ${roomPart}`;
  }

  // Podmień placeholdery
  baseName = baseName
    .replace("{roomNumber}", params.roomNumber || "")
    .replace("{guestName}", params.guestName || "");

  // Dodaj daty pobytu jeśli włączone
  if (template.includeStayDates && params.checkIn && params.checkOut) {
    const checkInStr = params.checkIn.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit" });
    const checkOutStr = params.checkOut.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit" });
    baseName = `${baseName} (${checkInStr}-${checkOutStr})`;
  }

  return baseName.trim();
}

// ============================================================
// DOCUMENT TEMPLATES (CONFIRMATION, REGISTRATION CARD)
// ============================================================

export type DocumentTemplateType = "CONFIRMATION" | "REGISTRATION_CARD";

export interface DocumentTemplateData {
  id: string;
  templateType: string;
  useInvoiceLogo: boolean;
  logoBase64: string | null;
  logoUrl: string | null;
  logoWidth: number;
  logoPosition: string;
  useInvoiceSeller: boolean;
  hotelName: string | null;
  hotelAddress: string | null;
  hotelPostalCode: string | null;
  hotelCity: string | null;
  hotelPhone: string | null;
  hotelEmail: string | null;
  hotelWebsite: string | null;
  title: string | null;
  headerText: string | null;
  footerText: string | null;
  termsText: string | null;
  welcomeText: string | null;
  fontSize: number;
  fontFamily: string;
  primaryColor: string;
  accentColor: string;
  showIdField: boolean;
  showSignatureField: boolean;
  showVehicleField: boolean;
}

// Domyślne wartości dla każdego typu szablonu
const DEFAULT_DOCUMENT_TEMPLATES: Record<DocumentTemplateType, { title: string; welcomeText: string; footerText: string }> = {
  CONFIRMATION: {
    title: "POTWIERDZENIE REZERWACJI",
    welcomeText: "Dziękujemy za dokonanie rezerwacji w naszym hotelu.",
    footerText: "W razie pytań prosimy o kontakt. Do zobaczenia!",
  },
  REGISTRATION_CARD: {
    title: "KARTA MELDUNKOWA",
    welcomeText: "Witamy w naszym hotelu!",
    footerText: "Życzymy miłego pobytu!",
  },
};

/**
 * Pobiera szablon dokumentu (tworzy domyślny jeśli nie istnieje).
 */
export async function getDocumentTemplate(
  templateType: DocumentTemplateType
): Promise<ActionResult<DocumentTemplateData>> {
  try {
    let template = await prisma.documentTemplate.findUnique({
      where: { templateType },
    });

    // Jeśli brak szablonu, utwórz domyślny
    if (!template) {
      const defaults = DEFAULT_DOCUMENT_TEMPLATES[templateType];
      const hotelName = process.env.HOTEL_NAME ?? "Hotel";
      template = await prisma.documentTemplate.create({
        data: {
          templateType,
          title: defaults.title,
          welcomeText: defaults.welcomeText,
          footerText: defaults.footerText,
          hotelName,
        },
      });
    }

    return {
      success: true,
      data: {
        id: template.id,
        templateType: template.templateType,
        useInvoiceLogo: template.useInvoiceLogo,
        logoBase64: template.logoBase64,
        logoUrl: template.logoUrl,
        logoWidth: template.logoWidth,
        logoPosition: template.logoPosition,
        useInvoiceSeller: template.useInvoiceSeller,
        hotelName: template.hotelName,
        hotelAddress: template.hotelAddress,
        hotelPostalCode: template.hotelPostalCode,
        hotelCity: template.hotelCity,
        hotelPhone: template.hotelPhone,
        hotelEmail: template.hotelEmail,
        hotelWebsite: template.hotelWebsite,
        title: template.title,
        headerText: template.headerText,
        footerText: template.footerText,
        termsText: template.termsText,
        welcomeText: template.welcomeText,
        fontSize: template.fontSize,
        fontFamily: template.fontFamily,
        primaryColor: template.primaryColor,
        accentColor: template.accentColor,
        showIdField: template.showIdField,
        showSignatureField: template.showSignatureField,
        showVehicleField: template.showVehicleField,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu szablonu dokumentu",
    };
  }
}

/**
 * Pobiera wszystkie szablony dokumentów.
 */
export async function getAllDocumentTemplates(): Promise<ActionResult<DocumentTemplateData[]>> {
  try {
    // Upewnij się, że wszystkie domyślne szablony istnieją
    for (const [docType, defaults] of Object.entries(DEFAULT_DOCUMENT_TEMPLATES)) {
      const existing = await prisma.documentTemplate.findUnique({
        where: { templateType: docType },
      });
      if (!existing) {
        const hotelName = process.env.HOTEL_NAME ?? "Hotel";
        await prisma.documentTemplate.create({
          data: {
            templateType: docType,
            title: defaults.title,
            welcomeText: defaults.welcomeText,
            footerText: defaults.footerText,
            hotelName,
          },
        });
      }
    }

    const templates = await prisma.documentTemplate.findMany({
      orderBy: { templateType: "asc" },
    });

    return {
      success: true,
      data: templates.map((t) => ({
        id: t.id,
        templateType: t.templateType,
        useInvoiceLogo: t.useInvoiceLogo,
        logoBase64: t.logoBase64,
        logoUrl: t.logoUrl,
        logoWidth: t.logoWidth,
        logoPosition: t.logoPosition,
        useInvoiceSeller: t.useInvoiceSeller,
        hotelName: t.hotelName,
        hotelAddress: t.hotelAddress,
        hotelPostalCode: t.hotelPostalCode,
        hotelCity: t.hotelCity,
        hotelPhone: t.hotelPhone,
        hotelEmail: t.hotelEmail,
        hotelWebsite: t.hotelWebsite,
        title: t.title,
        headerText: t.headerText,
        footerText: t.footerText,
        termsText: t.termsText,
        welcomeText: t.welcomeText,
        fontSize: t.fontSize,
        fontFamily: t.fontFamily,
        primaryColor: t.primaryColor,
        accentColor: t.accentColor,
        showIdField: t.showIdField,
        showSignatureField: t.showSignatureField,
        showVehicleField: t.showVehicleField,
      })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu szablonów dokumentów",
    };
  }
}

/**
 * Aktualizuje szablon dokumentu.
 */
export async function updateDocumentTemplate(
  templateType: DocumentTemplateType,
  data: Partial<Omit<DocumentTemplateData, "id" | "templateType">>
): Promise<ActionResult<DocumentTemplateData>> {
  try {
    // Upewnij się, że szablon istnieje
    let template = await prisma.documentTemplate.findUnique({
      where: { templateType },
    });

    if (!template) {
      const defaults = DEFAULT_DOCUMENT_TEMPLATES[templateType];
      template = await prisma.documentTemplate.create({
        data: {
          templateType,
          title: defaults.title,
          welcomeText: defaults.welcomeText,
          footerText: defaults.footerText,
        },
      });
    }

    // Przygotuj dane do aktualizacji
    const updateData: Record<string, unknown> = {};
    
    if (data.useInvoiceLogo !== undefined) updateData.useInvoiceLogo = data.useInvoiceLogo;
    if (data.logoBase64 !== undefined) updateData.logoBase64 = data.logoBase64;
    if (data.logoUrl !== undefined) updateData.logoUrl = data.logoUrl;
    if (data.logoWidth !== undefined) updateData.logoWidth = data.logoWidth;
    if (data.logoPosition !== undefined) updateData.logoPosition = data.logoPosition;
    if (data.useInvoiceSeller !== undefined) updateData.useInvoiceSeller = data.useInvoiceSeller;
    if (data.hotelName !== undefined) updateData.hotelName = data.hotelName;
    if (data.hotelAddress !== undefined) updateData.hotelAddress = data.hotelAddress;
    if (data.hotelPostalCode !== undefined) updateData.hotelPostalCode = data.hotelPostalCode;
    if (data.hotelCity !== undefined) updateData.hotelCity = data.hotelCity;
    if (data.hotelPhone !== undefined) updateData.hotelPhone = data.hotelPhone;
    if (data.hotelEmail !== undefined) updateData.hotelEmail = data.hotelEmail;
    if (data.hotelWebsite !== undefined) updateData.hotelWebsite = data.hotelWebsite;
    if (data.title !== undefined) updateData.title = data.title;
    if (data.headerText !== undefined) updateData.headerText = data.headerText;
    if (data.footerText !== undefined) updateData.footerText = data.footerText;
    if (data.termsText !== undefined) updateData.termsText = data.termsText;
    if (data.welcomeText !== undefined) updateData.welcomeText = data.welcomeText;
    if (data.fontSize !== undefined) updateData.fontSize = data.fontSize;
    if (data.fontFamily !== undefined) updateData.fontFamily = data.fontFamily;
    if (data.primaryColor !== undefined) updateData.primaryColor = data.primaryColor;
    if (data.accentColor !== undefined) updateData.accentColor = data.accentColor;
    if (data.showIdField !== undefined) updateData.showIdField = data.showIdField;
    if (data.showSignatureField !== undefined) updateData.showSignatureField = data.showSignatureField;
    if (data.showVehicleField !== undefined) updateData.showVehicleField = data.showVehicleField;

    const updated = await prisma.documentTemplate.update({
      where: { id: template.id },
      data: updateData,
    });

    revalidatePath("/ustawienia");
    autoExportConfigSnapshot();

    return {
      success: true,
      data: {
        id: updated.id,
        templateType: updated.templateType,
        useInvoiceLogo: updated.useInvoiceLogo,
        logoBase64: updated.logoBase64,
        logoUrl: updated.logoUrl,
        logoWidth: updated.logoWidth,
        logoPosition: updated.logoPosition,
        useInvoiceSeller: updated.useInvoiceSeller,
        hotelName: updated.hotelName,
        hotelAddress: updated.hotelAddress,
        hotelPostalCode: updated.hotelPostalCode,
        hotelCity: updated.hotelCity,
        hotelPhone: updated.hotelPhone,
        hotelEmail: updated.hotelEmail,
        hotelWebsite: updated.hotelWebsite,
        title: updated.title,
        headerText: updated.headerText,
        footerText: updated.footerText,
        termsText: updated.termsText,
        welcomeText: updated.welcomeText,
        fontSize: updated.fontSize,
        fontFamily: updated.fontFamily,
        primaryColor: updated.primaryColor,
        accentColor: updated.accentColor,
        showIdField: updated.showIdField,
        showSignatureField: updated.showSignatureField,
        showVehicleField: updated.showVehicleField,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd aktualizacji szablonu dokumentu",
    };
  }
}

// ============================================
// CARD BATCH SETTLEMENT - Rozliczenie kart kredytowych
// ============================================

/**
 * Interfejs szczegółów transakcji w batch'u
 */
interface BatchTransactionDetail {
  transactionId: string;
  reservationId: string;
  amount: number;
  createdAt: string;
  cardLastFour?: string;
  description?: string;
}

/**
 * Pobiera transakcje kartowe bez przypisanego batch settlementu
 * w zadanym okresie czasu.
 */
export async function getUnsettledCardTransactions(
  params: {
    periodFrom: Date;
    periodTo: Date;
    propertyId?: string;
  }
): Promise<ActionResult<{
  transactions: Array<{
    id: string;
    reservationId: string;
    amount: number;
    createdAt: Date;
    cardLastFour?: string;
    reservationNumber?: string;
    guestName?: string;
  }>;
  totalAmount: number;
  count: number;
}>> {
  try {
    // Walidacja dat
    if (!(params.periodFrom instanceof Date) || isNaN(params.periodFrom.getTime())) {
      return { success: false, error: "periodFrom musi być prawidłową datą" };
    }
    if (!(params.periodTo instanceof Date) || isNaN(params.periodTo.getTime())) {
      return { success: false, error: "periodTo musi być prawidłową datą" };
    }
    if (params.periodFrom > params.periodTo) {
      return { success: false, error: "periodFrom nie może być późniejsze niż periodTo" };
    }

    // Pobierz wszystkie batche z tego okresu aby wykluczyć już rozliczone transakcje
    const existingBatches = await prisma.cardSettlementBatch.findMany({
      where: {
        periodFrom: { lte: params.periodTo },
        periodTo: { gte: params.periodFrom },
        status: { not: "FAILED" }, // Failed batche nie blokują
      },
      select: { transactionDetails: true },
    });

    // Zbierz ID transakcji już uwzględnionych w batchach
    const settledTransactionIds = new Set<string>();
    for (const batch of existingBatches) {
      if (batch.transactionDetails && Array.isArray(batch.transactionDetails)) {
        for (const detail of batch.transactionDetails as unknown as BatchTransactionDetail[]) {
          settledTransactionIds.add(detail.transactionId);
        }
      }
    }

    // Pobierz transakcje kartowe z zadanego okresu
    const transactions = await prisma.transaction.findMany({
      where: {
        paymentMethod: "CARD",
        createdAt: {
          gte: params.periodFrom,
          lte: params.periodTo,
        },
        amount: { gt: 0 }, // Tylko dodatnie kwoty (nie zwroty)
      },
      include: {
        reservation: {
          select: {
            id: true,
            guest: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Filtruj już rozliczone transakcje
    const unsettledTransactions = transactions.filter(
      (tx) => !settledTransactionIds.has(tx.id)
    );

    // Oblicz sumę
    const totalAmount = unsettledTransactions.reduce(
      (sum, tx) => sum + Number(tx.amount),
      0
    );

    // Wyciągnij cardLastFour z paymentDetails jeśli dostępne
    const result = unsettledTransactions.map((tx) => {
      let cardLastFour: string | undefined;
      if (tx.paymentDetails) {
        try {
          const details = typeof tx.paymentDetails === "string"
            ? JSON.parse(tx.paymentDetails)
            : tx.paymentDetails;
          cardLastFour = details.cardLastFour;
        } catch {
          // Ignore parse errors
        }
      }
      return {
        id: tx.id,
        reservationId: tx.reservationId,
        amount: Number(tx.amount),
        createdAt: tx.createdAt,
        cardLastFour,
        reservationNumber: tx.reservation?.id,
        guestName: tx.reservation?.guest?.name ?? undefined,
      };
    });

    return {
      success: true,
      data: {
        transactions: result,
        totalAmount,
        count: result.length,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania transakcji kartowych",
    };
  }
}

/**
 * Tworzy nowy batch settlement z transakcji kartowych.
 * Automatycznie grupuje transakcje z danego okresu.
 */
export async function createCardSettlementBatch(
  params: {
    periodFrom: Date;
    periodTo: Date;
    terminalId?: string;
    propertyId?: string;
    notes?: string;
    createdBy?: string;
  }
): Promise<ActionResult<{
  batchId: string;
  batchNumber: string;
  transactionCount: number;
  totalAmount: number;
  status: string;
}>> {
  try {
    // Walidacja dat
    if (!(params.periodFrom instanceof Date) || isNaN(params.periodFrom.getTime())) {
      return { success: false, error: "periodFrom musi być prawidłową datą" };
    }
    if (!(params.periodTo instanceof Date) || isNaN(params.periodTo.getTime())) {
      return { success: false, error: "periodTo musi być prawidłową datą" };
    }
    if (params.periodFrom > params.periodTo) {
      return { success: false, error: "periodFrom nie może być późniejsze niż periodTo" };
    }

    // Sprawdź czy nie ma już istniejącego PENDING batcha dla tego okresu
    const existingPendingBatch = await prisma.cardSettlementBatch.findFirst({
      where: {
        periodFrom: params.periodFrom,
        periodTo: params.periodTo,
        status: "PENDING",
      },
    });
    if (existingPendingBatch) {
      return {
        success: false,
        error: `Istnieje już oczekujący batch dla tego okresu (ID: ${existingPendingBatch.id})`,
      };
    }

    // Pobierz nierozliczone transakcje
    const unsettledResult = await getUnsettledCardTransactions({
      periodFrom: params.periodFrom,
      periodTo: params.periodTo,
      propertyId: params.propertyId,
    });

    if (!unsettledResult.success || !unsettledResult.data) {
      return {
        success: false,
        error: !unsettledResult.success && "error" in unsettledResult ? unsettledResult.error : "Błąd pobierania transakcji",
      };
    }

    const { transactions, totalAmount, count } = unsettledResult.data;

    if (count === 0) {
      return { success: false, error: "Brak transakcji kartowych do rozliczenia w podanym okresie" };
    }

    // Generuj numer batch'a (format: YYYYMMDD-NNN)
    const dateStr = params.periodFrom.toISOString().slice(0, 10).replace(/-/g, "");
    const existingBatchesCount = await prisma.cardSettlementBatch.count({
      where: {
        createdAt: {
          gte: new Date(params.periodFrom.toISOString().slice(0, 10)),
          lt: new Date(new Date(params.periodFrom).setDate(params.periodFrom.getDate() + 1)),
        },
      },
    });
    const batchNumber = `${dateStr}-${String(existingBatchesCount + 1).padStart(3, "0")}`;

    // Przygotuj szczegóły transakcji do zapisania
    const transactionDetails: BatchTransactionDetail[] = transactions.map((tx) => ({
      transactionId: tx.id,
      reservationId: tx.reservationId,
      amount: tx.amount,
      createdAt: tx.createdAt.toISOString(),
      cardLastFour: tx.cardLastFour,
      description: tx.guestName ? `Gość: ${tx.guestName}` : undefined,
    }));

    // Utwórz batch
    const batch = await prisma.cardSettlementBatch.create({
      data: {
        propertyId: params.propertyId,
        periodFrom: params.periodFrom,
        periodTo: params.periodTo,
        transactionCount: count,
        totalAmount,
        status: "PENDING",
        batchNumber,
        terminalId: params.terminalId,
        notes: params.notes,
        submittedBy: params.createdBy,
        transactionDetails: transactionDetails as unknown as Prisma.InputJsonValue,
      },
    });

    // Audit log
    await createAuditLog({
      actionType: "CREATE",
      entityType: "CardSettlementBatch",
      entityId: batchNumber,
      newValue: {
        batchNumber,
        transactionCount: count,
        totalAmount: totalAmount.toFixed(2),
        periodFrom: params.periodFrom.toISOString(),
        periodTo: params.periodTo.toISOString(),
      },
    });

    revalidatePath("/finance");

    return {
      success: true,
      data: {
        batchId: batch.id,
        batchNumber: batch.batchNumber || batchNumber,
        transactionCount: batch.transactionCount,
        totalAmount: Number(batch.totalAmount),
        status: batch.status,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd tworzenia batch settlementu",
    };
  }
}

/**
 * Oznacza batch jako wysłany do terminala/banku.
 */
export async function submitCardSettlementBatch(
  params: {
    batchId: string;
    externalReference?: string;
    submittedBy?: string;
  }
): Promise<ActionResult<{
  batchId: string;
  status: string;
  batchNumber: string;
}>> {
  try {
    if (!params.batchId || typeof params.batchId !== "string") {
      return { success: false, error: "batchId jest wymagane" };
    }

    const batch = await prisma.cardSettlementBatch.findUnique({
      where: { id: params.batchId },
    });

    if (!batch) {
      return { success: false, error: "Nie znaleziono batch'a o podanym ID" };
    }

    if (batch.status !== "PENDING") {
      return {
        success: false,
        error: `Batch ma status ${batch.status}, można wysłać tylko batch o statusie PENDING`,
      };
    }

    const updated = await prisma.cardSettlementBatch.update({
      where: { id: params.batchId },
      data: {
        status: "SUBMITTED",
        externalReference: params.externalReference,
        submittedBy: params.submittedBy || batch.submittedBy,
      },
    });

    await createAuditLog({
      actionType: "UPDATE",
      entityType: "CardSettlementBatch",
      entityId: batch.batchNumber ?? undefined,
      newValue: { message: `Wysłano batch ${batch.batchNumber} do rozliczenia${params.externalReference ? ` (ref: ${params.externalReference})` : ""}` },
    });

    revalidatePath("/finance");

    return {
      success: true,
      data: {
        batchId: updated.id,
        status: updated.status,
        batchNumber: updated.batchNumber || "",
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd wysyłania batch'a",
    };
  }
}

/**
 * Oznacza batch jako rozliczony przez bank.
 * Umożliwia wprowadzenie faktycznej kwoty rozliczenia.
 */
export async function settleCardSettlementBatch(
  params: {
    batchId: string;
    settlementAmount: number;
    settlementDate?: Date;
    externalReference?: string;
    settledBy?: string;
    notes?: string;
  }
): Promise<ActionResult<{
  batchId: string;
  status: string;
  expectedAmount: number;
  settlementAmount: number;
  discrepancy: number;
}>> {
  try {
    if (!params.batchId || typeof params.batchId !== "string") {
      return { success: false, error: "batchId jest wymagane" };
    }
    if (typeof params.settlementAmount !== "number" || isNaN(params.settlementAmount)) {
      return { success: false, error: "settlementAmount musi być liczbą" };
    }
    if (params.settlementAmount < 0) {
      return { success: false, error: "settlementAmount nie może być ujemna" };
    }

    const batch = await prisma.cardSettlementBatch.findUnique({
      where: { id: params.batchId },
    });

    if (!batch) {
      return { success: false, error: "Nie znaleziono batch'a o podanym ID" };
    }

    if (batch.status !== "SUBMITTED" && batch.status !== "PENDING") {
      return {
        success: false,
        error: `Batch ma status ${batch.status}, można rozliczyć tylko batch PENDING lub SUBMITTED`,
      };
    }

    const expectedAmount = Number(batch.totalAmount);
    const discrepancy = params.settlementAmount - expectedAmount;
    let discrepancyReason: string | null = null;

    if (Math.abs(discrepancy) > 0.01) {
      discrepancyReason = discrepancy > 0
        ? `Nadpłata ${discrepancy.toFixed(2)} PLN`
        : `Niedopłata ${Math.abs(discrepancy).toFixed(2)} PLN`;
    }

    const updated = await prisma.cardSettlementBatch.update({
      where: { id: params.batchId },
      data: {
        status: "SETTLED",
        settlementAmount: params.settlementAmount,
        settlementDate: params.settlementDate || new Date(),
        externalReference: params.externalReference || batch.externalReference,
        discrepancyAmount: discrepancy !== 0 ? discrepancy : null,
        discrepancyReason,
        settledBy: params.settledBy,
        notes: params.notes ? (batch.notes ? `${batch.notes}\n${params.notes}` : params.notes) : batch.notes,
      },
    });

    const logMessage = discrepancyReason
      ? `Rozliczono batch ${batch.batchNumber}: oczekiwano ${expectedAmount.toFixed(2)} PLN, otrzymano ${params.settlementAmount.toFixed(2)} PLN (${discrepancyReason})`
      : `Rozliczono batch ${batch.batchNumber}: ${params.settlementAmount.toFixed(2)} PLN`;

    await createAuditLog({
      actionType: "UPDATE",
      entityType: "CardSettlementBatch",
      entityId: batch.batchNumber ?? undefined,
      newValue: { message: logMessage },
    });

    revalidatePath("/finance");

    return {
      success: true,
      data: {
        batchId: updated.id,
        status: updated.status,
        expectedAmount,
        settlementAmount: params.settlementAmount,
        discrepancy,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd rozliczania batch'a",
    };
  }
}

/**
 * Oznacza batch jako zrekoncylionawy (uzgodniony z wyciągiem bankowym).
 */
export async function reconcileCardSettlementBatch(
  params: {
    batchId: string;
    reconciledBy?: string;
    notes?: string;
  }
): Promise<ActionResult<{
  batchId: string;
  status: string;
  batchNumber: string;
}>> {
  try {
    if (!params.batchId || typeof params.batchId !== "string") {
      return { success: false, error: "batchId jest wymagane" };
    }

    const batch = await prisma.cardSettlementBatch.findUnique({
      where: { id: params.batchId },
    });

    if (!batch) {
      return { success: false, error: "Nie znaleziono batch'a o podanym ID" };
    }

    if (batch.status !== "SETTLED") {
      return {
        success: false,
        error: `Batch ma status ${batch.status}, można rekoncyliować tylko batch o statusie SETTLED`,
      };
    }

    const updated = await prisma.cardSettlementBatch.update({
      where: { id: params.batchId },
      data: {
        status: "RECONCILED",
        notes: params.notes ? (batch.notes ? `${batch.notes}\n${params.notes}` : params.notes) : batch.notes,
      },
    });

    await createAuditLog({
      actionType: "UPDATE",
      entityType: "CardSettlementBatch",
      entityId: batch.batchNumber ?? undefined,
      newValue: { message: `Zrekoncyliowano batch ${batch.batchNumber}${params.reconciledBy ? ` przez ${params.reconciledBy}` : ""}` },
    });

    revalidatePath("/finance");

    return {
      success: true,
      data: {
        batchId: updated.id,
        status: updated.status,
        batchNumber: updated.batchNumber || "",
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd rekoncyliacji batch'a",
    };
  }
}

/**
 * Oznacza batch jako nieudany (failed).
 */
export async function failCardSettlementBatch(
  params: {
    batchId: string;
    reason: string;
    failedBy?: string;
  }
): Promise<ActionResult<{
  batchId: string;
  status: string;
  batchNumber: string;
}>> {
  try {
    if (!params.batchId || typeof params.batchId !== "string") {
      return { success: false, error: "batchId jest wymagane" };
    }
    if (!params.reason || typeof params.reason !== "string" || params.reason.trim().length === 0) {
      return { success: false, error: "reason jest wymagany" };
    }

    const batch = await prisma.cardSettlementBatch.findUnique({
      where: { id: params.batchId },
    });

    if (!batch) {
      return { success: false, error: "Nie znaleziono batch'a o podanym ID" };
    }

    if (batch.status === "RECONCILED") {
      return {
        success: false,
        error: "Nie można oznaczyć jako nieudany batch, który został już zrekoncyliowany",
      };
    }

    const updated = await prisma.cardSettlementBatch.update({
      where: { id: params.batchId },
      data: {
        status: "FAILED",
        discrepancyReason: params.reason,
        notes: batch.notes ? `${batch.notes}\nBłąd: ${params.reason}` : `Błąd: ${params.reason}`,
      },
    });

    await createAuditLog({
      actionType: "UPDATE",
      entityType: "CardSettlementBatch",
      entityId: batch.batchNumber ?? undefined,
      newValue: { message: `Batch ${batch.batchNumber} oznaczony jako nieudany: ${params.reason}` },
    });

    revalidatePath("/finance");

    return {
      success: true,
      data: {
        batchId: updated.id,
        status: updated.status,
        batchNumber: updated.batchNumber || "",
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd oznaczania batch'a jako nieudanego",
    };
  }
}

/**
 * Pobiera listę batch settlementów z filtrowaniem.
 */
export async function getCardSettlementBatches(
  params?: {
    status?: SettlementStatus | SettlementStatus[];
    periodFrom?: Date;
    periodTo?: Date;
    limit?: number;
    offset?: number;
  }
): Promise<ActionResult<{
  batches: Array<{
    id: string;
    batchNumber: string;
    periodFrom: Date;
    periodTo: Date;
    transactionCount: number;
    totalAmount: number;
    settlementAmount: number | null;
    discrepancyAmount: number | null;
    status: string;
    createdAt: Date;
    settlementDate: Date | null;
    terminalId: string | null;
  }>;
  total: number;
}>> {
  try {
    const where: Record<string, unknown> = {};

    if (params?.status) {
      if (Array.isArray(params.status)) {
        // Walidacja statusów
        for (const s of params.status) {
          if (!VALID_SETTLEMENT_STATUSES.includes(s)) {
            return { success: false, error: `Nieprawidłowy status: ${s}` };
          }
        }
        where.status = { in: params.status };
      } else {
        if (!VALID_SETTLEMENT_STATUSES.includes(params.status)) {
          return { success: false, error: `Nieprawidłowy status: ${params.status}` };
        }
        where.status = params.status;
      }
    }

    if (params?.periodFrom) {
      where.periodFrom = { gte: params.periodFrom };
    }
    if (params?.periodTo) {
      where.periodTo = { lte: params.periodTo };
    }

    const [batches, total] = await Promise.all([
      prisma.cardSettlementBatch.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: params?.limit || 50,
        skip: params?.offset || 0,
      }),
      prisma.cardSettlementBatch.count({ where }),
    ]);

    return {
      success: true,
      data: {
        batches: batches.map((b) => ({
          id: b.id,
          batchNumber: b.batchNumber || "",
          periodFrom: b.periodFrom,
          periodTo: b.periodTo,
          transactionCount: b.transactionCount,
          totalAmount: Number(b.totalAmount),
          settlementAmount: b.settlementAmount ? Number(b.settlementAmount) : null,
          discrepancyAmount: b.discrepancyAmount ? Number(b.discrepancyAmount) : null,
          status: b.status,
          createdAt: b.createdAt,
          settlementDate: b.settlementDate,
          terminalId: b.terminalId,
        })),
        total,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania listy batch'ów",
    };
  }
}

/**
 * Pobiera szczegóły konkretnego batch settlementu wraz z listą transakcji.
 */
export async function getCardSettlementBatchDetails(
  batchId: string
): Promise<ActionResult<{
  id: string;
  batchNumber: string;
  periodFrom: Date;
  periodTo: Date;
  transactionCount: number;
  totalAmount: number;
  settlementAmount: number | null;
  discrepancyAmount: number | null;
  discrepancyReason: string | null;
  status: string;
  terminalId: string | null;
  externalReference: string | null;
  settlementDate: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  submittedBy: string | null;
  settledBy: string | null;
  transactions: BatchTransactionDetail[];
}>> {
  try {
    if (!batchId || typeof batchId !== "string") {
      return { success: false, error: "batchId jest wymagane" };
    }

    const batch = await prisma.cardSettlementBatch.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      return { success: false, error: "Nie znaleziono batch'a o podanym ID" };
    }

    const transactions: BatchTransactionDetail[] = batch.transactionDetails
      ? (batch.transactionDetails as unknown as BatchTransactionDetail[])
      : [];

    return {
      success: true,
      data: {
        id: batch.id,
        batchNumber: batch.batchNumber || "",
        periodFrom: batch.periodFrom,
        periodTo: batch.periodTo,
        transactionCount: batch.transactionCount,
        totalAmount: Number(batch.totalAmount),
        settlementAmount: batch.settlementAmount ? Number(batch.settlementAmount) : null,
        discrepancyAmount: batch.discrepancyAmount ? Number(batch.discrepancyAmount) : null,
        discrepancyReason: batch.discrepancyReason,
        status: batch.status,
        terminalId: batch.terminalId,
        externalReference: batch.externalReference,
        settlementDate: batch.settlementDate,
        notes: batch.notes,
        createdAt: batch.createdAt,
        updatedAt: batch.updatedAt,
        submittedBy: batch.submittedBy,
        settledBy: batch.settledBy,
        transactions,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania szczegółów batch'a",
    };
  }
}

/**
 * Generuje raport podsumowujący rozliczenia kartowe za okres.
 */
export async function getCardSettlementSummary(
  params: {
    periodFrom: Date;
    periodTo: Date;
  }
): Promise<ActionResult<{
  periodFrom: Date;
  periodTo: Date;
  totalBatches: number;
  statusBreakdown: Array<{ status: string; count: number; amount: number }>;
  totalExpectedAmount: number;
  totalSettledAmount: number;
  totalDiscrepancy: number;
  pendingSettlementAmount: number;
  transactionCount: number;
}>> {
  try {
    if (!(params.periodFrom instanceof Date) || isNaN(params.periodFrom.getTime())) {
      return { success: false, error: "periodFrom musi być prawidłową datą" };
    }
    if (!(params.periodTo instanceof Date) || isNaN(params.periodTo.getTime())) {
      return { success: false, error: "periodTo musi być prawidłową datą" };
    }

    const batches = await prisma.cardSettlementBatch.findMany({
      where: {
        periodFrom: { gte: params.periodFrom },
        periodTo: { lte: params.periodTo },
      },
    });

    // Grupuj po statusie
    const statusMap = new Map<string, { count: number; amount: number }>();
    let totalExpectedAmount = 0;
    let totalSettledAmount = 0;
    let pendingSettlementAmount = 0;
    let transactionCount = 0;

    for (const batch of batches) {
      const status = batch.status;
      const amount = Number(batch.totalAmount);
      const settled = batch.settlementAmount ? Number(batch.settlementAmount) : 0;

      const current = statusMap.get(status) || { count: 0, amount: 0 };
      statusMap.set(status, {
        count: current.count + 1,
        amount: current.amount + amount,
      });

      totalExpectedAmount += amount;
      totalSettledAmount += settled;
      transactionCount += batch.transactionCount;

      if (status === "PENDING" || status === "SUBMITTED") {
        pendingSettlementAmount += amount;
      }
    }

    const statusBreakdown = Array.from(statusMap.entries()).map(([status, data]) => ({
      status,
      count: data.count,
      amount: data.amount,
    }));

    return {
      success: true,
      data: {
        periodFrom: params.periodFrom,
        periodTo: params.periodTo,
        totalBatches: batches.length,
        statusBreakdown,
        totalExpectedAmount,
        totalSettledAmount,
        totalDiscrepancy: totalSettledAmount - totalExpectedAmount,
        pendingSettlementAmount,
        transactionCount,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd generowania raportu rozliczeń",
    };
  }
}

// ============================================
// PAYMENT TERMINAL INTEGRATION - Integracja z terminalami płatniczymi
// ============================================

import {
  initializeTerminal,
  disconnectTerminal,
  getTerminalStatus,
  processTerminalPayment,
  closeTerminalBatch,
  printOnTerminal,
  cancelTerminalOperation,
  getTerminalCapabilities,
  isTerminalInitialized,
  getActiveConfig,
  toTerminalAmount,
  fromTerminalAmount,
  formatAmount as formatTerminalAmount,
} from "@/lib/payment-terminal";
import type {
  PaymentTerminalType,
  TerminalConfig,
  PaymentRequest,
  TerminalStatusResult,
  BatchCloseResult,
  CardType,
  CardEntryMode,
} from "@/lib/payment-terminal/types";

/**
 * Inicjalizuje terminal płatniczy
 */
export async function initializePaymentTerminalAction(
  config?: Partial<TerminalConfig>
): Promise<ActionResult<{
  initialized: boolean;
  terminalType: PaymentTerminalType;
  terminalId: string;
}>> {
  try {
    const success = await initializeTerminal(config);
    
    if (!success) {
      return {
        success: false,
        error: "Nie udało się połączyć z terminalem płatniczym",
      };
    }
    
    const activeConfig = getActiveConfig();
    
    await createAuditLog({
      actionType: "CREATE",
      entityType: "PaymentTerminal",
      entityId: activeConfig?.terminalId ?? "unknown",
      newValue: { message: `Terminal ${activeConfig?.type || "MOCK"} (${activeConfig?.terminalId || "unknown"}) zainicjalizowany` },
    });
    
    return {
      success: true,
      data: {
        initialized: true,
        terminalType: activeConfig?.type || "MOCK",
        terminalId: activeConfig?.terminalId || "",
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd inicjalizacji terminala",
    };
  }
}

/**
 * Pobiera status terminala płatniczego
 */
export async function getPaymentTerminalStatusAction(): Promise<ActionResult<TerminalStatusResult>> {
  try {
    // Auto-inicjalizacja jeśli nie zainicjalizowany
    if (!isTerminalInitialized()) {
      const initResult = await initializeTerminal();
      if (!initResult) {
        return {
          success: false,
          error: "Terminal nie jest zainicjalizowany i nie udało się go zainicjalizować automatycznie",
        };
      }
    }
    
    const status = await getTerminalStatus();
    if (status.success) {
      return { success: true, data: status };
    }
    return {
      success: false,
      error: status.errorMessage ?? "Błąd pobierania statusu terminala",
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania statusu terminala",
    };
  }
}

/**
 * Przetwarza płatność na terminalu (ogólna)
 */
export async function processPaymentTerminalTransactionAction(
  params: {
    amount: number;          // Kwota w PLN (nie w groszach!)
    transactionType: "SALE" | "PREAUTH" | "CAPTURE" | "VOID" | "REFUND";
    reservationId?: string;
    referenceId?: string;
    description?: string;
    originalTransactionId?: string;
    originalAuthCode?: string;
    requestTip?: boolean;
    tipAmount?: number;      // Kwota napiwku w PLN
  }
): Promise<ActionResult<{
  transactionId?: string;
  authCode?: string;
  approvedAmount: number;    // Kwota w PLN
  cardType?: CardType;
  cardNumber?: string;
  cardEntryMode?: CardEntryMode;
  receiptMerchant?: string;
  receiptCustomer?: string;
}>> {
  try {
    // Walidacja
    if (typeof params.amount !== "number" || isNaN(params.amount)) {
      return { success: false, error: "amount musi być liczbą" };
    }
    if (params.amount <= 0) {
      return { success: false, error: "amount musi być większe od zera" };
    }
    if (params.amount > 1000000) {
      return { success: false, error: "amount przekracza maksymalny limit (1 000 000 PLN)" };
    }
    
    const validTypes = ["SALE", "PREAUTH", "CAPTURE", "VOID", "REFUND"];
    if (!validTypes.includes(params.transactionType)) {
      return { success: false, error: `transactionType musi być jednym z: ${validTypes.join(", ")}` };
    }
    
    // Dla CAPTURE i VOID wymagamy oryginalnych danych
    if ((params.transactionType === "CAPTURE" || params.transactionType === "VOID") && !params.originalTransactionId) {
      return { success: false, error: `originalTransactionId jest wymagane dla typu ${params.transactionType}` };
    }
    
    // Auto-inicjalizacja
    if (!isTerminalInitialized()) {
      const initResult = await initializeTerminal();
      if (!initResult) {
        return { success: false, error: "Nie udało się połączyć z terminalem" };
      }
    }
    
    // Konwertuj kwotę na grosze
    const amountInCents = toTerminalAmount(params.amount);
    const tipAmountInCents = params.tipAmount ? toTerminalAmount(params.tipAmount) : undefined;
    
    // Przygotuj żądanie
    const request: PaymentRequest = {
      amount: amountInCents,
      transactionType: params.transactionType,
      reservationId: params.reservationId,
      referenceId: params.referenceId || params.reservationId,
      description: params.description,
      originalTransactionId: params.originalTransactionId,
      originalAuthCode: params.originalAuthCode,
      requestTip: params.requestTip,
      tipAmount: tipAmountInCents,
    };
    
    // Przetwórz płatność
    const result = await processTerminalPayment(request);
    
    // Loguj operację
    const logDetails = `${params.transactionType}: ${params.amount.toFixed(2)} PLN` +
      (params.reservationId ? `, rezerwacja: ${params.reservationId}` : "") +
      (result.success ? `, auth: ${result.authCode || "N/A"}` : `, błąd: ${result.errorMessage || result.errorCode}`);
    
    await createAuditLog({
      actionType: "CREATE",
      entityType: "PaymentTerminal",
      entityId: params.reservationId,
      newValue: { message: logDetails },
    });
    
    if (!result.success) {
      const cancelled =
        result.status === "CANCELLED" ||
        result.errorCode === "CANCELLED" ||
        /anulowan|cancel/i.test(result.errorMessage ?? "");
      return {
        success: false,
        error: cancelled
          ? "Płatność anulowana na terminalu."
          : result.errorMessage || `Transakcja odrzucona (${result.errorCode || "UNKNOWN"})`,
      };
    }
    
    // Jeśli to SALE lub CAPTURE i mamy rezerwację, zarejestruj transakcję w systemie
    if ((params.transactionType === "SALE" || params.transactionType === "CAPTURE") && params.reservationId && result.approvedAmount) {
      await registerTransaction({
        reservationId: params.reservationId,
        amount: fromTerminalAmount(result.approvedAmount),
        type: "PAYMENT",
        paymentMethod: "CARD",
        paymentDetails: {
          cardLastFour: result.cardNumber?.slice(-4),
          cardType: result.cardType,
          terminalTransactionId: result.transactionId,
          authorizationCode: result.authCode,
        },
        description: params.description || `Płatność kartą ${result.cardType || ""}`,
      });
    }
    
    revalidatePath("/finance");
    
    return {
      success: true,
      data: {
        transactionId: result.transactionId,
        authCode: result.authCode,
        approvedAmount: result.approvedAmount ? fromTerminalAmount(result.approvedAmount) : params.amount,
        cardType: result.cardType,
        cardNumber: result.cardNumber,
        cardEntryMode: result.cardEntryMode,
        receiptMerchant: result.receiptData?.merchantCopy,
        receiptCustomer: result.receiptData?.customerCopy,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd przetwarzania płatności",
    };
  }
}

/**
 * Przetwarza płatność sprzedaży (skrót)
 */
export async function processTerminalSaleAction(
  params: {
    amount: number;
    reservationId?: string;
    description?: string;
    requestTip?: boolean;
  }
): Promise<ActionResult<{
  transactionId?: string;
  authCode?: string;
  approvedAmount: number;
  cardType?: CardType;
  cardNumber?: string;
}>> {
  return processPaymentTerminalTransactionAction({
    ...params,
    transactionType: "SALE",
  });
}

/**
 * Przetwarza pre-autoryzację (blokada karty)
 */
export async function processTerminalPreAuthAction(
  params: {
    amount: number;
    reservationId?: string;
    description?: string;
  }
): Promise<ActionResult<{
  transactionId?: string;
  authCode?: string;
  approvedAmount: number;
  cardType?: CardType;
  cardNumber?: string;
}>> {
  return processPaymentTerminalTransactionAction({
    ...params,
    transactionType: "PREAUTH",
  });
}

/**
 * Przechwytuje pre-autoryzację (pobiera środki)
 */
export async function captureTerminalPreAuthAction(
  params: {
    originalTransactionId: string;
    originalAuthCode?: string;
    amount: number;
    reservationId?: string;
  }
): Promise<ActionResult<{
  transactionId?: string;
  authCode?: string;
  approvedAmount: number;
}>> {
  return processPaymentTerminalTransactionAction({
    ...params,
    transactionType: "CAPTURE",
  });
}

/**
 * Anuluje transakcję na terminalu (void)
 */
export async function voidTerminalTransactionAction(
  params: {
    originalTransactionId: string;
    originalAuthCode?: string;
    amount?: number;
    reservationId?: string;
  }
): Promise<ActionResult<{
  transactionId?: string;
  success: boolean;
}>> {
  const result = await processPaymentTerminalTransactionAction({
    amount: params.amount || 0.01, // Minimalna kwota dla void
    transactionType: "VOID",
    originalTransactionId: params.originalTransactionId,
    originalAuthCode: params.originalAuthCode,
    reservationId: params.reservationId,
  });
  
  if (result.success) {
    return {
      success: true,
      data: {
        transactionId: result.data?.transactionId,
        success: true,
      },
    };
  }
  
  return result as ActionResult<{ transactionId?: string; success: boolean }>;
}

/**
 * Przetwarza zwrot na terminalu
 */
export async function processTerminalRefundAction(
  params: {
    amount: number;
    originalTransactionId?: string;
    reservationId?: string;
    description?: string;
  }
): Promise<ActionResult<{
  transactionId?: string;
  authCode?: string;
  approvedAmount: number;
}>> {
  return processPaymentTerminalTransactionAction({
    ...params,
    transactionType: "REFUND",
  });
}

/**
 * Zamyka batch dzienny na terminalu
 */
export async function closeTerminalBatchAction(
  params?: {
    terminalId?: string;
    operatorId?: string;
    printReport?: boolean;
  }
): Promise<ActionResult<BatchCloseResult>> {
  try {
    if (!isTerminalInitialized()) {
      const initResult = await initializeTerminal();
      if (!initResult) {
        return { success: false, error: "Nie udało się połączyć z terminalem" };
      }
    }
    
    const result = await closeTerminalBatch(params);
    
    await createAuditLog({
      actionType: "UPDATE",
      entityType: "PaymentTerminal",
      entityId: result.batchNumber ?? "N/A",
      newValue: {
        message: result.success
          ? `Batch ${result.batchNumber || "N/A"} zamknięty: ${result.transactionCount || 0} transakcji, ${formatTerminalAmount(result.totalAmount || 0)}`
          : `Błąd zamknięcia batch: ${result.errorMessage || "unknown"}`,
      },
    });
    
    if (!result.success) {
      return {
        success: false,
        error: result.errorMessage || "Błąd zamknięcia batch'a",
      };
    }
    
    revalidatePath("/finance");
    
    return {
      success: true,
      data: result,
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd zamknięcia batch'a",
    };
  }
}

/**
 * Drukuje na terminalu
 */
export async function printOnTerminalAction(
  content: string,
  copies?: number
): Promise<ActionResult<{ printed: boolean }>> {
  try {
    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return { success: false, error: "content jest wymagany" };
    }
    
    if (!isTerminalInitialized()) {
      const initResult = await initializeTerminal();
      if (!initResult) {
        return { success: false, error: "Nie udało się połączyć z terminalem" };
      }
    }
    
    const result = await printOnTerminal({ content, copies });
    
    if (!result.success) {
      return {
        success: false,
        error: result.errorMessage || "Błąd drukowania",
      };
    }
    
    return {
      success: true,
      data: { printed: true },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd drukowania",
    };
  }
}

/**
 * Anuluje bieżącą operację na terminalu
 */
export async function cancelTerminalOperationAction(): Promise<ActionResult<{ cancelled: boolean }>> {
  try {
    const result = await cancelTerminalOperation();
    
    await createAuditLog({
      actionType: "UPDATE",
      entityType: "PaymentTerminal",
      entityId: "cancelled",
      newValue: { message: "Operacja na terminalu anulowana przez użytkownika" },
    });
    
    return {
      success: true,
      data: { cancelled: result },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd anulowania operacji",
    };
  }
}

/**
 * Rozłącza terminal
 */
export async function disconnectPaymentTerminalAction(): Promise<ActionResult<{ disconnected: boolean }>> {
  try {
    await disconnectTerminal();
    
    await createAuditLog({
      actionType: "UPDATE",
      entityType: "PaymentTerminal",
      entityId: "disconnected",
      newValue: { message: "Terminal płatniczy rozłączony" },
    });
    
    return {
      success: true,
      data: { disconnected: true },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd rozłączania terminala",
    };
  }
}

/**
 * Pobiera możliwości terminala
 */
export async function getTerminalCapabilitiesAction(): Promise<ActionResult<{
  initialized: boolean;
  type: PaymentTerminalType | null;
  supportsPrint: boolean;
  supportsCancel: boolean;
  supportsPreAuth: boolean;
  supportsContactless: boolean;
}>> {
  try {
    const capabilities = getTerminalCapabilities();
    
    return {
      success: true,
      data: capabilities,
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania możliwości terminala",
    };
  }
}

// ============================================
// CURRENCY EXCHANGE - Obsługa walut obcych
// ============================================

/**
 * Typ kursu (kupno/sprzedaż/średni)
 */
export type RateType = "BUY" | "SELL" | "MID";

/**
 * Interfejs kursu walutowego
 */
interface ExchangeRateData {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  buyRate: number;
  sellRate: number;
  midRate: number;
  source: string;
  sourceReference: string | null;
  effectiveDate: Date;
  expiresAt: Date | null;
  isActive: boolean;
}

/**
 * Interfejs odpowiedzi NBP API
 */
interface NbpRateResponse {
  table: string;
  no: string;
  effectiveDate: string;
  rates: Array<{
    currency: string;
    code: string;
    mid?: number;
    bid?: number;
    ask?: number;
  }>;
}

/**
 * Domyślny spread (marża) dla przewalutowania (%)
 */
const DEFAULT_SPREAD_PERCENT = 2.0;

/**
 * Pobiera kurs z API NBP
 */
async function fetchNbpRates(table: "A" | "C" = "A"): Promise<NbpRateResponse | null> {
  try {
    const url = `https://api.nbp.pl/api/exchangerates/tables/${table}/?format=json`;
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 }, // Cache na 1h
    });
    
    if (!response.ok) {
      console.error(`[NBP API] Error: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const data = await response.json();
    return Array.isArray(data) ? data[0] : data;
  } catch (error) {
    console.error("[NBP API] Fetch error:", error);
    return null;
  }
}

/**
 * Pobiera kurs konkretnej waluty z NBP
 */
async function _fetchNbpRateForCurrency(
  currencyCode: string,
  table: "A" | "C" = "A"
): Promise<{ mid?: number; bid?: number; ask?: number; tableNo: string; effectiveDate: string } | null> {
  try {
    const url = `https://api.nbp.pl/api/exchangerates/rates/${table}/${currencyCode}/?format=json`;
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 },
    });
    
    if (!response.ok) {
      console.error(`[NBP API] Error for ${currencyCode}: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    if (data.rates && data.rates.length > 0) {
      return {
        ...data.rates[0],
        tableNo: data.no,
        effectiveDate: data.effectiveDate,
      };
    }
    return null;
  } catch (error) {
    console.error(`[NBP API] Fetch error for ${currencyCode}:`, error);
    return null;
  }
}

/**
 * Pobiera aktualny kurs walutowy z bazy danych
 */
export async function getExchangeRate(
  fromCurrency: string,
  toCurrency: string,
  date?: Date
): Promise<ActionResult<ExchangeRateData>> {
  try {
    // Walidacja walut
    fromCurrency = fromCurrency.toUpperCase();
    toCurrency = toCurrency.toUpperCase();
    
    if (fromCurrency === toCurrency) {
      return {
        success: true,
        data: {
          id: "SAME_CURRENCY",
          fromCurrency,
          toCurrency,
          buyRate: 1,
          sellRate: 1,
          midRate: 1,
          source: "SYSTEM",
          sourceReference: null,
          effectiveDate: new Date(),
          expiresAt: null,
          isActive: true,
        },
      };
    }
    
    const effectiveDate = date || new Date();
    
    // Szukaj w bazie danych
    const rate = await prisma.currencyExchangeRate.findFirst({
      where: {
        fromCurrency,
        toCurrency,
        isActive: true,
        effectiveDate: { lte: effectiveDate },
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: effectiveDate } },
        ],
      },
      orderBy: { effectiveDate: "desc" },
    });
    
    if (rate) {
      return {
        success: true,
        data: {
          id: rate.id,
          fromCurrency: rate.fromCurrency,
          toCurrency: rate.toCurrency,
          buyRate: Number(rate.buyRate),
          sellRate: Number(rate.sellRate),
          midRate: Number(rate.midRate),
          source: rate.source,
          sourceReference: rate.sourceReference,
          effectiveDate: rate.effectiveDate,
          expiresAt: rate.expiresAt,
          isActive: rate.isActive,
        },
      };
    }
    
    // Sprawdź kurs odwrotny (np. jeśli szukamy PLN→EUR, a mamy EUR→PLN)
    const reverseRate = await prisma.currencyExchangeRate.findFirst({
      where: {
        fromCurrency: toCurrency,
        toCurrency: fromCurrency,
        isActive: true,
        effectiveDate: { lte: effectiveDate },
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: effectiveDate } },
        ],
      },
      orderBy: { effectiveDate: "desc" },
    });
    
    if (reverseRate) {
      // Odwróć kurs
      const midRate = 1 / Number(reverseRate.midRate);
      return {
        success: true,
        data: {
          id: `REVERSE_${reverseRate.id}`,
          fromCurrency,
          toCurrency,
          buyRate: 1 / Number(reverseRate.sellRate),  // Odwrócony sell = buy
          sellRate: 1 / Number(reverseRate.buyRate),  // Odwrócony buy = sell
          midRate,
          source: reverseRate.source,
          sourceReference: reverseRate.sourceReference,
          effectiveDate: reverseRate.effectiveDate,
          expiresAt: reverseRate.expiresAt,
          isActive: true,
        },
      };
    }
    
    return {
      success: false,
      error: `Nie znaleziono kursu ${fromCurrency}/${toCurrency}`,
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania kursu walutowego",
    };
  }
}

/**
 * Pobiera i zapisuje aktualne kursy z NBP
 */
export async function syncNbpExchangeRates(
  currencies?: string[]
): Promise<ActionResult<{
  synced: number;
  failed: string[];
  tableNo: string;
  effectiveDate: string;
}>> {
  try {
    const currenciesToSync = currencies || ["EUR", "USD", "GBP", "CHF", "CZK", "DKK", "NOK", "SEK"];
    const failed: string[] = [];
    let synced = 0;
    let tableNo = "";
    let effectiveDate = "";
    
    // Pobierz kursy z tabeli A (średnie)
    const tableA = await fetchNbpRates("A");
    
    // Pobierz kursy z tabeli C (kupno/sprzedaż) dla głównych walut
    const tableC = await fetchNbpRates("C");
    
    if (!tableA) {
      return {
        success: false,
        error: "Nie udało się pobrać kursów z NBP API",
      };
    }
    
    tableNo = tableA.no;
    effectiveDate = tableA.effectiveDate;
    
    // Mapuj kursy z tabeli C
    const tableCRates = new Map<string, { bid: number; ask: number }>();
    if (tableC) {
      for (const rate of tableC.rates) {
        if (rate.bid && rate.ask) {
          tableCRates.set(rate.code, { bid: rate.bid, ask: rate.ask });
        }
      }
    }
    
    for (const currencyCode of currenciesToSync) {
      const code = currencyCode.toUpperCase();
      const rateA = tableA.rates.find((r) => r.code === code);
      
      if (!rateA || !rateA.mid) {
        failed.push(code);
        continue;
      }
      
      const rateC = tableCRates.get(code);
      const midRate = rateA.mid;
      // Jeśli nie ma kursu kupna/sprzedaży, oblicz ze spreadu
      const buyRate = rateC?.bid || midRate * (1 - DEFAULT_SPREAD_PERCENT / 100);
      const sellRate = rateC?.ask || midRate * (1 + DEFAULT_SPREAD_PERCENT / 100);
      
      try {
        // Upsert kursu
        await prisma.currencyExchangeRate.upsert({
          where: {
            fromCurrency_toCurrency_effectiveDate: {
              fromCurrency: "PLN",
              toCurrency: code,
              effectiveDate: new Date(effectiveDate),
            },
          },
          update: {
            buyRate,
            sellRate,
            midRate,
            source: "NBP",
            sourceReference: tableNo,
            isActive: true,
            updatedAt: new Date(),
          },
          create: {
            fromCurrency: "PLN",
            toCurrency: code,
            buyRate,
            sellRate,
            midRate,
            source: "NBP",
            sourceReference: tableNo,
            effectiveDate: new Date(effectiveDate),
            isActive: true,
          },
        });
        synced++;
      } catch (err) {
        console.error(`[NBP SYNC] Error saving ${code}:`, err);
        failed.push(code);
      }
    }
    
    await createAuditLog({
      actionType: "CREATE",
      entityType: "ExchangeRate",
      entityId: `NBP-${tableNo}`,
      newValue: { message: `Zsynchronizowano ${synced} kursów NBP (tabela ${tableNo})` },
    });
    
    revalidatePath("/finance");
    
    return {
      success: true,
      data: {
        synced,
        failed,
        tableNo,
        effectiveDate,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd synchronizacji kursów NBP",
    };
  }
}

/**
 * Dodaje ręcznie kurs walutowy
 */
export async function addExchangeRate(
  params: {
    fromCurrency: string;
    toCurrency: string;
    buyRate: number;
    sellRate: number;
    midRate?: number;
    effectiveDate?: Date;
    expiresAt?: Date;
    source?: ExchangeRateSource;
    sourceReference?: string;
    createdBy?: string;
  }
): Promise<ActionResult<ExchangeRateData>> {
  try {
    // Walidacja
    const fromCurrency = params.fromCurrency.toUpperCase();
    const toCurrency = params.toCurrency.toUpperCase();
    
    if (fromCurrency === toCurrency) {
      return { success: false, error: "Waluty źródłowa i docelowa nie mogą być takie same" };
    }
    
    if (!SUPPORTED_CURRENCIES.includes(fromCurrency as SupportedCurrency)) {
      return { success: false, error: `Nieobsługiwana waluta źródłowa: ${fromCurrency}` };
    }
    if (!SUPPORTED_CURRENCIES.includes(toCurrency as SupportedCurrency)) {
      return { success: false, error: `Nieobsługiwana waluta docelowa: ${toCurrency}` };
    }
    
    if (typeof params.buyRate !== "number" || params.buyRate <= 0) {
      return { success: false, error: "buyRate musi być liczbą dodatnią" };
    }
    if (typeof params.sellRate !== "number" || params.sellRate <= 0) {
      return { success: false, error: "sellRate musi być liczbą dodatnią" };
    }
    if (params.sellRate < params.buyRate) {
      return { success: false, error: "sellRate nie może być mniejszy niż buyRate" };
    }
    
    const midRate = params.midRate ?? (params.buyRate + params.sellRate) / 2;
    const effectiveDate = params.effectiveDate || new Date();
    
    // Dezaktywuj poprzednie kursy dla tej pary
    await prisma.currencyExchangeRate.updateMany({
      where: {
        fromCurrency,
        toCurrency,
        isActive: true,
      },
      data: {
        isActive: false,
        expiresAt: effectiveDate,
      },
    });
    
    // Utwórz nowy kurs
    const rate = await prisma.currencyExchangeRate.create({
      data: {
        fromCurrency,
        toCurrency,
        buyRate: params.buyRate,
        sellRate: params.sellRate,
        midRate,
        source: params.source || "MANUAL",
        sourceReference: params.sourceReference,
        effectiveDate,
        expiresAt: params.expiresAt,
        isActive: true,
        createdBy: params.createdBy,
      },
    });
    
    await createAuditLog({
      actionType: "CREATE",
      entityType: "ExchangeRate",
      entityId: `${fromCurrency}/${toCurrency}`,
      newValue: { message: `Dodano kurs ${fromCurrency}/${toCurrency}: kupno=${params.buyRate}, sprzedaż=${params.sellRate}` },
    });
    
    revalidatePath("/finance");
    
    return {
      success: true,
      data: {
        id: rate.id,
        fromCurrency: rate.fromCurrency,
        toCurrency: rate.toCurrency,
        buyRate: Number(rate.buyRate),
        sellRate: Number(rate.sellRate),
        midRate: Number(rate.midRate),
        source: rate.source,
        sourceReference: rate.sourceReference,
        effectiveDate: rate.effectiveDate,
        expiresAt: rate.expiresAt,
        isActive: rate.isActive,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd dodawania kursu walutowego",
    };
  }
}

/**
 * Przewalutowuje kwotę
 */
export async function convertCurrency(
  params: {
    amount: number;
    fromCurrency: string;
    toCurrency: string;
    rateType?: RateType;
    spreadPercent?: number;
    reservationId?: string;
    transactionId?: string;
    convertedBy?: string;
  }
): Promise<ActionResult<{
  originalAmount: number;
  originalCurrency: string;
  convertedAmount: number;
  convertedCurrency: string;
  appliedRate: number;
  rateType: RateType;
  spreadPercent: number;
  spreadAmount: number;
  conversionId: string;
}>> {
  try {
    // Walidacja
    if (typeof params.amount !== "number" || isNaN(params.amount)) {
      return { success: false, error: "amount musi być liczbą" };
    }
    if (params.amount <= 0) {
      return { success: false, error: "amount musi być większe od zera" };
    }
    if (params.amount > 10000000) {
      return { success: false, error: "amount przekracza maksymalny limit" };
    }
    
    const fromCurrency = params.fromCurrency.toUpperCase();
    const toCurrency = params.toCurrency.toUpperCase();
    const rateType = params.rateType || "MID";
    const spreadPercent = params.spreadPercent ?? 0;
    
    // Pobierz kurs
    const rateResult = await getExchangeRate(fromCurrency, toCurrency);
    if (!rateResult.success || !rateResult.data) {
      return {
        success: false,
        error: !rateResult.success && "error" in rateResult ? rateResult.error : "Nie znaleziono kursu",
      };
    }
    
    const rateData = rateResult.data;
    
    // Wybierz odpowiedni kurs
    let baseRate: number;
    switch (rateType) {
      case "BUY":
        baseRate = rateData.buyRate;
        break;
      case "SELL":
        baseRate = rateData.sellRate;
        break;
      case "MID":
      default:
        baseRate = rateData.midRate;
        break;
    }
    
    // Zastosuj spread
    const spreadMultiplier = 1 + spreadPercent / 100;
    const appliedRate = baseRate * spreadMultiplier;
    
    // Oblicz kwotę
    const convertedAmount = Math.round(params.amount * appliedRate * 100) / 100;
    const spreadAmount = Math.round((convertedAmount - params.amount * baseRate) * 100) / 100;
    
    // Zapisz konwersję
    const conversion = await prisma.currencyConversion.create({
      data: {
        transactionId: params.transactionId,
        reservationId: params.reservationId,
        originalAmount: params.amount,
        originalCurrency: fromCurrency,
        convertedAmount,
        convertedCurrency: toCurrency,
        exchangeRateId: rateData.id !== "SAME_CURRENCY" && !rateData.id.startsWith("REVERSE_") ? rateData.id : null,
        appliedRate,
        rateType,
        spreadPercent: spreadPercent > 0 ? spreadPercent : null,
        spreadAmount: spreadAmount > 0 ? spreadAmount : null,
        convertedBy: params.convertedBy,
      },
    });
    
    await createAuditLog({
      actionType: "CREATE",
      entityType: "Transaction",
      entityId: params.reservationId,
      newValue: { message: `Przewalutowano ${params.amount.toFixed(2)} ${fromCurrency} → ${convertedAmount.toFixed(2)} ${toCurrency} (kurs: ${appliedRate.toFixed(4)})` },
    });
    
    return {
      success: true,
      data: {
        originalAmount: params.amount,
        originalCurrency: fromCurrency,
        convertedAmount,
        convertedCurrency: toCurrency,
        appliedRate,
        rateType,
        spreadPercent,
        spreadAmount,
        conversionId: conversion.id,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd przewalutowania",
    };
  }
}

/**
 * Pobiera listę aktywnych kursów walutowych
 */
export async function getActiveExchangeRates(
  baseCurrency: string = "PLN"
): Promise<ActionResult<{
  baseCurrency: string;
  rates: Array<{
    currency: string;
    buyRate: number;
    sellRate: number;
    midRate: number;
    source: string;
    effectiveDate: Date;
  }>;
  lastUpdated: Date | null;
}>> {
  try {
    const from = baseCurrency.toUpperCase();
    
    const rates = await prisma.currencyExchangeRate.findMany({
      where: {
        fromCurrency: from,
        isActive: true,
      },
      orderBy: { toCurrency: "asc" },
    });
    
    const lastUpdated = rates.length > 0
      ? rates.reduce((max, r) => r.updatedAt > max ? r.updatedAt : max, rates[0].updatedAt)
      : null;
    
    return {
      success: true,
      data: {
        baseCurrency: from,
        rates: rates.map((r) => ({
          currency: r.toCurrency,
          buyRate: Number(r.buyRate),
          sellRate: Number(r.sellRate),
          midRate: Number(r.midRate),
          source: r.source,
          effectiveDate: r.effectiveDate,
        })),
        lastUpdated,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania kursów walutowych",
    };
  }
}

/**
 * Pobiera historię kursów dla pary walutowej
 */
export async function getExchangeRateHistory(
  params: {
    fromCurrency: string;
    toCurrency: string;
    periodFrom?: Date;
    periodTo?: Date;
    limit?: number;
  }
): Promise<ActionResult<{
  fromCurrency: string;
  toCurrency: string;
  history: Array<{
    id: string;
    buyRate: number;
    sellRate: number;
    midRate: number;
    source: string;
    effectiveDate: Date;
    isActive: boolean;
  }>;
}>> {
  try {
    const from = params.fromCurrency.toUpperCase();
    const to = params.toCurrency.toUpperCase();
    
    const where: Record<string, unknown> = {
      fromCurrency: from,
      toCurrency: to,
    };
    
    if (params.periodFrom) {
      where.effectiveDate = { ...((where.effectiveDate as Record<string, unknown>) || {}), gte: params.periodFrom };
    }
    if (params.periodTo) {
      where.effectiveDate = { ...((where.effectiveDate as Record<string, unknown>) || {}), lte: params.periodTo };
    }
    
    const rates = await prisma.currencyExchangeRate.findMany({
      where,
      orderBy: { effectiveDate: "desc" },
      take: params.limit || 100,
    });
    
    return {
      success: true,
      data: {
        fromCurrency: from,
        toCurrency: to,
        history: rates.map((r) => ({
          id: r.id,
          buyRate: Number(r.buyRate),
          sellRate: Number(r.sellRate),
          midRate: Number(r.midRate),
          source: r.source,
          effectiveDate: r.effectiveDate,
          isActive: r.isActive,
        })),
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania historii kursów",
    };
  }
}

/**
 * Pobiera historię konwersji walutowych
 */
export async function getCurrencyConversionHistory(
  params?: {
    reservationId?: string;
    periodFrom?: Date;
    periodTo?: Date;
    limit?: number;
    offset?: number;
  }
): Promise<ActionResult<{
  conversions: Array<{
    id: string;
    originalAmount: number;
    originalCurrency: string;
    convertedAmount: number;
    convertedCurrency: string;
    appliedRate: number;
    rateType: string;
    spreadAmount: number | null;
    convertedAt: Date;
    reservationId: string | null;
  }>;
  total: number;
}>> {
  try {
    const where: Record<string, unknown> = {};
    
    if (params?.reservationId) {
      where.reservationId = params.reservationId;
    }
    if (params?.periodFrom) {
      where.convertedAt = { ...((where.convertedAt as Record<string, unknown>) || {}), gte: params.periodFrom };
    }
    if (params?.periodTo) {
      where.convertedAt = { ...((where.convertedAt as Record<string, unknown>) || {}), lte: params.periodTo };
    }
    
    const [conversions, total] = await Promise.all([
      prisma.currencyConversion.findMany({
        where,
        orderBy: { convertedAt: "desc" },
        take: params?.limit || 50,
        skip: params?.offset || 0,
      }),
      prisma.currencyConversion.count({ where }),
    ]);
    
    return {
      success: true,
      data: {
        conversions: conversions.map((c) => ({
          id: c.id,
          originalAmount: Number(c.originalAmount),
          originalCurrency: c.originalCurrency,
          convertedAmount: Number(c.convertedAmount),
          convertedCurrency: c.convertedCurrency,
          appliedRate: Number(c.appliedRate),
          rateType: c.rateType,
          spreadAmount: c.spreadAmount ? Number(c.spreadAmount) : null,
          convertedAt: c.convertedAt,
          reservationId: c.reservationId,
        })),
        total,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania historii konwersji",
    };
  }
}

/**
 * Dezaktywuje kurs walutowy
 */
export async function deactivateExchangeRate(
  rateId: string
): Promise<ActionResult<{ deactivated: boolean }>> {
  try {
    if (!rateId || typeof rateId !== "string") {
      return { success: false, error: "rateId jest wymagane" };
    }
    
    const rate = await prisma.currencyExchangeRate.findUnique({
      where: { id: rateId },
    });
    
    if (!rate) {
      return { success: false, error: "Nie znaleziono kursu" };
    }
    
    if (!rate.isActive) {
      return { success: false, error: "Kurs jest już nieaktywny" };
    }
    
    await prisma.currencyExchangeRate.update({
      where: { id: rateId },
      data: {
        isActive: false,
        expiresAt: new Date(),
      },
    });
    
    await createAuditLog({
      actionType: "UPDATE",
      entityType: "ExchangeRate",
      entityId: `${rate.fromCurrency}/${rate.toCurrency}`,
      newValue: { message: `Dezaktywowano kurs ${rate.fromCurrency}/${rate.toCurrency}` },
    });
    
    revalidatePath("/finance");
    
    return {
      success: true,
      data: { deactivated: true },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd dezaktywacji kursu",
    };
  }
}

/**
 * Oblicza przeliczenie kwoty bez zapisywania (podgląd)
 */
export async function previewCurrencyConversion(
  params: {
    amount: number;
    fromCurrency: string;
    toCurrency: string;
    rateType?: RateType;
    spreadPercent?: number;
  }
): Promise<ActionResult<{
  originalAmount: number;
  originalCurrency: string;
  convertedAmount: number;
  convertedCurrency: string;
  appliedRate: number;
  baseRate: number;
  spreadAmount: number;
  rateSource: string;
  rateDate: Date;
}>> {
  try {
    // Walidacja
    if (typeof params.amount !== "number" || isNaN(params.amount) || params.amount <= 0) {
      return { success: false, error: "amount musi być liczbą dodatnią" };
    }
    
    const fromCurrency = params.fromCurrency.toUpperCase();
    const toCurrency = params.toCurrency.toUpperCase();
    const rateType = params.rateType || "MID";
    const spreadPercent = params.spreadPercent ?? 0;
    
    // Pobierz kurs
    const rateResult = await getExchangeRate(fromCurrency, toCurrency);
    if (!rateResult.success || !rateResult.data) {
      return {
        success: false,
        error: !rateResult.success && "error" in rateResult ? rateResult.error : "Nie znaleziono kursu",
      };
    }
    
    const rateData = rateResult.data;
    
    // Wybierz odpowiedni kurs
    let baseRate: number;
    switch (rateType) {
      case "BUY":
        baseRate = rateData.buyRate;
        break;
      case "SELL":
        baseRate = rateData.sellRate;
        break;
      case "MID":
      default:
        baseRate = rateData.midRate;
        break;
    }
    
    // Zastosuj spread
    const spreadMultiplier = 1 + spreadPercent / 100;
    const appliedRate = baseRate * spreadMultiplier;
    
    // Oblicz kwoty
    const convertedAmount = Math.round(params.amount * appliedRate * 100) / 100;
    const spreadAmount = Math.round((convertedAmount - params.amount * baseRate) * 100) / 100;
    
    return {
      success: true,
      data: {
        originalAmount: params.amount,
        originalCurrency: fromCurrency,
        convertedAmount,
        convertedCurrency: toCurrency,
        appliedRate,
        baseRate,
        spreadAmount,
        rateSource: rateData.source,
        rateDate: rateData.effectiveDate,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd podglądu przewalutowania",
    };
  }
}

/**
 * Pobiera listę obsługiwanych walut
 */
export async function getSupportedCurrencies(): Promise<{
  currencies: typeof SUPPORTED_CURRENCIES;
  baseCurrency: string;
}> {
  return {
    currencies: SUPPORTED_CURRENCIES,
    baseCurrency: "PLN",
  };
}

// ============================================
// GIFT VOUCHERS - Vouchery/bony podarunkowe
// ============================================

/**
 * Generuje unikalny kod vouchera
 */
function generateVoucherCode(prefix: string = "GV"): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Interfejs danych vouchera
 */
interface VoucherData {
  id: string;
  code: string;
  type: string;
  originalValue: number;
  currentBalance: number;
  currency: string;
  status: string;
  validFrom: Date;
  validUntil: Date | null;
  usageCount: number;
  maxUsages: number | null;
  purchaserName: string | null;
  recipientName: string | null;
  recipientEmail: string | null;
}

/**
 * Tworzy nowy voucher
 */
export async function createVoucher(
  params: {
    type?: VoucherType;
    value: number;
    currency?: string;
    validityDays?: number;
    validUntil?: Date;
    minPurchaseAmount?: number;
    maxDiscountAmount?: number;
    maxUsages?: number;
    purchaserName?: string;
    purchaserEmail?: string;
    purchaserPhone?: string;
    recipientName?: string;
    recipientEmail?: string;
    recipientMessage?: string;
    purchasePrice?: number;
    allowedServices?: string[];
    allowedRoomTypes?: string[];
    campaignId?: string;
    campaignName?: string;
    customCode?: string;
    createdBy?: string;
  }
): Promise<ActionResult<VoucherData>> {
  try {
    // Walidacja
    if (typeof params.value !== "number" || isNaN(params.value)) {
      return { success: false, error: "value musi być liczbą" };
    }
    if (params.value <= 0) {
      return { success: false, error: "value musi być większe od zera" };
    }
    if (params.value > 100000) {
      return { success: false, error: "value przekracza maksymalny limit (100 000)" };
    }
    
    const type = params.type || "MONETARY";
    if (!VOUCHER_TYPES.includes(type)) {
      return { success: false, error: `Nieprawidłowy typ vouchera: ${type}` };
    }
    
    // Generuj lub waliduj kod
    let code = params.customCode?.toUpperCase().trim();
    if (code) {
      // Sprawdź unikalność
      const existing = await prisma.giftVoucher.findUnique({ where: { code } });
      if (existing) {
        return { success: false, error: `Kod vouchera "${code}" już istnieje` };
      }
    } else {
      code = generateVoucherCode();
    }
    
    // Oblicz datę ważności
    let validUntil = params.validUntil;
    if (!validUntil && params.validityDays && params.validityDays > 0) {
      validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + params.validityDays);
      validUntil.setHours(23, 59, 59, 999);
    }
    
    // Utwórz voucher
    const voucher = await prisma.giftVoucher.create({
      data: {
        code,
        type,
        originalValue: params.value,
        currentBalance: params.value,
        currency: params.currency || "PLN",
        minPurchaseAmount: params.minPurchaseAmount,
        maxDiscountAmount: params.maxDiscountAmount,
        maxUsages: params.maxUsages,
        validFrom: new Date(),
        validUntil,
        status: "ACTIVE",
        purchaserName: params.purchaserName,
        purchaserEmail: params.purchaserEmail,
        purchaserPhone: params.purchaserPhone,
        recipientName: params.recipientName,
        recipientEmail: params.recipientEmail,
        recipientMessage: params.recipientMessage,
        purchaseDate: params.purchasePrice ? new Date() : null,
        purchasePrice: params.purchasePrice,
        allowedServices: params.allowedServices,
        allowedRoomTypes: params.allowedRoomTypes,
        campaignId: params.campaignId,
        campaignName: params.campaignName,
        createdBy: params.createdBy,
      },
    });
    
    await createAuditLog({
      actionType: "CREATE",
      entityType: "Voucher",
      entityId: code,
      newValue: { message: `Utworzono voucher ${code}: ${params.value} ${params.currency || "PLN"} (${type})` },
    });
    
    revalidatePath("/finance");
    
    return {
      success: true,
      data: {
        id: voucher.id,
        code: voucher.code,
        type: voucher.type,
        originalValue: Number(voucher.originalValue),
        currentBalance: Number(voucher.currentBalance),
        currency: voucher.currency,
        status: voucher.status,
        validFrom: voucher.validFrom,
        validUntil: voucher.validUntil,
        usageCount: voucher.usageCount,
        maxUsages: voucher.maxUsages,
        purchaserName: voucher.purchaserName,
        recipientName: voucher.recipientName,
        recipientEmail: voucher.recipientEmail,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd tworzenia vouchera",
    };
  }
}

/**
 * Pobiera voucher po kodzie
 */
export async function getVoucherByCode(
  code: string
): Promise<ActionResult<VoucherData & {
  isValid: boolean;
  invalidReason?: string;
  redemptions: Array<{
    id: string;
    redeemedAmount: number;
    redeemedAt: Date;
    reservationId: string | null;
  }>;
}>> {
  try {
    if (!code || typeof code !== "string") {
      return { success: false, error: "code jest wymagany" };
    }
    
    const voucher = await prisma.giftVoucher.findUnique({
      where: { code: code.toUpperCase().trim() },
      include: {
        redemptions: {
          orderBy: { redeemedAt: "desc" },
          take: 10,
        },
      },
    });
    
    if (!voucher) {
      return { success: false, error: "Nie znaleziono vouchera o podanym kodzie" };
    }
    
    // Sprawdź ważność
    let isValid = true;
    let invalidReason: string | undefined;
    
    if (voucher.status !== "ACTIVE") {
      isValid = false;
      invalidReason = `Voucher ma status: ${voucher.status}`;
    } else if (voucher.validUntil && new Date() > voucher.validUntil) {
      isValid = false;
      invalidReason = "Voucher wygasł";
    } else if (voucher.maxUsages && voucher.usageCount >= voucher.maxUsages) {
      isValid = false;
      invalidReason = "Voucher osiągnął maksymalną liczbę użyć";
    } else if (Number(voucher.currentBalance) <= 0 && voucher.type === "MONETARY") {
      isValid = false;
      invalidReason = "Voucher nie ma salda";
    }
    
    return {
      success: true,
      data: {
        id: voucher.id,
        code: voucher.code,
        type: voucher.type,
        originalValue: Number(voucher.originalValue),
        currentBalance: Number(voucher.currentBalance),
        currency: voucher.currency,
        status: voucher.status,
        validFrom: voucher.validFrom,
        validUntil: voucher.validUntil,
        usageCount: voucher.usageCount,
        maxUsages: voucher.maxUsages,
        purchaserName: voucher.purchaserName,
        recipientName: voucher.recipientName,
        recipientEmail: voucher.recipientEmail,
        isValid,
        invalidReason,
        redemptions: voucher.redemptions.map((r) => ({
          id: r.id,
          redeemedAmount: Number(r.redeemedAmount),
          redeemedAt: r.redeemedAt,
          reservationId: r.reservationId,
        })),
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania vouchera",
    };
  }
}

/**
 * Waliduje voucher przed użyciem
 */
export async function validateVoucher(
  params: {
    code: string;
    amount: number;
    services?: string[];
    roomType?: string;
    date?: Date;
  }
): Promise<ActionResult<{
  isValid: boolean;
  discountAmount: number;
  remainingBalance: number;
  voucherType: string;
  invalidReason?: string;
}>> {
  try {
    const { code, amount } = params;
    const checkDate = params.date || new Date();
    
    if (!code || typeof code !== "string") {
      return { success: false, error: "code jest wymagany" };
    }
    if (typeof amount !== "number" || amount <= 0) {
      return { success: false, error: "amount musi być liczbą dodatnią" };
    }
    
    const voucher = await prisma.giftVoucher.findUnique({
      where: { code: code.toUpperCase().trim() },
    });
    
    if (!voucher) {
      return {
        success: true,
        data: {
          isValid: false,
          discountAmount: 0,
          remainingBalance: 0,
          voucherType: "UNKNOWN",
          invalidReason: "Nie znaleziono vouchera",
        },
      };
    }
    
    // Sprawdź status
    if (voucher.status !== "ACTIVE") {
      return {
        success: true,
        data: {
          isValid: false,
          discountAmount: 0,
          remainingBalance: Number(voucher.currentBalance),
          voucherType: voucher.type,
          invalidReason: `Voucher ma status: ${voucher.status}`,
        },
      };
    }
    
    // Sprawdź ważność
    if (voucher.validUntil && checkDate > voucher.validUntil) {
      return {
        success: true,
        data: {
          isValid: false,
          discountAmount: 0,
          remainingBalance: Number(voucher.currentBalance),
          voucherType: voucher.type,
          invalidReason: "Voucher wygasł",
        },
      };
    }
    
    // Sprawdź liczbę użyć
    if (voucher.maxUsages && voucher.usageCount >= voucher.maxUsages) {
      return {
        success: true,
        data: {
          isValid: false,
          discountAmount: 0,
          remainingBalance: Number(voucher.currentBalance),
          voucherType: voucher.type,
          invalidReason: "Voucher osiągnął maksymalną liczbę użyć",
        },
      };
    }
    
    // Sprawdź minimalną kwotę zakupu
    if (voucher.minPurchaseAmount && amount < Number(voucher.minPurchaseAmount)) {
      return {
        success: true,
        data: {
          isValid: false,
          discountAmount: 0,
          remainingBalance: Number(voucher.currentBalance),
          voucherType: voucher.type,
          invalidReason: `Minimalna kwota zakupu: ${Number(voucher.minPurchaseAmount).toFixed(2)} ${voucher.currency}`,
        },
      };
    }
    
    // Sprawdź dozwolone usługi
    if (voucher.allowedServices && params.services) {
      const allowed = voucher.allowedServices as string[];
      const hasAllowed = params.services.some((s) => allowed.includes(s));
      if (!hasAllowed) {
        return {
          success: true,
          data: {
            isValid: false,
            discountAmount: 0,
            remainingBalance: Number(voucher.currentBalance),
            voucherType: voucher.type,
            invalidReason: "Voucher nie obejmuje wybranych usług",
          },
        };
      }
    }
    
    // Sprawdź dozwolone typy pokoi
    if (voucher.allowedRoomTypes && params.roomType) {
      const allowed = voucher.allowedRoomTypes as string[];
      if (!allowed.includes(params.roomType)) {
        return {
          success: true,
          data: {
            isValid: false,
            discountAmount: 0,
            remainingBalance: Number(voucher.currentBalance),
            voucherType: voucher.type,
            invalidReason: "Voucher nie obejmuje wybranego typu pokoju",
          },
        };
      }
    }
    
    // Sprawdź blackout dates
    if (voucher.blackoutDates) {
      const blackouts = voucher.blackoutDates as string[];
      const dateStr = checkDate.toISOString().split("T")[0];
      if (blackouts.includes(dateStr)) {
        return {
          success: true,
          data: {
            isValid: false,
            discountAmount: 0,
            remainingBalance: Number(voucher.currentBalance),
            voucherType: voucher.type,
            invalidReason: "Voucher nie jest ważny w wybranej dacie",
          },
        };
      }
    }
    
    // Oblicz rabat
    let discountAmount = 0;
    const balance = Number(voucher.currentBalance);
    const maxDiscount = voucher.maxDiscountAmount ? Number(voucher.maxDiscountAmount) : null;
    
    switch (voucher.type) {
      case "MONETARY":
        discountAmount = Math.min(balance, amount);
        break;
      case "PERCENTAGE":
        discountAmount = amount * (balance / 100);
        if (maxDiscount) {
          discountAmount = Math.min(discountAmount, maxDiscount);
        }
        break;
      case "FIXED_DISCOUNT":
        discountAmount = Math.min(balance, amount);
        break;
      case "FREE_NIGHT":
        // Dla FREE_NIGHT wartość to liczba darmowych nocy
        discountAmount = amount; // Pełna kwota (zakładając że to jedna noc)
        break;
      case "PACKAGE":
        // Dla pakietu - pełna wartość rabatu
        discountAmount = Math.min(balance, amount);
        break;
    }
    
    discountAmount = Math.round(discountAmount * 100) / 100;
    
    return {
      success: true,
      data: {
        isValid: true,
        discountAmount,
        remainingBalance: voucher.type === "PERCENTAGE" ? balance : Math.max(0, balance - discountAmount),
        voucherType: voucher.type,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd walidacji vouchera",
    };
  }
}

/**
 * Realizuje voucher (wykorzystuje)
 */
export async function redeemVoucher(
  params: {
    code: string;
    amount: number;
    reservationId?: string;
    transactionId?: string;
    guestName?: string;
    guestEmail?: string;
    redeemedBy?: string;
    notes?: string;
  }
): Promise<ActionResult<{
  redemptionId: string;
  redeemedAmount: number;
  discountAmount: number;
  remainingBalance: number;
  voucherStatus: string;
}>> {
  try {
    const { code, amount } = params;
    
    // Waliduj voucher
    const validationResult = await validateVoucher({ code, amount });
    if (!validationResult.success || !validationResult.data) {
      return {
        success: false,
        error: !validationResult.success && "error" in validationResult ? validationResult.error : "Błąd walidacji vouchera",
      };
    }
    
    const validation = validationResult.data;
    if (!validation.isValid) {
      return { success: false, error: validation.invalidReason || "Voucher jest nieważny" };
    }
    
    // Pobierz voucher do aktualizacji
    const voucher = await prisma.giftVoucher.findUnique({
      where: { code: code.toUpperCase().trim() },
    });
    
    if (!voucher) {
      return { success: false, error: "Nie znaleziono vouchera" };
    }
    
    const balanceBefore = Number(voucher.currentBalance);
    const discountAmount = validation.discountAmount;
    
    // Oblicz nowe saldo
    let newBalance: number;
    let newStatus: VoucherStatus = "ACTIVE";
    
    if (voucher.type === "PERCENTAGE") {
      // Dla procentowego - saldo się nie zmienia, ale zwiększamy usage count
      newBalance = balanceBefore;
      if (voucher.maxUsages && voucher.usageCount + 1 >= voucher.maxUsages) {
        newStatus = "USED";
      }
    } else {
      // Dla kwotowego - odejmij od salda
      newBalance = Math.max(0, balanceBefore - discountAmount);
      if (newBalance <= 0) {
        newStatus = "USED";
      }
    }
    
    // Transakcja: aktualizuj voucher i dodaj redemption
    const [updatedVoucher, redemption] = await prisma.$transaction([
      prisma.giftVoucher.update({
        where: { id: voucher.id },
        data: {
          currentBalance: newBalance,
          usageCount: { increment: 1 },
          status: newStatus,
        },
      }),
      prisma.voucherRedemption.create({
        data: {
          voucherId: voucher.id,
          reservationId: params.reservationId,
          transactionId: params.transactionId,
          redeemedAmount: discountAmount,
          discountAmount,
          originalTotal: amount,
          finalTotal: amount - discountAmount,
          balanceBefore,
          balanceAfter: newBalance,
          guestName: params.guestName,
          guestEmail: params.guestEmail,
          redeemedBy: params.redeemedBy,
          notes: params.notes,
        },
      }),
    ]);
    
    await createAuditLog({
      actionType: "UPDATE",
      entityType: "Voucher",
      entityId: code,
      newValue: { message: `Voucher ${code} wykorzystany: ${discountAmount.toFixed(2)} ${voucher.currency}, saldo: ${newBalance.toFixed(2)}`, reservationId: params.reservationId },
    });
    
    revalidatePath("/finance");
    
    return {
      success: true,
      data: {
        redemptionId: redemption.id,
        redeemedAmount: discountAmount,
        discountAmount,
        remainingBalance: newBalance,
        voucherStatus: updatedVoucher.status,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd realizacji vouchera",
    };
  }
}

/**
 * Anuluje voucher
 */
export async function cancelVoucher(
  params: {
    code: string;
    reason?: string;
    cancelledBy?: string;
  }
): Promise<ActionResult<{ cancelled: boolean }>> {
  try {
    if (!params.code || typeof params.code !== "string") {
      return { success: false, error: "code jest wymagany" };
    }
    
    const voucher = await prisma.giftVoucher.findUnique({
      where: { code: params.code.toUpperCase().trim() },
    });
    
    if (!voucher) {
      return { success: false, error: "Nie znaleziono vouchera" };
    }
    
    if (voucher.status === "CANCELLED") {
      return { success: false, error: "Voucher jest już anulowany" };
    }
    
    if (voucher.status === "USED") {
      return { success: false, error: "Nie można anulować w pełni wykorzystanego vouchera" };
    }
    
    await prisma.giftVoucher.update({
      where: { id: voucher.id },
      data: { status: "CANCELLED" },
    });
    
    await createAuditLog({
      actionType: "UPDATE",
      entityType: "Voucher",
      entityId: params.code,
      newValue: { message: `Anulowano voucher ${params.code}${params.reason ? `: ${params.reason}` : ""}` },
    });
    
    revalidatePath("/finance");
    
    return {
      success: true,
      data: { cancelled: true },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd anulowania vouchera",
    };
  }
}

/**
 * Przedłuża ważność vouchera
 */
export async function extendVoucherValidity(
  params: {
    code: string;
    newValidUntil?: Date;
    additionalDays?: number;
    extendedBy?: string;
  }
): Promise<ActionResult<{ newValidUntil: Date }>> {
  try {
    if (!params.code || typeof params.code !== "string") {
      return { success: false, error: "code jest wymagany" };
    }
    
    if (!params.newValidUntil && !params.additionalDays) {
      return { success: false, error: "Podaj newValidUntil lub additionalDays" };
    }
    
    const voucher = await prisma.giftVoucher.findUnique({
      where: { code: params.code.toUpperCase().trim() },
    });
    
    if (!voucher) {
      return { success: false, error: "Nie znaleziono vouchera" };
    }
    
    if (voucher.status === "CANCELLED" || voucher.status === "USED") {
      return { success: false, error: `Nie można przedłużyć vouchera o statusie ${voucher.status}` };
    }
    
    let newValidUntil: Date;
    if (params.newValidUntil) {
      newValidUntil = params.newValidUntil;
    } else {
      const baseDate = voucher.validUntil && voucher.validUntil > new Date()
        ? voucher.validUntil
        : new Date();
      newValidUntil = new Date(baseDate);
      newValidUntil.setDate(newValidUntil.getDate() + (params.additionalDays || 0));
    }
    
    // Jeśli voucher był wygasły, reaktywuj
    const newStatus = voucher.status === "EXPIRED" ? "ACTIVE" : voucher.status;
    
    await prisma.giftVoucher.update({
      where: { id: voucher.id },
      data: {
        validUntil: newValidUntil,
        status: newStatus,
      },
    });
    
    await createAuditLog({
      actionType: "UPDATE",
      entityType: "Voucher",
      entityId: params.code,
      newValue: { message: `Przedłużono ważność vouchera ${params.code} do ${newValidUntil.toISOString().split("T")[0]}` },
    });
    
    revalidatePath("/finance");
    
    return {
      success: true,
      data: { newValidUntil },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd przedłużania vouchera",
    };
  }
}

/**
 * Doładowuje saldo vouchera
 */
export async function rechargeVoucher(
  params: {
    code: string;
    amount: number;
    rechargedBy?: string;
    notes?: string;
  }
): Promise<ActionResult<{
  newBalance: number;
  previousBalance: number;
}>> {
  try {
    if (!params.code || typeof params.code !== "string") {
      return { success: false, error: "code jest wymagany" };
    }
    if (typeof params.amount !== "number" || params.amount <= 0) {
      return { success: false, error: "amount musi być liczbą dodatnią" };
    }
    
    const voucher = await prisma.giftVoucher.findUnique({
      where: { code: params.code.toUpperCase().trim() },
    });
    
    if (!voucher) {
      return { success: false, error: "Nie znaleziono vouchera" };
    }
    
    if (voucher.type !== "MONETARY") {
      return { success: false, error: "Doładowanie możliwe tylko dla voucherów kwotowych" };
    }
    
    if (voucher.status === "CANCELLED") {
      return { success: false, error: "Nie można doładować anulowanego vouchera" };
    }
    
    const previousBalance = Number(voucher.currentBalance);
    const newBalance = previousBalance + params.amount;
    
    // Reaktywuj jeśli był używany lub wygasły
    const newStatus = voucher.status === "USED" || voucher.status === "EXPIRED" ? "ACTIVE" : voucher.status;
    
    await prisma.giftVoucher.update({
      where: { id: voucher.id },
      data: {
        currentBalance: newBalance,
        originalValue: { increment: params.amount },
        status: newStatus,
      },
    });
    
    await createAuditLog({
      actionType: "UPDATE",
      entityType: "Voucher",
      entityId: params.code,
      newValue: { message: `Doładowano voucher ${params.code}: +${params.amount.toFixed(2)} ${voucher.currency}, nowe saldo: ${newBalance.toFixed(2)}` },
    });
    
    revalidatePath("/finance");
    
    return {
      success: true,
      data: {
        newBalance,
        previousBalance,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd doładowania vouchera",
    };
  }
}

/**
 * Pobiera listę voucherów z filtrowaniem
 */
export async function getVouchers(
  params?: {
    status?: VoucherStatus | VoucherStatus[];
    type?: VoucherType;
    search?: string;
    includeExpired?: boolean;
    limit?: number;
    offset?: number;
  }
): Promise<ActionResult<{
  vouchers: VoucherData[];
  total: number;
}>> {
  try {
    const where: Record<string, unknown> = {};
    
    // Status filter
    if (params?.status) {
      if (Array.isArray(params.status)) {
        where.status = { in: params.status };
      } else {
        where.status = params.status;
      }
    } else if (!params?.includeExpired) {
      where.status = { not: "EXPIRED" };
    }
    
    // Type filter
    if (params?.type) {
      where.type = params.type;
    }
    
    // Search
    if (params?.search) {
      const search = params.search.trim();
      where.OR = [
        { code: { contains: search } },
        { purchaserName: { contains: search } },
        { purchaserEmail: { contains: search } },
        { recipientName: { contains: search } },
        { recipientEmail: { contains: search } },
      ];
    }
    
    const [vouchers, total] = await Promise.all([
      prisma.giftVoucher.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: params?.limit || 50,
        skip: params?.offset || 0,
      }),
      prisma.giftVoucher.count({ where }),
    ]);
    
    return {
      success: true,
      data: {
        vouchers: vouchers.map((v) => ({
          id: v.id,
          code: v.code,
          type: v.type,
          originalValue: Number(v.originalValue),
          currentBalance: Number(v.currentBalance),
          currency: v.currency,
          status: v.status,
          validFrom: v.validFrom,
          validUntil: v.validUntil,
          usageCount: v.usageCount,
          maxUsages: v.maxUsages,
          purchaserName: v.purchaserName,
          recipientName: v.recipientName,
          recipientEmail: v.recipientEmail,
        })),
        total,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania voucherów",
    };
  }
}

/**
 * Pobiera statystyki voucherów
 */
export async function getVoucherStatistics(
  params?: {
    periodFrom?: Date;
    periodTo?: Date;
  }
): Promise<ActionResult<{
  totalIssued: number;
  totalIssuedValue: number;
  totalRedeemed: number;
  totalRedeemedValue: number;
  activeVouchers: number;
  activeValue: number;
  expiredVouchers: number;
  byType: Array<{ type: string; count: number; value: number }>;
  byStatus: Array<{ status: string; count: number }>;
}>> {
  try {
    const dateFilter: Record<string, unknown> = {};
    if (params?.periodFrom) {
      dateFilter.createdAt = { ...((dateFilter.createdAt as Record<string, unknown>) || {}), gte: params.periodFrom };
    }
    if (params?.periodTo) {
      dateFilter.createdAt = { ...((dateFilter.createdAt as Record<string, unknown>) || {}), lte: params.periodTo };
    }
    
    // Pobierz wszystkie vouchery w okresie
    const vouchers = await prisma.giftVoucher.findMany({
      where: dateFilter,
      include: {
        redemptions: true,
      },
    });
    
    // Oblicz statystyki
    let totalIssued = 0;
    let totalIssuedValue = 0;
    let totalRedeemed = 0;
    let totalRedeemedValue = 0;
    let activeVouchers = 0;
    let activeValue = 0;
    let expiredVouchers = 0;
    
    const byType = new Map<string, { count: number; value: number }>();
    const byStatus = new Map<string, number>();
    
    for (const v of vouchers) {
      totalIssued++;
      totalIssuedValue += Number(v.originalValue);
      
      // By type
      const typeStats = byType.get(v.type) || { count: 0, value: 0 };
      typeStats.count++;
      typeStats.value += Number(v.originalValue);
      byType.set(v.type, typeStats);
      
      // By status
      byStatus.set(v.status, (byStatus.get(v.status) || 0) + 1);
      
      // Redemptions
      for (const r of v.redemptions) {
        totalRedeemed++;
        totalRedeemedValue += Number(r.redeemedAmount);
      }
      
      // Active
      if (v.status === "ACTIVE") {
        activeVouchers++;
        activeValue += Number(v.currentBalance);
      }
      
      // Expired
      if (v.status === "EXPIRED") {
        expiredVouchers++;
      }
    }
    
    return {
      success: true,
      data: {
        totalIssued,
        totalIssuedValue,
        totalRedeemed,
        totalRedeemedValue,
        activeVouchers,
        activeValue,
        expiredVouchers,
        byType: Array.from(byType.entries()).map(([type, data]) => ({
          type,
          count: data.count,
          value: data.value,
        })),
        byStatus: Array.from(byStatus.entries()).map(([status, count]) => ({
          status,
          count,
        })),
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania statystyk voucherów",
    };
  }
}

/**
 * Aktualizuje statusy wygasłych voucherów (do uruchomienia cyklicznie)
 */
export async function expireOldVouchers(): Promise<ActionResult<{ expired: number }>> {
  try {
    const now = new Date();
    
    const result = await prisma.giftVoucher.updateMany({
      where: {
        status: "ACTIVE",
        validUntil: { lt: now },
      },
      data: {
        status: "EXPIRED",
      },
    });
    
    if (result.count > 0) {
      await createAuditLog({
        actionType: "UPDATE",
        entityType: "Voucher",
        entityId: "expired",
        newValue: { message: `Automatycznie wygaszono ${result.count} voucherów` },
      });
    }
    
    return {
      success: true,
      data: { expired: result.count },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd wygaszania voucherów",
    };
  }
}

/**
 * Tworzy voucher z szablonu
 */
export async function createVoucherFromTemplate(
  params: {
    templateId: string;
    recipientName?: string;
    recipientEmail?: string;
    recipientMessage?: string;
    purchaserName?: string;
    purchaserEmail?: string;
    purchasePrice?: number;
    customValue?: number;
    createdBy?: string;
  }
): Promise<ActionResult<VoucherData>> {
  try {
    const template = await prisma.voucherTemplate.findUnique({
      where: { id: params.templateId },
    });
    
    if (!template) {
      return { success: false, error: "Nie znaleziono szablonu vouchera" };
    }
    
    if (!template.isActive) {
      return { success: false, error: "Szablon jest nieaktywny" };
    }
    
    const value = params.customValue ?? Number(template.defaultValue);
    const purchasePrice = params.purchasePrice ?? (template.defaultPrice ? Number(template.defaultPrice) : undefined);
    
    // Oblicz datę ważności
    let validUntil: Date | undefined;
    if (template.defaultValidityDays) {
      validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + template.defaultValidityDays);
      validUntil.setHours(23, 59, 59, 999);
    }
    
    return createVoucher({
      type: template.type as VoucherType,
      value,
      currency: template.currency,
      validUntil,
      minPurchaseAmount: template.defaultMinPurchase ? Number(template.defaultMinPurchase) : undefined,
      maxDiscountAmount: template.defaultMaxDiscount ? Number(template.defaultMaxDiscount) : undefined,
      maxUsages: template.defaultMaxUsages || undefined,
      recipientName: params.recipientName,
      recipientEmail: params.recipientEmail,
      recipientMessage: params.recipientMessage,
      purchaserName: params.purchaserName,
      purchaserEmail: params.purchaserEmail,
      purchasePrice,
      allowedServices: template.allowedServices as string[] | undefined,
      allowedRoomTypes: template.allowedRoomTypes as string[] | undefined,
      createdBy: params.createdBy,
    });
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd tworzenia vouchera z szablonu",
    };
  }
}

/**
 * Pobiera dostępne szablony voucherów
 */
export async function getVoucherTemplates(): Promise<ActionResult<Array<{
  id: string;
  name: string;
  description: string | null;
  type: string;
  defaultValue: number;
  defaultPrice: number | null;
  currency: string;
  defaultValidityDays: number | null;
  isActive: boolean;
}>>> {
  try {
    const templates = await prisma.voucherTemplate.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
    
    return {
      success: true,
      data: templates.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        type: t.type,
        defaultValue: Number(t.defaultValue),
        defaultPrice: t.defaultPrice ? Number(t.defaultPrice) : null,
        currency: t.currency,
        defaultValidityDays: t.defaultValidityDays,
        isActive: t.isActive,
      })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania szablonów voucherów",
    };
  }
}

// ============================================
// FOLIO (Guest Account) - Koszyk usług rezerwacji
// ============================================

/**
 * Interfejs pozycji folio
 */
export interface FolioItem {
  id: string;
  type: string;
  category: string | null;
  description: string | null;
  quantity: number;
  unitPrice: number | null;
  amount: number;
  /** Dla obciążenia: kwota po odjęciu rabatów na pozycję. Dla rabatu: kwota rabatu. */
  netAmount: number | null;
  vatRate: number;
  vatAmount: number | null;
  paymentMethod: string | null;
  status: string;
  folioNumber: number;
  postedAt: Date;
  postedBy: string | null;
  notes: string | null;
  /** Tylko dla type=DISCOUNT: RESERVATION = rabat na całe folio, LINE_ITEM = rabat na pozycję */
  discountScope?: FolioDiscountScope;
  /** Tylko dla type=DISCOUNT i discountScope=LINE_ITEM: id obciążenia, do którego przypisany jest rabat */
  appliesToTransactionId?: string | null;
  /** Dla obciążenia (amount > 0): suma rabatów na pozycję przypisanych do tej transakcji */
  lineItemDiscountTotal?: number;
}

/**
 * Interfejs podsumowania folio
 */
interface FolioSummary {
  reservationId: string;
  folioNumber: number;
  totalCharges: number;
  totalDiscounts: number;
  totalPayments: number;
  balance: number;
  itemCount: number;
  lastActivity: Date | null;
}

/** Przypisanie płatnika do folio (dla split folio i separate checks) */
export interface FolioAssignmentData {
  folioNumber: number;
  billTo: FolioBillTo;
  guestId: string | null;
  guestName: string | null;
  companyId: string | null;
  companyName: string | null;
  label: string | null;
}

/** Gość rezerwacji (główny lub w pokoju) – do wyboru płatnika folio (separate checks) */
export interface ReservationGuestForFolio {
  guestId: string;
  name: string;
  isPrimary: boolean;
}

/**
 * Oblicza VAT i netto na podstawie kwoty brutto
 */
function calculateVat(
  grossAmount: number,
  vatRate: number
): { netAmount: number; vatAmount: number } {
  const netAmount = Math.round((grossAmount / (1 + vatRate / 100)) * 100) / 100;
  const vatAmount = Math.round((grossAmount - netAmount) * 100) / 100;
  return { netAmount, vatAmount };
}

/**
 * Dodaje obciążenie (charge) do folio
 */
export async function addFolioCharge(
  params: {
    reservationId: string;
    type: string;
    amount: number;
    description?: string;
    quantity?: number;
    unitPrice?: number;
    vatRate?: number;
    category?: FolioCategory;
    subcategory?: string;
    departmentCode?: string;
    folioNumber?: number;
    externalRef?: string;
    notes?: string;
    postedBy?: string;
  }
): Promise<ActionResult<FolioItem>> {
  try {
    // Walidacja
    if (!params.reservationId || typeof params.reservationId !== "string") {
      return { success: false, error: "reservationId jest wymagane" };
    }
    if (!params.type || typeof params.type !== "string") {
      return { success: false, error: "type jest wymagany" };
    }
    if (typeof params.amount !== "number" || isNaN(params.amount)) {
      return { success: false, error: "amount musi być liczbą" };
    }
    if (params.amount <= 0) {
      return { success: false, error: "amount musi być większe od zera" };
    }
    if (params.amount > 1000000) {
      return { success: false, error: "amount przekracza maksymalny limit" };
    }
    
    // Sprawdź czy rezerwacja istnieje
    const reservation = await prisma.reservation.findUnique({
      where: { id: params.reservationId },
      select: { id: true, status: true },
    });
    
    if (!reservation) {
      return { success: false, error: "Nie znaleziono rezerwacji" };
    }
    
    // Nie pozwól dodawać do anulowanych rezerwacji
    if (reservation.status === "CANCELLED") {
      return { success: false, error: "Nie można dodać obciążenia do anulowanej rezerwacji" };
    }
    
    // Oblicz VAT
    const vatRate = params.vatRate ?? 8;
    const { netAmount, vatAmount } = calculateVat(params.amount, vatRate);
    
    // Oblicz cenę jednostkową jeśli podano ilość
    const quantity = params.quantity ?? 1;
    const unitPrice = params.unitPrice ?? (quantity > 0 ? params.amount / quantity : params.amount);
    
    // Mapuj typ na kategorię jeśli nie podano
    let category = params.category;
    if (!category) {
      const categoryMap: Record<string, FolioCategory> = {
        ROOM: "ACCOMMODATION",
        ACCOMMODATION: "ACCOMMODATION",
        MINIBAR: "MINIBAR",
        RESTAURANT: "F_B",
        BAR: "F_B",
        GASTRONOMY: "F_B",
        SPA: "SPA",
        PARKING: "PARKING",
        PHONE: "PHONE",
        LAUNDRY: "LAUNDRY",
        TRANSPORT: "TRANSPORT",
        ATTRACTION: "OTHER",
        LOCAL_TAX: "TAX",
        TAX: "TAX",
        DEPOSIT: "DEPOSIT",
        SECURITY_DEPOSIT: "DEPOSIT",
        PAYMENT: "PAYMENT",
        DISCOUNT: "DISCOUNT",
        REFUND: "PAYMENT",
      };
      category = categoryMap[params.type.toUpperCase()] || "OTHER";
    }
    
    // Utwórz transakcję
    const transaction = await prisma.transaction.create({
      data: {
        reservationId: params.reservationId,
        type: params.type.toUpperCase(),
        amount: params.amount,
        description: params.description,
        quantity,
        unitPrice,
        vatRate,
        vatAmount,
        netAmount,
        category,
        subcategory: params.subcategory,
        departmentCode: params.departmentCode,
        folioNumber: params.folioNumber ?? 1,
        externalRef: params.externalRef,
        notes: params.notes,
        postedBy: params.postedBy,
        status: "ACTIVE",
      },
    });
    
    await createAuditLog({
      actionType: "CREATE",
      entityType: "Transaction",
      entityId: params.reservationId,
      newValue: { message: `Dodano obciążenie ${params.type}: ${params.amount.toFixed(2)} PLN${params.description ? ` (${params.description})` : ""}` },
    });
    
    revalidatePath("/finance");
    revalidatePath("/front-office");
    
    return {
      success: true,
      data: {
        id: transaction.id,
        type: transaction.type,
        category: transaction.category,
        description: transaction.description,
        quantity: Number(transaction.quantity),
        unitPrice: transaction.unitPrice ? Number(transaction.unitPrice) : null,
        amount: Number(transaction.amount),
        netAmount: transaction.netAmount ? Number(transaction.netAmount) : null,
        vatRate: Number(transaction.vatRate),
        vatAmount: transaction.vatAmount ? Number(transaction.vatAmount) : null,
        paymentMethod: transaction.paymentMethod,
        status: transaction.status,
        folioNumber: transaction.folioNumber,
        postedAt: transaction.postedAt,
        postedBy: transaction.postedBy,
        notes: transaction.notes,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd dodawania obciążenia",
    };
  }
}

/**
 * Dodaje płatność do folio
 */
export async function addFolioPayment(
  params: {
    reservationId: string;
    amount: number;
    paymentMethod: PaymentMethod;
    description?: string;
    paymentDetails?: PaymentDetails;
    folioNumber?: number;
    externalRef?: string;
    notes?: string;
    postedBy?: string;
  }
): Promise<ActionResult<FolioItem>> {
  try {
    // Walidacja
    if (!params.reservationId || typeof params.reservationId !== "string") {
      return { success: false, error: "reservationId jest wymagane" };
    }
    if (typeof params.amount !== "number" || isNaN(params.amount)) {
      return { success: false, error: "amount musi być liczbą" };
    }
    if (params.amount <= 0) {
      return { success: false, error: "amount musi być większe od zera" };
    }
    if (!VALID_PAYMENT_METHODS.includes(params.paymentMethod)) {
      return { success: false, error: `Nieprawidłowa metoda płatności: ${params.paymentMethod}` };
    }
    
    // Sprawdź czy rezerwacja istnieje
    const reservation = await prisma.reservation.findUnique({
      where: { id: params.reservationId },
      select: { id: true },
    });
    
    if (!reservation) {
      return { success: false, error: "Nie znaleziono rezerwacji" };
    }
    
    // Utwórz transakcję płatności (ujemna kwota = uznanie)
    const transaction = await prisma.transaction.create({
      data: {
        reservationId: params.reservationId,
        type: "PAYMENT",
        amount: -params.amount, // Ujemna kwota dla płatności (zmniejsza saldo)
        description: params.description || `Płatność ${params.paymentMethod}`,
        paymentMethod: params.paymentMethod,
        paymentDetails: params.paymentDetails
          ? (JSON.stringify(params.paymentDetails) as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        category: "PAYMENT",
        folioNumber: params.folioNumber ?? 1,
        externalRef: params.externalRef,
        notes: params.notes,
        postedBy: params.postedBy,
        status: "ACTIVE",
        vatRate: 0,
      },
    });
    
    await createAuditLog({
      actionType: "CREATE",
      entityType: "Transaction",
      entityId: params.reservationId,
      newValue: { message: `Dodano płatność ${params.paymentMethod}: ${params.amount.toFixed(2)} PLN` },
    });
    
    revalidatePath("/finance");
    revalidatePath("/front-office");
    
    return {
      success: true,
      data: {
        id: transaction.id,
        type: transaction.type,
        category: transaction.category,
        description: transaction.description,
        quantity: Number(transaction.quantity),
        unitPrice: transaction.unitPrice ? Number(transaction.unitPrice) : null,
        amount: Math.abs(Number(transaction.amount)),
        netAmount: null,
        vatRate: 0,
        vatAmount: null,
        paymentMethod: transaction.paymentMethod,
        status: transaction.status,
        folioNumber: transaction.folioNumber,
        postedAt: transaction.postedAt,
        postedBy: transaction.postedBy,
        notes: transaction.notes,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd dodawania płatności",
    };
  }
}

/**
 * Pobiera sumę kaucji (SECURITY_DEPOSIT) dla rezerwacji (tylko aktywne transakcje).
 */
async function getSecurityDepositTotal(reservationId: string): Promise<number> {
  const rows = await prisma.transaction.findMany({
    where: {
      reservationId,
      type: "SECURITY_DEPOSIT",
      status: "ACTIVE",
    },
    select: { amount: true },
  });
  return Math.round(rows.reduce((s, t) => s + Number(t.amount), 0) * 100) / 100;
}

/**
 * Obsługa kaucji za pokój (security deposit): rejestracja pobrania kaucji.
 * Tworzy transakcję SECURITY_DEPOSIT i aktualizuje Reservation.securityDeposit.
 */
export async function collectSecurityDeposit(
  params: {
    reservationId: string;
    amount: number;
    paymentMethod: PaymentMethod;
    description?: string;
    folioNumber?: number;
    notes?: string;
    postedBy?: string;
  }
): Promise<ActionResult<{ transactionId: string }>> {
  try {
    if (!params.reservationId || typeof params.reservationId !== "string") {
      return { success: false, error: "reservationId jest wymagane" };
    }
    if (typeof params.amount !== "number" || !Number.isFinite(params.amount) || params.amount <= 0) {
      return { success: false, error: "Kwota kaucji musi być większa od zera" };
    }
    if (params.amount > 999_999.99) {
      return { success: false, error: "Kwota kaucji przekracza dozwolony limit" };
    }
    if (!VALID_PAYMENT_METHODS.includes(params.paymentMethod)) {
      return { success: false, error: `Nieprawidłowa metoda płatności: ${params.paymentMethod}` };
    }

    const reservation = await prisma.reservation.findUnique({
      where: { id: params.reservationId },
      select: { id: true, status: true, securityDeposit: true },
    });
    if (!reservation) {
      return { success: false, error: "Nie znaleziono rezerwacji" };
    }
    if (reservation.status === "CANCELLED") {
      return { success: false, error: "Nie można pobrać kaucji dla anulowanej rezerwacji" };
    }

    const amountRounded = Math.round(params.amount * 100) / 100;
    const folioNum = params.folioNumber ?? 1;

    const existingDeposit = (reservation.securityDeposit as { amount?: number; collected?: boolean } | null) ?? {};
    const existingAmount = typeof existingDeposit.amount === "number" ? existingDeposit.amount : 0;
    const newTotalAmount = existingAmount + amountRounded;

    const tx = await prisma.transaction.create({
      data: {
        reservationId: params.reservationId,
        type: "SECURITY_DEPOSIT",
        amount: amountRounded,
        description: params.description?.trim() || `Kaucja za pokój (${params.paymentMethod})`,
        quantity: 1,
        unitPrice: amountRounded,
        vatRate: 0,
        paymentMethod: params.paymentMethod,
        category: "DEPOSIT",
        folioNumber: folioNum,
        notes: params.notes,
        postedBy: params.postedBy,
        status: "ACTIVE",
      },
    });

    const now = new Date().toISOString();
    const securityDepositUpdate: Record<string, unknown> = {
      amount: newTotalAmount,
      currency: "PLN",
      collected: true,
      collectedAt: now,
      collectedMethod: params.paymentMethod,
      ...(existingDeposit as Record<string, unknown>),
    };

    await prisma.reservation.update({
      where: { id: params.reservationId },
      data: { securityDeposit: securityDepositUpdate as Prisma.InputJsonValue },
    });

    await createAuditLog({
      actionType: "CREATE",
      entityType: "Transaction",
      entityId: params.reservationId,
      newValue: { message: `Pobrano kaucję: ${amountRounded.toFixed(2)} PLN (${params.paymentMethod})` },
    });

    revalidatePath("/finance");
    revalidatePath("/front-office");

    return { success: true, data: { transactionId: tx.id } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd rejestracji kaucji",
    };
  }
}

/**
 * Zwrot kaucji (refund security deposit).
 * Tworzy transakcję REFUND (ujemna kwota) i aktualizuje Reservation.securityDeposit (returned, returnedAt, deductions).
 */
export async function refundSecurityDeposit(
  params: {
    reservationId: string;
    /** Kwota do zwrotu (PLN). Jeśli nie podana, zwracana jest cała pobrana kaucja. */
    refundAmount?: number;
    /** Kwota potrącona (np. za uszkodzenia, minibar) – opcjonalnie. */
    deductionAmount?: number;
    deductionReason?: string;
    /** Metoda zwrotu (np. CASH, CARD, TRANSFER). */
    refundMethod?: PaymentMethod;
    folioNumber?: number;
    notes?: string;
    postedBy?: string;
  }
): Promise<ActionResult<{ transactionId: string; refundAmount: number }>> {
  try {
    if (!params.reservationId || typeof params.reservationId !== "string") {
      return { success: false, error: "reservationId jest wymagane" };
    }

    const reservation = await prisma.reservation.findUnique({
      where: { id: params.reservationId },
      select: { id: true, status: true, securityDeposit: true },
    });
    if (!reservation) {
      return { success: false, error: "Nie znaleziono rezerwacji" };
    }
    if (reservation.status === "CANCELLED") {
      return { success: false, error: "Nie można zwrócić kaucji dla anulowanej rezerwacji" };
    }

    const totalDeposit = await getSecurityDepositTotal(params.reservationId);
    if (totalDeposit <= 0) {
      return { success: false, error: "Brak pobranej kaucji do zwrotu dla tej rezerwacji." };
    }

    const deductionAmount = Math.round((params.deductionAmount ?? 0) * 100) / 100;
    if (deductionAmount < 0) {
      return { success: false, error: "Kwota potrącenia nie może być ujemna." };
    }
    if (deductionAmount > totalDeposit) {
      return { success: false, error: "Potrącenie nie może przekraczać łącznej kaucji." };
    }

    const refundAmount =
      params.refundAmount != null
        ? Math.round(params.refundAmount * 100) / 100
        : Math.round((totalDeposit - deductionAmount) * 100) / 100;
    if (refundAmount < 0) {
      return { success: false, error: "Kwota zwrotu nie może być ujemna." };
    }
    if (refundAmount + deductionAmount > totalDeposit) {
      return { success: false, error: "Suma zwrotu i potrącenia nie może przekraczać pobranej kaucji." };
    }
    if (refundAmount <= 0 && deductionAmount <= 0) {
      return { success: false, error: "Podaj kwotę do zwrotu lub potrącenia." };
    }

    const folioNum = params.folioNumber ?? 1;
    const refundMethod = params.refundMethod ?? "CASH";

    if (refundAmount > 0) {
      const tx = await prisma.transaction.create({
        data: {
          reservationId: params.reservationId,
          type: "REFUND",
          amount: -refundAmount,
          description: `Zwrot kaucji (${refundMethod})`,
          quantity: 1,
          unitPrice: -refundAmount,
          vatRate: 0,
          paymentMethod: refundMethod,
          category: "PAYMENT",
          folioNumber: folioNum,
          notes: params.notes,
          postedBy: params.postedBy,
          status: "ACTIVE",
        },
      });

      await createAuditLog({
        actionType: "UPDATE",
        entityType: "Transaction",
        entityId: params.reservationId,
        newValue: { message: `Zwrot kaucji: ${refundAmount.toFixed(2)} PLN (${refundMethod})${params.deductionReason ? `; potrącenie: ${params.deductionReason}` : ""}` },
      });

      const existingDeposit = (reservation.securityDeposit as Record<string, unknown> | null) ?? {};
      const existingDeductions = (existingDeposit.deductions as number) ?? 0;
      const newDeductions = existingDeductions + deductionAmount;
      const securityDepositUpdate: Record<string, unknown> = {
        ...existingDeposit,
        returned: true,
        returnedAt: new Date().toISOString(),
        returnedMethod: refundMethod,
        deductions: newDeductions,
        ...(params.deductionReason && { deductionReason: params.deductionReason }),
      };

      await prisma.reservation.update({
        where: { id: params.reservationId },
        data: { securityDeposit: securityDepositUpdate as Prisma.InputJsonValue },
      });

      revalidatePath("/finance");
      revalidatePath("/front-office");
      await updateReservationPaymentStatus(params.reservationId).catch((err) =>
        console.error("[updateReservationPaymentStatus]", err)
      );

      return { success: true, data: { transactionId: tx.id, refundAmount } };
    }

    // Tylko potrącenie (bez zwrotu gotówki)
    if (deductionAmount > 0) {
      const existingDeposit = (reservation.securityDeposit as Record<string, unknown> | null) ?? {};
      const existingDeductions = (existingDeposit.deductions as number) ?? 0;
      const newDeductions = existingDeductions + deductionAmount;
      const securityDepositUpdate: Record<string, unknown> = {
        ...existingDeposit,
        returned: true,
        returnedAt: new Date().toISOString(),
        returnedMethod: "DEDUCTION",
        deductions: newDeductions,
        ...(params.deductionReason && { deductionReason: params.deductionReason }),
      };
      await prisma.reservation.update({
        where: { id: params.reservationId },
        data: { securityDeposit: securityDepositUpdate as Prisma.InputJsonValue },
      });
      await createAuditLog({
        actionType: "UPDATE",
        entityType: "Transaction",
        entityId: params.reservationId,
        newValue: { message: `Potrącenie z kaucji: ${deductionAmount.toFixed(2)} PLN${params.deductionReason ? ` (${params.deductionReason})` : ""}` },
      });
      revalidatePath("/finance");
      revalidatePath("/front-office");
      return { success: true, data: { transactionId: "", refundAmount: 0 } };
    }

    return { success: false, error: "Podaj kwotę do zwrotu lub potrącenia." };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd zwrotu kaucji",
    };
  }
}

/** Typy transakcji, których nie można refundować (to są kredyty lub anulowania, nie płatności) */
const NON_REFUNDABLE_TYPES = ["VOID", "REFUND", "DISCOUNT"] as const;

/**
 * Zwraca kwotę możliwą do zwrotu dla danej transakcji (oryginalna kwota minus już zwrócone).
 * Używane przez UI i przez refundPayment do walidacji.
 */
export async function getRefundableAmount(
  originalTransactionId: string
): Promise<
  ActionResult<{
    originalAmount: number;
    totalRefunded: number;
    refundableAmount: number;
    reservationId: string;
    originalType: string;
    canRefund: boolean;
  }>
> {
  if (!originalTransactionId || typeof originalTransactionId !== "string" || originalTransactionId.trim() === "") {
    return { success: false, error: "ID transakcji jest wymagane" };
  }

  try {
    const original = await prisma.transaction.findUnique({
      where: { id: originalTransactionId },
      select: {
        id: true,
        reservationId: true,
        amount: true,
        type: true,
        status: true,
        refundTransactions: {
          where: { status: "ACTIVE" },
          select: { amount: true },
        },
      },
    });

    if (!original) {
      return { success: false, error: "Transakcja nie istnieje" };
    }

    if (original.status !== "ACTIVE") {
      return {
        success: false,
        error: "Nie można zwracać płatności z transakcji anulowanej lub przeniesionej",
      };
    }

    if (NON_REFUNDABLE_TYPES.includes(original.type as (typeof NON_REFUNDABLE_TYPES)[number])) {
      return {
        success: false,
        error: `Transakcja typu "${original.type}" nie podlega zwrotowi`,
      };
    }

    const originalAmount = Number(original.amount);
    if (originalAmount <= 0) {
      return {
        success: false,
        error: "Zwrot dotyczy tylko transakcji o kwocie dodatniej (płatności)",
      };
    }

    const totalRefunded = original.refundTransactions.reduce(
      (sum, r) => sum + Math.abs(Number(r.amount)),
      0
    );
    const refundableAmount = Math.max(0, Math.round((originalAmount - totalRefunded) * 100) / 100);

    return {
      success: true,
      data: {
        originalAmount,
        totalRefunded,
        refundableAmount,
        reservationId: original.reservationId,
        originalType: original.type,
        canRefund: refundableAmount > 0,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu kwoty do zwrotu",
    };
  }
}

/**
 * Refundacja (zwrot pieniędzy) – rejestruje zwrot płatności z wybranej transakcji.
 * Tworzy transakcję REFUND z ujemną kwotą i powiązaniem z oryginalną płatnością.
 *
 * Walidacje:
 * - Oryginalna transakcja musi istnieć, być ACTIVE, mieć kwotę > 0 i typ umożliwiający zwrot.
 * - Suma dotychczasowych zwrotów + bieżąca kwota nie może przekroczyć kwoty oryginału.
 * - Kwota zwrotu > 0, zaokrąglona do 2 miejsc.
 *
 * Edge cases: częściowy zwrot (wiele refundów do jednej płatności), pełny zwrot, audit log.
 */
export async function refundPayment(params: {
  originalTransactionId: string;
  /** Kwota do zwrotu (PLN). Jeśli nie podana, zwracana jest cała pozostała kwota. */
  amount?: number;
  /** Metoda zwrotu (np. CASH, CARD, TRANSFER). */
  paymentMethod?: PaymentMethod;
  /** Powód zwrotu (np. anulowanie rezerwacji, reklamacja). */
  reason?: string;
  folioNumber?: number;
  notes?: string;
  postedBy?: string;
}): Promise<ActionResult<{ transactionId: string; refundAmount: number }>> {
  const headersList = await headers();
  const ip = getClientIp(headersList);

  if (!params.originalTransactionId || typeof params.originalTransactionId !== "string") {
    return { success: false, error: "ID oryginalnej transakcji jest wymagane" };
  }
  if (params.originalTransactionId.trim() === "") {
    return { success: false, error: "ID oryginalnej transakcji nie może być puste" };
  }

  const refundable = await getRefundableAmount(params.originalTransactionId);
  if (!refundable.success) {
    return refundable;
  }
  const { refundableAmount, reservationId, originalType } = refundable.data!;

  if (refundableAmount <= 0) {
    return {
      success: false,
      error: "Brak kwoty do zwrotu dla tej transakcji (całość już zwrócona lub transakcja nie podlega zwrotowi)",
    };
  }

  const rawAmount = params.amount != null ? params.amount : refundableAmount;
  const amount = Math.round(rawAmount * 100) / 100;
  if (amount <= 0) {
    return { success: false, error: "Kwota zwrotu musi być większa od zera" };
  }
  if (amount > refundableAmount) {
    return {
      success: false,
      error: `Kwota zwrotu (${amount.toFixed(2)} PLN) nie może przekraczać kwoty do zwrotu (${refundableAmount.toFixed(2)} PLN)`,
    };
  }

  const refundMethod = (params.paymentMethod ?? "CASH").trim().toUpperCase() as PaymentMethod;
  if (!VALID_PAYMENT_METHODS.includes(refundMethod)) {
    return {
      success: false,
      error: `Nieprawidłowa metoda zwrotu: "${params.paymentMethod}". Dozwolone: ${VALID_PAYMENT_METHODS.join(", ")}`,
    };
  }

  try {
    const original = await prisma.transaction.findUnique({
      where: { id: params.originalTransactionId },
      select: { id: true, reservationId: true, folioNumber: true },
    });
    if (!original) {
      return { success: false, error: "Transakcja nie istnieje" };
    }

    const folioNum = params.folioNumber ?? original.folioNumber;

    const tx = await prisma.transaction.create({
      data: {
        reservationId: original.reservationId,
        type: "REFUND",
        amount: -amount,
        description: params.reason
          ? `Zwrot płatności (${refundMethod}) – ${params.reason}`
          : `Zwrot płatności (${refundMethod}) – transakcja ${params.originalTransactionId}`,
        quantity: 1,
        unitPrice: -amount,
        vatRate: 0,
        paymentMethod: refundMethod,
        category: "PAYMENT",
        folioNumber: folioNum,
        refundedTransactionId: params.originalTransactionId,
        notes: params.notes,
        postedBy: params.postedBy,
        status: "ACTIVE",
      },
    });

    await createAuditLog({
      actionType: "CREATE",
      entityType: "Transaction",
      entityId: tx.id,
      newValue: {
        type: "REFUND",
        originalTransactionId: params.originalTransactionId,
        reservationId,
        originalType,
        amount,
        paymentMethod: refundMethod,
        reason: params.reason,
      } as unknown as Record<string, unknown>,
      ipAddress: ip,
    });

    revalidatePath("/finance");
    revalidatePath("/reports");
    revalidatePath("/front-office");
    if (reservationId) {
      await updateReservationPaymentStatus(reservationId).catch((err) =>
        console.error("[updateReservationPaymentStatus]", err)
      );
    }

    return {
      success: true,
      data: { transactionId: tx.id, refundAmount: amount },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd rejestracji zwrotu płatności",
    };
  }
}

/**
 * Aktualizuje paymentStatus rezerwacji na podstawie salda folio (partial payment tracking).
 * UNPAID = brak wpłat, PARTIAL = część opłacona, PAID = saldo <= 0.
 */
export async function updateReservationPaymentStatus(
  reservationId: string
): Promise<ActionResult<{ paymentStatus: string }>> {
  try {
    const summary = await getFolioSummary(reservationId);
    if (!summary.success || !summary.data) {
      return {
        success: false,
        error: !summary.success && "error" in summary ? summary.error : "Błąd podsumowania folio",
      };
    }
    const balance = summary.data.balance;
    const totalPayments = summary.data.totalPayments ?? 0;
    const paymentStatus =
      balance <= 0 ? "PAID" : totalPayments > 0 ? "PARTIAL" : "UNPAID";

    await prisma.reservation.update({
      where: { id: reservationId },
      data: { paymentStatus },
    });
    return { success: true, data: { paymentStatus } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd aktualizacji statusu płatności",
    };
  }
}

/**
 * Pobiera podsumowanie folio (saldo)
 */
export async function getFolioSummary(
  reservationId: string,
  folioNumber?: number
): Promise<ActionResult<FolioSummary & {
  folios: FolioSummary[];
}>> {
  try {
    if (!reservationId || typeof reservationId !== "string") {
      return { success: false, error: "reservationId jest wymagane" };
    }
    
    // Sprawdź czy rezerwacja istnieje
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      select: { id: true },
    });
    
    if (!reservation) {
      return { success: false, error: "Nie znaleziono rezerwacji" };
    }
    
    // Pobierz wszystkie aktywne transakcje
    const transactions = await prisma.transaction.findMany({
      where: {
        reservationId,
        status: "ACTIVE",
        ...(folioNumber !== undefined ? { folioNumber } : {}),
      },
      orderBy: { postedAt: "desc" },
    });
    
    // Grupuj po numerze folio (obciążenia, rabaty, płatności)
    const folioMap = new Map<number, {
      charges: number;
      discounts: number;
      payments: number;
      count: number;
      lastActivity: Date | null;
    }>();
    
    for (const tx of transactions) {
      const fn = tx.folioNumber;
      const current = folioMap.get(fn) || { charges: 0, discounts: 0, payments: 0, count: 0, lastActivity: null };
      
      const amount = Number(tx.amount);
      if (amount > 0) {
        current.charges += amount;
      } else if (tx.type === "DISCOUNT") {
        current.discounts += Math.abs(amount);
      } else {
        current.payments += Math.abs(amount);
      }
      current.count++;
      if (!current.lastActivity || tx.postedAt > current.lastActivity) {
        current.lastActivity = tx.postedAt;
      }
      
      folioMap.set(fn, current);
    }
    
    // Pobierz przypisania płatników (split folio, separate checks)
    const assignments = await prisma.reservationFolio.findMany({
      where: { reservationId },
      include: {
        company: { select: { id: true, name: true } },
        guest: { select: { id: true, name: true } },
      },
    });
    type FolioAssignment = {
      billTo: FolioBillTo;
      guestId: string | null;
      guestName: string | null;
      companyId: string | null;
      companyName: string | null;
      label: string | null;
    };
    const assignmentByFolio = new Map<number, FolioAssignment>(
      assignments.map((a) => [
        a.folioNumber,
        {
          billTo: a.billTo as FolioBillTo,
          guestId: a.guestId,
          guestName: a.guest?.name ?? null,
          companyId: a.companyId,
          companyName: a.company?.name ?? null,
          label: a.label,
        },
      ])
    );

    // Zbiór numerów folio: z transakcji + z przypisań (żeby nowe folio bez transakcji też się pokazało)
    const allFolioNumbers = new Set<number>(folioMap.keys());
    for (const a of assignments) {
      allFolioNumbers.add(a.folioNumber);
    }

    // Przygotuj wyniki (z przypisaniem płatnika)
    const folios: (FolioSummary & {
      billTo?: FolioBillTo;
      guestId?: string | null;
      guestName?: string | null;
      companyId?: string | null;
      companyName?: string | null;
      label?: string | null;
    })[] = Array.from(allFolioNumbers).map((fn) => {
      const data = folioMap.get(fn) || { charges: 0, discounts: 0, payments: 0, count: 0, lastActivity: null };
      const assignment = assignmentByFolio.get(fn);
      const balance = data.charges - data.discounts - data.payments;
      return {
        reservationId,
        folioNumber: fn,
        totalCharges: Math.round(data.charges * 100) / 100,
        totalDiscounts: Math.round(data.discounts * 100) / 100,
        totalPayments: Math.round(data.payments * 100) / 100,
        balance: Math.round(balance * 100) / 100,
        itemCount: data.count,
        lastActivity: data.lastActivity,
        ...(assignment
          ? {
              billTo: assignment.billTo,
              guestId: assignment.guestId,
              guestName: assignment.guestName,
              companyId: assignment.companyId,
              companyName: assignment.companyName,
              label: assignment.label,
            }
          : {}),
      };
    }).sort((a, b) => a.folioNumber - b.folioNumber);
    
    // Oblicz łączne podsumowanie
    const totalCharges = folios.reduce((sum, f) => sum + f.totalCharges, 0);
    const totalDiscounts = folios.reduce((sum, f) => sum + f.totalDiscounts, 0);
    const totalPayments = folios.reduce((sum, f) => sum + f.totalPayments, 0);
    const totalBalance = Math.round((totalCharges - totalDiscounts - totalPayments) * 100) / 100;
    const totalCount = folios.reduce((sum, f) => sum + f.itemCount, 0);
    const lastActivity = folios.reduce((max, f) => {
      if (!f.lastActivity) return max;
      if (!max) return f.lastActivity;
      return f.lastActivity > max ? f.lastActivity : max;
    }, null as Date | null);
    
    return {
      success: true,
      data: {
        reservationId,
        folioNumber: folioNumber ?? 0, // 0 = wszystkie folio
        totalCharges: Math.round(totalCharges * 100) / 100,
        totalDiscounts: Math.round(totalDiscounts * 100) / 100,
        totalPayments: Math.round(totalPayments * 100) / 100,
        balance: totalBalance,
        itemCount: totalCount,
        lastActivity,
        folios,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania podsumowania folio",
    };
  }
}

/**
 * Pobiera szczegółowe pozycje folio
 */
export async function getFolioItems(
  params: {
    reservationId: string;
    folioNumber?: number;
    status?: FolioItemStatus | FolioItemStatus[];
    category?: FolioCategory;
    includeVoided?: boolean;
  }
): Promise<ActionResult<{
  items: FolioItem[];
  summary: {
    totalCharges: number;
    totalDiscounts: number;
    totalPayments: number;
    balance: number;
  };
}>> {
  try {
    if (!params.reservationId || typeof params.reservationId !== "string") {
      return { success: false, error: "reservationId jest wymagane" };
    }
    
    // Buduj warunki
    const where: Record<string, unknown> = {
      reservationId: params.reservationId,
    };
    
    if (params.folioNumber !== undefined) {
      where.folioNumber = params.folioNumber;
    }
    
    if (params.status) {
      if (Array.isArray(params.status)) {
        where.status = { in: params.status };
      } else {
        where.status = params.status;
      }
    } else if (!params.includeVoided) {
      where.status = "ACTIVE";
    }
    
    if (params.category) {
      where.category = params.category;
    }
    
    // Pobierz transakcje z rabatami na pozycję (dla obciążenia: suma rabatów przypisanych do tej pozycji)
    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { postedAt: "desc" },
      include: {
        lineItemDiscounts: { where: { status: "ACTIVE" }, select: { id: true, amount: true } },
      },
    });
    
    // Oblicz podsumowanie (obciążenia, rabaty, płatności)
    let totalCharges = 0;
    let totalDiscounts = 0;
    let totalPayments = 0;
    
    const items: FolioItem[] = transactions.map((tx) => {
      const amount = Number(tx.amount);
      const lineItemDiscountTotal =
        tx.type !== "DISCOUNT" && tx.lineItemDiscounts
          ? Math.round(tx.lineItemDiscounts.reduce((s, d) => s + Math.abs(Number(d.amount)), 0) * 100) / 100
          : undefined;
      if (tx.status === "ACTIVE") {
        if (amount > 0) {
          totalCharges += amount;
        } else if (tx.type === "DISCOUNT") {
          totalDiscounts += Math.abs(amount);
        } else {
          totalPayments += Math.abs(amount);
        }
      }
      
      return {
        id: tx.id,
        type: tx.type,
        category: tx.category,
        description: tx.description,
        quantity: Number(tx.quantity),
        unitPrice: tx.unitPrice ? Number(tx.unitPrice) : null,
        amount: Math.abs(amount),
        netAmount: tx.netAmount ? Number(tx.netAmount) : null,
        vatRate: Number(tx.vatRate),
        vatAmount: tx.vatAmount ? Number(tx.vatAmount) : null,
        paymentMethod: tx.paymentMethod,
        status: tx.status,
        folioNumber: tx.folioNumber,
        postedAt: tx.postedAt,
        postedBy: tx.postedBy,
        notes: tx.notes,
        discountScope:
          tx.type === "DISCOUNT"
            ? (tx.appliesToTransactionId ? ("LINE_ITEM" as const) : ("RESERVATION" as const))
            : undefined,
        appliesToTransactionId: tx.type === "DISCOUNT" ? tx.appliesToTransactionId : undefined,
        lineItemDiscountTotal,
      };
    });
    
    const balance = totalCharges - totalDiscounts - totalPayments;
    return {
      success: true,
      data: {
        items,
        summary: {
          totalCharges: Math.round(totalCharges * 100) / 100,
          totalDiscounts: Math.round(totalDiscounts * 100) / 100,
          totalPayments: Math.round(totalPayments * 100) / 100,
          balance: Math.round(balance * 100) / 100,
        },
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania pozycji folio",
    };
  }
}

/** Typ rabatu: procent od sumy obciążeń lub kwota stała */
export type FolioDiscountType = "PERCENT" | "FIXED";

/** Zakres rabatu: na całe folio (rezerwację) lub na konkretną pozycję */
export type FolioDiscountScope = "RESERVATION" | "LINE_ITEM";

/**
 * Dodaje rabat procentowy lub kwotowy do folio.
 * Rabat jest zapisywany jako transakcja typu DISCOUNT z ujemną kwotą.
 * - appliesToTransactionId = null → rabat na rezerwację (całe folio).
 * - appliesToTransactionId = id obciążenia → rabat na pozycję (tylko ta pozycja).
 * Walidacje: rezerwacja istnieje, folio/pozycja ma obciążenia, rabat nie przekracza sumy do rabatowania.
 */
export async function addFolioDiscount(
  params: {
    reservationId: string;
    folioNumber?: number;
    /** Rabat na całe folio (domyślnie) lub na wybraną pozycję */
    appliesToTransactionId?: string | null;
    discountType: FolioDiscountType;
    /** Dla PERCENT: 0–100; dla FIXED: kwota w PLN > 0 */
    discountValue: number;
    description?: string;
    /** PIN managera – wymagany gdy rabat przekracza limit użytkownika */
    managerPin?: string | null;
  }
): Promise<ActionResult<{ transactionId: string; discountAmount: number; discountScope: FolioDiscountScope }>> {
  const headersList = await headers();
  const ip = getClientIp(headersList);

  try {
    if (!params.reservationId || typeof params.reservationId !== "string") {
      return { success: false, error: "reservationId jest wymagane" };
    }
    const folioNum = params.folioNumber ?? 1;
    if (typeof folioNum !== "number" || folioNum < 1 || !Number.isInteger(folioNum)) {
      return { success: false, error: "folioNumber musi być liczbą całkowitą >= 1" };
    }
    if (!params.discountType || !["PERCENT", "FIXED"].includes(params.discountType)) {
      return { success: false, error: "discountType musi być PERCENT lub FIXED" };
    }
    if (
      params.discountValue === undefined ||
      params.discountValue === null ||
      typeof params.discountValue !== "number" ||
      !Number.isFinite(params.discountValue)
    ) {
      return { success: false, error: "discountValue jest wymagane i musi być liczbą" };
    }
    if (params.discountType === "PERCENT") {
      if (params.discountValue < 0 || params.discountValue > 100) {
        return { success: false, error: "Rabat procentowy musi być w przedziale 0–100%" };
      }
    } else {
      if (params.discountValue <= 0) {
        return { success: false, error: "Rabat kwotowy musi być większy od zera" };
      }
      const MAX_DISCOUNT = 999_999.99;
      if (params.discountValue > MAX_DISCOUNT) {
        return { success: false, error: `Rabat kwotowy nie może przekraczać ${MAX_DISCOUNT.toLocaleString("pl-PL")} PLN` };
      }
    }

    // Limity rabatowe per użytkownik
    const session = await getSession();
    let effectiveMaxPercent = DEFAULT_MAX_DISCOUNT_PERCENT;
    let effectiveMaxAmount = DEFAULT_MAX_DISCOUNT_AMOUNT;
    if (session?.userId) {
      const user = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { maxDiscountPercent: true, maxDiscountAmount: true, role: true },
      });
      if (user) {
        if (user.maxDiscountPercent != null) effectiveMaxPercent = Number(user.maxDiscountPercent);
        if (user.maxDiscountAmount != null) effectiveMaxAmount = Number(user.maxDiscountAmount);
        // MANAGER i OWNER bez ustawionych limitów = brak limitu (wysoki domyślny)
        if (user.role === "MANAGER" || user.role === "OWNER") {
          if (user.maxDiscountPercent == null) effectiveMaxPercent = 100;
          if (user.maxDiscountAmount == null) effectiveMaxAmount = 999_999.99;
        }
      }
    }
    const limitExceededPercent = params.discountType === "PERCENT" && params.discountValue > effectiveMaxPercent;
    const limitExceededAmount = params.discountType === "FIXED" && params.discountValue > effectiveMaxAmount;
    if (limitExceededPercent || limitExceededAmount) {
      const limitMsg =
        params.discountType === "PERCENT"
          ? `Twój limit rabatu procentowego to ${effectiveMaxPercent}%.`
          : `Twój limit rabatu kwotowego to ${effectiveMaxAmount.toFixed(2)} PLN.`;
      const correctPin = params.managerPin?.trim() === MANAGER_PIN;
      if (!correctPin) {
        return {
          success: false,
          error: `Przekroczono limit rabatu. ${limitMsg} Wprowadź PIN managera, aby zatwierdzić.`,
        };
      }
    }

    const reservation = await prisma.reservation.findUnique({
      where: { id: params.reservationId },
      select: { id: true, status: true },
    });
    if (!reservation) {
      return { success: false, error: "Nie znaleziono rezerwacji" };
    }
    if (reservation.status === "CANCELLED") {
      return { success: false, error: "Nie można dodawać rabatu do anulowanej rezerwacji" };
    }

    const isLineItemDiscount = Boolean(params.appliesToTransactionId?.trim());

    if (isLineItemDiscount) {
      // Rabat na pozycję: walidacja pozycji docelowej
      const targetCharge = await prisma.transaction.findFirst({
        where: {
          id: params.appliesToTransactionId!,
          reservationId: params.reservationId,
          folioNumber: folioNum,
          status: "ACTIVE",
        },
      });
      if (!targetCharge) {
        return { success: false, error: "Nie znaleziono pozycji do rabatowania w tym folio lub pozycja jest nieaktywna." };
      }
      const chargeAmount = Number(targetCharge.amount);
      if (chargeAmount <= 0) {
        return { success: false, error: "Wybrana pozycja nie jest obciążeniem (kwota musi być dodatnia)." };
      }
      if (targetCharge.type === "DISCOUNT" || targetCharge.type === "PAYMENT") {
        return { success: false, error: "Rabat można przypisać tylko do pozycji obciążenia (nocleg, minibar, usługa), nie do rabatu ani płatności." };
      }
      // Suma istniejących rabatów na tę pozycję
      const existingLineDiscounts = await prisma.transaction.findMany({
        where: {
          type: "DISCOUNT",
          appliesToTransactionId: targetCharge.id,
          status: "ACTIVE",
        },
      });
      const existingLineDiscountSum = existingLineDiscounts.reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
      const maxDiscountForLine = Math.round((chargeAmount - existingLineDiscountSum) * 100) / 100;
      if (maxDiscountForLine <= 0) {
        return { success: false, error: "Na tej pozycji wykorzystano już pełny rabat. Nie można dodać kolejnego." };
      }

      let discountAmount: number;
      if (params.discountType === "PERCENT") {
        discountAmount = Math.round(chargeAmount * (params.discountValue / 100) * 100) / 100;
        if (discountAmount <= 0) {
          return { success: false, error: "Obliczony rabat procentowy wynosi 0 PLN" };
        }
      } else {
        discountAmount = Math.round(params.discountValue * 100) / 100;
        if (discountAmount > maxDiscountForLine) {
          return {
            success: false,
            error: `Rabat na tę pozycję (${discountAmount.toFixed(2)} PLN) nie może przekraczać dostępnej kwoty (${maxDiscountForLine.toFixed(2)} PLN).`,
          };
        }
      }

      const description =
        params.description?.trim() ||
        (params.discountType === "PERCENT"
          ? `Rabat ${params.discountValue}% (pozycja)`
          : `Rabat ${discountAmount.toFixed(2)} PLN (pozycja)`);

      const tx = await prisma.transaction.create({
        data: {
          reservationId: params.reservationId,
          amount: -discountAmount,
          type: "DISCOUNT",
          folioNumber: folioNum,
          description,
          quantity: 1,
          vatRate: 0,
          paymentMethod: null,
          appliesToTransactionId: targetCharge.id,
        },
      });

      await createAuditLog({
        actionType: "CREATE",
        entityType: "Transaction",
        entityId: tx.id,
        newValue: {
          reservationId: params.reservationId,
          folioNumber: folioNum,
          type: "DISCOUNT",
          discountScope: "LINE_ITEM" as FolioDiscountScope,
          appliesToTransactionId: targetCharge.id,
          discountType: params.discountType,
          discountValue: params.discountValue,
          discountAmount,
          description,
        } as unknown as Record<string, unknown>,
        ipAddress: ip,
      });

      revalidatePath("/finance");
      revalidatePath("/front-office");

      return {
        success: true,
        data: {
          transactionId: tx.id,
          discountAmount,
          discountScope: "LINE_ITEM",
        },
      };
    }

    // Rabat na rezerwację (całe folio)
    const transactions = await prisma.transaction.findMany({
      where: {
        reservationId: params.reservationId,
        folioNumber: folioNum,
        status: "ACTIVE",
      },
    });

    let totalCharges = 0;
    let totalDiscounts = 0;
    for (const tx of transactions) {
      const amount = Number(tx.amount);
      if (amount > 0) {
        totalCharges += amount;
      } else if (tx.type === "DISCOUNT") {
        totalDiscounts += Math.abs(amount);
      }
    }
    const subtotalAfterDiscounts = Math.round((totalCharges - totalDiscounts) * 100) / 100;

    if (subtotalAfterDiscounts <= 0) {
      return {
        success: false,
        error: "Brak obciążeń do rabatowania w tym folio. Dodaj najpierw pozycje (nocleg, minibar itd.).",
      };
    }

    let discountAmount: number;
    if (params.discountType === "PERCENT") {
      discountAmount = Math.round(subtotalAfterDiscounts * (params.discountValue / 100) * 100) / 100;
      if (discountAmount <= 0) {
        return { success: false, error: "Obliczony rabat procentowy wynosi 0 PLN" };
      }
    } else {
      discountAmount = Math.round(params.discountValue * 100) / 100;
      if (discountAmount > subtotalAfterDiscounts) {
        return {
          success: false,
          error: `Rabat (${discountAmount.toFixed(2)} PLN) nie może przekraczać sumy do rabatowania (${subtotalAfterDiscounts.toFixed(2)} PLN). Zmniejsz kwotę rabatu.`,
        };
      }
    }

    const description =
      params.description?.trim() ||
      (params.discountType === "PERCENT"
        ? `Rabat ${params.discountValue}%`
        : `Rabat ${discountAmount.toFixed(2)} PLN`);

    const tx = await prisma.transaction.create({
      data: {
        reservationId: params.reservationId,
        amount: -discountAmount,
        type: "DISCOUNT",
        folioNumber: folioNum,
        description,
        quantity: 1,
        vatRate: 0,
        paymentMethod: null,
      },
    });

    await createAuditLog({
      actionType: "CREATE",
      entityType: "Transaction",
      entityId: tx.id,
      newValue: {
        reservationId: params.reservationId,
        folioNumber: folioNum,
        type: "DISCOUNT",
        discountScope: "RESERVATION" as FolioDiscountScope,
        discountType: params.discountType,
        discountValue: params.discountValue,
        discountAmount,
        description,
      } as unknown as Record<string, unknown>,
      ipAddress: ip,
    });

    revalidatePath("/finance");
    revalidatePath("/front-office");

    return {
      success: true,
      data: {
        transactionId: tx.id,
        discountAmount,
        discountScope: "RESERVATION",
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd dodawania rabatu do folio",
    };
  }
}

/**
 * Anuluje pozycję w folio (void). Gdy kwota transakcji przekracza limit użytkownika (maxVoidAmount), wymagany jest PIN managera.
 */
export async function voidFolioItem(
  params: {
    transactionId: string;
    reason: string;
    voidedBy?: string;
    managerPin?: string | null;
  }
): Promise<ActionResult<{ voided: boolean }>> {
  const headersList = await headers();
  const _ip = getClientIp(headersList);

  try {
    if (!params.transactionId || typeof params.transactionId !== "string") {
      return { success: false, error: "transactionId jest wymagane" };
    }
    if (!params.reason || typeof params.reason !== "string" || params.reason.trim().length === 0) {
      return { success: false, error: "reason jest wymagany" };
    }

    const transaction = await prisma.transaction.findUnique({
      where: { id: params.transactionId },
      include: { reservation: { select: { id: true } } },
    });

    if (!transaction) {
      return { success: false, error: "Nie znaleziono transakcji" };
    }

    if (transaction.status !== "ACTIVE") {
      return { success: false, error: `Nie można anulować transakcji o statusie ${transaction.status}` };
    }

    if (transaction.isReadOnly) {
      return { success: false, error: "Nie można anulować transakcji po Night Audit" };
    }

    if (transaction.invoiceId) {
      return { success: false, error: "Nie można anulować zafakturowanej transakcji" };
    }

    const amountAbs = Math.abs(Number(transaction.amount));
    let effectiveMaxVoid = DEFAULT_MAX_VOID_AMOUNT;
    const session = await getSession();
    if (session?.userId) {
      const user = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { maxVoidAmount: true, role: true },
      });
      if (user?.maxVoidAmount != null) effectiveMaxVoid = Number(user.maxVoidAmount);
      else if (user?.role === "MANAGER" || user?.role === "OWNER") effectiveMaxVoid = 999_999.99;
    }
    if (amountAbs > effectiveMaxVoid) {
      const pinResult = await verifyManagerPin(params.managerPin ?? "");
      if (!pinResult.success) {
        return {
          success: false,
          error: `Kwota anulowanej transakcji (${amountAbs.toFixed(2)} PLN) przekracza Twój limit (${effectiveMaxVoid.toFixed(2)} PLN). Wprowadź PIN managera.`,
        };
      }
    }

    const chargeAmount = Number(transaction.amount);
    const isCharge = chargeAmount > 0;

    // Przy anulowaniu obciążenia: anuluj też rabaty na pozycję przypisane do tej transakcji
    if (isCharge) {
      const lineItemDiscounts = await prisma.transaction.findMany({
        where: {
          type: "DISCOUNT",
          appliesToTransactionId: params.transactionId,
          status: "ACTIVE",
        },
      });
      const voidedAt = new Date();
      for (const disc of lineItemDiscounts) {
        await prisma.transaction.update({
          where: { id: disc.id },
          data: {
            status: "VOIDED",
            voidedAt,
            voidedBy: params.voidedBy,
            voidReason: `Anulowano wraz z pozycją ${params.transactionId}: ${params.reason}`,
          },
        });
        await createAuditLog({
          actionType: "UPDATE",
          entityType: "Transaction",
          entityId: transaction.reservationId ?? undefined,
          newValue: { message: `Anulowano rabat na pozycję (powiązany z pozycją): ${Number(disc.amount).toFixed(2)} PLN` },
        });
      }
    }
    
    await prisma.transaction.update({
      where: { id: params.transactionId },
      data: {
        status: "VOIDED",
        voidedAt: new Date(),
        voidedBy: params.voidedBy,
        voidReason: params.reason,
      },
    });
    
    await createAuditLog({
      actionType: "UPDATE",
      entityType: "Transaction",
      entityId: transaction.reservationId ?? undefined,
      newValue: { message: `Anulowano pozycję ${transaction.type}: ${Number(transaction.amount).toFixed(2)} PLN - ${params.reason}` },
    });
    
    revalidatePath("/finance");
    revalidatePath("/front-office");
    
    return {
      success: true,
      data: { voided: true },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd anulowania pozycji",
    };
  }
}

/**
 * Przenosi pozycję między folio tej samej rezerwacji
 */
export async function transferFolioItem(
  params: {
    transactionId: string;
    targetFolioNumber: number;
    transferredBy?: string;
  }
): Promise<ActionResult<{
  newTransactionId: string;
  oldFolioNumber: number;
  newFolioNumber: number;
}>> {
  try {
    if (!params.transactionId || typeof params.transactionId !== "string") {
      return { success: false, error: "transactionId jest wymagane" };
    }
    if (typeof params.targetFolioNumber !== "number" || params.targetFolioNumber < 1) {
      return { success: false, error: "targetFolioNumber musi być liczbą >= 1" };
    }
    
    const transaction = await prisma.transaction.findUnique({
      where: { id: params.transactionId },
    });
    
    if (!transaction) {
      return { success: false, error: "Nie znaleziono transakcji" };
    }
    
    if (transaction.status !== "ACTIVE") {
      return { success: false, error: `Nie można przenieść transakcji o statusie ${transaction.status}` };
    }
    
    if (transaction.folioNumber === params.targetFolioNumber) {
      return { success: false, error: "Transakcja jest już w tym folio" };
    }
    
    if (transaction.isReadOnly) {
      return { success: false, error: "Nie można przenieść transakcji po Night Audit" };
    }
    
    // Utwórz nową transakcję w docelowym folio
    const [, newTransaction] = await prisma.$transaction([
      // Oznacz starą jako przeniesioną
      prisma.transaction.update({
        where: { id: params.transactionId },
        data: {
          status: "TRANSFERRED",
          transferredTo: "PENDING", // Zaktualizujemy po utworzeniu nowej
        },
      }),
      // Utwórz nową transakcję
      prisma.transaction.create({
        data: {
          reservationId: transaction.reservationId,
          type: transaction.type,
          amount: transaction.amount,
          description: transaction.description,
          quantity: transaction.quantity,
          unitPrice: transaction.unitPrice,
          vatRate: transaction.vatRate,
          vatAmount: transaction.vatAmount,
          netAmount: transaction.netAmount,
          category: transaction.category,
          subcategory: transaction.subcategory,
          departmentCode: transaction.departmentCode,
          folioNumber: params.targetFolioNumber,
          paymentMethod: transaction.paymentMethod,
          paymentDetails: (transaction.paymentDetails ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          externalRef: transaction.externalRef,
          notes: `Przeniesione z folio ${transaction.folioNumber}`,
          postedBy: params.transferredBy,
          transferredFrom: params.transactionId,
          status: "ACTIVE",
        },
      }),
    ]);
    
    // Zaktualizuj referencję w starej transakcji
    await prisma.transaction.update({
      where: { id: params.transactionId },
      data: { transferredTo: newTransaction.id },
    });
    
    await createAuditLog({
      actionType: "UPDATE",
      entityType: "Transaction",
      entityId: transaction.reservationId ?? undefined,
      newValue: { message: `Przeniesiono pozycję ${transaction.type} z folio ${transaction.folioNumber} do ${params.targetFolioNumber}` },
    });
    
    revalidatePath("/finance");
    revalidatePath("/front-office");
    
    return {
      success: true,
      data: {
        newTransactionId: newTransaction.id,
        oldFolioNumber: transaction.folioNumber,
        newFolioNumber: params.targetFolioNumber,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd przenoszenia pozycji",
    };
  }
}

/**
 * Przenosi pozycję do folio innej rezerwacji
 */
export async function transferToAnotherReservation(
  params: {
    transactionId: string;
    targetReservationId: string;
    targetFolioNumber?: number;
    transferredBy?: string;
  }
): Promise<ActionResult<{
  newTransactionId: string;
  sourceReservationId: string;
  targetReservationId: string;
}>> {
  try {
    if (!params.transactionId || typeof params.transactionId !== "string") {
      return { success: false, error: "transactionId jest wymagane" };
    }
    if (!params.targetReservationId || typeof params.targetReservationId !== "string") {
      return { success: false, error: "targetReservationId jest wymagane" };
    }
    
    const transaction = await prisma.transaction.findUnique({
      where: { id: params.transactionId },
    });
    
    if (!transaction) {
      return { success: false, error: "Nie znaleziono transakcji" };
    }
    
    if (transaction.status !== "ACTIVE") {
      return { success: false, error: `Nie można przenieść transakcji o statusie ${transaction.status}` };
    }
    
    if (transaction.reservationId === params.targetReservationId) {
      return { success: false, error: "Użyj transferFolioItem do przeniesienia w ramach tej samej rezerwacji" };
    }
    
    // Sprawdź czy docelowa rezerwacja istnieje
    const targetReservation = await prisma.reservation.findUnique({
      where: { id: params.targetReservationId },
      select: { id: true, status: true },
    });
    
    if (!targetReservation) {
      return { success: false, error: "Nie znaleziono docelowej rezerwacji" };
    }
    
    if (targetReservation.status === "CANCELLED") {
      return { success: false, error: "Nie można przenieść do anulowanej rezerwacji" };
    }
    
    // Wykonaj przeniesienie
    const [, newTransaction] = await prisma.$transaction([
      prisma.transaction.update({
        where: { id: params.transactionId },
        data: {
          status: "TRANSFERRED",
          transferredTo: "PENDING",
          notes: (transaction.notes || "") + `\nPrzeniesione do rezerwacji ${params.targetReservationId}`,
        },
      }),
      prisma.transaction.create({
        data: {
          reservationId: params.targetReservationId,
          type: transaction.type,
          amount: transaction.amount,
          description: transaction.description,
          quantity: transaction.quantity,
          unitPrice: transaction.unitPrice,
          vatRate: transaction.vatRate,
          vatAmount: transaction.vatAmount,
          netAmount: transaction.netAmount,
          category: transaction.category,
          subcategory: transaction.subcategory,
          departmentCode: transaction.departmentCode,
          folioNumber: params.targetFolioNumber ?? 1,
          paymentMethod: transaction.paymentMethod,
          paymentDetails: (transaction.paymentDetails ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          externalRef: transaction.externalRef,
          notes: `Przeniesione z rezerwacji ${transaction.reservationId}`,
          postedBy: params.transferredBy,
          transferredFrom: params.transactionId,
          status: "ACTIVE",
        },
      }),
    ]);
    
    await prisma.transaction.update({
      where: { id: params.transactionId },
      data: { transferredTo: newTransaction.id },
    });
    
    await createAuditLog({
      actionType: "UPDATE",
      entityType: "Transaction",
      entityId: transaction.reservationId ?? undefined,
      newValue: { message: `Przeniesiono pozycję ${transaction.type}: ${Number(transaction.amount).toFixed(2)} PLN do rezerwacji ${params.targetReservationId}` },
    });
    
    revalidatePath("/finance");
    revalidatePath("/front-office");
    
    return {
      success: true,
      data: {
        newTransactionId: newTransaction.id,
        sourceReservationId: transaction.reservationId,
        targetReservationId: params.targetReservationId,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd przenoszenia pozycji",
    };
  }
}

/**
 * Tworzy nowy folio (split folio). Opcjonalnie ustawia płatnika (gość/firma).
 */
export async function createNewFolio(params: {
  reservationId: string;
  billTo?: FolioBillTo;
  guestId?: string | null;
  companyId?: string | null;
  label?: string | null;
}): Promise<ActionResult<{ folioNumber: number }>> {
  try {
    const { reservationId, billTo, guestId, companyId, label } = params;
    if (!reservationId || typeof reservationId !== "string") {
      return { success: false, error: "reservationId jest wymagane" };
    }

    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      select: {
        id: true,
        guestId: true,
        reservationOccupants: { select: { guestId: true } },
      },
    });
    if (!reservation) {
      return { success: false, error: "Nie znaleziono rezerwacji" };
    }

    if (billTo === "COMPANY" && (!companyId || typeof companyId !== "string")) {
      return { success: false, error: "Dla płatnika Firma należy podać companyId" };
    }
    if (billTo === "COMPANY" && companyId) {
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { id: true },
      });
      if (!company) {
        return { success: false, error: "Nie znaleziono firmy o podanym companyId" };
      }
    }
    if (billTo === "GUEST" && guestId) {
      const isPrimary = reservation.guestId === guestId;
      const isOccupant = reservation.reservationOccupants.some((o) => o.guestId === guestId);
      if (!isPrimary && !isOccupant) {
        return { success: false, error: "Wybrany gość nie należy do tej rezerwacji" };
      }
    }

    // Znajdź najwyższy numer folio
    const maxFolioResult = await prisma.transaction.aggregate({
      where: { reservationId },
      _max: { folioNumber: true },
    });
    const maxFromAssignments = await prisma.reservationFolio.aggregate({
      where: { reservationId },
      _max: { folioNumber: true },
    });
    const newFolioNumber =
      Math.max(
        maxFolioResult._max.folioNumber ?? 0,
        maxFromAssignments._max.folioNumber ?? 0
      ) + 1;

    if (newFolioNumber > 10) {
      return { success: false, error: "Maksymalna liczba folio to 10" };
    }

    if (billTo) {
      await prisma.reservationFolio.upsert({
        where: {
          reservationId_folioNumber: { reservationId, folioNumber: newFolioNumber },
        },
        create: {
          reservationId,
          folioNumber: newFolioNumber,
          billTo,
          guestId: billTo === "GUEST" ? (guestId ?? null) : null,
          companyId: billTo === "COMPANY" ? companyId ?? undefined : null,
          label: label ?? null,
        },
        update: {
          billTo,
          guestId: billTo === "GUEST" ? (guestId ?? null) : null,
          companyId: billTo === "COMPANY" ? companyId ?? null : null,
          label: label ?? null,
        },
      });
    }

    await createAuditLog({
      actionType: "CREATE",
      entityType: "ReservationFolio",
      entityId: reservationId,
      newValue: { message: `Utworzono nowy folio #${newFolioNumber}${billTo ? ` (płatnik: ${billTo === "COMPANY" ? "Firma" : "Gość"})` : ""}` },
    });

    return {
      success: true,
      data: { folioNumber: newFolioNumber },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd tworzenia nowego folio",
    };
  }
}

/**
 * Pobiera przypisania płatników do folio (split folio) dla rezerwacji.
 */
export async function getFolioAssignments(
  reservationId: string
): Promise<ActionResult<FolioAssignmentData[]>> {
  try {
    if (!reservationId || typeof reservationId !== "string") {
      return { success: false, error: "reservationId jest wymagane" };
    }
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      select: { id: true },
    });
    if (!reservation) {
      return { success: false, error: "Nie znaleziono rezerwacji" };
    }

    const list = await prisma.reservationFolio.findMany({
      where: { reservationId },
      include: {
        company: { select: { id: true, name: true } },
        guest: { select: { id: true, name: true } },
      },
      orderBy: { folioNumber: "asc" },
    });

    const data: FolioAssignmentData[] = list.map((a) => ({
      folioNumber: a.folioNumber,
      billTo: a.billTo as FolioBillTo,
      guestId: a.guestId,
      guestName: a.guest?.name ?? null,
      companyId: a.companyId,
      companyName: a.company?.name ?? null,
      label: a.label,
    }));

    return { success: true, data };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania przypisań folio",
    };
  }
}

/**
 * Ustawia lub aktualizuje płatnika dla danego folio (split folio: gość / firma; separate checks: który gość).
 * Walidacja: przy billTo=COMPANY wymagane companyId; przy billTo=GUEST opcjonalnie guestId (null = główny gość).
 */
export async function setFolioAssignment(params: {
  reservationId: string;
  folioNumber: number;
  billTo: FolioBillTo;
  guestId?: string | null;
  companyId?: string | null;
  label?: string | null;
}): Promise<ActionResult<FolioAssignmentData>> {
  try {
    const { reservationId, folioNumber, billTo, guestId, companyId, label } = params;

    if (!reservationId || typeof reservationId !== "string") {
      return { success: false, error: "reservationId jest wymagane" };
    }
    if (typeof folioNumber !== "number" || folioNumber < 1 || folioNumber > 10) {
      return { success: false, error: "folioNumber musi być liczbą od 1 do 10" };
    }
    if (!FOLIO_BILL_TO.includes(billTo)) {
      return { success: false, error: "billTo musi być GUEST lub COMPANY" };
    }

    if (billTo === "COMPANY") {
      if (!companyId || typeof companyId !== "string") {
        return { success: false, error: "Dla płatnika Firma należy podać companyId" };
      }
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { id: true, name: true },
      });
      if (!company) {
        return { success: false, error: "Nie znaleziono firmy o podanym companyId" };
      }
    }

    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      select: {
        id: true,
        guestId: true,
        reservationOccupants: { select: { guestId: true } },
      },
    });
    if (!reservation) {
      return { success: false, error: "Nie znaleziono rezerwacji" };
    }

    if (billTo === "GUEST" && guestId != null && guestId !== "") {
      const isPrimary = reservation.guestId === guestId;
      const isOccupant = reservation.reservationOccupants.some((o) => o.guestId === guestId);
      if (!isPrimary && !isOccupant) {
        return { success: false, error: "Wybrany gość nie należy do tej rezerwacji (główny gość lub osoba w pokoju)" };
      }
      const guest = await prisma.guest.findUnique({
        where: { id: guestId },
        select: { id: true, name: true },
      });
      if (!guest) {
        return { success: false, error: "Nie znaleziono gościa" };
      }
    }

    const assignment = await prisma.reservationFolio.upsert({
      where: {
        reservationId_folioNumber: { reservationId, folioNumber },
      },
      create: {
        reservationId,
        folioNumber,
        billTo,
        guestId: billTo === "GUEST" ? (guestId ?? null) : null,
        companyId: billTo === "COMPANY" ? companyId : null,
        label: label ?? null,
      },
      update: {
        billTo,
        guestId: billTo === "GUEST" ? (guestId ?? null) : null,
        companyId: billTo === "COMPANY" ? companyId : null,
        label: label ?? null,
      },
      include: {
        company: { select: { id: true, name: true } },
        guest: { select: { id: true, name: true } },
      },
    });

    await createAuditLog({
      actionType: "UPDATE",
      entityType: "ReservationFolio",
      entityId: reservationId,
      newValue: { message: `Ustawiono płatnika folio #${folioNumber}: ${billTo === "COMPANY" ? assignment.company?.name ?? companyId : "Gość"}` },
    });

    revalidatePath("/finance");
    revalidatePath("/front-office");

    return {
      success: true,
      data: {
        folioNumber: assignment.folioNumber,
        billTo: assignment.billTo as FolioBillTo,
        guestId: assignment.guestId,
        guestName: assignment.guest?.name ?? null,
        companyId: assignment.companyId,
        companyName: assignment.company?.name ?? null,
        label: assignment.label,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd ustawiania przypisania folio",
    };
  }
}

/**
 * Pobiera listę gości rezerwacji (główny + osoby w pokoju) do wyboru płatnika folio (separate checks).
 */
export async function getReservationGuestsForFolio(
  reservationId: string
): Promise<ActionResult<ReservationGuestForFolio[]>> {
  try {
    if (!reservationId || typeof reservationId !== "string") {
      return { success: false, error: "reservationId jest wymagane" };
    }
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      select: {
        guestId: true,
        guest: { select: { id: true, name: true } },
        reservationOccupants: { include: { guest: { select: { id: true, name: true } } } },
      },
    });
    if (!reservation) {
      return { success: false, error: "Nie znaleziono rezerwacji" };
    }
    const list: ReservationGuestForFolio[] = [];
    if (reservation.guest) {
      list.push({
        guestId: reservation.guest.id,
        name: reservation.guest.name,
        isPrimary: true,
      });
    }
    for (const occ of reservation.reservationOccupants) {
      list.push({
        guestId: occ.guest.id,
        name: occ.guest.name,
        isPrimary: false,
      });
    }
    return { success: true, data: list };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania gości rezerwacji",
    };
  }
}

/**
 * Dodaje gościa do pokoju (osoba w rezerwacji – do osobnych rachunków).
 */
export async function addReservationOccupant(
  reservationId: string,
  guestId: string
): Promise<ActionResult<{ id: string }>> {
  try {
    if (!reservationId || !guestId) {
      return { success: false, error: "reservationId i guestId są wymagane" };
    }
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      select: { id: true, guestId: true },
    });
    if (!reservation) {
      return { success: false, error: "Nie znaleziono rezerwacji" };
    }
    if (reservation.guestId === guestId) {
      return { success: false, error: "Ten gość jest już głównym gościem rezerwacji" };
    }
    const guest = await prisma.guest.findUnique({
      where: { id: guestId },
      select: { id: true },
    });
    if (!guest) {
      return { success: false, error: "Nie znaleziono gościa" };
    }
    const existing = await prisma.reservationOccupant.findUnique({
      where: {
        reservationId_guestId: { reservationId, guestId },
      },
    });
    if (existing) {
      return { success: false, error: "Ten gość jest już dodany do pokoju" };
    }
    const occupant = await prisma.reservationOccupant.create({
      data: { reservationId, guestId },
    });
    await createAuditLog({
      actionType: "CREATE",
      entityType: "ReservationOccupant",
      entityId: reservationId,
      newValue: { message: "Dodano gościa do pokoju (separate checks)" },
    });
    revalidatePath("/finance");
    revalidatePath("/front-office");
    return { success: true, data: { id: occupant.id } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd dodawania gościa do pokoju",
    };
  }
}

/**
 * Usuwa gościa z listy osób w pokoju (reservation occupant).
 */
export async function removeReservationOccupant(
  reservationId: string,
  guestId: string
): Promise<ActionResult<void>> {
  try {
    if (!reservationId || !guestId) {
      return { success: false, error: "reservationId i guestId są wymagane" };
    }
    const deleted = await prisma.reservationOccupant.deleteMany({
      where: { reservationId, guestId },
    });
    if (deleted.count === 0) {
      return { success: false, error: "Nie znaleziono takiego gościa w pokoju" };
    }
    await createAuditLog({
      actionType: "DELETE",
      entityType: "ReservationOccupant",
      entityId: reservationId,
      newValue: { message: "Usunięto gościa z listy osób w pokoju" },
    });
    revalidatePath("/finance");
    revalidatePath("/front-office");
    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd usuwania gościa z pokoju",
    };
  }
}

/**
 * Generuje wyciąg z folio (statement)
 */
export async function generateFolioStatement(
  params: {
    reservationId: string;
    folioNumber?: number;
    includeVoided?: boolean;
  }
): Promise<ActionResult<{
  reservationId: string;
  guestName: string;
  roomNumber: string | null;
  checkIn: Date;
  checkOut: Date;
  folioNumber: number;
  generatedAt: Date;
  items: Array<{
    date: string;
    description: string;
    reference: string | null;
    charges: number;
    payments: number;
    balance: number;
  }>;
  summary: {
    totalCharges: number;
    totalPayments: number;
    balance: number;
    vatBreakdown: Array<{ rate: number; net: number; vat: number; gross: number }>;
  };
}>> {
  try {
    if (!params.reservationId || typeof params.reservationId !== "string") {
      return { success: false, error: "reservationId jest wymagane" };
    }
    
    // Pobierz rezerwację
    const reservation = await prisma.reservation.findUnique({
      where: { id: params.reservationId },
      select: {
        checkIn: true,
        checkOut: true,
        room: { select: { number: true } },
        guest: { select: { name: true } },
      },
    });
    
    if (!reservation) {
      return { success: false, error: "Nie znaleziono rezerwacji" };
    }
    
    // Pobierz transakcje
    const where: Record<string, unknown> = {
      reservationId: params.reservationId,
    };
    if (params.folioNumber !== undefined) {
      where.folioNumber = params.folioNumber;
    }
    if (!params.includeVoided) {
      where.status = "ACTIVE";
    }
    
    const transactions = await prisma.transaction.findMany({
      where,
      orderBy: { postedAt: "asc" },
    });
    
    // Przygotuj pozycje wyciągu
    let runningBalance = 0;
    const vatMap = new Map<number, { net: number; vat: number; gross: number }>();
    
    const items = transactions.map((tx) => {
      const amount = Number(tx.amount);
      const charges = amount > 0 ? amount : 0;
      const payments = amount < 0 ? Math.abs(amount) : 0;
      runningBalance += amount;
      
      // Grupuj VAT
      if (charges > 0 && tx.status === "ACTIVE") {
        const rate = Number(tx.vatRate);
        const current = vatMap.get(rate) || { net: 0, vat: 0, gross: 0 };
        current.gross += charges;
        current.net += tx.netAmount ? Number(tx.netAmount) : 0;
        current.vat += tx.vatAmount ? Number(tx.vatAmount) : 0;
        vatMap.set(rate, current);
      }
      
      return {
        date: tx.postedAt.toISOString().split("T")[0],
        description: tx.description || tx.type,
        reference: tx.externalRef,
        charges: Math.round(charges * 100) / 100,
        payments: Math.round(payments * 100) / 100,
        balance: Math.round(runningBalance * 100) / 100,
      };
    });
    
    // Podsumowanie
    const totalCharges = items.reduce((sum, i) => sum + i.charges, 0);
    const totalPayments = items.reduce((sum, i) => sum + i.payments, 0);
    
    const vatBreakdown = Array.from(vatMap.entries())
      .map(([rate, data]) => ({
        rate,
        net: Math.round(data.net * 100) / 100,
        vat: Math.round(data.vat * 100) / 100,
        gross: Math.round(data.gross * 100) / 100,
      }))
      .sort((a, b) => a.rate - b.rate);
    
    return {
      success: true,
      data: {
        reservationId: params.reservationId,
        guestName: reservation.guest?.name ?? "",
        roomNumber: reservation.room?.number || null,
        checkIn: reservation.checkIn,
        checkOut: reservation.checkOut,
        folioNumber: params.folioNumber ?? 0,
        generatedAt: new Date(),
        items,
        summary: {
          totalCharges: Math.round(totalCharges * 100) / 100,
          totalPayments: Math.round(totalPayments * 100) / 100,
          balance: Math.round(runningBalance * 100) / 100,
          vatBreakdown,
        },
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd generowania wyciągu",
    };
  }
}

/**
 * Pobiera statystyki folio dla dashboardu
 */
export async function getFolioStatistics(
  params?: {
    date?: Date;
    periodFrom?: Date;
    periodTo?: Date;
  }
): Promise<ActionResult<{
  totalOpenFolios: number;
  totalBalance: number;
  todayCharges: number;
  todayPayments: number;
  byCategory: Array<{ category: string; amount: number; count: number }>;
  byPaymentMethod: Array<{ method: string; amount: number; count: number }>;
}>> {
  try {
    const today = params?.date || new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);
    
    // Pobierz aktywne rezerwacje z saldem
    const activeReservations = await prisma.reservation.findMany({
      where: {
        status: { in: ["CONFIRMED", "CHECKED_IN"] },
      },
      include: {
        transactions: {
          where: { status: "ACTIVE" },
        },
      },
    });
    
    // Oblicz statystyki
    let totalOpenFolios = 0;
    let totalBalance = 0;
    
    for (const res of activeReservations) {
      const balance = res.transactions.reduce((sum, tx) => sum + Number(tx.amount), 0);
      if (balance !== 0) {
        totalOpenFolios++;
        totalBalance += balance;
      }
    }
    
    // Pobierz dzisiejsze transakcje
    const todayTransactions = await prisma.transaction.findMany({
      where: {
        status: "ACTIVE",
        postedAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });
    
    let todayCharges = 0;
    let todayPayments = 0;
    const categoryMap = new Map<string, { amount: number; count: number }>();
    const paymentMethodMap = new Map<string, { amount: number; count: number }>();
    
    for (const tx of todayTransactions) {
      const amount = Number(tx.amount);
      
      if (amount > 0) {
        todayCharges += amount;
        
        // Grupuj po kategorii
        const cat = tx.category || "OTHER";
        const catCurrent = categoryMap.get(cat) || { amount: 0, count: 0 };
        catCurrent.amount += amount;
        catCurrent.count++;
        categoryMap.set(cat, catCurrent);
      } else {
        todayPayments += Math.abs(amount);
        
        // Grupuj po metodzie płatności
        const method = tx.paymentMethod || "OTHER";
        const pmCurrent = paymentMethodMap.get(method) || { amount: 0, count: 0 };
        pmCurrent.amount += Math.abs(amount);
        pmCurrent.count++;
        paymentMethodMap.set(method, pmCurrent);
      }
    }
    
    return {
      success: true,
      data: {
        totalOpenFolios,
        totalBalance: Math.round(totalBalance * 100) / 100,
        todayCharges: Math.round(todayCharges * 100) / 100,
        todayPayments: Math.round(todayPayments * 100) / 100,
        byCategory: Array.from(categoryMap.entries()).map(([category, data]) => ({
          category,
          amount: Math.round(data.amount * 100) / 100,
          count: data.count,
        })),
        byPaymentMethod: Array.from(paymentMethodMap.entries()).map(([method, data]) => ({
          method,
          amount: Math.round(data.amount * 100) / 100,
          count: data.count,
        })),
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania statystyk folio",
    };
  }
}
