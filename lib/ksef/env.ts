/**
 * Efektywne środowisko KSeF: test (bramka ksef-test.mf.gov.pl) lub prod.
 * Tryb Demo (test) jest domyślny; Produkcja wymaga jawnej flagi KSEF_ENV=prod.
 */
export function getEffectiveKsefEnv(): "test" | "prod" {
  const explicit = process.env.KSEF_ENV?.trim().toLowerCase();
  if (explicit === "prod") return "prod";
  return "test";
}

/** Częstotliwość KeepAlive zalecana: co 10 min. */
export const KSEF_KEEPALIVE_INTERVAL_MINUTES = 10;

const KSEF_VERIFY_PATH = "/web/verify";
const KSEF_TEST_BASE = "https://ksef-test.mf.gov.pl";
const KSEF_PROD_BASE = "https://ksef.mf.gov.pl";

/**
 * Generuje link weryfikacyjny do faktury na portalu KSeF.
 */
export function getKsefVerifyUrl(ksefUuid: string): string {
  if (!ksefUuid?.trim()) return "";
  const base = getEffectiveKsefEnv() === "test" ? KSEF_TEST_BASE : KSEF_PROD_BASE;
  return `${base}${KSEF_VERIFY_PATH}/${encodeURIComponent(ksefUuid.trim())}`;
}
