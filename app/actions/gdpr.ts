"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Zapisuje zgodę RODO (przetwarzanie danych osobowych) wraz z podpisem elektronicznym gościa.
 */
export async function recordGdprConsentWithSignature(
  guestId: string,
  signatureDataUrl: string
): Promise<ActionResult<void>> {
  try {
    const trimmed = signatureDataUrl.trim();
    if (!trimmed || !trimmed.startsWith("data:")) {
      return { success: false, error: "Nieprawidłowy format podpisu (wymagany data URL z canvas)." };
    }

    const guest = await prisma.guest.findUnique({
      where: { id: guestId },
      select: { id: true },
    });
    if (!guest) {
      return { success: false, error: "Gość nie istnieje." };
    }

    const payload = trimmed.length > 50000 ? trimmed.slice(0, 50000) : trimmed;
    await prisma.guest.update({
      where: { id: guestId },
      data: {
        gdprDataProcessingConsent: true,
        gdprDataProcessingDate: new Date(),
        gdprConsentSignature: { dataUrl: payload } as object,
      },
    });

    revalidatePath("/guests");
    revalidatePath("/check-in");
    return { success: true, data: undefined };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd zapisu zgody RODO",
    };
  }
}
