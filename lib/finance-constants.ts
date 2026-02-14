/**
 * Stałe i typy finansowe – wydzielone z app/actions/finance.ts,
 * bo pliki "use server" mogą eksportować tylko async functions.
 */

/** Dozwolone metody płatności */
export const VALID_PAYMENT_METHODS = [
  "CASH",
  "CARD",
  "TRANSFER",
  "VOUCHER",
  "PREPAID",
  "BLIK",
  "SPLIT",
  "OTHER",
] as const;
export type PaymentMethod = (typeof VALID_PAYMENT_METHODS)[number];

/** Statusy batch settlementu */
export const VALID_SETTLEMENT_STATUSES = [
  "PENDING",
  "SUBMITTED",
  "SETTLED",
  "FAILED",
  "RECONCILED",
] as const;
export type SettlementStatus = (typeof VALID_SETTLEMENT_STATUSES)[number];

/** Obsługiwane waluty (ISO 4217) */
export const SUPPORTED_CURRENCIES = [
  "PLN",
  "EUR",
  "USD",
  "GBP",
  "CHF",
  "CZK",
  "DKK",
  "NOK",
  "SEK",
  "UAH",
  "RUB",
  "JPY",
  "CAD",
  "AUD",
] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

/** Źródła kursów walut */
export const EXCHANGE_RATE_SOURCES = [
  "MANUAL",
  "NBP",
  "ECB",
  "CUSTOM",
] as const;
export type ExchangeRateSource = (typeof EXCHANGE_RATE_SOURCES)[number];

/** Typy voucherów */
export const VOUCHER_TYPES = [
  "MONETARY",
  "PERCENTAGE",
  "FIXED_DISCOUNT",
  "FREE_NIGHT",
  "PACKAGE",
] as const;
export type VoucherType = (typeof VOUCHER_TYPES)[number];

/** Statusy voucherów */
export const VOUCHER_STATUSES = [
  "ACTIVE",
  "USED",
  "EXPIRED",
  "CANCELLED",
  "SUSPENDED",
] as const;
export type VoucherStatus = (typeof VOUCHER_STATUSES)[number];

/** Kategorie pozycji w folio */
export const FOLIO_CATEGORIES = [
  "ACCOMMODATION",
  "F_B",
  "SPA",
  "PARKING",
  "PHONE",
  "LAUNDRY",
  "TRANSPORT",
  "ATTRACTION",
  "MINIBAR",
  "TAX",
  "DISCOUNT",
  "PAYMENT",
  "DEPOSIT",
  "OTHER",
] as const;
export type FolioCategory = (typeof FOLIO_CATEGORIES)[number];

/** Statusy transakcji w folio */
export const FOLIO_ITEM_STATUSES = ["ACTIVE", "VOIDED", "TRANSFERRED"] as const;
export type FolioItemStatus = (typeof FOLIO_ITEM_STATUSES)[number];

/** Płatnik folio */
export const FOLIO_BILL_TO = ["GUEST", "COMPANY"] as const;
export type FolioBillTo = (typeof FOLIO_BILL_TO)[number];
