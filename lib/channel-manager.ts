/**
 * Channel Manager: synchronizacja dostępności i cen z Booking.com, Airbnb, Expedia.
 * Booking.com: B.XML Rates & Availability API (supply-xml.booking.com).
 */

export type Channel = "booking_com" | "airbnb" | "expedia";

const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wykonuje fetch z retry dla błędów sieciowych i 5xx.
 * Zwraca user-friendly komunikat błędu.
 */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  options?: { label?: string }
): Promise<{ ok: boolean; status: number; text: () => Promise<string> }> {
  const label = options?.label ?? "API";
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, init);
      const isRetryable = res.status >= 500 || res.status === 408;
      if (isRetryable && attempt < RETRY_ATTEMPTS) {
        await sleep(RETRY_DELAY_MS * attempt);
        continue;
      }
      return res;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (attempt < RETRY_ATTEMPTS) {
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }
  }
  const msg = lastError?.message ?? "Nieznany błąd";
  throw new Error(
    `${label}: Nie udało się połączyć po ${RETRY_ATTEMPTS} próbach. ${msg}`
  );
}

export interface ChannelSyncOptions {
  propertyId: string;
  dateFrom: string; // YYYY-MM-DD
  dateTo: string;   // YYYY-MM-DD
  /** Dla Booking.com: lista dostępności i cen (room id, rate id, liczba pokoi, cena). */
  inventoryAndRates?: Array<{
    bookingRoomId: number;
    bookingRateId: number;
    dateFrom: string;
    dateTo: string;
    roomsToSell: number;
    price: number;
    currencyCode?: string;
  }>;
}

export interface ChannelSyncResult {
  success: boolean;
  message?: string;
  error?: string;
}

const BOOKING_AVAILABILITY_URL = "https://supply-xml.booking.com/hotels/xml/availability";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Buduje ciało żądania B.XML dla endpointu availability (Booking.com).
 * Struktura: request / room[id] / date[from,to] / currencycode, rate[id], price, roomstosell, closed.
 */
function buildBookingAvailabilityXml(
  inventoryAndRates: NonNullable<ChannelSyncOptions["inventoryAndRates"]>,
  currencyCode: string
): string {
  const lines: string[] = ["<request>"];
  for (const row of inventoryAndRates) {
    lines.push(`  <room id="${row.bookingRoomId}">`);
    lines.push(`    <date from="${escapeXml(row.dateFrom)}" to="${escapeXml(row.dateTo)}">`);
    lines.push(`      <currencycode>${escapeXml(row.currencyCode ?? currencyCode)}</currencycode>`);
    lines.push(`      <rate id="${row.bookingRateId}"/>`);
    lines.push(`      <price>${row.price.toFixed(2)}</price>`);
    lines.push(`      <roomstosell>${Math.min(254, Math.max(0, row.roomsToSell))}</roomstosell>`);
    lines.push(`      <closed>0</closed>`);
    lines.push("    </date>");
    lines.push("  </room>");
  }
  lines.push("</request>");
  return lines.join("\n");
}

/**
 * Parsuje odpowiedź B.XML: <ok/> = sukces, <availability><errors>... = błąd.
 */
function parseBookingAvailabilityResponse(body: string): { success: boolean; error?: string } {
  if (body.includes("<ok/>") || body.includes("<ok></ok>")) {
    return { success: true };
  }
  const errorMatch = body.match(/<error[^>]*code="([^"]*)"[^>]*>[\s\S]*?<message>([\s\S]*?)<\/message>/i);
  if (errorMatch) {
    return { success: false, error: `${errorMatch[1]}: ${errorMatch[2].trim()}` };
  }
  if (body.includes("<errors>")) {
    return { success: false, error: "Booking.com zwrócił błędy (sprawdź odpowiedź XML)." };
  }
  return { success: true };
}

/**
 * Synchronizacja z Booking.com – wysyła dostępność i ceny do B.XML availability.
 * Wymaga: BOOKING_COM_USERNAME, BOOKING_COM_PASSWORD (lub BOOKING_COM_API_KEY w formacie "user:pass")
 * oraz options.inventoryAndRates (mapowanie room/rate/daty/pokoje/cena z systemu na ID Booking.com).
 */
export async function syncToBookingCom(
  options: ChannelSyncOptions
): Promise<ChannelSyncResult> {
  const username = process.env.BOOKING_COM_USERNAME ?? "";
  const password = process.env.BOOKING_COM_PASSWORD ?? "";
  const apiKey = process.env.BOOKING_COM_API_KEY ?? "";
  let auth: string;
  if (apiKey) {
    auth = Buffer.from(apiKey, "utf8").toString("base64");
  } else if (username && password) {
    auth = Buffer.from(`${username}:${password}`, "utf8").toString("base64");
  } else {
    return {
      success: false,
      error:
        "Skonfiguruj BOOKING_COM_USERNAME i BOOKING_COM_PASSWORD (lub BOOKING_COM_API_KEY w formacie user:pass).",
    };
  }

  const inventoryAndRates = options.inventoryAndRates ?? [];
  if (inventoryAndRates.length === 0) {
    return {
      success: false,
      error:
        "Przekaż options.inventoryAndRates (mapowanie room/rate/daty/roomsToSell/price na ID Booking.com).",
    };
  }

  const currencyCode = process.env.BOOKING_COM_CURRENCY ?? "PLN";
  const xml = buildBookingAvailabilityXml(inventoryAndRates, currencyCode);

  try {
    const res = await fetchWithRetry(
      BOOKING_AVAILABILITY_URL,
      {
        method: "POST",
        headers: {
          "Accept-Version": "1.1",
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/xml",
        },
        body: xml,
      },
      { label: "Booking.com" }
    );
    const text = await res.text();
    const parsed = parseBookingAvailabilityResponse(text);
    if (!parsed.success) {
      return { success: false, error: parsed.error };
    }
    if (!res.ok) {
      const errSnippet = text.slice(0, 200).replace(/\s+/g, " ");
      return {
        success: false,
        error: `Booking.com zwrócił błąd HTTP ${res.status}. ${errSnippet || "Sprawdź konfigurację API."}`,
      };
    }
    return { success: true, message: "Dostępność i ceny wysłane do Booking.com." };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd połączenia z Booking.com. Sprawdź dostępność sieci.",
    };
  }
}

const AIRBNB_CALENDAR_URL = "https://api.airbnb.com/v2/calendar_availability";

/**
 * Synchronizacja z Airbnb – wysyła dostępność i ceny do Homes API (kalendarz).
 * Wymaga: AIRBNB_API_KEY (token OAuth/API), options.airbnbListingId oraz options.airbnbCalendar (daty, dostępność, cena).
 */
export async function syncToAirbnb(
  options: ChannelSyncOptions
): Promise<ChannelSyncResult> {
  const apiKey = process.env.AIRBNB_API_KEY ?? "";
  const listingId = (options as ChannelSyncOptions & { airbnbListingId?: string }).airbnbListingId;
  const calendar = (options as ChannelSyncOptions & {
    airbnbCalendar?: Array<{ date: string; available: boolean; price: number }>;
  }).airbnbCalendar;

  if (!apiKey) {
    return {
      success: false,
      error: "Skonfiguruj AIRBNB_API_KEY (token API z developer.airbnb.com).",
    };
  }
  if (!listingId || !calendar?.length) {
    return {
      success: false,
      error:
        "Przekaż airbnbListingId oraz airbnbCalendar (tablica { date, available, price }) w options.",
    };
  }

  const body = {
    listing_id: listingId,
    availability: calendar.map((d) => ({
      date: d.date,
      available: d.available,
      price: { amount: d.price, currency: "PLN" },
    })),
  };

  try {
    const url = process.env.AIRBNB_API_URL ?? AIRBNB_CALENDAR_URL;
    const res = await fetchWithRetry(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Airbnb-API-Key": apiKey,
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      },
      { label: "Airbnb" }
    );
    if (!res.ok) {
      const text = await res.text();
      return {
        success: false,
        error: `Airbnb zwrócił błąd HTTP ${res.status}. ${text.slice(0, 150).replace(/\s+/g, " ")}`,
      };
    }
    return { success: true, message: "Kalendarz wysłany do Airbnb." };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd połączenia z Airbnb. Sprawdź dostępność sieci.",
    };
  }
}

const EXPEDIA_AR_URL = "https://services.expediapartnercentral.com/eqc/ar";
const EXPEDIA_AR_NS = "http://www.expediaconnect.com/EQC/AR/2007/02";

/**
 * Buduje żądanie AvailRateUpdateRQ (Expedia Partner Central – Availability & Rate).
 * Struktura: AvailRateUpdateRQ / AvailRateUpdate / RoomType / RatePlan / DateRange / Inventory, Rate.
 */
function buildExpediaAvailRateXml(
  propertyId: string,
  updates: Array<{ roomTypeId: string; ratePlanId: string; date: string; inventory: number; rate: number }>
): string {
  const lines: string[] = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<AvailRateUpdateRQ xmlns="${EXPEDIA_AR_NS}">`,
    `  <AvailRateUpdate propertyId="${escapeXml(propertyId)}">`,
  ];
  for (const u of updates) {
    lines.push(`    <RoomType id="${escapeXml(u.roomTypeId)}">`);
    lines.push(`      <RatePlan id="${escapeXml(u.ratePlanId)}">`);
    lines.push(`        <DateRange date="${escapeXml(u.date)}" />`);
    lines.push(`        <Inventory>${u.inventory}</Inventory>`);
    lines.push(`        <Rate>${u.rate.toFixed(2)}</Rate>`);
    lines.push(`      </RatePlan>`);
    lines.push(`    </RoomType>`);
  }
  lines.push("  </AvailRateUpdate>");
  lines.push("</AvailRateUpdateRQ>");
  return lines.join("\n");
}

/**
 * Synchronizacja z Expedia – wysyła dostępność i ceny do EQC AR (AvailRateUpdate).
 * Wymaga: EXPEDIA_USERNAME, EXPEDIA_PASSWORD oraz options.expediaPropertyId i options.expediaUpdates (roomTypeId, ratePlanId, date, inventory, rate).
 */
export async function syncToExpedia(
  options: ChannelSyncOptions
): Promise<ChannelSyncResult> {
  const username = process.env.EXPEDIA_USERNAME ?? "";
  const password = process.env.EXPEDIA_PASSWORD ?? "";
  if (!username || !password) {
    return {
      success: false,
      error: "Skonfiguruj EXPEDIA_USERNAME i EXPEDIA_PASSWORD (Expedia Partner Central).",
    };
  }

  const propertyId = (options as ChannelSyncOptions & { expediaPropertyId?: string }).expediaPropertyId;
  const updates = (options as ChannelSyncOptions & {
    expediaUpdates?: Array<{
      roomTypeId: string;
      ratePlanId: string;
      date: string;
      inventory: number;
      rate: number;
    }>;
  }).expediaUpdates;

  if (!propertyId || !updates?.length) {
    return {
      success: false,
      error:
        "Przekaż expediaPropertyId oraz expediaUpdates (roomTypeId, ratePlanId, date, inventory, rate) w options.",
    };
  }

  const xml = buildExpediaAvailRateXml(propertyId, updates);

  try {
    const url = process.env.EXPEDIA_AR_URL ?? EXPEDIA_AR_URL;
    const auth = Buffer.from(`${username}:${password}`, "utf8").toString("base64");
    const res = await fetchWithRetry(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "text/xml",
          Authorization: `Basic ${auth}`,
        },
        body: xml,
      },
      { label: "Expedia" }
    );
    const text = await res.text();
    if (!res.ok) {
      return {
        success: false,
        error: `Expedia zwrócił błąd HTTP ${res.status}. ${text.slice(0, 150).replace(/\s+/g, " ")}`,
      };
    }
    if (text.includes("Error") && text.includes("<Status>")) {
      const errMatch = text.match(/<Message>([\s\S]*?)<\/Message>/i);
      return {
        success: false,
        error: errMatch ? errMatch[1].trim() : "Expedia zwrócił błąd w odpowiedzi XML.",
      };
    }
    return { success: true, message: "Dostępność i ceny wysłane do Expedia." };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd połączenia z Expedia. Sprawdź dostępność sieci.",
    };
  }
}

/** Wyciąga tekst z elementu XML: <tag>value</tag> */
function getXmlTag(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? m[1].trim() : null;
}

export interface BookingReservationItem {
  bookingId: string;
  status: "new" | "modified" | "cancelled";
  guestFirstName: string;
  guestLastName: string;
  guestEmail: string | null;
  guestPhone: string | null;
  checkIn: string;
  checkOut: string;
  bookingRoomId: string;
  roomReservationId: string;
  totalPrice: number;
  currencyCode: string;
  pax: number;
  mealPlan: string | null;
}

const BOOKING_RESERVATIONS_URL = "https://secure-supply-xml.booking.com/hotels/xml/reservations";

/**
 * Pobiera rezerwacje z API Booking.com (B.XML reservations).
 * Wymaga: BOOKING_COM_USERNAME + BOOKING_COM_PASSWORD lub BOOKING_COM_API_KEY.
 */
export async function fetchBookingReservationsApi(
  hotelId: string
): Promise<{ success: true; data: BookingReservationItem[] } | { success: false; error: string }> {
  const username = process.env.BOOKING_COM_USERNAME ?? "";
  const password = process.env.BOOKING_COM_PASSWORD ?? "";
  const apiKey = process.env.BOOKING_COM_API_KEY ?? "";
  let auth: string;
  if (apiKey) {
    auth = Buffer.from(apiKey, "utf8").toString("base64");
  } else if (username && password) {
    auth = Buffer.from(`${username}:${password}`, "utf8").toString("base64");
  } else {
    return {
      success: false,
      error:
        "Skonfiguruj BOOKING_COM_USERNAME i BOOKING_COM_PASSWORD (lub BOOKING_COM_API_KEY).",
    };
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?><request><hotel_id>${escapeXml(hotelId)}</hotel_id></request>`;

  try {
    const res = await fetchWithRetry(
      BOOKING_RESERVATIONS_URL,
      {
        method: "POST",
        headers: {
          "Accept-Version": "1.1",
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/xml",
        },
        body,
      },
      { label: "Booking.com (rezerwacje)" }
    );
    const text = await res.text();

    if (!res.ok) {
      return {
        success: false,
        error: `Booking.com zwrócił błąd HTTP ${res.status}. ${text.slice(0, 200).replace(/\s+/g, " ")}`,
      };
    }

    const items: BookingReservationItem[] = [];
    const reservationMatches = text.matchAll(/<reservation>([\s\S]*?)<\/reservation>/gi);
    for (const rm of reservationMatches) {
      const block = rm[1];
      const status = (getXmlTag(block, "status") ?? "new").toLowerCase();
      const bookingId = getXmlTag(block, "id") ?? "";
      const cust = block.match(/<customer>([\s\S]*?)<\/customer>/i)?.[1] ?? block;
      const firstName = getXmlTag(cust, "first_name") ?? getXmlTag(block, "first_name") ?? "";
      const lastName = getXmlTag(cust, "last_name") ?? getXmlTag(block, "last_name") ?? "";
      const email = getXmlTag(cust, "email") ?? getXmlTag(block, "email") ?? null;
      const phone = getXmlTag(cust, "telephone") ?? getXmlTag(block, "telephone") ?? null;

      const roomMatches = block.matchAll(/<room>([\s\S]*?)<\/room>/gi);
      let pushed = false;
      for (const roomMatch of roomMatches) {
        const roomBlock = roomMatch[1];
        const arrival = getXmlTag(roomBlock, "arrival_date") ?? "";
        const departure = getXmlTag(roomBlock, "departure_date") ?? "";
        const roomId = getXmlTag(roomBlock, "id") ?? "";
        const roomResId = getXmlTag(roomBlock, "roomreservation_id") ?? "";
        const totalPriceStr = getXmlTag(roomBlock, "totalprice") ?? "0";
        const totalPrice = Math.round(parseFloat(totalPriceStr) * 100) / 100;
        const currency = getXmlTag(roomBlock, "currencycode") ?? "PLN";
        const paxStr = getXmlTag(roomBlock, "numberofguests") ?? getXmlTag(roomBlock, "occupancy") ?? "1";
        const pax = Math.max(1, parseInt(paxStr, 10) || 1);
        const mealPlan = getXmlTag(roomBlock, "meal_plan") ?? null;
        const guestName = getXmlTag(roomBlock, "guest_name");
        const fn = guestName ? guestName.split(/\s+/)[0] ?? firstName : firstName;
        const ln = guestName ? guestName.split(/\s+/).slice(1).join(" ") || guestName : lastName;

        items.push({
          bookingId,
          status: status as "new" | "modified" | "cancelled",
          guestFirstName: fn,
          guestLastName: ln,
          guestEmail: email,
          guestPhone: phone,
          checkIn: arrival,
          checkOut: departure,
          bookingRoomId: roomId,
          roomReservationId: roomResId,
          totalPrice,
          currencyCode: currency,
          pax,
          mealPlan,
        });
        pushed = true;
      }
      if (!pushed && bookingId) {
        const room = block.match(/<room>([\s\S]*?)<\/room>/i)?.[1] ?? "";
        items.push({
          bookingId,
          status: status as "new" | "modified" | "cancelled",
          guestFirstName: firstName,
          guestLastName: lastName,
          guestEmail: email,
          guestPhone: phone,
          checkIn: getXmlTag(room, "arrival_date") ?? "",
          checkOut: getXmlTag(room, "departure_date") ?? "",
          bookingRoomId: getXmlTag(room, "id") ?? "",
          roomReservationId: getXmlTag(room, "roomreservation_id") ?? "",
          totalPrice: parseFloat(getXmlTag(room, "totalprice") ?? "0") || 0,
          currencyCode: getXmlTag(room, "currencycode") ?? "PLN",
          pax: parseInt(getXmlTag(room, "numberofguests") ?? "1", 10) || 1,
          mealPlan: getXmlTag(room, "meal_plan") ?? null,
        });
      }
    }

    return { success: true, data: items };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd połączenia z Booking.com. Sprawdź dostępność sieci.",
    };
  }
}
