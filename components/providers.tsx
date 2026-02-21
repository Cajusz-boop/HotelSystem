"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect, useLayoutEffect } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { I18nProvider } from "@/components/i18n-provider";

const KEEP_ALIVE_INTERVAL_MS = 4 * 60 * 1000; // 4 minuty
const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minut - jeśli dłużej nieaktywny, przeładuj

/**
 * Ping /api/health co 4 min żeby:
 *  - Passenger nie uśpił procesu Node po bezczynności
 *  - Połączenie z bazą nie wygasło (MariaDB wait_timeout)
 * Działa tylko gdy karta przeglądarki jest aktywna (document.hidden).
 * 
 * Po powrocie z długiej nieaktywności (>10min) - automatycznie odświeża stronę.
 */
function useKeepAlive() {
  useEffect(() => {
    let lastActiveTime = Date.now();

    function ping() {
      if (document.hidden) return;
      lastActiveTime = Date.now();
      fetch("/api/health", { method: "GET", cache: "no-store" }).catch(() => {});
    }

    ping();
    const timer = setInterval(ping, KEEP_ALIVE_INTERVAL_MS);

    function onVisibilityChange() {
      if (!document.hidden) {
        const inactiveTime = Date.now() - lastActiveTime;
        if (inactiveTime > STALE_THRESHOLD_MS) {
          console.log(`[KeepAlive] Inactive for ${Math.round(inactiveTime / 1000 / 60)}min, reloading...`);
          window.location.reload();
          return;
        }
        ping();
      }
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
            staleTime: 5 * 60 * 1000,
            gcTime: 10 * 60 * 1000,
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
            retry: 1,
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
