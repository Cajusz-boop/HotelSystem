import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

// GET — lista pakietów (z sekcjami i dopłatami)
// ?includeInactive=true — zwraca także nieaktywne (do zarządzania)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const eventType = searchParams.get("eventType");
  const includeInactive = searchParams.get("includeInactive") === "true";

  const all = await prisma.menuPackage.findMany({
    where: includeInactive ? {} : { isActive: true },
    include: {
      sections: { orderBy: { sortOrder: "asc" } },
      surcharges: { orderBy: { sortOrder: "asc" } },
    },
    orderBy: { sortOrder: "asc" },
  });

  const filtered = eventType
    ? all.filter((p) => (p.eventTypes as string[]).includes(eventType))
    : all;

  return NextResponse.json(filtered);
}

// POST — nowy pakiet
export async function POST(req: Request) {
  const body = await req.json();
  const code = body.code || `pkg_${Date.now()}`;

  const created = await prisma.menuPackage.create({
    data: {
      code,
      name: body.name || "Nowy pakiet",
      price: body.price ?? 0,
      eventTypes: body.eventTypes || [],
      isActive: true,
      sortOrder: body.sortOrder ?? 99,
      rules: body.rules || null,
      sections: {
        create: (body.sections || []).map((s: Record<string, unknown>, i: number) => ({
          code: (s.code as string) || `sekcja_${i}`,
          label: (s.label as string) || `Sekcja ${i + 1}`,
          type: (s.type as string) || "fixed",
          choiceLimit: s.type === "wybor" ? ((s.choiceLimit as number) ?? null) : null,
          dishes: (s.dishes as string[]) || [],
          sortOrder: i,
        })),
      },
      surcharges: {
        create: (body.surcharges || []).map((d: Record<string, unknown>, i: number) => ({
          code: (d.code as string) || `doplata_${i}`,
          label: (d.label as string) || `Dopłata ${i + 1}`,
          pricePerPerson: (d.pricePerPerson as number) ?? null,
          flatPrice: (d.flatPrice as number) ?? null,
          hasChoice: Boolean(d.hasChoice),
          choiceLimit: (d.choiceLimit as number) ?? null,
          options: (d.options as string[]) ?? null,
          description: (d.description as string) ?? null,
          sortOrder: i,
        })),
      },
    },
    include: {
      sections: { orderBy: { sortOrder: "asc" } },
      surcharges: { orderBy: { sortOrder: "asc" } },
    },
  });

  return NextResponse.json(created);
}
