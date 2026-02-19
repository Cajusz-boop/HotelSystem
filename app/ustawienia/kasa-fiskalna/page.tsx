"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  getFiscalConfigAction,
  supportsFiscalReportsAction,
} from "@/app/actions/finance";
import type { FiscalConfig } from "@/lib/fiscal/types";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Loader2,
  Wifi,
  WifiOff,
  Printer,
  FileText,
  Receipt,
  AlertTriangle,
  Info,
  Copy,
  ExternalLink,
  Zap,
  Settings,
  Monitor,
  Download,
} from "lucide-react";

type ConnectionStatus = "idle" | "testing" | "ok" | "error";

interface BridgeTestResult {
  success: boolean;
  responseTimeMs?: number;
  bridgeInfo?: Record<string, unknown>;
  error?: string;
}

interface FiscalSupport {
  supportsXReport: boolean;
  supportsZReport: boolean;
  supportsPeriodicReport: boolean;
  supportsStorno: boolean;
}

export default function KasaFiskalnaPage() {
  const [config, setConfig] = useState<FiscalConfig | null>(null);
  const [support, setSupport] = useState<FiscalSupport | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle");
  const [testResult, setTestResult] = useState<BridgeTestResult | null>(null);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const [cfg, sup] = await Promise.all([
        getFiscalConfigAction(),
        supportsFiscalReportsAction(),
      ]);
      setConfig(cfg);
      setSupport(sup);
    } catch {
      toast.error("Nie udało się załadować konfiguracji kasy");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleTestConnection = async () => {
    setConnectionStatus("testing");
    setTestResult(null);

    const bridgeUrl = "http://127.0.0.1:9977/health";
    const start = Date.now();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(bridgeUrl, { signal: controller.signal });
      clearTimeout(timeout);
      const elapsed = Date.now() - start;

      if (!res.ok) {
        const result: BridgeTestResult = { success: false, responseTimeMs: elapsed, error: `Bridge odpowiedział HTTP ${res.status}` };
        setTestResult(result);
        setConnectionStatus("error");
        toast.error(result.error);
        return;
      }

      const data = await res.json().catch(() => null);
      const result: BridgeTestResult = {
        success: true,
        responseTimeMs: elapsed,
        bridgeInfo: data && typeof data === "object" ? data : undefined,
      };
      setTestResult(result);
      setConnectionStatus("ok");
      toast.success(`Połączenie OK (${elapsed} ms)`);
    } catch (e) {
      const elapsed = Date.now() - start;
      const msg = e instanceof Error && e.name === "AbortError"
        ? "Timeout (5s) – bridge nie odpowiada"
        : "Brak połączenia";
      const result: BridgeTestResult = { success: false, responseTimeMs: elapsed, error: `${msg}. Uruchom bridge: npm run posnet:bridge` };
      setTestResult(result);
      setConnectionStatus("error");
      toast.error(result.error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Skopiowano do schowka");
  };

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Printer className="w-6 h-6" />
          <h1 className="text-2xl font-bold">Kasa fiskalna – POSNET Trio</h1>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Ładowanie konfiguracji...
        </div>
      </div>
    );
  }

  const isEnabled = config?.enabled ?? false;
  const driver = config?.driver ?? "mock";
  const isPosnet = driver === "posnet";
  const isMock = driver === "mock";
  const modelName = config?.posnetModelConfig?.displayName ?? config?.posnetModel ?? "—";
  const supportsInvoice = config?.posnetModelConfig?.supportsInvoice ?? false;
  const supportsEReceipt = config?.posnetModelConfig?.supportsEReceipt ?? false;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Printer className="w-6 h-6" />
          <h1 className="text-2xl font-bold">Kasa fiskalna</h1>
        </div>
        <Link href="/ustawienia">
          <Button variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Powrót
          </Button>
        </Link>
      </div>

      <div className="space-y-6">
        {/* Status */}
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Monitor className="w-5 h-5" />
            Status kasy fiskalnej
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-md border p-4">
              {isEnabled ? (
                <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500 shrink-0" />
              )}
              <div>
                <p className="font-medium">{isEnabled ? "Włączona" : "Wyłączona"}</p>
                <p className="text-xs text-muted-foreground">FISCAL_ENABLED</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-md border p-4">
              <Settings className="w-5 h-5 text-blue-600 shrink-0" />
              <div>
                <p className="font-medium">{driver.toUpperCase()}</p>
                <p className="text-xs text-muted-foreground">FISCAL_DRIVER</p>
              </div>
            </div>

            {isPosnet && (
              <>
                <div className="flex items-center gap-3 rounded-md border p-4">
                  <Printer className="w-5 h-5 text-purple-600 shrink-0" />
                  <div>
                    <p className="font-medium">{modelName}</p>
                    <p className="text-xs text-muted-foreground">Model drukarki</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-md border p-4">
                  <Zap className="w-5 h-5 text-amber-600 shrink-0" />
                  <div>
                    <p className="font-medium">
                      {[
                        "Paragony",
                        supportsInvoice && "Faktury",
                        supportsEReceipt && "e-Paragony",
                      ].filter(Boolean).join(", ")}
                    </p>
                    <p className="text-xs text-muted-foreground">Obsługiwane funkcje</p>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Obsługa raportów */}
          {support && isEnabled && (
            <div className="mt-4 flex flex-wrap gap-2">
              {support.supportsXReport && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                  Raport X
                </span>
              )}
              {support.supportsZReport && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
                  Raport Z
                </span>
              )}
              {support.supportsPeriodicReport && (
                <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
                  Raport okresowy
                </span>
              )}
              {support.supportsStorno && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/30 dark:text-red-400">
                  Storno
                </span>
              )}
            </div>
          )}
        </section>

        {/* Test połączenia */}
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            {connectionStatus === "ok" ? (
              <Wifi className="w-5 h-5 text-green-600" />
            ) : connectionStatus === "error" ? (
              <WifiOff className="w-5 h-5 text-red-500" />
            ) : (
              <Wifi className="w-5 h-5" />
            )}
            Test połączenia
          </h2>

          <p className="text-sm text-muted-foreground mb-4">
            Sprawdź czy bridge POSNET jest uruchomiony i odpowiada na żądania.
          </p>

          <Button
            onClick={handleTestConnection}
            disabled={connectionStatus === "testing"}
            variant={connectionStatus === "ok" ? "outline" : "default"}
          >
            {connectionStatus === "testing" ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Testowanie...
              </>
            ) : connectionStatus === "ok" ? (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2 text-green-600" />
                Połączono – testuj ponownie
              </>
            ) : connectionStatus === "error" ? (
              <>
                <XCircle className="w-4 h-4 mr-2 text-red-500" />
                Błąd – spróbuj ponownie
              </>
            ) : (
              <>
                <Wifi className="w-4 h-4 mr-2" />
                Testuj połączenie
              </>
            )}
          </Button>

          {testResult && (
            <div
              className={`mt-4 rounded-md border p-4 text-sm ${
                testResult.success
                  ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30"
                  : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30"
              }`}
            >
              {testResult.success ? (
                <div className="space-y-2">
                  <p className="font-medium text-green-800 dark:text-green-400">
                    Połączenie OK
                    {testResult.responseTimeMs !== undefined && (
                      <span className="ml-2 text-xs font-normal text-green-600 dark:text-green-500">
                        ({testResult.responseTimeMs} ms)
                      </span>
                    )}
                  </p>
                  {testResult.bridgeInfo && (
                    <div className="text-xs text-green-700 dark:text-green-500 space-y-1">
                      {!!testResult.bridgeInfo.version && (
                        <p>Wersja bridge: {String(testResult.bridgeInfo.version)}</p>
                      )}
                      {!!testResult.bridgeInfo.mode && (
                        <p>Tryb: {String(testResult.bridgeInfo.mode).toUpperCase()}</p>
                      )}
                      {(() => {
                        const printer = testResult.bridgeInfo?.printer;
                        if (!printer || typeof printer !== "object") return null;
                        const p = printer as Record<string, unknown>;
                        const status = p.status as Record<string, unknown> | null;
                        return (
                          <div className="mt-1 pt-1 border-t border-green-200 dark:border-green-800">
                            <p className="font-medium">
                              Drukarka: {String(p.host ?? "?")}:{String(p.port ?? "?")}
                            </p>
                            {status?.ok ? (
                              <p>Status: OK — data/czas drukarki: {String(status.dateTime ?? "?")}</p>
                            ) : status ? (
                              <p className="text-amber-600">Status: {String(status.error ?? "brak odpowiedzi")}</p>
                            ) : null}
                          </div>
                        );
                      })()}
                      {!!testResult.bridgeInfo.counters && typeof testResult.bridgeInfo.counters === "object" && (
                        <p>
                          Paragony: {String((testResult.bridgeInfo.counters as Record<string, unknown>).receipts ?? 0)},
                          Faktury: {String((testResult.bridgeInfo.counters as Record<string, unknown>).invoices ?? 0)}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <p className="font-medium text-red-800 dark:text-red-400">Brak połączenia</p>
                  <p className="mt-1 text-red-700 dark:text-red-500">{testResult.error}</p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Pobierz instalator bridge */}
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Download className="w-5 h-5 text-blue-600" />
            Instalator bridge POSNET
          </h2>

          <p className="text-sm text-muted-foreground mb-4">
            Bridge POSNET to mały program, który musi działać na komputerze w recepcji.
            Łączy się z kasą fiskalną POSNET Trio przez WiFi i drukuje paragony.
          </p>

          <div className="rounded-md border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 p-4 mb-4">
            <p className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-3">
              Pobierz i zainstaluj na komputerze w recepcji:
            </p>
            <Button
              onClick={() => {
                window.location.href = "/api/fiscal/bridge-installer";
              }}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Pobierz posnet-bridge-installer.zip
            </Button>
          </div>

          <div className="space-y-6">
            {/* Krok 1 */}
            <div className="relative pl-8">
              <div className="absolute left-0 top-0 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                1
              </div>
              <h3 className="font-medium mb-2">Zainstaluj Node.js (jednorazowo)</h3>
              <p className="text-sm text-muted-foreground">
                Wejdź na{" "}
                <a href="https://nodejs.org" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                  nodejs.org
                </a>
                {" "}i zainstaluj wersję LTS (zielony przycisk). Po instalacji zrestartuj komputer.
              </p>
            </div>

            {/* Krok 2 */}
            <div className="relative pl-8">
              <div className="absolute left-0 top-0 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                2
              </div>
              <h3 className="font-medium mb-2">Rozpakuj pobrany ZIP na Pulpit</h3>
              <p className="text-sm text-muted-foreground">
                Kliknij prawym na pobrany plik → <strong>Wyodrębnij wszystkie</strong> → wybierz Pulpit.
                Powinien powstać folder <code className="px-1 py-0.5 rounded bg-muted font-mono text-xs">posnet-bridge-installer</code>.
              </p>
            </div>

            {/* Krok 3 */}
            <div className="relative pl-8">
              <div className="absolute left-0 top-0 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                3
              </div>
              <h3 className="font-medium mb-2">Włącz autostart</h3>
              <p className="text-sm text-muted-foreground">
                Wejdź do folderu i kliknij dwukrotnie <code className="px-1 py-0.5 rounded bg-muted font-mono text-xs">ZAINSTALUJ-AUTOSTART.bat</code>.
                Bridge będzie uruchamiał się automatycznie po włączeniu komputera — w tle, bez okna.
              </p>
            </div>

            {/* Krok 4 */}
            <div className="relative pl-8">
              <div className="absolute left-0 top-0 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                4
              </div>
              <h3 className="font-medium mb-2">Zrestartuj komputer i przetestuj</h3>
              <p className="text-sm text-muted-foreground">
                Po restarcie bridge wystartuje automatycznie. Wróć na tę stronę i kliknij <strong>Testuj połączenie</strong> powyżej.
                Powinien pokazać się zielony status z datą/czasem drukarki.
              </p>
            </div>

            {/* Krok 5 */}
            <div className="relative pl-8">
              <div className="absolute left-0 top-0 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                5
              </div>
              <h3 className="font-medium mb-2">Gotowe — paragony drukują się automatycznie</h3>
              <p className="text-sm text-muted-foreground">
                System automatycznie drukuje paragony przy obciążeniu pokoju i rejestracji zaliczki.
              </p>
            </div>
          </div>
        </section>

        {/* Informacje o POSNET Trio */}
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Printer className="w-5 h-5 text-purple-600" />
            POSNET Trio — parametry
          </h2>

          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            <div className="rounded-md border p-3">
              <p className="text-muted-foreground text-xs">Typ urządzenia</p>
              <p className="font-medium">Terminal + drukarka + kasa (3w1)</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-muted-foreground text-xs">Szerokość linii</p>
              <p className="font-medium">48 znaków</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-muted-foreground text-xs">Protokół</p>
              <p className="font-medium">v2 (nowszy)</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-muted-foreground text-xs">Max pozycji na paragonie</p>
              <p className="font-medium">300</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-muted-foreground text-xs">Obsługa faktur</p>
              <p className="font-medium text-green-600">Tak</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-muted-foreground text-xs">e-Paragony (KSeF)</p>
              <p className="font-medium text-green-600">Tak</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-muted-foreground text-xs">NIP na paragonie</p>
              <p className="font-medium text-green-600">Tak</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-muted-foreground text-xs">Kody kreskowe / QR</p>
              <p className="font-medium text-green-600">Tak</p>
            </div>
          </div>
        </section>

        {/* Tryb pracy bridge'a */}
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-6 shadow-sm dark:border-amber-800 dark:bg-amber-950/30">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2 text-amber-800 dark:text-amber-400">
            <AlertTriangle className="w-5 h-5" />
            Tryb pracy bridge&apos;a
          </h2>
          <p className="text-sm text-amber-700 dark:text-amber-500 mb-3">
            Aktualnie bridge działa w trybie <strong>SPOOL</strong> — przyjmuje zlecenia paragonów i faktur
            i zapisuje je jako pliki JSON do katalogu <code className="px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-900/50 font-mono text-xs">posnet-bridge/spool/</code>.
          </p>
          <p className="text-sm text-amber-700 dark:text-amber-500 mb-3">
            Aby bridge faktycznie drukował na urządzeniu POSNET Trio, trzeba w nim podpiąć sterownik producenta (OPOS/SDK).
            Wymaga to:
          </p>
          <ul className="text-sm text-amber-700 dark:text-amber-500 list-disc pl-5 space-y-1">
            <li>Zainstalowania sterownika POSNET na komputerze (ze strony producenta)</li>
            <li>Podłączenia kasy przez USB, COM lub LAN</li>
            <li>Rozszerzenia bridge&apos;a o wywołania SDK/OPOS (lub zewnętrzny program producenta)</li>
          </ul>
          <div className="mt-4">
            <a
              href="https://www.posnet.com.pl/sterowniki"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-amber-800 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-300 underline"
            >
              Sterowniki POSNET (strona producenta)
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </section>

        {/* Powiązane ustawienia */}
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Powiązane ustawienia</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Link href="/ustawienia/paragon" className="block">
              <div className="rounded-md border p-4 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <Receipt className="w-4 h-4 text-primary" />
                  <p className="font-medium text-sm">Szablon paragonu</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Nagłówek, stopka i nazwy pozycji na paragonach fiskalnych
                </p>
              </div>
            </Link>
            <Link href="/ustawienia/ksef" className="block">
              <div className="rounded-md border p-4 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-4 h-4 text-primary" />
                  <p className="font-medium text-sm">KSeF (e-Faktury)</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Konfiguracja Krajowego Systemu e-Faktur
                </p>
              </div>
            </Link>
            <Link href="/ustawienia/dane-hotelu" className="block">
              <div className="rounded-md border p-4 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <Settings className="w-4 h-4 text-primary" />
                  <p className="font-medium text-sm">Dane hotelu</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  NIP, adres i dane firmy (drukowane na dokumentach)
                </p>
              </div>
            </Link>
            <Link href="/finance" className="block">
              <div className="rounded-md border p-4 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <Printer className="w-4 h-4 text-primary" />
                  <p className="font-medium text-sm">Finanse — raporty fiskalne</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Raporty X, Z, okresowe i storno paragonów
                </p>
              </div>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
