"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const COUNTRIES = [
  "Polska",
  "Niemcy",
  "Czechy",
  "Słowacja",
  "Ukraina",
  "Litwa",
  "Białoruś",
  "Rosja",
  "Wielka Brytania",
  "Francja",
  "Włochy",
  "Hiszpania",
  "Inny",
];

export function GuestForm({
  roomName,
  totalAmount,
  onSubmit,
  onBack,
  loading,
  error,
}: {
  roomName: string;
  totalAmount: number;
  onSubmit: (data: {
    guestName: string;
    guestEmail: string;
    guestPhone: string;
    guestCountry: string;
    notes: string;
    acceptRegulamin: boolean;
    acceptRodo: boolean;
    marketingConsent: boolean;
    paymentIntent: "FULL" | "NONE";
  }) => void;
  onBack: () => void;
  loading: boolean;
  error: string | null;
}) {
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestCountry, setGuestCountry] = useState("Polska");
  const [notes, setNotes] = useState("");
  const [acceptRegulamin, setAcceptRegulamin] = useState(false);
  const [acceptRodo, setAcceptRodo] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);

  const handleSubmit = (e: React.FormEvent, intent: "FULL" | "NONE") => {
    e.preventDefault();
    if (!acceptRegulamin || !acceptRodo) return;
    onSubmit({
      guestName,
      guestEmail,
      guestPhone,
      guestCountry,
      notes,
      acceptRegulamin,
      acceptRodo,
      marketingConsent,
      paymentIntent: intent,
    });
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); }} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {roomName} · {totalAmount.toFixed(0)} PLN
      </p>

      <div>
        <Label htmlFor="guestName">Imię i nazwisko *</Label>
        <Input
          id="guestName"
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
          required
          placeholder="Jan Kowalski"
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="guestEmail">E-mail *</Label>
        <Input
          id="guestEmail"
          type="email"
          value={guestEmail}
          onChange={(e) => setGuestEmail(e.target.value)}
          required
          placeholder="jan@example.com"
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="guestPhone">Telefon *</Label>
        <Input
          id="guestPhone"
          type="tel"
          value={guestPhone}
          onChange={(e) => setGuestPhone(e.target.value)}
          required
          placeholder="+48 600 123 456"
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="guestCountry">Kraj</Label>
        <select
          id="guestCountry"
          value={guestCountry}
          onChange={(e) => setGuestCountry(e.target.value)}
          className={cn(
            "mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          )}
        >
          {COUNTRIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="notes">Uwagi do rezerwacji</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="np. Proszę o pokój z widokiem na jezioro"
          rows={2}
          className="mt-1"
        />
      </div>

      <div className="space-y-3 pt-2">
        <label className="flex items-start gap-2 cursor-pointer">
          <Checkbox
            checked={acceptRegulamin}
            onCheckedChange={(v) => setAcceptRegulamin(v === true)}
            required
          />
          <span className="text-sm leading-tight">Akceptuję regulamin hotelu *</span>
        </label>
        <label className="flex items-start gap-2 cursor-pointer">
          <Checkbox
            checked={acceptRodo}
            onCheckedChange={(v) => setAcceptRodo(v === true)}
            required
          />
          <span className="text-sm leading-tight">
            Zgadzam się na przetwarzanie danych osobowych (RODO) *
          </span>
        </label>
        <label className="flex items-start gap-2 cursor-pointer">
          <Checkbox
            checked={marketingConsent}
            onCheckedChange={(v) => setMarketingConsent(v === true)}
          />
          <span className="text-sm leading-tight">Chcę otrzymywać oferty marketingowe</span>
        </label>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-col sm:flex-row gap-2 pt-2">
        <Button
          type="button"
          className="bg-blue-600 hover:bg-blue-700 py-3"
          disabled={loading || !acceptRegulamin || !acceptRodo}
          onClick={(e) => handleSubmit(e as unknown as React.FormEvent, "FULL")}
        >
          {loading ? "Zapisywanie…" : "Rezerwuj i zapłać"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={loading || !acceptRegulamin || !acceptRodo}
          onClick={(e) => handleSubmit(e as unknown as React.FormEvent, "NONE")}
        >
          Rezerwuj bez płatności
        </Button>
        <Button type="button" variant="ghost" onClick={onBack} className="sm:ml-auto">
          Wstecz
        </Button>
      </div>
    </form>
  );
}
