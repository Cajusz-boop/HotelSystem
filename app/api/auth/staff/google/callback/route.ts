import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSessionToken } from "@/lib/auth";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const stateParam = request.nextUrl.searchParams.get("state");
  const errorParam = request.nextUrl.searchParams.get("error");
  const baseUrl = process.env.NEXTAUTH_URL || request.nextUrl.origin;
  const redirectUri = `${baseUrl}/api/auth/staff/google/callback`;
  const loginUrl = `${baseUrl}/login`;

  if (errorParam) {
    return NextResponse.redirect(`${loginUrl}?error=google_denied`);
  }
  if (!code) {
    return NextResponse.redirect(`${loginUrl}?error=missing_code`);
  }

  // Verify CSRF state
  const stateCookie = request.cookies.get("oauth_state")?.value;
  if (!stateCookie || stateCookie !== stateParam) {
    return NextResponse.redirect(`${loginUrl}?error=invalid_state`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${loginUrl}?error=config`);
  }

  try {
    // Exchange authorization code for access token
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
      return NextResponse.redirect(`${loginUrl}?error=token`);
    }

    const tokenData = (await tokenRes.json()) as { access_token?: string };
    const accessToken = tokenData.access_token;
    if (!accessToken) {
      return NextResponse.redirect(`${loginUrl}?error=no_token`);
    }

    // Fetch user info from Google
    const userRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!userRes.ok) {
      return NextResponse.redirect(`${loginUrl}?error=userinfo`);
    }

    const googleUser = (await userRes.json()) as {
      email?: string;
      name?: string;
    };
    const email = googleUser.email?.trim().toLowerCase();
    if (!email) {
      return NextResponse.redirect(`${loginUrl}?error=no_email`);
    }

    // Find existing PMS user by email
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Log failed attempt
      await prisma.loginLog.create({
        data: {
          email,
          userId: null,
          success: false,
          ipAddress: getClientIp(request),
        },
      });
      return NextResponse.redirect(`${loginUrl}?error=no_account`);
    }

    // Log successful login
    await prisma.loginLog.create({
      data: {
        email: user.email,
        userId: user.id,
        success: true,
        ipAddress: getClientIp(request),
      },
    });

    // Create session — Google OAuth users skip password expiry check
    const session = await createSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      passwordExpired: false,
    });

    const response = NextResponse.redirect(baseUrl);
    response.cookies.set(session.name, session.value, session.options);
    // Clear oauth_state cookie
    response.cookies.set("oauth_state", "", { path: "/", maxAge: 0 });
    return response;
  } catch {
    return NextResponse.redirect(`${loginUrl}?error=server`);
  }
}

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}
