/**
 * Reguła doboru kontrahenta przy tworzeniu faktury zbiorczej (FVZ) z wielu rezerwacji.
 * Używane przed wywołaniem akcji tworzącej FVZ (Tape Chart lub inny wybór wielu rezerwacji).
 */

export interface ReservationWithCompany {
  id: string;
  companyId?: string | null;
  companyName?: string | null;
}

export interface ResolvedConsolidatedInvoiceCompany {
  companyId: string;
  companyName: string;
  /** Niepusty gdy wybrane rezerwacje mają różne firmy – użytkownik powinien zobaczyć ostrzeżenie i potwierdzić. */
  warning: string | null;
  /** Pierwsza rezerwacja z firmą (w kolejności tablicy) – do użycia jako primary. */
  firstReservationWithCompany: ReservationWithCompany;
}

/**
 * Określa dane kontrahenta (firmy) dla FVZ na podstawie wybranych rezerwacji.
 * Kolejność tablicy = kolejność wyświetlania w UI („pierwsza” = pierwszy element z firmą).
 *
 * Przypadki:
 * - Żadna rezerwacja nie ma firmy → rzuca błąd.
 * - Jedna lub więcej rezerwacji z tą samą firmą (po companyId) → zwraca tę firmę, warning = null.
 * - Rezerwacje z różnymi firmami → zwraca pierwszą rezerwację z firmą w tablicy, warning ustawiony.
 */
export function resolveConsolidatedInvoiceCompany(
  reservations: ReservationWithCompany[]
): ResolvedConsolidatedInvoiceCompany {
  const withCompany = reservations.filter(
    (r) => r.companyId != null && r.companyId !== ""
  );
  if (withCompany.length === 0) {
    throw new Error(
      "Żadna z wybranych rezerwacji nie ma przypisanej firmy. Faktura zbiorcza wymaga przynajmniej jednej rezerwacji z firmą."
    );
  }
  const first = withCompany[0];
  const companyIds = new Set(withCompany.map((r) => r.companyId));
  const sameCompany = companyIds.size === 1;
  const companyName = first.companyName ?? "Firma";
  if (sameCompany) {
    return {
      companyId: first.companyId!,
      companyName,
      warning: null,
      firstReservationWithCompany: first,
    };
  }
  return {
    companyId: first.companyId!,
    companyName,
    warning: `Wybrane rezerwacje mają przypisane różne firmy. Dane kontrahenta zostaną pobrane z pierwszej rezerwacji z firmą: ${companyName}. Kwota obejmuje wszystkie wybrane rezerwacje.`,
    firstReservationWithCompany: first,
  };
}
