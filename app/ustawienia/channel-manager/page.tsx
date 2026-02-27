"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import {
  ArrowLeft,
  RefreshCw,
  Database,
  Key,
  Globe,
  CheckCircle,
  AlertCircle,
  Info,
  ExternalLink,
  Terminal,
  Save,
} from "lucide-react";
import {
  getKwHotelExtractedConfig,
  getCurrentChannelManagerConfig,
  saveChannelManagerConfig,
  CHANNEL_MANAGER_TYPES,
  type ChannelManagerConfig,
  type ChannelManagerType,
} from "@/app/actions/channel-manager";

export default function ChannelManagerPage() {
  const [kwConfig, setKwConfig] = useState<ChannelManagerConfig | null>(null);
  const [kwError, setKwError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Formularz konfiguracji
  const [cmType, setCmType] = useState<ChannelManagerType>("wubook");
  const [apiEndpoint, setApiEndpoint] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [currentConfig, setCurrentConfig] = useState<{
    channelManagerType?: string;
    apiEndpoint?: string;
    propertyId?: string;
    apiKey?: string;
    username?: string;
  } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [kwResult, currentResult] = await Promise.all([
        getKwHotelExtractedConfig(),
        getCurrentChannelManagerConfig(),
      ]);

      if (kwResult.success && kwResult.data) {
        setKwConfig(kwResult.data);
        setKwError(null);
      } else {
        setKwError(kwResult.error || "Nieznany błąd");
      }

      if (currentResult.success && currentResult.data) {
        setCurrentConfig(currentResult.data);
        if (currentResult.data.channelManagerType) {
          setCmType(currentResult.data.channelManagerType as ChannelManagerType);
        }
        if (currentResult.data.apiEndpoint) {
          setApiEndpoint(currentResult.data.apiEndpoint);
        }
        if (currentResult.data.propertyId) {
          setPropertyId(currentResult.data.propertyId);
        }
        if (currentResult.data.username) {
          setUsername(currentResult.data.username);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    const cmInfo = CHANNEL_MANAGER_TYPES[cmType];

    // Walidacja wymaganych pól
    for (const field of cmInfo.requiredFields) {
      if (field === "apiEndpoint" && !apiEndpoint) {
        toast.error("Podaj URL API");
        return;
      }
      if (field === "propertyId" && !propertyId) {
        toast.error("Podaj Property ID");
        return;
      }
      if (field === "apiKey" && !apiKey) {
        toast.error("Podaj API Key");
        return;
      }
      if (field === "username" && !username) {
        toast.error("Podaj nazwę użytkownika");
        return;
      }
      if (field === "password" && !password) {
        toast.error("Podaj hasło");
        return;
      }
    }

    setSaving(true);
    try {
      const result = await saveChannelManagerConfig({
        channelManagerType: cmType,
        apiEndpoint: apiEndpoint || undefined,
        propertyId: propertyId || undefined,
        apiKey: apiKey || undefined,
        username: username || undefined,
        password: password || undefined,
      });

      if (result.success) {
        toast.success("Konfiguracja zapisana. Restart serwera może być wymagany.");
        loadData();
      } else {
        toast.error(result.error || "Błąd zapisu");
      }
    } finally {
      setSaving(false);
    }
  }

  const cmInfo = CHANNEL_MANAGER_TYPES[cmType];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/ustawienia">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Channel Manager</h1>
      </div>

      <p className="text-muted-foreground mb-6">
        Konfiguracja połączenia z Channel Managerem do synchronizacji dostępności, 
        cen i rezerwacji z OTA (Booking.com, Expedia, Airbnb, itp.).
      </p>

      {/* Aktualny status */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {currentConfig?.channelManagerType ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <AlertCircle className="w-5 h-5 text-yellow-500" />
            )}
            Status połączenia
          </CardTitle>
        </CardHeader>
        <CardContent>
          {currentConfig?.channelManagerType ? (
            <div className="space-y-2">
              <p>
                <strong>Channel Manager:</strong>{" "}
                {CHANNEL_MANAGER_TYPES[currentConfig.channelManagerType as ChannelManagerType]?.name || currentConfig.channelManagerType}
              </p>
              {currentConfig.propertyId && (
                <p>
                  <strong>Property ID:</strong> {currentConfig.propertyId}
                </p>
              )}
              {currentConfig.apiKey && (
                <p>
                  <strong>API Key:</strong> {currentConfig.apiKey}
                </p>
              )}
              {currentConfig.apiEndpoint && (
                <p>
                  <strong>Endpoint:</strong> {currentConfig.apiEndpoint}
                </p>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground">
              Channel Manager nie jest skonfigurowany. Wypełnij formularz poniżej lub 
              wyciągnij dane z KW Hotel.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Dane z KW Hotel */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Dane z KW Hotel
          </CardTitle>
          <CardDescription>
            Wyciągnięte informacje o Channel Managerze i kanałach sprzedaży z bazy KW Hotel
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Ładowanie...
            </div>
          ) : kwError ? (
            <div className="space-y-4">
              <div className="flex items-start gap-2 text-yellow-600 bg-yellow-50 p-3 rounded-lg">
                <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">Brak danych z KW Hotel</p>
                  <p className="text-sm">{kwError}</p>
                </div>
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-medium flex items-center gap-2 mb-2">
                  <Terminal className="w-4 h-4" />
                  Jak uruchomić ekstrakcję?
                </h4>
                <ol className="text-sm space-y-2 list-decimal list-inside">
                  <li>Upewnij się, że masz bazę KW Hotel zaimportowaną do MySQL (XAMPP)</li>
                  <li>
                    Uruchom skrypt w terminalu:
                    <code className="block bg-background p-2 rounded mt-1 font-mono text-xs">
                      npx tsx prisma/extract-kwhotel-channel-manager.ts
                    </code>
                  </li>
                  <li>Odśwież tę stronę</li>
                </ol>
              </div>
            </div>
          ) : kwConfig ? (
            <div className="space-y-4">
              {kwConfig.extractedAt && (
                <p className="text-sm text-muted-foreground">
                  Dane wyciągnięte: {new Date(kwConfig.extractedAt).toLocaleString("pl-PL")}
                </p>
              )}

              {/* Kanały sprzedaży */}
              {kwConfig.bookingSources && kwConfig.bookingSources.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Skonfigurowane kanały sprzedaży:</h4>
                  <div className="flex flex-wrap gap-2">
                    {kwConfig.bookingSources.map((source) => (
                      <span
                        key={source.rsk_id}
                        className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm"
                      >
                        {source.rsk_nazwa}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Statystyki rezerwacji per kanał */}
              {kwConfig.channelStats && kwConfig.channelStats.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Rezerwacje wg kanału:</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Kanał</TableHead>
                        <TableHead className="text-right">Rezerwacji</TableHead>
                        <TableHead>Pierwsza</TableHead>
                        <TableHead>Ostatnia</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {kwConfig.channelStats.slice(0, 10).map((stat, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{stat.kanal}</TableCell>
                          <TableCell className="text-right">{stat.liczba_rezerwacji}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {stat.pierwsza_rezerwacja?.toString().slice(0, 10)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {stat.ostatnia_rezerwacja?.toString().slice(0, 10)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Ustawienia API */}
              {kwConfig.apiSettings && kwConfig.apiSettings.length > 0 && (
                <Accordion type="single" collapsible>
                  <AccordionItem value="api-settings">
                    <AccordionTrigger>
                      <span className="flex items-center gap-2">
                        <Key className="w-4 h-4" />
                        Znalezione ustawienia API ({kwConfig.apiSettings.length})
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Tabela</TableHead>
                            <TableHead>Kolumna</TableHead>
                            <TableHead>Typ</TableHead>
                            <TableHead>Wartość</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {kwConfig.apiSettings.map((setting, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-mono text-xs">{setting.table}</TableCell>
                              <TableCell className="font-mono text-xs">{setting.column}</TableCell>
                              <TableCell>{setting.type}</TableCell>
                              <TableCell className="font-mono text-xs max-w-[200px] truncate">
                                {setting.sampleValue !== null ? String(setting.sampleValue) : "-"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              )}

              <Button variant="outline" onClick={loadData}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Odśwież
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Formularz konfiguracji */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Konfiguracja Channel Managera
          </CardTitle>
          <CardDescription>
            Wprowadź dane dostępowe do Channel Managera
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Wybór typu CM */}
          <div className="space-y-2">
            <Label>Typ Channel Managera</Label>
            <Select
              value={cmType}
              onValueChange={(v) => setCmType(v as ChannelManagerType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CHANNEL_MANAGER_TYPES).map(([key, info]) => (
                  <SelectItem key={key} value={key}>
                    {info.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">{cmInfo.description}</p>
            {cmInfo.apiDocs && (
              <a
                href={cmInfo.apiDocs}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" />
                Dokumentacja API
              </a>
            )}
          </div>

          {/* Pola formularza w zależności od typu CM */}
          <div className="grid gap-4 sm:grid-cols-2">
            {(cmInfo.requiredFields.includes("apiEndpoint") ||
              cmInfo.optionalFields.includes("apiEndpoint")) && (
              <div className="space-y-2">
                <Label>
                  URL API{" "}
                  {cmInfo.requiredFields.includes("apiEndpoint") && (
                    <span className="text-red-500">*</span>
                  )}
                </Label>
                <Input
                  value={apiEndpoint}
                  onChange={(e) => setApiEndpoint(e.target.value)}
                  placeholder="https://api.example.com/v1"
                />
              </div>
            )}

            {(cmInfo.requiredFields.includes("propertyId") ||
              cmInfo.optionalFields.includes("propertyId")) && (
              <div className="space-y-2">
                <Label>
                  Property ID / Hotel ID{" "}
                  {cmInfo.requiredFields.includes("propertyId") && (
                    <span className="text-red-500">*</span>
                  )}
                </Label>
                <Input
                  value={propertyId}
                  onChange={(e) => setPropertyId(e.target.value)}
                  placeholder="np. 123456"
                />
              </div>
            )}

            {(cmInfo.requiredFields.includes("apiKey") ||
              cmInfo.optionalFields.includes("apiKey")) && (
              <div className="space-y-2">
                <Label>
                  API Key / Token{" "}
                  {cmInfo.requiredFields.includes("apiKey") && (
                    <span className="text-red-500">*</span>
                  )}
                </Label>
                <Input
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Twój klucz API"
                  type="password"
                />
              </div>
            )}

            {(cmInfo.requiredFields.includes("username") ||
              cmInfo.optionalFields.includes("username")) && (
              <div className="space-y-2">
                <Label>
                  Nazwa użytkownika{" "}
                  {cmInfo.requiredFields.includes("username") && (
                    <span className="text-red-500">*</span>
                  )}
                </Label>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="login"
                />
              </div>
            )}

            {(cmInfo.requiredFields.includes("password") ||
              cmInfo.optionalFields.includes("password")) && (
              <div className="space-y-2">
                <Label>
                  Hasło{" "}
                  {cmInfo.requiredFields.includes("password") && (
                    <span className="text-red-500">*</span>
                  )}
                </Label>
                <Input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  placeholder="••••••••"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg text-sm">
            <Info className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              Dane są zapisywane w pliku <code className="bg-blue-100 px-1 rounded">.env.local</code>.
              Po zapisaniu może być wymagany restart serwera.
            </span>
          </div>

          <Button onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Zapisywanie..." : "Zapisz konfigurację"}
          </Button>
        </CardContent>
      </Card>

      {/* Info o kolejnych krokach */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="w-5 h-5" />
            Kolejne kroki
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>
              <strong>Podaj nazwę używanego Channel Managera</strong> - jeśli nie wiesz, sprawdź 
              w panelu KW Hotel w ustawieniach integracji.
            </li>
            <li>
              <strong>Uzyskaj dane dostępowe</strong> - API Key i Property ID znajdziesz w 
              panelu administracyjnym Channel Managera (np. WuBook, Channex).
            </li>
            <li>
              <strong>Skonfiguruj webhook</strong> - Channel Manager będzie wysyłał nowe 
              rezerwacje do naszego systemu automatycznie.
            </li>
            <li>
              <strong>Test synchronizacji</strong> - po konfiguracji uruchomimy test pobierania 
              rezerwacji i synchronizacji dostępności.
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
