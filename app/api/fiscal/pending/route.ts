import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/fiscal/pending
 *
 * Returns the oldest pending fiscal job and atomically marks it as "processing".
 * Called by the FiscalRelay component in the browser every few seconds.
 * 
 * Uses updateMany with status condition to prevent race conditions where
 * multiple requests could grab the same job before the update commits.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Find oldest pending job
    const pending = await prisma.fiscalJob.findFirst({
      where: { status: "pending" },
      orderBy: { createdAt: "asc" },
    });

    if (!pending) {
      return NextResponse.json({ job: null });
    }

    // Atomically update ONLY if still pending (prevents race condition)
    const updated = await prisma.fiscalJob.updateMany({
      where: {
        id: pending.id,
        status: "pending", // Only update if still pending!
      },
      data: {
        status: "processing",
        attempts: { increment: 1 },
      },
    });

    // If no rows updated, another request already grabbed this job
    if (updated.count === 0) {
      return NextResponse.json({ job: null });
    }

    return NextResponse.json({
      job: {
        id: pending.id,
        type: pending.type,
        payload: pending.payload,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "DB error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
