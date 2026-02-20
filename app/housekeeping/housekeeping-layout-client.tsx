"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function HousekeepingLayoutClient({
  children,
  role,
}: {
  children: React.ReactNode;
  role: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (
      role === "HOUSEKEEPING" &&
      (pathname === "/housekeeping/minibar" || pathname === "/housekeeping/laundry")
    ) {
      router.replace("/housekeeping");
    }
  }, [role, pathname, router]);

  const isRestricted =
    role === "HOUSEKEEPING" &&
    (pathname === "/housekeeping/minibar" || pathname === "/housekeeping/laundry");

  if (isRestricted) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-12">
        <p className="text-muted-foreground">Przekierowywanie…</p>
      </div>
    );
  }

  return <>{children}</>;
}
