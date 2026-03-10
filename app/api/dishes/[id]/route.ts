import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const dish = await prisma.dish.findUnique({ where: { id } });
  if (!dish) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(dish);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const name = (body.name as string)?.trim();
  if (!name) return NextResponse.json({ error: "Nazwa jest wymagana" }, { status: 400 });

  const existing = await prisma.dish.findFirst({
    where: { name, NOT: { id } },
  });
  if (existing) return NextResponse.json({ error: "Inne danie o takiej nazwie już istnieje" }, { status: 400 });

  const updated = await prisma.dish.update({
    where: { id },
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

  return NextResponse.json(updated);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.dish.update({
    where: { id },
    data: { isActive: false },
  });
  return NextResponse.json({ success: true });
}
