import { NextRequest, NextResponse } from "next/server";
import { getKt1Report } from "@/lib/kt1-report";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";

/**
 * GET /api/reports/kt1?month=1&year=2026
 * Zwraca dane raportu KT-1 (GUS) w formacie JSON.
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

  return NextResponse.json(data, {
    status: 200,
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
  });
}
