/**
 * KSeF (Krajowy System e-Faktur) – autoryzacja i sesja.
 * Pobieranie klucza publicznego MF (AuthorisationChallenge), generowanie InitSessionTokenRequest (XML + szyfrowanie RSA).
 */

import * as crypto from "crypto";

import { getEffectiveKsefEnv } from "./env";

const KSEF_TEST_URL = "https://ksef-test.mf.gov.pl";
const KSEF_PROD_URL = "https://ksef.mf.gov.pl";

function getKsefBaseUrl(): string {
  if (process.env.KSEF_BASE_URL) return process.env.KSEF_BASE_URL.replace(/\/$/, "");
  if (getEffectiveKsefEnv() === "test") return process.env.KSEF_TEST_URL ?? KSEF_TEST_URL;
  return process.env.KSEF_PROD_URL ?? KSEF_PROD_URL;
}

export interface AuthorisationChallengeResponse {
  /** Klucz publiczny MF (base64 lub PEM) – do szyfrowania InitSessionTokenRequest */
  challenge?: string;
  /** Klucz publiczny w formacie PEM (jeśli API zwraca inny format, używany do RSA) */
  publicKey?: string;
  [key: string]: unknown;
}

/**
 * Pobiera klucz publiczny MF (GET /api/online/Session/AuthorisationChallenge).
 * Zwraca odpowiedź z challenge / danymi do autoryzacji sesji KSeF.
 */
export async function getAuthorisationChallenge(): Promise<
  { success: true; data: AuthorisationChallengeResponse } | { success: false; error: string }
> {
  const baseUrl = getKsefBaseUrl();
  const url = `${baseUrl}/api/online/Session/AuthorisationChallenge`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      return {
        success: false,
        error: `KSeF AuthorisationChallenge: ${res.status} ${text.slice(0, 200)}`,
      };
    }

    const data = (await res.json()) as AuthorisationChallengeResponse;
    return { success: true, data };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd połączenia z KSeF",
    };
  }
}

function escapeXml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Generuje XML InitSessionTokenRequest (struktura zgodna z KSeF).
 * NIP – 10 znaków, Context – opcjonalny identyfikator kontekstu.
 */
export function buildInitSessionTokenRequestXml(params: {
  nip: string;
  contextIdentifier?: string;
}): string {
  const nip = String(params.nip).replace(/\s/g, "").slice(0, 10);
  const ctx = params.contextIdentifier?.trim();
  const ns = "http://ksef.mf.gov.pl/schema/gtw/svc/upo/authorisation/2021/10/0000000001";
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<InitSessionTokenRequest xmlns="${ns}">`,
    `  <NIP>${escapeXml(nip)}</NIP>`,
  ];
  if (ctx) {
    lines.push(`  <Context>${escapeXml(ctx)}</Context>`);
  }
  lines.push("</InitSessionTokenRequest>");
  return lines.join("\n");
}

/**
 * Szyfruje dane (XML) kluczem publicznym RSA MF.
 * publicKeyPem – klucz w formacie PEM (np. z AuthorisationChallenge).
 * Zwraca zaszyfrowane dane w base64.
 */
export function encryptWithMfPublicKey(xml: string, publicKeyPem: string): string {
  const buf = Buffer.from(xml, "utf8");
  const encrypted = crypto.publicEncrypt(
    {
      key: publicKeyPem,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    buf
  );
  return encrypted.toString("base64");
}

/**
 * Generuje InitSessionTokenRequest (XML) i szyfruje go kluczem publicznym MF.
 * challengeData – odpowiedź z getAuthorisationChallenge() (zawiera klucz publiczny).
 */
export function buildAndEncryptInitSessionTokenRequest(params: {
  nip: string;
  contextIdentifier?: string;
  /** Klucz publiczny MF (PEM lub base64 – jeśli base64, opakowujemy w PEM) */
  publicKeyFromChallenge: string;
}): { success: true; encryptedBase64: string; xml: string } | { success: false; error: string } {
  try {
    const xml = buildInitSessionTokenRequestXml({
      nip: params.nip,
      contextIdentifier: params.contextIdentifier,
    });
    let pem = params.publicKeyFromChallenge.trim();
    if (!pem.includes("-----BEGIN")) {
      pem = `-----BEGIN PUBLIC KEY-----\n${pem.replace(/\s/g, "").replace(/(.{64})/g, "$1\n")}\n-----END PUBLIC KEY-----`;
    }
    const encryptedBase64 = encryptWithMfPublicKey(xml, pem);
    return { success: true, encryptedBase64, xml };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd generowania/szyfrowania InitSessionTokenRequest",
    };
  }
}

/**
 * Challenge-Response (InitiateToken): podpisanie wyzwania tokenem autoryzacyjnym.
 * Token autoryzacyjny (z portalu MF / KSeF) używany do podpisu wyzwania – zwraca podpis w base64.
 * Dla tokenu w formacie klucza prywatnego PEM – podpis RSA-SHA256.
 */
export function signChallengeWithAuthToken(
  challenge: string,
  authTokenOrPrivateKeyPem: string
): { success: true; signatureBase64: string } | { success: false; error: string } {
  try {
    const isPem = authTokenOrPrivateKeyPem.includes("-----BEGIN");
    if (isPem) {
      const sign = crypto.createSign("RSA-SHA256");
      sign.update(challenge, "utf8");
      sign.end();
      const sig = sign.sign(authTokenOrPrivateKeyPem);
      return { success: true, signatureBase64: sig.toString("base64") };
    }
    // Token jako ciąg znaków (np. hasło/token z portalu) – HMAC-SHA256
    const hmac = crypto.createHmac("sha256", authTokenOrPrivateKeyPem);
    hmac.update(challenge, "utf8");
    const sig = hmac.digest();
    return { success: true, signatureBase64: sig.toString("base64") };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd podpisywania wyzwania",
    };
  }
}

export interface InitSessionResponse {
  sessionToken: string;
  contextIdentifier: string;
  [key: string]: unknown;
}

/**
 * Wysyła żądanie inicjacji sesji KSeF (POST /api/online/Session/InitSession).
 * body – zaszyfrowany InitSessionTokenRequest (base64) lub JSON/XML zgodnie z API.
 * Zwraca sessionToken i contextIdentifier z odpowiedzi.
 */
export async function initSession(encryptedRequestBase64: string): Promise<
  { success: true; data: InitSessionResponse } | { success: false; error: string }
> {
  const baseUrl = getKsefBaseUrl();
  const url = `${baseUrl}/api/online/Session/InitSession`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        initSessionTokenRequest: encryptedRequestBase64,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return {
        success: false,
        error: `KSeF InitSession: ${res.status} ${text.slice(0, 300)}`,
      };
    }

    const data = (await res.json()) as Record<string, unknown>;
    const sessionToken = data?.sessionToken ?? data?.SessionToken;
    const contextIdentifier = data?.contextIdentifier ?? data?.ContextIdentifier;

    if (typeof sessionToken !== "string" || !sessionToken) {
      return { success: false, error: "Brak sessionToken w odpowiedzi KSeF" };
    }

    return {
      success: true,
      data: {
        sessionToken: String(sessionToken),
        contextIdentifier: typeof contextIdentifier === "string" ? contextIdentifier : "",
        ...data,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd wywołania InitSession",
    };
  }
}

/**
 * Zamyka sesję KSeF (POST /api/online/Session/Terminate).
 * sessionToken – token sesji (w nagłówku Authorization lub w body, zależnie od API).
 */
export async function terminateSession(sessionToken: string): Promise<
  { success: true } | { success: false; error: string }
> {
  const baseUrl = getKsefBaseUrl();
  const url = `${baseUrl}/api/online/Session/Terminate`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({}),
    });

    if (!res.ok) {
      const text = await res.text();
      return {
        success: false,
        error: `KSeF Terminate: ${res.status} ${text.slice(0, 200)}`,
      };
    }
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd wywołania Terminate",
    };
  }
}

/**
 * Status sesji KSeF (GET /api/online/Session/Status) – używane do KeepAlive.
 */
export async function getSessionStatus(sessionToken: string): Promise<
  { success: true; active?: boolean } | { success: false; error: string }
> {
  const baseUrl = getKsefBaseUrl();
  const url = `${baseUrl}/api/online/Session/Status`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      return {
        success: false,
        error: `KSeF Status: ${res.status} ${text.slice(0, 200)}`,
      };
    }
    const data = (await res.json()) as { active?: boolean };
    return { success: true, active: data?.active };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd wywołania Status",
    };
  }
}
