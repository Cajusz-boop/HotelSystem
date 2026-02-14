# PLAN NAPRAWY – Hotel PMS (Gastronomia / HoReCa)

**Autor:** Przegląd techniczny  
**Data:** 2026-02-13  
**Cel:** Usunięcie błędów runtime, stabilizacja działania, zgodność ze standardami branży gastronomiczno-hotelarskiej.

---

## CZĘŚĆ I: BŁĘDY KRYTYCZNE (blokują użytkowanie)

### 1.1 Błąd hydratacji – StatusBar (priorytet: najwyższy)

**Objaw:**  
`Error: Hydration failed because the initial UI does not match what was rendered on the server`  
`Expected server HTML to contain a matching <button> in <div>`

**Przyczyna:**  
W `components/status-bar.tsx` przycisk powiadomień jest renderowany warunkowo:
```tsx
{typeof window !== "undefined" && "Notification" in window && (
  <button>...</button>
)}
```
- **Serwer:** `window` jest undefined → nic nie renderuje  
- **Klient:** `window` istnieje → przycisk się pojawia  
→ Różnica HTML = błąd hydratacji

**Plan naprawy:**
1. Dodać stan `mounted` inicjalizowany w `useEffect` na `true`.
2. Warunek: `mounted && typeof window !== "undefined" && "Notification" in window`.
3. Alternatywa: zawsze renderować kontener, a zawartość zależną od `window` pokazywać dopiero po `mounted`.
4. Upewnić się, że `propertyName` jest ładowany (obecnie brak `useEffect` wywołującego `getProperties` / `getSelectedPropertyId` – stan nigdy nie jest ustawiany).

**Plik:** `components/status-bar.tsx`

---

### 1.2 Brak ładowania nazwy obiektu w StatusBar

**Problem:**  
`propertyName` jest w stanie, ale nie ma `useEffect` ładującego dane z `getProperties` / `getSelectedPropertyId`.

**Plan naprawy:**
1. Dodać `useEffect`, który wywołuje `getSelectedPropertyId()` lub `getProperties()`.
2. Na podstawie wybranego obiektu pobrać jego nazwę i ustawić `setPropertyName`.
3. Obsłużyć przypadek braku wybranego obiektu (np. pusty string lub null).

**Plik:** `components/status-bar.tsx`

---

## CZĘŚĆ II: BŁĘDY Z WCZEŚNIEJSZYCH NAPRAW (do weryfikacji)

### 2.1 Komponent Tabs – brak możliwości importu

**Status:** Utworzono `components/ui/tabs.tsx` i dodano `@radix-ui/react-tabs`.  
**Weryfikacja:** Upewnić się, że import `@/components/ui/tabs` działa na stronach:
- `app/ustawienia/dokumenty/page.tsx`
- `app/ustawienia/slowniki/page.tsx`

---

### 2.2 Stałe i typy w plikach „use server”

**Zrobione:**  
- `lib/finance-constants.ts`
- `lib/gastronomy-constants.ts`
- `lib/scheduled-reports-constants.ts`
- `lib/collections-constants.ts`
- `lib/ksef/env.ts`

**Weryfikacja:** Sprawdzić, czy nie ma importów starych ścieżek (np. `from "@/app/actions/finance"` dla stałych typu `VALID_PAYMENT_METHODS`).

---

### 2.3 otplib – zmiana API (v13)

**Zrobione:** Zmiana z `authenticator` na `generateSecret`, `generateURI`, `verifySync`.  
**Weryfikacja:** Przetestować 2FA: generowanie secretu, wyświetlanie URI, weryfikację kodu TOTP.

---

## CZĘŚĆ III: ESLint i jakość kodu (opcjonalnie)

**Status:** `eslint: { ignoreDuringBuilds: true }` w `next.config.js` – ostrzeżenia są ignorowane podczas buildu.

**Plan (na później):**
1. Usunąć `ignoreDuringBuilds` po naprawie błędów krytycznych.
2. Kolejno usuwać ostrzeżenia:
   - Nieużywane zmienne (`@typescript-eslint/no-unused-vars`)
   - `prefer-const`
   - `react/no-unescaped-entities`
   - `react-hooks/exhaustive-deps`

---

## CZĘŚĆ IV: GASTRONOMIA – wymagania branżowe

### 4.1 Moduł karty dań (gastronomy)

**Stan:** `app/actions/gastronomy.ts`, `app/gastronomy/*`  
**Standardy HoReCa:**
- Alergeny zgodne z rozporządzeniem UE (14 głównych alergenów).
- Diety: wegetariańska, wegańska, bezglutenowa, bezlaktozowa, halal, koszerna itd.
- Kategorie dań: śniadania, obiady, kolacje, room service, minibar, napoje.

**Plan weryfikacji:**
1. Sprawdzić, czy `lib/gastronomy-constants.ts` zawiera pełną listę alergenów z rozporządzenia UE.
2. Upewnić się, że `DIET_TAGS` i `ALLERGEN_TAGS` są poprawnie importowane w `gastronomy-client.tsx`.
3. Sprawdzić, czy `createMenuItem` i powiązane funkcje obsługują diety i alergeny.

---

### 4.2 Room service i rozliczenia

**Plik:** `components/tape-chart/reservation-bar-with-menu.tsx` – `chargeOrderToReservation`  
**Plan weryfikacji:**
1. Przepływ: zamówienie → dopisanie do rezerwacji → rozliczenie.
2. Poprawność kwot i VAT przy obciążaniu rezerwacji.
3. Integracja z modułem finansów (folio, transakcje).

---

## CZĘŚĆ V: KOLEJNOŚĆ WYKONANIA

| # | Zadanie | Plik(i) | Szacowany czas |
|---|---------|---------|----------------|
| 1 | Naprawa hydratacji StatusBar – `mounted` + warunek | `components/status-bar.tsx` | 15 min |
| 2 | Ładowanie `propertyName` w StatusBar | `components/status-bar.tsx` | 15 min |
| 3 | Weryfikacja Tabs – test stron dokumenty/słowniki | Przegląd + test | 10 min |
| 4 | Test 2FA (TOTP) – logowanie z kodem | Ręczny test | 10 min |
| 5 | Test modułu gastronomii – karta dań, zamówienia | Ręczny test | 20 min |
| 6 | Usunięcie `ignoreDuringBuilds` i naprawa ESLint | `next.config.js` + pliki z ostrzeżeniami | 60+ min |

---

## CZĘŚĆ VI: KRYTERIA AKCEPTACJI

- [ ] Strona `/guests` ładuje się bez błędu hydratacji.
- [ ] StatusBar wyświetla nazwę obiektu (gdy wybrany) i użytkownika.
- [ ] Przycisk powiadomień w StatusBar działa bez błędów.
- [ ] Strony `/ustawienia/dokumenty` i `/ustawienia/slowniki` działają (Tabs).
- [ ] Logowanie z 2FA (TOTP) działa poprawnie.
- [ ] Moduł gastronomii: tworzenie dań, zamówienia, obciążanie rezerwacji – bez błędów.

---

## DODATKOWE UWAGI

- **Next.js 14.2.15** – wersja oznaczona jako nieaktualna; aktualizacja na późniejszym etapie (np. 15.x) może wymagać dodatkowych zmian.
- **Testy E2E** – po naprawach warto uruchomić `npm run test:e2e` i uzupełnić scenariusze dla kluczowych ścieżek (logowanie, goście, rezerwacje, gastronomia).
