import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * POST — dla podanej listy nazw: znajdź lub utwórz Dish, zwróć { id, name }[]
 */
export async function POST(req: Request) {
  const body = await req.json();
  const names = Array.isArray(body.names) ? (body.names as string[]).map((n) => String(n).trim()).filter(Boolean) : [];
  if (!names.length) return NextResponse.json([]);

  const results: { id: string; name: string }[] = [];
  for (const name of names) {
    let dish = await prisma.dish.findFirst({ where: { name } });
    if (!dish) {
      dish = await prisma.dish.create({
        data: {
          name,
          defaultPrice: 0,
          vatRate: 0.08,
          isActive: true,
        },
      });
    }
    results.push({ id: dish.id, name: dish.name });
  }
  return NextResponse.json(results);
}
