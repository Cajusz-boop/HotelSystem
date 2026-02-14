import { NextRequest, NextResponse } from "next/server";
import { findOrCreateGuestByOAuth } from "@/app/actions/guest-auth";

const FACEBOOK_TOKEN_URL = "https://graph.facebook.com/v18.0/oauth/access_token";
const FACEBOOK_GRAPH_URL = "https://graph.facebook.com/me";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const errorParam = request.nextUrl.searchParams.get("error");
  const baseUrl = process.env.NEXTAUTH_URL || request.nextUrl.origin;
  const redirectUri = `${baseUrl}/api/auth/guest/facebook/callback`;
  const guestAppUrl = process.env.GUEST_APP_URL || "/guest-app";

  if (errorParam) {
    return NextResponse.redirect(`${guestAppUrl}?error=${encodeURIComponent(errorParam)}`);
  }
  if (!code) {
    return NextResponse.redirect(`${guestAppUrl}?error=missing_code`);
  }

  const appId = process.env.FACEBOOK_APP_ID?.trim();
  const appSecret = process.env.FACEBOOK_APP_SECRET?.trim();
  if (!appId || !appSecret) {
    return NextResponse.redirect(`${guestAppUrl}?error=config`);
  }

  try {
    const tokenRes = await fetch(
      `${FACEBOOK_TOKEN_URL}?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${encodeURIComponent(code)}`,
      { method: "GET" }
    );
    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      return NextResponse.redirect(`${guestAppUrl}?error=token&msg=${encodeURIComponent(err.slice(0, 100))}`);
    }
    const tokenData = (await tokenRes.json()) as { access_token?: string };
    const accessToken = tokenData.access_token;
    if (!accessToken) {
      return NextResponse.redirect(`${guestAppUrl}?error=no_token`);
    }

    const userRes = await fetch(
      `${FACEBOOK_GRAPH_URL}?fields=id,email,name,picture.type(large)&access_token=${encodeURIComponent(accessToken)}`
    );
    if (!userRes.ok) {
      return NextResponse.redirect(`${guestAppUrl}?error=userinfo`);
    }
    const user = (await userRes.json()) as {
      email?: string;
      name?: string;
      picture?: { data?: { url?: string } };
    };
    const email = user.email?.trim();
    const name = (user.name || user.email || "Gość").trim();
    const picture = user.picture?.data?.url?.trim();

    const result = await findOrCreateGuestByOAuth(email ?? "", name, picture);
    if (!result.success) {
      return NextResponse.redirect(`${guestAppUrl}?error=${encodeURIComponent(result.error)}`);
    }
    return NextResponse.redirect(guestAppUrl);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.redirect(`${guestAppUrl}?error=${encodeURIComponent(msg)}`);
  }
}
