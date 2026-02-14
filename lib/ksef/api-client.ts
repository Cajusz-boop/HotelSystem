/**
 * Klient HTTP dla bramki KSeF – żądania z nagłówkami sesji (Bearer token).
 * Retry policy: 3 próby przy błędzie połączenia, exponential backoff 1s, 5s, 30s.
 */

/** Opóźnienia (ms) przed kolejnymi próbami: 1s, 5s, 30s */
const KSEF_RETRY_DELAYS_MS = [1000, 5000, 30_000];
const KSEF_MAX_ATTEMPTS = 3;

function isRetryableConnectionError(res: { ok: boolean; status: number } | null, err?: unknown): boolean {
  if (err) return true;
  if (!res) return true;
  if (res.ok) return false;
  return res.status === 0 || res.status >= 500;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function withRetry<T extends { ok: boolean; status: number }>(
  fn: () => Promise<T>
): Promise<T> {
  let lastResult: T | undefined;
  let lastErr: unknown;
  for (let attempt = 0; attempt < KSEF_MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await sleep(KSEF_RETRY_DELAYS_MS[attempt - 1] ?? 30_000);
    }
    try {
      const result = await fn();
      lastResult = result;
      if (!isRetryableConnectionError(result)) return result;
      lastErr = result;
    } catch (e) {
      lastErr = e;
    }
  }
  if (lastResult !== undefined) return lastResult;
  throw lastErr;
}

import { getEffectiveKsefEnv } from "./env";

function getBaseUrl(): string {
  if (process.env.KSEF_BASE_URL) return process.env.KSEF_BASE_URL.replace(/\/$/, "");
  if (getEffectiveKsefEnv() === "test") return process.env.KSEF_TEST_URL ?? "https://ksef-test.mf.gov.pl";
  return process.env.KSEF_PROD_URL ?? "https://ksef.mf.gov.pl";
}

export interface KsefClientOptions {
  sessionToken: string;
  /** Nadpisanie base URL (opcjonalne) */
  baseUrl?: string;
}

export interface KsefResponse<T = unknown> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

/**
 * GET do API KSeF z nagłówkiem Authorization: Bearer <sessionToken>.
 * Retry przy błędzie połączenia (3 próby, backoff 1s, 5s, 30s).
 */
export async function ksefGet<T = unknown>(
  path: string,
  options: KsefClientOptions
): Promise<KsefResponse<T>> {
  const base = options.baseUrl ?? getBaseUrl();
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;

  return withRetry(async (): Promise<KsefResponse<T>> => {
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${options.sessionToken}`,
        },
      });

      const text = await res.text();
      let data: T | undefined;
      try {
        if (text) data = JSON.parse(text) as T;
      } catch {
        data = text as unknown as T;
      }

      if (!res.ok) {
        return {
          ok: false,
          status: res.status,
          data,
          error: text.slice(0, 500),
        };
      }
      return { ok: true, status: res.status, data };
    } catch (e) {
      return {
        ok: false,
        status: 0,
        error: e instanceof Error ? e.message : "Błąd połączenia z KSeF",
      } as KsefResponse<T>;
    }
  });
}

/**
 * POST do API KSeF z nagłówkiem Authorization i opcjonalnym body.
 * Retry przy błędzie połączenia (3 próby, backoff 1s, 5s, 30s).
 */
export async function ksefPost<T = unknown>(
  path: string,
  options: KsefClientOptions & { body?: string | Record<string, unknown>; contentType?: string }
): Promise<KsefResponse<T>> {
  const base = options.baseUrl ?? getBaseUrl();
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;

  const body =
    typeof options.body === "string"
      ? options.body
      : options.body != null
        ? JSON.stringify(options.body)
        : undefined;
  const contentType = options.contentType ?? (typeof options.body === "string" ? "application/xml" : "application/json");

  return withRetry(async (): Promise<KsefResponse<T>> => {
    try {
      const res = await fetch(url, {
        method: "POST" as const,
        headers: {
          Accept: "application/json",
          "Content-Type": contentType,
          Authorization: `Bearer ${options.sessionToken}`,
        },
        body,
      });

      const text = await res.text();
      let data: T | undefined;
      try {
        if (text) data = JSON.parse(text) as T;
      } catch {
        data = text as unknown as T;
      }

      if (!res.ok) {
        return {
          ok: false,
          status: res.status,
          data,
          error: text.slice(0, 500),
        };
      }
      return { ok: true, status: res.status, data };
    } catch (e) {
      return {
        ok: false,
        status: 0,
        error: e instanceof Error ? e.message : "Błąd połączenia z KSeF",
      } as KsefResponse<T>;
    }
  });
}

/** Wysyłka interaktywna pojedynczej faktury (PUT /api/online/Invoice/Send). Retry przy błędzie połączenia. */
export async function sendInvoice(
  sessionToken: string,
  xmlBody: string,
  baseUrl?: string
): Promise<KsefResponse<{ referenceNumber?: string; [key: string]: unknown }>> {
  const base = baseUrl ?? getBaseUrl();
  const url = `${base}/api/online/Invoice/Send`;
  return withRetry(async () => {
    try {
      const res = await fetch(url, {
        method: "PUT",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/xml",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: xmlBody,
      });
      const text = await res.text();
      let data: { referenceNumber?: string; [key: string]: unknown } | undefined;
      try {
        if (text) data = JSON.parse(text) as { referenceNumber?: string };
      } catch {
        data = { raw: text };
      }
      if (!res.ok) {
        return { ok: false, status: res.status, data, error: text.slice(0, 500) };
      }
      return { ok: true, status: res.status, data: data ?? {} };
    } catch (e) {
      return {
        ok: false,
        status: 0,
        error: e instanceof Error ? e.message : "Błąd wysyłki faktury do KSeF",
      };
    }
  });
}

/** Wynik wysyłki jednej faktury w partii. */
export interface SendInvoiceBatchItemResult {
  index: number;
  ok: boolean;
  status?: number;
  referenceNumber?: string;
  error?: string;
}

/** Pobieranie UPO (GET /api/online/Invoice/Upo/{ksefUuid}). Zwraca URL lub zawartość. */
export async function getInvoiceUpo(
  sessionToken: string,
  ksefUuid: string,
  baseUrl?: string
): Promise<KsefResponse<{ upoUrl?: string; raw?: string }>> {
  const base = baseUrl ?? getBaseUrl();
  const path = `/api/online/Invoice/Upo/${encodeURIComponent(ksefUuid)}`;
  const res = await ksefGet<{ upoUrl?: string; url?: string }>(path, {
    sessionToken,
    baseUrl: base,
  });
  const upoUrl = res.data?.upoUrl ?? res.data?.url;
  if (res.ok && upoUrl) {
    return { ok: true, status: res.status, data: { upoUrl } };
  }
  if (res.ok && res.data) {
    return { ok: true, status: res.status, data: { raw: String(res.data) } };
  }
  return res;
}

/** Polling statusu faktury (GET /api/online/Invoice/Status/{ksefReferenceNumber}). */
export async function getInvoiceStatus(
  sessionToken: string,
  ksefReferenceNumber: string,
  baseUrl?: string
): Promise<KsefResponse<{ status?: string; [key: string]: unknown }>> {
  const base = baseUrl ?? getBaseUrl();
  const path = `/api/online/Invoice/Status/${encodeURIComponent(ksefReferenceNumber)}`;
  return ksefGet<{ status?: string }>(path, { sessionToken, baseUrl: base });
}

/** Wysyłka wsadowa wielu faktur (kolejne wywołania PUT /api/online/Invoice/Send). */
export async function sendInvoiceBatch(
  sessionToken: string,
  xmlBodies: string[],
  baseUrl?: string
): Promise<{ results: SendInvoiceBatchItemResult[]; allOk: boolean }> {
  const results: SendInvoiceBatchItemResult[] = [];
  for (let i = 0; i < xmlBodies.length; i++) {
    const res = await sendInvoice(sessionToken, xmlBodies[i], baseUrl);
    results.push({
      index: i,
      ok: res.ok,
      status: res.status,
      referenceNumber: res.data?.referenceNumber as string | undefined,
      error: res.error,
    });
  }
  const allOk = results.every((r) => r.ok);
  return { results, allOk };
}
