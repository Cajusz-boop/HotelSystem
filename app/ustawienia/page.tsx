"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Mail, Settings, MessageSquare, FileText, Palette, Receipt, ClipboardList, FileCheck, Users, Shield, Key, Database, Building2, FormInput, BookOpen, CalendarRange, FileX, Upload, Printer } from "lucide-react";

const settingsItems = [
  {
    href: "/ustawienia/dane-hotelu",
    icon: Building2,
    title: "Dane hotelu",
    description: "Nazwa, adres, NIP, KRS, logo, kontakt – do faktur i dokumentów",
  },
  {
    href: "/ustawienia/pietra",
    icon: Building2,
    title: "Piętra budynku",
    description: "Konfiguracja pięter (Parter, 1, 2…) do wyboru przy pokojach",
  },
  {
    href: "/ustawienia/uzytkownicy",
    icon: Users,
    title: "Użytkownicy",
    description: "Dodawaj, edytuj i usuwaj konta pracowników. Limity rabatowe i role (Recepcja, Manager, Housekeeping, Właściciel)",
  },
  {
    href: "/ustawienia/szablony-email",
    icon: Mail,
    title: "Szablony e-mail",
    description: "Zarządzaj szablonami wiadomości e-mail (potwierdzenia, przypomnienia, podziękowania)",
  },
  {
    href: "/ustawienia/sms",
    icon: MessageSquare,
    title: "Konfiguracja SMS",
    description: "Ustawienia bramki SMS (Twilio), test wysyłki i historia wiadomości",
  },
  {
    href: "/ustawienia/numeracja",
    icon: FileText,
    title: "Numeracja dokumentów",
    description: "Konfiguracja prefiksów i formatu numerów faktur, rachunków i innych dokumentów finansowych",
  },
  {
    href: "/ustawienia/szablony",
    icon: Palette,
    title: "Szablon faktury",
    description: "Logo, dane sprzedawcy, nagłówek i stopka dokumentów finansowych",
  },
  {
    href: "/ustawienia/paragon",
    icon: Receipt,
    title: "Szablon paragonu",
    description: "Nagłówek, stopka i nazwy pozycji na paragonach fiskalnych",
  },
  {
    href: "/ustawienia/kasa-fiskalna",
    icon: Printer,
    title: "Kasa fiskalna (POSNET)",
    description: "Podłączenie kasy fiskalnej POSNET Trio – konfiguracja, test połączenia, instrukcja",
  },
  {
    href: "/ustawienia/dokumenty",
    icon: ClipboardList,
    title: "Szablony dokumentów",
    description: "Potwierdzenia rezerwacji i karty meldunkowe – logo, treść, wygląd",
  },
  {
    href: "/ustawienia/pola-formularzy",
    icon: FormInput,
    title: "Dodatkowe pola formularzy",
    description: "Konfiguracja pól w formularzach meldunku, rezerwacji i karty gościa",
  },
  {
    href: "/ustawienia/slowniki",
    icon: BookOpen,
    title: "Słowniki rezerwacji",
    description: "Źródła rezerwacji, kanały, segmenty rynkowe, powody anulacji",
  },
  {
    href: "/ustawienia/sezony",
    icon: CalendarRange,
    title: "Sezony (peak / off-peak)",
    description: "Okresy sezonu wysokiego i niskiego – definicje dat (MM-DD)",
  },
  {
    href: "/ustawienia/polityka-anulacji",
    icon: FileX,
    title: "Polityka anulacji",
    description: "Szablony polityki anulacji (bezpłatna anulacja do X dni, kara Y%)",
  },
  {
    href: "/ustawienia/ksef",
    icon: FileCheck,
    title: "KSeF (e-Faktury)",
    description: "Konfiguracja NIP, token autoryzacyjny i środowisko (Test/Produkcja)",
  },
  {
    href: "/ustawienia/2fa",
    icon: Shield,
    title: "Uwierzytelnianie 2FA",
    description: "Włącz lub wyłącz uwierzytelnianie dwuetapowe (TOTP)",
  },
  {
    href: "/change-password",
    icon: Key,
    title: "Zmiana hasła",
    description: "Zmień swoje hasło (min. długość, złożoność, wygasanie)",
  },
  {
    href: "/api/admin/backup",
    icon: Database,
    title: "Kopia zapasowa bazy",
    description: "Pobierz dump bazy (SQL). Automatyczne backupy: cron GET /api/cron/backup (CRON_SECRET, BACKUP_DIR).",
  },
  {
    href: "/ustawienia/restore",
    icon: Database,
    title: "Przywracanie z kopii",
    description: "Przywróć bazę z pliku SQL (zastępuje bieżące dane).",
  },
  {
    href: "/ustawienia/import",
    icon: Upload,
    title: "Import z innego PMS",
    description: "Import gości i pokoi z pliku JSON (inny system PMS).",
  },
];

export default function UstawieniaPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Settings className="w-6 h-6" />
          <h1 className="text-2xl font-bold">Ustawienia</h1>
        </div>
        <Link href="/">
          <Button variant="outline">Powrót</Button>
        </Link>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {settingsItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <div className="p-6 border rounded-lg bg-card hover:bg-muted/50 transition-colors cursor-pointer">
              <div className="flex items-center gap-3 mb-2">
                <item.icon className="w-5 h-5 text-primary" />
                <h2 className="font-medium">{item.title}</h2>
              </div>
              <p className="text-sm text-muted-foreground">{item.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
