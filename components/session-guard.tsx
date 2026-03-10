"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { SessionPayload } from "@/lib/auth";

const HEARTBEAT_INTERVAL_MS = 20 * 1000; // 20s

type SessionConfig = { screenLockMinutes: number; hardLogoutMinutes: number };

export function SessionGuard({ session }: { session: SessionPayload | null }) {
  const [config, setConfig] = useState<SessionConfig | null>(null);
  const [locked, setLocked] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinLoading, setPinLoading] = useState(false);

  const lastActivityRef = useRef(Date.now());
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const addDigit = useCallback((d: string) => {
    setPin((p) => (p.length >= 4 ? p : p + d));
    setPinError("");
  }, []);

  const removeDigit = useCallback(() => {
    setPin((p) => p.slice(0, -1));
    setPinError("");
  }, []);

  const verifyPin = useCallback(async () => {
    if (pin.length !== 4 || pinLoading) return;
    setPinLoading(true);
    setPinError("");
    try {
      const res = await fetch("/api/auth/verify-pin-unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        setPinError(data.error ?? "Błędny PIN");
        setPin("");
        return;
      }
      setPin("");
      setLocked(false);
      lastActivityRef.current = Date.now();
    } catch {
      setPinError("Błąd połączenia");
    } finally {
      setPinLoading(false);
    }
  }, [pin, pinLoading]);

  useEffect(() => {
    if (pin.length === 4 && !pinLoading) verifyPin();
  }, [pin, pinLoading, verifyPin]);

  // Pobierz konfigurację
  useEffect(() => {
    if (!session) return;
    fetch("/api/auth/session-config", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data && typeof data.screenLockMinutes === "number" && typeof data.hardLogoutMinutes === "number") {
          setConfig(data);
        } else {
          setConfig({ screenLockMinutes: 480, hardLogoutMinutes: 480 });
        }
      })
      .catch(() => setConfig({ screenLockMinutes: 480, hardLogoutMinutes: 480 }));
  }, [session]);

  // Heartbeat co 20s
  useEffect(() => {
    if (!session || document.hidden) return;

    const doHeartbeat = async () => {
      try {
        await fetch("/api/auth/heartbeat", { method: "POST", credentials: "include" });
      } catch {
        // ignore
      }
    };

    doHeartbeat();
    const id = setInterval(doHeartbeat, HEARTBEAT_INTERVAL_MS);
    heartbeatIntervalRef.current = id;

    return () => {
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    };
  }, [session]);

  // Best effort: visibilitychange + pagehide + sendBeacon
  useEffect(() => {
    if (!session) return;

    const url = "/api/auth/heartbeat";
    const blob = new Blob([JSON.stringify({})], { type: "application/json" });

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        navigator.sendBeacon?.(url, blob);
      }
    };

    const onPageHide = () => {
      navigator.sendBeacon?.(url, blob);
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [session]);

  // Śledzenie aktywności użytkownika
  useEffect(() => {
    const events = ["mousedown", "keydown", "click", "scroll", "touchstart"];
    const onActivity = () => {
      lastActivityRef.current = Date.now();
    };
    events.forEach((e) => window.addEventListener(e, onActivity));
    return () => events.forEach((e) => window.removeEventListener(e, onActivity));
  }, []);

  // Screen lock + hard logout (interwał 10s)
  useEffect(() => {
    if (!session || !config) return;

    const screenLockMs = config.screenLockMinutes * 60 * 1000;
    const hardLogoutMs = config.hardLogoutMinutes * 60 * 1000;

    const check = () => {
      if (document.hidden) return;
      const now = Date.now();
      const idle = now - lastActivityRef.current;

      if (config.screenLockMinutes > 0 && idle >= screenLockMs && !locked) {
        setLocked(true);
      }

      if (idle >= hardLogoutMs) {
        window.location.href = "/login?timeout=1";
      }
    };

    const id = setInterval(check, 10 * 1000);
    return () => clearInterval(id);
  }, [session, config, locked]);

  // Klawiatura: cyfry i Enter w dialogu odblokowania
  useEffect(() => {
    if (!locked) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        addDigit(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        removeDigit();
      } else if (e.key === "Enter" && pin.length === 4 && !pinLoading) {
        e.preventDefault();
        verifyPin();
      } else if (e.key === "Escape") {
        e.preventDefault();
        setPin("");
        setPinError("");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [locked, pin, pinLoading, addDigit, removeDigit, verifyPin]);

  if (!session) return null;

  const keypad = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

  return (
    <>
      {locked && (
        <div
          className="fixed inset-0 z-[9998] flex items-center justify-center bg-background/95 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="session-lock-title"
        >
          <div className="w-full max-w-sm space-y-4 rounded-lg border bg-card p-6 shadow-lg">
            <h2 id="session-lock-title" className="text-center text-lg font-semibold">
              Ekran zablokowany — {session.name}
            </h2>
            <p className="text-center text-sm text-muted-foreground">Wprowadź PIN, aby odblokować</p>
            <Input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              readOnly
              placeholder="••••"
              className="text-center text-2xl tracking-[0.5em] h-14"
              aria-label="PIN"
            />
            {pinError && (
              <p className="text-center text-sm text-destructive" role="alert">
                {pinError}
              </p>
            )}
            <div className="grid grid-cols-3 gap-2">
              {keypad.map((d) => (
                <Button key={d} variant="outline" className="h-14 text-2xl font-bold" onClick={() => addDigit(d)} disabled={pin.length >= 4 || pinLoading}>
                  {d}
                </Button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button variant="outline" className="h-14" onClick={removeDigit} disabled={pin.length === 0 || pinLoading} aria-label="Usuń">
                ⌫
              </Button>
              <Button variant="outline" className="h-14 text-2xl font-bold" onClick={() => addDigit("0")} disabled={pin.length >= 4 || pinLoading}>
                0
              </Button>
              <Button variant="outline" className="h-14" onClick={() => setPin("")} disabled={pin.length === 0 || pinLoading} aria-label="Wyczyść">
                C
              </Button>
            </div>
            {pinLoading && <p className="text-center text-sm text-muted-foreground">Weryfikacja...</p>}
          </div>
        </div>
      )}
    </>
  );
}
