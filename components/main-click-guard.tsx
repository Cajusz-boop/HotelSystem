"use client";

import { useLayoutEffect } from "react";

/**
 * Wymusza klikalność obszaru main po hydratacji (Radix / overlay mogą blokować zdarzenia).
 * Renderuje tylko children – bez dodatkowego diva.
 */
export function MainClickGuard({ children }: { children: React.ReactNode }) {
  useLayoutEffect(() => {
    const main = document.querySelector("main");
    if (main) {
      main.style.setProperty("pointer-events", "auto", "important");
      main.style.setProperty("z-index", "20", "important");
      main.style.setProperty("position", "relative", "important");
    }
  }, []);
  return <>{children}</>;
}
