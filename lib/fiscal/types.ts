/**
 * Typy dla integracji z kasami fiskalnymi (Polska).
 * Sterowniki: mock (symulacja), posnet, novitus, elzab – do rozszerzenia.
 */

export interface FiscalReceiptItem {
  /** Nazwa pozycji (np. "Nocleg pokój 101") */
  name: string;
  /** Ilość (np. 1) */
  quantity: number;
  /** Cena jednostkowa (netto lub brutto – zależnie od konfiguracji) */
  unitPrice: number;
  /** Stawka VAT w % (np. 8, 23) – opcjonalnie */
  vatRate?: number;
}

export interface FiscalReceiptRequest {
  /** Id transakcji w systemie hotelowym */
  transactionId: string;
  /** Id rezerwacji */
  reservationId: string;
  /** Pozycje paragonu (zwykle jedna: np. "Nocleg" lub "Zaliczka") */
  items: FiscalReceiptItem[];
  /** Suma do zapłaty (powinna być zgodna z sumą pozycji) */
  totalAmount: number;
  /** Typ płatności: CASH, CARD, DEPOSIT, POSTING, ROOM, itd. */
  paymentType: string;
  /** Opis (np. "Zaliczka", "Obciążenie pokoju") */
  description?: string;
}

export interface FiscalReceiptResult {
  success: boolean;
  /** Numer paragonu fiskalnego (jeśli kasa zwróci) */
  receiptNumber?: string;
  /** Komunikat błędu */
  error?: string;
}

/** Dane firmy (nabywcy) na fakturze */
export interface FiscalInvoiceCompany {
  nip: string;
  name: string;
  address?: string | null;
  postalCode?: string | null;
  city?: string | null;
}

/** Żądanie wydruku faktury na kasie fiskalnej (POSNET itd.) */
export interface FiscalInvoiceRequest {
  reservationId: string;
  /** Firma (nabywca) – z meldunku */
  company: FiscalInvoiceCompany;
  /** Pozycje faktury (np. nocleg, zaliczka) */
  items: FiscalReceiptItem[];
  /** Suma do zapłaty */
  totalAmount: number;
  /** Opcjonalny opis (np. "Faktura za pobyt") */
  description?: string;
}

export interface FiscalInvoiceResult {
  success: boolean;
  invoiceNumber?: string;
  error?: string;
}

/** Sterownik kasy fiskalnej – implementacje: mock, posnet, novitus, elzab */
export interface FiscalDriver {
  /** Nazwa sterownika (mock, posnet, novitus, elzab) */
  name: string;
  /** Wysyła paragon do kasy; nie rzuca – zwraca wynik */
  printReceipt(request: FiscalReceiptRequest): Promise<FiscalReceiptResult>;
  /** Wysyła fakturę do kasy (POSNET itd.); opcjonalne – brak = nie obsługiwane */
  printInvoice?(request: FiscalInvoiceRequest): Promise<FiscalInvoiceResult>;
}

export type FiscalDriverType = "mock" | "posnet" | "novitus" | "elzab";

export interface FiscalConfig {
  enabled: boolean;
  driver: FiscalDriverType;
  /** NIP jednostki (opcjonalnie – część kas wymaga w konfiguracji) */
  taxId?: string;
  /** Nazwa punktu sprzedaży (opcjonalnie) */
  pointName?: string;
}
