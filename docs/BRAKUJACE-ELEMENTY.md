# Czego jeszcze brakuje, żeby program był „skończony”

Podsumowanie względem specyfikacji (`.cursorrules`), dokumentów (`STATUS-CURSORRULES.md`, `CENNIK-GAP.md`) oraz przeglądu kodu.

---

## 1. Autentykacja i użytkownicy

| Element | Status | Uwagi |
|--------|--------|--------|
| **Model User / logowanie** | ✅ Jest | Model `User` (email, name, passwordHash, role). Strona `/login`, Server Action `login()` / `logout()`, sesja w cookie (JWT). |
| **AuditLog.userId** | ✅ Jest | `createAuditLog()` pobiera `userId` z sesji (`getSession()`), gdy użytkownik zalogowany. |
| **Rola Manager (PIN Void)** | ✅ Symulacja | `verifyManagerPin()` działa na stałym PINie (symulacja); opcjonalnie powiązanie z rolą użytkownika. |

**Domyślny użytkownik (po seed):** admin@hotel.local / admin123. W .env można ustawić `SESSION_SECRET` w produkcji.

---

## 2. Cennik (według `CENNIK-GAP.md`)

| Element | Status | Uwagi |
|--------|--------|--------|
| **Użycie RatePlan przy wycenie** | ✅ Jest | `getEffectivePriceForRoomOnDate` / `getEffectivePricesBatch` – grafik i rezerwacje używają stawek sezonowych. |
| **Kody stawek (RateCode)** | ✅ Model + UI | RateCode w schemacie, powiązanie z rezerwacją; wyświetlanie w Sheet. |
| **Min stay / max stay** | ✅ Jest | Pola w RatePlan; walidacja przy tworzeniu i edycji rezerwacji (Server Actions). |
| **Waluta / VAT / netto** | ✅ Jest | Model `CennikConfig`; UI edycji na stronie Cennik; raport dobowy używa `currency` z konfiguracji. |
| **Warunki anulacji (non-refund)** | ✅ Jest | `RatePlan.isNonRefundable`; wyświetlanie „Stawka non-refundable” w Sheet (edycja i nowa rezerwacja). |
| **Dopłaty (łóżko, śniadanie)** | ❌ Brak | Brak modelu Extra/Surcharge i pozycji na rachunku. |
| **Pakiety (room + śniadanie)** | ❌ Brak | Można obejść kodami stawek; brak dedykowanego „pakietu”. |
| **Wydruk cennika z okresami** | ⚠️ Częściowo | Wydruk jest; **brak** sekcji „Stawki sezonowe na dzień X” ani wyboru daty. |
| **Edycja nazwy/kolejności typu pokoju** | ⚠️ Częściowo | `RoomType.sortOrder` w schemacie; **brak pełnej edycji** nazwy/kolejności w UI. |
| **Kopiowanie cennika na rok** | ✅ Jest | `copyRatePlansFromYearToYear` w Cenniku. |

**Priorytet:**  
1. **UI konfiguracji** CennikConfig (waluta, VAT, netto) + użycie w raportach.  
3. Wyświetlanie **isNonRefundable** przy rezerwacji.  
4. Opcjonalnie: dopłaty (Extra) i wydruk cennika z wyborem daty.

---

## 3. Finanse i fiskalizacja – dopracowanie

| Element | Status | Uwagi |
|--------|--------|--------|
| **Faktura zaliczkowa (dokument/PDF)** | ❌ Brak | Przy DEPOSIT jest logika i audit; **brak generowanego dokumentu/PDF** „Faktura zaliczkowa”. |
| **Użycie waluty/VAT z CennikConfig** | ❌ Brak | Raporty i ewentualne faktury nie biorą currency/vatPercent z konfiguracji. |

**Do zrobienia:**  
- Generowanie PDF faktury zaliczkowej przy `registerDeposit()` (np. szablon + puppeteer/react-pdf).  
- Raporty (Management Report) i przyszłe faktury – waluta i VAT z `CennikConfig`.

---

## 4. Dashboard i powiadomienia

| Element | Status | Uwagi |
|--------|--------|--------|
| **Widgety (VIP Arrival, Dirty Rooms)** | ✅ Jest | Dashboard ma te widgety. |
| **Powiadomienia „Nowe OOO”** | ✅ Jest | Sekcja „Wyłączone z użytku (OOO)” na Dashboardzie z datą zgłoszenia (updatedAt), sortowanie od najnowszych. |

**Do zrobienia:**  
- Sekcja na Dashboardzie: „Ostatnie zgłoszenia OOO” lub badge z liczbą nowych OOO (od ostatniego wejścia / dziś).

---

## 5. Housekeeping – dopracowanie

| Element | Status | Uwagi |
|--------|--------|--------|
| **Offline: IndexedDB** | ⚠️ localStorage | Spec mówi o IndexedDB; w kodzie jest **localStorage** (`lib/housekeeping-offline.ts`). Dla większej ilości danych IndexedDB byłoby lepsze. |
| **TanStack Query + RxDB** | ⚠️ TanStack Query | Jest TanStack Query; **RxDB** z specyfikacji nie jest używany (localStorage/IndexedDB wystarczy na MVP). |

---

## 6. Bezpieczeństwo i RODO – dopracowanie

| Element | Status | Uwagi |
|--------|--------|--------|
| **Audit Trail** | ✅ Jest | Mutacje → AuditLog. |
| **userId w AuditLog** | ❌ Brak | Bez logowania userId będzie null. |
| **ipAddress w AuditLog** | ✅ Jest | `getClientIp(headers)` przekazywane tam, gdzie headers są dostępne. |

---

## 7. UX i dostępność – drobne braki

| Element | Status | Uwagi |
|--------|--------|--------|
| **Command Palette** | ✅ Jest | Cmd+K / Ctrl+K. |
| **Context Menu + Long Press** | ✅ Jest | Na rezerwacji. |
| **Toast (Sonner)** | ✅ Jest | Room Guard, Housekeeping itd. |
| **Brak modali na rzecz Sheet** | ✅ Jest | Edycja rezerwacji w Sheet. |

Ewentualnie: **testy E2E** na krytyczne ścieżki (meldunek, grafik, Night Audit, Void) – część jest w `Test/`, warto upewnić się, że są aktualne i przechodzą.

---

## 8. Integracje i API

| Element | Status | Uwagi |
|--------|--------|--------|
| **GET /api/v1/external/availability** | ✅ Jest | |
| **POST /api/v1/external/posting** | ✅ Jest | |
| **Pole MRZ w check-in** | ✅ Jest | |
| **Autentykacja API (klucze)** | ✅ Jest | Jeśli w .env ustawiono `EXTERNAL_API_KEY`, wymagany nagłówek `X-API-Key` lub `Authorization: Bearer <key>`. |

---

## 9. Wdrożenie i produkcja

| Element | Status | Uwagi |
|--------|--------|--------|
| **Schema Prisma + migracje** | ✅ Jest | |
| **MySQL** | ✅ Jest | |
| **README / instrukcja uruchomienia** | ✅ Jest | README.md: clone, npm i, .env, db push/migrate, seed, dev/build/start. |
| **Zmienne środowiskowe** | ✅ .env.example | |
| **Seed danych** | ✅ Jest | prisma/seed.ts, scripts/seed-for-phpmyadmin.sql |

**Opcjonalnie:** docker-compose pod MySQL dla dev.

---

## Podsumowanie – co zrobić, żeby program był „skończony”

### Zrobione (must-have i should-have)

- **Autentykacja** – User, logowanie (/login), sesja w cookie, `userId` w AuditLog.
- **Walidacja min/max stay**, zabezpieczenie API (EXTERNAL_API_KEY), README, zarządzanie pokojami.
- **UI konfiguracji cennika** (waluta, VAT, netto) + raport dobowy z walutą z CennikConfig.
- **Wyświetlanie non-refund** przy rezerwacji (Sheet edycja i nowa rezerwacja).
- **Dashboard – sekcja OOO** z datą zgłoszenia (updatedAt).

### Opcjonalnie (nice-to-have)

- **Faktura zaliczkowa w PDF** przy płatności zaliczkowej.

### Nice-to-have

6. **Dopłaty (Extra)** – łóżko, śniadanie, dziecko.  
7. **Wydruk cennika na wybrany dzień** (stawki sezonowe).  
8. **Edycja nazwy/kolejności typu pokoju** w Cenniku.  
9. **IndexedDB** zamiast localStorage w Housekeeping (przy większej skali).

---

*Ostatnia aktualizacja: na podstawie przeglądu kodu i dokumentów w repozytorium.*
