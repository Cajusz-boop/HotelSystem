/**
 * Integracja z systemem energii (karta / kod = włączenie prądu w pokoju).
 * Konfiguracja: ENERGY_SYSTEM_API_URL, ENERGY_SYSTEM_API_KEY (opcjonalnie).
 */

export function isEnergySystemConfigured(): boolean {
  const url = process.env.ENERGY_SYSTEM_API_URL?.trim();
  return !!url;
}

/**
 * Włącza zasilanie w pokoju (np. po check-in, gdy karta/kod jest aktywny).
 */
export async function activateRoomPower(roomNumber: string): Promise<{ success: boolean; error?: string }> {
  const url = process.env.ENERGY_SYSTEM_API_URL?.trim();
  if (!url) {
    return { success: false, error: "Skonfiguruj ENERGY_SYSTEM_API_URL w .env" };
  }

  const apiKey = process.env.ENERGY_SYSTEM_API_KEY?.trim();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (apiKey) {
    headers["Authorization"] = apiKey.startsWith("Bearer ") ? apiKey : `Bearer ${apiKey}`;
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ room_number: roomNumber, action: "activate" }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `Energy system API: ${res.status} ${text.slice(0, 150)}` };
    }
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd włączenia zasilania w pokoju",
    };
  }
}

/**
 * Wyłącza zasilanie w pokoju (np. po check-out).
 */
export async function deactivateRoomPower(roomNumber: string): Promise<{ success: boolean; error?: string }> {
  const url = process.env.ENERGY_SYSTEM_API_URL?.trim();
  if (!url) return { success: false, error: "Skonfiguruj ENERGY_SYSTEM_API_URL w .env" };

  const apiKey = process.env.ENERGY_SYSTEM_API_KEY?.trim();
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  if (apiKey) headers["Authorization"] = apiKey.startsWith("Bearer ") ? apiKey : `Bearer ${apiKey}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ room_number: roomNumber, action: "deactivate" }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `Energy system API: ${res.status} ${text.slice(0, 150)}` };
    }
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd wyłączenia zasilania w pokoju",
    };
  }
}
