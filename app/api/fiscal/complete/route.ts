import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

interface CompleteBody {
  jobId: string;
  success: boolean;
  result?: Record<string, unknown>;
  error?: string;
}

/**
 * PATCH /api/fiscal/complete
 *
 * Marks a fiscal job as done or error, storing the bridge response.
 * Called by the FiscalRelay component after forwarding the job to the local bridge.
 */
export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: CompleteBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.jobId || typeof body.success !== "boolean") {
    return NextResponse.json({ error: "Missing jobId or success" }, { status: 400 });
  }

  try {
    await prisma.fiscalJob.update({
      where: { id: body.jobId },
      data: {
        status: body.success ? "done" : "error",
        result: body.result ? JSON.parse(JSON.stringify(body.result)) : undefined,
        error: body.error ?? null,
      },
    });

    if (body.success && body.result && typeof body.result === "object") {
      const result = body.result as { receiptNumber?: string };
      const receiptNumber = result.receiptNumber && String(result.receiptNumber).trim();
      if (receiptNumber && !receiptNumber.startsWith("PAR-")) {
        try {
          const job = await prisma.fiscalJob.findUnique({
            where: { id: body.jobId },
            select: { type: true, payload: true },
          });
          if (job?.type === "receipt" && job.payload && typeof job.payload === "object") {
            const payload = job.payload as { reservationId?: string; reservationIds?: string[] };
            const ids = Array.isArray(payload.reservationIds) && payload.reservationIds.length > 0
              ? payload.reservationIds
              : payload.reservationId
                ? [payload.reservationId]
                : [];
            const receiptDate = new Date();
            for (const reservationId of ids) {
              try {
                const existing = await prisma.reservation.findUnique({
                  where: { id: reservationId },
                  select: { receiptNumber: true },
                });
                if (!existing?.receiptNumber) {
                  await prisma.reservation.update({
                    where: { id: reservationId },
                    data: { receiptNumber, receiptDate },
                  });
                }
              } catch {
                // błąd zapisu dla jednej rezerwacji nie przerywa
              }
            }
          }
        } catch {
          // błąd odczytu joba/zapisu rezerwacji nie zmienia odpowiedzi 200
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "DB error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
