/**
 * Parsowanie odpowiedzi błędu KSeF (HTTP 400) – wyciąganie kodu MF i opisu do ksefErrorMessage.
 * Struktura odpowiedzi MF: fault/serviceCode, fault/message, details, itp.
 */

/** Znane kody błędów KSeF i ich opisy (skrócone). */
const KSEF_ERROR_CODES: Record<string, string> = {
  "9101": "Nieprawidłowy dokument",
  "9102": "Brak podpisu",
  "9103": "Przekroczona liczba dozwolonych podpisów",
  "9104": "Niewystarczająca liczba wymaganych podpisów",
  "9105": "Nieprawidłowa treść podpisu",
  "21001": "Nieczytelna treść",
  "21111": "Nieprawidłowe wyzwanie autoryzacyjne",
  "21112": "Nieprawidłowy czas tokena",
  "21121": "Limit żądań osiągnięty",
  "21401": "Dokument niezgodny ze schematem (XSD)",
  "21404": "Nieprawidłowy format dokumentu (JSON)",
  "21176": "Duplikat faktury w kontekście sesji",
};

function extractFromJson(obj: unknown): { code?: string; message?: string } {
  if (obj == null || typeof obj !== "object") return {};
  const o = obj as Record<string, unknown>;
  const fault = o.fault as Record<string, unknown> | undefined;
  const code =
    (o.serviceCode as string) ??
    (o.code as string) ??
    (fault?.serviceCode as string) ??
    (fault?.code as string);
  const msg =
    (o.message as string) ??
    (o.errorMessage as string) ??
    (o.details as string) ??
    (fault?.message as string) ??
    (fault?.details as string);
  return {
    code: typeof code === "string" ? code.trim() || undefined : undefined,
    message: typeof msg === "string" ? msg.trim() || undefined : undefined,
  };
}

function extractFromXml(text: string): { code?: string; message?: string } {
  const codeMatch =
    text.match(/<(?:serviceCode|code|errorCode)[^>]*>([^<]+)</i) ??
    text.match(/"?(?:serviceCode|code|errorCode)"?\s*[:=]\s*"?(\d{4,6})"?/i) ??
    text.match(/\b(9\d{3}|2\d{4})\b/);
  const code = codeMatch ? codeMatch[1]?.trim() : undefined;
  const msgMatch =
    text.match(/<(?:message|details|errorMessage)[^>]*>([^<]+)</i) ??
    text.match(/"?(?:message|details)"?\s*[:=]\s*"([^"]+)"/i);
  const message = msgMatch ? msgMatch[1]?.trim() : undefined;
  return { code, message };
}

/**
 * Parsuje odpowiedź błędu KSeF (400) i zwraca czytelny komunikat do zapisania w ksefErrorMessage.
 */
export function parseKsef400Error(responseText: string): string {
  if (!responseText?.trim()) return "Błąd KSeF (400) – brak szczegółów.";
  const trimmed = responseText.trim();
  let code: string | undefined;
  let message: string | undefined;
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      const extracted = extractFromJson(parsed);
      code = extracted.code;
      message = extracted.message;
    } catch {
      message = trimmed.slice(0, 500);
    }
  } else {
    const extracted = extractFromXml(trimmed);
    code = extracted.code;
    message = extracted.message ?? trimmed.slice(0, 500);
  }
  const codeDesc = code ? (KSEF_ERROR_CODES[code] ?? `Kod ${code}`) : undefined;
  const parts: string[] = [];
  if (code) parts.push(`KSeF ${code}`);
  if (codeDesc) parts.push(codeDesc);
  if (message && message !== codeDesc) parts.push(message);
  return parts.length > 0 ? parts.join(": ") : trimmed.slice(0, 500);
}
