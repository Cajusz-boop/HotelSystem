import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveKsefEnv } from "@/lib/ksef/env";

const HOTEL_NAME = process.env.HOTEL_NAME ?? "Hotel";

/**
 * GET /api/finance/invoice/preview
 * Generuje podgląd faktury z przykładowymi danymi, używając aktualnego szablonu.
 * Służy do podglądu wyglądu szablonu przed zapisaniem.
 */
export async function GET() {
  try {
    // Pobierz szablon (lub utwórz domyślny)
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

    // Przykładowe dane faktury
    const today = new Date();
    const issueDate = today.toLocaleDateString("pl-PL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const deliveryDate = today.toLocaleDateString("pl-PL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const invoiceNumber = `FV/${today.getFullYear()}/00001`;
    const vatRate = 23;

    // Termin płatności
    const paymentDays = template.defaultPaymentDays ?? 14;
    const dueDate = new Date(today);
    dueDate.setDate(dueDate.getDate() + paymentDays);
    const dueDateStr = dueDate.toLocaleDateString("pl-PL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const paymentMethod = template.defaultPaymentMethod || "przelew";

    // Przykładowe pozycje z PKWIU, j.m., rabat
    const roomLabel = (template.roomProductName?.trim() || "Nocleg") as string;
    const defaultUnit = template.defaultUnit || "szt.";
    
    type LineItem = {
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
    
    const lineItems: LineItem[] = [
      { 
        name: "Spotkanie Kulturalno-Oświatowe", 
        pkwiu: "55.10.10.0", 
        unit: defaultUnit, 
        quantity: 1, 
        unitPrice: 22390.24,
        discount: 0,
        netAmount: 22390.24, 
        vatRate: 23,
        vatAmount: 5149.76, 
        grossAmount: 27540.00 
      },
    ];

    const net = lineItems.reduce((sum, item) => sum + item.netAmount, 0);
    const vat = lineItems.reduce((sum, item) => sum + item.vatAmount, 0);
    const gross = lineItems.reduce((sum, item) => sum + item.grossAmount, 0);

    // Przykładowy numer KSeF
    const ksefUuid = "1234567890-20240115-ABC123DEF456-01";
    const ksefVerifyUrl = (getEffectiveKsefEnv() === "test"
      ? "https://ksef-test.mf.gov.pl"
      : "https://ksef.mf.gov.pl") + `/web/verify/${encodeURIComponent(ksefUuid)}`;

    // Dane sprzedawcy z szablonu lub fallback
    const sellerName = template.sellerName || HOTEL_NAME;
    const sellerLines: string[] = [
      sellerName,
      ...(template.sellerAddress ? [template.sellerAddress] : ["ul. Przykładowa 1"]),
      ...(template.sellerPostalCode || template.sellerCity
        ? [[template.sellerPostalCode, template.sellerCity].filter(Boolean).join(" ")]
        : ["00-001 Warszawa"]),
      ...(template.sellerNip ? [`NIP: ${template.sellerNip}`] : ["NIP: 123-456-78-90"]),
      ...(template.sellerPhone ? [`Tel: ${template.sellerPhone}`] : []),
      ...(template.sellerEmail ? [`e-mail: ${template.sellerEmail}`] : []),
    ].filter(Boolean);
    const sellerHtml = sellerLines.map((l) => `<p class="mb-0">${escapeHtml(l)}</p>`).join("");

    // Dane bankowe jako część sprzedawcy
    let bankLine = "";
    if (template.sellerBankName) {
      bankLine += template.sellerBankName;
    }
    if (template.sellerBankAccount) {
      bankLine += (bankLine ? "\n" : "") + template.sellerBankAccount;
    }

    // Przykładowe dane nabywcy
    const buyerLines: string[] = [
      "GMINA MIEJSKA IŁAWA",
      "NIEPODLEGŁOŚCI 13",
      "14-200 IŁAWA",
      "NIP: 744-166-00-83",
    ];
    const buyerHtml = buyerLines.map((l) => `<p class="mb-0">${escapeHtml(l)}</p>`).join("");

    // Przykładowe dane odbiorcy (gdy inny niż nabywca)
    const receiverLines: string[] = [
      "Szkoła Podstawowa Nr 2 z Oddziałami Integracyjnymi",
      "im. Marii Konopnickiej w Iławie",
      "ul. Andersa 7, 14-200 Iława",
    ];
    const receiverHtml = receiverLines.map((l) => `<p class="mb-0">${escapeHtml(l)}</p>`).join("");

    // Logo HTML
    let logoHtml: string;
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
    } else {
      logoHtml = "";
    }

    // Miejsce wystawienia
    const placeOfIssue = template.placeOfIssue || template.sellerCity || "Warszawa";

    // Osoba wystawiająca
    const issuedByName = template.issuedByName || "Jan Kowalski";

    // Ustawienia kolumn
    const showPkwiu = template.showPkwiu ?? false;
    const showUnit = template.showUnit ?? true;
    const showDiscount = template.showDiscount ?? false;

    // Buduj nagłówki tabeli
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

    // Buduj wiersze tabeli
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

    // Podsumowanie VAT według stawek
    const vatSummary = [
      { rate: vatRate, net: net, vat: vat, gross: gross },
    ];

    const headerHtml = template.headerText
      ? `<div class="header-text">${escapeHtml(template.headerText).replace(/\n/g, "<br>")}</div>`
      : "";
    const footerHtml = template.footerText
      ? `<div class="footer-text">${escapeHtml(template.footerText).replace(/\n/g, "<br>")}</div>`
      : "";
    const thanksHtml = template.thanksText
      ? `<p class="thanks-text">${escapeHtml(template.thanksText)}</p>`
      : "";

    const html = `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="utf-8" />
  <title>Podgląd faktury - ${escapeHtml(invoiceNumber)}</title>
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
    .preview-banner {
      background: #fff3cd;
      border: 1px solid #ffc107;
      color: #856404;
      padding: 0.5rem;
      border-radius: 4px;
      margin-bottom: 1rem;
      font-size: 0.8rem;
      text-align: center;
    }
    .header-text { background: #f5f5f5; padding: 0.5rem; font-size: 0.8rem; margin-bottom: 0.5rem; }
    .footer-text { border-top: 1px solid #ddd; padding-top: 0.5rem; font-size: 0.75rem; color: #666; margin-top: 1rem; }
    .thanks-text { font-style: italic; font-size: 0.8rem; }
    .bank-info { font-size: 0.8rem; margin-top: 0.5rem; }
    @media print { 
      body { margin: 0; padding: 0.5rem; font-size: 11px; } 
      .no-print { display: none; }
      .preview-banner { display: none; }
    }
  </style>
</head>
<body>
  <div class="preview-banner no-print">
    ⚠️ To jest PODGLĄD szablonu z przykładowymi danymi. Nie jest to prawdziwa faktura.
  </div>

  <div class="header-row">
    <div class="seller-top">
      ${logoHtml}
      ${sellerHtml}
      ${bankLine ? `<p class="mb-0" style="margin-top: 0.25rem;">${escapeHtml(bankLine).replace(/\n/g, "<br>")}</p>` : ""}
    </div>
    <div class="dates-top">
      <p class="mb-0"><strong>Miejsce wystawienia:</strong> ${escapeHtml(placeOfIssue)}</p>
      <p class="mb-0"><strong>Data dostawy/wykonania usługi:</strong> ${escapeHtml(deliveryDate)}</p>
      <p class="mb-0"><strong>Data wystawienia:</strong> ${escapeHtml(issueDate)}</p>
    </div>
  </div>

  <h1>Faktura Vat ${escapeHtml(invoiceNumber)} oryginał</h1>

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
    <div>
      <div class="party-label">Odbiorca</div>
      <div class="party-box">
        ${receiverHtml}
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

  <div class="signatures">
    <div class="signature-box">
      <div>${escapeHtml(issuedByName)}</div>
      <div class="signature-line">Osoba upoważniona do wystawienia</div>
    </div>
    <div class="signature-box">
      <div>&nbsp;</div>
      <div class="signature-line">Osoba upoważniona do odbioru</div>
    </div>
  </div>

  <p class="mt-2 no-print" style="font-size: 0.7rem; color: #999;">
    Podgląd szablonu faktury. Do druku: użyj „Drukuj" → „Zapisz jako PDF".
  </p>
</body>
</html>`;

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch (e) {
    console.error("[invoice-preview]", e);
    return new NextResponse("Błąd generowania podglądu faktury", { status: 500 });
  }
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
