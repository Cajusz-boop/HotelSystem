import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/db";

/**
 * POST /api/admin/cleanup-room-numbers
 *
 * Czyści numery pokoi w bazie:
 *  - Usuwa prefiksy literowe (np. "SI 020" → "20")
 *  - Usuwa wiodące zera (np. "07" → "7")
 *  - Jeśli docelowy numer już istnieje, przenosi rezerwacje i bloki do istniejącego pokoju,
 *    a duplikat usuwa.
 *
 * Wymaga admin.settings permission.
 */
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const allowed = await can(session.role, "admin.settings");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const logs: string[] = [];
    const allRooms = await prisma.room.findMany({
      select: { id: true, number: true },
      orderBy: { number: "asc" },
    });

    logs.push(`Znaleziono ${allRooms.length} pokoi`);

    let renamed = 0;
    let merged = 0;
    let unchanged = 0;

    for (const room of allRooms) {
      const cleanNumber = cleanRoomNumber(room.number);

      if (cleanNumber === room.number) {
        unchanged++;
        continue;
      }

      // Check if a room with the clean number already exists
      const existing = await prisma.room.findUnique({
        where: { number: cleanNumber },
        select: { id: true },
      });

      if (!existing) {
        // Simple rename
        await prisma.room.update({
          where: { id: room.id },
          data: { number: cleanNumber },
        });
        logs.push(`Zmieniono: "${room.number}" → "${cleanNumber}"`);
        renamed++;
      } else if (existing.id !== room.id) {
        // Conflict: target number already exists → merge into existing room
        // Transfer reservations
        const movedRes = await prisma.reservation.updateMany({
          where: { roomId: room.id },
          data: { roomId: existing.id },
        });
        // Transfer room blocks
        const movedBlocks = await prisma.roomBlock.updateMany({
          where: { roomId: room.id },
          data: { roomId: existing.id },
        });
        // Transfer cleaning schedules
        try {
          await prisma.cleaningSchedule.updateMany({
            where: { roomId: room.id },
            data: { roomId: existing.id },
          });
        } catch { /* ignore if table missing */ }
        // Transfer maintenance issues
        try {
          await prisma.maintenanceIssue.updateMany({
            where: { roomId: room.id },
            data: { roomId: existing.id },
          });
        } catch { /* ignore */ }
        // Delete room group links
        try {
          await prisma.roomGroupRoom.deleteMany({ where: { roomId: room.id } });
        } catch { /* ignore */ }

        // Delete the duplicate room
        await prisma.room.delete({ where: { id: room.id } });

        logs.push(
          `Scalono: "${room.number}" → "${cleanNumber}" (przeniesiono ${movedRes.count} rez., ${movedBlocks.count} bloków, usunięto duplikat)`
        );
        merged++;
      }
    }

    logs.push(`---`);
    logs.push(`Zmieniono nazwy: ${renamed}`);
    logs.push(`Scalono duplikaty: ${merged}`);
    logs.push(`Bez zmian: ${unchanged}`);

    return NextResponse.json({ success: true, logs });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Cleanup failed", detail: msg }, { status: 500 });
  }
}

/**
 * Czyści numer pokoju:
 *  - Usuwa prefiksy literowe + spację (np. "SI 020" → "020")
 *  - Usuwa wiodące zera (np. "020" → "20", "07" → "7")
 *  - Zachowuje "0" jeśli to jedyna cyfra
 */
function cleanRoomNumber(num: string): string {
  // Strip letter prefix (like "SI ", "K ", etc.)
  let clean = num.replace(/^[A-Za-zĄ-Żą-ż]+\s+/, "");
  // Strip leading zeros (but keep at least one digit)
  clean = clean.replace(/^0+(?=\d)/, "");
  return clean.trim() || num;
}
