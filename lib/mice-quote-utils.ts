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
}

/** Przelicza pola pozycji na podstawie quantity, unitPriceNet, vatRate */
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
  };
}
