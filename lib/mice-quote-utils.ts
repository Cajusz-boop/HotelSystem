export type QuoteItemSource = "MENU" | "RESERVATION" | "MANUAL" | "MANUAL_OVERRIDE";

/** Źródła pozycji generowane automatycznie — nadpisywane przy sync (MANUAL i MANUAL_OVERRIDE są zachowywane). */
const AUTO_SOURCES: string[] = [
  "MENU",
  "RESERVATION",
  "MENU_PACKAGE",
  "MENU_PACKAGE_SURCHARGE",
  "MENU_PACKAGE_EXTRA",
];

export function isAutoSource(source?: string | null): boolean {
  return !!source && AUTO_SOURCES.includes(source);
}

export interface GroupQuoteItem {
  name: string;
  unit: string;
  quantity: number;
  unitPriceNet: number;
  vatRate: number;
  netAmount: number;
  vatAmount: number;
  grossAmount: number;
  amount: number;
  /** Opcjonalne: źródło pozycji (np. MENU_PACKAGE, SURCHARGE) */
  source?: string | null;
  /** Opcjonalne: ID encji źródłowej (np. MenuPackage.id) */
  sourceId?: string | null;
  /** Opcjonalne: ID konkretnej pozycji źródłowej (np. MenuPackageSurcharge.id) */
  sourceItemId?: string | null;
}

/** Przelicza pola pozycji na podstawie quantity, unitPriceNet, vatRate. Pola source/sourceId/sourceItemId przepuszcza bez zmian. */
export function recalcGroupQuoteItem(it: Partial<GroupQuoteItem>): GroupQuoteItem {
  const quantity = Number(it.quantity ?? 1) || 0;
  const unitPriceNet = Number(it.unitPriceNet ?? 0) || 0;
  const vatRate = Number(it.vatRate ?? 8) || 0;
  const netAmount = Math.round(quantity * unitPriceNet * 100) / 100;
  const vatAmount = Math.round(netAmount * (vatRate / 100) * 100) / 100;
  const grossAmount = Math.round((netAmount + vatAmount) * 100) / 100;
  return {
    name: String(it.name ?? ""),
    unit: String(it.unit ?? "szt"),
    quantity,
    unitPriceNet,
    vatRate,
    netAmount,
    vatAmount,
    grossAmount,
    amount: grossAmount,
    source: it.source ?? undefined,
    sourceId: it.sourceId ?? undefined,
    sourceItemId: it.sourceItemId ?? undefined,
  };
}
