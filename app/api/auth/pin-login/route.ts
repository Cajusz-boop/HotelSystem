import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSessionToken, verifyPin, COOKIE_NAME } from "@/lib/auth";
import { getClientIp } from "@/lib/audit";
import { headers } from "next/headers";

const LOCKOUT_ATTEMPTS = 3;
const LOCKOUT_MINUTES = 5;

// BUG 6: Memory management constants
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ENTRIES = 1000;

const failedAttempts = new Map<
  string,
  { count: number; lockedUntil: Date }
>();

// BUG 6: Periodic cleanup of expired lockouts
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = new Date();
    for (const [key, value] of failedAttempts.entries()) {
      if (value.lockedUntil < now) {
        failedAttempts.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS);
}

export async function POST(request: NextRequest) {
  try {
    // BUG 6: Emergency cleanup if map too large
    if (failedAttempts.size > MAX_ENTRIES) {
      const now = new Date();
      for (const [key, value] of failedAttempts.entries()) {
        if (value.lockedUntil < now) {
          failedAttempts.delete(key);
        }
      }
    }

    const body = await request.json();
    const { userId, pin } = body;

    if (!userId || !pin) {
      return NextResponse.json(
        { error: "Wymagany userId i pin" },
        { status: 400 }
      );
    }

    if (!/^\d{4}$/.test(pin)) {
      return NextResponse.json(
        { error: "PIN musi składać się z 4 cyfr" },
        { status: 400 }
      );
    }

    const now = new Date();
    const lock = failedAttempts.get(userId);
    if (lock && now < lock.lockedUntil) {
      const remaining = Math.ceil((lock.lockedUntil.getTime() - now.getTime()) / 60000);
      return NextResponse.json(
        { error: `Konto zablokowane. Spróbuj za ${remaining} min.`, locked: true },
        { status: 423 }
      );
    }
    if (lock) failedAttempts.delete(userId);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        pin: true,
        isActive: true,
      },
    });

    // Get IP early for logging
    const headersList = await headers();
    const ip = getClientIp(headersList);

    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: "Nieprawidłowy użytkownik" },
        { status: 401 }
      );
    }

    if (!user.pin) {
      return NextResponse.json(
        { error: "PIN nie ustawiony. Użyj logowania przez email/hasło." },
        { status: 401 }
      );
    }

    const valid = await verifyPin(pin, user.pin);
    if (!valid) {
      const prev = failedAttempts.get(userId);
      const count = (prev?.count ?? 0) + 1;

      // Log failed attempt
      await prisma.loginLog.create({
        data: {
          email: user.email,
          userId: user.id,
          success: false,
          ipAddress: ip,
        },
      }).catch((err) => {
        console.error("Failed to log unsuccessful PIN attempt:", err);
      });

      if (count >= LOCKOUT_ATTEMPTS) {
        const lockedUntil = new Date(now.getTime() + LOCKOUT_MINUTES * 60 * 1000);
        failedAttempts.set(userId, { count, lockedUntil });
        return NextResponse.json(
          {
            error: `Błędny PIN 3 razy. Konto zablokowane na ${LOCKOUT_MINUTES} min.`,
            locked: true,
          },
          { status: 423 }
        );
      }
      failedAttempts.set(userId, {
        count,
        lockedUntil: prev?.lockedUntil ?? now,
      });
      return NextResponse.json(
        { error: `Błędny PIN (${count}/${LOCKOUT_ATTEMPTS})` },
        { status: 401 }
      );
    }

    // Clear failed attempts on success
    failedAttempts.delete(userId);

    // Log successful login
    await prisma.loginLog.create({
      data: { email: user.email, userId: user.id, success: true, ipAddress: ip },
    });

    const session = await createSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    const res = NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
      },
    });

    res.cookies.set(COOKIE_NAME, session.value, session.options);

    return res;
  } catch (e) {
    console.error("PIN login error:", e);
    return NextResponse.json(
      { error: "Błąd logowania" },
      { status: 500 }
    );
  }
}
