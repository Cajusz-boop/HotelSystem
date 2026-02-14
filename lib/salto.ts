/**
 * Integracja z zamkami Salto (Salto Space / Connect API).
 * Konfiguracja: SALTO_API_URL, SALTO_CLIENT_ID, SALTO_CLIENT_SECRET (lub SALTO_API_KEY).
 */

export interface SaltoGuestKeyRequest {
  roomNumber: string;
  guestName: string;
  guestEmail?: string;
  validFrom: Date;
  validTo: Date;
  reservationId?: string;
}

export interface SaltoUnlockRequest {
  roomNumber: string;
  reason?: string;
}

/** Sprawdza, czy integracja Salto jest skonfigurowana. */
export function isSaltoConfigured(): boolean {
  const url = process.env.SALTO_API_URL?.trim();
  const id = process.env.SALTO_CLIENT_ID?.trim();
  const secret = process.env.SALTO_CLIENT_SECRET?.trim();
  const key = process.env.SALTO_API_KEY?.trim();
  return !!(url && ((id && secret) || key));
}

/** Pobiera token Bearer (OAuth2 client_credentials lub API key). */
async function getSaltoToken(): Promise<string> {
  const apiKey = process.env.SALTO_API_KEY?.trim();
  if (apiKey) {
    return apiKey.startsWith("Bearer ") ? apiKey : `Bearer ${apiKey}`;
  }
  const url = process.env.SALTO_API_URL?.trim();
  const clientId = process.env.SALTO_CLIENT_ID?.trim();
  const clientSecret = process.env.SALTO_CLIENT_SECRET?.trim();
  if (!url || !clientId || !clientSecret) {
    throw new Error("Skonfiguruj SALTO_API_URL, SALTO_CLIENT_ID, SALTO_CLIENT_SECRET lub SALTO_API_KEY w .env");
  }
  const tokenUrl = url.replace(/\/$/, "") + "/oauth/token";
  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Salto token error: ${res.status} ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as { access_token?: string };
  const token = data.access_token;
  if (!token) throw new Error("Salto: brak access_token w odpowiedzi");
  return `Bearer ${token}`;
}

/** Wywołuje endpoint Salto API (GET/POST). */
async function saltoFetch(
  path: string,
  options: { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: object } = {}
): Promise<Response> {
  const baseUrl = process.env.SALTO_API_URL?.trim();
  if (!baseUrl) throw new Error("Skonfiguruj SALTO_API_URL w .env");
  const url = baseUrl.replace(/\/$/, "") + path;
  const token = await getSaltoToken();
  const init: RequestInit = {
    method: options.method ?? "GET",
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  };
  if (options.body) init.body = JSON.stringify(options.body);
  return fetch(url, init);
}

/**
 * Tworzy klucz gościa (dostęp do pokoju) w systemie Salto.
 * Endpoint zależy od wersji API (Space Hospitality: np. POST /guests/keys).
 */
export async function createSaltoGuestKey(
  request: SaltoGuestKeyRequest
): Promise<{ success: true; keyId?: string } | { success: false; error: string }> {
  try {
    const res = await saltoFetch("/api/v1/guests/keys", {
      method: "POST",
      body: {
        room_number: request.roomNumber,
        guest_name: request.guestName,
        guest_email: request.guestEmail,
        valid_from: request.validFrom.toISOString(),
        valid_to: request.validTo.toISOString(),
        reservation_id: request.reservationId,
      },
    });
    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `Salto API: ${res.status} ${text.slice(0, 150)}` };
    }
    const data = (await res.json()) as { id?: string; key_id?: string };
    return { success: true, keyId: data.key_id ?? data.id };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd tworzenia klucza Salto",
    };
  }
}

/**
 * Unieważnia klucze gościa (np. przy check-out).
 */
export async function revokeSaltoGuestKeys(reservationId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await saltoFetch("/api/v1/guests/keys/revoke", {
      method: "POST",
      body: { reservation_id: reservationId },
    });
    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `Salto API: ${res.status} ${text.slice(0, 150)}` };
    }
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd unieważniania kluczy Salto",
    };
  }
}

/**
 * Zdalne otwarcie drzwi (np. z recepcji).
 */
export async function unlockSaltoDoor(request: SaltoUnlockRequest): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await saltoFetch("/api/v1/doors/unlock", {
      method: "POST",
      body: {
        room_number: request.roomNumber,
        reason: request.reason ?? "reception",
      },
    });
    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `Salto API: ${res.status} ${text.slice(0, 150)}` };
    }
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd otwarcia drzwi Salto",
    };
  }
}
