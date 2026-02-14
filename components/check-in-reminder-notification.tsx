"use client";

import { useEffect, useRef } from "react";
import { requestNotificationPermission, showDesktopNotification } from "@/lib/notifications";

const REMINDER_STORAGE_KEY = "pms-checkin-reminder-date";

export function CheckInReminderNotification({ count }: { count: number }) {
  const sent = useRef(false);

  useEffect(() => {
    if (count === 0 || sent.current) return;

    (async () => {
      const permission = await requestNotificationPermission();
      if (permission !== "granted") return;

      const today = new Date().toISOString().slice(0, 10);
      try {
        const last = localStorage.getItem(REMINDER_STORAGE_KEY);
        if (last === today) return;
        localStorage.setItem(REMINDER_STORAGE_KEY, today);
        sent.current = true;
        showDesktopNotification(
          "Przypomnienie o meldunkach",
          { body: `Dziś zaplanowano ${count} meldunków.`, tag: "checkin-reminder" }
        );
      } catch {
        // ignore
      }
    })();
  }, [count]);

  return null;
}
