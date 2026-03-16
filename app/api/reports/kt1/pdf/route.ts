import { NextRequest, NextResponse } from "next/server";
import { getKt1Report } from "@/lib/kt1-report";
import { generateKt1Html } from "@/lib/kt1-pdf-template";
import { generatePdfFromHtml } from "@/lib/invoice-html";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";

/**
 * GET /api/reports/kt1/pdf?month=1&year=2026
 * Zwraca raport KT-1 (GUS) w formacie PDF.
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const allowed = await can(session.role, "reports.official");
  if (!allowed) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const monthParam = searchParams.get("month");
  const yearParam = searchParams.get("year");

  if (monthParam == null || yearParam == null || monthParam === "" || yearParam === "") {
    return new NextResponse("Parametry month i year są wymagane", { status: 400 });
  }

  const month = parseInt(monthParam, 10);
  const year = parseInt(yearParam, 10);

  if (Number.isNaN(month) || month < 1 || month > 12) {
    return new NextResponse("Parametr month musi być liczbą od 1 do 12", { status: 400 });
  }
  if (Number.isNaN(year) || year < 2000 || year > 2100) {
    return new NextResponse("Parametr year musi być prawidłowym rokiem", { status: 400 });
  }

  const data = await getKt1Report(month, year);
  if (data == null) {
    return new NextResponse("Brak konfiguracji GUS (GusConfig)", { status: 404 });
  }

  try {
    const html = generateKt1Html(data);
    const pdfBuffer = await generatePdfFromHtml(html);
    const filename = `kt1-${year}-${String(month).padStart(2, "0")}.pdf`;
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (e) {
    console.error("[kt1-pdf]", e);
    return new NextResponse("Błąd generowania PDF", { status: 500 });
  }
}
