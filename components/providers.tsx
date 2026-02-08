"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useLayoutEffect } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000, // 30 s
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

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
