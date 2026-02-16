/**
 * Driver dla terminali płatniczych Ingenico
 * Komunikacja przez TCP/IP (protokół ECR Link / TLV)
 * 
 * Obsługiwane modele: iCT250, Move/5000, Lane/3000, Desk/5000
 */

import type { Socket } from "net";
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
  TransactionStatus,
} from "./types";

// Komendy protokołu Ingenico ECR Link
const CMD = {
  STATUS: 0x01,           // Sprawdź status terminala
  SALE: 0x10,             // Transakcja sprzedaży
  PREAUTH: 0x11,          // Pre-autoryzacja
  CAPTURE: 0x12,          // Przechwycenie pre-auth
  VOID: 0x13,             // Anulowanie
  REFUND: 0x14,           // Zwrot
  BATCH_CLOSE: 0x20,      // Zamknięcie dnia
  PRINT: 0x30,            // Drukowanie
  CANCEL: 0x40,           // Anuluj bieżącą operację
  DISCONNECT: 0xFF,       // Rozłącz
};

// Tagi TLV
const TAG = {
  AMOUNT: "9F02",
  CURRENCY: "5F2A",
  TRANSACTION_TYPE: "9C",
  TRANSACTION_ID: "9F41",
  AUTH_CODE: "89",
  REFERENCE_NUMBER: "9F37",
  CARD_NUMBER: "5A",
  CARD_TYPE: "9F06",
  CARDHOLDER_NAME: "5F20",
  CARD_EXPIRY: "5F24",
  ENTRY_MODE: "9F39",
  RESPONSE_CODE: "8A",
  ERROR_CODE: "DF01",
  ERROR_MESSAGE: "DF02",
  RECEIPT_MERCHANT: "DF10",
  RECEIPT_CUSTOMER: "DF11",
  TERMINAL_ID: "9F1C",
  MERCHANT_ID: "9F16",
  AID: "4F",
  TVR: "95",
  TSI: "9B",
  BATCH_NUMBER: "DF20",
  BATCH_TOTAL: "DF21",
  BATCH_COUNT: "DF22",
  TIP_AMOUNT: "9F03",
  ORIGINAL_TRANSACTION_ID: "DF30",
  ORIGINAL_AUTH_CODE: "DF31",
};

// Timeout dla operacji (ms)
const DEFAULT_TIMEOUT = 120000; // 2 minuty dla transakcji
const STATUS_TIMEOUT = 10000;   // 10s dla statusu
const CONNECTION_TIMEOUT = 5000;
const RETRY_COUNT = 3;
const RETRY_DELAY = 1000;

// Stan drivera
let socket: Socket | null = null;
let config: TerminalConfig | null = null;
let isInitialized = false;
let pendingResponse: {
  resolve: (value: Buffer) => void;
  reject: (reason: Error) => void;
  timeout: NodeJS.Timeout;
} | null = null;

/**
 * Mapuje typ karty z kodu Ingenico
 */
function mapCardType(code: string): CardType {
  const mapping: Record<string, CardType> = {
    "A0000000031010": "VISA",
    "A0000000041010": "MASTERCARD",
    "A000000025010": "AMEX",
    "A0000001523010": "DISCOVER",
    "A0000000651010": "JCB",
    "A0000001410001": "DINERS",
  };
  
  for (const [aid, type] of Object.entries(mapping)) {
    if (code.includes(aid)) return type;
  }
  
  if (code.startsWith("4")) return "VISA";
  if (code.startsWith("5") || code.startsWith("2")) return "MASTERCARD";
  if (code.startsWith("3")) return "AMEX";
  
  return "OTHER";
}

/**
 * Mapuje metodę wprowadzenia karty
 */
function mapEntryMode(code: string): CardEntryMode {
  switch (code) {
    case "05": return "CHIP";
    case "07": return "CONTACTLESS";
    case "90": return "SWIPE";
    case "01": return "MANUAL";
    case "80": return "FALLBACK";
    default: return "CHIP";
  }
}

/**
 * Mapuje status odpowiedzi
 */
function mapResponseStatus(code: string): TransactionStatus {
  if (code === "00" || code === "10") return "APPROVED";
  if (code === "51" || code === "05" || code === "14") return "DECLINED";
  if (code === "91" || code === "96") return "ERROR";
  if (code === "68" || code === "82") return "TIMEOUT";
  return "DECLINED";
}

/**
 * Buduje ramkę TLV
 */
function buildTlvFrame(command: number, tags: Record<string, string>): Buffer {
  const tagBuffers: Buffer[] = [];
  
  for (const [tag, value] of Object.entries(tags)) {
    const tagBuf = Buffer.from(tag, "hex");
    const valueBuf = Buffer.from(value, "hex");
    const lengthBuf = Buffer.alloc(2);
    lengthBuf.writeUInt16BE(valueBuf.length);
    
    tagBuffers.push(tagBuf, lengthBuf, valueBuf);
  }
  
  const data = Buffer.concat(tagBuffers);
  
  // Format ramki: STX (1) + LEN (2) + CMD (1) + DATA + ETX (1) + LRC (1)
  const frame = Buffer.alloc(data.length + 6);
  frame[0] = 0x02; // STX
  frame.writeUInt16BE(data.length + 1, 1); // Length (cmd + data)
  frame[3] = command;
  data.copy(frame, 4);
  frame[frame.length - 2] = 0x03; // ETX
  
  // Oblicz LRC
  let lrc = 0;
  for (let i = 1; i < frame.length - 1; i++) {
    lrc ^= frame[i];
  }
  frame[frame.length - 1] = lrc;
  
  return frame;
}

/**
 * Parsuje odpowiedź TLV
 */
function parseTlvResponse(data: Buffer): Record<string, string> {
  const result: Record<string, string> = {};
  let offset = 4; // Pomiń STX, LEN, CMD
  
  while (offset < data.length - 2) { // Pomiń ETX i LRC
    // Tag (1-2 bajty)
    let tagLen = 1;
    if ((data[offset] & 0x1F) === 0x1F) {
      tagLen = 2;
    }
    const tag = data.subarray(offset, offset + tagLen).toString("hex").toUpperCase();
    offset += tagLen;
    
    // Length (1-2 bajty)
    let length = data[offset];
    if (length > 127) {
      const numLengthBytes = length & 0x7F;
      length = 0;
      for (let i = 0; i < numLengthBytes; i++) {
        length = (length << 8) | data[offset + 1 + i];
      }
      offset += 1 + numLengthBytes;
    } else {
      offset += 1;
    }
    
    // Value
    const value = data.subarray(offset, offset + length).toString("hex");
    result[tag] = value;
    offset += length;
  }
  
  return result;
}

/**
 * Konwertuje kwotę do formatu Ingenico (12 cyfr BCD)
 */
function formatAmount(amount: number): string {
  return String(Math.round(amount)).padStart(12, "0");
}

/**
 * Konwertuje tekst do hex
 */
function textToHex(text: string): string {
  return Buffer.from(text, "utf-8").toString("hex");
}

/**
 * Konwertuje hex do tekstu
 */
function hexToText(hex: string): string {
  return Buffer.from(hex, "hex").toString("utf-8");
}

/**
 * Wysyła komendę i czeka na odpowiedź
 */
async function sendCommand(command: number, tags: Record<string, string>, timeout: number): Promise<Record<string, string>> {
  if (!socket || !isInitialized) {
    throw new Error("Terminal nie jest połączony");
  }
  
  return new Promise((resolve, reject) => {
    const frame = buildTlvFrame(command, tags);
    
    // Ustaw timeout
    const timeoutId = setTimeout(() => {
      pendingResponse = null;
      reject(new Error("Timeout operacji"));
    }, timeout);
    
    // Zapisz pending response
    pendingResponse = {
      resolve: (data: Buffer) => {
        clearTimeout(timeoutId);
        pendingResponse = null;
        resolve(parseTlvResponse(data));
      },
      reject: (error: Error) => {
        clearTimeout(timeoutId);
        pendingResponse = null;
        reject(error);
      },
      timeout: timeoutId,
    };
    
    // Wyślij
    socket!.write(frame);
  });
}

/**
 * Implementacja drivera Ingenico
 */
export const ingenicoDriver: PaymentTerminalDriver = {
  async initialize(cfg: TerminalConfig): Promise<boolean> {
    config = cfg;
    
    const host = cfg.host || "192.168.1.100";
    const port = cfg.port || 8000;
    const timeout = cfg.timeout || CONNECTION_TIMEOUT;
    
    return new Promise((resolve) => {
      let retries = RETRY_COUNT;
      
      const attemptConnection = () => {
        // Dynamiczny import net (Node.js)
        import("net").then(({ Socket }) => {
          socket = new Socket();
          
          socket.setTimeout(timeout);
          
          socket.on("connect", () => {
            isInitialized = true;
            console.log(`[INGENICO] Connected to ${host}:${port}`);
            resolve(true);
          });
          
          socket.on("data", (data: Buffer) => {
            if (pendingResponse) {
              // Waliduj LRC
              let lrc = 0;
              for (let i = 1; i < data.length - 1; i++) {
                lrc ^= data[i];
              }
              if (lrc !== data[data.length - 1]) {
                pendingResponse.reject(new Error("Błąd sumy kontrolnej LRC"));
                return;
              }
              pendingResponse.resolve(data);
            }
          });
          
          socket.on("error", (err: Error) => {
            console.error(`[INGENICO] Socket error:`, err.message);
            if (pendingResponse) {
              pendingResponse.reject(err);
            }
            if (retries > 0) {
              retries--;
              setTimeout(attemptConnection, RETRY_DELAY);
            } else {
              resolve(false);
            }
          });
          
          socket.on("timeout", () => {
            console.error(`[INGENICO] Connection timeout`);
            socket?.destroy();
            if (retries > 0) {
              retries--;
              setTimeout(attemptConnection, RETRY_DELAY);
            } else {
              resolve(false);
            }
          });
          
          socket.on("close", () => {
            isInitialized = false;
            console.log(`[INGENICO] Disconnected`);
          });
          
          socket.connect(port, host);
        }).catch(() => {
          console.error("[INGENICO] Net module not available");
          resolve(false);
        });
      };
      
      attemptConnection();
    });
  },

  async getStatus(): Promise<TerminalStatusResult> {
    try {
      const response = await sendCommand(CMD.STATUS, {}, STATUS_TIMEOUT);
      
      const errorCode = response[TAG.ERROR_CODE];
      if (errorCode && errorCode !== "00") {
        return {
          success: false,
          status: "ERROR",
          errorCode: hexToText(errorCode),
          errorMessage: response[TAG.ERROR_MESSAGE] ? hexToText(response[TAG.ERROR_MESSAGE]) : "Błąd terminala",
        };
      }
      
      return {
        success: true,
        status: "IDLE",
        terminalId: response[TAG.TERMINAL_ID] ? hexToText(response[TAG.TERMINAL_ID]) : config?.terminalId,
        terminalModel: "Ingenico",
        connectionType: "ETHERNET",
      };
    } catch (error) {
      return {
        success: false,
        status: "OFFLINE",
        errorMessage: error instanceof Error ? error.message : "Nie można połączyć z terminalem",
      };
    }
  },

  async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    try {
      const tags: Record<string, string> = {
        [TAG.AMOUNT]: formatAmount(request.amount),
        [TAG.CURRENCY]: "0985", // PLN
        [TAG.TRANSACTION_TYPE]: "00", // Sale
      };
      
      if (request.referenceId) {
        tags[TAG.TRANSACTION_ID] = textToHex(request.referenceId);
      }
      if (request.requestTip && request.tipAmount) {
        tags[TAG.TIP_AMOUNT] = formatAmount(request.tipAmount);
      }
      
      const response = await sendCommand(CMD.SALE, tags, config?.timeout || DEFAULT_TIMEOUT);
      
      return parsePaymentResponse(response);
    } catch (error) {
      return {
        success: false,
        status: "ERROR",
        errorMessage: error instanceof Error ? error.message : "Błąd transakcji",
      };
    }
  },

  async processPreAuth(request: PaymentRequest): Promise<PaymentResult> {
    try {
      const tags: Record<string, string> = {
        [TAG.AMOUNT]: formatAmount(request.amount),
        [TAG.CURRENCY]: "0985",
        [TAG.TRANSACTION_TYPE]: "01", // Pre-auth
      };
      
      if (request.referenceId) {
        tags[TAG.TRANSACTION_ID] = textToHex(request.referenceId);
      }
      
      const response = await sendCommand(CMD.PREAUTH, tags, config?.timeout || DEFAULT_TIMEOUT);
      
      return parsePaymentResponse(response);
    } catch (error) {
      return {
        success: false,
        status: "ERROR",
        errorMessage: error instanceof Error ? error.message : "Błąd pre-autoryzacji",
      };
    }
  },

  async capturePreAuth(request: PaymentRequest): Promise<PaymentResult> {
    try {
      if (!request.originalTransactionId) {
        return {
          success: false,
          status: "ERROR",
          errorCode: "MISSING_ORIGINAL",
          errorMessage: "Wymagany jest ID oryginalnej transakcji",
        };
      }
      
      const tags: Record<string, string> = {
        [TAG.AMOUNT]: formatAmount(request.amount),
        [TAG.CURRENCY]: "0985",
        [TAG.TRANSACTION_TYPE]: "02", // Capture
        [TAG.ORIGINAL_TRANSACTION_ID]: textToHex(request.originalTransactionId),
      };
      
      if (request.originalAuthCode) {
        tags[TAG.ORIGINAL_AUTH_CODE] = textToHex(request.originalAuthCode);
      }
      
      const response = await sendCommand(CMD.CAPTURE, tags, config?.timeout || DEFAULT_TIMEOUT);
      
      return parsePaymentResponse(response);
    } catch (error) {
      return {
        success: false,
        status: "ERROR",
        errorMessage: error instanceof Error ? error.message : "Błąd przechwycenia",
      };
    }
  },

  async voidTransaction(request: PaymentRequest): Promise<PaymentResult> {
    try {
      if (!request.originalTransactionId) {
        return {
          success: false,
          status: "ERROR",
          errorCode: "MISSING_ORIGINAL",
          errorMessage: "Wymagany jest ID oryginalnej transakcji",
        };
      }
      
      const tags: Record<string, string> = {
        [TAG.TRANSACTION_TYPE]: "03", // Void
        [TAG.ORIGINAL_TRANSACTION_ID]: textToHex(request.originalTransactionId),
      };
      
      if (request.originalAuthCode) {
        tags[TAG.ORIGINAL_AUTH_CODE] = textToHex(request.originalAuthCode);
      }
      if (request.amount > 0) {
        tags[TAG.AMOUNT] = formatAmount(request.amount);
      }
      
      const response = await sendCommand(CMD.VOID, tags, config?.timeout || DEFAULT_TIMEOUT);
      
      return parsePaymentResponse(response);
    } catch (error) {
      return {
        success: false,
        status: "ERROR",
        errorMessage: error instanceof Error ? error.message : "Błąd anulowania",
      };
    }
  },

  async processRefund(request: PaymentRequest): Promise<PaymentResult> {
    try {
      const tags: Record<string, string> = {
        [TAG.AMOUNT]: formatAmount(request.amount),
        [TAG.CURRENCY]: "0985",
        [TAG.TRANSACTION_TYPE]: "04", // Refund
      };
      
      if (request.originalTransactionId) {
        tags[TAG.ORIGINAL_TRANSACTION_ID] = textToHex(request.originalTransactionId);
      }
      if (request.referenceId) {
        tags[TAG.TRANSACTION_ID] = textToHex(request.referenceId);
      }
      
      const response = await sendCommand(CMD.REFUND, tags, config?.timeout || DEFAULT_TIMEOUT);
      
      return parsePaymentResponse(response);
    } catch (error) {
      return {
        success: false,
        status: "ERROR",
        errorMessage: error instanceof Error ? error.message : "Błąd zwrotu",
      };
    }
  },

  async closeBatch(request: BatchCloseRequest): Promise<BatchCloseResult> {
    try {
      const tags: Record<string, string> = {};
      
      if (request.terminalId) {
        tags[TAG.TERMINAL_ID] = textToHex(request.terminalId);
      }
      
      const response = await sendCommand(CMD.BATCH_CLOSE, tags, DEFAULT_TIMEOUT);
      
      const errorCode = response[TAG.ERROR_CODE];
      if (errorCode && errorCode !== "00") {
        return {
          success: false,
          errorCode: hexToText(errorCode),
          errorMessage: response[TAG.ERROR_MESSAGE] ? hexToText(response[TAG.ERROR_MESSAGE]) : "Błąd zamknięcia batch'a",
        };
      }
      
      return {
        success: true,
        batchNumber: response[TAG.BATCH_NUMBER] ? hexToText(response[TAG.BATCH_NUMBER]) : undefined,
        totalAmount: response[TAG.BATCH_TOTAL] ? parseInt(response[TAG.BATCH_TOTAL], 16) : undefined,
        transactionCount: response[TAG.BATCH_COUNT] ? parseInt(response[TAG.BATCH_COUNT], 16) : undefined,
        reportData: response[TAG.RECEIPT_MERCHANT] ? hexToText(response[TAG.RECEIPT_MERCHANT]) : undefined,
        closedAt: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : "Błąd zamknięcia batch'a",
      };
    }
  },

  async print(request: PrintRequest): Promise<PrintResult> {
    try {
      const tags: Record<string, string> = {
        [TAG.RECEIPT_MERCHANT]: textToHex(request.content),
      };
      
      const response = await sendCommand(CMD.PRINT, tags, STATUS_TIMEOUT);
      
      const errorCode = response[TAG.ERROR_CODE];
      if (errorCode && errorCode !== "00") {
        return {
          success: false,
          errorCode: hexToText(errorCode),
          errorMessage: response[TAG.ERROR_MESSAGE] ? hexToText(response[TAG.ERROR_MESSAGE]) : "Błąd drukowania",
        };
      }
      
      return { success: true };
    } catch (error) {
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : "Błąd drukowania",
      };
    }
  },

  async cancelOperation(): Promise<boolean> {
    try {
      await sendCommand(CMD.CANCEL, {}, STATUS_TIMEOUT);
      return true;
    } catch {
      return false;
    }
  },

  async disconnect(): Promise<void> {
    if (socket) {
      try {
        await sendCommand(CMD.DISCONNECT, {}, STATUS_TIMEOUT);
      } catch {
        // Ignore disconnect errors
      }
      socket.destroy();
      socket = null;
    }
    isInitialized = false;
    config = null;
  },
};

/**
 * Parsuje odpowiedź płatności
 */
function parsePaymentResponse(response: Record<string, string>): PaymentResult {
  const responseCode = response[TAG.RESPONSE_CODE];
  const status = mapResponseStatus(responseCode ? hexToText(responseCode) : "");
  
  const errorCode = response[TAG.ERROR_CODE];
  if (status !== "APPROVED" || (errorCode && errorCode !== "00")) {
    return {
      success: false,
      status,
      errorCode: errorCode ? hexToText(errorCode) : responseCode ? hexToText(responseCode) : undefined,
      errorMessage: response[TAG.ERROR_MESSAGE] ? hexToText(response[TAG.ERROR_MESSAGE]) : getDeclineReason(responseCode),
      transactionTime: new Date(),
    };
  }
  
  // Parsuj dane karty
  let cardNumber = response[TAG.CARD_NUMBER];
  if (cardNumber) {
    // Maskuj numer karty
    const decoded = hexToText(cardNumber);
    cardNumber = `****${decoded.slice(-4)}`;
  }
  
  return {
    success: true,
    status: "APPROVED",
    transactionId: response[TAG.TRANSACTION_ID] ? hexToText(response[TAG.TRANSACTION_ID]) : undefined,
    authCode: response[TAG.AUTH_CODE] ? hexToText(response[TAG.AUTH_CODE]) : undefined,
    referenceNumber: response[TAG.REFERENCE_NUMBER] ? hexToText(response[TAG.REFERENCE_NUMBER]) : undefined,
    approvedAmount: response[TAG.AMOUNT] ? parseInt(response[TAG.AMOUNT], 16) : undefined,
    tipAmount: response[TAG.TIP_AMOUNT] ? parseInt(response[TAG.TIP_AMOUNT], 16) : undefined,
    cardType: response[TAG.AID] ? mapCardType(response[TAG.AID]) : mapCardType(response[TAG.CARD_NUMBER] || ""),
    cardNumber,
    cardholderName: response[TAG.CARDHOLDER_NAME] ? hexToText(response[TAG.CARDHOLDER_NAME]).trim() : undefined,
    cardEntryMode: response[TAG.ENTRY_MODE] ? mapEntryMode(hexToText(response[TAG.ENTRY_MODE])) : undefined,
    cardExpiryDate: response[TAG.CARD_EXPIRY] ? formatExpiryDate(response[TAG.CARD_EXPIRY]) : undefined,
    receiptData: {
      merchantCopy: response[TAG.RECEIPT_MERCHANT] ? hexToText(response[TAG.RECEIPT_MERCHANT]) : undefined,
      customerCopy: response[TAG.RECEIPT_CUSTOMER] ? hexToText(response[TAG.RECEIPT_CUSTOMER]) : undefined,
      terminalId: response[TAG.TERMINAL_ID] ? hexToText(response[TAG.TERMINAL_ID]) : config?.terminalId,
      aid: response[TAG.AID],
      tvr: response[TAG.TVR],
      tsi: response[TAG.TSI],
    },
    transactionTime: new Date(),
  };
}

/**
 * Formatuje datę ważności karty
 */
function formatExpiryDate(hex: string): string {
  const decoded = hexToText(hex);
  if (decoded.length >= 4) {
    return `${decoded.slice(2, 4)}/${decoded.slice(0, 2)}`;
  }
  return decoded;
}

/**
 * Zwraca powód odrzucenia dla kodu odpowiedzi
 */
function getDeclineReason(code: string | undefined): string {
  if (!code) return "Transakcja odrzucona";
  
  const decoded = hexToText(code);
  const reasons: Record<string, string> = {
    "05": "Transakcja niedozwolona",
    "14": "Nieprawidłowy numer karty",
    "51": "Niewystarczające środki",
    "54": "Karta wygasła",
    "55": "Nieprawidłowy PIN",
    "57": "Transakcja niedozwolona dla tej karty",
    "61": "Przekroczono limit kwoty",
    "65": "Przekroczono limit transakcji",
    "75": "Przekroczono liczbę prób PIN",
    "91": "Bank wydawcy niedostępny",
    "96": "Błąd systemu",
  };
  
  return reasons[decoded] || `Transakcja odrzucona (kod: ${decoded})`;
}

export default ingenicoDriver;
