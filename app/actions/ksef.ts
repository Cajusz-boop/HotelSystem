"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { createAuditLog, getClientIp } from "@/lib/audit";
import { sendMailViaResend } from "@/app/actions/mailing";
import {
  getAuthorisationChallenge,
  buildAndEncryptInitSessionTokenRequest,
  initSession,
  terminateSession,
  getSessionStatus,
} from "@/lib/ksef/auth";
import { validateInvoiceXml } from "@/lib/ksef/validate";
import { buildFa2Xml, type InvoiceForKsef, type SellerForKsef } from "@/lib/ksef/xml-generator";
import { sendInvoice, sendInvoiceBatch, getInvoiceStatus, getInvoiceUpo } from "@/lib/ksef/api-client";
import { parseKsef400Error } from "@/lib/ksef/parse-error";
import { checkBuyerNipActive } from "@/lib/ksef/nip-validate";
import { getEffectiveKsefEnv } from "@/lib/ksef/env";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

async function ksefAudit(
  actionType: "CREATE" | "UPDATE",
  entityId: string,
  newValue: Record<string, unknown>
): Promise<void> {
  try {
    const headersList = await headers();
    await createAuditLog({
      actionType,
      entityType: "KSEF",
      entityId,
      newValue: { ...newValue, at: new Date().toISOString() },
      ipAddress: getClientIp(headersList),
    });
  } catch {
    // nie przerywaj operacji gdy audit się nie powiedzie
  }
}

/** Powiadomienie managera gdy faktura odrzucona w KSeF (email). KSEF_ALERT_EMAIL lub MANAGER_EMAIL w .env. */
async function notifyManagerKsefRejected(invoiceNumber: string, errorMessage: string | null): Promise<void> {
  const to = process.env.KSEF_ALERT_EMAIL?.trim() || process.env.MANAGER_EMAIL?.trim();
  if (!to) return;
  try {
    const subject = `KSeF: Faktura odrzucona – ${invoiceNumber}`;
    const body = `Faktura ${invoiceNumber} została odrzucona przez KSeF.\n\n${errorMessage ?? "Brak szczegółów."}\n\nSprawdź w module Finanse → Rejestr sprzedaży VAT.`;
    const html = `<p>Faktura <strong>${escapeHtml(invoiceNumber)}</strong> została odrzucona przez KSeF.</p><p>${escapeHtml(errorMessage ?? "Brak szczegółów.")}</p><p>Sprawdź w module Finanse → Rejestr sprzedaży VAT.</p>`;
    await sendMailViaResend(to, subject, html, body);
  } catch {
    // nie przerywaj gdy wysyłka powiadomienia się nie powiedzie
  }
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Timeout sesji MF (KSeF) – 20 min; po tym czasie MF zamyka sesję. Re-init przed operacją gdy sesja wygasła. */
const MF_SESSION_TIMEOUT_MINUTES = 20;

/**
 * Inicjalizacja sesji KSeF (interaktywnej) – pobranie challenge, zaszyfrowanie InitSessionTokenRequest,
 * wywołanie InitSession, zapis sesji do KsefSession.
 * propertyId – opcjonalny (powiązanie z obiektem).
 * NIP z zmiennej środowiskowej KSEF_NIP.
 */
export async function initKsefSession(
  propertyId: string | null
): Promise<ActionResult<{ sessionId: string; contextIdentifier: string }>> {
  const nip = process.env.KSEF_NIP?.replace(/\s/g, "");
  if (!nip || nip.length < 10) {
    return { success: false, error: "Ustaw zmienną środowiskową KSEF_NIP (10 znaków)" };
  }

  const challengeRes = await getAuthorisationChallenge();
  if (!challengeRes.success) {
    return { success: false, error: challengeRes.error };
  }

  const publicKey =
    (challengeRes.data.challenge as string) ??
    (challengeRes.data.publicKey as string) ??
    "";
  if (!publicKey) {
    return { success: false, error: "Brak klucza publicznego MF w odpowiedzi AuthorisationChallenge" };
  }

  const encrypted = buildAndEncryptInitSessionTokenRequest({
    nip,
    publicKeyFromChallenge: publicKey,
  });
  if (!encrypted.success) {
    return { success: false, error: encrypted.error };
  }

  const sessionRes = await initSession(encrypted.encryptedBase64);
  if (!sessionRes.success) {
    return { success: false, error: sessionRes.error };
  }

  const { sessionToken, contextIdentifier } = sessionRes.data;
  const expiresAt = new Date(Date.now() + MF_SESSION_TIMEOUT_MINUTES * 60 * 1000);

  const session = await prisma.ksefSession.create({
    data: {
      propertyId: propertyId ?? undefined,
      nip,
      sessionToken,
      tokenExpiresAt: expiresAt,
      contextIdentifier: contextIdentifier || null,
      challenge: publicKey.slice(0, 500),
    },
  });

  return {
    success: true,
    data: {
      sessionId: session.id,
      contextIdentifier: contextIdentifier || "",
    },
  };
}

/**
 * Zamyka sesję KSeF (POST /api/online/Session/Terminate) i usuwa wpis KsefSession.
 */
export async function terminateKsefSession(sessionId: string): Promise<ActionResult<void>> {
  const session = await prisma.ksefSession.findUnique({
    where: { id: sessionId },
    select: { id: true, sessionToken: true },
  });
  if (!session) {
    return { success: false, error: "Sesja KSeF nie istnieje" };
  }

  const result = await terminateSession(session.sessionToken);
  await prisma.ksefSession.delete({ where: { id: sessionId } }).catch(() => {});

  if (!result.success) {
    return { success: false, error: result.error };
  }
  return { success: true };
}

/**
 * KeepAlive sesji KSeF – wywołanie GET /api/online/Session/Status i aktualizacja lastKeepAliveAt.
 * Wywoływać okresowo (np. co 10 min) dla aktywnych sesji.
 */
export async function keepAliveKsefSession(sessionId: string): Promise<ActionResult<void>> {
  const session = await prisma.ksefSession.findUnique({
    where: { id: sessionId },
    select: { id: true, sessionToken: true },
  });
  if (!session) {
    return { success: false, error: "Sesja KSeF nie istnieje" };
  }

  const result = await getSessionStatus(session.sessionToken);
  if (!result.success) {
    return { success: false, error: result.error };
  }

  await prisma.ksefSession.update({
    where: { id: sessionId },
    data: { lastKeepAliveAt: new Date() },
  });
  return { success: true };
}

/** Margines: sesja uznana za "wygasłą" na 2 min przed tokenExpiresAt (żeby zdążyć przed wysyłką). */
const SESSION_EXPIRY_MARGIN_MS = 2 * 60 * 1000;

/**
 * Zwraca aktywną sesję KSeF (nie wygasłą). Jeśli brak lub wygasła – inicjuje nową (re-init).
 * Do użycia przed wysyłką faktury do KSeF.
 */
export async function getOrCreateValidKsefSession(propertyId: string | null): Promise<
  ActionResult<{ sessionId: string; sessionToken: string; contextIdentifier: string }>
> {
  const now = new Date();
  const deadline = new Date(now.getTime() + SESSION_EXPIRY_MARGIN_MS);

  const existing = await prisma.ksefSession.findFirst({
    where: {
      tokenExpiresAt: { gt: deadline },
      ...(propertyId ? { propertyId } : {}),
    },
    orderBy: { tokenExpiresAt: "desc" },
    select: { id: true, sessionToken: true, contextIdentifier: true },
  });

  if (existing) {
    return {
      success: true,
      data: {
        sessionId: existing.id,
        sessionToken: existing.sessionToken,
        contextIdentifier: existing.contextIdentifier ?? "",
      },
    };
  }

  const initRes = await initKsefSession(propertyId);
  if (!initRes.success) {
    return { success: false, error: initRes.error };
  }

  const session = await prisma.ksefSession.findUnique({
    where: { id: initRes.data.sessionId },
    select: { id: true, sessionToken: true, contextIdentifier: true },
  });
  if (!session) {
    return { success: false, error: "Sesja KSeF nie została zapisana" };
  }

  return {
    success: true,
    data: {
      sessionId: session.id,
      sessionToken: session.sessionToken,
      contextIdentifier: session.contextIdentifier ?? "",
    },
  };
}

/**
 * Walidacja XML faktury przed wysyłką do KSeF.
 * Przy błędzie walidacji XSD/XML zwraca komunikat dla użytkownika (odrzucenie wysyłki).
 */
export async function validateInvoiceXmlForKsef(xmlString: string): Promise<ActionResult<void>> {
  const result = validateInvoiceXml(xmlString);
  if (!result.valid) {
    return { success: false, error: result.error ?? "Błąd walidacji XML faktury" };
  }
  return { success: true };
}

/**
 * Dodaje fakturę do kolejki wysyłki KSeF (gdy bramka MF zwraca 5xx).
 */
async function queueInvoiceForKsef(invoiceId: string, lastError: string): Promise<void> {
  await prisma.ksefPendingSend.upsert({
    where: { invoiceId },
    create: { invoiceId, lastError, lastAttemptAt: new Date(), attemptCount: 1 },
    update: { lastError, lastAttemptAt: new Date(), attemptCount: { increment: 1 } },
  });
}

/**
 * Generowanie XML faktury, wysyłka do KSeF, zapis ksefReferenceNumber i statusu PENDING.
 */
export async function sendInvoiceToKsef(invoiceId: string): Promise<
  ActionResult<{ referenceNumber: string }>
> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
  });
  if (!invoice) {
    return { success: false, error: "Faktura nie istnieje" };
  }

  if (invoice.buyerNip?.trim()) {
    const nipCheck = await checkBuyerNipActive(invoice.buyerNip);
    if (!nipCheck.active) {
      return { success: false, error: nipCheck.error };
    }
  }

  const nip = process.env.KSEF_NIP?.replace(/\s/g, "") ?? "";
  const seller: SellerForKsef = {
    nip,
    name: process.env.HOTEL_NAME ?? "Hotel",
    address: process.env.HOTEL_ADDRESS,
    postalCode: process.env.HOTEL_POSTAL_CODE,
    city: process.env.HOTEL_CITY,
  };

  const inv: InvoiceForKsef = {
    number: invoice.number,
    issuedAt: invoice.issuedAt,
    amountNet: Number(invoice.amountNet),
    amountVat: Number(invoice.amountVat),
    amountGross: Number(invoice.amountGross),
    vatRate: Number(invoice.vatRate),
    buyerNip: invoice.buyerNip,
    buyerName: invoice.buyerName,
    buyerAddress: invoice.buyerAddress,
    buyerPostalCode: invoice.buyerPostalCode,
    buyerCity: invoice.buyerCity,
  };

  const xml = buildFa2Xml(inv, seller);
  const valid = await validateInvoiceXmlForKsef(xml);
  if (!valid.success) {
    return { success: false, error: valid.error };
  }

  const sessionRes = await getOrCreateValidKsefSession(null);
  if (!sessionRes.success) {
    await queueInvoiceForKsef(invoiceId, sessionRes.error ?? "Brak połączenia z KSeF");
    await ksefAudit("CREATE", invoiceId, { operation: "SEND", invoiceId, error: sessionRes.error, queued: true });
    return {
      success: false,
      error: "Brak połączenia z KSeF. Faktura dodana do kolejki – zostanie wysłana przy przywróceniu połączenia.",
    };
  }

  let sendRes = await sendInvoice(sessionRes.data.sessionToken, xml);

  // E8: Sesja wygasła (401/403) – usuń sesję z cache i spróbuj raz z nową sesją (re-init)
  if (!sendRes.ok && (sendRes.status === 401 || sendRes.status === 403)) {
    await prisma.ksefSession.delete({ where: { id: sessionRes.data.sessionId } }).catch(() => {});
    const sessionRes2 = await getOrCreateValidKsefSession(null);
    if (sessionRes2.success) {
      sendRes = await sendInvoice(sessionRes2.data.sessionToken, xml);
    }
  }

  if (!sendRes.ok) {
    const isOffline = sendRes.status === 0 || sendRes.status == null;
    if (sendRes.status >= 500 || isOffline) {
      await queueInvoiceForKsef(invoiceId, sendRes.error ?? (isOffline ? "Brak połączenia" : "Bramka MF niedostępna (5xx)"));
      await ksefAudit("CREATE", invoiceId, { operation: "SEND", invoiceId, error: sendRes.error, queued: true });
      return {
        success: false,
        error: isOffline
          ? "Brak połączenia z KSeF. Faktura dodana do kolejki – zostanie wysłana przy przywróceniu połączenia."
          : "Bramka MF niedostępna. Faktura dodana do kolejki – zostanie wysłana automatycznie.",
      };
    }
    const errorMsg =
      sendRes.status >= 400 && sendRes.status < 500
        ? parseKsef400Error(sendRes.error ?? "")
        : sendRes.error ?? undefined;
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        ksefStatus: "REJECTED",
        ksefErrorMessage: errorMsg,
      },
    }).catch(() => {});
    await ksefAudit("CREATE", invoiceId, { operation: "SEND", invoiceId, error: errorMsg ?? sendRes.error });
    await notifyManagerKsefRejected(invoice.number, errorMsg ?? sendRes.error ?? null);
    return {
      success: false,
      error: errorMsg ?? sendRes.error ?? "Błąd wysyłki do KSeF",
    };
  }

  const referenceNumber = (sendRes.data?.referenceNumber as string) ?? "";
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      ksefReferenceNumber: referenceNumber || undefined,
      ksefStatus: "PENDING",
      ksefErrorMessage: null,
    },
  });
  await ksefAudit("CREATE", invoiceId, { operation: "SEND", invoiceId, referenceNumber, success: true });

  return {
    success: true,
    data: { referenceNumber: referenceNumber || "OK" },
  };
}

/**
 * Wysyłka wsadowa wielu faktur do KSeF, zapis KsefSentBatch.
 */
export async function sendBatchToKsef(invoiceIds: string[]): Promise<
  ActionResult<{ batchId: string; sent: number; failed: number; queued: number }>
> {
  if (!invoiceIds.length) {
    return { success: false, error: "Brak faktur do wysłania" };
  }

  const sessionRes = await getOrCreateValidKsefSession(null);
  if (!sessionRes.success) {
    for (const id of invoiceIds) {
      await queueInvoiceForKsef(id, sessionRes.error ?? "Brak połączenia z KSeF");
    }
    await ksefAudit("CREATE", `batch-${invoiceIds.join(",")}`, { operation: "BATCH", error: sessionRes.error, queued: invoiceIds.length, invoiceIds });
    return {
      success: false,
      error: `Brak połączenia z KSeF. Wszystkie faktury (${invoiceIds.length}) dodane do kolejki – zostaną wysłane przy przywróceniu połączenia.`,
    };
  }

  for (const id of invoiceIds) {
    const inv = await prisma.invoice.findUnique({ where: { id } });
    if (!inv?.buyerNip?.trim()) continue;
    const nipCheck = await checkBuyerNipActive(inv.buyerNip);
    if (!nipCheck.active) {
      return {
        success: false,
        error: `Faktura ${inv.number ?? id}: ${nipCheck.error}`,
      };
    }
  }

  const nip = process.env.KSEF_NIP?.replace(/\s/g, "") ?? "";
  const seller: SellerForKsef = {
    nip,
    name: process.env.HOTEL_NAME ?? "Hotel",
    address: process.env.HOTEL_ADDRESS,
    postalCode: process.env.HOTEL_POSTAL_CODE,
    city: process.env.HOTEL_CITY,
  };

  const xmls: string[] = [];
  for (const id of invoiceIds) {
    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) continue;
    const inv: InvoiceForKsef = {
      number: invoice.number,
      issuedAt: invoice.issuedAt,
      amountNet: Number(invoice.amountNet),
      amountVat: Number(invoice.amountVat),
      amountGross: Number(invoice.amountGross),
      vatRate: Number(invoice.vatRate),
      buyerNip: invoice.buyerNip,
      buyerName: invoice.buyerName,
      buyerAddress: invoice.buyerAddress,
      buyerPostalCode: invoice.buyerPostalCode,
      buyerCity: invoice.buyerCity,
    };
    xmls.push(buildFa2Xml(inv, seller));
  }

  if (xmls.length === 0) {
    return { success: false, error: "Nie znaleziono faktur" };
  }

  const { results, allOk } = await sendInvoiceBatch(
    sessionRes.data.sessionToken,
    xmls
  );

  let sent = 0;
  let failed = 0;
  let queued = 0;
  const refs: string[] = [];
  for (let i = 0; i < results.length; i++) {
    if (results[i].ok) {
      sent++;
      if (results[i].referenceNumber) refs.push(results[i].referenceNumber!);
      await prisma.invoice.update({
        where: { id: invoiceIds[i] },
        data: {
          ksefReferenceNumber: results[i].referenceNumber ?? undefined,
          ksefStatus: "PENDING",
          ksefErrorMessage: null,
        },
      }).catch(() => {});
    } else if (results[i].status === 0 || (results[i].status != null && results[i].status >= 500)) {
      queued++;
      await queueInvoiceForKsef(invoiceIds[i], results[i].error ?? (results[i].status === 0 ? "Brak połączenia" : "Bramka MF niedostępna (5xx)"));
    } else {
      failed++;
      const errorMsg =
        results[i].status != null && results[i].status >= 400 && results[i].status < 500
          ? parseKsef400Error(results[i].error ?? "")
          : results[i].error ?? undefined;
      await prisma.invoice.update({
        where: { id: invoiceIds[i] },
        data: {
          ksefStatus: "REJECTED",
          ksefErrorMessage: errorMsg,
        },
      }).catch(() => {});
      const inv = await prisma.invoice.findUnique({ where: { id: invoiceIds[i] }, select: { number: true } });
      await notifyManagerKsefRejected(inv?.number ?? invoiceIds[i], errorMsg ?? null);
    }
  }

  const batch = await prisma.ksefSentBatch.create({
    data: {
      sessionId: sessionRes.data.sessionId,
      invoiceIds: invoiceIds,
      batchReferenceNumber: refs[0] ?? null,
      status: allOk ? "SENT" : failed === xmls.length ? "FAILED" : "PARTIAL",
    },
  });
  await ksefAudit("CREATE", batch.id, { operation: "BATCH", batchId: batch.id, sent, failed, queued, invoiceCount: xmls.length });

  return {
    success: true,
    data: {
      batchId: batch.id,
      sent,
      failed,
      queued,
    },
  };
}

/**
 * Przetwarza kolejkę faktur do wysyłki KSeF (gdy bramka MF była niedostępna).
 * Wywoływane przez cron /api/cron/ksef-retry-queue.
 */
export async function processKsefPendingQueue(): Promise<{ processed: number; sent: number; failed: number }> {
  const pending = await prisma.ksefPendingSend.findMany({
    orderBy: { queuedAt: "asc" },
    take: 20,
  });
  let sent = 0;
  let failed = 0;
  for (const p of pending) {
    const res = await sendInvoiceToKsef(p.invoiceId);
    if (res.success) {
      await prisma.ksefPendingSend.delete({ where: { invoiceId: p.invoiceId } }).catch(() => {});
      sent++;
    } else {
      failed++;
      if (!res.error?.includes("dodana do kolejki")) {
        await prisma.ksefPendingSend.delete({ where: { invoiceId: p.invoiceId } }).catch(() => {});
      }
    }
  }
  return { processed: pending.length, sent, failed };
}

/**
 * Odpytanie statusu faktury w KSeF, aktualizacja ksefStatus (ACCEPTED/REJECTED), zapis ksefUuid.
 */
export async function checkKsefInvoiceStatus(invoiceId: string): Promise<
  ActionResult<{ status: string; ksefUuid?: string }>
> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { id: true, number: true, ksefReferenceNumber: true },
  });
  if (!invoice) {
    return { success: false, error: "Faktura nie istnieje" };
  }
  if (!invoice.ksefReferenceNumber?.trim()) {
    return { success: false, error: "Brak numeru referencyjnego KSeF – najpierw wyślij fakturę do KSeF" };
  }

  const sessionRes = await getOrCreateValidKsefSession(null);
  if (!sessionRes.success) {
    await ksefAudit("UPDATE", invoiceId, { operation: "STATUS", invoiceId, error: sessionRes.error });
    return { success: false, error: sessionRes.error };
  }

  const res = await getInvoiceStatus(
    sessionRes.data.sessionToken,
    invoice.ksefReferenceNumber
  );
  if (!res.ok) {
    await ksefAudit("UPDATE", invoiceId, { operation: "STATUS", invoiceId, error: res.error });
    return {
      success: false,
      error: res.error ?? "Błąd odczytu statusu z KSeF",
    };
  }

  const status = (res.data?.status as string) ?? "";
  const ksefUuid = (res.data?.uuid ?? res.data?.ksefUuid) as string | undefined;
  const mappedStatus =
    status.toUpperCase().includes("ACCEPTED") || status === "Zaakceptowana"
      ? "ACCEPTED"
      : status.toUpperCase().includes("REJECTED") || status === "Odrzucona"
        ? "REJECTED"
        : status
          ? "VERIFICATION"
          : null;

  if (mappedStatus) {
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        ksefStatus: mappedStatus,
        ...(ksefUuid ? { ksefUuid } : {}),
      },
    });
    if (mappedStatus === "REJECTED") {
      const errMsg = (res.data as { errorMessage?: string })?.errorMessage ?? res.error ?? null;
      await notifyManagerKsefRejected(invoice.number, errMsg);
    }
  }
  await ksefAudit("UPDATE", invoiceId, { operation: "STATUS", invoiceId, status: mappedStatus ?? status, ksefUuid });

  return {
    success: true,
    data: { status: status || "OK", ksefUuid },
  };
}

/**
 * Pobieranie UPO (GET /api/online/Invoice/Upo/{ksefUuid}), zapis ksefUpoUrl.
 * Opcjonalnie: zapis UPO jako PDF/XML w storage (KSEF_UPO_STORAGE_DIR – katalog lokalny).
 */
export async function downloadUpo(invoiceId: string): Promise<
  ActionResult<{ upoUrl: string }>
> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { id: true, ksefUuid: true, number: true },
  });
  if (!invoice) {
    return { success: false, error: "Faktura nie istnieje" };
  }
  if (!invoice.ksefUuid?.trim()) {
    return { success: false, error: "Brak ksefUuid – najpierw sprawdź status wysyłki KSeF" };
  }

  const sessionRes = await getOrCreateValidKsefSession(null);
  if (!sessionRes.success) {
    await ksefAudit("UPDATE", invoiceId, { operation: "UPO", invoiceId, error: sessionRes.error });
    return { success: false, error: sessionRes.error };
  }

  const res = await getInvoiceUpo(
    sessionRes.data.sessionToken,
    invoice.ksefUuid
  );
  if (!res.ok) {
    await ksefAudit("UPDATE", invoiceId, { operation: "UPO", invoiceId, ksefUuid: invoice.ksefUuid, error: res.error });
    return {
      success: false,
      error: res.error ?? "Błąd pobierania UPO z KSeF",
    };
  }

  let upoUrl =
    (res.data?.upoUrl as string) ??
    (res.data?.url as string) ??
    "";

  const storageDir = process.env.KSEF_UPO_STORAGE_DIR?.trim();
  if (storageDir && (res.data?.raw || upoUrl)) {
    try {
      const fs = await import("fs");
      const path = await import("path");
      const dir = path.resolve(process.cwd(), storageDir);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const safeNum = (invoice.number ?? invoiceId).replace(/[/\\]/g, "_");
      const ext = (res.data?.raw ?? "").trim().startsWith("<?xml") ? "xml" : "pdf";
      const filename = `UPO_${safeNum}_${invoice.ksefUuid!.slice(0, 8)}.${ext}`;
      const filePath = path.join(dir, filename);
      const content = typeof res.data?.raw === "string" ? res.data.raw : "";
      if (content) {
        fs.writeFileSync(filePath, content, "utf8");
        upoUrl = `/api/ksef/upo-file?path=${encodeURIComponent(filename)}`;
      }
    } catch {
      // ignoruj błąd zapisu do storage
    }
  }

  if (upoUrl) {
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { ksefUpoUrl: upoUrl },
    });
  }
  await ksefAudit("UPDATE", invoiceId, { operation: "UPO", invoiceId, ksefUuid: invoice.ksefUuid, success: true, upoUrl: upoUrl ? "set" : "" });

  return {
    success: true,
    data: { upoUrl: upoUrl || "OK" },
  };
}

export interface KsefConfig {
  env: "test" | "prod";
  nip: string | null;
  nipMasked: string | null;
  tokenSet: boolean;
  baseUrl: string;
}

/**
 * Zwraca bieżącą konfigurację KSeF (tylko do odczytu, z env).
 * Tryb Demo (test) domyślny dla NODE_ENV=development.
 */
export async function getKsefConfig(): Promise<ActionResult<KsefConfig>> {
  const env: "test" | "prod" = getEffectiveKsefEnv();
  const nip = process.env.KSEF_NIP?.replace(/\s/g, "") || null;
  const nipMasked =
    nip && nip.length >= 10
      ? `${nip.slice(0, 3)}****${nip.slice(-3)}`
      : null;
  const tokenSet = !!(process.env.KSEF_AUTH_TOKEN?.trim());
  const baseUrl = env === "test" ? KSEF_TEST_BASE : KSEF_PROD_BASE;
  return {
    success: true,
    data: {
      env,
      nip: nip || null,
      nipMasked,
      tokenSet,
      baseUrl,
    },
  };
}

export interface KsefSentBatchRow {
  id: string;
  sentAt: Date;
  status: string;
  batchReferenceNumber: string | null;
  invoiceCount: number;
}

/**
 * Lista historii wysyłek KSeF (KsefSentBatch), ostatnie na górze.
 */
export async function getKsefSentBatches(limit = 50): Promise<ActionResult<KsefSentBatchRow[]>> {
  const batches = await prisma.ksefSentBatch.findMany({
    orderBy: { sentAt: "desc" },
    take: limit,
    select: {
      id: true,
      sentAt: true,
      status: true,
      batchReferenceNumber: true,
      invoiceIds: true,
    },
  });
  const rows: KsefSentBatchRow[] = batches.map((b) => ({
    id: b.id,
    sentAt: b.sentAt,
    status: b.status,
    batchReferenceNumber: b.batchReferenceNumber,
    invoiceCount: Array.isArray(b.invoiceIds) ? (b.invoiceIds as string[]).length : 0,
  }));
  return { success: true, data: rows };
}
