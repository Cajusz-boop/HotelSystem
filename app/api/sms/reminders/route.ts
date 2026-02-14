import { NextRequest, NextResponse } from "next/server";
import { sendBatchPreArrivalReminders, getReservationsForReminder } from "@/app/actions/sms";

// Klucz API do autoryzacji (ustaw w zmiennych środowiskowych)
const API_SECRET_KEY = process.env.SMS_REMINDER_API_KEY ?? process.env.API_SECRET_KEY;

/**
 * GET /api/sms/reminders
 * Pobiera listę rezerwacji kwalifikujących się do przypomnienia.
 * 
 * Query params:
 * - days: liczba dni przed przyjazdem (domyślnie 1)
 */
export async function GET(request: NextRequest) {
  // Autoryzacja
  const authHeader = request.headers.get("Authorization");
  if (API_SECRET_KEY && authHeader !== `Bearer ${API_SECRET_KEY}`) {
    return NextResponse.json(
      { success: false, error: "Nieautoryzowany dostęp" },
      { status: 401 }
    );
  }
  
  const searchParams = request.nextUrl.searchParams;
  const daysParam = searchParams.get("days");
  const days = daysParam ? parseInt(daysParam, 10) : 1;
  
  if (isNaN(days) || days < 0 || days > 30) {
    return NextResponse.json(
      { success: false, error: "Nieprawidłowa wartość parametru 'days' (0-30)" },
      { status: 400 }
    );
  }
  
  const result = await getReservationsForReminder(days);
  
  if (!result.success) {
    return NextResponse.json(result, { status: 500 });
  }
  
  return NextResponse.json({
    success: true,
    daysBeforeArrival: days,
    count: result.data.length,
    reservations: result.data,
  });
}

/**
 * POST /api/sms/reminders
 * Wysyła przypomnienia SMS dla rezerwacji z check-in za X dni.
 * 
 * Query params:
 * - days: liczba dni przed przyjazdem (domyślnie 1)
 * 
 * Ten endpoint może być wywoływany przez:
 * - Cron job (np. codziennie o 10:00)
 * - Ręcznie przez administratora
 */
export async function POST(request: NextRequest) {
  // Autoryzacja
  const authHeader = request.headers.get("Authorization");
  if (API_SECRET_KEY && authHeader !== `Bearer ${API_SECRET_KEY}`) {
    return NextResponse.json(
      { success: false, error: "Nieautoryzowany dostęp" },
      { status: 401 }
    );
  }
  
  const searchParams = request.nextUrl.searchParams;
  const daysParam = searchParams.get("days");
  const days = daysParam ? parseInt(daysParam, 10) : 1;
  
  if (isNaN(days) || days < 0 || days > 30) {
    return NextResponse.json(
      { success: false, error: "Nieprawidłowa wartość parametru 'days' (0-30)" },
      { status: 400 }
    );
  }
  
  console.log(`[API] Uruchamianie wysyłki przypomnień SMS (days=${days})`);
  
  const result = await sendBatchPreArrivalReminders(days);
  
  if (!result.success) {
    return NextResponse.json(result, { status: 500 });
  }
  
  return NextResponse.json({
    success: true,
    daysBeforeArrival: days,
    summary: {
      sent: result.data.sent,
      failed: result.data.failed,
      skipped: result.data.skipped,
      total: result.data.sent + result.data.failed + result.data.skipped,
    },
    details: result.data.details,
  });
}
