/**
 * Webhook – powiadomienia o zdarzeniach (np. nowe rezerwacje).
 * Konfiguracja: WEBHOOK_RESERVATION_URL (env).
 */

export interface ReservationWebhookPayload {
  event: "reservation.created";
  id: string;
  confirmationNumber: string | null;
  guestName: string;
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  status: string;
  source: string | null;
  channel: string | null;
  pax: number | null;
  createdAt: string;
}

/**
 * Wysyła webhook o nowej rezerwacji.
 * Nie blokuje – błędy są logowane, nie rzucane.
 */
export async function sendReservationCreatedWebhook(
  payload: ReservationWebhookPayload
): Promise<void> {
  const url = process.env.WEBHOOK_RESERVATION_URL;
  if (!url || url.trim() === "") return;

  try {
    const res = await fetch(url.trim(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.warn(
        `[Webhook] reservation.created HTTP ${res.status}: ${url}`
      );
    }
  } catch (e) {
    console.warn("[Webhook] reservation.created error:", e);
  }
}
