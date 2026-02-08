import { NextRequest, NextResponse } from "next/server";

/**
 * Jeśli w .env ustawiono EXTERNAL_API_KEY, wymagany jest nagłówek:
 * - X-API-Key: <key>
 * lub
 * - Authorization: Bearer <key>
 * Zwraca null gdy autoryzacja OK, lub NextResponse z 401 gdy wymagany klucz i brak/niepoprawny.
 */
export function requireExternalApiKey(request: NextRequest): NextResponse | null {
  const key = process.env.EXTERNAL_API_KEY;
  if (!key || key.trim() === "") return null;

  const headerKey = request.headers.get("x-api-key")?.trim();
  const authHeader = request.headers.get("authorization");
  const bearerKey = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  const provided = headerKey ?? bearerKey;

  if (!provided || provided !== key) {
    return NextResponse.json(
      { error: "Brak lub nieprawidłowy klucz API. Użyj nagłówka X-API-Key lub Authorization: Bearer <key>." },
      { status: 401 }
    );
  }
  return null;
}
