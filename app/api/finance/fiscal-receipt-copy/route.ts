import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getFiscalReceiptTemplate } from "@/app/actions/finance";

const HOTEL_NAME = process.env.HOTEL_NAME ?? "Hotel";

/** Etykiety sposobu zapłaty – zgodne z paragonem fiskalnym (unified-reservation-dialog DOC_PAYMENT_LABELS). */
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: "Gotówka",
  CARD: "Karta",
  TRANSFER: "Przelew",
  PREPAID: "Przedpłata",
  VOUCHER: "Voucher",
  BLIK: "BLIK",
  SPLIT: "Mieszana",
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * GET /api/finance/fiscal-receipt-copy?reservationId=xxx&amount=100&receiptNumber=PAR-123&paymentMethod=CASH
 * Zwraca kopię paragonu fiskalnego w HTML (do druku – recepcja).
 * amount – opcjonalnie, dla splita (kwota na paragonie).
 * receiptNumber – numer paragonu z kasy fiskalnej (np. PAR-123), aby kopia miała taką samą numerację.
 * paymentMethod – opcjonalnie: CASH, CARD, TRANSFER, PREPAID, VOUCHER, BLIK, SPLIT (jak na paragonie oryginalnym).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const reservationId = searchParams.get("reservationId")?.trim();
  const amountParam = searchParams.get("amount");
  const receiptNumber = searchParams.get("receiptNumber")?.trim() || null;
  const paymentMethodCode = searchParams.get("paymentMethod")?.trim().toUpperCase() || null;
  const paymentMethodLabel =
    paymentMethodCode && paymentMethodCode in PAYMENT_METHOD_LABELS
      ? PAYMENT_METHOD_LABELS[paymentMethodCode]
      : paymentMethodCode || null;

  if (!reservationId) {
    return new NextResponse("Brak reservationId", { status: 400 });
  }

  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { transactions: true, guest: { select: { name: true } } },
    });

    if (!reservation) {
      return new NextResponse("Rezerwacja nie istnieje", { status: 404 });
    }

    const res = reservation as typeof reservation & { transactions: Array<{ type: string; amount: unknown; status: string | null }>; guest: { name: string } | null };
    const chargeTypes = ["ROOM", "LOCAL_TAX", "MINIBAR", "GASTRONOMY", "SPA", "PARKING", "RENTAL", "PHONE", "LAUNDRY", "TRANSPORT", "ATTRACTION", "OTHER"];
    const chargeTransactions = res.transactions.filter(
      (t: { type: string; amount: unknown; status: string | null }) =>
        chargeTypes.includes(t.type) && Number(t.amount) > 0 && (t.status === "ACTIVE" || t.status == null)
    );
    let totalAmount = chargeTransactions.reduce((s: number, t: { amount: unknown }) => s + Number(t.amount), 0);

    const amountOverride = amountParam ? parseFloat(amountParam) : null;
    const useOverride = amountOverride != null && Number.isFinite(amountOverride) && amountOverride > 0;

    if (totalAmount <= 0 && !useOverride) {
      return new NextResponse("Brak pozycji na paragonie", { status: 400 });
    }

    const RECEIPT_ITEM_NAME = "Usługa gastronomiczna";
    let items: Array<{ name: string; quantity: number; unitPrice: number; vatRate: number }>;
    if (useOverride) {
      totalAmount = Math.round(amountOverride * 100) / 100;
      items = [{ name: RECEIPT_ITEM_NAME, quantity: 1, unitPrice: totalAmount, vatRate: 8 }];
    } else {
      items = chargeTransactions.map((t: { type: string; amount: unknown }) => ({
        name: RECEIPT_ITEM_NAME,
        quantity: 1,
        unitPrice: Number(t.amount),
        vatRate: 8,
      }));
    }

    const templateResult = await getFiscalReceiptTemplate();
    const headerLines: string[] = [];
    const footerLines: string[] = [];
    if (templateResult.success && templateResult.data) {
      const t = templateResult.data;
      if (t.headerLine1) headerLines.push(t.headerLine1);
      if (t.headerLine2) headerLines.push(t.headerLine2);
      if (t.headerLine3) headerLines.push(t.headerLine3);
      if (t.footerLine1) footerLines.push(t.footerLine1);
      if (t.footerLine2) footerLines.push(t.footerLine2);
      if (t.footerLine3) footerLines.push(t.footerLine3);
    }
    if (headerLines.length === 0) headerLines.push(HOTEL_NAME);

    const issuedAt = new Date().toLocaleString("pl-PL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const guestName = res.guest?.name ?? "—";

    const itemsHtml = items
      .map(
        (it) =>
          `<tr>
        <td>${escapeHtml(it.name)}</td>
        <td class="text-right">${it.quantity}</td>
        <td class="text-right">${it.unitPrice.toFixed(2)}</td>
        <td class="text-right">${(it.quantity * it.unitPrice).toFixed(2)}</td>
      </tr>`
      )
      .join("");

    const html = `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="utf-8" />
  <title>Kopia paragonu</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; max-width: 400px; margin: 1rem auto; padding: 1rem; font-size: 12px; }
    h1 { font-size: 1rem; text-align: center; margin: 0 0 1rem; }
    .header, .footer { text-align: center; font-size: 11px; color: #333; margin: 0.5rem 0; }
    table { width: 100%; border-collapse: collapse; margin: 0.75rem 0; font-size: 11px; }
    th, td { border-bottom: 1px solid #ddd; padding: 0.25rem 0.5rem; }
    .text-right { text-align: right; }
    .total { font-weight: 600; font-size: 1.1rem; margin-top: 0.5rem; }
    .copy-label { font-size: 0.75rem; color: #666; margin-bottom: 0.5rem; }
    @media print { body { margin: 0; padding: 0.5rem; } }
  </style>
</head>
<body>
  <div class="copy-label">KOPIA PARAGONU — do archiwum recepcji</div>
  ${headerLines.map((l) => `<div class="header">${escapeHtml(l)}</div>`).join("")}
  <h1>Paragon${receiptNumber ? ` · Nr ${escapeHtml(receiptNumber)}` : ""}</h1>
  <p style="font-size: 11px; margin: 0 0 0.5rem;">Data: ${escapeHtml(issuedAt)} · Gość: ${escapeHtml(guestName)}</p>
  <p style="font-size: 11px; margin: 0 0 0.25rem;">Rezerwacja: ${escapeHtml(reservationId.slice(0, 8))}${receiptNumber ? ` · Nr paragonu: ${escapeHtml(receiptNumber)}` : ""}</p>
  ${paymentMethodLabel ? `<p style="font-size: 11px; margin: 0 0 0.75rem;"><strong>Sposób zapłaty:</strong> ${escapeHtml(paymentMethodLabel)}</p>` : ""}
  <table>
    <thead>
      <tr>
        <th>Pozycja</th>
        <th class="text-right">Ilość</th>
        <th class="text-right">Cena</th>
        <th class="text-right">Suma</th>
      </tr>
    </thead>
    <tbody>${itemsHtml}</tbody>
  </table>
  <div class="text-right total">Razem: ${totalAmount.toFixed(2)} PLN</div>
  ${footerLines.map((l) => `<div class="footer">${escapeHtml(l)}</div>`).join("")}
  <p class="copy-label" style="margin-top: 1rem;">— Kopia dla recepcji —</p>
</body>
</html>`;

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="kopia-paragonu-${reservationId.slice(0, 8)}.html"`,
      },
    });
  } catch (e) {
    console.error("[fiscal-receipt-copy]", e);
    return new NextResponse("Błąd generowania kopii paragonu", { status: 500 });
  }
}
