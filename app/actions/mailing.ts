"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const RESEND_FROM = process.env.RESEND_FROM ?? "";

/**
 * Waliduje format adresu e-mail.
 * RFC 5322 compliant regex (uproszczona wersja).
 */
function isValidEmail(email: string): boolean {
  // Uproszczony regex zgodny z większością przypadków użycia
  // - co najmniej 1 znak przed @
  // - @ jako separator
  // - domena z co najmniej jedną kropką
  // - TLD minimum 2 znaki
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  
  // Dodatkowe sprawdzenia:
  // - nie może być pusta
  // - max długość zgodna ze standardami (254 znaki)
  // - nie może zaczynać się ani kończyć kropką w części lokalnej
  if (!email || email.length > 254) {
    return false;
  }
  
  const [localPart, domain] = email.split("@");
  
  // Sprawdź część lokalną
  if (!localPart || localPart.length > 64) {
    return false;
  }
  if (localPart.startsWith(".") || localPart.endsWith(".") || localPart.includes("..")) {
    return false;
  }
  
  // Sprawdź domenę
  if (!domain || domain.length > 255) {
    return false;
  }
  
  return emailRegex.test(email);
}

/**
 * Wysyła e-mail przez Resend (api.resend.com).
 * Wymaga: RESEND_API_KEY, RESEND_FROM (np. "Hotel <noreply@domena.pl>").
 */
export async function sendMailViaResend(
  to: string,
  subject: string,
  html: string,
  text?: string
): Promise<{ success: boolean; error?: string }> {
  if (!RESEND_API_KEY || !RESEND_FROM) {
    return {
      success: false,
      error: "Skonfiguruj RESEND_API_KEY i RESEND_FROM (np. \"Hotel <noreply@domena.pl>\").",
    };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [to],
        subject,
        html,
        text: text ?? undefined,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { message?: string; id?: string };
    if (!res.ok) {
      return {
        success: false,
        error: (data as { message?: string }).message ?? `Resend HTTP ${res.status}`,
      };
    }
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd połączenia z Resend",
    };
  }
}

/**
 * Wysyła e-mail z potwierdzeniem rezerwacji do gościa (Resend).
 */
export async function sendReservationConfirmation(
  reservationId: string
): Promise<ActionResult<{ sentTo: string }>> {
  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { guest: true, room: true },
    });
    if (!reservation) return { success: false, error: "Rezerwacja nie istnieje" };
    const email = reservation.guest.email?.trim();
    if (!email) return { success: false, error: "Brak adresu e-mail u gościa" };
    
    // Walidacja formatu e-mail
    if (!isValidEmail(email)) {
      return { 
        success: false, 
        error: `Nieprawidłowy format adresu e-mail: "${email}". Popraw adres w karcie gościa.` 
      };
    }

    const checkIn = new Date(reservation.checkIn).toLocaleDateString("pl-PL");
    const checkOut = new Date(reservation.checkOut).toLocaleDateString("pl-PL");
    const subject = `Potwierdzenie rezerwacji – pokój ${reservation.room.number}`;
    const text = `Dzień dobry ${reservation.guest.name},\n\nPotwierdzamy rezerwację:\nPokój: ${reservation.room.number}\nZameldowanie: ${checkIn}\nWymeldowanie: ${checkOut}\n\nDo zobaczenia!\n`;
    const html = `<p>Dzień dobry ${escapeHtml(reservation.guest.name)},</p><p>Potwierdzamy rezerwację:</p><ul><li>Pokój: ${escapeHtml(reservation.room.number)}</li><li>Zameldowanie: ${escapeHtml(checkIn)}</li><li>Wymeldowanie: ${escapeHtml(checkOut)}</li></ul><p>Do zobaczenia!</p>`;

    const result = await sendMailViaResend(email, subject, html, text);
    if (!result.success) {
      return { success: false, error: result.error ?? "Błąd wysyłania e-mail" };
    }
    revalidatePath("/reports");
    return { success: true, data: { sentTo: email } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd wysyłania potwierdzenia",
    };
  }
}

/**
 * Wysyła e-mail z podziękowaniem po pobycie (Resend).
 */
export async function sendThankYouAfterStay(
  reservationId: string
): Promise<ActionResult<{ sentTo: string }>> {
  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { guest: true },
    });
    if (!reservation) return { success: false, error: "Rezerwacja nie istnieje" };
    if (reservation.status !== "CHECKED_OUT") {
      return { success: false, error: "E-mail z podziękowaniem wysyła się po wymeldowaniu" };
    }
    const email = reservation.guest.email?.trim();
    if (!email) return { success: false, error: "Brak adresu e-mail u gościa" };
    
    // Walidacja formatu e-mail
    if (!isValidEmail(email)) {
      return { 
        success: false, 
        error: `Nieprawidłowy format adresu e-mail: "${email}". Popraw adres w karcie gościa.` 
      };
    }

    const subject = "Dziękujemy za pobyt";
    const text = `Dzień dobry ${reservation.guest.name},\n\nDziękujemy za pobyt. Mamy nadzieję, że spotkamy się ponownie!\n`;
    const html = `<p>Dzień dobry ${escapeHtml(reservation.guest.name)},</p><p>Dziękujemy za pobyt. Mamy nadzieję, że spotkamy się ponownie!</p>`;

    const result = await sendMailViaResend(email, subject, html, text);
    if (!result.success) {
      return { success: false, error: result.error ?? "Błąd wysyłania e-mail" };
    }
    revalidatePath("/reports");
    return { success: true, data: { sentTo: email } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd wysyłania podziękowania",
    };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ===== SZABLONY E-MAIL =====

export type EmailTemplateType = 
  | "CONFIRMATION" 
  | "REMINDER" 
  | "THANK_YOU" 
  | "INVOICE" 
  | "CANCELLATION" 
  | "WEB_CHECK_IN";

export interface EmailTemplateForList {
  id: string;
  type: string;
  name: string;
  subject: string;
  isActive: boolean;
  updatedAt: Date;
}

export interface EmailTemplateDetails extends EmailTemplateForList {
  bodyHtml: string;
  bodyText: string | null;
  availableVariables: string | null;
  createdAt: Date;
}

/**
 * Domyślne szablony e-mail (używane gdy brak w bazie).
 */
const DEFAULT_TEMPLATES: Record<EmailTemplateType, {
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  availableVariables: string;
}> = {
  CONFIRMATION: {
    name: "Potwierdzenie rezerwacji",
    subject: "Potwierdzenie rezerwacji – pokój {{roomNumber}}",
    bodyHtml: `<p>Dzień dobry {{guestName}},</p>
<p>Potwierdzamy rezerwację:</p>
<ul>
  <li><strong>Pokój:</strong> {{roomNumber}}</li>
  <li><strong>Zameldowanie:</strong> {{checkIn}}</li>
  <li><strong>Wymeldowanie:</strong> {{checkOut}}</li>
  <li><strong>Liczba nocy:</strong> {{nights}}</li>
</ul>
{{#confirmationNumber}}<p>Numer potwierdzenia: <strong>{{confirmationNumber}}</strong></p>{{/confirmationNumber}}
<p>Do zobaczenia!</p>`,
    bodyText: `Dzień dobry {{guestName}},

Potwierdzamy rezerwację:
- Pokój: {{roomNumber}}
- Zameldowanie: {{checkIn}}
- Wymeldowanie: {{checkOut}}
- Liczba nocy: {{nights}}

Do zobaczenia!`,
    availableVariables: "{{guestName}}, {{roomNumber}}, {{checkIn}}, {{checkOut}}, {{nights}}, {{confirmationNumber}}, {{totalAmount}}",
  },
  REMINDER: {
    name: "Przypomnienie o rezerwacji",
    subject: "Przypomnienie – Twoja rezerwacja już jutro!",
    bodyHtml: `<p>Dzień dobry {{guestName}},</p>
<p>Przypominamy o zbliżającej się rezerwacji:</p>
<ul>
  <li><strong>Pokój:</strong> {{roomNumber}}</li>
  <li><strong>Zameldowanie:</strong> {{checkIn}}</li>
  <li><strong>Wymeldowanie:</strong> {{checkOut}}</li>
</ul>
<p>Czekamy na Państwa!</p>`,
    bodyText: `Dzień dobry {{guestName}},

Przypominamy o zbliżającej się rezerwacji:
- Pokój: {{roomNumber}}
- Zameldowanie: {{checkIn}}
- Wymeldowanie: {{checkOut}}

Czekamy na Państwa!`,
    availableVariables: "{{guestName}}, {{roomNumber}}, {{checkIn}}, {{checkOut}}, {{nights}}, {{confirmationNumber}}",
  },
  THANK_YOU: {
    name: "Podziękowanie po pobycie",
    subject: "Dziękujemy za pobyt!",
    bodyHtml: `<p>Dzień dobry {{guestName}},</p>
<p>Dziękujemy za pobyt w naszym hotelu!</p>
<p>Mamy nadzieję, że wizyta spełniła Państwa oczekiwania i spotkamy się ponownie.</p>
<p>Pozdrawiamy serdecznie!</p>`,
    bodyText: `Dzień dobry {{guestName}},

Dziękujemy za pobyt w naszym hotelu!

Mamy nadzieję, że wizyta spełniła Państwa oczekiwania i spotkamy się ponownie.

Pozdrawiamy serdecznie!`,
    availableVariables: "{{guestName}}, {{roomNumber}}, {{checkIn}}, {{checkOut}}, {{nights}}",
  },
  INVOICE: {
    name: "Faktura",
    subject: "Faktura nr {{invoiceNumber}}",
    bodyHtml: `<p>Dzień dobry {{guestName}},</p>
<p>W załączeniu przesyłamy fakturę nr <strong>{{invoiceNumber}}</strong> za pobyt.</p>
<p>Kwota do zapłaty: <strong>{{totalAmount}} zł</strong></p>
<p>Termin płatności: {{dueDate}}</p>`,
    bodyText: `Dzień dobry {{guestName}},

W załączeniu przesyłamy fakturę nr {{invoiceNumber}} za pobyt.
Kwota do zapłaty: {{totalAmount}} zł
Termin płatności: {{dueDate}}`,
    availableVariables: "{{guestName}}, {{invoiceNumber}}, {{totalAmount}}, {{dueDate}}, {{companyName}}, {{companyNip}}",
  },
  CANCELLATION: {
    name: "Anulowanie rezerwacji",
    subject: "Potwierdzenie anulowania rezerwacji",
    bodyHtml: `<p>Dzień dobry {{guestName}},</p>
<p>Potwierdzamy anulowanie rezerwacji:</p>
<ul>
  <li><strong>Pokój:</strong> {{roomNumber}}</li>
  <li><strong>Planowane daty:</strong> {{checkIn}} - {{checkOut}}</li>
</ul>
<p>Mamy nadzieję, że spotkamy się w przyszłości!</p>`,
    bodyText: `Dzień dobry {{guestName}},

Potwierdzamy anulowanie rezerwacji:
- Pokój: {{roomNumber}}
- Planowane daty: {{checkIn}} - {{checkOut}}

Mamy nadzieję, że spotkamy się w przyszłości!`,
    availableVariables: "{{guestName}}, {{roomNumber}}, {{checkIn}}, {{checkOut}}, {{confirmationNumber}}, {{cancellationReason}}",
  },
  WEB_CHECK_IN: {
    name: "Link do Web Check-in",
    subject: "Zamelduj się online przed przyjazdem",
    bodyHtml: `<p>Dzień dobry {{guestName}},</p>
<p>Możesz zameldować się online przed przyjazdem, oszczędzając czas na recepcji.</p>
<p><a href="{{webCheckInUrl}}" style="background:#2563eb;color:white;padding:10px 20px;text-decoration:none;border-radius:4px;">Zamelduj się online</a></p>
<p>Link wygasa: {{expiresAt}}</p>
<p>Dane rezerwacji:</p>
<ul>
  <li><strong>Pokój:</strong> {{roomNumber}}</li>
  <li><strong>Zameldowanie:</strong> {{checkIn}}</li>
</ul>`,
    bodyText: `Dzień dobry {{guestName}},

Możesz zameldować się online przed przyjazdem:
{{webCheckInUrl}}

Link wygasa: {{expiresAt}}

Dane rezerwacji:
- Pokój: {{roomNumber}}
- Zameldowanie: {{checkIn}}`,
    availableVariables: "{{guestName}}, {{roomNumber}}, {{checkIn}}, {{checkOut}}, {{webCheckInUrl}}, {{expiresAt}}",
  },
};

/**
 * Pobiera szablon e-mail z bazy lub zwraca domyślny.
 */
async function getEmailTemplate(type: EmailTemplateType): Promise<{
  subject: string;
  bodyHtml: string;
  bodyText: string | null;
  isActive: boolean;
}> {
  const dbTemplate = await prisma.emailTemplate.findUnique({
    where: { type },
    select: {
      subject: true,
      bodyHtml: true,
      bodyText: true,
      isActive: true,
    },
  });

  if (dbTemplate) {
    return dbTemplate;
  }

  // Zwróć domyślny szablon
  const defaultTpl = DEFAULT_TEMPLATES[type];
  return {
    subject: defaultTpl.subject,
    bodyHtml: defaultTpl.bodyHtml,
    bodyText: defaultTpl.bodyText,
    isActive: true,
  };
}

/**
 * Zastępuje zmienne {{nazwa}} w tekście wartościami z obiektu.
 */
function replaceTemplateVariables(
  template: string,
  variables: Record<string, string | number | null | undefined>
): string {
  let result = template;
  
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    result = result.replace(regex, value != null ? escapeHtml(String(value)) : "");
  }
  
  // Usuń nieużyte zmienne
  result = result.replace(/\{\{[a-zA-Z0-9_]+\}\}/g, "");
  
  // Obsługa warunków {{#variable}}...{{/variable}}
  result = result.replace(/\{\{#([a-zA-Z0-9_]+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (match, varName, content) => {
    const value = variables[varName];
    return value != null && value !== "" ? content : "";
  });
  
  return result;
}

/**
 * Zastępuje zmienne w tekście (bez escape HTML - dla tekstu plain).
 */
function replaceTemplateVariablesPlain(
  template: string,
  variables: Record<string, string | number | null | undefined>
): string {
  let result = template;
  
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    result = result.replace(regex, value != null ? String(value) : "");
  }
  
  // Usuń nieużyte zmienne
  result = result.replace(/\{\{[a-zA-Z0-9_]+\}\}/g, "");
  
  return result;
}

// ===== ZARZĄDZANIE SZABLONAMI =====

/**
 * Pobiera wszystkie szablony e-mail.
 */
export async function getAllEmailTemplates(): Promise<ActionResult<EmailTemplateForList[]>> {
  try {
    const templates = await prisma.emailTemplate.findMany({
      select: {
        id: true,
        type: true,
        name: true,
        subject: true,
        isActive: true,
        updatedAt: true,
      },
      orderBy: { type: "asc" },
    });

    // Dodaj domyślne szablony, które nie są w bazie
    const existingTypes = new Set(templates.map((t) => t.type));
    const allTemplates: EmailTemplateForList[] = [...templates];

    for (const [type, defaultTpl] of Object.entries(DEFAULT_TEMPLATES)) {
      if (!existingTypes.has(type)) {
        allTemplates.push({
          id: `default-${type}`,
          type,
          name: defaultTpl.name,
          subject: defaultTpl.subject,
          isActive: true,
          updatedAt: new Date(),
        });
      }
    }

    return { success: true, data: allTemplates };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania szablonów",
    };
  }
}

/**
 * Pobiera szczegóły szablonu e-mail.
 */
export async function getEmailTemplateById(
  templateId: string
): Promise<ActionResult<EmailTemplateDetails>> {
  try {
    // Sprawdź, czy to domyślny szablon
    if (templateId.startsWith("default-")) {
      const type = templateId.replace("default-", "") as EmailTemplateType;
      const defaultTpl = DEFAULT_TEMPLATES[type];
      if (!defaultTpl) {
        return { success: false, error: "Szablon nie istnieje" };
      }
      return {
        success: true,
        data: {
          id: templateId,
          type,
          name: defaultTpl.name,
          subject: defaultTpl.subject,
          bodyHtml: defaultTpl.bodyHtml,
          bodyText: defaultTpl.bodyText,
          availableVariables: defaultTpl.availableVariables,
          isActive: true,
          updatedAt: new Date(),
          createdAt: new Date(),
        },
      };
    }

    const template = await prisma.emailTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      return { success: false, error: "Szablon nie istnieje" };
    }

    return {
      success: true,
      data: {
        id: template.id,
        type: template.type,
        name: template.name,
        subject: template.subject,
        bodyHtml: template.bodyHtml,
        bodyText: template.bodyText,
        availableVariables: template.availableVariables,
        isActive: template.isActive,
        updatedAt: template.updatedAt,
        createdAt: template.createdAt,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd pobierania szablonu",
    };
  }
}

/**
 * Tworzy lub aktualizuje szablon e-mail.
 */
export async function saveEmailTemplate(data: {
  type: EmailTemplateType;
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string | null;
  isActive?: boolean;
}): Promise<ActionResult<{ templateId: string }>> {
  try {
    const { type, name, subject, bodyHtml, bodyText, isActive = true } = data;

    // Walidacja
    if (!name.trim()) {
      return { success: false, error: "Nazwa szablonu jest wymagana" };
    }
    if (!subject.trim()) {
      return { success: false, error: "Temat e-maila jest wymagany" };
    }
    if (!bodyHtml.trim()) {
      return { success: false, error: "Treść HTML jest wymagana" };
    }

    const defaultTpl = DEFAULT_TEMPLATES[type];
    const availableVariables = defaultTpl?.availableVariables ?? null;

    const template = await prisma.emailTemplate.upsert({
      where: { type },
      create: {
        type,
        name: name.trim(),
        subject: subject.trim(),
        bodyHtml: bodyHtml.trim(),
        bodyText: bodyText?.trim() || null,
        availableVariables,
        isActive,
      },
      update: {
        name: name.trim(),
        subject: subject.trim(),
        bodyHtml: bodyHtml.trim(),
        bodyText: bodyText?.trim() || null,
        isActive,
      },
    });

    revalidatePath("/ustawienia/szablony-email");
    return { success: true, data: { templateId: template.id } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd zapisywania szablonu",
    };
  }
}

/**
 * Przywraca szablon do domyślnego.
 */
export async function resetEmailTemplate(
  type: EmailTemplateType
): Promise<ActionResult<void>> {
  try {
    // Usuń niestandardowy szablon, co spowoduje użycie domyślnego
    await prisma.emailTemplate.deleteMany({
      where: { type },
    });

    revalidatePath("/ustawienia/szablony-email");
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd resetowania szablonu",
    };
  }
}

/**
 * Wysyła e-mail z potwierdzeniem rezerwacji używając szablonu.
 */
export async function sendReservationConfirmationWithTemplate(
  reservationId: string
): Promise<ActionResult<{ sentTo: string }>> {
  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { guest: true, room: true },
    });
    if (!reservation) return { success: false, error: "Rezerwacja nie istnieje" };
    
    const email = reservation.guest.email?.trim();
    if (!email) return { success: false, error: "Brak adresu e-mail u gościa" };
    
    if (!isValidEmail(email)) {
      return { 
        success: false, 
        error: `Nieprawidłowy format adresu e-mail: "${email}". Popraw adres w karcie gościa.` 
      };
    }

    const template = await getEmailTemplate("CONFIRMATION");
    if (!template.isActive) {
      return { success: false, error: "Szablon potwierdzenia jest nieaktywny" };
    }

    const checkIn = new Date(reservation.checkIn);
    const checkOut = new Date(reservation.checkOut);
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

    const variables = {
      guestName: reservation.guest.name,
      roomNumber: reservation.room.number,
      checkIn: checkIn.toLocaleDateString("pl-PL"),
      checkOut: checkOut.toLocaleDateString("pl-PL"),
      nights: nights,
      confirmationNumber: reservation.confirmationNumber,
      totalAmount: reservation.totalAmount?.toNumber() ?? 0,
    };

    const subject = replaceTemplateVariablesPlain(template.subject, variables);
    const html = replaceTemplateVariables(template.bodyHtml, variables);
    const text = template.bodyText 
      ? replaceTemplateVariablesPlain(template.bodyText, variables) 
      : undefined;

    const result = await sendMailViaResend(email, subject, html, text);
    if (!result.success) {
      return { success: false, error: result.error ?? "Błąd wysyłania e-mail" };
    }
    
    revalidatePath("/reports");
    return { success: true, data: { sentTo: email } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd wysyłania potwierdzenia",
    };
  }
}

/**
 * Wysyła e-mail z podziękowaniem po pobycie używając szablonu.
 */
export async function sendThankYouWithTemplate(
  reservationId: string
): Promise<ActionResult<{ sentTo: string }>> {
  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { guest: true, room: true },
    });
    if (!reservation) return { success: false, error: "Rezerwacja nie istnieje" };
    if (reservation.status !== "CHECKED_OUT") {
      return { success: false, error: "E-mail z podziękowaniem wysyła się po wymeldowaniu" };
    }
    
    const email = reservation.guest.email?.trim();
    if (!email) return { success: false, error: "Brak adresu e-mail u gościa" };
    
    if (!isValidEmail(email)) {
      return { 
        success: false, 
        error: `Nieprawidłowy format adresu e-mail: "${email}". Popraw adres w karcie gościa.` 
      };
    }

    const template = await getEmailTemplate("THANK_YOU");
    if (!template.isActive) {
      return { success: false, error: "Szablon podziękowania jest nieaktywny" };
    }

    const checkIn = new Date(reservation.checkIn);
    const checkOut = new Date(reservation.checkOut);
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

    const variables = {
      guestName: reservation.guest.name,
      roomNumber: reservation.room.number,
      checkIn: checkIn.toLocaleDateString("pl-PL"),
      checkOut: checkOut.toLocaleDateString("pl-PL"),
      nights: nights,
    };

    const subject = replaceTemplateVariablesPlain(template.subject, variables);
    const html = replaceTemplateVariables(template.bodyHtml, variables);
    const text = template.bodyText 
      ? replaceTemplateVariablesPlain(template.bodyText, variables) 
      : undefined;

    const result = await sendMailViaResend(email, subject, html, text);
    if (!result.success) {
      return { success: false, error: result.error ?? "Błąd wysyłania e-mail" };
    }
    
    revalidatePath("/reports");
    return { success: true, data: { sentTo: email } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd wysyłania podziękowania",
    };
  }
}

/**
 * Wysyła przypomnienie o rezerwacji (dzień przed check-in).
 */
export async function sendReminderWithTemplate(
  reservationId: string
): Promise<ActionResult<{ sentTo: string }>> {
  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { guest: true, room: true },
    });
    if (!reservation) return { success: false, error: "Rezerwacja nie istnieje" };
    
    const email = reservation.guest.email?.trim();
    if (!email) return { success: false, error: "Brak adresu e-mail u gościa" };
    
    if (!isValidEmail(email)) {
      return { 
        success: false, 
        error: `Nieprawidłowy format adresu e-mail: "${email}". Popraw adres w karcie gościa.` 
      };
    }

    const template = await getEmailTemplate("REMINDER");
    if (!template.isActive) {
      return { success: false, error: "Szablon przypomnienia jest nieaktywny" };
    }

    const checkIn = new Date(reservation.checkIn);
    const checkOut = new Date(reservation.checkOut);
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

    const variables = {
      guestName: reservation.guest.name,
      roomNumber: reservation.room.number,
      checkIn: checkIn.toLocaleDateString("pl-PL"),
      checkOut: checkOut.toLocaleDateString("pl-PL"),
      nights: nights,
      confirmationNumber: reservation.confirmationNumber,
    };

    const subject = replaceTemplateVariablesPlain(template.subject, variables);
    const html = replaceTemplateVariables(template.bodyHtml, variables);
    const text = template.bodyText 
      ? replaceTemplateVariablesPlain(template.bodyText, variables) 
      : undefined;

    const result = await sendMailViaResend(email, subject, html, text);
    if (!result.success) {
      return { success: false, error: result.error ?? "Błąd wysyłania e-mail" };
    }
    
    revalidatePath("/reports");
    return { success: true, data: { sentTo: email } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd wysyłania przypomnienia",
    };
  }
}
