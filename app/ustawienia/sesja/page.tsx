"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSessionSettings, updateSessionSettings } from "@/app/actions/session-settings";
import { toast } from "sonner";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function SesjaPage() {
  const [screenLockMinutes, setScreenLockMinutes] = useState<string>("480");
  const [hardLogoutMinutes, setHardLogoutMinutes] = useState<string>("480");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSessionSettings().then((res) => {
      if (res.success) {
        setScreenLockMinutes(String(res.data.screenLockMinutes));
        setHardLogoutMinutes(String(res.data.hardLogoutMinutes));
      }
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    const sl = parseInt(screenLockMinutes, 10);
    const hl = parseInt(hardLogoutMinutes, 10);

    if (Number.isNaN(sl) || sl < 0) {
      toast.error("Blokada ekranu musi być liczbą ≥ 0 (0 = wyłączona)");
      return;
    }
    if (Number.isNaN(hl) || hl < 1) {
      toast.error("Wylogowanie musi być liczbą ≥ 1 minut");
      return;
    }

    setSaving(true);
    const res = await updateSessionSettings({
      screenLockMinutes: sl,
      hardLogoutMinutes: hl,
    });
    setSaving(false);

    if (res.success) {
      toast.success("Zapisano ustawienia sesji");
    } else {
      toast.error(res.error);
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <p className="text-muted-foreground">Ładowanie…</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/ustawienia">
          <Button variant="ghost" size="icon" aria-label="Powrót">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-xl font-semibold">Sesja i blokada ekranu</h1>
      </div>

      <div className="space-y-6 rounded-lg border bg-card p-6">
        <p className="text-sm text-muted-foreground">
          Heartbeat co 20s, blokada ekranu po bezczynności, hard logout po przekroczeniu limitu. Dla „max 2× PIN dziennie”
          ustaw 480 min (8h) lub wyłącz blokadę (0).
        </p>

        <div className="space-y-2">
          <Label htmlFor="screenLock">Blokada ekranu (minuty)</Label>
          <Input
            id="screenLock"
            type="number"
            min={0}
            value={screenLockMinutes}
            onChange={(e) => setScreenLockMinutes(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">0 = wyłączona. 480 = 8h (max 2× PIN dziennie).</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="hardLogout">Wylogowanie (minuty)</Label>
          <Input
            id="hardLogout"
            type="number"
            min={1}
            value={hardLogoutMinutes}
            onChange={(e) => setHardLogoutMinutes(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Po tym czasie bezczynności użytkownik zostanie wylogowany.</p>
        </div>

        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Zapisywanie…" : "Zapisz"}
        </Button>
      </div>
    </div>
  );
}
