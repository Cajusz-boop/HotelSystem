"use server";

import { prisma } from "@/lib/db";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface DerivedRateRuleForUi {
  id: string;
  name: string;
  type: string;
  value: number;
  description: string | null;
}

/** Lista reguł cennika pochodnego (np. +10% śniadanie, +40 PLN bezzwrotna). */
export async function getDerivedRules(): Promise<
  ActionResult<DerivedRateRuleForUi[]>
> {
  try {
    const list = await prisma.derivedRateRule.findMany({
      orderBy: { name: "asc" },
    });
    return {
      success: true,
      data: list.map((r) => ({
        id: r.id,
        name: r.name,
        type: r.type,
        value: Number(r.value),
        description: r.description,
      })),
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd odczytu reguł",
    };
  }
}

/**
 * Stosuje reguły pochodne do kwoty bazowej (np. cena noclegów + śniadanie +10%).
 * Zwraca: { total, breakdown: { base, additions: [{ name, amount }] } }.
 */
export async function applyDerivedRules(
  baseAmount: number,
  ruleIds?: string[]
): Promise<
  ActionResult<{ total: number; breakdown: { base: number; additions: Array<{ name: string; amount: number }> } }>
> {
  try {
    const rules = ruleIds?.length
      ? await prisma.derivedRateRule.findMany({
          where: { id: { in: ruleIds } },
        })
      : await prisma.derivedRateRule.findMany();
    const additions: Array<{ name: string; amount: number }> = [];
    let total = baseAmount;
    for (const r of rules) {
      const value = Number(r.value);
      const amount =
        r.type === "PERCENT_ADD"
          ? Math.round((baseAmount * value) / 100 * 100) / 100
          : r.type === "FIXED_ADD"
            ? value
            : 0;
      if (amount > 0) {
        additions.push({ name: r.name, amount });
        total += amount;
      }
    }
    return {
      success: true,
      data: {
        total: Math.round(total * 100) / 100,
        breakdown: { base: baseAmount, additions },
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd stosowania reguł",
    };
  }
}

/** Tworzy regułę pochodną. */
export async function createDerivedRule(data: {
  name: string;
  type: "PERCENT_ADD" | "FIXED_ADD";
  value: number;
  description?: string | null;
}): Promise<ActionResult<DerivedRateRuleForUi>> {
  try {
    const created = await prisma.derivedRateRule.create({
      data: {
        name: data.name,
        type: data.type,
        value: data.value,
        description: data.description ?? null,
      },
    });
    return {
      success: true,
      data: {
        id: created.id,
        name: created.name,
        type: created.type,
        value: Number(created.value),
        description: created.description,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd zapisu reguły",
    };
  }
}
