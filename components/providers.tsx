"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect, useLayoutEffect } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { I18nProvider } from "@/components/i18n-provider";

const KEEP_ALIVE_INTERVAL_MS = 4 * 60 * 1000; // 4 minuty

/**
 * Ping /api/health co 4 min żeby:
 *  - Passenger nie uśpił procesu Node po bezczynności
 *  - Połączenie z bazą nie wygasło (MariaDB wait_timeout)
 * Działa tylko gdy karta przeglądarki jest aktywna (document.hidden).
 */
function useKeepAlive() {
  useEffect(() => {
    function ping() {
      if (document.hidden) return;
      fetch("/api/health", { method: "GET", cache: "no-store" }).catch(() => {});
    }

    // Pierwsze rozgrzanie zaraz po załadowaniu strony
    ping();
    const timer = setInterval(ping, KEEP_ALIVE_INTERVAL_MS);

    // Gdy użytkownik wraca na kartę po dłuższej nieobecności – natychmiast pinguj
    function onVisibilityChange() {
      if (!document.hidden) ping();
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 min – dane nie są refetchowane przy powrocie na zakładkę
            gcTime: 10 * 60 * 1000, // 10 min – dane żyją w pamięci nawet po odmontowaniu komponentu
          },
        },
      })
  );

  // Jak najwcześniej po hydratacji: wymuś klikalność (Radix zostawia pointer-events:none na body).
  useLayoutEffect(() => {
    if (typeof document === "undefined") return;
    if (!document.querySelector("[data-state='open']")) {
      document.body.classList.add("pms-allow-clicks");
      document.body.style.removeProperty("pointer-events");
    }
  }, []);

  useKeepAlive();

  return (
    <ThemeProvider>
      <I18nProvider>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
