import * as net from "net";
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
} from "./types";

const STX = 0x02;
const ETX = 0x03;
const SEP = ",";

/** Polecenia protokołu Novitus (ramki bajtowe STX+cmd+data+LRC+ETX). */
const CMD_OPEN_RECEIPT = 0x50; // P – otwarcie paragonu fiskalnego
const CMD_SALE_LINE = 0x4c; // L – pozycja sprzedaży (nazwa, ilość, cena)
const CMD_PAYMENT = 0x4e; // N – wpłata (typ, kwota)
const CMD_CLOSE_RECEIPT = 0x5a; // Z – zamknięcie paragonu
const CMD_OPEN_INVOICE = 0x46; // F – otwarcie faktury
const CMD_INVOICE_BUYER = 0x42; // B – nabywca (NIP, nazwa, adres)
const CMD_INVOICE_LINE = 0x4c; // L – pozycja faktury
const CMD_CLOSE_INVOICE = 0x5a; // Z – zamknięcie faktury
const CMD_X_REPORT = 0x58; // X – raport X (niefiskalny)
const CMD_Z_REPORT = 0x44; // D – raport dobowy Z (fiskalny)
const CMD_PERIODIC_REPORT = 0x4f; // O – raport okresowy (Periodic)
const CMD_STORNO_OPEN = 0x53; // S – otwarcie dokumentu storna
const CMD_STORNO_LINE = 0x54; // T – pozycja storna
const CMD_STORNO_CLOSE = 0x55; // U – zamknięcie storna

const host = process.env.FISCAL_NOVITUS_HOST ?? "";
const port = Number(process.env.FISCAL_NOVITUS_PORT ?? "0") || 0;
const timeoutMs = Number(process.env.FISCAL_NOVITUS_TIMEOUT_MS ?? "5000") || 5000;

/** Maksymalna liczba prób połączenia przy błędzie */
const MAX_RETRIES = 3;
/** Opóźnienie między próbami (ms) */
const RETRY_DELAY_MS = 1000;

/** Pomocnicza funkcja do opóźnień */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Wykonuje operację z retry (maksymalnie MAX_RETRIES prób) */
async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await operation();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(
        `[Novitus] ${operationName} - próba ${attempt}/${MAX_RETRIES} nie powiodła się: ${lastError.message}`
      );
      
      if (attempt < MAX_RETRIES) {
        await delay(RETRY_DELAY_MS);
      }
    }
  }
  
  throw new Error(
    `[Novitus] ${operationName} nie powiodło się po ${MAX_RETRIES} próbach: ${lastError?.message ?? "Nieznany błąd"}`
  );
}

function buildLrc(buffer: number[]): number {
  let lrc = 0;
  for (let i = 0; i < buffer.length; i++) {
    lrc ^= buffer[i];
  }
  return lrc & 0xff;
}

/** Buduje ramkę: STX + cmd + data (ASCII) + LRC + ETX. LRC = XOR bajtów (cmd + data). */
function buildFrame(cmd: number, data: string): Buffer {
  const dataBytes = Array.from(Buffer.from(data, "utf8"));
  const payload = [cmd, ...dataBytes];
  const lrc = buildLrc(payload);
  return Buffer.from([STX, ...payload, lrc, ETX]);
}

function sendFrame(socket: net.Socket, frame: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const onData = (chunk: Buffer) => {
      chunks.push(chunk);
      if (chunk.includes(ETX)) {
        cleanup();
        resolve(Buffer.concat(chunks));
      }
    };
    const onError = (err: Error) => {
      cleanup();
      reject(err);
    };
    const onEnd = () => {
      cleanup();
      resolve(Buffer.concat(chunks));
    };
    const cleanup = () => {
      socket.removeListener("data", onData);
      socket.removeListener("error", onError);
      socket.removeListener("end", onEnd);
    };
    socket.on("data", onData);
    socket.once("error", onError);
    socket.once("end", onEnd);
    socket.write(frame);
  });
}

function connect(): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const s = net.createConnection(
      { host, port },
      () => resolve(s)
    );
    s.setTimeout(timeoutMs);
    s.on("timeout", () => {
      s.destroy();
      reject(new Error("Novitus: timeout połączenia"));
    });
    s.once("error", reject);
  });
}

/** Typowe kody błędów drukarki Novitus */
const NOVITUS_ERROR_CODES: Record<string, string> = {
  "1": "Błąd składni polecenia",
  "2": "Brak papieru",
  "3": "Błąd mechanizmu drukującego",
  "4": "Brak odpowiedzi od drukarki",
  "5": "Błąd pamięci fiskalnej",
  "6": "Przepełnienie bufora",
  "7": "Błąd ceny (wartość ujemna lub zero)",
  "8": "Błąd ilości (wartość ujemna lub zero)",
  "9": "Przekroczona maksymalna ilość pozycji",
  "10": "Nieobsługiwana stawka VAT",
  "11": "Błąd danych nabywcy (NIP)",
  "12": "Przekroczony limit dzienny",
  "13": "Wymagany raport dobowy",
  "14": "Drukarka w trybie fiskalnym",
  "15": "Drukarka nie w trybie fiskalnym",
  "16": "Błąd daty/czasu",
  "17": "Błąd połączenia sieciowego",
  "18": "Błąd autoryzacji",
  "99": "Nieznany błąd drukarki",
};

/** Wynik parsowania odpowiedzi z drukarki */
interface ParsedResponse {
  success: boolean;
  receiptNumber?: string;
  errorCode?: string;
  errorMessage?: string;
}

/** 
 * Parsuje odpowiedź z drukarki Novitus.
 * Format: "kod_błędu;numer_paragonu" lub "OK;numer" lub "ERR;kod"
 */
function parseResponse(response: Buffer): ParsedResponse {
  const str = response.toString("utf8").replace(/\x02|\x03/g, "").trim();
  const parts = str.split(";");
  
  // Format: "0;12345" gdzie 0 = sukces, inne = błąd
  if (parts.length >= 2) {
    const code = parts[0].trim().toUpperCase();
    const value = parts[1].trim();
    
    // Sukces: kod 0 lub OK
    if (code === "0" || code === "OK") {
      return {
        success: true,
        receiptNumber: /^\d+$/.test(value) ? value : undefined,
      };
    }
    
    // Błąd: kod numeryczny lub ERR
    const errorCode = code === "ERR" ? value : code;
    const errorMessage = NOVITUS_ERROR_CODES[errorCode] || `Błąd drukarki: ${errorCode}`;
    return {
      success: false,
      errorCode,
      errorMessage,
    };
  }
  
  // Pojedyncza wartość - zakładamy numer paragonu
  if (/^\d+$/.test(str)) {
    return { success: true, receiptNumber: str };
  }
  
  // Brak rozpoznanego formatu
  return { success: true };
}

/** Parsuje numer paragonu/faktury z odpowiedzi (np. "0;12345" lub "OK;12345"). */
function parseReceiptNumber(response: Buffer): string | undefined {
  const parsed = parseResponse(response);
  return parsed.receiptNumber;
}

async function printReceiptImpl(request: FiscalReceiptRequest): Promise<FiscalReceiptResult> {
  if (!host || port <= 0) {
    return {
      success: false,
      error: "Skonfiguruj FISCAL_NOVITUS_HOST i FISCAL_NOVITUS_PORT",
      errorCode: "CONFIG_ERROR",
    };
  }

  try {
    return await withRetry(async () => {
      const socket = await connect();
      try {
        // Otwarcie paragonu fiskalnego
        const openResp = await sendFrame(socket, buildFrame(CMD_OPEN_RECEIPT, ""));
        const openParsed = parseResponse(openResp);
        if (!openParsed.success) {
          return {
            success: false,
            error: openParsed.errorMessage || "Błąd otwarcia paragonu",
            errorCode: openParsed.errorCode,
          };
        }

        for (const item of request.items) {
          const line = [item.name, String(item.quantity), item.unitPrice.toFixed(2)].join(SEP);
          const lineResp = await sendFrame(socket, buildFrame(CMD_SALE_LINE, line));
          const lineParsed = parseResponse(lineResp);
          if (!lineParsed.success) {
            return {
              success: false,
              error: lineParsed.errorMessage || `Błąd pozycji: ${item.name}`,
              errorCode: lineParsed.errorCode,
            };
          }
        }

        const payType = request.paymentType === "CASH" ? "G" : request.paymentType === "CARD" ? "K" : "G";
        const payLine = [payType, request.totalAmount.toFixed(2)].join(SEP);
        const payResp = await sendFrame(socket, buildFrame(CMD_PAYMENT, payLine));
        const payParsed = parseResponse(payResp);
        if (!payParsed.success) {
          return {
            success: false,
            error: payParsed.errorMessage || "Błąd płatności",
            errorCode: payParsed.errorCode,
          };
        }

        const closeResp = await sendFrame(socket, buildFrame(CMD_CLOSE_RECEIPT, ""));
        const closeParsed = parseResponse(closeResp);
        if (!closeParsed.success) {
          return {
            success: false,
            error: closeParsed.errorMessage || "Błąd zamknięcia paragonu",
            errorCode: closeParsed.errorCode,
          };
        }
        
        return {
          success: true,
          receiptNumber: closeParsed.receiptNumber ? `NOV-${closeParsed.receiptNumber}` : undefined,
        };
      } finally {
        socket.destroy();
      }
    }, "drukowanie paragonu");
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Błąd komunikacji z kasą Novitus";
    return {
      success: false,
      error: errorMessage,
      errorCode: errorMessage.includes("timeout") ? "TIMEOUT" : "CONNECTION_ERROR",
    };
  }
}

async function printInvoiceImpl(request: FiscalInvoiceRequest): Promise<FiscalInvoiceResult> {
  if (!host || port <= 0) {
    return {
      success: false,
      error: "Skonfiguruj FISCAL_NOVITUS_HOST i FISCAL_NOVITUS_PORT",
      errorCode: "CONFIG_ERROR",
    };
  }

  try {
    return await withRetry(async () => {
      const socket = await connect();
      try {
        const openResp = await sendFrame(socket, buildFrame(CMD_OPEN_INVOICE, ""));
        const openParsed = parseResponse(openResp);
        if (!openParsed.success) {
          return {
            success: false,
            error: openParsed.errorMessage || "Błąd otwarcia faktury",
            errorCode: openParsed.errorCode,
          };
        }

        const buyerLine = [
          request.company.nip.replace(/\s/g, ""),
          request.company.name,
          [request.company.address, request.company.postalCode, request.company.city]
            .filter(Boolean)
            .join(" "),
        ].join(SEP);
        const buyerResp = await sendFrame(socket, buildFrame(CMD_INVOICE_BUYER, buyerLine));
        const buyerParsed = parseResponse(buyerResp);
        if (!buyerParsed.success) {
          return {
            success: false,
            error: buyerParsed.errorMessage || "Błąd danych nabywcy",
            errorCode: buyerParsed.errorCode,
          };
        }

        for (const item of request.items) {
          const line = [item.name, String(item.quantity), item.unitPrice.toFixed(2)].join(SEP);
          const lineResp = await sendFrame(socket, buildFrame(CMD_INVOICE_LINE, line));
          const lineParsed = parseResponse(lineResp);
          if (!lineParsed.success) {
            return {
              success: false,
              error: lineParsed.errorMessage || `Błąd pozycji: ${item.name}`,
              errorCode: lineParsed.errorCode,
            };
          }
        }

        const closeResp = await sendFrame(socket, buildFrame(CMD_CLOSE_INVOICE, ""));
        const closeParsed = parseResponse(closeResp);
        if (!closeParsed.success) {
          return {
            success: false,
            error: closeParsed.errorMessage || "Błąd zamknięcia faktury",
            errorCode: closeParsed.errorCode,
          };
        }
        
        return {
          success: true,
          invoiceNumber: closeParsed.receiptNumber ? `NOV-FV-${closeParsed.receiptNumber}` : undefined,
        };
      } finally {
        socket.destroy();
      }
    }, "drukowanie faktury");
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Błąd druku faktury Novitus";
    return {
      success: false,
      error: errorMessage,
      errorCode: errorMessage.includes("timeout") ? "TIMEOUT" : "CONNECTION_ERROR",
    };
  }
}

/**
 * Drukuje raport X (niefiskalny) – informacyjny, nie zamyka dnia.
 */
async function printXReportImpl(request?: FiscalReportRequest): Promise<FiscalReportResult> {
  if (!host || port <= 0) {
    return {
      success: false,
      error: "Skonfiguruj FISCAL_NOVITUS_HOST i FISCAL_NOVITUS_PORT",
      errorCode: "CONFIG_ERROR",
    };
  }

  try {
    return await withRetry(async () => {
      const socket = await connect();
      try {
        // Wyślij polecenie raportu X
        const reportResp = await sendFrame(socket, buildFrame(CMD_X_REPORT, ""));
        const reportParsed = parseResponse(reportResp);

        if (!reportParsed.success) {
          return {
            success: false,
            error: reportParsed.errorMessage || "Błąd drukowania raportu X",
            errorCode: reportParsed.errorCode,
          };
        }

        return {
          success: true,
          reportNumber: reportParsed.receiptNumber ? `NOV-X-${reportParsed.receiptNumber}` : undefined,
        };
      } finally {
        socket.destroy();
      }
    }, "drukowanie raportu X");
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Błąd komunikacji z kasą Novitus";
    return {
      success: false,
      error: errorMessage,
      errorCode: errorMessage.includes("timeout") ? "TIMEOUT" : "CONNECTION_ERROR",
    };
  }
}

/**
 * Drukuje raport Z (fiskalny) – zamyka dobę, zeruje liczniki.
 * UWAGA: Operacja nieodwracalna, wymagana prawem raz dziennie.
 */
async function printZReportImpl(request?: FiscalReportRequest): Promise<FiscalReportResult> {
  if (!host || port <= 0) {
    return {
      success: false,
      error: "Skonfiguruj FISCAL_NOVITUS_HOST i FISCAL_NOVITUS_PORT",
      errorCode: "CONFIG_ERROR",
    };
  }

  try {
    return await withRetry(async () => {
      const socket = await connect();
      try {
        // Wyślij polecenie raportu Z (dobowego)
        const reportResp = await sendFrame(socket, buildFrame(CMD_Z_REPORT, ""));
        const reportParsed = parseResponse(reportResp);

        if (!reportParsed.success) {
          return {
            success: false,
            error: reportParsed.errorMessage || "Błąd drukowania raportu Z",
            errorCode: reportParsed.errorCode,
          };
        }

        return {
          success: true,
          reportNumber: reportParsed.receiptNumber ? `NOV-Z-${reportParsed.receiptNumber}` : undefined,
        };
      } finally {
        socket.destroy();
      }
    }, "drukowanie raportu Z");
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Błąd komunikacji z kasą Novitus";
    return {
      success: false,
      error: errorMessage,
      errorCode: errorMessage.includes("timeout") ? "TIMEOUT" : "CONNECTION_ERROR",
    };
  }
}

/**
 * Drukuje raport okresowy/miesięczny – zestawienie raportów Z z wybranego okresu.
 */
async function printPeriodicReportImpl(request: PeriodicReportRequest): Promise<PeriodicReportResult> {
  if (!host || port <= 0) {
    return {
      success: false,
      error: "Skonfiguruj FISCAL_NOVITUS_HOST i FISCAL_NOVITUS_PORT",
      errorCode: "CONFIG_ERROR",
    };
  }

  try {
    return await withRetry(async () => {
      const socket = await connect();
      try {
        // Format daty dla Novitus: RRRRMMDD
        const formatDate = (d: Date) => {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, "0");
          const day = String(d.getDate()).padStart(2, "0");
          return `${year}${month}${day}`;
        };

        // Ustal zakres dat
        let dateFrom: Date;
        let dateTo: Date;

        if (request.reportType === "MONTHLY" && request.month && request.year) {
          dateFrom = new Date(request.year, request.month - 1, 1);
          dateTo = new Date(request.year, request.month, 0); // Ostatni dzień miesiąca
        } else {
          dateFrom = new Date(request.dateFrom);
          dateTo = new Date(request.dateTo);
        }

        // Wyślij polecenie raportu okresowego z zakresem dat
        const dateRange = `${formatDate(dateFrom)}${SEP}${formatDate(dateTo)}`;
        const reportResp = await sendFrame(socket, buildFrame(CMD_PERIODIC_REPORT, dateRange));
        const reportParsed = parseResponse(reportResp);

        if (!reportParsed.success) {
          return {
            success: false,
            error: reportParsed.errorMessage || "Błąd drukowania raportu okresowego",
            errorCode: reportParsed.errorCode,
          };
        }

        return {
          success: true,
          reportNumber: reportParsed.receiptNumber ? `NOV-P-${reportParsed.receiptNumber}` : undefined,
        };
      } finally {
        socket.destroy();
      }
    }, "drukowanie raportu okresowego");
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Błąd komunikacji z kasą Novitus";
    return {
      success: false,
      error: errorMessage,
      errorCode: errorMessage.includes("timeout") ? "TIMEOUT" : "CONNECTION_ERROR",
    };
  }
}

/**
 * Wykonuje storno (anulowanie) paragonu fiskalnego.
 * Drukuje dokument korygujący z odwołaniem do oryginalnego paragonu.
 */
async function printStornoImpl(request: FiscalStornoRequest): Promise<FiscalStornoResult> {
  if (!host || port <= 0) {
    return {
      success: false,
      errorCode: "CONFIG_ERROR",
      errorMessage: "Skonfiguruj FISCAL_NOVITUS_HOST i FISCAL_NOVITUS_PORT",
    };
  }

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

  // Mapowanie powodów storna na kody Novitus
  const reasonCodes: Record<string, string> = {
    CUSTOMER_RETURN: "ZT", // Zwrot towaru
    OPERATOR_ERROR: "BO", // Błąd operatora
    PRICE_CORRECTION: "KC", // Korekta ceny
    DUPLICATE_TRANSACTION: "DU", // Duplikat
    PAYMENT_ISSUE: "PL", // Problem z płatnością
    CUSTOMER_COMPLAINT: "RK", // Reklamacja
    OTHER: "IN", // Inny
  };

  try {
    return await withRetry(async () => {
      const socket = await connect();
      try {
        // Otwarcie dokumentu storna z numerem oryginalnego paragonu i kodem powodu
        const reasonCode = reasonCodes[request.reason] || "IN";
        const openData = [
          request.originalReceiptNumber,
          reasonCode,
          request.operatorNote || "",
        ].join(SEP);
        
        const openResp = await sendFrame(socket, buildFrame(CMD_STORNO_OPEN, openData));
        const openParsed = parseResponse(openResp);
        
        if (!openParsed.success) {
          // Sprawdź czy to błąd braku paragonu
          if (openParsed.errorCode === "20" || openParsed.errorMessage?.includes("nie znaleziono")) {
            return {
              success: false,
              errorCode: "RECEIPT_NOT_FOUND",
              errorMessage: `Nie znaleziono paragonu ${request.originalReceiptNumber} w pamięci drukarki`,
            };
          }
          return {
            success: false,
            errorCode: openParsed.errorCode,
            errorMessage: openParsed.errorMessage || "Błąd otwarcia dokumentu storna",
          };
        }

        // Jeśli podano pozycje, dodaj je do dokumentu storna
        if (request.items && request.items.length > 0) {
          for (const item of request.items) {
            const lineData = [
              item.name,
              String(item.quantity),
              item.unitPrice.toFixed(2),
            ].join(SEP);
            
            const lineResp = await sendFrame(socket, buildFrame(CMD_STORNO_LINE, lineData));
            const lineParsed = parseResponse(lineResp);
            
            if (!lineParsed.success) {
              return {
                success: false,
                errorCode: lineParsed.errorCode,
                errorMessage: lineParsed.errorMessage || `Błąd pozycji storna: ${item.name}`,
              };
            }
          }
        }

        // Zamknięcie dokumentu storna z kwotą
        const closeData = request.amount.toFixed(2);
        const closeResp = await sendFrame(socket, buildFrame(CMD_STORNO_CLOSE, closeData));
        const closeParsed = parseResponse(closeResp);

        if (!closeParsed.success) {
          return {
            success: false,
            errorCode: closeParsed.errorCode,
            errorMessage: closeParsed.errorMessage || "Błąd zamknięcia dokumentu storna",
          };
        }

        return {
          success: true,
          stornoNumber: closeParsed.receiptNumber ? `NOV-S-${closeParsed.receiptNumber}` : undefined,
          originalReceiptNumber: request.originalReceiptNumber,
          stornoAmount: request.amount,
          stornoDate: new Date(),
        };
      } finally {
        socket.destroy();
      }
    }, "drukowanie storna");
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Błąd komunikacji z kasą Novitus podczas storna";
    return {
      success: false,
      errorCode: errorMessage.includes("timeout") ? "TIMEOUT" : "CONNECTION_ERROR",
      errorMessage,
    };
  }
}

const novitusDriver: FiscalDriver = {
  name: "novitus",
  printReceipt: printReceiptImpl,
  printInvoice: printInvoiceImpl,
  printXReport: printXReportImpl,
  printZReport: printZReportImpl,
  printPeriodicReport: printPeriodicReportImpl,
  printStorno: printStornoImpl,
};

export default novitusDriver;
