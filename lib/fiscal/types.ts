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
  /** Nagłówek paragonu (opcjonalne - z szablonu) */
  headerLines?: string[];
  /** Stopka paragonu (opcjonalne - z szablonu) */
  footerLines?: string[];
}

export interface FiscalReceiptResult {
  success: boolean;
  /** Numer paragonu fiskalnego (jeśli kasa zwróci) */
  receiptNumber?: string;
  /** Komunikat błędu */
  error?: string;
  /** Kod błędu zwrócony przez drukarkę (dla diagnostyki) */
  errorCode?: string;
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
  /** Kod błędu zwrócony przez drukarkę (dla diagnostyki) */
  errorCode?: string;
}

/**
 * Typ raportu fiskalnego.
 * - X (niefiskalny): informacyjny raport bieżący, nie zamyka dnia
 * - Z (fiskalny): raport dobowy, zeruje liczniki, wymagany prawem
 */
export type FiscalReportType = "X" | "Z";

/**
 * Dane raportu fiskalnego X/Z.
 * Zawiera podsumowanie sprzedaży za okres (dla Z: od ostatniego Z).
 */
export interface FiscalReportData {
  /** Typ raportu */
  reportType: FiscalReportType;
  /** Numer raportu (sekwencyjny) */
  reportNumber: string;
  /** Data i czas wygenerowania */
  generatedAt: Date;
  /** Data początku okresu (tylko dla Z) */
  periodStart?: Date;
  /** Data końca okresu (tylko dla Z) */
  periodEnd?: Date;
  /** Suma sprzedaży brutto */
  totalGross: number;
  /** Suma VAT */
  totalVat: number;
  /** Suma sprzedaży netto */
  totalNet: number;
  /** Liczba paragonów */
  receiptCount: number;
  /** Liczba anulowanych paragonów */
  voidCount: number;
  /** Kwota anulacji */
  voidAmount: number;
  /** Podsumowanie per stawka VAT */
  vatSummary: FiscalVatSummary[];
  /** Podsumowanie per typ płatności */
  paymentSummary: FiscalPaymentSummary[];
  /** Numer kasy fiskalnej */
  cashRegisterId?: string;
  /** Surowe dane z drukarki (dla diagnostyki) */
  rawData?: string;
}

/**
 * Podsumowanie sprzedaży per stawka VAT.
 */
export interface FiscalVatSummary {
  /** Litera stawki (A, B, C, D, E, F) */
  vatLetter: string;
  /** Stawka % (23, 8, 5, 0, -1=ZW, -2=NP) */
  vatRate: number;
  /** Sprzedaż netto */
  netAmount: number;
  /** Kwota VAT */
  vatAmount: number;
  /** Sprzedaż brutto */
  grossAmount: number;
}

/**
 * Podsumowanie płatności per typ.
 */
export interface FiscalPaymentSummary {
  /** Typ płatności */
  paymentType: string;
  /** Nazwa (do wyświetlenia) */
  paymentName: string;
  /** Kwota */
  amount: number;
  /** Liczba transakcji */
  transactionCount: number;
}

/**
 * Żądanie wydruku raportu fiskalnego.
 */
export interface FiscalReportRequest {
  /** Typ raportu: X lub Z */
  reportType: FiscalReportType;
  /** Czy pobrać dane raportu (oprócz wydruku) */
  fetchData?: boolean;
  /** Notatka operatora (opcjonalnie) */
  operatorNote?: string;
}

/**
 * Wynik operacji raportu fiskalnego.
 */
export interface FiscalReportResult {
  success: boolean;
  /** Numer raportu (jeśli wydrukowany) */
  reportNumber?: string;
  /** Dane raportu (jeśli żądano fetchData) */
  reportData?: FiscalReportData;
  /** Komunikat błędu */
  error?: string;
  /** Kod błędu */
  errorCode?: string;
  /** Ostrzeżenie (np. brak transakcji do raportu) */
  warning?: string;
}

/**
 * Typ raportu okresowego/miesięcznego.
 * - PERIODIC: raport za wybrany zakres dat (od-do)
 * - MONTHLY: raport za wybrany miesiąc (automatycznie od 1-go do ostatniego dnia)
 */
export type PeriodicReportType = "PERIODIC" | "MONTHLY";

/**
 * Żądanie wydruku raportu okresowego (miesięcznego).
 * 
 * Raport okresowy to zestawienie wszystkich raportów Z z danego okresu.
 * Wymagany przez przepisy do rozliczenia miesięcznego.
 */
export interface PeriodicReportRequest {
  /** Typ raportu */
  reportType: PeriodicReportType;
  /** Data początkowa (dla PERIODIC) */
  dateFrom: Date;
  /** Data końcowa (dla PERIODIC) */
  dateTo: Date;
  /** Miesiąc (1-12) - dla MONTHLY, alternatywa dla dateFrom/dateTo */
  month?: number;
  /** Rok (np. 2026) - dla MONTHLY */
  year?: number;
  /** Czy pobrać szczegółowe dane raportu */
  fetchData?: boolean;
  /** Notatka operatora */
  operatorNote?: string;
}

/**
 * Dane pojedynczego raportu Z w zestawieniu okresowym.
 */
export interface PeriodicZReportEntry {
  /** Numer raportu Z */
  reportNumber: string;
  /** Data raportu */
  date: Date;
  /** Suma brutto */
  totalGross: number;
  /** Suma VAT */
  totalVat: number;
  /** Liczba paragonów */
  receiptCount: number;
  /** Liczba anulacji */
  voidCount: number;
}

/**
 * Dane raportu okresowego/miesięcznego.
 */
export interface PeriodicReportData {
  /** Typ raportu */
  reportType: PeriodicReportType;
  /** Numer raportu okresowego */
  reportNumber: string;
  /** Data wygenerowania */
  generatedAt: Date;
  /** Początek okresu */
  periodStart: Date;
  /** Koniec okresu */
  periodEnd: Date;
  /** Liczba raportów Z w okresie */
  zReportCount: number;
  /** Numer pierwszego raportu Z w okresie */
  firstZReportNumber?: string;
  /** Numer ostatniego raportu Z w okresie */
  lastZReportNumber?: string;
  /** Suma brutto za okres */
  totalGross: number;
  /** Suma VAT za okres */
  totalVat: number;
  /** Suma netto za okres */
  totalNet: number;
  /** Łączna liczba paragonów */
  totalReceiptCount: number;
  /** Łączna liczba anulacji */
  totalVoidCount: number;
  /** Łączna kwota anulacji */
  totalVoidAmount: number;
  /** Podsumowanie VAT za okres */
  vatSummary: FiscalVatSummary[];
  /** Lista raportów Z (jeśli fetchData=true) */
  zReports?: PeriodicZReportEntry[];
  /** Numer kasy fiskalnej */
  cashRegisterId?: string;
}

/**
 * Wynik operacji raportu okresowego/miesięcznego.
 */
export interface PeriodicReportResult {
  success: boolean;
  /** Numer raportu */
  reportNumber?: string;
  /** Dane raportu */
  reportData?: PeriodicReportData;
  /** Komunikat błędu */
  error?: string;
  /** Kod błędu */
  errorCode?: string;
  /** Ostrzeżenie */
  warning?: string;
}

/**
 * Powód storna paragonu fiskalnego.
 * Zgodne z polskimi przepisami fiskalnymi.
 */
export type StornoReason =
  | "CUSTOMER_RETURN"     // Zwrot towaru przez klienta
  | "CUSTOMER_CANCEL"     // Rezygnacja klienta
  | "OPERATOR_ERROR"      // Błąd operatora/kasjera
  | "PRICE_ERROR"         // Błąd ceny
  | "QUANTITY_ERROR"      // Błąd ilości
  | "WRONG_ITEM"          // Pomyłka w pozycji
  | "DOUBLE_SCAN"         // Podwójne zeskanowanie
  | "TECHNICAL_ERROR"     // Błąd techniczny
  | "OTHER";              // Inny powód

/**
 * Żądanie storna (anulowania) paragonu fiskalnego.
 * 
 * UWAGA: Storno musi być wykonane PRZED raportem Z (dobowym).
 * Po raporcie Z możliwe jest tylko wystawienie faktury korygującej.
 */
export interface FiscalStornoRequest {
  /** Numer oryginalnego paragonu do anulowania */
  originalReceiptNumber: string;
  /** Id transakcji w systemie (do powiązania) */
  transactionId: string;
  /** Id rezerwacji (opcjonalnie) */
  reservationId?: string;
  /** Powód storna */
  reason: StornoReason;
  /** Szczegółowy opis powodu (opcjonalnie) */
  reasonDescription?: string;
  /** Pozycje do anulowania (domyślnie wszystkie z paragonu) */
  items?: FiscalReceiptItem[];
  /** Kwota do anulowania (domyślnie cała kwota paragonu) */
  amount?: number;
  /** Data oryginalnego paragonu (do weryfikacji) */
  originalDate?: Date;
  /** Notatka operatora */
  operatorNote?: string;
  /** Czy storno częściowe (tylko niektóre pozycje/kwota) */
  isPartial?: boolean;
}

/**
 * Wynik operacji storna paragonu.
 */
export interface FiscalStornoResult {
  success: boolean;
  /** Numer dokumentu storna */
  stornoNumber?: string;
  /** Numer oryginalnego paragonu (potwierdzenie) */
  originalReceiptNumber?: string;
  /** Kwota storna */
  stornoAmount?: number;
  /** Komunikat błędu */
  error?: string;
  /** Kod błędu */
  errorCode?: string;
  /** Ostrzeżenie */
  warning?: string;
}

/** Sterownik kasy fiskalnej – implementacje: mock, posnet, novitus, elzab */
export interface FiscalDriver {
  /** Nazwa sterownika (mock, posnet, novitus, elzab) */
  name: string;
  /** Wysyła paragon do kasy; nie rzuca – zwraca wynik */
  printReceipt(request: FiscalReceiptRequest): Promise<FiscalReceiptResult>;
  /** Wysyła fakturę do kasy (POSNET itd.); opcjonalne – brak = nie obsługiwane */
  printInvoice?(request: FiscalInvoiceRequest): Promise<FiscalInvoiceResult>;
  /** Drukuje raport X (niefiskalny); opcjonalne – brak = nie obsługiwane */
  printXReport?(request?: FiscalReportRequest): Promise<FiscalReportResult>;
  /** Drukuje raport Z (fiskalny dobowy); opcjonalne – brak = nie obsługiwane */
  printZReport?(request?: FiscalReportRequest): Promise<FiscalReportResult>;
  /** Drukuje raport okresowy/miesięczny; opcjonalne – brak = nie obsługiwane */
  printPeriodicReport?(request: PeriodicReportRequest): Promise<PeriodicReportResult>;
  /** Wykonuje storno (anulowanie) paragonu; opcjonalne – brak = nie obsługiwane */
  printStorno?(request: FiscalStornoRequest): Promise<FiscalStornoResult>;
}

export type FiscalDriverType = "mock" | "posnet" | "novitus" | "elzab";

/**
 * Obsługiwane modele drukarek POSNET.
 * Każdy model ma specyficzne parametry (szerokość linii, protokół, itp.).
 */
export type PosnetModel =
  | "thermal"       // POSNET Thermal – podstawowa drukarka termiczna
  | "thermal_hs"    // POSNET Thermal HS – szybsza wersja
  | "ergo"          // POSNET Ergo – ergonomiczna z większą szerokością
  | "bingo"         // POSNET Bingo – przenośna
  | "bingo_hs"      // POSNET Bingo HS – przenośna szybsza
  | "mobile_hs"     // POSNET Mobile HS – mobilna
  | "neo"           // POSNET NEO – nowa generacja
  | "neo_xl"        // POSNET NEO XL – nowa generacja szeroka
  | "revo"          // POSNET Revo – drukarka z obsługą e-paragonów
  | "trio"          // POSNET Trio – 3-w-1 (terminal+drukarka+kasa)
  | "temo_hs"       // POSNET Temo HS – ekonomiczna
  | "fv"            // POSNET FV – drukarka do faktur
  | "custom";       // Custom – niestandardowy model (parametry z env)

/**
 * Konfiguracja specyficzna dla modelu POSNET.
 * Różne modele mają różne ograniczenia i możliwości.
 */
export interface PosnetModelConfig {
  /** Identyfikator modelu */
  model: PosnetModel;
  /** Nazwa wyświetlana (np. "POSNET Thermal HS") */
  displayName: string;
  /** Maksymalna szerokość linii tekstu (znaki) */
  maxLineWidth: number;
  /** Maksymalna liczba linii nagłówka */
  maxHeaderLines: number;
  /** Maksymalna liczba linii stopki */
  maxFooterLines: number;
  /** Maksymalna długość nazwy pozycji */
  maxItemNameLength: number;
  /** Czy obsługuje e-paragony (KSeF) */
  supportsEReceipt: boolean;
  /** Czy obsługuje wydruk faktur */
  supportsInvoice: boolean;
  /** Czy obsługuje NIP nabywcy na paragonie */
  supportsNipOnReceipt: boolean;
  /** Czy obsługuje kody kreskowe/QR */
  supportsBarcode: boolean;
  /** Czy obsługuje grafikę (logo) */
  supportsGraphics: boolean;
  /** Maksymalna liczba pozycji na paragonie (0 = brak limitu) */
  maxItemsPerReceipt: number;
  /** Wersja protokołu (1 = starszy, 2 = nowszy) */
  protocolVersion: 1 | 2;
  /** Domyślna prędkość transmisji (dla połączeń szeregowych) */
  defaultBaudRate: number;
  /** Kod modelu producenta (do identyfikacji w bridge) */
  manufacturerCode?: string;
  /** Dodatkowe informacje/ograniczenia */
  notes?: string;
}

/**
 * Mapowanie kodów płatności per model POSNET.
 * Różne modele mogą używać różnych kodów dla tych samych metod płatności.
 */
export interface PosnetPaymentCodes {
  cash: string;      // Gotówka
  card: string;      // Karta
  transfer: string;  // Przelew
  voucher: string;   // Bon/voucher
  credit: string;    // Kredyt
  check: string;     // Czek
  other: string;     // Inne
}

/**
 * Konfiguracja stawek VAT dla POSNET.
 * Różne modele mogą mieć różne litery stawek.
 */
export interface PosnetVatRates {
  /** Mapowanie stawki % na literę PTU (np. 23 -> "A") */
  rateToLetter: Record<number, string>;
  /** Mapowanie litery PTU na stawkę % */
  letterToRate: Record<string, number>;
}

export interface FiscalConfig {
  enabled: boolean;
  driver: FiscalDriverType;
  /** NIP jednostki (opcjonalnie – część kas wymaga w konfiguracji) */
  taxId?: string;
  /** Nazwa punktu sprzedaży (opcjonalnie) */
  pointName?: string;
  /** Model drukarki POSNET (jeśli driver = "posnet") */
  posnetModel?: PosnetModel;
  /** Szczegółowa konfiguracja modelu POSNET */
  posnetModelConfig?: PosnetModelConfig;
}
