import Link from "next/link";
import {
  HelpCircle,
  Calendar,
  UserPlus,
  BarChart3,
  DollarSign,
  BedDouble,
  FileText,
  Keyboard,
} from "lucide-react";

export const metadata = {
  title: "Pomoc – Hotel PMS",
  description: "Dokumentacja użytkownika systemu Hotel PMS",
};

export default function PomocPage() {
  return (
    <div className="flex flex-col gap-8 p-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <HelpCircle className="h-7 w-7" />
          Pomoc – dokumentacja użytkownika
        </h1>
        <p className="text-muted-foreground mt-1">
          Krótki przewodnik po głównych modułach systemu.
        </p>
      </div>

      <section className="rounded-lg border bg-card p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold mb-3">
          <Calendar className="h-5 w-5" />
          <Link href="/front-office" className="hover:underline">Grafik (Recepcja)</Link>
        </h2>
        <p className="text-sm text-muted-foreground mb-2">
          Widok taśmowy rezerwacji. Kliknij w pustą komórkę (pokój + data), aby dodać rezerwację. Kliknij pasek rezerwacji, aby edytować lub zobaczyć rozliczenie. Skrót klawiszowy <kbd className="rounded border px-1.5 py-0.5 text-xs">N</kbd> – nowa rezerwacja.
        </p>
        <p className="text-xs text-muted-foreground">
          Strzałki – nawigacja po komórkach, Enter – otwórz rezerwację / nowa w zaznaczonej komórce, I – melduj, O – wymelduj.
        </p>
      </section>

      <section className="rounded-lg border bg-card p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold mb-3">
          <UserPlus className="h-5 w-5" />
          <Link href="/check-in" className="hover:underline">Meldunek</Link>
        </h2>
        <p className="text-sm text-muted-foreground">
          Szybki meldunek gościa – wyszukaj rezerwację po nazwisku lub numerze, potwierdź dane i zamelduj.
        </p>
      </section>

      <section className="rounded-lg border bg-card p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold mb-3">
          <BarChart3 className="h-5 w-5" />
          <Link href="/reports" className="hover:underline">Raporty</Link>
        </h2>
        <p className="text-sm text-muted-foreground mb-2">
          Raport dobowy (transakcje dnia), KPI, obłożenie, przychody wg źródła/kanału, raport prowizji OTA, eksport do Excel. Harmonogram raportów – zaplanuj automatyczną wysyłkę e-mailem.
        </p>
      </section>

      <section className="rounded-lg border bg-card p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold mb-3">
          <DollarSign className="h-5 w-5" />
          <Link href="/finance" className="hover:underline">Finanse</Link>
        </h2>
        <p className="text-sm text-muted-foreground">
          Transakcje, faktury, rachunki. Zamknięcie doby (Night Audit) – zamraża transakcje z poprzedniego dnia i oznacza no-show. Raport prowizji (biura podróży, OTA).
        </p>
      </section>

      <section className="rounded-lg border bg-card p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold mb-3">
          <BedDouble className="h-5 w-5" />
          <Link href="/pokoje" className="hover:underline">Pokoje</Link>
        </h2>
        <p className="text-sm text-muted-foreground">
          Lista pokoi, typy, stany (dostępny, zajęty, OOO). Usterek i planowane konserwacje.
        </p>
      </section>

      <section className="rounded-lg border bg-card p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold mb-3">
          <FileText className="h-5 w-5" />
          <Link href="/cennik" className="hover:underline">Cennik</Link>
        </h2>
        <p className="text-sm text-muted-foreground">
          Stawki, pakiety, kody stawek. Reguły pochodne (sezon, długość pobytu).
        </p>
      </section>

      <section className="rounded-lg border bg-card p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold mb-3">
          <Keyboard className="h-5 w-5" />
          Skróty klawiszowe
        </h2>
        <p className="text-sm text-muted-foreground mb-2">
          Naciśnij <kbd className="rounded border px-1.5 py-0.5 text-xs">?</kbd> w dowolnym miejscu, aby zobaczyć listę skrótów. <kbd className="rounded border px-1.5 py-0.5 text-xs">Ctrl+K</kbd> / <kbd className="rounded border px-1.5 py-0.5 text-xs">Cmd+K</kbd> – paleta poleceń (szukaj gościa, pokoju, szybkie akcje).
        </p>
      </section>
    </div>
  );
}
