import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function amountToWords(amount: number): string {
  const intPart = Math.floor(amount);
  const decPart = Math.round((amount - intPart) * 100);
  if (intPart === 0) return `zero ${decPart.toString().padStart(2, "0")}/100`;
  const units = ["", "jeden", "dwa", "trzy", "cztery", "pięć", "sześć", "siedem", "osiem", "dziewięć"];
  const teens = ["dziesięć", "jedenaście", "dwanaście", "trzynaście", "czternaście", "piętnaście", "szesnaście", "siedemnaście", "osiemnaście", "dziewiętnaście"];
  const tens = ["", "", "dwadzieścia", "trzydzieści", "czterdzieści", "pięćdziesiąt", "sześćdziesiąt", "siedemdziesiąt", "osiemdziesiąt", "dziewięćdziesiąt"];
  const hundreds = ["", "sto", "dwieście", "trzysta", "czterysta", "pięćset", "sześćset", "siedemset", "osiemset", "dziewięćset"];
  const convert = (n: number): string => {
    if (n === 0) return "";
    if (n < 10) return units[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 > 0 ? " " + units[n % 10] : "");
    return hundreds[Math.floor(n / 100)] + (n % 100 > 0 ? " " + convert(n % 100) : "");
  };
  const result = intPart >= 1000
    ? (Math.floor(intPart / 1000) === 1 ? "jeden tysiąc" : convert(Math.floor(intPart / 1000)) + " tysięcy")
      + (intPart % 1000 > 0 ? " " + convert(intPart % 1000) : "")
    : convert(intPart);
  return `${result} ${decPart.toString().padStart(2, "0")}/100`;
}

/**
 * GET /api/owner/settlement/[id]/pdf
 * Zwraca dokument rozliczenia właściciela w HTML (do druku / Zapisz jako PDF).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id?.trim()) return new NextResponse("Brak ID", { status: 400 });

  const session = await getSession();
  if (!session) return new NextResponse("Wymagane logowanie", { status: 401 });

  try {
    const settlement = await prisma.ownerSettlement.findFirst({
      where: { id: id.trim(), ownerId: session.userId },
      include: { property: true },
    });
    if (!settlement) return new NextResponse("Rozliczenie nie istnieje", { status: 404 });

    const amount = Number(settlement.amount);
    const periodFromStr = settlement.periodFrom.toLocaleDateString("pl-PL", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    const periodToStr = settlement.periodTo.toLocaleDateString("pl-PL", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
    const generatedAt = settlement.documentGeneratedAt?.toLocaleDateString("pl-PL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const html = `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8" />
  <title>Rozliczenie ${escapeHtml(settlement.property.name)}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 600px; margin: 40px auto; padding: 24px; }
    h1 { font-size: 1.25rem; margin-bottom: 24px; }
    .period { color: #666; margin-bottom: 24px; }
    .amount { font-size: 1.5rem; font-weight: bold; margin: 24px 0; }
    .words { color: #666; font-size: 0.9rem; }
    .footer { margin-top: 48px; font-size: 0.8rem; color: #888; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <h1>Dokument rozliczenia – ${escapeHtml(settlement.property.name)}</h1>
  <p class="period">Okres: ${periodFromStr} – ${periodToStr}</p>
  <p class="amount">Kwota do rozliczenia: ${amount.toFixed(2)} ${settlement.currency}</p>
  <p class="words">Słownie: ${amountToWords(amount)} ${settlement.currency}</p>
  <p class="footer">
    Dokument wygenerowany ${generatedAt ?? "—"}.<br />
    <span class="no-print">Do druku: użyj „Drukuj" → „Zapisz jako PDF".</span>
  </p>
</body>
</html>`;

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="rozliczenie-${settlement.property.code}-${settlement.periodFrom.toISOString().slice(0, 7)}.html"`,
      },
    });
  } catch (e) {
    console.error("[owner-settlement-pdf]", e);
    return new NextResponse("Błąd generowania dokumentu", { status: 500 });
  }
}
