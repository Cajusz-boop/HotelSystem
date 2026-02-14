/**
 * Walidacja sumy kontrolnej NIP (10 cyfr, ostatnia = cyfra kontrolna).
 * Używane w schemas i w formularzach (NIP firmy).
 */

export function isValidNipChecksum(nip10: string): boolean {
  const digits = nip10.replace(/\D/g, "");
  if (digits.length !== 10 || !/^\d+$/.test(digits)) return false;
  const weights = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += weights[i]! * parseInt(digits[i]!, 10);
  const expected = sum % 11 === 10 ? 0 : sum % 11;
  return parseInt(digits[9]!, 10) === expected;
}
