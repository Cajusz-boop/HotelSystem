/**
 * Integracja z BMS (Building Management System – ogrzewanie/klimatyzacja per pokój).
 * Konfiguracja: BMS_API_URL, BMS_API_KEY (opcjonalnie).
 */

export interface BmsRoomClimateRequest {
  roomNumber: string;
  /** tryb: comfort, eco, away, off */
  mode?: string;
  /** temperatura docelowa (°C), opcjonalnie */
  temperatureC?: number;
}

export function isBmsConfigured(): boolean {
  const url = process.env.BMS_API_URL?.trim();
  return !!url;
}

/**
 * Ustawia tryb klimatu/ogrzewania w pokoju (np. comfort przy check-in).
 */
export async function setRoomClimate(
  request: BmsRoomClimateRequest
): Promise<{ success: boolean; error?: string }> {
  const url = process.env.BMS_API_URL?.trim();
  if (!url) {
    return { success: false, error: "Skonfiguruj BMS_API_URL w .env" };
  }

  const apiKey = process.env.BMS_API_KEY?.trim();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (apiKey) {
    headers["Authorization"] = apiKey.startsWith("Bearer ") ? apiKey : `Bearer ${apiKey}`;
  }

  try {
    const body: Record<string, unknown> = {
      room_number: request.roomNumber,
      mode: request.mode ?? "comfort",
    };
    if (request.temperatureC != null) body.temperature_c = request.temperatureC;

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `BMS API: ${res.status} ${text.slice(0, 150)}` };
    }
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd ustawiania klimatu w pokoju",
    };
  }
}
