/**
 * Integracja z Mailchimp (newsletter, listy odbiorców).
 * Konfiguracja: MAILCHIMP_API_KEY, MAILCHIMP_AUDIENCE_ID (list id / audience id).
 * API key format: xxx-us21 (prefix + datacenter).
 */

export function isMailchimpConfigured(): boolean {
  const key = process.env.MAILCHIMP_API_KEY?.trim();
  const audienceId = process.env.MAILCHIMP_AUDIENCE_ID?.trim();
  return !!(key && audienceId);
}

/**
 * Dodaje lub aktualizuje kontakt na liście Mailchimp (subscribe do newslettera).
 */
export async function subscribeToMailchimp(
  email: string,
  options?: { firstName?: string; lastName?: string }
): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.MAILCHIMP_API_KEY?.trim();
  const audienceId = process.env.MAILCHIMP_AUDIENCE_ID?.trim();
  if (!apiKey || !audienceId) {
    return { success: false, error: "Skonfiguruj MAILCHIMP_API_KEY i MAILCHIMP_AUDIENCE_ID w .env" };
  }

  const dc = apiKey.includes("-") ? apiKey.split("-")[1] : "us1";
  const baseUrl = `https://${dc}.api.mailchimp.com/3.0`;
  const auth = Buffer.from(`anystring:${apiKey}`).toString("base64");

  const { createHash } = await import("crypto");
  const subscriberHash = createHash("md5").update(email.toLowerCase()).digest("hex");

  try {
    const body = {
      email_address: email,
      status: "subscribed",
      merge_fields: {
        FNAME: options?.firstName ?? "",
        LNAME: options?.lastName ?? "",
      },
    };

    const res = await fetch(`${baseUrl}/lists/${audienceId}/members/${subscriberHash}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(body),
    });

    if (res.ok || res.status === 200) return { success: true };
    const data = (await res.json()) as { detail?: string };
    return { success: false, error: data.detail ?? `Mailchimp: ${res.status}` };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd zapisu do Mailchimp",
    };
  }
}
