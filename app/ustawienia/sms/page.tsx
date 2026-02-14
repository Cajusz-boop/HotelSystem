"use client";

import { useState, useEffect, useCallback } from "react";
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
  ArrowLeft,
  MessageSquare,
  CheckCircle,
  XCircle,
  Send,
  Loader2,
  RefreshCw,
  Phone,
  AlertTriangle,
  Bell,
  Clock,
  Users,
} from "lucide-react";
import {
  getSmsGatewayConfig,
  sendTestSms,
  getSmsLogs,
  getSmsStats,
  getReservationsForReminder,
  sendBatchPreArrivalReminders,
  type SmsGatewayConfig,
  type SmsLogEntry,
  type BatchReminderResult,
} from "@/app/actions/sms";

export default function SmsSettingsPage() {
  const [config, setConfig] = useState<SmsGatewayConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  
  const [testPhone, setTestPhone] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  
  const [logs, setLogs] = useState<SmsLogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsPage, setLogsPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  const [stats, setStats] = useState<{
    total: number;
    sent: number;
    failed: number;
    failureRate: number;
  } | null>(null);
  
  // Przypomnienia SMS
  const [reminderDays, setReminderDays] = useState("1");
  const [reminderReservations, setReminderReservations] = useState<Array<{
    reservationId: string;
    guestName: string;
    phone: string | null;
    checkIn: Date;
    roomNumber: string;
    reminderAlreadySent: boolean;
  }>>([]);
  const [reminderLoading, setReminderLoading] = useState(false);
  const [reminderSending, setReminderSending] = useState(false);
  const [reminderResult, setReminderResult] = useState<BatchReminderResult | null>(null);

  // Pobierz konfigurację i statystyki
  const loadConfig = useCallback(async () => {
    setConfigLoading(true);
    const result = await getSmsGatewayConfig();
    if (result.success) {
      setConfig(result.data);
    }
    setConfigLoading(false);
  }, []);

  const loadStats = useCallback(async () => {
    const result = await getSmsStats();
    if (result.success) {
      setStats(result.data);
    }
  }, []);

  const loadLogs = useCallback(async (page: number) => {
    setLogsLoading(true);
    const result = await getSmsLogs({}, page, 10);
    if (result.success) {
      setLogs(result.data.logs);
      setTotalPages(result.data.pages);
    }
    setLogsLoading(false);
  }, []);

  useEffect(() => {
    loadConfig();
    loadStats();
    loadLogs(1);
  }, [loadConfig, loadStats, loadLogs]);

  // Wyślij testowy SMS
  const handleSendTest = async () => {
    if (!testPhone.trim()) {
      setTestResult({ success: false, message: "Podaj numer telefonu" });
      return;
    }
    
    setTestSending(true);
    setTestResult(null);
    
    const result = await sendTestSms(testPhone);
    
    if (result.success) {
      setTestResult({ success: true, message: `SMS wysłany na ${result.data.sentTo}` });
      loadLogs(1);  // Odśwież logi
      loadStats();  // Odśwież statystyki
    } else {
      setTestResult({ success: false, message: result.error });
    }
    
    setTestSending(false);
  };

  // Pobierz rezerwacje do przypomnienia
  const loadReminderReservations = useCallback(async () => {
    setReminderLoading(true);
    setReminderResult(null);
    const days = parseInt(reminderDays, 10);
    const result = await getReservationsForReminder(days);
    if (result.success) {
      setReminderReservations(result.data);
    }
    setReminderLoading(false);
  }, [reminderDays]);

  // Wyślij przypomnienia
  const handleSendReminders = async () => {
    setReminderSending(true);
    setReminderResult(null);
    
    const days = parseInt(reminderDays, 10);
    const result = await sendBatchPreArrivalReminders(days);
    
    if (result.success) {
      setReminderResult(result.data);
      loadLogs(1);  // Odśwież logi
      loadStats();  // Odśwież statystyki
      loadReminderReservations();  // Odśwież listę rezerwacji
    }
    
    setReminderSending(false);
  };

  // Obsługa paginacji logów
  const handleLogsPageChange = (page: number) => {
    setLogsPage(page);
    loadLogs(page);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <MessageSquare className="w-6 h-6" />
          <h1 className="text-2xl font-bold">Konfiguracja SMS</h1>
        </div>
        <Link href="/ustawienia">
          <Button variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Powrót
          </Button>
        </Link>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Konfiguracja bramki */}
        <div className="p-6 border rounded-lg bg-card">
          <h2 className="font-medium text-lg mb-4 flex items-center gap-2">
            <Phone className="w-5 h-5" />
            Bramka SMS (Twilio)
          </h2>
          
          {configLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : config ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">Status:</span>
                {config.isConfigured ? (
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    Skonfigurowano
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-red-600">
                    <XCircle className="w-4 h-4" />
                    Nie skonfigurowano
                  </span>
                )}
              </div>
              
              {config.isConfigured && (
                <>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Account SID:</span>{" "}
                    <code className="bg-muted px-2 py-0.5 rounded">{config.accountSidMasked}</code>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Numer nadawcy:</span>{" "}
                    <code className="bg-muted px-2 py-0.5 rounded">{config.phoneNumber}</code>
                  </div>
                </>
              )}
              
              {!config.isConfigured && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-800">Brak konfiguracji</p>
                      <p className="text-amber-700 mt-1">
                        Aby wysyłać SMS, ustaw zmienne środowiskowe:
                      </p>
                      <ul className="mt-2 space-y-1 text-amber-700">
                        <li><code className="bg-amber-100 px-1 rounded">TWILIO_ACCOUNT_SID</code></li>
                        <li><code className="bg-amber-100 px-1 rounded">TWILIO_AUTH_TOKEN</code></li>
                        <li><code className="bg-amber-100 px-1 rounded">TWILIO_PHONE_NUMBER</code></li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
              
              <Button
                variant="outline"
                size="sm"
                onClick={loadConfig}
                className="mt-2"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Odśwież status
              </Button>
            </div>
          ) : (
            <p className="text-muted-foreground">Błąd ładowania konfiguracji</p>
          )}
        </div>

        {/* Test wysyłki */}
        <div className="p-6 border rounded-lg bg-card">
          <h2 className="font-medium text-lg mb-4 flex items-center gap-2">
            <Send className="w-5 h-5" />
            Test wysyłki SMS
          </h2>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="testPhone">Numer telefonu testowy</Label>
              <Input
                id="testPhone"
                type="tel"
                placeholder="+48 123 456 789"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                disabled={!config?.isConfigured || testSending}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Format: +48123456789 lub 123456789
              </p>
            </div>
            
            <Button
              onClick={handleSendTest}
              disabled={!config?.isConfigured || testSending || !testPhone.trim()}
              className="w-full"
            >
              {testSending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Wysyłanie...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Wyślij testowy SMS
                </>
              )}
            </Button>
            
            {testResult && (
              <div
                className={`p-3 rounded-lg text-sm ${
                  testResult.success
                    ? "bg-green-50 border border-green-200 text-green-800"
                    : "bg-red-50 border border-red-200 text-red-800"
                }`}
              >
                <div className="flex items-start gap-2">
                  {testResult.success ? (
                    <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  )}
                  <span>{testResult.message}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Przypomnienia przed przyjazdem */}
      <div className="mt-6 p-6 border rounded-lg bg-card">
        <h2 className="font-medium text-lg mb-4 flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Przypomnienia SMS przed przyjazdem
        </h2>
        
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-end">
            <div className="flex-1">
              <Label>Dni przed przyjazdem</Label>
              <Select value={reminderDays} onValueChange={setReminderDays}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Dziś (check-in dziś)</SelectItem>
                  <SelectItem value="1">Jutro (1 dzień przed)</SelectItem>
                  <SelectItem value="2">2 dni przed</SelectItem>
                  <SelectItem value="3">3 dni przed</SelectItem>
                  <SelectItem value="7">Tydzień przed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={loadReminderReservations}
                disabled={reminderLoading || !config?.isConfigured}
              >
                {reminderLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Users className="w-4 h-4 mr-2" />
                    Pokaż rezerwacje
                  </>
                )}
              </Button>
              
              <Button
                onClick={handleSendReminders}
                disabled={reminderSending || !config?.isConfigured || reminderReservations.length === 0}
              >
                {reminderSending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Wysyłanie...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Wyślij przypomnienia
                  </>
                )}
              </Button>
            </div>
          </div>
          
          {/* Lista rezerwacji do przypomnienia */}
          {reminderReservations.length > 0 && (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground mb-2">
                Rezerwacje z check-in za {reminderDays} dni ({reminderReservations.length}):
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-2">Gość</th>
                      <th className="text-left py-2 px-2">Pokój</th>
                      <th className="text-left py-2 px-2">Telefon</th>
                      <th className="text-left py-2 px-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reminderReservations.map((r) => (
                      <tr key={r.reservationId} className="border-b hover:bg-muted/50">
                        <td className="py-2 px-2">{r.guestName}</td>
                        <td className="py-2 px-2">{r.roomNumber}</td>
                        <td className="py-2 px-2 font-mono text-xs">
                          {r.phone || <span className="text-red-500">Brak</span>}
                        </td>
                        <td className="py-2 px-2">
                          {r.reminderAlreadySent ? (
                            <span className="flex items-center gap-1 text-green-600 text-xs">
                              <CheckCircle className="w-3 h-3" />
                              Wysłano
                            </span>
                          ) : r.phone ? (
                            <span className="flex items-center gap-1 text-amber-600 text-xs">
                              <Clock className="w-3 h-3" />
                              Oczekuje
                            </span>
                          ) : (
                            <span className="text-red-500 text-xs">Brak telefonu</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          {/* Wynik wysyłki */}
          {reminderResult && (
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <h3 className="font-medium mb-2">Wynik wysyłki przypomnień</h3>
              <div className="grid grid-cols-3 gap-4 text-center mb-4">
                <div>
                  <div className="text-2xl font-bold text-green-600">{reminderResult.sent}</div>
                  <div className="text-xs text-muted-foreground">Wysłanych</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-600">{reminderResult.failed}</div>
                  <div className="text-xs text-muted-foreground">Błędy</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-amber-600">{reminderResult.skipped}</div>
                  <div className="text-xs text-muted-foreground">Pominięto</div>
                </div>
              </div>
              
              {reminderResult.details.length > 0 && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    Szczegóły ({reminderResult.details.length})
                  </summary>
                  <ul className="mt-2 space-y-1 pl-4">
                    {reminderResult.details.map((d, i) => (
                      <li key={i} className={
                        d.status === "SENT" ? "text-green-600" :
                        d.status === "FAILED" ? "text-red-600" :
                        "text-amber-600"
                      }>
                        {d.guestName}: {d.status}
                        {d.error && <span className="text-muted-foreground"> ({d.error})</span>}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
          
          <p className="text-xs text-muted-foreground mt-4">
            <strong>Wskazówka:</strong> Aby zautomatyzować wysyłkę przypomnień, skonfiguruj cron job 
            do wywoływania <code className="bg-muted px-1 rounded">POST /api/sms/reminders</code> codziennie o wybranej godzinie.
          </p>
        </div>
      </div>

      {/* Statystyki */}
      {stats && (
        <div className="mt-6 p-6 border rounded-lg bg-card">
          <h2 className="font-medium text-lg mb-4">Statystyki SMS</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">{stats.total}</div>
              <div className="text-sm text-muted-foreground">Łącznie</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{stats.sent}</div>
              <div className="text-sm text-muted-foreground">Wysłanych</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600">{stats.failed}</div>
              <div className="text-sm text-muted-foreground">Nieudanych</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-amber-600">
                {stats.failureRate.toFixed(1)}%
              </div>
              <div className="text-sm text-muted-foreground">Błędów</div>
            </div>
          </div>
        </div>
      )}

      {/* Historia SMS */}
      <div className="mt-6 p-6 border rounded-lg bg-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-medium text-lg">Historia wysłanych SMS</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadLogs(logsPage)}
            disabled={logsLoading}
          >
            {logsLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </Button>
        </div>
        
        {logsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : logs.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">Data</th>
                    <th className="text-left py-2 px-2">Typ</th>
                    <th className="text-left py-2 px-2">Odbiorca</th>
                    <th className="text-left py-2 px-2">Status</th>
                    <th className="text-left py-2 px-2">Treść</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-2 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString("pl-PL", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-2 px-2">
                        <span className="px-2 py-0.5 bg-muted rounded text-xs">
                          {log.type}
                        </span>
                      </td>
                      <td className="py-2 px-2">
                        <div className="font-mono text-xs">{log.recipientPhone}</div>
                        {log.recipientName && (
                          <div className="text-muted-foreground text-xs">{log.recipientName}</div>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        {log.status === "SENT" ? (
                          <span className="flex items-center gap-1 text-green-600 text-xs">
                            <CheckCircle className="w-3 h-3" />
                            Wysłany
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-red-600 text-xs" title={log.errorMessage ?? ""}>
                            <XCircle className="w-3 h-3" />
                            Błąd
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-2">
                        <div className="max-w-[200px] truncate text-muted-foreground text-xs" title={log.messageBody}>
                          {log.messageBody}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Paginacja */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleLogsPageChange(logsPage - 1)}
                  disabled={logsPage === 1}
                >
                  Poprzednia
                </Button>
                <span className="text-sm text-muted-foreground">
                  Strona {logsPage} z {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleLogsPageChange(logsPage + 1)}
                  disabled={logsPage === totalPages}
                >
                  Następna
                </Button>
              </div>
            )}
          </>
        ) : (
          <p className="text-center text-muted-foreground py-8">
            Brak wysłanych SMS-ów
          </p>
        )}
      </div>
    </div>
  );
}
