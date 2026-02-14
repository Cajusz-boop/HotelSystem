"use client";

import { useEffect, useState } from "react";
import { Building2, User, Bell } from "lucide-react";
import { getProperties, getSelectedPropertyId } from "@/app/actions/properties";
import type { SessionPayload } from "@/lib/auth";
import { requestNotificationPermission } from "@/lib/notifications";

export function StatusBar({ session }: { session: SessionPayload | null }) {
  const [mounted, setMounted] = useState(false);
  const [propertyName, setPropertyName] = useState<string | null>(null);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    getSelectedPropertyId().then((id) => {
      if (!id) return;
      getProperties().then((res) => {
        if (res.success && res.data) {
          const prop = res.data.find((p) => p.id === id);
          setPropertyName(prop?.name ?? null);
        }
      });
    });
  }, [mounted]);

  useEffect(() => {
    if (mounted && typeof window !== "undefined" && "Notification" in window) {
      setNotificationPermission(Notification.permission);
    }
  }, [mounted]);

  const handleEnableNotifications = async () => {
    const perm = await requestNotificationPermission();
    setNotificationPermission(perm);
  };

  return (
    <div className="flex items-center justify-end gap-4 border-b border-border/50 bg-card/80 px-4 py-2 text-sm text-muted-foreground">
      {propertyName && (
        <span className="flex items-center gap-1.5">
          <Building2 className="h-4 w-4" />
          <span>{propertyName}</span>
        </span>
      )}
      {session && (
        <span className="flex items-center gap-1.5">
          <User className="h-4 w-4" />
          <span>{session.name}</span>
        </span>
      )}
      {mounted && typeof window !== "undefined" && "Notification" in window && (
        <button
          type="button"
          onClick={handleEnableNotifications}
          className="flex items-center gap-1.5 rounded px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={notificationPermission === "granted" ? "Powiadomienia włączone" : "Włącz powiadomienia"}
        >
          <Bell className="h-4 w-4" />
          <span className="hidden sm:inline">
            {notificationPermission === "granted" ? "Powiadomienia" : "Włącz powiadomienia"}
          </span>
        </button>
      )}
    </div>
  );
}
