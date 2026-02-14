/**
 * Rate limiting dla API – in-memory (per proces).
 * Limit: 100 żądań na minutę na klucz (IP lub X-API-Key).
 */

const store = new Map<
  string,
  { count: number; resetAt: number }
>();

const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = Number(process.env.API_RATE_LIMIT_MAX) || 100;

function getKey(request: Request): string {
  const apiKey = request.headers.get("x-api-key")?.trim()
    ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (apiKey) return `key:${apiKey.slice(0, 32)}`;
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "unknown";
  return `ip:${ip}`;
}

/**
 * Sprawdza limit. Zwraca null jeśli OK, lub Response z 429 gdy przekroczono limit.
 */
export function checkApiRateLimit(request: Request): Response | null {
  const key = getKey(request);
  const now = Date.now();
  let entry = store.get(key);

  if (!entry) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return null;
  }

  if (now >= entry.resetAt) {
    entry = { count: 1, resetAt: now + WINDOW_MS };
    store.set(key, entry);
    return null;
  }

  entry.count++;
  if (entry.count > MAX_REQUESTS) {
    return new Response(
      JSON.stringify({
        error: "Przekroczono limit żądań. Spróbuj ponownie za chwilę.",
        retryAfter: Math.ceil((entry.resetAt - now) / 1000),
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(Math.ceil((entry.resetAt - now) / 1000)),
        },
      }
    );
  }
  return null;
}
