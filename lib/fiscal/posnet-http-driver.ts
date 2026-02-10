import type {
  FiscalDriver,
  FiscalInvoiceRequest,
  FiscalInvoiceResult,
  FiscalReceiptRequest,
  FiscalReceiptResult,
} from "./types";

function getEnvNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Sterownik POSNET przez HTTP do lokalnego "mostka" (bridge).
 *
 * Aplikacja Next.js (serwer) wysyła JSON z paragonem do usługi w sieci/LAN/localhost,
 * a ta usługa komunikuje się z urządzeniem POSNET (USB/COM/LAN) przy użyciu
 * sterownika producenta / OPOS / własnej implementacji.
 *
 * Wymagane zmienne:
 * - FISCAL_POSNET_ENDPOINT (np. http://127.0.0.1:9977/fiscal/print)
 * Opcjonalne:
 * - FISCAL_POSNET_API_KEY
 * - FISCAL_POSNET_TIMEOUT_MS
 */
const baseUrl =
  (process.env.FISCAL_POSNET_ENDPOINT ?? "http://127.0.0.1:9977/fiscal/print").replace(
    /\/fiscal\/print\/?$/i,
    ""
  ) || "http://127.0.0.1:9977";
const receiptEndpoint = `${baseUrl}/fiscal/print`;
const invoiceEndpoint = `${baseUrl}/fiscal/invoice`;
const apiKey = process.env.FISCAL_POSNET_API_KEY;
const timeoutMs = getEnvNumber("FISCAL_POSNET_TIMEOUT_MS", 8000);

const posnetHttpDriver: FiscalDriver = {
  name: "posnet",

  async printReceipt(request: FiscalReceiptRequest): Promise<FiscalReceiptResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(receiptEndpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(apiKey ? { "x-api-key": apiKey } : {}),
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      const data = (await res.json().catch(() => null)) as unknown;

      if (!res.ok) {
        const error =
          typeof (data as { error?: unknown } | null)?.error === "string"
            ? (data as { error: string }).error
            : `POSNET bridge HTTP ${res.status}`;
        return { success: false, error };
      }

      if (data && typeof (data as { success?: unknown }).success === "boolean") {
        const result = data as FiscalReceiptResult;
        return result;
      }

      // Bridge nie zwrócił standardowego formatu – uznajemy sukces, ale bez numeru.
      return { success: true };
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.name === "AbortError"
            ? `Timeout POSNET bridge (${timeoutMs} ms)`
            : e.message
          : "Błąd połączenia z POSNET bridge";
      return { success: false, error: msg };
    } finally {
      clearTimeout(timeout);
    }
  },

  async printInvoice(request: FiscalInvoiceRequest): Promise<FiscalInvoiceResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(invoiceEndpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(apiKey ? { "x-api-key": apiKey } : {}),
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      const data = (await res.json().catch(() => null)) as unknown;

      if (!res.ok) {
        const error =
          typeof (data as { error?: unknown } | null)?.error === "string"
            ? (data as { error: string }).error
            : `POSNET bridge HTTP ${res.status}`;
        return { success: false, error };
      }

      if (data && typeof (data as { success?: unknown }).success === "boolean") {
        const result = data as FiscalInvoiceResult;
        return result;
      }

      return { success: true };
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.name === "AbortError"
            ? `Timeout POSNET bridge (${timeoutMs} ms)`
            : e.message
          : "Błąd połączenia z POSNET bridge";
      return { success: false, error: msg };
    } finally {
      clearTimeout(timeout);
    }
  },
};

export default posnetHttpDriver;

