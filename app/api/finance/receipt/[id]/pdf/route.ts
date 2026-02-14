import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const HOTEL_NAME = process.env.HOTEL_NAME ?? "Hotel";

interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

/**
 * GET /api/finance/receipt/[id]/pdf
 * Zwraca rachunek (nie-VAT) w HTML (do druku / Zapisz jako PDF).
 * Rachunek jest dokumentem dla podmiotów zwolnionych z VAT.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id?.trim()) {
    return new NextResponse("Brak ID rachunku", { status: 400 });
  }

  try {
    const receipt = await prisma.receipt.findUnique({
      where: { id: id.trim() },
    });

    if (!receipt) {
      return new NextResponse("Rachunek nie istnieje", { status: 404 });
    }

    // Parsuj pozycje z JSON
    let items: ReceiptItem[] = [];
    if (receipt.items) {
      try {
        items = receipt.items as unknown as ReceiptItem[];
      } catch {
        items = [];
      }
    }

    const issuedDate = new Date(receipt.issuedAt).toLocaleDateString("pl-PL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    const serviceDate = receipt.serviceDate
      ? new Date(receipt.serviceDate).toLocaleDateString("pl-PL", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : issuedDate;

    const paymentDueDate = receipt.paymentDueDate
      ? new Date(receipt.paymentDueDate).toLocaleDateString("pl-PL", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : null;

    const amount = Number(receipt.amount);

    // Dane sprzedawcy
    const sellerLines: string[] = [
      receipt.sellerName || HOTEL_NAME,
      ...(receipt.sellerNip ? [`NIP: ${receipt.sellerNip}`] : []),
      ...(receipt.sellerAddress ? [receipt.sellerAddress] : []),
      ...(receipt.sellerPostalCode || receipt.sellerCity
        ? [[receipt.sellerPostalCode, receipt.sellerCity].filter(Boolean).join(" ")]
        : []),
    ].filter(Boolean);
    const sellerHtml = sellerLines.map((l) => `<p class="mb-0">${escapeHtml(l)}</p>`).join("");

    // Dane nabywcy
    const buyerLines: string[] = [
      receipt.buyerName,
      ...(receipt.buyerNip ? [`NIP: ${receipt.buyerNip}`] : []),
      ...(receipt.buyerAddress ? [receipt.buyerAddress] : []),
      ...(receipt.buyerPostalCode || receipt.buyerCity
        ? [[receipt.buyerPostalCode, receipt.buyerCity].filter(Boolean).join(" ")]
        : []),
    ].filter(Boolean);
    const buyerHtml = buyerLines.map((l) => `<p class="mb-0">${escapeHtml(l)}</p>`).join("");

    // Generowanie pozycji tabeli
    const itemsHtml = items.length > 0
      ? items.map((item, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td>${escapeHtml(item.name)}</td>
          <td class="text-right">${item.quantity}</td>
          <td class="text-right">${item.unitPrice.toFixed(2)}</td>
          <td class="text-right">${item.amount.toFixed(2)}</td>
        </tr>
      `).join("")
      : `
        <tr>
          <td>1</td>
          <td>Usługa hotelowa</td>
          <td class="text-right">1</td>
          <td class="text-right">${amount.toFixed(2)}</td>
          <td class="text-right">${amount.toFixed(2)}</td>
        </tr>
      `;

    // Status płatności
    const paymentStatusHtml = receipt.isPaid
      ? `<p class="payment-status paid">OPŁACONE${receipt.paidAt ? ` (${new Date(receipt.paidAt).toLocaleDateString("pl-PL")})` : ""}</p>`
      : paymentDueDate
        ? `<p class="payment-status unpaid">Termin płatności: ${paymentDueDate}</p>`
        : "";

    // Sposób płatności
    const paymentMethodNames: Record<string, string> = {
      CASH: "Gotówka",
      TRANSFER: "Przelew",
      CARD: "Karta płatnicza",
    };
    const paymentMethodText = receipt.paymentMethod
      ? paymentMethodNames[receipt.paymentMethod] || receipt.paymentMethod
      : "";

    const html = `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="utf-8" />
  <title>Rachunek ${escapeHtml(receipt.number)}</title>
  <style>
    body { 
      font-family: system-ui, -apple-system, sans-serif; 
      max-width: 800px; 
      margin: 2rem auto; 
      padding: 1rem; 
      color: #111; 
      font-size: 14px;
      line-height: 1.5;
    }
    h1 { 
      font-size: 1.5rem; 
      margin-bottom: 1.5rem; 
      text-align: center;
      border-bottom: 2px solid #333;
      padding-bottom: 0.5rem;
    }
    .header-info {
      display: flex;
      justify-content: space-between;
      margin-bottom: 2rem;
    }
    .header-info > div {
      flex: 1;
    }
    table { 
      width: 100%; 
      border-collapse: collapse; 
      margin: 1.5rem 0; 
    }
    th, td { 
      border: 1px solid #ccc; 
      padding: 0.5rem 0.75rem; 
      text-align: left; 
    }
    th { 
      background: #f5f5f5; 
      font-weight: 600; 
    }
    .text-right { text-align: right; }
    .mt-2 { margin-top: 1rem; }
    .mb-0 { margin-bottom: 0; }
    .mb-1 { margin-bottom: 0.25rem; }
    .text-muted { color: #666; font-size: 0.875rem; }
    .parties {
      display: flex;
      justify-content: space-between;
      margin: 1.5rem 0;
      gap: 2rem;
    }
    .parties > div {
      flex: 1;
    }
    .party-label {
      font-weight: 600;
      margin-bottom: 0.5rem;
      color: #333;
      border-bottom: 1px solid #ddd;
      padding-bottom: 0.25rem;
    }
    .summary {
      margin-top: 1.5rem;
      padding: 1rem;
      background: #f9f9f9;
      border: 1px solid #ddd;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 0.5rem;
    }
    .summary-total {
      font-size: 1.1rem;
      font-weight: 700;
      border-top: 1px solid #ccc;
      padding-top: 0.5rem;
      margin-top: 0.5rem;
    }
    .payment-status {
      padding: 0.5rem 1rem;
      border-radius: 4px;
      margin-top: 1rem;
      text-align: center;
      font-weight: 600;
    }
    .payment-status.paid {
      background: #d4edda;
      color: #155724;
      border: 1px solid #c3e6cb;
    }
    .payment-status.unpaid {
      background: #fff3cd;
      color: #856404;
      border: 1px solid #ffeeba;
    }
    .vat-exemption {
      margin-top: 1.5rem;
      padding: 0.75rem;
      background: #e7f3ff;
      border: 1px solid #b6d4fe;
      font-size: 0.85rem;
      color: #084298;
    }
    .footer {
      margin-top: 2rem;
      padding-top: 1rem;
      border-top: 1px solid #ddd;
      font-size: 0.75rem;
      color: #666;
      text-align: center;
    }
    .notes {
      margin-top: 1rem;
      padding: 0.75rem;
      background: #fffbe6;
      border: 1px solid #ffe58f;
      font-size: 0.85rem;
    }
    @media print { 
      body { margin: 0; padding: 0.5rem; } 
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <h1>RACHUNEK</h1>
  
  <div class="header-info">
    <div>
      <p class="mb-1"><strong>Numer:</strong> ${escapeHtml(receipt.number)}</p>
      <p class="mb-1"><strong>Data wystawienia:</strong> ${escapeHtml(issuedDate)}</p>
      <p class="mb-0"><strong>Data sprzedaży:</strong> ${escapeHtml(serviceDate)}</p>
    </div>
    ${paymentMethodText ? `
    <div style="text-align: right;">
      <p class="mb-0"><strong>Sposób płatności:</strong> ${escapeHtml(paymentMethodText)}</p>
    </div>
    ` : ""}
  </div>

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
        <th style="width: 40px;">Lp</th>
        <th>Nazwa usługi / towaru</th>
        <th class="text-right" style="width: 60px;">Ilość</th>
        <th class="text-right" style="width: 100px;">Cena jedn. (PLN)</th>
        <th class="text-right" style="width: 100px;">Wartość (PLN)</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
  </table>

  <div class="summary">
    <div class="summary-row summary-total">
      <span>Razem do zapłaty:</span>
      <span>${amount.toFixed(2)} PLN</span>
    </div>
    <div class="summary-row text-muted">
      <span>Słownie:</span>
      <span>${amountToWords(amount)} PLN</span>
    </div>
  </div>

  ${paymentStatusHtml}

  ${receipt.vatExemptionBasis ? `
  <div class="vat-exemption">
    <strong>Podstawa zwolnienia z VAT:</strong> ${escapeHtml(receipt.vatExemptionBasis)}
  </div>
  ` : ""}

  ${receipt.notes ? `
  <div class="notes">
    <strong>Uwagi:</strong> ${escapeHtml(receipt.notes)}
  </div>
  ` : ""}

  <div class="footer">
    <p>Dokument wygenerowany z systemu Hotel PMS.</p>
    <p class="no-print">Do druku: użyj „Drukuj" → „Zapisz jako PDF".</p>
  </div>
</body>
</html>`;

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="rachunek-${receipt.number.replace(/\//g, "-")}.html"`,
      },
    });
  } catch (e) {
    console.error("[receipt-pdf]", e);
    return new NextResponse("Błąd generowania rachunku", { status: 500 });
  }
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
