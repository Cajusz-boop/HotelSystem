import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  exportToOptima,
  exportToSubiekt,
  exportToWfirma,
  exportToFakturownia,
  type InvoiceForExport,
} from "@/lib/integrations/accounting";

/**
 * POST /api/finance/export
 * Eksport faktur do integracji księgowej (Optima, Subiekt, wFirma, Fakturownia).
 * Body: { provider: "optima" | "subiekt" | "wfirma" | "fakturownia", dateFrom: "YYYY-MM-DD", dateTo: "YYYY-MM-DD" }
 * Zwraca plik (XML/JSON) do pobrania lub JSON z błędem.
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const provider = body?.provider as string | undefined;
    const dateFrom = body?.dateFrom as string | undefined;
    const dateTo = body?.dateTo as string | undefined;

    const allowed = ["optima", "subiekt", "wfirma", "fakturownia"];
    if (!provider || !allowed.includes(provider)) {
      return NextResponse.json(
        { error: "Parametr provider wymagany: optima, subiekt, wfirma, fakturownia" },
        { status: 400 }
      );
    }

    if (!dateFrom || !dateTo) {
      return NextResponse.json(
        { error: "Parametry dateFrom i dateTo są wymagane (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    const from = new Date(dateFrom);
    const to = new Date(dateTo);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) {
      return NextResponse.json(
        { error: "Nieprawidłowy zakres dat (dateFrom, dateTo)" },
        { status: 400 }
      );
    }

    const invoices = await prisma.invoice.findMany({
      where: {
        issuedAt: {
          gte: from,
          lte: to,
        },
      },
      orderBy: { issuedAt: "asc" },
    });

    const documents: InvoiceForExport[] = invoices.map((i) => ({
      number: i.number,
      issuedAt: i.issuedAt.toISOString(),
      amountNet: Number(i.amountNet),
      amountVat: Number(i.amountVat),
      amountGross: Number(i.amountGross),
      vatRate: Number(i.vatRate),
      buyerNip: i.buyerNip,
      buyerName: i.buyerName,
      buyerAddress: i.buyerAddress,
      buyerPostalCode: i.buyerPostalCode,
      buyerCity: i.buyerCity,
      description: "Usługa noclegowa",
    }));

    const exportResult =
      provider === "optima"
        ? await exportToOptima({ dateFrom, dateTo, documents })
        : provider === "subiekt"
          ? await exportToSubiekt({ dateFrom, dateTo, documents })
          : provider === "wfirma"
            ? await exportToWfirma({ dateFrom, dateTo, documents })
            : await exportToFakturownia({ dateFrom, dateTo, documents });

    if (!exportResult.success) {
      return NextResponse.json(
        { error: exportResult.error ?? "Błąd eksportu" },
        { status: 422 }
      );
    }

    if (!exportResult.content || !exportResult.filename) {
      return NextResponse.json(
        { error: "Brak zawartości eksportu" },
        { status: 500 }
      );
    }

    const isXml = exportResult.filename.endsWith(".xml");
    const contentType = isXml ? "application/xml" : "application/json";
    const headers = new Headers();
    headers.set("Content-Type", contentType);
    headers.set(
      "Content-Disposition",
      `attachment; filename="${exportResult.filename}"`
    );

    return new NextResponse(exportResult.content, {
      status: 200,
      headers,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Błąd serwera";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
