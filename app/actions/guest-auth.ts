"use server";

import { prisma } from "@/lib/db";
import { createGuestSessionToken } from "@/lib/guest-auth";
import { cookies } from "next/headers";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Znajduje gościa po emailu lub tworzy nowego (po SSO Google/Facebook).
 */
export async function findOrCreateGuestByOAuth(
  email: string,
  name: string,
  pictureUrl?: string | null
): Promise<ActionResult<{ guestId: string }>> {
  const trimmedEmail = email.trim().toLowerCase();
  const trimmedName = name.trim() || "Gość";
  if (!trimmedEmail) {
    return { success: false, error: "Email wymagany do logowania SSO." };
  }
  try {
    let guest = await prisma.guest.findFirst({
      where: { email: trimmedEmail },
      select: { id: true, name: true, email: true, photoUrl: true },
    });
    if (!guest) {
      guest = await prisma.guest.create({
        data: {
          name: trimmedName,
          email: trimmedEmail,
          photoUrl: pictureUrl?.trim() || null,
        },
        select: { id: true, name: true, email: true, photoUrl: true },
      });
    } else if (pictureUrl?.trim() && !guest.photoUrl) {
      await prisma.guest.update({
        where: { id: guest.id },
        data: { photoUrl: pictureUrl.trim() },
      });
    }
    const session = await createGuestSessionToken({
      guestId: guest.id,
      email: guest.email ?? trimmedEmail,
      name: guest.name,
    });
    const cookieStore = await cookies();
    cookieStore.set(session.name, session.value, session.options);
    return { success: true, data: { guestId: guest.id } };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd logowania gościa",
    };
  }
}
