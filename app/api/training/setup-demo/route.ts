/**
 * POST /api/training/setup-demo
 * Wywołuje setupTrainingDemo — tworzy dane demo (goście, rezerwacje, statusy pokoi, płatności).
 * Używane przez skrypt training-screenshots.ts.
 * Endpoint bez autoryzacji — tylko z localhost / do automatyzacji.
 */
import { NextResponse } from "next/server";
import { setupTrainingDemo } from "@/app/actions/training-demo";

export async function POST() {
  try {
    const result = await setupTrainingDemo();
    if (result.success) {
      return NextResponse.json({
        success: true,
        created: result.created,
      });
    }
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  } catch (e) {
    console.error("[training/setup-demo]", e);
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
