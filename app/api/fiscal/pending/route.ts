import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * GET /api/fiscal/pending
 *
 * Returns the oldest pending fiscal job and atomically marks it as "processing".
 * Called by the FiscalRelay component in the browser every few seconds.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const job = await prisma.$transaction(async (tx) => {
      const pending = await tx.fiscalJob.findFirst({
        where: { status: "pending" },
        orderBy: { createdAt: "asc" },
      });

      if (!pending) return null;

      await tx.fiscalJob.update({
        where: { id: pending.id },
        data: {
          status: "processing",
          attempts: { increment: 1 },
        },
      });

      return pending;
    });

    if (!job) {
      return NextResponse.json({ job: null });
    }

    return NextResponse.json({
      job: {
        id: job.id,
        type: job.type,
        payload: job.payload,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "DB error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
