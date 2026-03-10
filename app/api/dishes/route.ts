import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

// GET — lista dań (słownik)
// ?q=... — wyszukiwanie po nazwie
// ?category=... — filtr kategorii
// ?includeInactive=true — także nieaktywne
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim().toLowerCase();
  const category = searchParams.get("category");
  const includeInactive = searchParams.get("includeInactive") === "true";

  const where: { isActive?: boolean; name?: { contains: string }; category?: string } = {};
  if (!includeInactive) where.isActive = true;
  if (q) where.name = { contains: q };
  if (category) where.category = category;

  const dishes = await prisma.dish.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return NextResponse.json(dishes);
}

// POST — nowe danie
export async function POST(req: Request) {
  const body = await req.json();
  const name = (body.name as string)?.trim();
  if (!name) return NextResponse.json({ error: "Nazwa jest wymagana" }, { status: 400 });

  const existing = await prisma.dish.findFirst({ where: { name } });
  if (existing) return NextResponse.json({ error: "Danie o takiej nazwie już istnieje" }, { status: 400 });

  const created = await prisma.dish.create({
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

  return NextResponse.json(created);
}
