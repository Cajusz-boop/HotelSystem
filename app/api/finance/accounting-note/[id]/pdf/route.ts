import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const HOTEL_NAME = process.env.HOTEL_NAME ?? "Hotel";

/**
 * GET /api/finance/accounting-note/[id]/pdf
 * Zwraca notę księgową w HTML (do druku / Zapisz jako PDF).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id?.trim()) {
    return new NextResponse("Brak ID noty", { status: 400 });
  }

  try {
    const note = await prisma.accountingNote.findUnique({
      where: { id: id.trim() },
    });

    if (!note) {
      return new NextResponse("Nota księgowa nie istnieje", { status: 404 });
    }

    const issuedDate = new Date(note.issuedAt).toLocaleDateString("pl-PL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    const dueDate = note.dueDate
      ? new Date(note.dueDate).toLocaleDateString("pl-PL", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : null;

    const referenceDate = note.referenceDate
      ? new Date(note.referenceDate).toLocaleDateString("pl-PL", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : null;

    const amount = Number(note.amount);
    const noteTypeName = note.type === "DEBIT" ? "OBCIĄŻENIOWA" : "UZNANIOWA";
    const noteTypeClass = note.type === "DEBIT" ? "debit" : "credit";

    // Kategoria noty
    const categoryNames: Record<string, string> = {
      DAMAGES: "Odszkodowanie za zniszczenia",
      PENALTY: "Kara umowna",
      INTEREST: "Odsetki",
      DISCOUNT: "Rabat",
      COMPENSATION: "Rekompensata",
      OTHER: "Inne",
    };
    const categoryText = note.category ? categoryNames[note.category] || note.category : null;

    // Status noty
    const statusNames: Record<string, string> = {
      ISSUED: "Wystawiona",
      PAID: "Opłacona",
      CANCELLED: "Anulowana",
      DISPUTED: "Sporna",
    };
    const statusText = statusNames[note.status] || note.status;
    const statusClass = note.status.toLowerCase();

    // Dane wystawcy
    const issuerLines: string[] = [
      note.issuerName || HOTEL_NAME,
      ...(note.issuerNip ? [`NIP: ${note.issuerNip}`] : []),
      ...(note.issuerAddress ? [note.issuerAddress] : []),
      ...(note.issuerPostalCode || note.issuerCity
        ? [[note.issuerPostalCode, note.issuerCity].filter(Boolean).join(" ")]
        : []),
    ].filter(Boolean);
    const issuerHtml = issuerLines.map((l) => `<p class="mb-0">${escapeHtml(l)}</p>`).join("");

    // Dane odbiorcy
    const recipientLines: string[] = [
      note.recipientName,
      ...(note.recipientNip ? [`NIP: ${note.recipientNip}`] : []),
      ...(note.recipientAddress ? [note.recipientAddress] : []),
      ...(note.recipientPostalCode || note.recipientCity
        ? [[note.recipientPostalCode, note.recipientCity].filter(Boolean).join(" ")]
        : []),
    ].filter(Boolean);
    const recipientHtml = recipientLines.map((l) => `<p class="mb-0">${escapeHtml(l)}</p>`).join("");

    const html = `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="utf-8" />
  <title>Nota Księgowa ${escapeHtml(note.number)}</title>
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
      margin-bottom: 0.5rem; 
      text-align: center;
    }
    .note-type {
      text-align: center;
      font-size: 1.1rem;
      font-weight: 600;
      padding: 0.5rem;
      margin-bottom: 1.5rem;
      border-radius: 4px;
    }
    .note-type.debit {
      background: #fee2e2;
      color: #991b1b;
      border: 1px solid #fecaca;
    }
    .note-type.credit {
      background: #dcfce7;
      color: #166534;
      border: 1px solid #bbf7d0;
    }
    .header-info {
      display: flex;
      justify-content: space-between;
      margin-bottom: 2rem;
      gap: 2rem;
    }
    .header-info > div {
      flex: 1;
    }
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
    .content-box {
      margin: 1.5rem 0;
      padding: 1rem;
      background: #f9f9f9;
      border: 1px solid #ddd;
      border-radius: 4px;
    }
    .content-box h3 {
      margin: 0 0 0.5rem 0;
      font-size: 1rem;
      color: #333;
    }
    .amount-box {
      margin: 1.5rem 0;
      padding: 1.5rem;
      text-align: center;
      border-radius: 4px;
    }
    .amount-box.debit {
      background: #fee2e2;
      border: 2px solid #f87171;
    }
    .amount-box.credit {
      background: #dcfce7;
      border: 2px solid #4ade80;
    }
    .amount-label {
      font-size: 0.9rem;
      color: #666;
      margin-bottom: 0.5rem;
    }
    .amount-value {
      font-size: 2rem;
      font-weight: 700;
    }
    .amount-words {
      font-size: 0.85rem;
      color: #666;
      margin-top: 0.5rem;
    }
    .status-badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
    }
    .status-badge.issued {
      background: #dbeafe;
      color: #1e40af;
    }
    .status-badge.paid {
      background: #dcfce7;
      color: #166534;
    }
    .status-badge.cancelled {
      background: #f3f4f6;
      color: #6b7280;
      text-decoration: line-through;
    }
    .status-badge.disputed {
      background: #fef3c7;
      color: #92400e;
    }
    .mb-0 { margin-bottom: 0; }
    .mb-1 { margin-bottom: 0.25rem; }
    .text-muted { color: #666; font-size: 0.875rem; }
    .footer {
      margin-top: 3rem;
      padding-top: 1rem;
      border-top: 1px solid #ddd;
      font-size: 0.75rem;
      color: #666;
      text-align: center;
    }
    .reference-info {
      margin-top: 1rem;
      padding: 0.75rem;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      font-size: 0.85rem;
    }
    @media print { 
      body { margin: 0; padding: 0.5rem; } 
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <h1>NOTA KSIĘGOWA</h1>
  <div class="note-type ${noteTypeClass}">${noteTypeName}</div>
  
  <div class="header-info">
    <div>
      <p class="mb-1"><strong>Numer:</strong> ${escapeHtml(note.number)}</p>
      <p class="mb-1"><strong>Data wystawienia:</strong> ${escapeHtml(issuedDate)}</p>
      ${dueDate ? `<p class="mb-1"><strong>Termin płatności:</strong> ${escapeHtml(dueDate)}</p>` : ""}
      ${categoryText ? `<p class="mb-0"><strong>Kategoria:</strong> ${escapeHtml(categoryText)}</p>` : ""}
    </div>
    <div style="text-align: right;">
      <p class="mb-0"><strong>Status:</strong> <span class="status-badge ${statusClass}">${escapeHtml(statusText)}</span></p>
    </div>
  </div>

  <div class="parties">
    <div>
      <div class="party-label">Wystawca:</div>
      ${issuerHtml}
    </div>
    <div>
      <div class="party-label">${note.type === "DEBIT" ? "Obciążony:" : "Uznany:"}</div>
      ${recipientHtml}
    </div>
  </div>

  <div class="content-box">
    <h3>Tytuł</h3>
    <p style="font-size: 1.1rem; margin: 0;">${escapeHtml(note.title)}</p>
    ${note.description ? `
    <div style="margin-top: 1rem; padding-top: 0.75rem; border-top: 1px solid #e5e7eb;">
      <strong>Opis:</strong>
      <p style="margin: 0.5rem 0 0 0; white-space: pre-wrap;">${escapeHtml(note.description)}</p>
    </div>
    ` : ""}
  </div>

  <div class="amount-box ${noteTypeClass}">
    <div class="amount-label">${note.type === "DEBIT" ? "Kwota obciążenia" : "Kwota uznania"}</div>
    <div class="amount-value">${amount.toFixed(2)} ${escapeHtml(note.currency)}</div>
    <div class="amount-words">Słownie: ${amountToWords(amount)} ${escapeHtml(note.currency)}</div>
  </div>

  ${note.referenceDocument || referenceDate ? `
  <div class="reference-info">
    <strong>Dokument źródłowy:</strong>
    ${note.referenceDocument ? escapeHtml(note.referenceDocument) : ""}
    ${referenceDate ? ` (z dnia ${escapeHtml(referenceDate)})` : ""}
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
        "Content-Disposition": `inline; filename="nota-${note.number.replace(/\//g, "-")}.html"`,
      },
    });
  } catch (e) {
    console.error("[accounting-note-pdf]", e);
    return new NextResponse("Błąd generowania noty księgowej", { status: 500 });
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
