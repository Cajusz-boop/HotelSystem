import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Force dynamic to prevent caching user list
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // BUG 2: Only return users with PIN set (pin: { not: null })
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        pin: { not: null },
      },
      select: {
        id: true,
        name: true,
        role: true,
      },
      orderBy: { name: "asc" },
    });

    // Direct return - select already matches response shape
    return NextResponse.json(users);
  } catch (e) {
    console.error("Error fetching users for login:", e);
    return NextResponse.json(
      { error: "Błąd pobierania użytkowników" },
      { status: 500 }
    );
  }
}
