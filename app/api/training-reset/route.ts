import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";

/**
 * GET /api/training-reset
 *
 * Resetuje dane treningowe (seed) — TYLKO gdy NEXT_PUBLIC_APP_URL zawiera /training.
 * Wymaga uprawnień admin.settings.
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_APP_URL ?? "";
  if (!url.includes("/training")) {
    return Response.json(
      { error: "Niedostępne na produkcji" },
      { status: 403 }
    );
  }
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Brak uprawnień" }, { status: 401 });
  }
  const allowed = await can(session.role, "admin.settings");
  if (!allowed) {
    return Response.json({ error: "Brak uprawnień" }, { status: 401 });
  }
  try {
    const { seedTraining } = await import("@/prisma/seed-training");
    await seedTraining();
    return Response.json({ ok: true, message: "Dane zresetowane" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: "Błąd resetu", detail: msg }, { status: 500 });
  }
}
