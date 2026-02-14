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
const SEP = ";";

/** Polecenia protokołu Elzab (ramki bajtowe STX+cmd+data+LRC+ETX). */
const CMD_OPEN_RECEIPT = 0x52; // R – otwarcie paragonu (Receipt)
const CMD_SALE_LINE = 0x50; // P – pozycja (Product)
const CMD_PAYMENT = 0x57; // W – wpłata (payment)
const CMD_CLOSE_RECEIPT = 0x4b; // K – koniec paragonu
const CMD_OPEN_INVOICE = 0x46; // F – faktura
const CMD_INVOICE_BUYER = 0x4e; // N – nabywca
const CMD_INVOICE_LINE = 0x50; // P – pozycja faktury
const CMD_CLOSE_INVOICE = 0x4b; // K – zamknięcie faktury
const CMD_X_REPORT = 0x58; // X – raport X (niefiskalny)
const CMD_Z_REPORT = 0x5a; // Z – raport dobowy (fiskalny)
const CMD_PERIODIC_REPORT = 0x4d; // M – raport okresowy (Monthly/Periodic)
const CMD_STORNO_OPEN = 0x41; // A – otwarcie storna (Anulacja)
const CMD_STORNO_LINE = 0x42; // B – pozycja storna
const CMD_STORNO_CLOSE = 0x43; // C – zamknięcie storna

const host = process.env.FISCAL_ELZAB_HOST ?? "";
const port = Number(process.env.FISCAL_ELZAB_PORT ?? "0") || 0;
const timeoutMs = Number(process.env.FISCAL_ELZAB_TIMEOUT_MS ?? "5000") || 5000;

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
        `[Elzab] ${operationName} - próba ${attempt}/${MAX_RETRIES} nie powiodła się: ${lastError.message}`
      );
      
      if (attempt < MAX_RETRIES) {
        await delay(RETRY_DELAY_MS);
      }
    }
  }
  
  throw new Error(
    `[Elzab] ${operationName} nie powiodło się po ${MAX_RETRIES} próbach: ${lastError?.message ?? "Nieznany błąd"}`
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
    const s = net.createConnection({ host, port }, () => resolve(s));
    s.setTimeout(timeoutMs);
    s.on("timeout", () => {
      s.destroy();
      reject(new Error("Elzab: timeout połączenia"));
    });
    s.once("error", reject);
  });
}

/** Typowe kody błędów drukarki Elzab */
const ELZAB_ERROR_CODES: Record<string, string> = {
  "01": "Błąd składni polecenia",
  "02": "Brak papieru",
  "03": "Błąd mechanizmu drukującego",
  "04": "Błąd komunikacji",
  "05": "Błąd pamięci fiskalnej",
  "06": "Przepełnienie bufora",
  "07": "Nieprawidłowa wartość ceny",
  "08": "Nieprawidłowa wartość ilości",
  "09": "Za dużo pozycji na paragonie",
  "10": "Nieobsługiwana stawka VAT",
  "11": "Nieprawidłowy NIP nabywcy",
  "12": "Przekroczony limit dzienny sprzedaży",
  "13": "Wymagane wykonanie raportu dobowego",
  "14": "Drukarka jest w trybie fiskalnym",
  "15": "Drukarka nie jest w trybie fiskalnym",
  "16": "Błąd zegara RTC",
  "17": "Błąd połączenia sieciowego",
  "18": "Błąd autoryzacji",
  "20": "Paragon anulowany",
  "21": "Błąd otwarcia szuflady",
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
 * Parsuje odpowiedź z drukarki Elzab.
 * Format: "kod_błędu;numer_paragonu" lub "OK;numer" lub "ERR;kod"
 */
function parseResponse(response: Buffer): ParsedResponse {
  const str = response.toString("utf8").replace(/\x02|\x03/g, "").trim();
  const parts = str.split(SEP);
  
  // Format: "0;12345" gdzie 0 = sukces, inne = błąd
  if (parts.length >= 2) {
    const code = parts[0].trim().toUpperCase();
    const value = parts[1].trim();
    
    // Sukces: kod 0 lub OK
    if (code === "0" || code === "00" || code === "OK") {
      return {
        success: true,
        receiptNumber: /^\d+$/.test(value) ? value : undefined,
      };
    }
    
    // Błąd: kod numeryczny lub ERR
    const errorCode = code === "ERR" ? value : code;
    const errorMessage = ELZAB_ERROR_CODES[errorCode] || `Błąd drukarki: ${errorCode}`;
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
      error: "Skonfiguruj FISCAL_ELZAB_HOST i FISCAL_ELZAB_PORT",
      errorCode: "CONFIG_ERROR",
    };
  }

  try {
    return await withRetry(async () => {
      const socket = await connect();
      try {
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
          receiptNumber: closeParsed.receiptNumber ? `ELZ-${closeParsed.receiptNumber}` : undefined,
        };
      } finally {
        socket.destroy();
      }
    }, "drukowanie paragonu");
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Błąd komunikacji z kasą Elzab";
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
      error: "Skonfiguruj FISCAL_ELZAB_HOST i FISCAL_ELZAB_PORT",
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
          invoiceNumber: closeParsed.receiptNumber ? `ELZ-FV-${closeParsed.receiptNumber}` : undefined,
        };
      } finally {
        socket.destroy();
      }
    }, "drukowanie faktury");
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Błąd druku faktury Elzab";
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
      error: "Skonfiguruj FISCAL_ELZAB_HOST i FISCAL_ELZAB_PORT",
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
          reportNumber: reportParsed.receiptNumber ? `ELZ-X-${reportParsed.receiptNumber}` : undefined,
        };
      } finally {
        socket.destroy();
      }
    }, "drukowanie raportu X");
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Błąd komunikacji z kasą Elzab";
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
      error: "Skonfiguruj FISCAL_ELZAB_HOST i FISCAL_ELZAB_PORT",
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
          reportNumber: reportParsed.receiptNumber ? `ELZ-Z-${reportParsed.receiptNumber}` : undefined,
        };
      } finally {
        socket.destroy();
      }
    }, "drukowanie raportu Z");
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Błąd komunikacji z kasą Elzab";
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
      error: "Skonfiguruj FISCAL_ELZAB_HOST i FISCAL_ELZAB_PORT",
      errorCode: "CONFIG_ERROR",
    };
  }

  try {
    return await withRetry(async () => {
      const socket = await connect();
      try {
        // Format daty dla Elzab: DD-MM-RRRR
        const formatDate = (d: Date) => {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, "0");
          const day = String(d.getDate()).padStart(2, "0");
          return `${day}-${month}-${year}`;
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
          reportNumber: reportParsed.receiptNumber ? `ELZ-P-${reportParsed.receiptNumber}` : undefined,
        };
      } finally {
        socket.destroy();
      }
    }, "drukowanie raportu okresowego");
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Błąd komunikacji z kasą Elzab";
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
      errorMessage: "Skonfiguruj FISCAL_ELZAB_HOST i FISCAL_ELZAB_PORT",
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

  // Mapowanie powodów storna na kody Elzab
  const reasonCodes: Record<string, string> = {
    CUSTOMER_RETURN: "1", // Zwrot towaru
    OPERATOR_ERROR: "2", // Błąd operatora
    PRICE_CORRECTION: "3", // Korekta ceny
    DUPLICATE_TRANSACTION: "4", // Duplikat
    PAYMENT_ISSUE: "5", // Problem z płatnością
    CUSTOMER_COMPLAINT: "6", // Reklamacja
    OTHER: "9", // Inny
  };

  try {
    return await withRetry(async () => {
      const socket = await connect();
      try {
        // Otwarcie dokumentu storna z numerem oryginalnego paragonu i kodem powodu
        const reasonCode = reasonCodes[request.reason] || "9";
        const openData = [
          request.originalReceiptNumber,
          reasonCode,
          request.operatorNote || "",
        ].join(SEP);
        
        const openResp = await sendFrame(socket, buildFrame(CMD_STORNO_OPEN, openData));
        const openParsed = parseResponse(openResp);
        
        if (!openParsed.success) {
          // Sprawdź czy to błąd braku paragonu
          if (openParsed.errorCode === "30" || openParsed.errorMessage?.includes("nie znaleziono")) {
            return {
              success: false,
              errorCode: "RECEIPT_NOT_FOUND",
              errorMessage: `Nie znaleziono paragonu ${request.originalReceiptNumber} w pamięci drukarki`,
            };
          }
          // Sprawdź czy paragon był już stornowany
          if (openParsed.errorCode === "31" || openParsed.errorMessage?.includes("już anulowany")) {
            return {
              success: false,
              errorCode: "ALREADY_STORNOED",
              errorMessage: `Paragon ${request.originalReceiptNumber} został już wcześniej stornowany`,
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
          stornoNumber: closeParsed.receiptNumber ? `ELZ-S-${closeParsed.receiptNumber}` : undefined,
          originalReceiptNumber: request.originalReceiptNumber,
          stornoAmount: request.amount,
          stornoDate: new Date(),
        };
      } finally {
        socket.destroy();
      }
    }, "drukowanie storna");
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : "Błąd komunikacji z kasą Elzab podczas storna";
    return {
      success: false,
      errorCode: errorMessage.includes("timeout") ? "TIMEOUT" : "CONNECTION_ERROR",
      errorMessage,
    };
  }
}

const elzabDriver: FiscalDriver = {
  name: "elzab",
  printReceipt: printReceiptImpl,
  printInvoice: printInvoiceImpl,
  printXReport: printXReportImpl,
  printZReport: printZReportImpl,
  printPeriodicReport: printPeriodicReportImpl,
  printStorno: printStornoImpl,
};

export default elzabDriver;
