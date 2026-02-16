/**
 * KSeF – konwerter Invoice (DB) → FA_2.xml zgodny ze schematem e-faktury.
 * Minimalna struktura FA(2) z nagłówkiem, sprzedawcą, nabywcą i pozycjami.
 */

export interface InvoiceForKsef {
  number: string;
  issuedAt: Date;
  amountNet: number;
  amountVat: number;
  amountGross: number;
  vatRate: number;
  buyerNip: string;
  buyerName: string;
  buyerAddress?: string | null;
  buyerPostalCode?: string | null;
  buyerCity?: string | null;
  /** Faktura korygująca: przyczyna, numer korygowanej faktury, okres (np. daty) */
  correctionReason?: string | null;
  correctedInvoiceNumber?: string | null;
  correctedInvoicePeriod?: string | null;
  /** Jedna pozycja (np. "Usługa noclegowa") lub wiele – każda z netto/VAT/brutto */
  items?: Array<{
    name: string;
    quantity: number;
    amountNet: number;
    amountVat: number;
    amountGross: number;
    vatRate: number;
  }>;
}

export interface SellerForKsef {
  nip: string;
  name: string;
  address?: string;
  postalCode?: string;
  city?: string;
  /** Dane kontaktowe: email, telefon */
  email?: string;
  phone?: string;
}

function escapeXml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Generuje FA_2.xml (jedna faktura) zgodny ze schematem KSeF.
 * seller – dane sprzedawcy (z env/config); jeśli brak, NIP/Nazwa puste.
 */
export function buildFa2Xml(
  invoice: InvoiceForKsef,
  seller: SellerForKsef
): string {
  const ns = "http://crd.gov.pl/wzor/2023/06/29/12648/";
  const issued = dateStr(invoice.issuedAt);
  const nipBuyer = (invoice.buyerNip ?? "").replace(/\s/g, "");
  const nipSeller = (seller.nip ?? "").replace(/\s/g, "");

  const dataWytworzenia = new Date().toISOString().slice(0, 19).replace("T", " ");
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<Faktura xmlns="${ns}">`,
    "  <Naglowek>",
    "    <KodFormularza kodSystemowy=\"FA_2\" wersjaSchemy=\"2-0\">FA</KodFormularza>",
    "    <WariantFormularza>2</WariantFormularza>",
    `    <DataWytworzeniaFa>${dataWytworzenia}</DataWytworzeniaFa>`,
    "    <SystemInfo>HotelSystem KSeF</SystemInfo>",
    "  </Naglowek>",
    "  <Podmiot1>",
    `    <NIP>${escapeXml(nipSeller)}</NIP>`,
    `    <Nazwa>${escapeXml(seller.name)}</Nazwa>`,
    ...(seller.address ? [`    <AdresL1>${escapeXml(seller.address)}</AdresL1>`] : []),
    ...(seller.postalCode ? [`    <KodPocztowy>${escapeXml(seller.postalCode)}</KodPocztowy>`] : []),
    ...(seller.city ? [`    <Miejscowosc>${escapeXml(seller.city)}</Miejscowosc>`] : []),
    ...(seller.email || seller.phone
      ? [
          "    <DaneKontaktowe>",
          ...(seller.email ? [`      <Email>${escapeXml(seller.email)}</Email>`] : []),
          ...(seller.phone ? [`      <Telefon>${escapeXml(seller.phone)}</Telefon>`] : []),
          "    </DaneKontaktowe>",
        ]
      : []),
    "  </Podmiot1>",
    "  <Podmiot2>",
    `    <NIP>${escapeXml(nipBuyer)}</NIP>`,
    `    <Nazwa>${escapeXml(invoice.buyerName ?? "")}</Nazwa>`,
    `    <Adres>${escapeXml([invoice.buyerAddress, invoice.buyerPostalCode, invoice.buyerCity].filter(Boolean).join(", ") || "-")}</Adres>`,
    ...(invoice.buyerPostalCode ? [`    <KodPocztowy>${escapeXml(invoice.buyerPostalCode)}</KodPocztowy>`] : []),
    ...(invoice.buyerCity ? [`    <Miejscowosc>${escapeXml(invoice.buyerCity)}</Miejscowosc>`] : []),
    "  </Podmiot2>",
    "  <Fa>",
    `    <P_1>${issued}</P_1>`,
    `    <P_2>${escapeXml(invoice.number)}</P_2>`,
    `    <P_2A>${escapeXml(invoice.number)}</P_2A>`,
    `    <P_6>${issued}</P_6>`,
    "    <KursWaluty>1</KursWaluty>",
    ...(invoice.correctionReason ? [`    <PrzyczynaKorekty>${escapeXml(invoice.correctionReason)}</PrzyczynaKorekty>`] : []),
    ...(invoice.correctedInvoiceNumber ? [`    <NrFaKorygowanej>${escapeXml(invoice.correctedInvoiceNumber)}</NrFaKorygowanej>`] : []),
    ...(invoice.correctedInvoicePeriod ? [`    <OkresFaKorygowanej>${escapeXml(invoice.correctedInvoicePeriod)}</OkresFaKorygowanej>`] : []),
    `    <P_13_1>${escapeXml(nipBuyer)}</P_13_1>`,
    `    <P_14_1>${escapeXml(invoice.buyerName ?? "")}</P_14_1>`,
    `    <P_15>${escapeXml([invoice.buyerAddress, invoice.buyerPostalCode, invoice.buyerCity].filter(Boolean).join(", "))}</P_15>`,
  ];

  const items = invoice.items?.length
    ? invoice.items
    : [
        {
          name: "Usługa noclegowa",
          quantity: 1,
          amountNet: invoice.amountNet,
          amountVat: invoice.amountVat,
          amountGross: invoice.amountGross,
          vatRate: invoice.vatRate,
        },
      ];

  lines.push("    <FaWiersze>");
  for (const item of items) {
    const unitPrice = item.quantity !== 0 ? item.amountNet / item.quantity : item.amountNet;
    lines.push("      <FaWiersz>");
    lines.push(`        <P_7>${escapeXml(item.name)}</P_7>`);
    lines.push("        <P_8A>szt</P_8A>");
    lines.push(`        <P_8B>${item.quantity}</P_8B>`);
    lines.push(`        <P_9A>${unitPrice.toFixed(2)}</P_9A>`);
    lines.push(`        <P_11>${item.amountNet.toFixed(2)}</P_11>`);
    lines.push(`        <P_12>${item.vatRate.toFixed(2)}</P_12>`);
    lines.push(`        <StawkaVat>${item.amountVat.toFixed(2)}</StawkaVat>`);
    lines.push("      </FaWiersz>");
  }
  lines.push("    </FaWiersze>");

  const byRate = new Map<number, { net: number; vat: number }>();
  for (const item of items) {
    const r = item.vatRate;
    const cur = byRate.get(r) ?? { net: 0, vat: 0 };
    cur.net += item.amountNet;
    cur.vat += item.amountVat;
    byRate.set(r, cur);
  }
  lines.push("    <Podsumowanie>");
  let idx = 1;
  for (const [_rate, tot] of Array.from(byRate.entries()).sort((a, b) => a[0] - b[0])) {
    const p13 = idx === 1 ? "P_13_1" : `P_13_${idx}`;
    const p14 = idx === 1 ? "P_14_1" : `P_14_${idx}`;
    lines.push(`      <${p13}>${tot.net.toFixed(2)}</${p13}>`);
    lines.push(`      <${p14}>${tot.vat.toFixed(2)}</${p14}>`);
    idx++;
    if (idx > 4) break;
  }
  lines.push("    </Podsumowanie>");

  lines.push(`    <P_15_2>${invoice.amountNet.toFixed(2)}</P_15_2>`);
  lines.push(`    <P_16>${invoice.amountVat.toFixed(2)}</P_16>`);
  lines.push(`    <P_17>${invoice.amountGross.toFixed(2)}</P_17>`);
  lines.push("  </Fa>");
  lines.push("</Faktura>");

  return lines.join("\n");
}
