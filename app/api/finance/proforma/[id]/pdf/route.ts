import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const HOTEL_NAME = process.env.HOTEL_NAME ?? "Hotel";
const DEFAULT_VAT_RATE = 8;

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

  if (intPart === 0) {
    return `zero ${decPart.toString().padStart(2, "0")}/100`;
  }

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
    if (thousands === 1) {
      result = "jeden tysiąc";
    } else if (thousands >= 2 && thousands <= 4) {
      result = convertGroup(thousands) + " tysiące";
    } else {
      result = convertGroup(thousands) + " tysięcy";
    }
    const rest = intPart % 1000;
    if (rest > 0) {
      result += " " + convertGroup(rest);
    }
  } else {
    result = convertGroup(intPart);
  }

  return `${result} ${decPart.toString().padStart(2, "0")}/100`;
}

/**
 * GET /api/finance/proforma/[id]/pdf
 * Zwraca proformę rezerwacji w HTML (do druku / Zapisz jako PDF).
 * Layout identyczny jak faktura VAT: pełna tabela, podsumowanie VAT, forma płatności, kwota słownie.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id?.trim()) {
    return new NextResponse("Brak ID proformy", { status: 400 });
  }
  const url = new URL(request.url);
  const variant = url.searchParams.get("variant"); // "original" = tylko oryginał (dla email), "copy" = tylko kopia

  try {
    const html = await generateProformaHtml(id.trim(), variant);
    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="proforma-${id.trim().replace(/\//g, "-")}.html"`,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "NOT_FOUND") {
      return new NextResponse("Proforma nie istnieje", { status: 404 });
    }
    console.error("[proforma-pdf]", e);
    return new NextResponse("Błąd generowania proformy", { status: 500 });
  }
}

async function generateProformaHtml(id: string, variant: string | null): Promise<string> {
  const proforma = await prisma.proforma.findUnique({
    where: { id },
    include: {
      reservation: {
        include: {
          company: true,
          guest: { select: { name: true } },
        },
      },
    },
  });

  if (!proforma) {
    throw new Error("NOT_FOUND");
  }

  let template = await prisma.invoiceTemplate.findUnique({
    where: { templateType: "DEFAULT" },
  });

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

  // Oblicz netto i VAT z kwoty brutto (Proforma ma tylko amount)
  const gross = Number(proforma.amount);
  const vatRate = DEFAULT_VAT_RATE;
  const net = Math.round((gross / (1 + vatRate / 100)) * 100) / 100;
  const vat = Math.round((gross - net) * 100) / 100;

  const issueDate = new Date(proforma.issuedAt).toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  // Data dostawy (checkOut rezerwacji lub data wystawienia)
  const reservation = proforma.reservation;
  const deliveryDate = reservation?.checkOut
    ? new Date(reservation.checkOut).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" })
    : issueDate;

  const company = reservation?.company;
  const buyerName = company?.name ?? reservation?.guest?.name ?? "—";
  const buyerNip = company?.nip?.trim() ?? "";
  const buyerAddress = company?.address ?? null;
  const buyerPostalCode = company?.postalCode ?? null;
  const buyerCity = company?.city ?? null;

  const roomLabel = (template.roomProductName?.trim() || "Nocleg") as string;
  const defaultUnit = template.defaultUnit || "szt.";

  // Forma płatności
  const paymentMethodNames: Record<string, string> = {
    CASH: "Gotówka",
    TRANSFER: "Przelew",
    PRZELEW: "Przelew",
    GOTÓWKA: "Gotówka",
    GOTOWKA: "Gotówka",
    KARTA: "Karta płatnicza",
    CARD: "Karta płatnicza",
    BLIK: "BLIK",
    VOUCHER: "Voucher",
    PREPAID: "Przedpłata",
    PRZEDPŁATA: "Przedpłata",
    SPLIT: "Płatność mieszana",
    OTHER: "Inna",
  };
  const rawPaymentMethod = template.defaultPaymentMethod || "TRANSFER";
  const paymentMethod = paymentMethodNames[rawPaymentMethod.toUpperCase()] || rawPaymentMethod;
  const paymentDays = template.defaultPaymentDays ?? 14;
  const dueDate = new Date(proforma.issuedAt);
  dueDate.setDate(dueDate.getDate() + paymentDays);
  const dueDateStr = dueDate.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });

  // Jedna pozycja (proforma to z reguły zryczałtowana kwota)
  const lineItems = [
    {
      name: "Usługa hotelowa",
      pkwiu: "55.10.10.0",
      unit: defaultUnit,
      quantity: 1,
      unitPrice: net,
      discount: 0,
      netAmount: net,
      vatRate,
      vatAmount: vat,
      grossAmount: gross,
    },
  ];

  // Dane sprzedawcy
  const sellerLines: string[] = [
    template.sellerName || HOTEL_NAME,
    ...(template.sellerAddress ? [template.sellerAddress] : []),
    ...(template.sellerPostalCode || template.sellerCity
      ? [[template.sellerPostalCode, template.sellerCity].filter(Boolean).join(" ")]
      : []),
    ...(template.sellerNip ? [`NIP: ${template.sellerNip}`] : []),
    ...(template.sellerPhone ? [`Tel: ${template.sellerPhone}`] : []),
    ...(template.sellerEmail ? [`e-mail: ${template.sellerEmail}`] : []),
  ].filter(Boolean);
  const sellerHtml = sellerLines.map((l) => `<p class="mb-0">${escapeHtml(l)}</p>`).join("");

  // Dane bankowe
  let bankLine = "";
  if (template.sellerBankName) {
    bankLine += template.sellerBankName;
  }
  if (template.sellerBankAccount) {
    bankLine += (bankLine ? "\n" : "") + template.sellerBankAccount;
  }

  // Dane nabywcy
  const buyerLines: string[] = [
    buyerName,
    ...(buyerAddress ? [buyerAddress] : []),
    ...(buyerPostalCode || buyerCity
      ? [[buyerPostalCode, buyerCity].filter(Boolean).join(" ")]
      : []),
    buyerNip ? `NIP: ${buyerNip}` : "",
  ].filter(Boolean);
  const buyerHtml = buyerLines.map((l) => `<p class="mb-0">${escapeHtml(l)}</p>`).join("");

  // Logo
  let logoHtml = "";
  if (template.logoBase64 || template.logoUrl) {
    const logoSrc = template.logoBase64
      ? `data:image/png;base64,${template.logoBase64}`
      : template.logoUrl;
    const logoAlign = template.logoPosition === "center" ? "center" :
      template.logoPosition === "right" ? "right" : "left";
    logoHtml = `
      <div style="text-align: ${logoAlign}; margin-bottom: 1rem;">
        <img src="${logoSrc}" alt="Logo" style="max-width: ${template.logoWidth ?? 200}px; height: auto;" />
      </div>
    `;
  }

  const placeOfIssue = template.placeOfIssue || template.sellerCity || "";
  const issuedByName = template.issuedByName || "";

  const showPkwiu = template.showPkwiu ?? false;
  const showUnit = template.showUnit ?? true;
  const showDiscount = template.showDiscount ?? false;

  const tableHeaders: string[] = ["Lp.", "Nazwa towaru/usługi (SWW/KU)"];
  if (showPkwiu) tableHeaders.push("PKWIU");
  tableHeaders.push("Ilość");
  if (showUnit) tableHeaders.push("j.m.");
  tableHeaders.push("Cena netto");
  if (showDiscount) tableHeaders.push("Rabat (%)");
  tableHeaders.push("Wartość netto");
  tableHeaders.push("VAT (%)");
  tableHeaders.push("Wartość VAT");
  tableHeaders.push("Wartość brutto");

  const tableRows = lineItems.map((item, idx) => {
    const cells: string[] = [
      `${idx + 1}`,
      escapeHtml(item.name),
    ];
    if (showPkwiu) cells.push(escapeHtml(item.pkwiu));
    cells.push(item.quantity.toString());
    if (showUnit) cells.push(escapeHtml(item.unit));
    cells.push(item.unitPrice.toFixed(2));
    if (showDiscount) cells.push(item.discount.toString());
    cells.push(item.netAmount.toFixed(2));
    cells.push(item.vatRate.toString());
    cells.push(item.vatAmount.toFixed(2));
    cells.push(item.grossAmount.toFixed(2));
    return cells;
  });

  // Podsumowanie VAT – agreguj po pozycjach (tak jak widok ekranowy)
  const byVat: Record<string, { net: number; vat: number; gross: number }> = {};
  for (const li of lineItems) {
    const k = li.vatRate === 0 ? "zw." : String(li.vatRate);
    if (!byVat[k]) byVat[k] = { net: 0, vat: 0, gross: 0 };
    byVat[k].net += li.netAmount;
    byVat[k].vat += li.vatAmount;
    byVat[k].gross += li.grossAmount;
  }
  let vatSummary = Object.entries(byVat).map(([rate, vals]) => ({
    rate: rate === "zw." ? 0 : Number(rate),
    net: Math.round(vals.net * 100) / 100,
    vat: Math.round(vals.vat * 100) / 100,
    gross: Math.round(vals.gross * 100) / 100,
  }));
  if (vatSummary.length === 0) {
    vatSummary = [{ rate: vatRate, net, vat, gross }];
  }

  const datesTopHtml = `${placeOfIssue ? `<p class="mb-0"><strong>Miejsce wystawienia:</strong> ${escapeHtml(placeOfIssue)}</p>` : ""}
      <p class="mb-0"><strong>Data dostawy/wykonania usługi:</strong> ${escapeHtml(deliveryDate)}</p>
      <p class="mb-0"><strong>Data wystawienia:</strong> ${escapeHtml(issueDate)}</p>`;

  const headerHtml = template.headerText
    ? `<div class="header-text">${escapeHtml(template.headerText).replace(/\n/g, "<br>")}</div>`
    : "";
  const footerHtml = template.footerText
    ? `<div class="footer-text">${escapeHtml(template.footerText).replace(/\n/g, "<br>")}</div>`
    : "";
  const thanksHtml = template.thanksText
    ? `<p class="thanks-text">${escapeHtml(template.thanksText)}</p>`
    : "";

  const fontFamily = template.fontFamily ?? "system-ui, sans-serif";
  const fontSize = template.fontSize ?? 14;
  const primaryColor = template.primaryColor ?? "#111111";

  const html = `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="utf-8" />
  <title>Proforma ${escapeHtml(proforma.number)}</title>
  <style>
    * { box-sizing: border-box; }
    body { 
      font-family: ${fontFamily}; 
      max-width: 900px; 
      margin: 1rem auto; 
      padding: 1rem; 
      color: ${primaryColor}; 
      font-size: ${fontSize - 2}px;
      line-height: 1.4;
    }
    h1 { 
      font-size: 1.3rem; 
      margin: 0.5rem 0 1rem;
      text-align: center;
    }
    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1rem;
      font-size: 0.85rem;
    }
    .seller-top {
      font-size: 0.8rem;
      line-height: 1.3;
    }
    .dates-top {
      text-align: right;
      font-size: 0.85rem;
    }
    table { width: 100%; border-collapse: collapse; margin: 0.75rem 0; font-size: 0.8rem; }
    th, td { border: 1px solid #333; padding: 0.35rem 0.5rem; text-align: left; }
    th { background: #f5f5f5; font-weight: 600; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .mt-1 { margin-top: 0.5rem; }
    .mt-2 { margin-top: 1rem; }
    .mb-0 { margin-bottom: 0; }
    .mb-1 { margin-bottom: 0.5rem; }
    .parties { 
      display: flex; 
      gap: 1rem; 
      margin: 1rem 0;
      font-size: 0.85rem;
    }
    .parties > div { flex: 1; }
    .party-box {
      border: 1px solid #ccc;
      padding: 0.5rem;
      min-height: 80px;
    }
    .party-label { 
      font-weight: 600; 
      margin-bottom: 0.25rem;
      font-size: 0.75rem;
      color: #666;
    }
    .vat-summary {
      width: auto;
      margin-left: auto;
      margin-right: 0;
      font-size: 0.8rem;
    }
    .vat-summary th, .vat-summary td {
      padding: 0.25rem 0.5rem;
    }
    .payment-box {
      display: flex;
      gap: 2rem;
      margin: 1rem 0;
      font-size: 0.85rem;
    }
    .payment-box > div {
      border: 1px solid #ccc;
      padding: 0.5rem 0.75rem;
    }
    .amount-words {
      font-size: 0.8rem;
      margin: 0.5rem 0;
    }
    .signatures {
      display: flex;
      justify-content: space-between;
      margin-top: 3rem;
      font-size: 0.75rem;
    }
    .signature-box {
      text-align: center;
      width: 200px;
    }
    .signature-line {
      border-top: 1px solid #333;
      margin-top: 2rem;
      padding-top: 0.25rem;
    }
    .header-text { background: #f5f5f5; padding: 0.5rem; font-size: 0.8rem; margin-bottom: 0.5rem; }
    .footer-text { border-top: 1px solid #ddd; padding-top: 0.5rem; font-size: 0.75rem; color: #666; margin-top: 1rem; }
    .thanks-text { font-style: italic; font-size: 0.8rem; }
    .invoice-page-copy { page-break-before: always; }
    @media print { 
      body { margin: 0; padding: 0.5rem; font-size: 11px; } 
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header-row">
    <div class="seller-top">
      ${logoHtml}
      ${sellerHtml}
      ${bankLine ? `<p class="mb-0" style="margin-top: 0.25rem;">${escapeHtml(bankLine).replace(/\n/g, "<br>")}</p>` : ""}
    </div>
    <div class="dates-top">${datesTopHtml}</div>
  </div>

  <h1>Proforma ${escapeHtml(proforma.number)} oryginał</h1>
  ${headerHtml}

  <div class="parties">
    <div>
      <div class="party-label">Sprzedawca</div>
      <div class="party-box">
        ${sellerHtml}
      </div>
    </div>
    <div>
      <div class="party-label">Nabywca</div>
      <div class="party-box">
        ${buyerHtml}
      </div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        ${tableHeaders.map(h => `<th class="${h === "Lp." ? "text-center" : h.includes("Wartość") || h.includes("Cena") || h.includes("VAT") || h.includes("Ilość") || h.includes("Rabat") ? "text-right" : ""}">${escapeHtml(h)}</th>`).join("")}
      </tr>
    </thead>
    <tbody>
      ${tableRows.map(row => `
      <tr>
        ${row.map((cell, i) => `<td class="${i === 0 ? "text-center" : i >= 3 ? "text-right" : ""}">${cell}</td>`).join("")}
      </tr>`).join("")}
    </tbody>
  </table>

  <table class="vat-summary">
    <thead>
      <tr>
        <th>Stawka VAT</th>
        <th class="text-right">Wartość netto</th>
        <th class="text-right">Wartość VAT</th>
        <th class="text-right">Wartość brutto</th>
      </tr>
    </thead>
    <tbody>
      ${vatSummary.map(v => `
      <tr>
        <td class="text-center">${v.rate},00</td>
        <td class="text-right">${v.net.toFixed(2)}</td>
        <td class="text-right">${v.vat.toFixed(2)}</td>
        <td class="text-right">${v.gross.toFixed(2)}</td>
      </tr>`).join("")}
      <tr style="font-weight: 600;">
        <td>Suma:</td>
        <td class="text-right">${net.toFixed(2)}</td>
        <td class="text-right">${vat.toFixed(2)}</td>
        <td class="text-right">${gross.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>

  <div class="payment-box">
    <div>
      <strong>Forma płatności:</strong><br>
      ${["CASH", "CARD", "BLIK", "VOUCHER", "PREPAID"].includes(rawPaymentMethod.toUpperCase())
        ? `${escapeHtml(paymentMethod)} – zapłacono`
        : `${escapeHtml(paymentMethod)} w terminie ${paymentDays} dni = ${escapeHtml(dueDateStr)}`}
    </div>
  </div>

  <div class="amount-words">
    <strong>Słownie zł:</strong> ${amountToWords(gross)}
  </div>

  ${footerHtml}
  ${thanksHtml}

  <div class="signatures">
    <div class="signature-box">
      <div>${issuedByName ? escapeHtml(issuedByName) : "&nbsp;"}</div>
      <div class="signature-line">Osoba upoważniona do wystawienia</div>
    </div>
    <div class="signature-box">
      <div>&nbsp;</div>
      <div class="signature-line">Osoba upoważniona do odbioru</div>
    </div>
  </div>

  <p class="mt-2 no-print" style="font-size: 0.7rem; color: #999;">
    Dokument wygenerowany z systemu Hotel PMS. Do druku: użyj „Drukuj" → „Zapisz jako PDF".
  </p>
</body>
</html>`;

  // Warianty: original = tylko oryginał (email), copy = tylko kopia, brak = oryginał + kopia
  if (variant === "original") return html;
  const noPrintIdx = html.indexOf('  <p class="mt-2 no-print"');
  const bodyContent = html.substring(html.indexOf('  <div class="header-row">'), noPrintIdx);
  const kopiaContent = bodyContent.replace("oryginał</h1>", "kopia</h1>");
  if (variant === "copy") {
    const beforeBody = html.substring(0, html.indexOf('  <div class="header-row">'));
    const afterBody = html.substring(noPrintIdx);
    return beforeBody + kopiaContent + "\n  " + afterBody;
  }
  return html.substring(0, noPrintIdx) + '\n  <div class="invoice-page-copy">\n' + kopiaContent + '  </div>\n  ' + html.substring(noPrintIdx);
}
