"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface PayFormProps {
  token: string;
  amount: number;
}

export function PayForm({ token, amount }: PayFormProps) {
  const [loading, setLoading] = useState(false);
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSimulatePayment = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/finance/webhook/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, amount, provider: "test" }),
      });
      const data = await res.json();
      if (data.success) {
        setPaid(true);
      } else {
        setError("error" in data ? (data.error ?? "Błąd płatności") : "Błąd płatności");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd połączenia");
    } finally {
      setLoading(false);
    }
  };

  if (paid) {
    return (
      <div className="rounded-lg border bg-card p-8 shadow-sm max-w-md w-full">
        <h1 className="text-xl font-semibold mb-2 text-green-600">Płatność zarejestrowana</h1>
        <p className="text-muted-foreground mb-6">
          Kwota {amount.toFixed(2)} PLN została zaksięgowana na rezerwację. Transakcja typu DEPOSIT
          została utworzona w systemie.
        </p>
        <Link href="/" className="text-sm text-primary hover:underline">
          ← Powrót do strony głównej
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-8 shadow-sm max-w-md w-full">
      <h1 className="text-xl font-semibold mb-2">Płatność online</h1>
      <p className="text-muted-foreground mb-4">
        Kwota do zapłaty: <strong>{amount.toFixed(2)} PLN</strong>
      </p>
      <p className="text-sm text-muted-foreground mb-6">
        W produkcji przekierowalibyśmy do PayU / Przelewy24 / Stripe. Webhook{" "}
        <code className="text-xs bg-muted px-1 rounded">POST /api/finance/webhook/payment</code>{" "}
        księguje wpłatę (Transaction DEPOSIT, PaymentLink → PAID).
      </p>
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          onClick={handleSimulatePayment}
          disabled={loading}
        >
          {loading ? "Księgowanie…" : "Symuluj wpłatę (test)"}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      <Link href="/" className="mt-6 inline-block text-sm text-primary hover:underline">
        ← Powrót do strony głównej
      </Link>
    </div>
  );
}
