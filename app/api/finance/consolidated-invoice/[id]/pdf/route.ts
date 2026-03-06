import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const HOTEL_NAME = process.env.HOTEL_NAME ?? "Hotel";
const PDF_GENERATION_TIMEOUT_MS = Number(process.env.INVOICE_PDF_TIMEOUT_MS) || 30_000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(message)), ms)
    ),
  ]);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function amountToWords(amount: number): string {
  const units = ["", "jeden", "dwa", "trzy", "cztery", "pięć", "sześć", "siedem", "osiem", "dziewięć"];
  const teens = ["dziesięć", "jedenaście", "dwanaście", "trzynaście", "czternaście", "piętnaście", "szesnaście", "siedemnaście", "osiemnaście", "dziewiętnaście"];
  const tens = ["", "", "dwadzieścia", "trzydzieści", "czterdzieści", "pięćdziesiąt", "sześćdziesiąt", "siedemdziesiąt", "osiemdziesiąt", "dziewięćdziesiąt"];
  const hundreds = ["", "sto", "dwieście", "trzysta", "czterysta", "pięćset", "sześćset", "siedemset", "osiemset", "dziewięćset"];
  const intPart = Math.floor(amount);
  const decPart = Math.round((amount - intPart) * 100);
  if (intPart === 0) return `zero ${decPart.toString().padStart(2, "0")}/100`;
  const convertGroup = (n: number): string => {
    if (n === 0) return "";
    if (n < 10) return units[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) {
      const t = Math.floor(n / 10);
      const u = n % 10;
      return tens[t] + (u > 0 ? " " + units[u] : "");
    }
    const h = Math.floor(n / 100);
    const rest = n % 100;
    return hundreds[h] + (rest > 0 ? " " + convertGroup(rest) : "");
  };
  let result = "";
  if (intPart >= 1000) {
    const thousands = Math.floor(intPart / 1000);
    if (thousands === 1) result = "jeden tysiąc";
    else if (thousands >= 2 && thousands <= 4) result = convertGroup(thousands) + " tysiące";
    else result = convertGroup(thousands) + " tysięcy";
    const rest = intPart % 1000;
    if (rest > 0) result += " " + convertGroup(rest);
  } else result = convertGroup(intPart);
  return `${result} ${decPart.toString().padStart(2, "0")}/100`;
}

/**
 * GET /api/finance/consolidated-invoice/[id]/pdf
 * Zwraca fakturę zbiorczą VAT w HTML (do druku / Zapisz jako PDF).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id?.trim()) return new NextResponse("Brak ID faktury", { status: 400 });

  try {
    const html = await withTimeout(
      generateConsolidatedInvoiceHtml(id.trim()),
      PDF_GENERATION_TIMEOUT_MS,
      "Timeout generowania PDF faktury zbiorczej."
    );
    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="faktura-zbiorcza-${id.trim()}.html"`,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "NOT_FOUND") return new NextResponse("Faktura nie istnieje", { status: 404 });
    console.error("[consolidated-invoice-pdf]", e);
    return new NextResponse("Błąd generowania faktury", { status: 500 });
  }
}

async function generateConsolidatedInvoiceHtml(id: string): Promise<string> {
  const inv = await prisma.consolidatedInvoice.findUnique({
    where: { id },
    include: { items: { orderBy: { checkIn: "asc" } } },
  });

  if (!inv) throw new Error("NOT_FOUND");

  let template = await prisma.invoiceTemplate.findUnique({ where: { templateType: "DEFAULT" } });
  if (!template) {
    template = await prisma.invoiceTemplate.create({
      data: {
        templateType: "DEFAULT",
        sellerName: HOTEL_NAME,
        footerText: "Dziękujemy za skorzystanie z naszych usług.",
        thanksText: "Zapraszamy ponownie!",
      },
    });
  }

  const net = Number(inv.amountNet);
  const vat = Number(inv.amountVat);
  const gross = Number(inv.amountGross);
  const vatRate = Number(inv.vatRate);
  const issueDate = new Date(inv.issuedAt).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });
  const periodFrom = new Date(inv.periodFrom).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });
  const periodTo = new Date(inv.periodTo).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });
  const dueDateStr = new Date(inv.dueDate).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });

  const lineItems = inv.items.map((item) => {
    const desc = item.description?.trim() || `Nocleg – ${item.guestName}, pokój ${item.roomNumber}, ${new Date(item.checkIn).toLocaleDateString("pl-PL")}–${new Date(item.checkOut).toLocaleDateString("pl-PL")} (${item.nights} nocy)`;
    return {
      name: desc,
      net: Number(item.amountNet),
      vat: Number(item.amountVat),
      gross: Number(item.amountGross),
    };
  });

  const defaultUnit = template.defaultUnit || "szt.";
  const tableRows = lineItems.map((item, idx) => ({
    cells: [
      `${idx + 1}`,
      escapeHtml(item.name),
      "1",
      defaultUnit,
      item.net.toFixed(2),
      item.net.toFixed(2),
      vatRate.toString(),
      item.vat.toFixed(2),
      item.gross.toFixed(2),
    ],
  }));

  const sellerLines = [
    template.sellerName || HOTEL_NAME,
    ...(template.sellerAddress ? [template.sellerAddress] : []),
    ...(template.sellerPostalCode || template.sellerCity ? [[template.sellerPostalCode, template.sellerCity].filter(Boolean).join(" ")] : []),
    ...(template.sellerNip ? [`NIP: ${template.sellerNip}`] : []),
  ].filter(Boolean);
  const sellerHtml = sellerLines.map((l) => `<p class="mb-0">${escapeHtml(String(l))}</p>`).join("");
  const buyerLines = [
    inv.buyerName,
    ...(inv.buyerAddress ? [inv.buyerAddress] : []),
    ...(inv.buyerPostalCode || inv.buyerCity ? [[inv.buyerPostalCode, inv.buyerCity].filter(Boolean).join(" ")] : []),
    `NIP: ${inv.buyerNip}`,
  ].filter(Boolean);
  const buyerHtml = buyerLines.map((l) => `<p class="mb-0">${escapeHtml(String(l))}</p>`).join("");

  const notesHtml = inv.notes?.trim()
    ? `<div class="invoice-notes"><strong>Uwagi:</strong><br>${escapeHtml(inv.notes).replace(/\n/g, "<br>")}</div>`
    : "";

  const tableHeaders = ["Lp.", "Nazwa towaru/usługi (SWW/KU)", "Ilość", "j.m.", "Cena netto", "Wartość netto", "VAT (%)", "Wartość VAT", "Wartość brutto"];

  const html = `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="utf-8" />
  <title>Faktura zbiorcza ${escapeHtml(inv.number)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: ${template.fontFamily}; max-width: 900px; margin: 1rem auto; padding: 1rem; color: #333; font-size: 11px; line-height: 1.4; }
    h1 { font-size: 1.3rem; margin: 0.5rem 0 1rem; text-align: center; }
    .header-row { display: flex; justify-content: space-between; margin-bottom: 1rem; font-size: 0.85rem; }
    table { width: 100%; border-collapse: collapse; margin: 0.75rem 0; font-size: 0.8rem; }
    th, td { border: 1px solid #333; padding: 0.35rem 0.5rem; text-align: left; }
    th { background: #f5f5f5; font-weight: 600; }
    .text-right { text-align: right; }
    .parties { display: flex; gap: 1rem; margin: 1rem 0; font-size: 0.85rem; }
    .party-box { border: 1px solid #ccc; padding: 0.5rem; min-height: 80px; }
    .party-label { font-weight: 600; margin-bottom: 0.25rem; font-size: 0.75rem; color: #666; }
    .vat-summary { width: auto; margin-left: auto; margin-right: 0; font-size: 0.8rem; }
    .payment-box { margin: 1rem 0; font-size: 0.85rem; }
    .amount-words { font-size: 0.8rem; margin: 0.5rem 0; }
    .signatures { display: flex; justify-content: space-between; margin-top: 3rem; font-size: 0.75rem; }
    .signature-line { border-top: 1px solid #333; margin-top: 2rem; padding-top: 0.25rem; }
    .invoice-notes { margin: 1rem 0; padding: 0.5rem 0.75rem; border: 1px solid #ddd; border-radius: 4px; font-size: 0.85rem; background: #fafafa; }
    .invoice-page-copy { page-break-before: always; }
    @media print { body { margin: 0; padding: 0.5rem; } .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="header-row">
    <div>${sellerHtml}</div>
    <div style="text-align: right;">
      <p class="mb-0"><strong>Data wystawienia:</strong> ${issueDate}</p>
      <p class="mb-0"><strong>Okres:</strong> ${periodFrom} – ${periodTo}</p>
    </div>
  </div>
  <h1>Faktura zbiorcza ${escapeHtml(inv.number)} oryginał</h1>
  <div class="parties">
    <div><div class="party-label">Sprzedawca</div><div class="party-box">${sellerHtml}</div></div>
    <div><div class="party-label">Nabywca</div><div class="party-box">${buyerHtml}</div></div>
  </div>
  <table>
    <thead><tr>${tableHeaders.map((h, i) => `<th class="${i >= 2 ? "text-right" : ""}">${escapeHtml(h)}</th>`).join("")}</tr></thead>
    <tbody>
      ${tableRows.map((row) => `<tr>${row.cells.map((c, i) => `<td class="${i >= 2 ? "text-right" : ""}">${c}</td>`).join("")}</tr>`).join("")}
    </tbody>
  </table>
  <table class="vat-summary">
    <thead><tr><th>Stawka VAT</th><th class="text-right">Wartość netto</th><th class="text-right">Wartość VAT</th><th class="text-right">Wartość brutto</th></tr></thead>
    <tbody>
      <tr><td class="text-center">${vatRate},00</td><td class="text-right">${net.toFixed(2)}</td><td class="text-right">${vat.toFixed(2)}</td><td class="text-right">${gross.toFixed(2)}</td></tr>
      <tr style="font-weight: 600;"><td>Suma:</td><td class="text-right">${net.toFixed(2)}</td><td class="text-right">${vat.toFixed(2)}</td><td class="text-right">${gross.toFixed(2)}</td></tr>
    </tbody>
  </table>
  <div class="payment-box">Forma płatności: Przelew w terminie ${inv.paymentTermDays} dni = ${dueDateStr}</div>
  <div class="amount-words"><strong>Słownie zł:</strong> ${amountToWords(gross)}</div>
  ${notesHtml}
  <div style="margin-top: 1rem; font-size: 0.75rem; color: #666;">${template.footerText ? escapeHtml(template.footerText) : ""}</div>
  <div class="signatures">
    <div style="text-align: center; width: 200px;"><div class="signature-line">Osoba upoważniona do wystawienia</div></div>
    <div style="text-align: center; width: 200px;"><div class="signature-line">Osoba upoważniona do odbioru</div></div>
  </div>
  <p class="no-print" style="font-size: 0.7rem; color: #999; margin-top: 2rem;">Dokument wygenerowany z systemu Hotel PMS. Do druku: „Drukuj" → „Zapisz jako PDF".</p>
</body>
</html>`;

  const bodyContent = html.substring(html.indexOf('  <div class="header-row">'), html.indexOf('  <p class="no-print"'));
  const kopiaContent = bodyContent.replace("oryginał</h1>", "kopia</h1>");
  return html.replace('  <p class="no-print"', `  <div class="invoice-page-copy">\n${kopiaContent}\n  </div>\n  <p class="no-print"`);
}
