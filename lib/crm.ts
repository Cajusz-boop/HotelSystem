/**
 * Integracja z CRM (HubSpot, Salesforce) – synchronizacja gości/kontaktów.
 * Konfiguracja: HUBSPOT_API_KEY, SALESFORCE_CLIENT_ID, SALESFORCE_CLIENT_SECRET, SALESFORCE_INSTANCE_URL.
 */

import { prisma } from "@/lib/db";

export interface CrmContactPayload {
  email: string | null;
  name: string;
  phone: string | null;
  guestId: string;
}

export function isHubSpotConfigured(): boolean {
  return !!process.env.HUBSPOT_API_KEY?.trim();
}

export function isSalesforceConfigured(): boolean {
  const id = process.env.SALESFORCE_CLIENT_ID?.trim();
  const secret = process.env.SALESFORCE_CLIENT_SECRET?.trim();
  const url = process.env.SALESFORCE_INSTANCE_URL?.trim();
  return !!(id && secret && url);
}

async function getGuestPayload(guestId: string): Promise<CrmContactPayload | null> {
  const guest = await prisma.guest.findUnique({
    where: { id: guestId },
    select: { id: true, email: true, name: true, phone: true },
  });
  if (!guest) return null;
  return {
    guestId: guest.id,
    email: guest.email ?? null,
    name: guest.name,
    phone: guest.phone ?? null,
  };
}

/**
 * HubSpot – tworzy lub aktualizuje kontakt (search by email, then create/update).
 */
export async function syncGuestToHubSpot(guestId: string): Promise<{ success: boolean; error?: string; contactId?: string }> {
  const key = process.env.HUBSPOT_API_KEY?.trim();
  if (!key) return { success: false, error: "Skonfiguruj HUBSPOT_API_KEY w .env" };

  const payload = await getGuestPayload(guestId);
  if (!payload) return { success: false, error: "Gość nie istnieje" };

  try {
    const props = {
      email: payload.email ?? "",
      firstname: payload.name.split(" ")[0] ?? payload.name,
      lastname: payload.name.split(" ").slice(1).join(" ") || "",
      phone: payload.phone ?? "",
    };

    if (payload.email) {
      const searchRes = await fetch(
        "https://api.hubapi.com/crm/v3/objects/contacts/search",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: payload.email }] }],
          }),
        }
      );
      if (searchRes.ok) {
        const data = (await searchRes.json()) as { results?: { id: string }[] };
        if (data.results?.length) {
          const contactId = data.results[0].id;
          const updateRes = await fetch(
            `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`,
            {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${key}`,
              },
              body: JSON.stringify({ properties: props }),
            }
          );
          if (updateRes.ok) return { success: true, contactId };
        }
      }
    }

    const createRes = await fetch("https://api.hubapi.com/crm/v3/objects/contacts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ properties: props }),
    });
    if (!createRes.ok) {
      const text = await createRes.text();
      return { success: false, error: `HubSpot: ${createRes.status} ${text.slice(0, 150)}` };
    }
    const created = (await createRes.json()) as { id?: string };
    return { success: true, contactId: created.id };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd synchronizacji z HubSpot",
    };
  }
}

/**
 * Salesforce – tworzy lub aktualizuje Contact (wymaga wcześniejszego tokenu OAuth lub JWT).
 * Uproszczona wersja: wywołanie API z client credentials (jeśli skonfigurowane).
 */
export async function syncGuestToSalesforce(guestId: string): Promise<{ success: boolean; error?: string }> {
  const payload = await getGuestPayload(guestId);
  if (!payload) return { success: false, error: "Gość nie istnieje" };

  const instanceUrl = process.env.SALESFORCE_INSTANCE_URL?.trim();
  const accessToken = process.env.SALESFORCE_ACCESS_TOKEN?.trim();
  if (!instanceUrl || !accessToken) {
    return { success: false, error: "Skonfiguruj SALESFORCE_INSTANCE_URL i SALESFORCE_ACCESS_TOKEN (lub flow OAuth) w .env" };
  }

  try {
    const body = {
      Email: payload.email ?? undefined,
      FirstName: payload.name.split(" ")[0] ?? payload.name,
      LastName: payload.name.split(" ").slice(1).join(" ") || "—",
      Phone: payload.phone ?? undefined,
    };

    const res = await fetch(`${instanceUrl.replace(/\/$/, "")}/services/data/v59.0/sobjects/Contact`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      return { success: false, error: `Salesforce: ${res.status} ${text.slice(0, 150)}` };
    }
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd synchronizacji z Salesforce",
    };
  }
}
