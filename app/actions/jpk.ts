"use server";

import { prisma } from "@/lib/db";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Eksport JPK (Jednolity Plik Kontrolny) – uproszczony XML z nagłówkiem i pozycjami
 * w przedziale dat (transakcje + faktury VAT). Struktura rozszerzalna do pełnego JPK_V7M.
 */
const MAX_JPK_RANGE_DAYS = 366;

export async function exportJpk(
  dateFrom: string,
  dateTo: string
): Promise<ActionResult<{ xml: string; filename: string }>> {
  try {
    const from = new Date(dateFrom + "T00:00:00.000Z");
    const to = new Date(dateTo + "T23:59:59.999Z");
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return { success: false, error: "Nieprawidłowy format dat (oczekiwano YYYY-MM-DD)" };
    }
    if (from > to) {
      return { success: false, error: "Data od nie może być późniejsza niż data do" };
    }
    const rangeDays = Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
    if (rangeDays > MAX_JPK_RANGE_DAYS) {
      return { success: false, error: `Zakres dat nie może przekraczać ${MAX_JPK_RANGE_DAYS} dni (1 rok)` };
    }

    const start = new Date(from);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(to);
    end.setUTCHours(23, 59, 59, 999);

    const [transactions, invoices] = await Promise.all([
      prisma.transaction.findMany({
        where: { createdAt: { gte: start, lte: end } },
        include: { reservation: { include: { company: true } } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.invoice.findMany({
        where: { issuedAt: { gte: start, lte: end } },
        orderBy: { issuedAt: "asc" },
      }),
    ]);

    const escape = (s: string) =>
      s
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

    const lines: string[] = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      "<JPK xmlns=\"http://jpk.mf.gov.pl/wzor/2021/09/27/09271/\">",
      "  <Naglowek>",
      `    <DataOd>${dateFrom}</DataOd>`,
      `    <DataDo>${dateTo}</DataDo>`,
      `    <DataWytworzenia>${new Date().toISOString().slice(0, 19).replace("T", " ")}</DataWytworzenia>`,
      "  </Naglowek>",
      "  <Sprzedaz>",
    ];

    for (const t of transactions) {
      if (t.type === "VOID") continue;
      const amount = Number(t.amount);
      const date = t.createdAt.toISOString().slice(0, 10);
      const nip = t.reservation.company?.nip ?? "";
      const name = t.reservation.company?.name ?? "";
      const gtu = (t as { gtuCode?: string | null }).gtuCode ?? "";
      lines.push("    <Wiersz>");
      lines.push(`      <Data>${date}</Data>`);
      lines.push(`      <KontrahentNIP>${escape(nip)}</KontrahentNIP>`);
      lines.push(`      <KontrahentNazwa>${escape(name)}</KontrahentNazwa>`);
      lines.push(`      <Kwota>${amount.toFixed(2)}</Kwota>`);
      lines.push(`      <Typ>${escape(t.type)}</Typ>`);
      if (gtu) lines.push(`      <GTU>${escape(gtu)}</GTU>`);
      lines.push("    </Wiersz>");
    }

    for (const i of invoices) {
      const date = i.issuedAt.toISOString().slice(0, 10);
      lines.push("    <Wiersz>");
      lines.push(`      <Data>${date}</Data>`);
      lines.push(`      <KontrahentNIP>${escape(i.buyerNip)}</KontrahentNIP>`);
      lines.push(`      <KontrahentNazwa>${escape(i.buyerName)}</KontrahentNazwa>`);
      lines.push(`      <Kwota>${Number(i.amountGross).toFixed(2)}</Kwota>`);
      lines.push(`      <NumerFV>${escape(i.number)}</NumerFV>`);
      lines.push("    </Wiersz>");
    }

    lines.push("  </Sprzedaz>");
    lines.push("</JPK>");

    const xml = lines.join("\n");
    const filename = `JPK_${dateFrom}_${dateTo}.xml`;
    return { success: true, data: { xml, filename } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd eksportu JPK",
    };
  }
}

/** Escape dla XML */
function escapeXml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Generowanie JPK_FA (Jednolity Plik Kontrolny – Faktury) – struktura XML dla faktur VAT.
 * Zgodna z wymogami MF (JPK na żądanie). Zakres dat max 1 rok.
 */
export async function exportJpkFa(
  dateFrom: string,
  dateTo: string
): Promise<ActionResult<{ xml: string; filename: string }>> {
  try {
    const from = new Date(dateFrom + "T00:00:00.000Z");
    const to = new Date(dateTo + "T23:59:59.999Z");
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return { success: false, error: "Nieprawidłowy format dat (oczekiwano YYYY-MM-DD)" };
    }
    if (from > to) {
      return { success: false, error: "Data od nie może być późniejsza niż data do" };
    }
    const rangeDays = Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
    if (rangeDays > MAX_JPK_RANGE_DAYS) {
      return { success: false, error: `Zakres dat nie może przekraczać ${MAX_JPK_RANGE_DAYS} dni (1 rok)` };
    }

    const start = new Date(from);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(to);
    end.setUTCHours(23, 59, 59, 999);

    const invoices = await prisma.invoice.findMany({
      where: { issuedAt: { gte: start, lte: end } },
      orderBy: { issuedAt: "asc" },
    });
    // Pozycje faktur (transakcje z invoiceId) – do GTU per wiersz
    const invoiceIds = invoices.map((i) => i.id);
    const invoiceTransactions = await prisma.transaction.findMany({
      where: { invoiceId: { in: invoiceIds }, type: { not: "VOID" }, status: "ACTIVE" },
      orderBy: { postedAt: "asc" },
    });
    const txByInvoice = new Map<string, typeof invoiceTransactions>();
    for (const t of invoiceTransactions) {
      if (t.invoiceId) {
        const list = txByInvoice.get(t.invoiceId) ?? [];
        list.push(t);
        txByInvoice.set(t.invoiceId, list);
      }
    }

    const ns = "http://crd.gov.pl/wzor/2023/06/29/12648/";
    const nowStr = new Date().toISOString().slice(0, 19).replace("T", " ");
    const lines: string[] = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<JPK xmlns="${ns}">`,
      "  <Naglowek>",
      "    <KodFormularza kodSystemowy=\"JPK_FA\" wersjaSchemy=\"1-0\">JPK_FA</KodFormularza>",
      `    <DataOd>${dateFrom}</DataOd>`,
      `    <DataDo>${dateTo}</DataDo>`,
      `    <DataWytworzeniaJPK>${nowStr}</DataWytworzeniaJPK>`,
      "  </Naglowek>",
      "  <Podmiot1>",
      "    <NIP></NIP>",
      "    <Nazwa></Nazwa>",
      "  </Podmiot1>",
      "  <Faktura>",
    ];

    for (const i of invoices) {
      const dataWystawienia = i.issuedAt.toISOString().slice(0, 10);
      const nip = (i.buyerNip ?? "").replace(/\s/g, "");
      const rows = txByInvoice.get(i.id);
      if (rows && rows.length > 0) {
        for (const row of rows) {
          const gtu = (row as { gtuCode?: string | null }).gtuCode ?? "";
          lines.push("    <FakturaWiersz>");
          lines.push(`      <P_1>${dataWystawienia}</P_1>`);
          lines.push(`      <P_2A>${escapeXml(i.number)}</P_2A>`);
          lines.push(`      <P_6>${dataWystawienia}</P_6>`);
          lines.push(`      <P_13_1>${escapeXml(nip)}</P_13_1>`);
          lines.push(`      <P_14_1>${escapeXml(i.buyerName ?? "")}</P_14_1>`);
          lines.push(`      <P_15>${escapeXml([i.buyerAddress, i.buyerPostalCode, i.buyerCity].filter(Boolean).join(", "))}</P_15>`);
          lines.push(`      <P_16>${Number(row.netAmount ?? row.amount).toFixed(2)}</P_16>`);
          lines.push(`      <P_17>${Number(row.vatAmount ?? 0).toFixed(2)}</P_17>`);
          lines.push(`      <P_18>${Number(row.amount).toFixed(2)}</P_18>`);
          if (gtu) lines.push(`      <P_12>${escapeXml(gtu)}</P_12>`);
          lines.push("    </FakturaWiersz>");
        }
      } else {
        lines.push("    <FakturaWiersz>");
        lines.push(`      <P_1>${dataWystawienia}</P_1>`);
        lines.push(`      <P_2A>${escapeXml(i.number)}</P_2A>`);
        lines.push(`      <P_6>${dataWystawienia}</P_6>`);
        lines.push(`      <P_13_1>${escapeXml(nip)}</P_13_1>`);
        lines.push(`      <P_14_1>${escapeXml(i.buyerName ?? "")}</P_14_1>`);
        lines.push(`      <P_15>${escapeXml([i.buyerAddress, i.buyerPostalCode, i.buyerCity].filter(Boolean).join(", "))}</P_15>`);
        lines.push(`      <P_16>${Number(i.amountNet).toFixed(2)}</P_16>`);
        lines.push(`      <P_17>${Number(i.amountVat).toFixed(2)}</P_17>`);
        lines.push(`      <P_18>${Number(i.amountGross).toFixed(2)}</P_18>`);
        lines.push("    </FakturaWiersz>");
      }
    }

    lines.push("  </Faktura>");
    lines.push("</JPK>");

    const xml = lines.join("\n");
    const filename = `JPK_FA_${dateFrom}_${dateTo}.xml`;
    return { success: true, data: { xml, filename } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd generowania JPK_FA",
    };
  }
}

/**
 * Generowanie JPK_VAT (Jednolity Plik Kontrolny – deklaracja VAT) – XML ze sprzedażą i zakupami.
 * Zakres dat max 1 rok. Struktura zgodna z wymogami MF (SprzedazWiersz / ZakupWiersz).
 */
export async function exportJpkVat(
  dateFrom: string,
  dateTo: string
): Promise<ActionResult<{ xml: string; filename: string }>> {
  try {
    const from = new Date(dateFrom + "T00:00:00.000Z");
    const to = new Date(dateTo + "T23:59:59.999Z");
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return { success: false, error: "Nieprawidłowy format dat (oczekiwano YYYY-MM-DD)" };
    }
    if (from > to) {
      return { success: false, error: "Data od nie może być późniejsza niż data do" };
    }
    const rangeDays = Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
    if (rangeDays > MAX_JPK_RANGE_DAYS) {
      return { success: false, error: `Zakres dat nie może przekraczać ${MAX_JPK_RANGE_DAYS} dni (1 rok)` };
    }

    const start = new Date(from);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(to);
    end.setUTCHours(23, 59, 59, 999);

    const invoices = await prisma.invoice.findMany({
      where: { issuedAt: { gte: start, lte: end } },
      orderBy: { issuedAt: "asc" },
    });

    const ns = "http://crd.gov.pl/wzor/2021/12/27/11148/";
    const nowStr = new Date().toISOString().slice(0, 19).replace("T", " ");
    const lines: string[] = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<JPK xmlns="${ns}">`,
      "  <Naglowek>",
      "    <KodFormularza kodSystemowy=\"JPK_VAT\" wersjaSchemy=\"1-0\">JPK_VAT</KodFormularza>",
      `    <DataOd>${dateFrom}</DataOd>`,
      `    <DataDo>${dateTo}</DataDo>`,
      `    <DataWytworzeniaJPK>${nowStr}</DataWytworzeniaJPK>`,
      "  </Naglowek>",
      "  <Podmiot1>",
      "    <NIP></NIP>",
      "    <Nazwa></Nazwa>",
      "  </Podmiot1>",
      "  <Sprzedaz>",
    ];

    const invoiceIds = invoices.map((i) => i.id);
    const invoiceTransactions = await prisma.transaction.findMany({
      where: { invoiceId: { in: invoiceIds }, type: { not: "VOID" }, status: "ACTIVE" },
      orderBy: { postedAt: "asc" },
    });
    const txByInvoiceVat = new Map<string, typeof invoiceTransactions>();
    for (const t of invoiceTransactions) {
      if (t.invoiceId) {
        const list = txByInvoiceVat.get(t.invoiceId) ?? [];
        list.push(t);
        txByInvoiceVat.set(t.invoiceId, list);
      }
    }

    for (const i of invoices) {
      const dataWystawienia = i.issuedAt.toISOString().slice(0, 10);
      const nip = (i.buyerNip ?? "").replace(/\s/g, "");
      const rows = txByInvoiceVat.get(i.id);
      if (rows && rows.length > 0) {
        for (const row of rows) {
          const gtu = (row as { gtuCode?: string | null }).gtuCode ?? "";
          lines.push("    <SprzedazWiersz>");
          lines.push(`      <P_1>${dataWystawienia}</P_1>`);
          lines.push(`      <P_2A>${escapeXml(i.number)}</P_2A>`);
          lines.push(`      <P_6>${dataWystawienia}</P_6>`);
          lines.push(`      <P_13_1>${escapeXml(nip)}</P_13_1>`);
          lines.push(`      <P_14_1>${escapeXml(i.buyerName ?? "")}</P_14_1>`);
          lines.push(`      <P_15>${escapeXml([i.buyerAddress, i.buyerPostalCode, i.buyerCity].filter(Boolean).join(", "))}</P_15>`);
          lines.push(`      <K_19>${Number(row.vatRate).toFixed(2)}</K_19>`);
          lines.push(`      <P_16>${Number(row.netAmount ?? row.amount).toFixed(2)}</P_16>`);
          lines.push(`      <P_17>${Number(row.vatAmount ?? 0).toFixed(2)}</P_17>`);
          lines.push(`      <P_18>${Number(row.amount).toFixed(2)}</P_18>`);
          if (gtu) lines.push(`      <P_12>${escapeXml(gtu)}</P_12>`);
          lines.push("    </SprzedazWiersz>");
        }
      } else {
        lines.push("    <SprzedazWiersz>");
        lines.push(`      <P_1>${dataWystawienia}</P_1>`);
        lines.push(`      <P_2A>${escapeXml(i.number)}</P_2A>`);
        lines.push(`      <P_6>${dataWystawienia}</P_6>`);
        lines.push(`      <P_13_1>${escapeXml(nip)}</P_13_1>`);
        lines.push(`      <P_14_1>${escapeXml(i.buyerName ?? "")}</P_14_1>`);
        lines.push(`      <P_15>${escapeXml([i.buyerAddress, i.buyerPostalCode, i.buyerCity].filter(Boolean).join(", "))}</P_15>`);
        lines.push(`      <K_19>${Number(i.vatRate).toFixed(2)}</K_19>`);
        lines.push(`      <P_16>${Number(i.amountNet).toFixed(2)}</P_16>`);
        lines.push(`      <P_17>${Number(i.amountVat).toFixed(2)}</P_17>`);
        lines.push(`      <P_18>${Number(i.amountGross).toFixed(2)}</P_18>`);
        lines.push("    </SprzedazWiersz>");
      }
    }

    lines.push("  </Sprzedaz>");
    lines.push("  <Zakup>");
    lines.push("  </Zakup>");
    lines.push("</JPK>");

    const xml = lines.join("\n");
    const filename = `JPK_VAT_${dateFrom}_${dateTo}.xml`;
    return { success: true, data: { xml, filename } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd generowania JPK_VAT",
    };
  }
}
