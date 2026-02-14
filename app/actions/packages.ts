"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getEffectivePropertyId } from "@/app/actions/properties";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface PackageComponentForUi {
  id: string;
  componentType: string;
  refValue: string | null;
  label: string;
  quantity: number;
  unitPrice: number;
  sortOrder: number;
}

export interface PackageForCennik {
  id: string;
  code: string;
  name: string;
  description: string | null;
  totalPrice: number | null;
  isActive: boolean;
  components: PackageComponentForUi[];
}

/** Lista pakietów z komponentami – do cennika. */
export async function getPackagesForCennik(): Promise<
  ActionResult<PackageForCennik[]>
> {
  try {
    const propertyId = await getEffectivePropertyId();
    const list = await prisma.package.findMany({
      where: { OR: [{ propertyId: null }, { propertyId: propertyId ?? undefined }] },
      include: {
        components: { orderBy: { sortOrder: "asc" } },
      },
      orderBy: { code: "asc" },
    });
    return {
      success: true,
      data: list.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        description: p.description,
        totalPrice: p.totalPrice != null ? Number(p.totalPrice) : null,
        isActive: p.isActive,
        components: p.components.map((c) => ({
          id: c.id,
          componentType: c.componentType,
          refValue: c.refValue,
          label: c.label,
          quantity: c.quantity,
          unitPrice: Number(c.unitPrice),
          sortOrder: c.sortOrder,
        })),
      })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu pakietów",
    };
  }
}

/** Lista pakietów do selecta (np. przy rezerwacji). */
export async function getPackagesForSelect(): Promise<
  ActionResult<Array<{ id: string; code: string; name: string; totalPrice: number | null }>>
> {
  try {
    const propertyId = await getEffectivePropertyId();
    const list = await prisma.package.findMany({
      where: { isActive: true, OR: [{ propertyId: null }, { propertyId: propertyId ?? undefined }] },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, totalPrice: true },
    });
    return {
      success: true,
      data: list.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        totalPrice: p.totalPrice != null ? Number(p.totalPrice) : null,
      })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu pakietów",
    };
  }
}
