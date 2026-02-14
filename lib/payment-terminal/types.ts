/**
 * Typy i interfejsy dla integracji z terminalem płatniczym
 * Obsługuje terminale Ingenico, Verifone oraz mock dla developmentu
 */

// Obsługiwane typy terminali
export type PaymentTerminalType = "INGENICO" | "VERIFONE" | "MOCK";

// Status terminala
export type TerminalStatus =
  | "IDLE"           // Gotowy do pracy
  | "BUSY"           // W trakcie operacji
  | "OFFLINE"        // Brak połączenia
  | "ERROR"          // Błąd
  | "MAINTENANCE";   // Tryb serwisowy

// Typ transakcji terminalowej
export type TerminalTransactionType =
  | "SALE"           // Sprzedaż
  | "PREAUTH"        // Pre-autoryzacja
  | "CAPTURE"        // Przechwycenie pre-auth
  | "VOID"           // Anulowanie
  | "REFUND";        // Zwrot

// Status transakcji
export type TransactionStatus =
  | "PENDING"        // Oczekuje
  | "APPROVED"       // Zatwierdzona
  | "DECLINED"       // Odrzucona
  | "CANCELLED"      // Anulowana
  | "ERROR"          // Błąd
  | "TIMEOUT";       // Timeout

// Typ karty
export type CardType = "VISA" | "MASTERCARD" | "AMEX" | "DINERS" | "DISCOVER" | "JCB" | "OTHER";

// Metoda wprowadzenia karty
export type CardEntryMode = "CHIP" | "SWIPE" | "CONTACTLESS" | "MANUAL" | "FALLBACK";

/**
 * Konfiguracja terminala
 */
export interface TerminalConfig {
  type: PaymentTerminalType;
  terminalId: string;        // Identyfikator terminala
  merchantId?: string;       // ID merchanta
  // Połączenie sieciowe (dla Ingenico/Verifone)
  host?: string;
  port?: number;
  // Połączenie szeregowe
  comPort?: string;
  baudRate?: number;
  // Timeout w ms
  timeout?: number;
  // Opcje
  printReceipt?: boolean;    // Drukuj paragon na terminalu
  requestSignature?: boolean; // Wymagaj podpisu
  allowContactless?: boolean; // Zezwalaj na płatności zbliżeniowe
  currency?: string;         // Waluta (domyślnie PLN)
}

/**
 * Żądanie płatności
 */
export interface PaymentRequest {
  amount: number;            // Kwota w groszach lub jako decimal
  currency?: string;         // Waluta ISO (domyślnie PLN)
  transactionType: TerminalTransactionType;
  referenceId?: string;      // ID referencyjne z systemu hotelowego
  reservationId?: string;    // ID rezerwacji
  description?: string;      // Opis transakcji
  // Dla operacji CAPTURE/VOID/REFUND
  originalTransactionId?: string;
  originalAuthCode?: string;
  // Opcje
  allowPartialApproval?: boolean;
  requestTip?: boolean;
  tipAmount?: number;
}

/**
 * Wynik płatności
 */
export interface PaymentResult {
  success: boolean;
  status: TransactionStatus;
  // Dane transakcji
  transactionId?: string;     // ID transakcji z terminala
  authCode?: string;          // Kod autoryzacji
  referenceNumber?: string;   // Numer referencyjny
  // Kwoty
  approvedAmount?: number;    // Zatwierdzona kwota
  tipAmount?: number;         // Kwota napiwku
  totalAmount?: number;       // Suma całkowita
  // Dane karty (zamaskowane)
  cardType?: CardType;
  cardNumber?: string;        // Zamaskowany numer (np. ****1234)
  cardholderName?: string;    // Nazwa posiadacza
  cardEntryMode?: CardEntryMode;
  cardExpiryDate?: string;    // MM/YY
  // Dodatkowe dane
  receiptData?: TerminalReceiptData;
  errorCode?: string;
  errorMessage?: string;
  rawResponse?: string;       // Surowa odpowiedź (do debugowania)
  // Timestamps
  transactionTime?: Date;
}

/**
 * Dane paragonu terminalowego
 */
export interface TerminalReceiptData {
  merchantCopy?: string;      // Kopia merchanta
  customerCopy?: string;      // Kopia klienta
  merchantName?: string;
  merchantAddress?: string;
  terminalId?: string;
  transactionDate?: string;
  transactionTime?: string;
  aid?: string;               // Application ID (chip)
  tvr?: string;               // Terminal Verification Results
  tsi?: string;               // Transaction Status Information
}

/**
 * Status terminala
 */
export interface TerminalStatusResult {
  success: boolean;
  status: TerminalStatus;
  terminalId?: string;
  terminalModel?: string;
  firmwareVersion?: string;
  lastTransaction?: Date;
  batteryLevel?: number;      // Dla terminali mobilnych (0-100)
  paperStatus?: "OK" | "LOW" | "OUT";
  connectionType?: "ETHERNET" | "WIFI" | "BLUETOOTH" | "USB" | "SERIAL";
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Żądanie zamknięcia batch'a na terminalu
 */
export interface BatchCloseRequest {
  terminalId?: string;
  operatorId?: string;
  printReport?: boolean;
}

/**
 * Wynik zamknięcia batch'a
 */
export interface BatchCloseResult {
  success: boolean;
  batchNumber?: string;
  transactionCount?: number;
  totalAmount?: number;
  creditCount?: number;
  creditAmount?: number;
  debitCount?: number;
  debitAmount?: number;
  reportData?: string;
  errorCode?: string;
  errorMessage?: string;
  closedAt?: Date;
}

/**
 * Żądanie wydruku na terminalu
 */
export interface PrintRequest {
  content: string;           // Treść do wydruku
  copies?: number;           // Liczba kopii
}

/**
 * Wynik wydruku
 */
export interface PrintResult {
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Interfejs drivera terminala płatniczego
 */
export interface PaymentTerminalDriver {
  /**
   * Inicjalizuje połączenie z terminalem
   */
  initialize(config: TerminalConfig): Promise<boolean>;

  /**
   * Pobiera status terminala
   */
  getStatus(): Promise<TerminalStatusResult>;

  /**
   * Przetwarza płatność
   */
  processPayment(request: PaymentRequest): Promise<PaymentResult>;

  /**
   * Przetwarza pre-autoryzację
   */
  processPreAuth(request: PaymentRequest): Promise<PaymentResult>;

  /**
   * Przechwytuje pre-autoryzację (pobranie środków)
   */
  capturePreAuth(request: PaymentRequest): Promise<PaymentResult>;

  /**
   * Anuluje transakcję (void)
   */
  voidTransaction(request: PaymentRequest): Promise<PaymentResult>;

  /**
   * Przetwarza zwrot
   */
  processRefund(request: PaymentRequest): Promise<PaymentResult>;

  /**
   * Zamyka batch dzienny
   */
  closeBatch(request: BatchCloseRequest): Promise<BatchCloseResult>;

  /**
   * Drukuje na terminalu
   */
  print?(request: PrintRequest): Promise<PrintResult>;

  /**
   * Przerywa bieżącą operację
   */
  cancelOperation?(): Promise<boolean>;

  /**
   * Zamyka połączenie z terminalem
   */
  disconnect(): Promise<void>;
}

/**
 * Wynik wykrywania terminali w sieci
 */
export interface TerminalDiscoveryResult {
  success: boolean;
  terminals: Array<{
    type: PaymentTerminalType;
    terminalId: string;
    model?: string;
    ipAddress?: string;
    port?: number;
    serialNumber?: string;
  }>;
  errorMessage?: string;
}
