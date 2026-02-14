/**
 * Powiadomienia push/desktop (Web Notifications API).
 * Wymaga uprawnienia użytkownika (requestPermission).
 */

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  const result = await Notification.requestPermission();
  return result;
}

export function showDesktopNotification(title: string, options?: { body?: string; tag?: string }): void {
  if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") {
    return;
  }
  try {
    new Notification(title, {
      body: options?.body,
      tag: options?.tag ?? "pms",
    });
  } catch {
    // ignore
  }
}
