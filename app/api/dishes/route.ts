import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

function toNum(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "object" && v !== null && "toNumber" in v) return (v as { toNumber: () => number }).toNumber();
  return Number(v);
}

// GET — lista dań (słownik)
// ?q=... — wyszukiwanie po nazwie
// ?category=... — filtr kategorii
// ?includeInactive=true — także nieaktywne
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim().toLowerCase();
    const category = searchParams.get("category");
    const includeInactive = searchParams.get("includeInactive") === "true";

    const where: { isActive?: boolean; name?: { contains: string }; category?: string } = {};
    if (!includeInactive) where.isActive = true;
    if (q) where.name = { contains: q };
    if (category) where.category = category;

    const rows = await prisma.dish.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    const dishes = rows.map((d) => ({
      id: d.id,
      name: d.name,
      code: d.code,
      defaultPrice: toNum(d.defaultPrice),
      vatRate: toNum(d.vatRate),
      category: d.category,
      gtuCode: d.gtuCode,
      sortOrder: d.sortOrder,
      isActive: d.isActive,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    }));

    return NextResponse.json(dishes);
  } catch (e) {
    console.error("[api/dishes GET]", e);
    return NextResponse.json(
      { error: "Błąd serwera", details: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

// POST — nowe danie
export async function POST(req: Request) {
  const body = await req.json();
  const name = (body.name as string)?.trim();
  if (!name) return NextResponse.json({ error: "Nazwa jest wymagana" }, { status: 400 });

  const existing = await prisma.dish.findFirst({ where: { name } });
  if (existing) return NextResponse.json({ error: "Danie o takiej nazwie już istnieje" }, { status: 400 });

  const d = await prisma.dish.create({
    data: {
      name,
      code: (body.code as string)?.trim() || null,
      defaultPrice: Number(body.defaultPrice ?? 0),
      vatRate: Number(body.vatRate ?? 0.08),
      category: (body.category as string)?.trim() || null,
      gtuCode: (body.gtuCode as string)?.trim() || null,
      allergens: Array.isArray(body.allergens) ? body.allergens : null,
      dietTags: Array.isArray(body.dietTags) ? body.dietTags : null,
      sortOrder: Number(body.sortOrder ?? 0),
      isActive: body.isActive !== false,
    },
  });

  return NextResponse.json({
    ...d,
    defaultPrice: toNum(d.defaultPrice),
    vatRate: toNum(d.vatRate),
  });
}
