import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkKsefInvoiceStatus } from "@/app/actions/ksef";

const MAX_PENDING_AGE_MS = 5 * 60 * 1000; // 5 min – po tym czasie uznaj za timeout (nie usuwamy PENDING, tylko nie pollujemy starszych)

/**
 * GET/POST /api/cron/ksef-poll-status
 * Polling statusu faktur w statusie PENDING (wywoływane co ok. 10 s przez crona).
 * Max 5 min – faktury PENDING starsze niż 5 min nie są odpytywane (timeout).
 * Opcjonalnie: Authorization: Bearer <CRON_SECRET>.
 */
export async function GET(request: NextRequest) {
  return runPoll(request);
}

export async function POST(request: NextRequest) {
  return runPoll(request);
}

async function runPoll(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization");
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : "";
    if (token !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const deadline = new Date(Date.now() - MAX_PENDING_AGE_MS);
  const pending = await prisma.invoice.findMany({
    where: {
      ksefStatus: "PENDING",
      ksefReferenceNumber: { not: null },
      createdAt: { gte: deadline },
    },
    select: { id: true },
    take: 50,
  });

  let ok = 0;
  let err = 0;
  for (const inv of pending) {
    const result = await checkKsefInvoiceStatus(inv.id);
    if (result.success) ok++;
    else err++;
  }

  return NextResponse.json({
    polled: pending.length,
    updated: ok,
    failed: err,
  });
}
