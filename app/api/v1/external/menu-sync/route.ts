import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireExternalApiKey } from "@/lib/api-auth";
import { checkApiRateLimit } from "@/lib/rate-limit";

interface MenuSyncItem {
  externalId: string; // np. AssortmentID z Bistro
  name: string;
  price: number;
  category: string;
}

interface MenuSyncBody {
  items: MenuSyncItem[];
}

/**
 * POST /api/v1/external/menu-sync
 * Synchronizacja karty dań z Bistro (assortment → MenuItem).
 * Tworzy lub aktualizuje pozycje według externalId.
 *
 * Body: { items: [{ externalId, name, price, category }] }
 *
 * Autoryzacja: X-API-Key lub Authorization: Bearer
 */
export async function POST(request: NextRequest) {
  const rateLimitRes = checkApiRateLimit(request);
  if (rateLimitRes) return rateLimitRes;
  const authError = requireExternalApiKey(request);
  if (authError) return authError;

  try {
    const body = (await request.json()) as MenuSyncBody;
    const { items } = body;

    if (!Array.isArray(items)) {
      return NextResponse.json(
        { error: "Wymagane pole: items (tablica obiektów)" },
        { status: 400 }
      );
    }

    let created = 0;
    let updated = 0;

    for (const item of items) {
      const { externalId, name, price, category } = item;
      if (!externalId || typeof name !== "string" || name.trim() === "") continue;
      const priceNum = typeof price === "number" ? price : parseFloat(String(price));
      if (Number.isNaN(priceNum) || priceNum < 0) continue;

      const ext = String(externalId).trim();
      const cat = typeof category === "string" && category.trim() ? category.trim() : "Inne";

      const existing = await prisma.menuItem.findFirst({
        where: { externalId: ext },
      });

      if (existing) {
        await prisma.menuItem.update({
          where: { id: existing.id },
          data: {
            name: name.trim(),
            price: priceNum,
            category: cat,
          },
        });
        updated++;
      } else {
        await prisma.menuItem.create({
          data: {
            externalId: ext,
            name: name.trim(),
            price: priceNum,
            category: cat,
          },
        });
        created++;
      }
    }

    return NextResponse.json({
      success: true,
      created,
      updated,
      total: items.length,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Błąd serwera" },
      { status: 500 }
    );
  }
}
