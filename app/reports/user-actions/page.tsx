"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getAuditTrail,
  getUsersForActionsReport,
  type AuditTrailItem,
  type UserForReport,
} from "@/app/actions/audit";
import { toast } from "sonner";
import { RefreshCw, User } from "lucide-react";

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Utworzenie",
  UPDATE: "Modyfikacja",
  DELETE: "Usunięcie",
};

function formatJson(val: unknown): string {
  if (val == null) return "—";
  if (typeof val === "string") return val;
  try {
    const s = JSON.stringify(val);
    return s.length > 120 ? s.slice(0, 120) + "…" : s;
  } catch {
    return String(val);
  }
}

export default function UserActionsReportPage() {
  const [users, setUsers] = useState<UserForReport[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [items, setItems] = useState<AuditTrailItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getUsersForActionsReport().then((r) => {
      if (r.success) setUsers(r.data);
    });
  }, []);

  const load = async () => {
    if (!selectedUserId) {
      toast.error("Wybierz użytkownika");
      return;
    }
    setLoading(true);
    setLoaded(true);
    const result = await getAuditTrail({
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
      userId: selectedUserId,
      limit: 500,
    });
    setLoading(false);
    if (result.success) {
      setItems(result.data);
    } else {
      toast.error(result.error);
      setItems([]);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex flex-wrap items-end gap-4">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <User className="h-6 w-6" />
          Raport akcji użytkowników
        </h1>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">Użytkownik</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="mt-1 w-56">
                <SelectValue placeholder="Wybierz użytkownika" />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Od</Label>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="mt-1 w-40"
            />
          </div>
          <div>
            <Label className="text-xs">Do</Label>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="mt-1 w-40"
            />
          </div>
          <Button onClick={load} disabled={loading || !selectedUserId}>
            {loading ? "Ładowanie…" : <RefreshCw className="mr-2 h-4 w-4" />}
            Pobierz
          </Button>
        </div>
      </div>

      {loaded && (
        <p className="text-sm text-muted-foreground">
          Wyświetlono {items.length} akcji (max 500). Kolejność: od najnowszych.
        </p>
      )}

      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/95">
              <tr className="border-b">
                <th className="text-left p-2 font-medium whitespace-nowrap">Data/czas</th>
                <th className="text-left p-2 font-medium whitespace-nowrap">Akcja</th>
                <th className="text-left p-2 font-medium whitespace-nowrap">Typ encji</th>
                <th className="text-left p-2 font-medium whitespace-nowrap">ID</th>
                <th className="text-left p-2 font-medium">Stara wartość</th>
                <th className="text-left p-2 font-medium">Nowa wartość</th>
                <th className="text-left p-2 font-medium whitespace-nowrap">IP</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="p-2 whitespace-nowrap">
                    {new Date(row.timestamp).toLocaleString("pl-PL")}
                  </td>
                  <td className="p-2 whitespace-nowrap">{ACTION_LABELS[row.actionType] ?? row.actionType}</td>
                  <td className="p-2 whitespace-nowrap">{row.entityType}</td>
                  <td className="p-2 whitespace-nowrap font-mono text-xs">{row.entityId ?? "—"}</td>
                  <td className="p-2 max-w-xs truncate text-muted-foreground" title={formatJson(row.oldValue)}>
                    {formatJson(row.oldValue)}
                  </td>
                  <td className="p-2 max-w-xs truncate" title={formatJson(row.newValue)}>
                    {formatJson(row.newValue)}
                  </td>
                  <td className="p-2 whitespace-nowrap text-muted-foreground">{row.ipAddress ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {items.length === 0 && loaded && !loading && (
          <div className="p-8 text-center text-muted-foreground">
            Brak akcji dla wybranego użytkownika i okresu.
          </div>
        )}
      </div>
    </div>
  );
}
