"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  listUsersForAdmin,
  updateUserLimits,
  type UserListItem,
} from "@/app/actions/users";
import { toast } from "sonner";
import { Users, ArrowLeft, Save } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  RECEPTION: "Recepcja",
  MANAGER: "Manager",
  HOUSEKEEPING: "Gospodarka",
  OWNER: "Właściciel",
};

export default function UzytkownicyPage() {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<string, { maxPercent: string; maxAmount: string; maxVoid: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const result = await listUsersForAdmin();
    setLoading(false);
    if (result.success) {
      setUsers(result.data);
      setEditing({});
    } else {
      setError(result.error);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const setEdit = (userId: string, field: "maxPercent" | "maxAmount", value: string) => {
    setEditing((prev) => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        [field]: value,
      },
    }));
  };

  const getEditValues = (u: UserListItem) => {
    const e = editing[u.id];
    return {
      maxPercent: e?.maxPercent ?? (u.maxDiscountPercent != null ? String(u.maxDiscountPercent) : ""),
      maxAmount: e?.maxAmount ?? (u.maxDiscountAmount != null ? String(u.maxDiscountAmount) : ""),
      maxVoid: e?.maxVoid ?? (u.maxVoidAmount != null ? String(u.maxVoidAmount) : ""),
    };
  };

  const saveLimits = async (u: UserListItem) => {
    const { maxPercent, maxAmount, maxVoid } = getEditValues(u);
    const numPercent = maxPercent.trim() === "" ? null : parseFloat(maxPercent);
    const numAmount = maxAmount.trim() === "" ? null : parseFloat(maxAmount);
    const numVoid = maxVoid.trim() === "" ? null : parseFloat(maxVoid);
    if (numPercent != null && (Number.isNaN(numPercent) || numPercent < 0 || numPercent > 100)) {
      toast.error("Limit % musi być liczbą 0–100");
      return;
    }
    if (numAmount != null && (Number.isNaN(numAmount) || numAmount < 0)) {
      toast.error("Limit rabatu kwotowego musi być liczbą ≥ 0");
      return;
    }
    if (numVoid != null && (Number.isNaN(numVoid) || numVoid < 0)) {
      toast.error("Limit void musi być liczbą ≥ 0");
      return;
    }
    setSavingId(u.id);
    const result = await updateUserLimits(u.id, numPercent, numAmount, numVoid);
    setSavingId(null);
    if (result.success) {
      toast.success("Zapisano limity");
      setEditing((prev) => {
        const next = { ...prev };
        delete next[u.id];
        return next;
      });
      load();
    } else {
      toast.error(result.error);
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="text-muted-foreground">Ładowanie…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="text-destructive">{error}</p>
        <Link href="/ustawienia">
          <Button variant="outline" className="mt-2">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Powrót
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6" />
          <h1 className="text-2xl font-bold">Użytkownicy – limity rabatowe</h1>
        </div>
        <Link href="/ustawienia">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Powrót
          </Button>
        </Link>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        Limity rabatowe: max % i max kwota (PLN). Limit void: anulowanie transakcji powyżej tej kwoty wymaga PIN managera. Puste = domyślne z konfiguracji. Manager i Właściciel bez limitów mają pełne uprawnienia.
      </p>

      <div className="rounded-lg border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Użytkownik</th>
              <th className="text-left p-3 font-medium">Rola</th>
              <th className="text-left p-3 font-medium">Max rabat %</th>
              <th className="text-left p-3 font-medium">Max rabat (PLN)</th>
              <th className="text-left p-3 font-medium">Max void (PLN)</th>
              <th className="p-3 w-24" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const { maxPercent, maxAmount, maxVoid } = getEditValues(u);
              return (
                <tr key={u.id} className="border-b last:border-0">
                  <td className="p-3">
                    <div className="font-medium">{u.name}</div>
                    <div className="text-muted-foreground text-xs">{u.email}</div>
                  </td>
                  <td className="p-3">{ROLE_LABELS[u.role] ?? u.role}</td>
                  <td className="p-3">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      placeholder="np. 10"
                      className="w-24"
                      value={maxPercent}
                      onChange={(e) => setEdit(u.id, "maxPercent", e.target.value)}
                    />
                  </td>
                  <td className="p-3">
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      placeholder="np. 500"
                      className="w-28"
                      value={maxAmount}
                      onChange={(e) => setEdit(u.id, "maxAmount", e.target.value)}
                    />
                  </td>
                  <td className="p-3">
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      placeholder="np. 500"
                      className="w-28"
                      value={maxVoid}
                      onChange={(e) => setEdit(u.id, "maxVoid", e.target.value)}
                    />
                  </td>
                  <td className="p-3">
                    <Button
                      size="sm"
                      onClick={() => saveLimits(u)}
                      disabled={savingId === u.id}
                    >
                      {savingId === u.id ? "Zapisywanie…" : <Save className="h-4 w-4" />}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
