/**
 * Dzieli kwotę na N równych części tak, że suma części = całość co do grosza.
 * Używane przy split payment (np. 100 zł / 3 = 33.33 + 33.33 + 33.34).
 */

/**
 * Dzieli kwotę (w PLN, 2 miejsca po przecinku) na `partsCount` równych części.
 * Reszta z dzielenia groszy jest rozdzielana na pierwsze części (po groszu).
 * @param totalAmountPLN - kwota w PLN (np. 100)
 * @param partsCount - liczba części (np. 3)
 * @returns tablica kwot w PLN, suma === totalAmountPLN
 */
export function splitAmountIntoEqualParts(totalAmountPLN: number, partsCount: number): number[] {
  if (partsCount < 1 || !Number.isInteger(partsCount)) {
    throw new Error("partsCount musi być liczbą całkowitą >= 1");
  }
  if (totalAmountPLN <= 0 || !Number.isFinite(totalAmountPLN)) {
    throw new Error("totalAmountPLN musi być liczbą dodatnią");
  }
  const totalCents = Math.round(totalAmountPLN * 100);
  const baseCents = Math.floor(totalCents / partsCount);
  const remainder = totalCents - baseCents * partsCount;
  const parts: number[] = [];
  for (let i = 0; i < partsCount; i++) {
    const cents = baseCents + (i >= partsCount - remainder ? 1 : 0);
    parts.push(Math.round(cents * 100) / 10000); // grosze -> PLN (2 miejsca)
  }
  return parts;
}
