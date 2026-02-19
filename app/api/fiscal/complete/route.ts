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

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "DB error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
