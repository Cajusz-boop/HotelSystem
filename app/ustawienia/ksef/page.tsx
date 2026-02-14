"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, FileCheck, CheckCircle, XCircle, Loader2, Shield, Wifi, History } from "lucide-react";
import { getKsefConfig, getKsefSentBatches, initKsefSession, terminateKsefSession, type KsefConfig, type KsefSentBatchRow } from "@/app/actions/ksef";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function KsefSettingsPage() {
  const [config, setConfig] = useState<KsefConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [testConnecting, setTestConnecting] = useState(false);
  const [batches, setBatches] = useState<KsefSentBatchRow[]>([]);
  const [batchesLoading, setBatchesLoading] = useState(false);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    const result = await getKsefConfig();
    if (result.success) {
      setConfig(result.data);
    }
    setLoading(false);
  }, []);

  const loadBatches = useCallback(async () => {
    setBatchesLoading(true);
    const result = await getKsefSentBatches(50);
    if (result.success) {
      setBatches(result.data);
    }
    setBatchesLoading(false);
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  const handleTestConnection = async () => {
    setTestConnecting(true);
    try {
      const initRes = await initKsefSession(null);
      if (!initRes.success) {
        toast.error(initRes.error ?? "Błąd inicjacji sesji KSeF");
        return;
      }
      const termRes = await terminateKsefSession(initRes.data.sessionId);
      if (!termRes.success) {
        toast.warning("Sesja utworzona, ale zakończenie sesji nie powiodło się: " + (termRes.error ?? ""));
      } else {
        toast.success("Połączenie z KSeF OK (sesja testowa utworzona i zamknięta).");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Błąd testu połączenia");
    } finally {
      setTestConnecting(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FileCheck className="w-6 h-6" />
          <h1 className="text-2xl font-bold">KSeF (Krajowy System e-Faktur)</h1>
        </div>
        <Link href="/ustawienia">
          <Button variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Powrót
          </Button>
        </Link>
      </div>

      <div className="border rounded-lg bg-card p-6">
        <h2 className="font-medium text-lg mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Konfiguracja
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : config ? (
          <div className="space-y-6">
            {/* Środowisko */}
            <div className="space-y-2">
              <Label>Środowisko</Label>
              <Select value={config.env} disabled>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="test">Test (ksef-test.mf.gov.pl)</SelectItem>
                  <SelectItem value="prod">Produkcja (ksef.mf.gov.pl)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Tryb Produkcja wymaga KSEF_ENV=prod w .env i potwierdzenia w UI przy wysyłce. Bez wartości używana jest bramka testowa (Demo).
              </p>
            </div>

            {/* NIP */}
            <div className="space-y-2">
              <Label>NIP (sprzedawcy)</Label>
              <div className="flex items-center gap-3">
                {config.nipMasked ? (
                  <code className="bg-muted px-3 py-1.5 rounded text-sm font-mono">
                    {config.nipMasked}
                  </code>
                ) : (
                  <span className="text-muted-foreground text-sm">Nie ustawiony</span>
                )}
                {config.nip ? (
                  <span className="flex items-center gap-1 text-green-600 text-sm">
                    <CheckCircle className="w-4 h-4" />
                    Skonfigurowano
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-amber-600 text-sm">
                    <XCircle className="w-4 h-4" />
                    Ustaw KSEF_NIP w .env (10 cyfr)
                  </span>
                )}
              </div>
            </div>

            {/* Token autoryzacyjny */}
            <div className="space-y-2">
              <Label>Token autoryzacyjny</Label>
              <div className="flex items-center gap-3">
                {config.tokenSet ? (
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    Ustawiony (KSEF_AUTH_TOKEN w .env)
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-amber-600">
                    <XCircle className="w-4 h-4" />
                    Nie ustawiony – ustaw KSEF_AUTH_TOKEN w .env
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Token do autoryzacji w KSeF (np. z portalu podatkowego). Nie jest wyświetlany ze względów bezpieczeństwa.
              </p>
            </div>

            {/* Adres API */}
            <div className="space-y-2">
              <Label>Adres API (aktualny)</Label>
              <code className="block bg-muted px-3 py-1.5 rounded text-sm font-mono break-all">
                {config.baseUrl}
              </code>
            </div>

            <div className="pt-4 border-t flex flex-wrap items-center gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleTestConnection}
                disabled={testConnecting || !config.nip}
              >
                {testConnecting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Wifi className="w-4 h-4 mr-2" />
                )}
                Testuj połączenie
              </Button>
              <span className="text-sm text-muted-foreground">
                Konfiguracja jest odczytywana ze zmiennych środowiskowych (.env). Po zmianie KSEF_ENV, KSEF_NIP lub KSEF_AUTH_TOKEN zrestartuj aplikację.
              </span>
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground">Nie udało się załadować konfiguracji.</p>
        )}
      </div>

      <div className="mt-6 border rounded-lg bg-card p-6">
        <h2 className="font-medium text-lg mb-4 flex items-center gap-2">
          <History className="w-5 h-5" />
          Historia wysyłek KSeF
        </h2>

        {batchesLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : batches.length === 0 ? (
          <p className="text-muted-foreground py-4">Brak wysłanych partii do KSeF.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Nr referencyjny</TableHead>
                  <TableHead className="text-right">Liczba faktur</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono text-sm">
                      {new Date(b.sentAt).toLocaleString("pl-PL")}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={b.status} />
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {b.batchReferenceNumber ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">{b.invoiceCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "SENT"
      ? "default"
      : status === "PARTIAL"
        ? "secondary"
        : status === "FAILED"
          ? "destructive"
          : "outline";
  return <Badge variant={variant}>{status}</Badge>;
}
