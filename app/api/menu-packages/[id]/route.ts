import { prisma } from "@/lib/db";
import { resolveDishIdsToNames } from "@/lib/dishes";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const pkg = await prisma.menuPackage.findUnique({
    where: { id },
    include: {
      sections: { orderBy: { sortOrder: "asc" } },
      surcharges: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!pkg) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(pkg);
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const updated = await prisma.menuPackage.update({
      where: { id },
      data: {
        name: body.name,
        price: body.price,
        eventTypes: body.eventTypes,
        isActive: body.isActive ?? true,
        sortOrder: body.sortOrder ?? 0,
        rules: body.rules || null,
      },
    });

    await prisma.menuPackageSection.deleteMany({ where: { packageId: id } });
    await prisma.menuPackageSurcharge.deleteMany({ where: { packageId: id } });

    if (body.sections?.length) {
      const sectionsData = await Promise.all(
        body.sections.map(
          async (
            s: { code: string; label: string; type: string; choiceLimit?: number; dishes?: string[]; dishIds?: string[] },
            i: number
          ) => {
            const dishIds = Array.isArray(s.dishIds) ? s.dishIds.filter(Boolean) : [];
            let dishes = Array.isArray(s.dishes) ? s.dishes : [];
            if (dishIds.length > 0) dishes = await resolveDishIdsToNames(dishIds);
            return {
              packageId: id,
              code: s.code,
              label: s.label,
              type: s.type,
              choiceLimit: s.type === "wybor" ? (s.choiceLimit ?? null) : null,
              dishes,
              ...(dishIds.length ? { dishIds } : {}),
              sortOrder: i,
            };
          }
        )
      );
      await prisma.menuPackageSection.createMany({ data: sectionsData });
    }

    if (body.surcharges?.length) {
      await prisma.menuPackageSurcharge.createMany({
        data: body.surcharges.map(
          (
            d: {
              code: string;
              label: string;
              pricePerPerson?: number;
              flatPrice?: number;
              hasChoice?: boolean;
              choiceLimit?: number;
              options?: string[];
              description?: string;
            },
            i: number
          ) => ({
            packageId: id,
            code: d.code,
            label: d.label,
            pricePerPerson: d.pricePerPerson ?? null,
            flatPrice: d.flatPrice ?? null,
            hasChoice: d.hasChoice ?? false,
            choiceLimit: d.choiceLimit ?? null,
            options: d.options ?? null,
            description: d.description ?? null,
            sortOrder: i,
          })
        ),
      });
    }

    const result = await prisma.menuPackage.findUnique({
      where: { id },
      include: {
        sections: { orderBy: { sortOrder: "asc" } },
        surcharges: { orderBy: { sortOrder: "asc" } },
      },
    });
    return NextResponse.json(result);
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "P2025") {
      return NextResponse.json({ error: "Pakiet nie istnieje" }, { status: 404 });
    }
    throw e;
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.menuPackage.update({
    where: { id },
    data: { isActive: false },
  });
  return NextResponse.json({ success: true });
}
