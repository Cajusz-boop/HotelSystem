import { NextRequest, NextResponse } from "next/server";
import { findOrCreateGuestByOAuth } from "@/app/actions/guest-auth";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const errorParam = request.nextUrl.searchParams.get("error");
  const baseUrl = process.env.NEXTAUTH_URL || request.nextUrl.origin;
  const redirectUri = `${baseUrl}/api/auth/guest/google/callback`;
  const guestAppUrl = process.env.GUEST_APP_URL || "/guest-app";

  if (errorParam) {
    return NextResponse.redirect(`${guestAppUrl}?error=${encodeURIComponent(errorParam)}`);
  }
  if (!code) {
    return NextResponse.redirect(`${guestAppUrl}?error=missing_code`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${guestAppUrl}?error=config`);
  }

  try {
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) {
      await tokenRes.text();
      return NextResponse.redirect(`${guestAppUrl}?error=token`);
    }
    const tokenData = (await tokenRes.json()) as { access_token?: string };
    const accessToken = tokenData.access_token;
    if (!accessToken) {
      return NextResponse.redirect(`${guestAppUrl}?error=no_token`);
    }

    const userRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!userRes.ok) {
      return NextResponse.redirect(`${guestAppUrl}?error=userinfo`);
    }
    const user = (await userRes.json()) as { email?: string; name?: string; picture?: string };
    const email = user.email?.trim();
    const name = (user.name || user.email || "Gość").trim();
    const picture = user.picture?.trim();

    const result = await findOrCreateGuestByOAuth(email ?? "", name, picture);
    if (!result.success) {
      return NextResponse.redirect(`${guestAppUrl}?error=guest`);
    }
    return NextResponse.redirect(guestAppUrl);
  } catch {
    return NextResponse.redirect(`${guestAppUrl}?error=server`);
  }
}
