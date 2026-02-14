/**
 * Integracja z systemem TV hotelowego (powitanie gościa na ekranie TV w pokoju).
 * Konfiguracja: HOTEL_TV_API_URL, HOTEL_TV_API_KEY (opcjonalnie).
 */

export interface HotelTvWelcomeRequest {
  roomNumber: string;
  guestName: string;
  reservationId?: string;
  message?: string;
}

export function isHotelTvConfigured(): boolean {
  const url = process.env.HOTEL_TV_API_URL?.trim();
  return !!url;
}

/**
 * Wysyła powitanie gościa na TV w pokoju (wywołanie po check-in).
 */
export async function sendWelcomeToTv(request: HotelTvWelcomeRequest): Promise<{ success: boolean; error?: string }> {
  const url = process.env.HOTEL_TV_API_URL?.trim();
  if (!url) {
    return { success: false, error: "Skonfiguruj HOTEL_TV_API_URL w .env" };
  }

  const apiKey = process.env.HOTEL_TV_API_KEY?.trim();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (apiKey) {
    headers["Authorization"] = apiKey.startsWith("Bearer ") ? apiKey : `Bearer ${apiKey}`;
  }

  try {
    const body = {
      room_number: request.roomNumber,
      guest_name: request.guestName,
      reservation_id: request.reservationId,
      message: request.message ?? `Witamy, ${request.guestName}!`,
    };
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `Hotel TV API: ${res.status} ${text.slice(0, 150)}` };
    }
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd wysyłania powitania na TV",
    };
  }
}
