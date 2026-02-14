/**
 * Polityka haseł: min. długość, złożoność, wygasanie.
 * Konfiguracja z env: PASSWORD_MIN_LENGTH, PASSWORD_REQUIRE_DIGIT, PASSWORD_REQUIRE_UPPER,
 * PASSWORD_REQUIRE_LOWER, PASSWORD_REQUIRE_SPECIAL, PASSWORD_EXPIRY_DAYS.
 */

export const PASSWORD_MIN_LENGTH = Number(process.env.PASSWORD_MIN_LENGTH) || 8;
export const PASSWORD_REQUIRE_DIGIT = process.env.PASSWORD_REQUIRE_DIGIT !== "false";
export const PASSWORD_REQUIRE_UPPER = process.env.PASSWORD_REQUIRE_UPPER !== "false";
export const PASSWORD_REQUIRE_LOWER = process.env.PASSWORD_REQUIRE_LOWER !== "false";
export const PASSWORD_REQUIRE_SPECIAL = process.env.PASSWORD_REQUIRE_SPECIAL !== "false";
export const PASSWORD_EXPIRY_DAYS = Number(process.env.PASSWORD_EXPIRY_DAYS) || 0; // 0 = brak wygasania

const SPECIAL_CHARS = "!@#$%^&*()_+-=[]{}|;:',.<>?/`~";

export function validatePassword(password: string): { valid: true } | { valid: false; error: string } {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { valid: false, error: `Hasło musi mieć co najmniej ${PASSWORD_MIN_LENGTH} znaków.` };
  }
  if (PASSWORD_REQUIRE_DIGIT && !/\d/.test(password)) {
    return { valid: false, error: "Hasło musi zawierać co najmniej jedną cyfrę." };
  }
  if (PASSWORD_REQUIRE_UPPER && !/[A-Z]/.test(password)) {
    return { valid: false, error: "Hasło musi zawierać co najmniej jedną wielką literę." };
  }
  if (PASSWORD_REQUIRE_LOWER && !/[a-z]/.test(password)) {
    return { valid: false, error: "Hasło musi zawierać co najmniej jedną małą literę." };
  }
  if (PASSWORD_REQUIRE_SPECIAL && ![...SPECIAL_CHARS].some((c) => password.includes(c))) {
    return { valid: false, error: `Hasło musi zawierać co najmniej jeden znak specjalny (np. ${SPECIAL_CHARS.slice(0, 10)}…).` };
  }
  return { valid: true };
}

/** Czy hasło użytkownika wygasło lub wymaga zmiany (pierwsze logowanie / starsze niż PASSWORD_EXPIRY_DAYS). */
export function isPasswordExpired(passwordChangedAt: Date | null): boolean {
  if (!passwordChangedAt) return true; // pierwsze logowanie – wymuszenie zmiany hasła
  if (PASSWORD_EXPIRY_DAYS <= 0) return false;
  const expiry = new Date(passwordChangedAt);
  expiry.setDate(expiry.getDate() + PASSWORD_EXPIRY_DAYS);
  return new Date() > expiry;
}
