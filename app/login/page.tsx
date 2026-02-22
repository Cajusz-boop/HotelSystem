"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();

  const [users, setUsers] = useState<UserItem[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);

  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [pinLoading, setPinLoading] = useState(false);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);

  const loadUsers = useCallback(() => {
    setUsersLoading(true);
    setUsersError(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    fetch("/api/auth/users", { signal: controller.signal, cache: "no-store" })
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

  const openPinDialog = (user: UserItem) => {
    setSelectedUser(user);
    setPin("");
    setPinError("");
    setPinDialogOpen(true);
  };

  const closePinDialog = () => {
    setPinDialogOpen(false);
    setSelectedUser(null);
    setPin("");
    setPinError("");
  };

  const addDigit = (d: string) => {
    if (pin.length >= 4) return;
    setPin((p) => p + d);
    setPinError("");
  };

  const backspace = () => {
    setPin((p) => p.slice(0, -1));
    setPinError("");
  };

  const submitPin = useCallback(async () => {
    if (!selectedUser || pin.length !== 4) {
      setPinError("Wpisz 4 cyfry PIN");
      return;
    }
    setPinLoading(true);
    setPinError("");
    try {
      const res = await fetch("/api/auth/pin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUser.id, pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPinError(data.error ?? "Błąd logowania");
        setPin("");
        setPinLoading(false);
        return;
      }
      toast.success(`Zalogowano jako ${selectedUser.name}`);
      closePinDialog();
      router.push("/");
      router.refresh();
    } catch {
      setPinError("Błąd połączenia");
    } finally {
      setPinLoading(false);
    }
  }, [selectedUser, pin, router]);

  useEffect(() => {
    if (pin.length === 4 && selectedUser && !pinLoading) {
      submitPin();
    }
  }, [pin, selectedUser, pinLoading, submitPin]);

  const keypad = ["7", "8", "9", "4", "5", "6", "1", "2", "3", "0"];

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-lg rounded-lg border bg-card p-6 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-3">
          <img src="/logo.png" alt="Hotel Łabędź" className="h-20 w-auto rounded-lg" />
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
              <p className="col-span-full text-center text-muted-foreground py-8">Brak aktywnych użytkowników.</p>
            )}
            {!usersLoading && !usersError && users.map((user) => (
              <Button
                key={user.id}
                variant="outline"
                size="lg"
                className="h-16 text-base font-medium"
                onClick={() => openPinDialog(user)}
              >
                {user.name}
              </Button>
            ))}
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
              aria-label="PIN"
            />
            {pinError && (
              <p className="text-sm text-destructive text-center">{pinError}</p>
            )}
            <div className="grid grid-cols-3 gap-2">
              {keypad.map((d) => (
                <Button
                  key={d}
                  variant="outline"
                  size="lg"
                  className="h-14 text-xl font-medium"
                  onClick={() => addDigit(d)}
                  disabled={pinLoading}
                >
                  {d}
                </Button>
              ))}
              <Button
                variant="outline"
                size="lg"
                className="h-14 text-xl"
                onClick={backspace}
                disabled={pinLoading}
              >
                &#x232B;
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="h-14"
                onClick={() => setPin("")}
                disabled={pinLoading}
              >
                C
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
