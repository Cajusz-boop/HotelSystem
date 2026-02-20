"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const BRIDGE_BASE = "http://127.0.0.1:9977";
/** Event wysyłany gdy job został dodany do kolejki (np. po rozliczeniu) – przyspiesza poll. */
export const FISCAL_JOB_ENQUEUED_EVENT = "fiscal-job-enqueued";
const POLL_INTERVAL_MS = 3000;

type JobType = "receipt" | "invoice" | "report_x" | "report_z" | "report_periodic" | "storno";

interface PendingJob {
  id: string;
  type: JobType;
  payload: Record<string, unknown>;
}

const TYPE_TO_ENDPOINT: Record<JobType, string> = {
  receipt: "/fiscal/print",
  invoice: "/fiscal/invoice",
  report_x: "/fiscal/report/x",
  report_z: "/fiscal/report/z",
  report_periodic: "/fiscal/report/periodic",
  storno: "/fiscal/storno",
};

async function fetchPendingJob(): Promise<PendingJob | null> {
  try {
    const res = await fetch("/api/fiscal/pending", { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return data.job ?? null;
  } catch {
    return null;
  }
}

async function sendToBridge(job: PendingJob): Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }> {
  const endpoint = TYPE_TO_ENDPOINT[job.type];
  if (!endpoint) {
    return { success: false, error: `Unknown job type: ${job.type}` };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(`${BRIDGE_BASE}${endpoint}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(job.payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return { success: false, error: data?.error ?? `Bridge HTTP ${res.status}` };
    }
    return { success: true, data };
  } catch (e) {
    const msg = e instanceof Error
      ? e.name === "AbortError" ? "Bridge timeout (10s)" : e.message
      : "Bridge connection error";
    return { success: false, error: msg };
  }
}

async function reportResult(jobId: string, success: boolean, result?: Record<string, unknown>, error?: string) {
  try {
    await fetch("/api/fiscal/complete", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jobId, success, result, error }),
    });
  } catch {
    // Best-effort — job stays in "processing" and can be retried
  }
}

/**
 * Invisible component that polls the server for pending fiscal jobs
 * and forwards them to the local POSNET bridge on localhost:9977.
 *
 * Only works on the computer where the bridge is running.
 * On other computers, bridge requests simply fail silently.
 */
export function FiscalRelay() {
  const [bridgeAvailable, setBridgeAvailable] = useState<boolean | null>(null);
  const processing = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    let mounted = true;

    async function checkBridge() {
      try {
        const res = await fetch(`${BRIDGE_BASE}/health`, { signal: AbortSignal.timeout(3000) });
        if (mounted) setBridgeAvailable(res.ok);
      } catch {
        if (mounted) setBridgeAvailable(false);
      }
    }

    checkBridge();
    const healthInterval = setInterval(checkBridge, 30000);

    return () => {
      mounted = false;
      clearInterval(healthInterval);
    };
  }, []);

  const pollTriggerRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (bridgeAvailable !== true) return;

    let mounted = true;

    async function poll() {
      if (!mounted || processing.current) return;

      processing.current = true;
      try {
        const job = await fetchPendingJob();
        if (job) {
          const result = await sendToBridge(job);
          await reportResult(job.id, result.success, result.data ?? undefined, result.error);
          if (!result.success) {
            toast.error(`Nie udało się wydrukować dokumentu fiskalnego: ${result.error ?? "nieznany błąd"}`);
          }
        }
      } finally {
        processing.current = false;
      }

      if (mounted) {
        timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
      }
    }

    pollTriggerRef.current = poll;
    poll();

    const onEnqueued = () => {
      pollTriggerRef.current();
    };
    window.addEventListener(FISCAL_JOB_ENQUEUED_EVENT, onEnqueued);

    return () => {
      mounted = false;
      window.removeEventListener(FISCAL_JOB_ENQUEUED_EVENT, onEnqueued);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [bridgeAvailable]);

  // Completely invisible — no UI
  return null;
}
