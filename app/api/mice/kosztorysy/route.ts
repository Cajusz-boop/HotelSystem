import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const quotes = await prisma.groupQuote.findMany({
      orderBy: { validUntil: "desc" },
    });
    return NextResponse.json(quotes);
  } catch (e) {
    console.error("GET /api/mice/kosztorysy:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Błąd pobierania kosztorysów" },
      { status: 500 }
    );
  }
}
