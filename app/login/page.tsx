"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login, verify2FA } from "@/app/actions/auth";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

const GOOGLE_ERROR_MESSAGES: Record<string, string> = {
  no_account: "Brak konta PMS powiązanego z tym adresem Google.",
  google_denied: "Logowanie przez Google zostało anulowane.",
  config: "Google OAuth nie jest skonfigurowany. Skontaktuj się z administratorem.",
  server: "Błąd serwera podczas logowania przez Google.",
  invalid_state: "Nieprawidłowe żądanie OAuth. Spróbuj ponownie.",
  token: "Nie udało się uzyskać tokenu od Google.",
  no_token: "Nie udało się uzyskać tokenu od Google.",
  userinfo: "Nie udało się pobrać danych użytkownika z Google.",
  no_email: "Konto Google nie udostępniło adresu email.",
  missing_code: "Brak kodu autoryzacji od Google.",
};

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");

  useEffect(() => {
    const error = searchParams.get("error");
    if (error) {
      const message = GOOGLE_ERROR_MESSAGES[error] || "Błąd logowania przez Google.";
      toast.error(message);
      router.replace("/login", { scroll: false });
    }
  }, [searchParams, router]);

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
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10"
                required
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                aria-label={showPassword ? "Ukryj hasło" : "Pokaż hasło"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? "Logowanie…" : "Zaloguj"}
          </Button>
        </form>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">lub</span>
          </div>
        </div>

        <a href="/api/auth/staff/google">
          <Button variant="outline" className="w-full gap-2" type="button">
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Zaloguj przez Google
          </Button>
        </a>

        <p className="mt-4 text-xs text-muted-foreground">
          Domyślny użytkownik po seed: admin@hotel.local / Admin1234#
        </p>
      </div>
    </div>
  );
}
