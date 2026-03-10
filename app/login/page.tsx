"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type UserItem = {
  id: string;
  name: string;
  role: string;
};

export default function LoginPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);

  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinLoading, setPinLoading] = useState(false);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);

  // BUG 9: Logo fallback state
  const [logoError, setLogoError] = useState(false);

  // BUG 7: Guard against multiple submissions
  const isSubmittingRef = useRef(false);

  const loadUsers = useCallback(() => {
    setUsersLoading(true);
    setUsersError(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    fetch("/api/auth/users", { signal: controller.signal, cache: "no-store", credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 500 ? "Błąd serwera" : `Błąd ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setUsers(data);
        } else {
          setUsers([]);
          setUsersError("Nieprawidłowa odpowiedź serwera");
        }
      })
      .catch((err) => {
        setUsers([]);
        if (err.name === "AbortError") {
          setUsersError("Przekroczono czas oczekiwania. Sprawdź połączenie.");
        } else {
          setUsersError(err instanceof Error ? err.message : "Nie można załadować użytkowników");
        }
      })
      .finally(() => {
        clearTimeout(timeoutId);
        setUsersLoading(false);
      });
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Błędy z OAuth callback (redirect z Google)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (err) {
      const msg: Record<string, string> = {
        no_account: "Konto z tym adresem Google nie istnieje w systemie.",
        config: "Logowanie przez Google nie jest skonfigurowane.",
        google_denied: "Anulowano logowanie.",
        invalid_state: "Błąd sesji. Spróbuj ponownie.",
      };
      toast.error(msg[err] ?? "Błąd logowania przez Google");
      window.history.replaceState({}, "", "/login");
    }
  }, []);

  const openPinDialog = (user: UserItem) => {
    setSelectedUser(user);
    setPin("");
    setPinError("");
    setPinDialogOpen(true);
  };

  const closePinDialog = useCallback(() => {
    setPinDialogOpen(false);
    setSelectedUser(null);
    setPin("");
    setPinError("");
  }, []);

  // BUG 4: addDigit as useCallback for keyboard handler
  const addDigit = useCallback((d: string) => {
    setPin((p) => {
      if (p.length >= 4) return p;
      return p + d;
    });
    setPinError("");
  }, []);

  // BUG 4: removeDigit as useCallback for keyboard handler
  const removeDigit = useCallback(() => {
    setPin((p) => p.slice(0, -1));
    setPinError("");
  }, []);

  // BUG 1 + BUG 7: Fixed submitPin with race condition guard and proper redirect
  const submitPin = useCallback(async () => {
    if (isSubmittingRef.current) return;
    if (!selectedUser || pin.length !== 4) {
      setPinError("Wpisz 4 cyfry PIN");
      return;
    }

    isSubmittingRef.current = true;
    setPinLoading(true);
    setPinError("");

    let didRedirect = false;
    try {
      if (typeof window !== "undefined") {
        console.log("[Login] 1. Before auth call", { userId: selectedUser.id });
      }
      const res = await fetch("/api/auth/pin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUser.id, pin }),
        credentials: "include",
      });
      const data = await res.json();

      if (typeof window !== "undefined") {
        console.log("[Login] 2. Auth response", { ok: res.ok, status: res.status, hasSetCookie: !!res.headers.get("set-cookie") });
      }

      if (!res.ok) {
        setPinError(data.error ?? "Błąd logowania");
        setPin("");
        return;
      }

      if (typeof window !== "undefined") {
        console.log("[Login] 3. Success, redirecting to /front-office");
      }
      didRedirect = true;
      toast.success(`Zalogowano jako ${selectedUser.name}`);
      setPinDialogOpen(false);
      window.location.assign("/front-office");
    } catch (e) {
      if (typeof window !== "undefined") {
        console.error("[Login] Error:", e);
      }
      setPinError("Błąd połączenia");
      setPin("");
    } finally {
      // Nie resetuj stanu po sukcesie — unikamy pętli (useEffect wywołałby submitPin ponownie)
      if (!didRedirect) {
        setPinLoading(false);
        isSubmittingRef.current = false;
      }
    }
  }, [selectedUser, pin]);

  // BUG 7: Auto-submit with guard check
  useEffect(() => {
    if (pin.length === 4 && selectedUser && !pinLoading && !isSubmittingRef.current) {
      submitPin();
    }
  }, [pin, selectedUser, pinLoading, submitPin]);

  // BUG 4: Keyboard support
  useEffect(() => {
    if (!selectedUser) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        addDigit(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        removeDigit();
      } else if (e.key === "Enter" && pin.length === 4 && !pinLoading && !isSubmittingRef.current) {
        e.preventDefault();
        submitPin();
      } else if (e.key === "Escape") {
        e.preventDefault();
        closePinDialog();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedUser, pin, pinLoading, addDigit, removeDigit, submitPin, closePinDialog]);

  // BUG 5: Phone-style keypad layout (1-2-3 on top)
  const keypad = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-lg rounded-lg border bg-card p-6 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-3">
          {/* BUG 9: Logo with fallback */}
          {logoError ? (
            <span className="text-2xl font-bold text-primary">🦢 Hotel Łabędź</span>
          ) : (
            <img
              src="/logo.png"
              alt="Hotel Łabędź"
              className="h-20 w-auto rounded-lg"
              onError={() => setLogoError(true)}
            />
          )}
          <h1 className="text-xl font-semibold">Karczma Łabędź — logowanie</h1>
        </div>

        <div className="w-full">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {usersLoading && (
              <p className="col-span-full text-center text-muted-foreground py-8">Ładowanie użytkowników…</p>
            )}
            {!usersLoading && usersError && (
              <div className="col-span-full space-y-2 text-center py-8">
                <p className="text-destructive">{usersError}</p>
                <Button variant="outline" size="sm" onClick={loadUsers}>
                  Ponów
                </Button>
              </div>
            )}
            {!usersLoading && !usersError && users.length === 0 && (
              <p className="col-span-full text-center text-muted-foreground py-8">Brak użytkowników z ustawionym PIN.</p>
            )}
            {/* BUG 3: Fixed overflow with break-words and auto height */}
            {!usersLoading && !usersError && users.map((user) => (
              <Button
                key={user.id}
                variant="outline"
                size="lg"
                className="h-auto min-h-16 text-base font-medium text-center break-words px-3 py-2"
                title={user.name}
                onClick={() => openPinDialog(user)}
              >
                {user.name}
              </Button>
            ))}
          </div>
          <div className="mt-6 flex flex-col items-center gap-3">
            <span className="text-sm text-muted-foreground">— lub —</span>
            <a href="/api/auth/staff/google">
              <Button variant="outline" className="gap-2 w-full min-w-[200px]">
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Zaloguj przez Google
              </Button>
            </a>
          </div>
        </div>
      </div>

      <Dialog open={pinDialogOpen} onOpenChange={(o) => !o && closePinDialog()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center">
              PIN — {selectedUser?.name ?? ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              readOnly
              placeholder="••••"
              className="text-center text-2xl tracking-[0.5em] h-14"
              aria-label="Pole wprowadzania PIN"
            />
            {pinError && (
              <p className="text-sm text-destructive text-center" role="alert">{pinError}</p>
            )}
            {/* BUG 5: Phone-style keypad 1-9 */}
            <div className="grid grid-cols-3 gap-2">
              {keypad.map((d) => (
                <Button
                  key={d}
                  variant="outline"
                  className="h-14 text-2xl font-bold"
                  onClick={() => addDigit(d)}
                  disabled={pin.length >= 4 || pinLoading}
                  aria-label={`Cyfra ${d}`}
                >
                  {d}
                </Button>
              ))}
            </div>
            {/* BUG 5: Zero centered below */}
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                className="h-14 text-xl"
                onClick={removeDigit}
                disabled={pinLoading || pin.length === 0}
                aria-label="Usuń ostatnią cyfrę"
              >
                &#x232B;
              </Button>
              <Button
                variant="outline"
                className="h-14 text-2xl font-bold"
                onClick={() => addDigit("0")}
                disabled={pin.length >= 4 || pinLoading}
                aria-label="Cyfra 0"
              >
                0
              </Button>
              <Button
                variant="outline"
                className="h-14"
                onClick={() => setPin("")}
                disabled={pinLoading || pin.length === 0}
                aria-label="Wyczyść PIN"
              >
                C
              </Button>
            </div>
            {pinLoading && (
              <p className="text-sm text-muted-foreground text-center">Weryfikacja...</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
