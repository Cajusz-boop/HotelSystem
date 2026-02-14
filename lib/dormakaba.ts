/**
 * Integracja z zamkami Dormakaba (np. Saflok, iloq).
 * Konfiguracja: DORMAKABA_API_URL, DORMAKABA_CLIENT_ID, DORMAKABA_CLIENT_SECRET (lub DORMAKABA_API_KEY).
 */

export interface DormakabaGuestKeyRequest {
  roomNumber: string;
  guestName: string;
  validFrom: Date;
  validTo: Date;
  reservationId?: string;
}

export interface DormakabaUnlockRequest {
  roomNumber: string;
  reason?: string;
}

export function isDormakabaConfigured(): boolean {
  const url = process.env.DORMAKABA_API_URL?.trim();
  const id = process.env.DORMAKABA_CLIENT_ID?.trim();
  const secret = process.env.DORMAKABA_CLIENT_SECRET?.trim();
  const key = process.env.DORMAKABA_API_KEY?.trim();
  return !!(url && ((id && secret) || key));
}

async function getDormakabaToken(): Promise<string> {
  const apiKey = process.env.DORMAKABA_API_KEY?.trim();
  if (apiKey) {
    return apiKey.startsWith("Bearer ") ? apiKey : `Bearer ${apiKey}`;
  }
  const url = process.env.DORMAKABA_API_URL?.trim();
  const clientId = process.env.DORMAKABA_CLIENT_ID?.trim();
  const clientSecret = process.env.DORMAKABA_CLIENT_SECRET?.trim();
  if (!url || !clientId || !clientSecret) {
    throw new Error("Skonfiguruj DORMAKABA_API_URL, DORMAKABA_CLIENT_ID, DORMAKABA_CLIENT_SECRET lub DORMAKABA_API_KEY w .env");
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
    throw new Error(`Dormakaba token error: ${res.status} ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as { access_token?: string };
  const token = data.access_token;
  if (!token) throw new Error("Dormakaba: brak access_token w odpowiedzi");
  return `Bearer ${token}`;
}

async function dormakabaFetch(
  path: string,
  options: { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: object } = {}
): Promise<Response> {
  const baseUrl = process.env.DORMAKABA_API_URL?.trim();
  if (!baseUrl) throw new Error("Skonfiguruj DORMAKABA_API_URL w .env");
  const url = baseUrl.replace(/\/$/, "") + path;
  const token = await getDormakabaToken();
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

export async function createDormakabaGuestKey(
  request: DormakabaGuestKeyRequest
): Promise<{ success: true; keyId?: string } | { success: false; error: string }> {
  try {
    const res = await dormakabaFetch("/api/keys", {
      method: "POST",
      body: {
        room_number: request.roomNumber,
        guest_name: request.guestName,
        valid_from: request.validFrom.toISOString(),
        valid_to: request.validTo.toISOString(),
        reservation_id: request.reservationId,
      },
    });
    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `Dormakaba API: ${res.status} ${text.slice(0, 150)}` };
    }
    const data = (await res.json()) as { id?: string; key_id?: string };
    return { success: true, keyId: data.key_id ?? data.id };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd tworzenia klucza Dormakaba",
    };
  }
}

export async function revokeDormakabaGuestKeys(reservationId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await dormakabaFetch("/api/keys/revoke", {
      method: "POST",
      body: { reservation_id: reservationId },
    });
    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `Dormakaba API: ${res.status} ${text.slice(0, 150)}` };
    }
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd unieważniania kluczy Dormakaba",
    };
  }
}

export async function unlockDormakabaDoor(request: DormakabaUnlockRequest): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await dormakabaFetch("/api/doors/unlock", {
      method: "POST",
      body: {
        room_number: request.roomNumber,
        reason: request.reason ?? "reception",
      },
    });
    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `Dormakaba API: ${res.status} ${text.slice(0, 150)}` };
    }
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd otwarcia drzwi Dormakaba",
    };
  }
}
