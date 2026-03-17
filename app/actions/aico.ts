"use server";

import { getAicoConfig, runAicoTask, type AicoTaskResult } from "@/lib/aico-client";

const RECEPCJA_AGENT_ID = process.env.AICO_RECEPCJA_AGENT_ID?.trim() || "PC02";

/**
 * Zwraca czy AICO jest skonfigurowane (bez wywołania API).
 */
export async function getAicoConfigAction(): Promise<{ configured: boolean; baseUrl: string }> {
  const config = getAicoConfig();
  return { configured: config.configured, baseUrl: config.baseUrl };
}

/**
 * Uruchamia diagnostykę AICO na agencie recepcji (domyślnie PC02).
 * capabilityId: printer.list | process.list | service.status | disk.usage | log.read
 * payload: opcjonalnie np. { service_name: "nazwa" } dla service.status
 */
export async function runAicoDiagnosticAction(
  capabilityId: "printer.list" | "printer.status" | "process.list" | "service.status" | "disk.usage" | "log.read",
  payload?: Record<string, unknown>
): Promise<AicoTaskResult> {
  return runAicoTask(RECEPCJA_AGENT_ID, capabilityId, payload);
}
