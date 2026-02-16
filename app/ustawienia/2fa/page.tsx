"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { start2FA, confirm2FA, disable2FA, get2FAStatus } from "@/app/actions/two-fa";
import { toast } from "sonner";
import { ArrowLeft, Shield } from "lucide-react";

export default function TwoFAPage() {
  const [status, setStatus] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [setupMode, setSetupMode] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");

  const loadStatus = async () => {
    const r = await get2FAStatus();
    if ("enabled" in r) setStatus(r.enabled);
    else setStatus(null);
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleStart2FA = async () => {
    setLoading(true);
    const result = await start2FA();
    setLoading(false);
    if (result.success) {
      setQrDataUrl(result.qrDataUrl);
      setSecret(result.secret);
      setSetupMode(true);
      setCode("");
    } else {
      toast.error(result.error);
    }
  };

  const handleConfirm2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!secret || !code.trim()) return;
    setLoading(true);
    const result = await confirm2FA(secret, code);
    setLoading(false);
    if (result.success) {
      toast.success("2FA włączone.");
      setSetupMode(false);
      setQrDataUrl(null);
      setSecret(null);
      setCode("");
      loadStatus();
    } else {
      toast.error(result.error);
    }
  };

  const handleDisable2FA = async () => {
    if (!confirm("Czy na pewno wyłączyć uwierzytelnianie dwuetapowe?")) return;
    setLoading(true);
    const result = await disable2FA();
    setLoading(false);
    if (result.success) {
      toast.success("2FA wyłączone.");
      loadStatus();
    } else {
      toast.error(result.error);
    }
  };

  const cancelSetup = () => {
    setSetupMode(false);
    setQrDataUrl(null);
    setSecret(null);
    setCode("");
  };

  return (
    <div className="p-6 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6" />
          <h1 className="text-2xl font-bold">Uwierzytelnianie dwuetapowe (2FA)</h1>
        </div>
        <Link href="/ustawienia">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Powrót
          </Button>
        </Link>
      </div>

      {status === null && !setupMode && (
        <p className="text-muted-foreground">Ładowanie…</p>
      )}

      {status === false && !setupMode && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Uwierzytelnianie dwuetapowe zwiększa bezpieczeństwo konta. Po włączeniu przy logowaniu będziesz musiał podać kod z aplikacji (np. Google Authenticator).
          </p>
          <Button onClick={handleStart2FA} disabled={loading}>
            Włącz 2FA
          </Button>
        </div>
      )}

      {setupMode && qrDataUrl && secret && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Zeskanuj kod QR w aplikacji authenticator (Google Authenticator, Authy itp.) lub wpisz secret ręcznie.
          </p>
          <div className="flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- data URL from QR lib */}
            <img src={qrDataUrl} alt="QR kod 2FA" className="rounded border" />
          </div>
          <p className="text-xs text-muted-foreground font-mono break-all">
            Secret: {secret}
          </p>
          <form onSubmit={handleConfirm2FA} className="space-y-3">
            <Label htmlFor="setup-code">Wprowadź kod z aplikacji (6 cyfr)</Label>
            <Input
              id="setup-code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
            <div className="flex gap-2">
              <Button type="submit" disabled={loading || code.length !== 6}>
                Potwierdź i włącz 2FA
              </Button>
              <Button type="button" variant="outline" onClick={cancelSetup}>
                Anuluj
              </Button>
            </div>
          </form>
        </div>
      )}

      {status === true && !setupMode && (
        <div className="space-y-4">
          <p className="text-sm text-green-600 font-medium">2FA jest włączone.</p>
          <Button variant="destructive" onClick={handleDisable2FA} disabled={loading}>
            Wyłącz 2FA
          </Button>
        </div>
      )}
    </div>
  );
}
