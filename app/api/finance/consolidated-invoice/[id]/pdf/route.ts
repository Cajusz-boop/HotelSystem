import { NextRequest, NextResponse } from "next/server";

/**
 * Przekierowanie do wspólnego endpointu PDF faktury.
 * Faktura zbiorcza jest teraz Invoice (sourceType=CONSOLIDATED).
 * Zachowano dla kompatybilności wstecznej (stare linki).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id?.trim()) return new NextResponse("Brak ID faktury", { status: 400 });
  const url = new URL(request.url);
  const redirectUrl = new URL(`/api/finance/invoice/${id}/pdf`, url.origin);
  url.searchParams.forEach((v, k) => redirectUrl.searchParams.set(k, v));
  return NextResponse.redirect(redirectUrl.toString(), 307);
}
