/**
 * Wspólna logika generowania HTML faktury VAT i konwersji do PDF.
 * Używane przez API route i sendInvoiceByEmail.
 */
import { prisma } from "@/lib/db";
import { getEffectiveKsefEnv } from "@/lib/ksef/env";

const HOTEL_NAME = process.env.HOTEL_NAME ?? "Hotel";

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
 * Generuje HTML faktury VAT (Invoice).
 * @param id - ID faktury
 * @param amountOverride - opcjonalna nadpisana kwota brutto (faktury zbiorcze)
 * @param variant - "original" | "copy" | null (oryginał / kopia / oba)
 */
export async function generateInvoiceHtml(
  id: string,
  amountOverride: number | null,
  variant: string | null
): Promise<string> {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { lineItems: { orderBy: { sortOrder: "asc" } } },
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

  const GASTRONOMY_TYPES = ["GASTRONOMY", "RESTAURANT", "POSTING"];
  let transactions = invoice.reservationId
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
  const invoiceScope = invoice.invoiceScope ?? (invoice.reservationId
    ? (await prisma.reservation.findUnique({
        where: { id: invoice.reservationId },
        select: { invoiceScope: true },
      }))?.invoiceScope ?? "ALL"
    : "ALL");
  if (invoiceScope === "HOTEL_ONLY") {
    transactions = transactions.filter((t) => !GASTRONOMY_TYPES.includes(t.type));
  } else if (invoiceScope === "GASTRONOMY_ONLY") {
    transactions = transactions.filter((t) => GASTRONOMY_TYPES.includes(t.type));
  }

  let detectedPaymentMethod: string | null = null;
  const paymentBreakdown = invoice.paymentBreakdown as Array<{ type: string; amount: number }> | null;
  if (paymentBreakdown && Array.isArray(paymentBreakdown) && paymentBreakdown.length > 0) {
    const withAmount = paymentBreakdown.filter((p) => p.amount > 0);
    if (withAmount.length === 1) {
      detectedPaymentMethod = withAmount[0].type.toUpperCase();
    } else if (withAmount.length > 1) {
      detectedPaymentMethod = "SPLIT";
    }
  }
  if (!detectedPaymentMethod && !invoice.paymentMethod && invoice.reservationId) {
    const paymentTransactions = await prisma.transaction.findMany({
      where: {
        reservationId: invoice.reservationId,
        type: "PAYMENT",
        status: "ACTIVE",
      },
      select: { paymentMethod: true, amount: true },
    });
    if (paymentTransactions.length > 0) {
      const methodCounts = new Map<string, number>();
      for (const pt of paymentTransactions) {
        if (pt.paymentMethod) {
          const m = pt.paymentMethod.toUpperCase();
          methodCounts.set(m, (methodCounts.get(m) || 0) + Math.abs(Number(pt.amount)));
        }
      }
      if (methodCounts.size > 0) {
        detectedPaymentMethod = [...methodCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
      }
    }
  }

  const issueDate = new Date(invoice.issuedAt).toLocaleDateString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const deliveryDate = invoice.deliveryDate
    ? new Date(invoice.deliveryDate).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" })
    : issueDate;

  const net = Number(invoice.amountNet);
  const vat = Number(invoice.amountVat);
  const gross = Number(invoice.amountGross);
  const vatRate = Number(invoice.vatRate);

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
  const rawPaymentMethod = detectedPaymentMethod || invoice.paymentMethod || template.defaultPaymentMethod || "TRANSFER";
  const paymentMethod = paymentMethodNames[rawPaymentMethod.toUpperCase()] || rawPaymentMethod;
  const paymentDays = invoice.paymentDays ?? template.defaultPaymentDays ?? 14;
  let dueDateStr = "";
  if (invoice.paymentDueDate) {
    dueDateStr = new Date(invoice.paymentDueDate).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });
  } else {
    const dueDate = new Date(invoice.issuedAt);
    dueDate.setDate(dueDate.getDate() + paymentDays);
    dueDateStr = dueDate.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  const roomLabel = (template.roomProductName?.trim() || "Usługa hotelowa") as string;
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

  // Zapisane w bazie pozycje używamy zawsze gdy są (także dla faktury z rezerwacji), żeby PDF = podgląd po zapisie.
  if (invoice.lineItems && invoice.lineItems.length > 0) {
    for (const li of invoice.lineItems) {
      lineItems.push({
        name: li.description,
        pkwiu: "55.10.10.0",
        unit: li.unit || "szt.",
        quantity: Number(li.quantity),
        unitPrice: Number(li.unitPrice),
        discount: 0,
        netAmount: Number(li.amountNet),
        vatRate: Number(li.vatRate),
        vatAmount: Number(li.amountVat),
        grossAmount: Number(li.amountGross),
      });
    }
  }

  const reservation = invoice.reservationId
    ? await prisma.reservation.findUnique({
        where: { id: invoice.reservationId },
        select: { invoiceSingleLine: true },
      })
    : null;
  const useSingleLine = reservation?.invoiceSingleLine ?? true;

  if (lineItems.length === 0 && useSingleLine) {
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
  } else if (transactions.length > 0) {
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

  let finalNet = net;
  let finalVat = vat;
  let finalGross = gross;
  const isConsolidated = invoice.sourceType === "CONSOLIDATED";
  const useOverride = isConsolidated && amountOverride != null && Number.isFinite(amountOverride) && amountOverride > 0;
  if (useOverride) {
    finalGross = Math.round(amountOverride * 100) / 100;
    finalNet = Math.round((finalGross / (1 + vatRate / 100)) * 100) / 100;
    finalVat = Math.round((finalGross - finalNet) * 100) / 100;
    lineItems.length = 0;
    lineItems.push({
      name: "Usługa hotelowa",
      pkwiu: "55.10.10.0",
      unit: defaultUnit,
      quantity: 1,
      unitPrice: finalNet,
      discount: 0,
      netAmount: finalNet,
      vatRate: vatRate,
      vatAmount: finalVat,
      grossAmount: finalGross,
    });
  }

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

  let bankLine = "";
  if (template.sellerBankName) bankLine += template.sellerBankName;
  if (template.sellerBankAccount) bankLine += (bankLine ? "\n" : "") + template.sellerBankAccount;

  const buyerLines: string[] = [
    invoice.buyerName,
    ...(invoice.buyerAddress ? [invoice.buyerAddress] : []),
    ...(invoice.buyerPostalCode || invoice.buyerCity
      ? [[invoice.buyerPostalCode, invoice.buyerCity].filter(Boolean).join(" ")]
      : []),
    ...(invoice.buyerNip ? [`NIP: ${invoice.buyerNip}`] : []),
  ].filter(Boolean);
  const buyerHtml = buyerLines.map((l) => `<p class="mb-0">${escapeHtml(l)}</p>`).join("");

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

  const placeOfIssue = invoice.placeOfIssue || template.placeOfIssue || template.sellerCity || "";
  const issuedByName = invoice.issuedByName || template.issuedByName || "";
  const receivedByName = invoice.receivedByName || "";

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
    const cells: string[] = [`${idx + 1}`, escapeHtml(item.name)];
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
    vatSummary = [{ rate: vatRate, net: finalNet, vat: finalVat, gross: finalGross }];
  }

  const headerHtml = template.headerText
    ? `<div class="header-text">${escapeHtml(template.headerText).replace(/\n/g, "<br>")}</div>`
    : "";
  const footerHtml = template.footerText
    ? `<div class="footer-text">${escapeHtml(template.footerText).replace(/\n/g, "<br>")}</div>`
    : "";
  const thanksHtml = template.thanksText
    ? `<p class="thanks-text">${escapeHtml(template.thanksText)}</p>`
    : "";
  const notesHtml = invoice.notes?.trim()
    ? `<div class="invoice-notes"><strong>Uwagi:</strong><br>${escapeHtml(invoice.notes).replace(/\n/g, "<br>")}</div>`
    : "";

  const ksefUuid = invoice.ksefUuid?.trim();
  const ksefVerifyUrl = ksefUuid
    ? (getEffectiveKsefEnv() === "test"
        ? "https://ksef-test.mf.gov.pl"
        : "https://ksef.mf.gov.pl") + `/web/verify/${encodeURIComponent(ksefUuid)}`
    : "";

  const isProforma = invoice.number.toUpperCase().startsWith("PRO");
  const docLabel = isProforma ? "Proforma" : isConsolidated ? "Faktura" : "Faktura VAT";
  const fontFamily = template.fontFamily ?? "system-ui, sans-serif";
  const primaryColor = template.primaryColor ?? "#111111";
  const fontSize = (template.fontSize ?? 12) - 2;

  const datesTopHtml = isConsolidated
    ? ""
    : `${placeOfIssue ? `<p class="mb-0"><strong>Miejsce wystawienia:</strong> ${escapeHtml(placeOfIssue)}</p>` : ""}
      <p class="mb-0"><strong>Data dostawy/wykonania usługi:</strong> ${escapeHtml(deliveryDate)}</p>
      <p class="mb-0"><strong>Data wystawienia:</strong> ${escapeHtml(issueDate)}</p>`;
  const datesBelowH1 = isConsolidated
    ? `<div style="margin-bottom: 1rem; font-size: 0.85rem;">
        ${placeOfIssue ? `<p class="mb-0"><strong>Miejsce wystawienia:</strong> ${escapeHtml(placeOfIssue)}</p>` : ""}
        <p class="mb-0"><strong>Data dostawy/wykonania usługi:</strong> ${escapeHtml(deliveryDate)}</p>
        <p class="mb-0"><strong>Data wystawienia:</strong> ${escapeHtml(issueDate)}</p>
      </div>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="utf-8" />
  <title>${docLabel} ${escapeHtml(invoice.number)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: ${fontFamily}; max-width: 900px; margin: 1rem auto; padding: 1rem; color: ${primaryColor}; font-size: ${fontSize}px; line-height: 1.4; }
    h1 { font-size: 1.3rem; margin: 0.5rem 0 1rem; text-align: center; }
    .header-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; font-size: 0.85rem; }
    .seller-top { font-size: 0.8rem; line-height: 1.3; }
    .dates-top { text-align: right; font-size: 0.85rem; }
    table { width: 100%; border-collapse: collapse; margin: 0.75rem 0; font-size: 0.8rem; }
    th, td { border: 1px solid #333; padding: 0.35rem 0.5rem; text-align: left; }
    th { background: #f5f5f5; font-weight: 600; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .mt-1 { margin-top: 0.5rem; }
    .mt-2 { margin-top: 1rem; }
    .mb-0 { margin-bottom: 0; }
    .parties { display: flex; gap: 1rem; margin: 1rem 0; font-size: 0.85rem; }
    .parties > div { flex: 1; }
    .party-box { border: 1px solid #ccc; padding: 0.5rem; min-height: 80px; }
    .party-label { font-weight: 600; margin-bottom: 0.25rem; font-size: 0.75rem; color: #666; }
    .vat-summary { width: auto; margin-left: auto; margin-right: 0; font-size: 0.8rem; }
    .vat-summary th, .vat-summary td { padding: 0.25rem 0.5rem; }
    .payment-box { display: flex; gap: 2rem; margin: 1rem 0; font-size: 0.85rem; }
    .payment-box > div { border: 1px solid #ccc; padding: 0.5rem 0.75rem; }
    .amount-words { font-size: 0.8rem; margin: 0.5rem 0; }
    .signatures { display: flex; justify-content: space-between; margin-top: 3rem; font-size: 0.75rem; }
    .signature-box { text-align: center; width: 200px; }
    .signature-line { border-top: 1px solid #333; margin-top: 2rem; padding-top: 0.25rem; }
    .header-text { background: #f5f5f5; padding: 0.5rem; font-size: 0.8rem; margin-bottom: 0.5rem; }
    .footer-text { border-top: 1px solid #ddd; padding-top: 0.5rem; font-size: 0.75rem; color: #666; margin-top: 1rem; }
    .thanks-text { font-style: italic; font-size: 0.8rem; }
    .ksef-qr { margin-top: 1rem; padding: 0.5rem; border: 1px solid #eee; border-radius: 4px; display: inline-block; }
    .invoice-notes { margin: 1rem 0; padding: 0.5rem 0.75rem; border: 1px solid #ddd; border-radius: 4px; font-size: 0.85rem; background: #fafafa; }
    .invoice-page-copy { page-break-before: always; }
    @media print { body { margin: 0; padding: 0.5rem; font-size: 11px; } .no-print { display: none; } }
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
  <h1>${docLabel} ${escapeHtml(invoice.number)} oryginał</h1>
  ${datesBelowH1}
  ${headerHtml}
  <div class="parties">
    <div>
      <div class="party-label">Sprzedawca</div>
      <div class="party-box">${sellerHtml}</div>
    </div>
    <div>
      <div class="party-label">Nabywca</div>
      <div class="party-box">${buyerHtml}</div>
    </div>
    ${receiverHtml ? `<div><div class="party-label">Odbiorca</div><div class="party-box">${receiverHtml}</div></div>` : ""}
  </div>
  <table>
    <thead><tr>${tableHeaders.map(h => `<th class="${h === "Lp." ? "text-center" : h.includes("Wartość") || h.includes("Cena") || h.includes("VAT") || h.includes("Ilość") || h.includes("Rabat") ? "text-right" : ""}">${escapeHtml(h)}</th>`).join("")}</tr></thead>
    <tbody>${tableRows.map(row => `<tr>${row.map((cell, i) => `<td class="${i === 0 ? "text-center" : i >= 3 ? "text-right" : ""}">${cell}</td>`).join("")}</tr>`).join("")}</tbody>
  </table>
  <table class="vat-summary">
    <thead><tr><th>Stawka VAT</th><th class="text-right">Wartość netto</th><th class="text-right">Wartość VAT</th><th class="text-right">Wartość brutto</th></tr></thead>
    <tbody>
      ${vatSummary.map(v => `<tr><td class="text-center">${v.rate},00</td><td class="text-right">${v.net.toFixed(2)}</td><td class="text-right">${v.vat.toFixed(2)}</td><td class="text-right">${v.gross.toFixed(2)}</td></tr>`).join("")}
      <tr style="font-weight: 600;"><td>Suma:</td><td class="text-right">${finalNet.toFixed(2)}</td><td class="text-right">${finalVat.toFixed(2)}</td><td class="text-right">${finalGross.toFixed(2)}</td></tr>
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
  <div class="amount-words"><strong>Słownie zł:</strong> ${amountToWords(finalGross)}</div>
  ${notesHtml}
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
    <div class="signature-box"><div>${issuedByName ? escapeHtml(issuedByName) : "&nbsp;"}</div><div class="signature-line">Osoba upoważniona do wystawienia</div></div>
    <div class="signature-box"><div>${receivedByName ? escapeHtml(receivedByName) : "&nbsp;"}</div><div class="signature-line">Osoba upoważniona do odbioru</div></div>
  </div>
  <p class="mt-2 no-print" style="font-size: 0.7rem; color: #999;">Dokument wygenerowany z systemu Hotel PMS. Do druku: użyj „Drukuj" → „Zapisz jako PDF".</p>
</body>
</html>`;

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

/**
 * Konwertuje HTML faktury na bufor PDF za pomocą Puppeteer.
 * Używa page.setContent zamiast page.goto — unika problemów z URL/redirect.
 */
export async function generatePdfFromHtml(html: string): Promise<Buffer> {
  const puppeteer = (await import("puppeteer")).default;
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium-browser";

  const browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-first-run",
      "--no-zygote",
      "--single-process",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 20000 });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" },
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}
