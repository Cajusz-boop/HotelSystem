/**
 * Integracje księgowe: Optima (XML), Subiekt, wFirma, Fakturownia.
 * Eksport faktur do formatów wymaganych przez te systemy.
 */

export type AccountingSystem = "optima" | "subiekt" | "wfirma" | "fakturownia";

/** Jedna faktura do eksportu (dane z systemu hotelowego). */
export interface InvoiceForExport {
  number: string;
  issuedAt: string; // ISO date
  amountNet: number;
  amountVat: number;
  amountGross: number;
  vatRate: number;
  buyerNip: string;
  buyerName: string;
  buyerAddress?: string | null;
  buyerPostalCode?: string | null;
  buyerCity?: string | null;
  /** Opis pozycji (np. "Usługa noclegowa") – jedna pozycja na fakturze. */
  description?: string;
}

export interface AccountingExportOptions {
  dateFrom: string;
  dateTo: string;
  format?: "csv" | "xml" | "json";
  /** Lista faktur do eksportu (pobrana z bazy przez wywołującego). */
  documents?: InvoiceForExport[];
}

export interface AccountingExportResult {
  success: boolean;
  /** Zawartość pliku do pobrania lub URL do zewnętrznego API */
  content?: string;
  filename?: string;
  error?: string;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatDateOptima(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Generuje XML zgodny z importem Comarch ERP Optima (Faktura Sprzedaży FS).
 * Struktura: Dokumenty / FakturaSprzedazy / Faktura / Kontrahent, Pozycje, Platnosci.
 * Opis struktury: pomoc.comarch.pl/optima – import dokumentów przez pliki XML.
 */
function buildOptimaXml(documents: InvoiceForExport[]): string {
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<Dokumenty>",
    '  <FakturaSprzedazy>',
  ];

  for (const doc of documents) {
    const dataWystawienia = formatDateOptima(doc.issuedAt);
    const nazwaPozycji = doc.description ?? "Usługa noclegowa";
    lines.push("    <Faktura>");
    lines.push(`      <Numer>${escapeXml(doc.number)}</Numer>`);
    lines.push(`      <DataWystawienia>${dataWystawienia}</DataWystawienia>`);
    lines.push("      <Kontrahent>");
    lines.push(`        <NIP>${escapeXml(doc.buyerNip.replace(/\s/g, ""))}</NIP>`);
    lines.push(`        <Nazwa>${escapeXml(doc.buyerName)}</Nazwa>`);
    if (doc.buyerAddress)
      lines.push(`        <Adres>${escapeXml(doc.buyerAddress)}</Adres>`);
    if (doc.buyerPostalCode || doc.buyerCity) {
      lines.push(
        `        <KodPocztowy>${escapeXml(doc.buyerPostalCode ?? "")}</KodPocztowy>`
      );
      lines.push(`        <Miejscowosc>${escapeXml(doc.buyerCity ?? "")}</Miejscowosc>`);
    }
    lines.push("      </Kontrahent>");
    lines.push("      <Pozycje>");
    lines.push("        <Pozycja>");
    lines.push(`          <Nazwa>${escapeXml(nazwaPozycji)}</Nazwa>`);
    lines.push("          <Ilosc>1</Ilosc>");
    lines.push(`          <CenaNetto>${doc.amountNet.toFixed(2)}</CenaNetto>`);
    lines.push(`          <WartoscNetto>${doc.amountNet.toFixed(2)}</WartoscNetto>`);
    lines.push(`          <StawkaVAT>${doc.vatRate.toFixed(2)}</StawkaVAT>`);
    lines.push(`          <KwotaVAT>${doc.amountVat.toFixed(2)}</KwotaVAT>`);
    lines.push(`          <WartoscBrutto>${doc.amountGross.toFixed(2)}</WartoscBrutto>`);
    lines.push("        </Pozycja>");
    lines.push("      </Pozycje>");
    lines.push("      <Platnosci>");
    lines.push("        <Platnosc>");
    lines.push("          <FormaPlatnosci>Przelew</FormaPlatnosci>");
    lines.push(`          <Kwota>${doc.amountGross.toFixed(2)}</Kwota>`);
    lines.push("        </Platnosc>");
    lines.push("      </Platnosci>");
    lines.push("    </Faktura>");
  }

  lines.push("  </FakturaSprzedazy>");
  lines.push("</Dokumenty>");
  return lines.join("\r\n");
}

/** Eksport do Comarch ERP Optima – plik XML do importu (Faktura Sprzedaży). */
export async function exportToOptima(
  options: AccountingExportOptions
): Promise<AccountingExportResult> {
  const documents = options.documents ?? [];
  if (documents.length === 0) {
    return {
      success: false,
      error:
        "Brak dokumentów do eksportu. Przekaż listę faktur w options.documents (np. z getInvoices z bazy).",
    };
  }
  const content = buildOptimaXml(documents);
  const dateFrom = options.dateFrom.replace(/-/g, "");
  const dateTo = options.dateTo.replace(/-/g, "");
  const filename = `optima_faktury_${dateFrom}_${dateTo}.xml`;
  return {
    success: true,
    content,
    filename,
  };
}

/**
 * Generuje XML do importu w InsERT Subiekt Nexo (faktury sprzedaży).
 * Struktura: Dokumenty / Faktura / Numer, Data, Kontrahent, Pozycje.
 */
function buildSubiektXml(documents: InvoiceForExport[]): string {
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<Dokumenty xmlns=\"http://insert.pl/subiekt/eksport\">",
  ];

  for (const doc of documents) {
    const dataWystawienia = formatDateOptima(doc.issuedAt);
    const nazwaPozycji = doc.description ?? "Usługa noclegowa";
    lines.push("  <Faktura>");
    lines.push(`    <Numer>${escapeXml(doc.number)}</Numer>`);
    lines.push(`    <DataWystawienia>${dataWystawienia}</DataWystawienia>`);
    lines.push("    <Kontrahent>");
    lines.push(`      <NIP>${escapeXml(doc.buyerNip.replace(/\s/g, ""))}</NIP>`);
    lines.push(`      <Nazwa>${escapeXml(doc.buyerName)}</Nazwa>`);
    if (doc.buyerAddress)
      lines.push(`      <Adres>${escapeXml(doc.buyerAddress)}</Adres>`);
    if (doc.buyerPostalCode)
      lines.push(`      <KodPocztowy>${escapeXml(doc.buyerPostalCode)}</KodPocztowy>`);
    if (doc.buyerCity)
      lines.push(`      <Miejscowosc>${escapeXml(doc.buyerCity)}</Miejscowosc>`);
    lines.push("    </Kontrahent>");
    lines.push("    <Pozycje>");
    lines.push("      <Pozycja>");
    lines.push(`        <Nazwa>${escapeXml(nazwaPozycji)}</Nazwa>`);
    lines.push("        <Ilosc>1</Ilosc>");
    lines.push(`        <CenaNetto>${doc.amountNet.toFixed(2)}</CenaNetto>`);
    lines.push(`        <StawkaVAT>${doc.vatRate.toFixed(2)}</StawkaVAT>`);
    lines.push(`        <WartoscBrutto>${doc.amountGross.toFixed(2)}</WartoscBrutto>`);
    lines.push("      </Pozycja>");
    lines.push("    </Pozycje>");
    lines.push("  </Faktura>");
  }

  lines.push("</Dokumenty>");
  return lines.join("\r\n");
}

/** Eksport do InsERT Subiekt Nexo – plik XML do importu. */
export async function exportToSubiekt(
  options: AccountingExportOptions
): Promise<AccountingExportResult> {
  const documents = options.documents ?? [];
  if (documents.length === 0) {
    return {
      success: false,
      error:
        "Brak dokumentów do eksportu. Przekaż listę faktur w options.documents.",
    };
  }
  const content = buildSubiektXml(documents);
  const dateFrom = options.dateFrom.replace(/-/g, "");
  const dateTo = options.dateTo.replace(/-/g, "");
  const filename = `subiekt_faktury_${dateFrom}_${dateTo}.xml`;
  return {
    success: true,
    content,
    filename,
  };
}

/**
 * Buduje JSON do wysłania do API wFirma/ifirma (faktura sprzedaży krajowej).
 * Struktura zgodna z dokumentacją api.ifirma.pl – wystawianie faktury sprzedaży.
 */
function buildWfirmaJson(documents: InvoiceForExport[]): string {
  const faktury = documents.map((doc) => {
    const dataWystawienia = formatDateOptima(doc.issuedAt);
    const nazwaPozycji = doc.description ?? "Usługa noclegowa";
    return {
      Faktura: {
        Kontrahent: {
          Nazwa: doc.buyerName,
          NIP: doc.buyerNip.replace(/\s/g, ""),
          Adres: [doc.buyerAddress, doc.buyerPostalCode, doc.buyerCity]
            .filter(Boolean)
            .join(" "),
        },
        Pozycje: [
          {
            Nazwa: nazwaPozycji,
            Ilosc: 1,
            CenaJednostkowaNetto: doc.amountNet,
            StawkaVat: doc.vatRate,
            Jednostka: "usl.",
          },
        ],
        DataWystawienia: dataWystawienia,
        NumerKontrahenta: doc.buyerNip.replace(/\s/g, ""),
        FormaPlatnosci: "przelew",
        Waluta: "PLN",
      },
    };
  });
  return JSON.stringify({ faktury }, null, 2);
}

/** Eksport do wFirma – plik JSON do importu lub wysłania do API (api.ifirma.pl). */
export async function exportToWfirma(
  options: AccountingExportOptions
): Promise<AccountingExportResult> {
  const documents = options.documents ?? [];
  if (documents.length === 0) {
    return {
      success: false,
      error:
        "Brak dokumentów do eksportu. Przekaż listę faktur w options.documents.",
    };
  }
  const content = buildWfirmaJson(documents);
  const dateFrom = options.dateFrom.replace(/-/g, "");
  const dateTo = options.dateTo.replace(/-/g, "");
  const filename = `wfirma_faktury_${dateFrom}_${dateTo}.json`;
  return {
    success: true,
    content,
    filename,
  };
}

/**
 * Buduje JSON do wysłania do API Fakturownia.pl (invoices.json).
 * Struktura zgodna z dokumentacją app.fakturownia.pl/api.
 */
function buildFakturowniaJson(documents: InvoiceForExport[]): string {
  const invoices = documents.map((doc) => {
    const sellDate = formatDateOptima(doc.issuedAt);
    const nazwaPozycji = doc.description ?? "Usługa noclegowa";
    return {
      kind: "vat",
      sell_date: sellDate,
      number: doc.number,
      buyer_name: doc.buyerName,
      buyer_tax_no: doc.buyerNip.replace(/\s/g, ""),
      buyer_street: doc.buyerAddress ?? "",
      buyer_post_code: doc.buyerPostalCode ?? "",
      buyer_city: doc.buyerCity ?? "",
      positions: [
        {
          name: nazwaPozycji,
          quantity: 1,
          unit: "usl.",
          tax: doc.vatRate,
          total_price_gross: doc.amountGross,
          total_price_net: doc.amountNet,
        },
      ],
    };
  });
  return JSON.stringify({ invoices }, null, 2);
}

/** Eksport do Fakturownia.pl – plik JSON do importu lub wysłania do API (invoices.json). */
export async function exportToFakturownia(
  options: AccountingExportOptions
): Promise<AccountingExportResult> {
  const documents = options.documents ?? [];
  if (documents.length === 0) {
    return {
      success: false,
      error:
        "Brak dokumentów do eksportu. Przekaż listę faktur w options.documents.",
    };
  }
  const content = buildFakturowniaJson(documents);
  const dateFrom = options.dateFrom.replace(/-/g, "");
  const dateTo = options.dateTo.replace(/-/g, "");
  const filename = `fakturownia_faktury_${dateFrom}_${dateTo}.json`;
  return {
    success: true,
    content,
    filename,
  };
}

/**
 * Eksport do Asseco Symfonia – CSV do importu faktur (separator ;).
 * Kolumny: Numer;Data;NIP;Nazwa;Adres;KodPocztowy;Miasto;Netto;StawkaVAT;VAT;Brutto;Opis
 */
function buildSymfoniaCsv(documents: InvoiceForExport[]): string {
  const header =
    "Numer;Data;NIP;Nazwa;Adres;KodPocztowy;Miasto;Netto;StawkaVAT;VAT;Brutto;Opis";
  const escapeCsv = (s: string) => {
    const t = String(s ?? "").replace(/"/g, '""');
    return t.includes(";") || t.includes("\n") ? `"${t}"` : t;
  };
  const rows = documents.map((doc) => {
    const dataWystawienia = formatDateOptima(doc.issuedAt);
    return [
      escapeCsv(doc.number),
      dataWystawienia,
      escapeCsv(doc.buyerNip.replace(/\s/g, "")),
      escapeCsv(doc.buyerName),
      escapeCsv(doc.buyerAddress ?? ""),
      escapeCsv(doc.buyerPostalCode ?? ""),
      escapeCsv(doc.buyerCity ?? ""),
      doc.amountNet.toFixed(2),
      doc.vatRate.toFixed(2),
      doc.amountVat.toFixed(2),
      doc.amountGross.toFixed(2),
      escapeCsv(doc.description ?? "Usługa noclegowa"),
    ].join(";");
  });
  return [header, ...rows].join("\r\n");
}

export async function exportToSymfonia(
  options: AccountingExportOptions
): Promise<AccountingExportResult> {
  const documents = options.documents ?? [];
  if (documents.length === 0) {
    return {
      success: false,
      error: "Brak dokumentów do eksportu. Przekaż listę faktur w options.documents.",
    };
  }
  const content = buildSymfoniaCsv(documents);
  const dateFrom = options.dateFrom.replace(/-/g, "");
  const dateTo = options.dateTo.replace(/-/g, "");
  const filename = `symfonia_faktury_${dateFrom}_${dateTo}.csv`;
  return { success: true, content, filename };
}

/**
 * Eksport do enova 365 / Infor enova – CSV do importu faktur (separator ;).
 * Ten sam format co Symfonia – uniwersalny CSV faktur.
 */
export async function exportToEnova(
  options: AccountingExportOptions
): Promise<AccountingExportResult> {
  const documents = options.documents ?? [];
  if (documents.length === 0) {
    return {
      success: false,
      error: "Brak dokumentów do eksportu. Przekaż listę faktur w options.documents.",
    };
  }
  const content = buildSymfoniaCsv(documents);
  const dateFrom = options.dateFrom.replace(/-/g, "");
  const dateTo = options.dateTo.replace(/-/g, "");
  const filename = `enova_faktury_${dateFrom}_${dateTo}.csv`;
  return { success: true, content, filename };
}

export const ACCOUNTING_SYSTEMS: { id: AccountingSystem; label: string }[] = [
  { id: "optima", label: "Optima" },
  { id: "subiekt", label: "Subiekt" },
  { id: "wfirma", label: "wFirma" },
  { id: "fakturownia", label: "Fakturownia" },
];
