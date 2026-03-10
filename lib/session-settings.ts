/**
 * Konfiguracja sesji: screen lock i hard logout.
 * Źródło: HotelConfig.sessionSettings (DB) lub zmienne env.
 */

export type SessionSettings = {
  screenLockMinutes: number; // 0 = wyłączony
  hardLogoutMinutes: number;
};

const DEFAULT_SCREEN_LOCK = 480; // 8h – dla „max 2× PIN dziennie”
const DEFAULT_HARD_LOGOUT = 480; // 8h

export function getSessionSettingsFromEnv(): SessionSettings {
  const screenLock = Number(process.env.SESSION_SCREEN_LOCK_MINUTES);
  const hardLogout = Number(process.env.SESSION_IDLE_TIMEOUT_MINUTES) || Number(process.env.SESSION_HARD_LOGOUT_MINUTES);

  return {
    screenLockMinutes: Number.isFinite(screenLock) && screenLock >= 0 ? screenLock : DEFAULT_SCREEN_LOCK,
    hardLogoutMinutes: Number.isFinite(hardLogout) && hardLogout > 0 ? hardLogout : DEFAULT_HARD_LOGOUT,
  };
}

export function mergeSessionSettings(
  env: SessionSettings,
  db: { screenLockMinutes?: number; hardLogoutMinutes?: number } | null
): SessionSettings {
  if (!db) return env;
  return {
    screenLockMinutes:
      typeof db.screenLockMinutes === "number" && db.screenLockMinutes >= 0 ? db.screenLockMinutes : env.screenLockMinutes,
    hardLogoutMinutes:
      typeof db.hardLogoutMinutes === "number" && db.hardLogoutMinutes > 0 ? db.hardLogoutMinutes : env.hardLogoutMinutes,
  };
}
