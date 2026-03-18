/**
 * Klient AICO – zdalna diagnostyka agentów (np. PC02 recepcja).
 * Używany przez server actions do wywołania capability (printer.list, process.list itd.).
 */

const AICO_API_URL = process.env.AICO_API_URL?.trim() || "";
const AICO_USERNAME = process.env.AICO_USERNAME?.trim() || "";
const AICO_PASSWORD = process.env.AICO_PASSWORD?.trim() || "";
const AICO_TOKEN = process.env.AICO_TOKEN?.trim() || "";
const AICO_TIMEOUT_MS = Math.min(
  Math.max(Number(process.env.AICO_TIMEOUT_MS) || 15000, 3000),
  60000
);

export interface AicoConfig {
  configured: boolean;
  baseUrl: string;
}

/**
 * Sprawdza czy AICO jest skonfigurowane (bez wysyłania żądań).
 */
export function getAicoConfig(): AicoConfig {
  const baseUrl = AICO_API_URL.replace(/\/+$/, "") || "";
  return {
    configured: !!baseUrl && (!!AICO_TOKEN || (!!AICO_USERNAME && !!AICO_PASSWORD)),
    baseUrl,
  };
}

async function getToken(): Promise<string> {
  if (AICO_TOKEN) return AICO_TOKEN;
  if (!AICO_USERNAME || !AICO_PASSWORD) {
    throw new Error("AICO nie skonfigurowane: ustaw AICO_API_URL oraz AICO_USERNAME i AICO_PASSWORD (lub AICO_TOKEN) w .env");
  }
  const baseUrl = AICO_API_URL.replace(/\/+$/, "");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`${baseUrl}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: AICO_USERNAME, password: AICO_PASSWORD }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`AICO login HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    const token = (data?.token ?? data?.access_token) as string | undefined;
    if (!token || typeof token !== "string") {
      throw new Error("AICO login: brak tokenu w odpowiedzi");
    }
    return token;
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("AICO: timeout logowania (10s)");
    }
    throw e;
  }
}

export interface AicoAgent {
  id: string;
  name?: string;
  [key: string]: unknown;
}

export interface AicoTaskResult {
  success: boolean;
  data?: unknown;
  output?: string;
  error?: string;
  taskId?: string;
}

/**
 * Pobiera listę dostępnych agentów (komputerów) z AICO.
 * GET /api/agents — np. POS01 (POS kelnerski pos-karczma), PC02 (recepcja HotelSystem).
 */
export async function getAicoAgents(): Promise<{ success: true; agents: AicoAgent[] } | { success: false; error: string }> {
  const config = getAicoConfig();
  if (!config.configured) {
    return {
      success: false,
      error:
        "AICO nie skonfigurowane. Ustaw AICO_API_URL oraz AICO_USERNAME i AICO_PASSWORD (lub AICO_TOKEN) w .env.",
    };
  }
  let token: string;
  try {
    token = await getToken();
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd logowania do AICO",
    };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AICO_TIMEOUT_MS);
  try {
    const res = await fetch(`${config.baseUrl}/api/agents`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      const text = await res.text();
      return {
        success: false,
        error: `AICO GET /api/agents HTTP ${res.status}: ${text.slice(0, 200)}`,
      };
    }
    const raw = (await res.json().catch(() => null)) as unknown;
    const list: unknown[] | null = Array.isArray(raw)
      ? raw
      : raw && typeof raw === "object" && Array.isArray((raw as Record<string, unknown>).agents)
        ? ((raw as Record<string, unknown>).agents as unknown[])
        : null;
    if (!list) {
      return { success: false, error: "AICO: nieprawidłowa odpowiedź GET /api/agents (oczekiwano tablicy agentów)" };
    }
    const agents: AicoAgent[] = list
      .filter((a: unknown) => a && typeof a === "object" && typeof (a as Record<string, unknown>).id === "string")
      .map((a: Record<string, unknown>) => ({
        id: a.id as string,
        name: typeof a.name === "string" ? a.name : undefined,
        ...a,
      }));
    return { success: true, agents };
  } catch (e) {
    clearTimeout(timeout);
    if (e instanceof Error && e.name === "AbortError") {
      return { success: false, error: `AICO: timeout (${AICO_TIMEOUT_MS / 1000}s)` };
    }
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd połączenia z AICO",
    };
  }
}

/**
 * Wysyła zadanie do AICO (capability na agencie).
 * @param targetAgentId - np. "PC02"
 * @param capabilityId - np. "printer.list", "process.list", "service.status"
 * @param payload - opcjonalny payload (np. service_name dla service.status)
 */
export async function runAicoTask(
  targetAgentId: string,
  capabilityId: string,
  payload?: Record<string, unknown>
): Promise<AicoTaskResult> {
  const config = getAicoConfig();
  if (!config.configured) {
    return {
      success: false,
      error: "AICO nie skonfigurowane. Ustaw AICO_API_URL oraz AICO_USERNAME i AICO_PASSWORD (lub AICO_TOKEN) w .env.",
    };
  }

  const baseUrl = config.baseUrl;
  let token: string;
  try {
    token = await getToken();
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd logowania do AICO",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AICO_TIMEOUT_MS);
  try {
    const body: Record<string, unknown> = {
      capability_id: capabilityId,
      target_agent_id: targetAgentId,
    };
    if (payload && Object.keys(payload).length > 0) {
      body.payload = payload;
    }
    const res = await fetch(`${baseUrl}/api/tasks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const raw = await res.json().catch(() => null) as Record<string, unknown> | null;
    const data = raw ?? {};
    const errMsg = typeof data.error === "string" ? data.error : undefined;

    if (!res.ok) {
      return {
        success: false,
        error: errMsg ?? `AICO HTTP ${res.status}`,
        data: data,
      };
    }

    const result = data.result ?? data.output ?? data.data ?? data;
    const taskId = typeof data.task_id === "string" ? data.task_id : undefined;
    const output = typeof data.output === "string" ? data.output : undefined;

    return {
      success: true,
      data: result,
      output: output ?? (typeof result === "string" ? result : undefined),
      taskId,
      error: typeof data.error === "string" ? data.error : undefined,
    };
  } catch (e) {
    clearTimeout(timeout);
    if (e instanceof Error && e.name === "AbortError") {
      return { success: false, error: `AICO: timeout (${AICO_TIMEOUT_MS / 1000}s)` };
    }
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd połączenia z AICO",
    };
  }
}
