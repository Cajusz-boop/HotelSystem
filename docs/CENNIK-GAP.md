# Cennik – co jest, a czego jeszcze brakuje (żeby program był „pełny”)

Lista rzeczy w stylu cennika: **✅ = wdrożone**, **❌ = brak** – żeby nic nie umknęło.

---

## ✅ Już jest w systemie

| Element | Opis |
|--------|------|
| **Cena na pokój** | `Room.price` – nadpisanie na konkretny pokój |
| **Stawki wg typu** | RoomType (Queen, Twin, Suite) z ceną bazową; pokój dziedziczy, jeśli nie ma nadpisania |
| **Stawki sezonowe** | RatePlan – okres (od–do) + typ pokoju + cena; lista w Cenniku, dodawanie/usuwanie |
| **Widok do wydruku** | `/cennik/wydruk` – tylko do odczytu, przycisk Drukuj, bez przycisków Zapisz |
| **Eksport CSV** | Przycisk „Eksport CSV” – backup cennika (nr, typ, status, cena) |
| **Import CSV** | Przycisk „Import CSV” – zbiorcza aktualizacja cen z pliku (nr pokoju, cena) |
| **Historia zmian** | Rozwijana „Historia zmian cen” z AuditLog (kto/kiedy, stara/nowa cena) |
| **Cena na grafiku** | Na pasku rezerwacji: cena za dobę i suma za pobyt (z pokoju/typu) |
| **Cena w rezerwacji** | W Sheet (edycja + nowa): blok „Cena za dobę”, „Liczba nocy”, „Suma” |
| **Waluta / netto** | Informacja w opisie: „Waluta: PLN. Ceny za dobę (netto).” |

---

## ❌ Czego jeszcze brakuje (żeby cennik był „pełny”)

### 1. **Użycie stawek sezonowych przy wycenie**
- **Jest:** Tabela RatePlan (okres + typ + cena), zarządzanie w Cenniku.
- **Brakuje:** Przy wyświetlaniu ceny **na dany dzień** system nie bierze stawki z RatePlan.
- **Trzeba:** Przy cenie za dobę (grafik, rezerwacja) brać:  
  **dla danej daty** najpierw RatePlan (jeśli data ∈ okres), potem `Room.price`, na końcu `RoomType.basePrice`.

### 2. **Kody stawek (rate codes)**
- **Brakuje:** Kody typu BB (śniadanie), RO (tylko nocleg), Net, Last minute, Non-refund – każdy z własną ceną lub mnożnikiem.
- **Trzeba:** Model np. `RateCode` (kod, nazwa, cena lub %), powiązanie **rezerwacji** z kodem (np. `Reservation.rateCodeId`), wyświetlanie w rezerwacji i przy wycenie.

### 3. **Waluty i podatki (pełna konfiguracja)**
- **Jest:** Tekst „PLN, netto”.
- **Brakuje:**  
  - wybór **waluty** (PLN / EUR / USD) w ustawieniach lub na cenniku,  
  - **netto/brutto** (czy ceny w systemie to netto czy brutto),  
  - **VAT** (np. 8% / 23%) do automatycznego wyliczenia brutto/netto.
- **Trzeba:** Tabela ustawień (np. `Settings`) lub pola w konfiguracji: `currency`, `pricesAreNetto`, `vatPercent`; użycie przy raportach i fakturach.

### 4. **Min. / max. długość pobytu (min stay, max stay)**
- **Brakuje:** Przy stawce (typ lub RatePlan): minimalna i maksymalna liczba nocy; blokada przy tworzeniu rezerwacji, jeśli pobyt nie mieści się w limicie.
- **Trzeba:** Pola np. `minStayNights`, `maxStayNights` w RatePlan lub RoomType; walidacja w Server Action tworzenia rezerwacji.

### 5. **Warunki anulacji / non-refund per stawka**
- **Brakuje:** Przy stawce: informacja „non-refundable” / „free cancellation do X dni przed” – wyświetlana przy rezerwacji i ewentualnie na potwierdzeniu.
- **Trzeba:** Pole w RatePlan lub RateCode (np. `cancellationPolicy`, `isNonRefundable`); pokazywanie w UI rezerwacji.

### 6. **Dopłaty (łóżko dostawkowe, dziecko, śniadanie)**
- **Brakuje:** Osobne pozycje cennika: np. „łóżko dostawkowe +80 PLN”, „dziecko do 12 lat +0”, „śniadanie +40 PLN” – dodawane do rachunku/rezerwacji.
- **Trzeba:** Model np. `Extra` / `Surcharge` (nazwa, cena, typ: jednorazowo / za dobę); powiązanie z rezerwacją (pozycje rachunku) i opcjonalnie z RateCode.

### 7. **Pakiety (room + śniadanie, half board)**
- **Brakuje:** Stawki typu „Pokój + śniadanie”, „Pokój + pół pełne” jako osobne „produkty” z jedną ceną łączną.
- **Trzeba:** Można to robować przez **kody stawek** (BB, HB) z przypisaną ceną; albo osobny model Package (np. roomTypeId + rateCodeId + łączna cena).

### 8. **Cennik na widoku wydruku z okresami**
- **Jest:** Wydruk z aktualnymi cenami (pokój/typ).
- **Brakuje:** Na wydruku **uwzględnienie stawek sezonowych** – np. sekcja „Stawki sezonowe 2026” (okresy + ceny) albo wybór daty „Cennik na dzień X”.

### 9. **Edycja typu pokoju (nazwa / kolejność)**
- **Jest:** RoomType tworzone z `Room.type`, edycja tylko ceny bazowej.
- **Brakuje:** Zmiana **nazwy** typu, **kolejności** wyświetlania (sortowanie), ewentualnie ukrywanie typu („nieużywany”).

### 10. **Kopiowanie cennika (np. na kolejny rok)**
- **Brakuje:** Akcja „Skopiuj stawki sezonowe z 2025 na 2026” – masowa duplikacja RatePlan z przesunięciem dat.
- **Trzeba:** Server Action: wybór roku źródłowego i docelowego, kopiowanie RatePlan z przesunięciem validFrom/validTo.

---

## Podsumowanie – co dopisać, żeby nic nie „wypadło”

Żeby program był odczuwalnie **pełny** w stylu cennika, warto dopiąć w pierwszej kolejności:

1. **Użycie RatePlan przy wycenie** – żeby cena na grafiku i w rezerwacji na dany dzień brała stawkę sezonową.
2. **Kody stawek** – BB, RO, Net itd. + powiązanie z rezerwacją.
3. **Min stay / max stay** – przy RatePlan lub typie + walidacja przy rezerwacji.
4. **Waluta i VAT** – ustawienia (PLN/EUR, netto/brutto, VAT %) i użycie przy raportach/fakturach.

Reszta (dopłaty, pakiety, warunki anulacji, kopiowanie cennika) to kolejny krok w stronę „pełnego” cennika w stylu dużego PMS.

Możesz wybrać z listy powyżej, które punkty chcesz zrobić w pierwszej kolejności – wtedy można je rozpisać na konkretne zmiany w kodzie (modele, akcje, UI).
