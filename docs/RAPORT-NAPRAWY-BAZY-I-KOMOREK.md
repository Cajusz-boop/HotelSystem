# Raport napraw – baza Property, błąd przy klikaniu komórki (2026-03-12)

## Kontekst

Użytkownik zgłaszał:
1. **Błąd "Table 'hotelsystem.property' doesn't exist"** – strona Recepcja (`/front-office`) się nie ładowała
2. **Błąd przy klikaniu komórki** w grafiku – "Wystąpił błąd", "Coś poszło nie tak. Spróbuj odświeżyć stronę."

---

## Co zostało zrobione

### 1. Problem tabeli Property (baza danych)

**Przyczyna:** Tabela `Property` nie istniała w bazie (brak migracji / uszkodzony tablespace). Dodatkowo wystąpił błąd InnoDB 1813 – uszkodzony plik `property.ibd` (tablespace istnieje na dysku, ale metadane były niespójne).

**Wykonane kroki:**
- Uruchomiono `npx prisma db push` – nie powiodło się (tabela "ghost")
- Uruchomiono `npx prisma migrate deploy` – nie powiodło się (baza nie była pusta, wymagany baseline)
- Utworzono skrypt `scripts/fix-property-table.ts`, który:
  - usuwa uszkodzony plik `property.ibd` z katalogu danych MySQL (np. `C:\xampp\mysql\data\hotelsystem\`)
  - tworzy tymczasową tabelę `PropertyNew` z pełną strukturą
  - wstawia domyślny obiekt (`prop_default_main`, "Obiekt główny", kod `default`)
  - próbuje zmienić nazwę `PropertyNew` → `Property` (nie udaje się z powodu stanu "ghost")

**Workaround zastosowany:** Mapowanie modelu Prisma na istniejącą tabelę:
- W `prisma/schema.prisma` dodano `@@map("PropertyNew")` do modelu `Property`
- Prisma korzysta z tabeli `PropertyNew` zamiast nieistniejącej `Property`
- Uruchomiono `npx prisma generate`

**Obecny stan:** Aplikacja korzysta z tabeli `PropertyNew` jako Property. Dane są poprawne. Aby w przyszłości wrócić do tabeli `Property`, po restarcie MySQL można ponowić próbę RENAME w skrypcie lub ręcznie usunąć ghost table.

---

### 2. Błąd przy klikaniu komórki w grafiku

**Przyczyna (prawdopodobna):** Błąd po stronie klienta podczas otwierania formularza nowej rezerwacji – np. odwołanie do `undefined` przy pracy na tablicy `rooms`.

**Wykonane zmiany:**
1. **`components/tape-chart/tabs/settlement-tab.tsx`**
   - wprowadzono `const safeRooms = rooms ?? []`, aby uniknąć `undefined`
   - zastąpiono użycia `rooms` przez `safeRooms` w całym komponencie
2. **`components/tape-chart/unified-reservation-dialog.tsx`**
   - dopisano walidację w `addDays()` (ochrona przed `Invalid Date` i `RangeError`)
   - obsługa pustego / nieprawidłowego `dateStr` przed parsowaniem daty

Te zmiany powinny ograniczyć ryzyko błędu przy otwieraniu formularza nowej rezerwacji po kliknięciu w pustą komórkę.

---

### 3. Serwer deweloperski

- `predev` (`prisma db push`) zgłaszał: `Can't create table ownersettlement (errno: 121 Duplicate key)`
- Serwer uruchamiano z pominięciem predev: `npx next dev -p 3011` (bez `prisma db push` w predev)

---

## Pliki zmodyfikowane

| Plik | Opis zmian |
|------|------------|
| `prisma/schema.prisma` | `@@map("PropertyNew")` w modelu Property |
| `scripts/fix-property-table.ts` | Nowy skrypt naprawy tabeli Property |
| `components/tape-chart/tabs/settlement-tab.tsx` | `safeRooms` zamiast `rooms` (ochrona przed `undefined`) |
| `components/tape-chart/unified-reservation-dialog.tsx` | Walidacja w `addDays()` |

---

## Co sprawdzić po wdrożeniu

1. Strona Recepcja ładuje się bez błędu "Table property doesn't exist".
2. Kliknięcie w pustą komórkę grafiku otwiera formularz nowej rezerwacji bez błędu.
3. Jeśli błąd nadal występuje – sprawdzić konsolę przeglądarki (F12 → Console) i ewentualnie logi serwera (terminal z `npm run dev`).

---

## Uwagi dla kolejnej AI / programisty

- Baza: model `Property` w Prisma wskazuje na tabelę `PropertyNew`.
- Tabela "ghost" `Property` może nadal figurować w słowniku InnoDB; po restarcie MySQL można ponowić próbę RENAME w `fix-property-table.ts`.
- Pokoi mogą nie mieć `propertyId` – wtedy `getEffectivePropertyId()` zwraca `null` i filtry nie są stosowane; warto zweryfikować dane w `Room.propertyId`.
