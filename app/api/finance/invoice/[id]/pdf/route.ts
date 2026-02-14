import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveKsefEnv } from "@/lib/ksef/env";

const HOTEL_NAME = process.env.HOTEL_NAME ?? "Hotel";

/** Maks. czas generowania PDF (ms) – przy bardzo dużej ilości pozycji unikamy zawieszenia. */
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
 * Używa konfigurowalnego szablonu z bazy danych.
 * Przy bardzo dużej ilości pozycji (100+) może wystąpić timeout – zwraca 503.
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

    const date = new Date(invoice.issuedAt).toLocaleDateString("pl-PL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const net = Number(invoice.amountNet);
    const vat = Number(invoice.amountVat);
    const gross = Number(invoice.amountGross);
    const vatRate = Number(invoice.vatRate);

    // Dane sprzedawcy z szablonu lub fallback
    const sellerName = template.sellerName || HOTEL_NAME;
    const sellerLines: string[] = [
      sellerName,
      ...(template.sellerNip ? [`NIP: ${template.sellerNip}`] : []),
      ...(template.sellerAddress ? [template.sellerAddress] : []),
      ...(template.sellerPostalCode || template.sellerCity
        ? [[template.sellerPostalCode, template.sellerCity].filter(Boolean).join(" ")]
        : []),
      ...(template.sellerPhone ? [`Tel: ${template.sellerPhone}`] : []),
      ...(template.sellerEmail ? [`Email: ${template.sellerEmail}`] : []),
    ].filter(Boolean);
    const sellerHtml = sellerLines.map((l) => `<p class="mb-0">${escapeHtml(l)}</p>`).join("");

    // Dane nabywcy
    const buyerLines: string[] = [
      invoice.buyerName,
      `NIP: ${invoice.buyerNip}`,
      ...(invoice.buyerAddress ? [invoice.buyerAddress] : []),
      ...(invoice.buyerPostalCode || invoice.buyerCity
        ? [[invoice.buyerPostalCode, invoice.buyerCity].filter(Boolean).join(" ")]
        : []),
    ].filter(Boolean);
    const buyerHtml = buyerLines.map((l) => `<p class="mb-0">${escapeHtml(l)}</p>`).join("");

    // Logo HTML – gdy brak logo: pusty placeholder (spójny układ strony)
    let logoHtml: string;
    if (template.logoBase64 || template.logoUrl) {
      const logoSrc = template.logoBase64 
        ? `data:image/png;base64,${template.logoBase64}`
        : template.logoUrl;
      const logoAlign = template.logoPosition === "center" ? "center" : 
                        template.logoPosition === "right" ? "right" : "left";
      logoHtml = `
        <div style="text-align: ${logoAlign}; margin-bottom: 1.5rem;">
          <img src="${logoSrc}" alt="Logo" style="max-width: ${template.logoWidth}px; height: auto;" />
        </div>
      `;
    } else {
      logoHtml = `<div class="logo-placeholder" style="min-height: 48px; margin-bottom: 1.5rem; border: 1px dashed #ddd; border-radius: 4px; background: #fafafa; color: #999; font-size: 0.75rem; display: flex; align-items: center; justify-content: center;">Brak logo</div>`;
    }

    // Dane bankowe
    let bankHtml = "";
    if (template.sellerBankName || template.sellerBankAccount) {
      bankHtml = `
        <div class="bank-info mt-2">
          <strong>Dane do przelewu:</strong>
          ${template.sellerBankName ? `<p class="mb-0">${escapeHtml(template.sellerBankName)}</p>` : ""}
          ${template.sellerBankAccount ? `<p class="mb-0">Nr konta: ${escapeHtml(template.sellerBankAccount)}</p>` : ""}
        </div>
      `;
    }

    // Nagłówek i stopka z szablonu
    const headerHtml = template.headerText 
      ? `<div class="header-text mt-2 mb-2">${escapeHtml(template.headerText).replace(/\n/g, "<br>")}</div>` 
      : "";
    const footerHtml = template.footerText 
      ? `<div class="footer-text mt-2">${escapeHtml(template.footerText).replace(/\n/g, "<br>")}</div>` 
      : "";
    const thanksHtml = template.thanksText 
      ? `<p class="thanks-text mt-2">${escapeHtml(template.thanksText)}</p>` 
      : "";
    const paymentTermsHtml = template.paymentTermsText 
      ? `<div class="payment-terms mt-2"><strong>Warunki płatności:</strong><br>${escapeHtml(template.paymentTermsText).replace(/\n/g, "<br>")}</div>` 
      : "";

    const ksefUuid = invoice.ksefUuid?.trim();
    const ksefVerifyUrl = ksefUuid
      ? (getEffectiveKsefEnv() === "test"
          ? "https://ksef-test.mf.gov.pl"
          : "https://ksef.mf.gov.pl") + `/web/verify/${encodeURIComponent(ksefUuid)}`
      : "";
    const ksefQrHtml =
      ksefVerifyUrl
        ? `<div class="ksef-qr mt-2" style="margin-top: 1rem; padding: 0.5rem; border: 1px solid #eee; border-radius: 4px; display: inline-block;">
          <p class="mb-0 text-muted" style="font-size: 0.75rem; margin-bottom: 0.25rem;">Link weryfikacyjny KSeF</p>
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(ksefVerifyUrl)}" alt="QR KSeF" width="80" height="80" />
        </div>`
        : "";

    const html = `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="utf-8" />
  <title>Faktura VAT ${escapeHtml(invoice.number)}</title>
  <style>
    body { 
      font-family: ${template.fontFamily}; 
      max-width: 800px; 
      margin: 2rem auto; 
      padding: 1rem; 
      color: ${template.primaryColor}; 
      font-size: ${template.fontSize}px;
      line-height: 1.5;
    }
    h1 { 
      font-size: 1.5rem; 
      margin-bottom: 1.5rem; 
      color: ${template.accentColor};
      border-bottom: 2px solid ${template.accentColor};
      padding-bottom: 0.5rem;
    }
    table { width: 100%; border-collapse: collapse; margin: 1.5rem 0; }
    th, td { border: 1px solid #ccc; padding: 0.5rem 0.75rem; text-align: left; }
    th { background: ${template.accentColor}15; font-weight: 600; color: ${template.accentColor}; }
    .text-right { text-align: right; }
    .mt-2 { margin-top: 1rem; }
    .mb-0 { margin-bottom: 0; }
    .mb-2 { margin-bottom: 1rem; }
    .text-muted { color: #666; font-size: 0.875rem; }
    .parties { display: flex; justify-content: space-between; gap: 2rem; margin: 1.5rem 0; }
    .parties > div { flex: 1; }
    .party-label { font-weight: 600; margin-bottom: 0.5rem; color: ${template.accentColor}; border-bottom: 1px solid #ddd; padding-bottom: 0.25rem; }
    .total-box { 
      background: ${template.accentColor}10; 
      padding: 1rem; 
      border-radius: 4px; 
      border-left: 4px solid ${template.accentColor};
      margin: 1rem 0;
    }
    .total-amount { font-size: 1.25rem; font-weight: 700; color: ${template.accentColor}; }
    .bank-info { background: #f9f9f9; padding: 0.75rem; border-radius: 4px; font-size: 0.9rem; }
    .header-text { background: #f5f5f5; padding: 0.75rem; border-radius: 4px; font-size: 0.9rem; }
    .footer-text { border-top: 1px solid #ddd; padding-top: 1rem; font-size: 0.85rem; color: #666; }
    .thanks-text { font-style: italic; color: ${template.accentColor}; }
    .payment-terms { font-size: 0.85rem; color: #666; }
    .document-info { display: flex; justify-content: space-between; align-items: flex-start; }
    .document-info > div { }
    @media print { 
      body { margin: 0; padding: 0.5rem; } 
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  ${logoHtml}
  
  <h1>Faktura VAT</h1>
  
  <div class="document-info">
    <div>
      <p><strong>Numer:</strong> ${escapeHtml(invoice.number)}</p>
      <p><strong>Data wystawienia:</strong> ${escapeHtml(date)}</p>
      ${ksefUuid ? `<p><strong>Numer KSeF:</strong> ${escapeHtml(ksefUuid)}</p>` : ""}
    </div>
  </div>

  ${headerHtml}

  <div class="parties">
    <div>
      <div class="party-label">Sprzedawca:</div>
      ${sellerHtml}
    </div>
    <div>
      <div class="party-label">Nabywca:</div>
      ${buyerHtml}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Lp</th>
        <th>Nazwa</th>
        <th class="text-right">Netto (PLN)</th>
        <th class="text-right">VAT ${vatRate}%</th>
        <th class="text-right">Brutto (PLN)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>1</td>
        <td>Usługa hotelowa</td>
        <td class="text-right">${net.toFixed(2)}</td>
        <td class="text-right">${vat.toFixed(2)}</td>
        <td class="text-right">${gross.toFixed(2)}</td>
      </tr>
    </tbody>
  </table>

  <div class="total-box">
    <p class="mb-0">Razem do zapłaty:</p>
    <p class="total-amount mb-0">${gross.toFixed(2)} PLN</p>
    <p class="text-muted mb-0">Słownie: ${amountToWords(gross)} PLN</p>
  </div>

  ${bankHtml}
  ${paymentTermsHtml}
  ${footerHtml}
  ${thanksHtml}
  ${ksefQrHtml}

  <p class="mt-2 text-muted no-print" style="font-size: 0.75rem;">
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

/**
 * Konwertuje kwotę na słowną reprezentację (uproszczona wersja dla polskiego).
 */
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
  
  // Tysiące
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
