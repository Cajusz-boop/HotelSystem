"use server";

import { prisma } from "@/lib/db";
import {
  exportToOptima,
  exportToSubiekt,
  exportToWfirma,
  exportToFakturownia,
  exportToSymfonia,
  exportToEnova,
  type InvoiceForExport,
  type AccountingExportResult,
} from "@/lib/integrations/accounting";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

const MAX_EXPORT_RANGE_DAYS = 366;

/**
 * Eksport faktur i transakcji do formatu Optima (CSV/XML).
 * propertyId opcjonalny – gdy podany, tylko rezerwacje z pokoi danego obiektu.
 */
export async function exportToOptimaAction(
  propertyId: string | null,
  dateFrom: string,
  dateTo: string
): Promise<ActionResult<{ content: string; filename: string }>> {
  const from = new Date(dateFrom + "T00:00:00.000Z");
  const to = new Date(dateTo + "T23:59:59.999Z");
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return { success: false, error: "Nieprawidłowy format dat (YYYY-MM-DD)" };
  }
  if (from > to) {
    return { success: false, error: "Data od nie może być późniejsza niż data do" };
  }
  const rangeDays = Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
  if (rangeDays > MAX_EXPORT_RANGE_DAYS) {
    return { success: false, error: `Zakres dat nie może przekraczać ${MAX_EXPORT_RANGE_DAYS} dni` };
  }

  const invoices = await prisma.invoice.findMany({
    where: {
      issuedAt: { gte: from, lte: to },
      ...(propertyId
        ? { reservation: { room: { propertyId } } }
        : {}),
    },
    orderBy: { issuedAt: "asc" },
  });

  const documents: InvoiceForExport[] = invoices.map((i) => ({
    number: i.number,
    issuedAt: i.issuedAt.toISOString(),
    amountNet: Number(i.amountNet),
    amountVat: Number(i.amountVat),
    amountGross: Number(i.amountGross),
    vatRate: Number(i.vatRate),
    buyerNip: i.buyerNip,
    buyerName: i.buyerName,
    buyerAddress: i.buyerAddress,
    buyerPostalCode: i.buyerPostalCode,
    buyerCity: i.buyerCity,
    description: "Usługa noclegowa",
  }));

  const result: AccountingExportResult = await exportToOptima({
    dateFrom,
    dateTo,
    documents,
  });

  if (!result.success) {
    return { success: false, error: result.error ?? "Błąd eksportu do Optima" };
  }
  if (!result.content || !result.filename) {
    return { success: false, error: "Brak zawartości eksportu" };
  }

  try {
    const existing = await prisma.accountingExport.findFirst({
      where: { system: "optima", propertyId: propertyId ?? null },
    });
    if (existing) {
      await prisma.accountingExport.update({
        where: { id: existing.id },
        data: { lastExportAt: new Date() },
      });
    } else {
      await prisma.accountingExport.create({
        data: {
          propertyId: propertyId || undefined,
          system: "optima",
          lastExportAt: new Date(),
        },
      });
    }
  } catch {
    // ignoruj błąd zapisu lastExportAt
  }

  return {
    success: true,
    data: { content: result.content, filename: result.filename },
  };
}

/**
 * Eksport faktur do InsERT Subiekt Nexo – XML do importu.
 * propertyId opcjonalny – gdy podany, tylko rezerwacje z pokoi danego obiektu.
 */
export async function exportToSubiektAction(
  propertyId: string | null,
  dateFrom: string,
  dateTo: string
): Promise<ActionResult<{ content: string; filename: string }>> {
  const from = new Date(dateFrom + "T00:00:00.000Z");
  const to = new Date(dateTo + "T23:59:59.999Z");
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return { success: false, error: "Nieprawidłowy format dat (YYYY-MM-DD)" };
  }
  if (from > to) {
    return { success: false, error: "Data od nie może być późniejsza niż data do" };
  }
  const rangeDays = Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
  if (rangeDays > MAX_EXPORT_RANGE_DAYS) {
    return { success: false, error: `Zakres dat nie może przekraczać ${MAX_EXPORT_RANGE_DAYS} dni` };
  }

  const invoices = await prisma.invoice.findMany({
    where: {
      issuedAt: { gte: from, lte: to },
      ...(propertyId ? { reservation: { room: { propertyId } } } : {}),
    },
    orderBy: { issuedAt: "asc" },
  });

  const documents: InvoiceForExport[] = invoices.map((i) => ({
    number: i.number,
    issuedAt: i.issuedAt.toISOString(),
    amountNet: Number(i.amountNet),
    amountVat: Number(i.amountVat),
    amountGross: Number(i.amountGross),
    vatRate: Number(i.vatRate),
    buyerNip: i.buyerNip,
    buyerName: i.buyerName,
    buyerAddress: i.buyerAddress,
    buyerPostalCode: i.buyerPostalCode,
    buyerCity: i.buyerCity,
    description: "Usługa noclegowa",
  }));

  const result: AccountingExportResult = await exportToSubiekt({
    dateFrom,
    dateTo,
    documents,
  });

  if (!result.success) {
    return { success: false, error: result.error ?? "Błąd eksportu do Subiekt" };
  }
  if (!result.content || !result.filename) {
    return { success: false, error: "Brak zawartości eksportu" };
  }

  try {
    const existing = await prisma.accountingExport.findFirst({
      where: { system: "subiekt", propertyId: propertyId ?? null },
    });
    if (existing) {
      await prisma.accountingExport.update({
        where: { id: existing.id },
        data: { lastExportAt: new Date() },
      });
    } else {
      await prisma.accountingExport.create({
        data: {
          propertyId: propertyId || undefined,
          system: "subiekt",
          lastExportAt: new Date(),
        },
      });
    }
  } catch {
    // ignoruj
  }

  return {
    success: true,
    data: { content: result.content, filename: result.filename },
  };
}

/**
 * Eksport faktur do wFirma (iFirma) – JSON do importu lub wywołanie API (api.ifirma.pl).
 * propertyId opcjonalny – gdy podany, tylko rezerwacje z pokoi danego obiektu.
 */
export async function exportToWfirmaAction(
  propertyId: string | null,
  dateFrom: string,
  dateTo: string
): Promise<ActionResult<{ content: string; filename: string; apiSent?: boolean }>> {
  const from = new Date(dateFrom + "T00:00:00.000Z");
  const to = new Date(dateTo + "T23:59:59.999Z");
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return { success: false, error: "Nieprawidłowy format dat (YYYY-MM-DD)" };
  }
  if (from > to) {
    return { success: false, error: "Data od nie może być późniejsza niż data do" };
  }
  const rangeDays = Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
  if (rangeDays > MAX_EXPORT_RANGE_DAYS) {
    return { success: false, error: `Zakres dat nie może przekraczać ${MAX_EXPORT_RANGE_DAYS} dni` };
  }

  const invoices = await prisma.invoice.findMany({
    where: {
      issuedAt: { gte: from, lte: to },
      ...(propertyId ? { reservation: { room: { propertyId } } } : {}),
    },
    orderBy: { issuedAt: "asc" },
  });

  const documents: InvoiceForExport[] = invoices.map((i) => ({
    number: i.number,
    issuedAt: i.issuedAt.toISOString(),
    amountNet: Number(i.amountNet),
    amountVat: Number(i.amountVat),
    amountGross: Number(i.amountGross),
    vatRate: Number(i.vatRate),
    buyerNip: i.buyerNip,
    buyerName: i.buyerName,
    buyerAddress: i.buyerAddress,
    buyerPostalCode: i.buyerPostalCode,
    buyerCity: i.buyerCity,
    description: "Usługa noclegowa",
  }));

  const result: AccountingExportResult = await exportToWfirma({
    dateFrom,
    dateTo,
    documents,
  });

  if (!result.success) {
    return { success: false, error: result.error ?? "Błąd eksportu do wFirma" };
  }
  if (!result.content || !result.filename) {
    return { success: false, error: "Brak zawartości eksportu" };
  }

  let apiSent = false;
  const apiKey = process.env.WFIRMA_API_KEY ?? process.env.IFIRMA_API_KEY;
  if (apiKey && documents.length > 0) {
    try {
      const res = await fetch("https://www.ifirma.pl/iapi/fakturakraj.json", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${Buffer.from(apiKey + ":").toString("base64")}`,
        },
        body: result.content,
      });
      apiSent = res.ok;
      if (!res.ok) {
        const errText = await res.text();
        console.error("[exportToWfirma] API error:", res.status, errText);
      }
    } catch (e) {
      console.error("[exportToWfirma] API call failed:", e);
    }
  }

  try {
    const existing = await prisma.accountingExport.findFirst({
      where: { system: "wfirma", propertyId: propertyId ?? null },
    });
    if (existing) {
      await prisma.accountingExport.update({
        where: { id: existing.id },
        data: { lastExportAt: new Date() },
      });
    } else {
      await prisma.accountingExport.create({
        data: {
          propertyId: propertyId || undefined,
          system: "wfirma",
          lastExportAt: new Date(),
        },
      });
    }
  } catch {
    // ignoruj błąd zapisu lastExportAt
  }

  return {
    success: true,
    data: { content: result.content, filename: result.filename, apiSent },
  };
}

/**
 * Eksport faktur do Fakturownia.pl – JSON do importu lub wywołanie API (app.fakturownia.pl/api).
 * propertyId opcjonalny – gdy podany, tylko rezerwacje z pokoi danego obiektu.
 */
export async function exportToFakturowniaAction(
  propertyId: string | null,
  dateFrom: string,
  dateTo: string
): Promise<ActionResult<{ content: string; filename: string; apiSent?: boolean }>> {
  const from = new Date(dateFrom + "T00:00:00.000Z");
  const to = new Date(dateTo + "T23:59:59.999Z");
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return { success: false, error: "Nieprawidłowy format dat (YYYY-MM-DD)" };
  }
  if (from > to) {
    return { success: false, error: "Data od nie może być późniejsza niż data do" };
  }
  const rangeDays = Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
  if (rangeDays > MAX_EXPORT_RANGE_DAYS) {
    return { success: false, error: `Zakres dat nie może przekraczać ${MAX_EXPORT_RANGE_DAYS} dni` };
  }

  const invoices = await prisma.invoice.findMany({
    where: {
      issuedAt: { gte: from, lte: to },
      ...(propertyId ? { reservation: { room: { propertyId } } } : {}),
    },
    orderBy: { issuedAt: "asc" },
  });

  const documents: InvoiceForExport[] = invoices.map((i) => ({
    number: i.number,
    issuedAt: i.issuedAt.toISOString(),
    amountNet: Number(i.amountNet),
    amountVat: Number(i.amountVat),
    amountGross: Number(i.amountGross),
    vatRate: Number(i.vatRate),
    buyerNip: i.buyerNip,
    buyerName: i.buyerName,
    buyerAddress: i.buyerAddress,
    buyerPostalCode: i.buyerPostalCode,
    buyerCity: i.buyerCity,
    description: "Usługa noclegowa",
  }));

  const result: AccountingExportResult = await exportToFakturownia({
    dateFrom,
    dateTo,
    documents,
  });

  if (!result.success) {
    return { success: false, error: result.error ?? "Błąd eksportu do Fakturownia" };
  }
  if (!result.content || !result.filename) {
    return { success: false, error: "Brak zawartości eksportu" };
  }

  let apiSent = false;
  const apiToken = process.env.FAKTUROWNIA_API_TOKEN;
  const accountName = process.env.FAKTUROWNIA_ACCOUNT_NAME;
  if (apiToken && accountName && documents.length > 0) {
    try {
      const baseUrl = `https://${accountName}.fakturownia.pl`;
      const res = await fetch(`${baseUrl}/invoices.json?api_token=${encodeURIComponent(apiToken)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: result.content,
      });
      apiSent = res.ok;
      if (!res.ok) {
        const errText = await res.text();
        console.error("[exportToFakturownia] API error:", res.status, errText);
      }
    } catch (e) {
      console.error("[exportToFakturownia] API call failed:", e);
    }
  }

  try {
    const existing = await prisma.accountingExport.findFirst({
      where: { system: "fakturownia", propertyId: propertyId ?? null },
    });
    if (existing) {
      await prisma.accountingExport.update({
        where: { id: existing.id },
        data: { lastExportAt: new Date() },
      });
    } else {
      await prisma.accountingExport.create({
        data: {
          propertyId: propertyId || undefined,
          system: "fakturownia",
          lastExportAt: new Date(),
        },
      });
    }
  } catch {
    // ignoruj błąd zapisu lastExportAt
  }

  return {
    success: true,
    data: { content: result.content, filename: result.filename, apiSent },
  };
}

/**
 * Eksport faktur do Asseco Symfonia – CSV do importu.
 * propertyId opcjonalny.
 */
export async function exportToSymfoniaAction(
  propertyId: string | null,
  dateFrom: string,
  dateTo: string
): Promise<ActionResult<{ content: string; filename: string }>> {
  const from = new Date(dateFrom + "T00:00:00.000Z");
  const to = new Date(dateTo + "T23:59:59.999Z");
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return { success: false, error: "Nieprawidłowy format dat (YYYY-MM-DD)" };
  }
  if (from > to) {
    return { success: false, error: "Data od nie może być późniejsza niż data do" };
  }
  const rangeDays = Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
  if (rangeDays > MAX_EXPORT_RANGE_DAYS) {
    return { success: false, error: `Zakres dat nie może przekraczać ${MAX_EXPORT_RANGE_DAYS} dni` };
  }

  const invoices = await prisma.invoice.findMany({
    where: {
      issuedAt: { gte: from, lte: to },
      ...(propertyId ? { reservation: { room: { propertyId } } } : {}),
    },
    orderBy: { issuedAt: "asc" },
  });

  const documents: InvoiceForExport[] = invoices.map((i) => ({
    number: i.number,
    issuedAt: i.issuedAt.toISOString(),
    amountNet: Number(i.amountNet),
    amountVat: Number(i.amountVat),
    amountGross: Number(i.amountGross),
    vatRate: Number(i.vatRate),
    buyerNip: i.buyerNip,
    buyerName: i.buyerName,
    buyerAddress: i.buyerAddress,
    buyerPostalCode: i.buyerPostalCode,
    buyerCity: i.buyerCity,
    description: "Usługa noclegowa",
  }));

  const result: AccountingExportResult = await exportToSymfonia({
    dateFrom,
    dateTo,
    documents,
  });

  if (!result.success) {
    return { success: false, error: result.error ?? "Błąd eksportu do Symfonia" };
  }
  if (!result.content || !result.filename) {
    return { success: false, error: "Brak zawartości eksportu" };
  }

  try {
    const existing = await prisma.accountingExport.findFirst({
      where: { system: "symfonia", propertyId: propertyId ?? null },
    });
    if (existing) {
      await prisma.accountingExport.update({
        where: { id: existing.id },
        data: { lastExportAt: new Date() },
      });
    } else {
      await prisma.accountingExport.create({
        data: {
          propertyId: propertyId || undefined,
          system: "symfonia",
          lastExportAt: new Date(),
        },
      });
    }
  } catch {
    // ignoruj
  }

  return {
    success: true,
    data: { content: result.content, filename: result.filename },
  };
}

/**
 * Eksport faktur do enova 365 / Infor enova – CSV do importu.
 * propertyId opcjonalny.
 */
export async function exportToEnovaAction(
  propertyId: string | null,
  dateFrom: string,
  dateTo: string
): Promise<ActionResult<{ content: string; filename: string }>> {
  const from = new Date(dateFrom + "T00:00:00.000Z");
  const to = new Date(dateTo + "T23:59:59.999Z");
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return { success: false, error: "Nieprawidłowy format dat (YYYY-MM-DD)" };
  }
  if (from > to) {
    return { success: false, error: "Data od nie może być późniejsza niż data do" };
  }
  const rangeDays = Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
  if (rangeDays > MAX_EXPORT_RANGE_DAYS) {
    return { success: false, error: `Zakres dat nie może przekraczać ${MAX_EXPORT_RANGE_DAYS} dni` };
  }

  const invoices = await prisma.invoice.findMany({
    where: {
      issuedAt: { gte: from, lte: to },
      ...(propertyId ? { reservation: { room: { propertyId } } } : {}),
    },
    orderBy: { issuedAt: "asc" },
  });

  const documents: InvoiceForExport[] = invoices.map((i) => ({
    number: i.number,
    issuedAt: i.issuedAt.toISOString(),
    amountNet: Number(i.amountNet),
    amountVat: Number(i.amountVat),
    amountGross: Number(i.amountGross),
    vatRate: Number(i.vatRate),
    buyerNip: i.buyerNip,
    buyerName: i.buyerName,
    buyerAddress: i.buyerAddress,
    buyerPostalCode: i.buyerPostalCode,
    buyerCity: i.buyerCity,
    description: "Usługa noclegowa",
  }));

  const result: AccountingExportResult = await exportToEnova({
    dateFrom,
    dateTo,
    documents,
  });

  if (!result.success) {
    return { success: false, error: result.error ?? "Błąd eksportu do enova" };
  }
  if (!result.content || !result.filename) {
    return { success: false, error: "Brak zawartości eksportu" };
  }

  try {
    const existing = await prisma.accountingExport.findFirst({
      where: { system: "enova", propertyId: propertyId ?? null },
    });
    if (existing) {
      await prisma.accountingExport.update({
        where: { id: existing.id },
        data: { lastExportAt: new Date() },
      });
    } else {
      await prisma.accountingExport.create({
        data: {
          propertyId: propertyId || undefined,
          system: "enova",
          lastExportAt: new Date(),
        },
      });
    }
  } catch {
    // ignoruj
  }

  return {
    success: true,
    data: { content: result.content, filename: result.filename },
  };
}
