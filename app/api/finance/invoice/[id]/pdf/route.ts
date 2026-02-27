import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveKsefEnv } from "@/lib/ksef/env";

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

/**
 * GET /api/finance/invoice/[id]/pdf
 * Zwraca fakturę VAT w HTML (do druku / Zapisz jako PDF).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id?.trim()) {
    return new NextResponse("Brak ID faktury", { status: 400 });
  }

  try {
    const html = await withTimeout(
      generateInvoiceHtml(id.trim()),
      PDF_GENERATION_TIMEOUT_MS,
      "Timeout generowania PDF faktury (zbyt duża ilość danych). Spróbuj ponownie lub skróć zakres."
    );
    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="faktura-vat-${id.trim().replace(/\//g, "-")}.html"`,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "NOT_FOUND") {
      return new NextResponse("Faktura nie istnieje", { status: 404 });
    }
    if (msg.includes("Timeout")) {
      return new NextResponse("Timeout generowania faktury – zbyt duża ilość pozycji. Spróbuj ponownie.", { status: 503 });
    }
    console.error("[invoice-pdf]", e);
    return new NextResponse("Błąd generowania faktury", { status: 500 });
  }
}

async function generateInvoiceHtml(id: string): Promise<string> {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
  });

  if (!invoice) {
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

  // Pobierz transakcje rezerwacji
  const transactions = invoice.reservationId
    ? await prisma.transaction.findMany({
        where: {
          reservationId: invoice.reservationId,
          status: "ACTIVE",
          type: { notIn: ["PAYMENT", "DEPOSIT", "VOID", "REFUND", "DISCOUNT"] },
          amount: { gt: 0 },
        },
        orderBy: { createdAt: "asc" },
      })
    : [];

  const issueDate = new Date(invoice.issuedAt).toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  
  // Data dostawy (jeśli nie ustawiona, użyj daty wystawienia)
  const deliveryDate = invoice.deliveryDate 
    ? new Date(invoice.deliveryDate).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" })
    : issueDate;

  const net = Number(invoice.amountNet);
  const vat = Number(invoice.amountVat);
  const gross = Number(invoice.amountGross);
  const vatRate = Number(invoice.vatRate);

  // Termin płatności
  const paymentMethod = invoice.paymentMethod || template.defaultPaymentMethod || "przelew";
  const paymentDays = invoice.paymentDays ?? template.defaultPaymentDays ?? 14;
  let dueDateStr = "";
  if (invoice.paymentDueDate) {
    dueDateStr = new Date(invoice.paymentDueDate).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });
  } else {
    const dueDate = new Date(invoice.issuedAt);
    dueDate.setDate(dueDate.getDate() + paymentDays);
    dueDateStr = dueDate.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  // Buduj pozycje faktury
  const roomLabel = (template.roomProductName?.trim() || "Nocleg") as string;
  const defaultUnit = template.defaultUnit || "szt.";
  const TYPE_LABELS: Record<string, string> = {
    ROOM: roomLabel,
    LOCAL_TAX: "Opłata miejscowa",
    MINIBAR: "Minibar",
    GASTRONOMY: "Gastronomia",
    RESTAURANT: "Restauracja",
    POSTING: "Restauracja",
    SPA: "SPA / Wellness",
    PARKING: "Parking",
    LAUNDRY: "Pralnia",
    PHONE: "Telefon",
    TRANSPORT: "Transfer",
    ATTRACTION: "Atrakcje",
    RENTAL: "Wypożyczalnia",
    OTHER: "Usługa dodatkowa",
  };

  type InvoiceLine = {
    name: string;
    pkwiu: string;
    unit: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    netAmount: number;
    vatRate: number;
    vatAmount: number;
    grossAmount: number;
  };
  const lineItems: InvoiceLine[] = [];

  if (transactions.length > 0) {
    const grouped = new Map<string, { name: string; total: number }>();
    for (const tx of transactions) {
      const txType = tx.type;
      const isRestaurant = txType === "GASTRONOMY" || txType === "RESTAURANT" || txType === "POSTING";
      const label = isRestaurant && tx.description
        ? tx.description.split(" | ")[0] || TYPE_LABELS[txType] || txType
        : TYPE_LABELS[txType] || txType;
      const key = isRestaurant ? `restaurant-${tx.id}` : txType;
      const existing = grouped.get(key);
      if (existing) {
        existing.total += Number(tx.amount);
      } else {
        grouped.set(key, { name: label, total: Number(tx.amount) });
      }
    }

    for (const [, { name, total }] of grouped) {
      const lineGross = Math.round(total * 100) / 100;
      const lineNet = Math.round((lineGross / (1 + vatRate / 100)) * 100) / 100;
      const lineVat = Math.round((lineGross - lineNet) * 100) / 100;
      lineItems.push({
        name,
        pkwiu: "55.10.10.0",
        unit: defaultUnit,
        quantity: 1,
        unitPrice: lineNet,
        discount: 0,
        netAmount: lineNet,
        vatRate: vatRate,
        vatAmount: lineVat,
        grossAmount: lineGross,
      });
    }
  }

  if (lineItems.length === 0) {
    lineItems.push({
      name: "Usługa hotelowa",
      pkwiu: "55.10.10.0",
      unit: defaultUnit,
      quantity: 1,
      unitPrice: net,
      discount: 0,
      netAmount: net,
      vatRate: vatRate,
      vatAmount: vat,
      grossAmount: gross,
    });
  }

  // Dane sprzedawcy
  const sellerName = template.sellerName || HOTEL_NAME;
  const sellerLines: string[] = [
    sellerName,
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
    invoice.buyerName,
    ...(invoice.buyerAddress ? [invoice.buyerAddress] : []),
    ...(invoice.buyerPostalCode || invoice.buyerCity
      ? [[invoice.buyerPostalCode, invoice.buyerCity].filter(Boolean).join(" ")]
      : []),
    `NIP: ${invoice.buyerNip}`,
  ].filter(Boolean);
  const buyerHtml = buyerLines.map((l) => `<p class="mb-0">${escapeHtml(l)}</p>`).join("");

  // Dane odbiorcy (jeśli jest)
  let receiverHtml = "";
  if (invoice.receiverName) {
    const receiverLines: string[] = [
      invoice.receiverName,
      ...(invoice.receiverAddress ? [invoice.receiverAddress] : []),
      ...(invoice.receiverPostalCode || invoice.receiverCity
        ? [[invoice.receiverPostalCode, invoice.receiverCity].filter(Boolean).join(" ")]
        : []),
    ].filter(Boolean);
    receiverHtml = receiverLines.map((l) => `<p class="mb-0">${escapeHtml(l)}</p>`).join("");
  }

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
        <img src="${logoSrc}" alt="Logo" style="max-width: ${template.logoWidth}px; height: auto;" />
      </div>
    `;
  }

  // Miejsce wystawienia i podpisy
  const placeOfIssue = invoice.placeOfIssue || template.placeOfIssue || template.sellerCity || "";
  const issuedByName = invoice.issuedByName || template.issuedByName || "";
  const receivedByName = invoice.receivedByName || "";

  // Ustawienia kolumn
  const showPkwiu = template.showPkwiu ?? false;
  const showUnit = template.showUnit ?? true;
  const showDiscount = template.showDiscount ?? false;

  // Nagłówki tabeli
  const tableHeaders: string[] = ["Lp.", "Nazwa towaru/usługi (SWW/KU)"];
  if (showPkwiu) tableHeaders.push("PKWIU");
  tableHeaders.push("Ilość");
  if (showUnit) tableHeaders.push("j.m.");
  tableHeaders.push("Cena netto");
  if (showDiscount) tableHeaders.push("Rabat (%)");
  tableHeaders.push("Wartość netto");
  tableHeaders.push(`VAT (%)`);
  tableHeaders.push("Wartość VAT");
  tableHeaders.push("Wartość brutto");

  // Wiersze tabeli
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

  // Podsumowanie VAT
  const vatSummary = [{ rate: vatRate, net: net, vat: vat, gross: gross }];

  const headerHtml = template.headerText
    ? `<div class="header-text">${escapeHtml(template.headerText).replace(/\n/g, "<br>")}</div>`
    : "";
  const footerHtml = template.footerText
    ? `<div class="footer-text">${escapeHtml(template.footerText).replace(/\n/g, "<br>")}</div>`
    : "";
  const thanksHtml = template.thanksText
    ? `<p class="thanks-text">${escapeHtml(template.thanksText)}</p>`
    : "";

  // KSeF
  const ksefUuid = invoice.ksefUuid?.trim();
  const ksefVerifyUrl = ksefUuid
    ? (getEffectiveKsefEnv() === "test"
        ? "https://ksef-test.mf.gov.pl"
        : "https://ksef.mf.gov.pl") + `/web/verify/${encodeURIComponent(ksefUuid)}`
    : "";

  const html = `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="utf-8" />
  <title>Faktura VAT ${escapeHtml(invoice.number)}</title>
  <style>
    * { box-sizing: border-box; }
    body { 
      font-family: ${template.fontFamily}; 
      max-width: 900px; 
      margin: 1rem auto; 
      padding: 1rem; 
      color: ${template.primaryColor}; 
      font-size: ${template.fontSize - 2}px;
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
    .bank-info { font-size: 0.8rem; margin-top: 0.5rem; }
    .ksef-qr { margin-top: 1rem; padding: 0.5rem; border: 1px solid #eee; border-radius: 4px; display: inline-block; }
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
    <div class="dates-top">
      ${placeOfIssue ? `<p class="mb-0"><strong>Miejsce wystawienia:</strong> ${escapeHtml(placeOfIssue)}</p>` : ""}
      <p class="mb-0"><strong>Data dostawy/wykonania usługi:</strong> ${escapeHtml(deliveryDate)}</p>
      <p class="mb-0"><strong>Data wystawienia:</strong> ${escapeHtml(issueDate)}</p>
    </div>
  </div>

  <h1>Faktura Vat ${escapeHtml(invoice.number)} oryginał</h1>

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
    ${receiverHtml ? `
    <div>
      <div class="party-label">Odbiorca</div>
      <div class="party-box">
        ${receiverHtml}
      </div>
    </div>
    ` : ""}
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
      <strong>Do zapłaty:</strong><br>
      <span style="font-size: 1.1rem; font-weight: 600;">${gross.toFixed(2)} zł</span>
    </div>
    <div>
      <strong>Forma płatności:</strong><br>
      ${escapeHtml(paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1))} w terminie ${paymentDays} dni = ${escapeHtml(dueDateStr)}
    </div>
  </div>

  <div class="amount-words">
    <strong>Słownie zł:</strong> ${amountToWords(gross)}
  </div>

  ${footerHtml}
  ${thanksHtml}

  ${ksefVerifyUrl ? `
  <div class="ksef-qr">
    <p class="mb-0" style="font-size: 0.75rem; margin-bottom: 0.25rem;">Link weryfikacyjny KSeF</p>
    <img src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(ksefVerifyUrl)}" alt="QR KSeF" width="80" height="80" />
    ${ksefUuid ? `<p class="mb-0" style="font-size: 0.7rem; margin-top: 0.25rem;">Nr KSeF: ${escapeHtml(ksefUuid)}</p>` : ""}
  </div>
  ` : ""}

  <div class="signatures">
    <div class="signature-box">
      <div>${issuedByName ? escapeHtml(issuedByName) : "&nbsp;"}</div>
      <div class="signature-line">Osoba upoważniona do wystawienia</div>
    </div>
    <div class="signature-box">
      <div>${receivedByName ? escapeHtml(receivedByName) : "&nbsp;"}</div>
      <div class="signature-line">Osoba upoważniona do odbioru</div>
    </div>
  </div>

  <p class="mt-2 no-print" style="font-size: 0.7rem; color: #999;">
    Dokument wygenerowany z systemu Hotel PMS. Do druku: użyj „Drukuj" → „Zapisz jako PDF".
  </p>
</body>
</html>`;
  return html;
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
