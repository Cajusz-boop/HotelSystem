import { NextRequest, NextResponse } from "next/server";
import { exportJpk } from "@/app/actions/jpk";

const MAX_JPK_RANGE_DAYS = 366; // max 1 rok

/**
 * GET /api/finance/jpk?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Zwraca plik JPK (XML) do pobrania.
 * Walidacja: from i to wymagane (YYYY-MM-DD), from <= to, zakres max 1 rok.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  if (!from.trim() || !to.trim()) {
    return NextResponse.json(
      { error: "Parametry from i to (YYYY-MM-DD) są wymagane" },
      { status: 400 }
    );
  }

  const fromDate = new Date(from.trim() + "T00:00:00.000Z");
  const toDate = new Date(to.trim() + "T23:59:59.999Z");
  if (Number.isNaN(fromDate.getTime())) {
    return NextResponse.json(
      { error: "Nieprawidłowy format daty from (użyj YYYY-MM-DD)" },
      { status: 400 }
    );
  }
  if (Number.isNaN(toDate.getTime())) {
    return NextResponse.json(
      { error: "Nieprawidłowy format daty to (użyj YYYY-MM-DD)" },
      { status: 400 }
    );
  }
  if (fromDate > toDate) {
    return NextResponse.json(
      { error: "Data from nie może być późniejsza niż data to" },
      { status: 400 }
    );
  }
  const rangeDays = Math.ceil((toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000));
  if (rangeDays > MAX_JPK_RANGE_DAYS) {
    return NextResponse.json(
      { error: `Zakres dat nie może przekraczać ${MAX_JPK_RANGE_DAYS} dni (1 rok)` },
      { status: 400 }
    );
  }

  const result = await exportJpk(from.trim(), to.trim());
  if (!result.success) {
    return NextResponse.json(
      { error: result.error ?? "Błąd eksportu JPK" },
      { status: 400 }
    );
  }

  const { xml, filename } = result.data;
  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
