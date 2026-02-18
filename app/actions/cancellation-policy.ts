"use server";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { autoExportConfigSnapshot } from "@/lib/config-snapshot";

export type CancellationPolicyTemplate = {
  id: string;
  name: string;
  freeUntilDaysBefore: number; // 0 = brak darmowej anulacji
  penaltyPercent: number;      // 0–100, % ceny przy anulacji po terminie
  description?: string;
};

function normalizeEntry(e: unknown): CancellationPolicyTemplate | null {
  if (!e || typeof e !== "object") return null;
  const o = e as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : "";
  const name = typeof o.name === "string" ? o.name.trim() : "";
  const freeUntilDaysBefore = typeof o.freeUntilDaysBefore === "number" ? Math.max(0, Math.floor(o.freeUntilDaysBefore)) : 0;
  const penaltyPercent = typeof o.penaltyPercent === "number" ? Math.max(0, Math.min(100, Math.floor(o.penaltyPercent))) : 0;
  const description = typeof o.description === "string" ? o.description.trim() : undefined;
  if (!id || !name) return null;
  return { id, name, freeUntilDaysBefore, penaltyPercent, description };
}

export async function getCancellationPolicyTemplates(): Promise<
  { success: true; data: CancellationPolicyTemplate[] } | { success: false; error: string }
> {
  const session = await getSession();
  if (!session) return { success: false, error: "Zaloguj się" };
  const allowed = await can(session.role, "admin.settings");
  if (!allowed) return { success: false, error: "Brak uprawnień" };

  const row = await prisma.hotelConfig.findUnique({ where: { id: "default" } });
  const raw = row?.cancellationPolicyTemplates;
  if (!Array.isArray(raw)) return { success: true, data: [] };
  const data = raw.map(normalizeEntry).filter((e): e is CancellationPolicyTemplate => e !== null);
  return { success: true, data };
}

export async function updateCancellationPolicyTemplates(
  templates: CancellationPolicyTemplate[]
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await getSession();
  if (!session) return { success: false, error: "Zaloguj się" };
  const allowed = await can(session.role, "admin.settings");
  if (!allowed) return { success: false, error: "Brak uprawnień" };

  const normalized = templates
    .map((t) => ({
      id: t.id || `cpt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      name: String(t.name).trim() || "Polityka anulacji",
      freeUntilDaysBefore: Math.max(0, Math.floor(Number(t.freeUntilDaysBefore) || 0)),
      penaltyPercent: Math.max(0, Math.min(100, Math.floor(Number(t.penaltyPercent) || 0))),
      description: typeof t.description === "string" ? t.description.trim() : undefined,
    }))
    .filter((t) => t.name.length > 0);

  await prisma.hotelConfig.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      name: "",
      cancellationPolicyTemplates: normalized as object,
    },
    update: {
      cancellationPolicyTemplates: normalized as object,
    },
  });
  autoExportConfigSnapshot();
  return { success: true };
}
