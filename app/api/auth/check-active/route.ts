import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  // Tylko wewnętrzne wywołania z middleware
  const secret = req.headers.get("x-internal-secret");
  if (secret !== process.env.SESSION_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isActive: true },
    });

    return NextResponse.json({ isActive: user?.isActive ?? false });
  } catch {
    return NextResponse.json({ isActive: false });
  }
}
