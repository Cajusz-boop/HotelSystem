"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const BODY_CLASS = "sprzatanie-standalone";

export default function SprzatanieLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isSprzatanie = pathname === "/sprzatanie";

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (isSprzatanie) {
      document.body.classList.add(BODY_CLASS);
    } else {
      document.body.classList.remove(BODY_CLASS);
    }
    return () => {
      document.body.classList.remove(BODY_CLASS);
    };
  }, [isSprzatanie]);

  return <>{children}</>;
}
