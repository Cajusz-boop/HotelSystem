"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { getHotelConfig, updateHotelConfig, toggleAuthDisabled } from "@/app/actions/hotel-config";
import type { HotelConfigData } from "@/lib/hotel-config-types";
import { toast } from "sonner";
import { ArrowLeft, Building2, ShieldOff, AlertTriangle, Loader2 } from "lucide-react";

const empty: HotelConfigData = {
  name: "",
  address: null,
  postalCode: null,
  city: null,
  nip: null,
  krs: null,
  logoUrl: null,
  phone: null,
  email: null,
  website: null,
  defaultCheckInTime: null,
  defaultCheckOutTime: null,
  floors: [],
  authDisabled: false,
};

export default function DaneHoteluPage() {
  const [data, setData] = useState<HotelConfigData>(empty);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [togglingAuth, setTogglingAuth] = useState(false);

  useEffect(() => {
    getHotelConfig().then((r) => {
      setLoading(false);
      if (r.success) setData(r.data);
      else toast.error(r.error);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const result = await updateHotelConfig(data);
    setSaving(false);
    if (result.success) toast.success("Zapisano");
    else toast.error(result.error);
  };

  if (loading) return <div className="p-6">Ładowanie…</div>;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Building2 className="w-6 h-6" />
          <h1 className="text-2xl font-bold">Dane hotelu</h1>
        </div>
        <Link href="/ustawienia">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Powrót
          </Button>
        </Link>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Nazwa, adres, NIP, KRS, logo i dane kontaktowe – używane na fakturach i w dokumentach.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="name">Nazwa</Label>
          <Input
            id="name"
            value={data.name}
            onChange={(e) => setData((d) => ({ ...d, name: e.target.value }))}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="address">Adres (ulica, numer)</Label>
          <Input
            id="address"
            value={data.address ?? ""}
            onChange={(e) => setData((d) => ({ ...d, address: e.target.value || null }))}
            className="mt-1"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="postalCode">Kod pocztowy</Label>
            <Input
              id="postalCode"
              value={data.postalCode ?? ""}
              onChange={(e) => setData((d) => ({ ...d, postalCode: e.target.value || null }))}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="city">Miasto</Label>
            <Input
              id="city"
              value={data.city ?? ""}
              onChange={(e) => setData((d) => ({ ...d, city: e.target.value || null }))}
              className="mt-1"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="nip">NIP</Label>
            <Input
              id="nip"
              value={data.nip ?? ""}
              onChange={(e) => setData((d) => ({ ...d, nip: e.target.value || null }))}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="krs">KRS</Label>
            <Input
              id="krs"
              value={data.krs ?? ""}
              onChange={(e) => setData((d) => ({ ...d, krs: e.target.value || null }))}
              className="mt-1"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="logoUrl">URL logo (np. /uploads/logo.png)</Label>
          <Input
            id="logoUrl"
            value={data.logoUrl ?? ""}
            onChange={(e) => setData((d) => ({ ...d, logoUrl: e.target.value || null }))}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="phone">Telefon</Label>
          <Input
            id="phone"
            type="tel"
            value={data.phone ?? ""}
            onChange={(e) => setData((d) => ({ ...d, phone: e.target.value || null }))}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={data.email ?? ""}
            onChange={(e) => setData((d) => ({ ...d, email: e.target.value || null }))}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="website">Strona WWW</Label>
          <Input
            id="website"
            type="url"
            value={data.website ?? ""}
            onChange={(e) => setData((d) => ({ ...d, website: e.target.value || null }))}
            className="mt-1"
          />
        </div>
        <div className="grid grid-cols-2 gap-4 pt-2 border-t">
          <div>
            <Label htmlFor="checkIn">Godzina check-in (HH:mm)</Label>
            <Input
              id="checkIn"
              type="time"
              value={data.defaultCheckInTime ?? "14:00"}
              onChange={(e) => setData((d) => ({ ...d, defaultCheckInTime: e.target.value || null }))}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="checkOut">Godzina check-out (HH:mm)</Label>
            <Input
              id="checkOut"
              type="time"
              value={data.defaultCheckOutTime ?? "11:00"}
              onChange={(e) => setData((d) => ({ ...d, defaultCheckOutTime: e.target.value || null }))}
              className="mt-1"
            />
          </div>
        </div>
        <Button type="submit" disabled={saving}>
          {saving ? "Zapisywanie…" : "Zapisz"}
        </Button>
      </form>

      {/* Sekcja: Wyłączenie logowania */}
      <div className="mt-10 pt-6 border-t">
        <div className="flex items-center gap-3 mb-3">
          <ShieldOff className="w-5 h-5 text-orange-500" />
          <h2 className="text-lg font-semibold">Tryb bez logowania</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Wyłącza wymóg logowania — system będzie dostępny bez hasła. Przydatne do demo, szkolenia lub podglądu przez NotebookLM.
        </p>

        {data.authDisabled && (
          <div className="flex items-start gap-2 p-3 mb-4 rounded-md bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800">
            <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
            <p className="text-sm text-orange-700 dark:text-orange-300">
              Logowanie jest wyłączone. Każdy z dostępem do adresu systemu może przeglądać dane bez hasła.
              Nie używaj tego trybu na produkcji z prawdziwymi danymi gości.
            </p>
          </div>
        )}

        <div className="flex items-center gap-3">
          <Switch
            id="authDisabled"
            checked={data.authDisabled}
            disabled={togglingAuth}
            onCheckedChange={async (checked) => {
              setTogglingAuth(true);
              const result = await toggleAuthDisabled(checked);
              setTogglingAuth(false);
              if (!result.success) {
                toast.error(result.error);
                return;
              }
              setData((d) => ({ ...d, authDisabled: checked }));
              toast.success(
                checked
                  ? "Logowanie wyłączone — system dostępny bez hasła"
                  : "Logowanie włączone — wymagane hasło"
              );
            }}
          />
          <Label htmlFor="authDisabled" className="cursor-pointer flex items-center gap-2">
            Wyłącz wymóg logowania (tryb demo)
            {togglingAuth && <Loader2 className="w-3 h-3 animate-spin" />}
          </Label>
        </div>
      </div>
    </div>
  );
}
