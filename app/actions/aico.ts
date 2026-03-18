"use server";

import {
  getAicoAgents,
  getAicoConfig,
  runAicoTask,
  type AicoTaskResult,
} from "@/lib/aico-client";

const RECEPCJA_AGENT_ID = process.env.AICO_RECEPCJA_AGENT_ID?.trim() || "PC02";

/**
 * Zwraca czy AICO jest skonfigurowane (bez wywołania API).
 */
export async function getAicoConfigAction(): Promise<{ configured: boolean; baseUrl: string }> {
  const config = getAicoConfig();
  return { configured: config.configured, baseUrl: config.baseUrl };
}

/**
 * Pobiera listę dostępnych agentów (komputerów) z AICO.
 * Np. POS01 = POS kelnerski (pos-karczma), PC02 = komputer recepcji (HotelSystem).
 */
export async function getAicoAgentsAction(): Promise<
  { success: true; agents: { id: string; name?: string }[] } | { success: false; error: string }
> {
  return getAicoAgents();
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

/**
 * Uruchamia capability script.run na dowolnym agencie (POS01, PC02, itd.).
 * Wzorzec jak runAicoDiagnosticAction — capability_id: "script.run", target_agent_id: agentId.
 * Payload zależy od AICO (np. { script: "path lub komenda", args?: [] }).
 */
export async function runAicoScriptAction(
  agentId: string,
  payload: Record<string, unknown>
): Promise<AicoTaskResult> {
  return runAicoTask(agentId, "script.run", payload);
}
