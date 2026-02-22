import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        role: true,
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(
      users.map((u) => ({
        id: u.id,
        name: u.name,
        role: u.role,
      }))
    );
  } catch (e) {
    console.error("Error fetching users:", e);
    return NextResponse.json(
      { error: "Błąd pobierania użytkowników" },
      { status: 500 }
    );
  }
}
