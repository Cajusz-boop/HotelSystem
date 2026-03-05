/** Oblicza cenę za dobę dla RateCode: wzór (basePrice + pricePerPerson × pax) lub stała price */
export function computeRateCodePricePerNight(
  rc: { price?: number | null; basePrice?: number | null; pricePerPerson?: number | null },
  pax: number
): number | null {
  if (rc.basePrice != null && rc.pricePerPerson != null && Number.isFinite(rc.basePrice) && Number.isFinite(rc.pricePerPerson)) {
    const p = Math.max(1, pax);
    return rc.basePrice + rc.pricePerPerson * p;
  }
  if (rc.price != null && Number.isFinite(rc.price)) return rc.price;
  return null;
}
