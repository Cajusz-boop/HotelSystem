"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login, verify2FA } from "@/app/actions/auth";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (result.success) {
      router.push("/");
      router.refresh();
    } else if ("needTwoFactor" in result && result.needTwoFactor) {
      setPendingToken(result.pendingToken);
    } else {
      toast.error("error" in result ? result.error : "Błąd");
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingToken || !totpCode.trim()) return;
    setLoading(true);
    const result = await verify2FA(pendingToken, totpCode);
    setLoading(false);
    if (result.success) {
      router.push("/");
      router.refresh();
    } else {
      toast.error("error" in result ? result.error : "Nieprawidłowy kod");
    }
  };

  if (pendingToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
        <div className="w-full max-w-sm rounded-lg border bg-card p-6 shadow-sm">
          <h1 className="mb-6 text-xl font-semibold">Weryfikacja 2FA</h1>
          <p className="mb-4 text-sm text-muted-foreground">
            Wprowadź kod z aplikacji authenticator (6 cyfr).
          </p>
          <form onSubmit={handleVerify2FA} className="flex flex-col gap-4">
            <div className="grid gap-2">
              <Label htmlFor="totp">Kod</Label>
              <Input
                id="totp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                required
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? "Weryfikacja…" : "Zatwierdź"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => { setPendingToken(null); setTotpCode(""); }}
            >
              Wstecz
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm rounded-lg border bg-card p-6 shadow-sm">
        <h1 className="mb-6 text-xl font-semibold">Hotel PMS – logowanie</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@hotel.local"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Hasło</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? "Logowanie…" : "Zaloguj"}
          </Button>
        </form>
        <p className="mt-4 text-xs text-muted-foreground">
          Domyślny użytkownik po seed: admin@hotel.local / admin123
        </p>
      </div>
    </div>
  );
}
