/**
 * Driver dla terminali płatniczych Verifone
 * Komunikacja przez TCP/IP (protokół PAX / VeriFone Point)
 * 
 * Obsługiwane modele: VX520, VX820, P400, M400
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
  TransactionStatus,
} from "./types";

// Komendy protokołu Verifone (XML-based)
const CMD_NAMES = {
  STATUS: "GetStatus",
  SALE: "Sale",
  PREAUTH: "PreAuth",
  CAPTURE: "Capture",
  VOID: "Void",
  REFUND: "Refund",
  BATCH_CLOSE: "BatchClose",
  PRINT: "PrintText",
  CANCEL: "Cancel",
};

// Timeout dla operacji (ms)
const DEFAULT_TIMEOUT = 120000;
const STATUS_TIMEOUT = 10000;
const CONNECTION_TIMEOUT = 5000;
const RETRY_COUNT = 3;
const RETRY_DELAY = 1000;

// Stan drivera
let socket: ReturnType<typeof import("net").Socket.prototype.constructor> | null = null;
let config: TerminalConfig | null = null;
let isInitialized = false;
let messageId = 1;
let pendingResponse: {
  resolve: (value: string) => void;
  reject: (reason: Error) => void;
  timeout: NodeJS.Timeout;
} | null = null;
let receiveBuffer = "";

/**
 * Mapuje typ karty z kodu Verifone
 */
function mapCardType(code: string): CardType {
  const mapping: Record<string, CardType> = {
    "VISA": "VISA",
    "MC": "MASTERCARD",
    "MASTERCARD": "MASTERCARD",
    "AMEX": "AMEX",
    "DISCOVER": "DISCOVER",
    "JCB": "JCB",
    "DINERS": "DINERS",
  };
  return mapping[code.toUpperCase()] || "OTHER";
}

/**
 * Mapuje metodę wprowadzenia karty
 */
function mapEntryMode(code: string): CardEntryMode {
  const mapping: Record<string, CardEntryMode> = {
    "CHIP": "CHIP",
    "ICC": "CHIP",
    "CTLS": "CONTACTLESS",
    "CONTACTLESS": "CONTACTLESS",
    "SWIPE": "SWIPE",
    "MSR": "SWIPE",
    "MANUAL": "MANUAL",
    "KEYED": "MANUAL",
    "FALLBACK": "FALLBACK",
  };
  return mapping[code.toUpperCase()] || "CHIP";
}

/**
 * Mapuje status odpowiedzi
 */
function mapResponseStatus(code: string): TransactionStatus {
  const approved = ["00", "000", "APPROVED", "SUCCESS"];
  if (approved.includes(code.toUpperCase())) return "APPROVED";
  
  const declined = ["05", "051", "14", "51", "54", "DECLINED"];
  if (declined.includes(code.toUpperCase())) return "DECLINED";
  
  const timeout = ["91", "96", "TIMEOUT"];
  if (timeout.includes(code.toUpperCase())) return "TIMEOUT";
  
  return "ERROR";
}

/**
 * Buduje żądanie XML
 */
function buildXmlRequest(command: string, params: Record<string, string | number | undefined>): string {
  const msgId = messageId++;
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<VerifoneRequest>\n`;
  xml += `  <MessageId>${msgId}</MessageId>\n`;
  xml += `  <Command>${command}</Command>\n`;
  
  if (config?.terminalId) {
    xml += `  <TerminalId>${escapeXml(config.terminalId)}</TerminalId>\n`;
  }
  if (config?.merchantId) {
    xml += `  <MerchantId>${escapeXml(config.merchantId)}</MerchantId>\n`;
  }
  
  xml += `  <Parameters>\n`;
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      xml += `    <${key}>${escapeXml(String(value))}</${key}>\n`;
    }
  }
  xml += `  </Parameters>\n`;
  xml += `</VerifoneRequest>\n`;
  
  return xml;
}

/**
 * Escape XML special characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Parsuje odpowiedź XML
 */
function parseXmlResponse(xml: string): Record<string, string> {
  const result: Record<string, string> = {};
  
  // Proste parsowanie XML (bez zewnętrznych bibliotek)
  const getValue = (tagName: string): string | undefined => {
    const regex = new RegExp(`<${tagName}>([^<]*)</${tagName}>`, "i");
    const match = xml.match(regex);
    return match ? match[1] : undefined;
  };
  
  // Główne pola
  result.MessageId = getValue("MessageId") || "";
  result.ResponseCode = getValue("ResponseCode") || getValue("ResultCode") || "";
  result.ResponseMessage = getValue("ResponseMessage") || getValue("ResultMessage") || "";
  result.Success = getValue("Success") || "";
  
  // Dane transakcji
  result.TransactionId = getValue("TransactionId") || getValue("TxnId") || "";
  result.AuthCode = getValue("AuthCode") || getValue("ApprovalCode") || "";
  result.ReferenceNumber = getValue("ReferenceNumber") || getValue("RefNum") || "";
  result.Amount = getValue("Amount") || getValue("ApprovedAmount") || "";
  result.TipAmount = getValue("TipAmount") || "";
  
  // Dane karty
  result.CardNumber = getValue("CardNumber") || getValue("MaskedPAN") || "";
  result.CardType = getValue("CardType") || getValue("CardBrand") || "";
  result.CardholderName = getValue("CardholderName") || getValue("CardHolder") || "";
  result.ExpiryDate = getValue("ExpiryDate") || getValue("CardExpiry") || "";
  result.EntryMode = getValue("EntryMode") || getValue("POSEntryMode") || "";
  
  // EMV data
  result.AID = getValue("AID") || getValue("ApplicationId") || "";
  result.TVR = getValue("TVR") || "";
  result.TSI = getValue("TSI") || "";
  
  // Paragony
  result.MerchantReceipt = getValue("MerchantReceipt") || getValue("ReceiptMerchant") || "";
  result.CustomerReceipt = getValue("CustomerReceipt") || getValue("ReceiptCustomer") || "";
  
  // Batch
  result.BatchNumber = getValue("BatchNumber") || getValue("BatchNum") || "";
  result.BatchTotal = getValue("BatchTotal") || getValue("TotalAmount") || "";
  result.BatchCount = getValue("BatchCount") || getValue("TxnCount") || "";
  result.BatchReport = getValue("BatchReport") || getValue("Report") || "";
  
  // Status terminala
  result.TerminalStatus = getValue("TerminalStatus") || getValue("Status") || "";
  result.TerminalModel = getValue("TerminalModel") || getValue("Model") || "";
  result.FirmwareVersion = getValue("FirmwareVersion") || getValue("Version") || "";
  result.BatteryLevel = getValue("BatteryLevel") || "";
  result.PaperStatus = getValue("PaperStatus") || "";
  
  // Błędy
  result.ErrorCode = getValue("ErrorCode") || "";
  result.ErrorMessage = getValue("ErrorMessage") || "";
  
  return result;
}

/**
 * Wysyła żądanie XML i czeka na odpowiedź
 */
async function sendRequest(command: string, params: Record<string, string | number | undefined>, timeout: number): Promise<Record<string, string>> {
  if (!socket || !isInitialized) {
    throw new Error("Terminal nie jest połączony");
  }
  
  return new Promise((resolve, reject) => {
    const xml = buildXmlRequest(command, params);
    
    // Dodaj nagłówek z długością (4 bajty hex)
    const lengthHex = xml.length.toString(16).padStart(4, "0").toUpperCase();
    const message = lengthHex + xml;
    
    // Ustaw timeout
    const timeoutId = setTimeout(() => {
      pendingResponse = null;
      reject(new Error("Timeout operacji"));
    }, timeout);
    
    // Zapisz pending response
    pendingResponse = {
      resolve: (data: string) => {
        clearTimeout(timeoutId);
        pendingResponse = null;
        resolve(parseXmlResponse(data));
      },
      reject: (error: Error) => {
        clearTimeout(timeoutId);
        pendingResponse = null;
        reject(error);
      },
      timeout: timeoutId,
    };
    
    // Wyślij
    socket!.write(message);
  });
}

/**
 * Implementacja drivera Verifone
 */
export const verifoneDriver: PaymentTerminalDriver = {
  async initialize(cfg: TerminalConfig): Promise<boolean> {
    config = cfg;
    
    const host = cfg.host || "192.168.1.100";
    const port = cfg.port || 12345;
    const timeout = cfg.timeout || CONNECTION_TIMEOUT;
    
    return new Promise((resolve) => {
      let retries = RETRY_COUNT;
      
      const attemptConnection = () => {
        import("net").then(({ Socket }) => {
          socket = new Socket();
          receiveBuffer = "";
          
          socket.setTimeout(timeout);
          
          socket.on("connect", () => {
            isInitialized = true;
            console.log(`[VERIFONE] Connected to ${host}:${port}`);
            resolve(true);
          });
          
          socket.on("data", (data: Buffer) => {
            receiveBuffer += data.toString("utf-8");
            
            // Sprawdź czy mamy kompletną wiadomość
            if (receiveBuffer.length >= 4) {
              const expectedLength = parseInt(receiveBuffer.substring(0, 4), 16);
              if (receiveBuffer.length >= expectedLength + 4) {
                const xml = receiveBuffer.substring(4, expectedLength + 4);
                receiveBuffer = receiveBuffer.substring(expectedLength + 4);
                
                if (pendingResponse) {
                  pendingResponse.resolve(xml);
                }
              }
            }
          });
          
          socket.on("error", (err: Error) => {
            console.error(`[VERIFONE] Socket error:`, err.message);
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
            console.error(`[VERIFONE] Connection timeout`);
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
            console.log(`[VERIFONE] Disconnected`);
          });
          
          socket.connect(port, host);
        }).catch(() => {
          console.error("[VERIFONE] Net module not available");
          resolve(false);
        });
      };
      
      attemptConnection();
    });
  },

  async getStatus(): Promise<TerminalStatusResult> {
    try {
      const response = await sendRequest(CMD_NAMES.STATUS, {}, STATUS_TIMEOUT);
      
      if (response.ErrorCode && response.ErrorCode !== "00" && response.ErrorCode !== "") {
        return {
          success: false,
          status: "ERROR",
          errorCode: response.ErrorCode,
          errorMessage: response.ErrorMessage || "Błąd terminala",
        };
      }
      
      return {
        success: true,
        status: response.TerminalStatus === "BUSY" ? "BUSY" : "IDLE",
        terminalId: config?.terminalId,
        terminalModel: response.TerminalModel || "Verifone",
        firmwareVersion: response.FirmwareVersion,
        batteryLevel: response.BatteryLevel ? parseInt(response.BatteryLevel) : undefined,
        paperStatus: response.PaperStatus as "OK" | "LOW" | "OUT" | undefined,
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
      const params = {
        Amount: request.amount,
        Currency: request.currency || "PLN",
        TransactionType: "SALE",
        ReferenceId: request.referenceId,
        Description: request.description,
        AllowPartialApproval: request.allowPartialApproval ? "1" : "0",
        RequestTip: request.requestTip ? "1" : "0",
        TipAmount: request.tipAmount,
      };
      
      const response = await sendRequest(CMD_NAMES.SALE, params, config?.timeout || DEFAULT_TIMEOUT);
      
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
      const params = {
        Amount: request.amount,
        Currency: request.currency || "PLN",
        TransactionType: "PREAUTH",
        ReferenceId: request.referenceId,
      };
      
      const response = await sendRequest(CMD_NAMES.PREAUTH, params, config?.timeout || DEFAULT_TIMEOUT);
      
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
      
      const params = {
        Amount: request.amount,
        Currency: request.currency || "PLN",
        TransactionType: "CAPTURE",
        OriginalTransactionId: request.originalTransactionId,
        OriginalAuthCode: request.originalAuthCode,
      };
      
      const response = await sendRequest(CMD_NAMES.CAPTURE, params, config?.timeout || DEFAULT_TIMEOUT);
      
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
      
      const params = {
        TransactionType: "VOID",
        OriginalTransactionId: request.originalTransactionId,
        OriginalAuthCode: request.originalAuthCode,
        Amount: request.amount > 0 ? request.amount : undefined,
      };
      
      const response = await sendRequest(CMD_NAMES.VOID, params, config?.timeout || DEFAULT_TIMEOUT);
      
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
      const params = {
        Amount: request.amount,
        Currency: request.currency || "PLN",
        TransactionType: "REFUND",
        OriginalTransactionId: request.originalTransactionId,
        ReferenceId: request.referenceId,
      };
      
      const response = await sendRequest(CMD_NAMES.REFUND, params, config?.timeout || DEFAULT_TIMEOUT);
      
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
      const params = {
        TerminalId: request.terminalId,
        OperatorId: request.operatorId,
        PrintReport: request.printReport ? "1" : "0",
      };
      
      const response = await sendRequest(CMD_NAMES.BATCH_CLOSE, params, DEFAULT_TIMEOUT);
      
      if (response.ErrorCode && response.ErrorCode !== "00" && response.ErrorCode !== "") {
        return {
          success: false,
          errorCode: response.ErrorCode,
          errorMessage: response.ErrorMessage || "Błąd zamknięcia batch'a",
        };
      }
      
      return {
        success: true,
        batchNumber: response.BatchNumber || undefined,
        totalAmount: response.BatchTotal ? parseInt(response.BatchTotal) : undefined,
        transactionCount: response.BatchCount ? parseInt(response.BatchCount) : undefined,
        reportData: response.BatchReport || undefined,
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
      const params = {
        Content: request.content,
        Copies: request.copies || 1,
      };
      
      const response = await sendRequest(CMD_NAMES.PRINT, params, STATUS_TIMEOUT);
      
      if (response.ErrorCode && response.ErrorCode !== "00" && response.ErrorCode !== "") {
        return {
          success: false,
          errorCode: response.ErrorCode,
          errorMessage: response.ErrorMessage || "Błąd drukowania",
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
      await sendRequest(CMD_NAMES.CANCEL, {}, STATUS_TIMEOUT);
      return true;
    } catch {
      return false;
    }
  },

  async disconnect(): Promise<void> {
    if (socket) {
      socket.destroy();
      socket = null;
    }
    isInitialized = false;
    config = null;
    receiveBuffer = "";
  },
};

/**
 * Parsuje odpowiedź płatności
 */
function parsePaymentResponse(response: Record<string, string>): PaymentResult {
  const status = mapResponseStatus(response.ResponseCode || response.Success);
  
  if (status !== "APPROVED") {
    return {
      success: false,
      status,
      errorCode: response.ErrorCode || response.ResponseCode,
      errorMessage: response.ErrorMessage || response.ResponseMessage || getDeclineReason(response.ResponseCode),
      transactionTime: new Date(),
    };
  }
  
  // Maskuj numer karty
  let cardNumber = response.CardNumber;
  if (cardNumber && cardNumber.length > 4) {
    cardNumber = `****${cardNumber.slice(-4)}`;
  }
  
  return {
    success: true,
    status: "APPROVED",
    transactionId: response.TransactionId || undefined,
    authCode: response.AuthCode || undefined,
    referenceNumber: response.ReferenceNumber || undefined,
    approvedAmount: response.Amount ? parseInt(response.Amount) : undefined,
    tipAmount: response.TipAmount ? parseInt(response.TipAmount) : undefined,
    cardType: mapCardType(response.CardType || ""),
    cardNumber: cardNumber || undefined,
    cardholderName: response.CardholderName || undefined,
    cardEntryMode: mapEntryMode(response.EntryMode || ""),
    cardExpiryDate: response.ExpiryDate || undefined,
    receiptData: {
      merchantCopy: response.MerchantReceipt || undefined,
      customerCopy: response.CustomerReceipt || undefined,
      terminalId: config?.terminalId,
      aid: response.AID || undefined,
      tvr: response.TVR || undefined,
      tsi: response.TSI || undefined,
    },
    transactionTime: new Date(),
  };
}

/**
 * Zwraca powód odrzucenia dla kodu odpowiedzi
 */
function getDeclineReason(code: string | undefined): string {
  if (!code) return "Transakcja odrzucona";
  
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
    "DECLINED": "Transakcja odrzucona przez bank",
  };
  
  return reasons[code.toUpperCase()] || `Transakcja odrzucona (kod: ${code})`;
}

export default verifoneDriver;
