import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : "Kosztorys";
    const validUntil = body.validUntil && typeof body.validUntil === "string" ? new Date(body.validUntil) : null;
    const rawItems = Array.isArray(body.items) ? body.items : null;
    const items = rawItems && rawItems.length > 0
      ? rawItems.map((it: { name?: string; quantity?: number; unitPrice?: number; amount?: number }) => ({
          name: String(it.name ?? ""),
          quantity: Number(it.quantity ?? 1),
          unitPrice: Number(it.unitPrice ?? 0),
          amount: Number(it.amount ?? (Number(it.quantity ?? 1) * Number(it.unitPrice ?? 0))),
        }))
      : null;
    let totalAmount: number | null = null;
    if (items && items.length > 0) {
      totalAmount = items.reduce((s: number, it: { amount?: number; quantity?: number; unitPrice?: number }) => s + (Number(it.amount) || Number(it.quantity) * Number(it.unitPrice)), 0);
    }
    const quote = await prisma.groupQuote.create({
      data: { name, validUntil, items: items as object, totalAmount: totalAmount != null ? totalAmount : null },
    });
    return NextResponse.json(quote, { status: 201 });
  } catch (e) {
    console.error("POST /api/mice/kosztorysy:", e);
    return NextResponse.json({ error: "Błąd tworzenia kosztorysu" }, { status: 500 });
  }
}

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
