# Zadania logiczne – usunięcie zaślepek (mocks, stubs)

Format: `- [ ]` = do zrobienia, `- [x]` = zrobione. Skrypt `manager.py` czyta pierwsze niezaznaczone zadanie.

---–

## 1. Moduł fiskalny (lib/fiscal)

- [x] Zastąp sterownik mock w `lib/fiscal/mock-driver.ts` opcją „bez druku” (no-op) lub usuń domyślne używanie mocka w `lib/fiscal/index.ts` – produkcja powinna używać posnet/novitus/elzab.
- [x] Zaimplementuj prawdziwy protokół Novitus w `lib/fiscal/novitus-driver.ts` zamiast delegowania do mock-driver (obecnie tylko prefiks `NOV-` na numerze).
- [x] Zaimplementuj prawdziwy protokół Elzab w `lib/fiscal/elzab-driver.ts` zamiast delegowania do mock-driver (obecnie tylko prefiks `ELZ-` na numerze).

## 2. Integracje księgowe (lib/integrations, app/api/finance)

- [x] Zastąp placeholder w `lib/integrations/accounting.ts` – funkcja `exportToOptima`: zaimplementuj eksport do Optima (format/API) zamiast zwracania `success: false` z komunikatem „w przygotowaniu”.
- [x] Zastąp placeholder w `lib/integrations/accounting.ts` – funkcja `exportToSubiekt`: zaimplementuj eksport do Subiekt zamiast zwracania komunikatu „w przygotowaniu”.
- [x] Zastąp placeholder w `lib/integrations/accounting.ts` – funkcja `exportToWfirma`: zaimplementuj eksport do wFirma (API) zamiast zwracania komunikatu „w przygotowaniu”.
- [x] Zastąp placeholder w `lib/integrations/accounting.ts` – funkcja `exportToFakturownia`: zaimplementuj eksport do Fakturownia zamiast zwracania komunikatu „w przygotowaniu”.
- [x] Podłącz prawdziwy eksport w `app/api/finance/export/route.ts` – zamiast stubu zwracającego `exportedCount: 0` i komunikat „do rozbudowy”, wywołaj odpowiednią funkcję z `lib/integrations/accounting.ts` i zwróć realne dane/plik.

## 3. Channel Manager (lib/channel-manager, app/channel-manager)

- [x] Zastąp stub w `lib/channel-manager.ts` – funkcja `syncToBookingCom`: zaimplementuj synchronizację z Booking.com (API dostępności/ceny) zamiast zwracania `success: false` z komunikatem „w przygotowaniu”.
- [x] Zastąp stub w `lib/channel-manager.ts` – funkcja `syncToAirbnb`: zaimplementuj synchronizację z Airbnb zamiast zwracania komunikatu „w przygotowaniu”.
- [x] Zastąp stub w `lib/channel-manager.ts` – funkcja `syncToExpedia`: zaimplementuj synchronizację z Expedia zamiast zwracania komunikatu „w przygotowaniu”.
- [x] W `app/channel-manager/page.tsx` usuń lub rozbuduj treść „Placeholder – konfiguracja API i mapowanie obiektów do rozbudowy” – podłącz prawdziwą konfigurację i wywołania z `lib/channel-manager.ts`.

## 4. SMS i e-mail (app/actions)

- [x] W `app/actions/sms.ts` zastąp placeholder w `sendDoorCodeSms`: zamiast tylko `console.log` i zwracania sukcesu, podłącz bramkę SMS (np. Twilio, Play) i wysyłaj prawdziwy SMS z kodem do drzwi.
- [x] W `app/actions/sms.ts` zastąp placeholder w `sendRoomReadySms`: podłącz bramkę SMS i wysyłaj prawdziwy SMS „Twój pokój jest już gotowy”.
- [x] W `app/actions/mailing.ts` zastąp placeholder w `sendReservationConfirmation`: zamiast tylko `console.log` i sukcesu, skonfiguruj SMTP lub Resend i wysyłaj prawdziwy e-mail z potwierdzeniem rezerwacji.
- [x] W `app/actions/mailing.ts` zastąp placeholder w `sendThankYouAfterStay`: podłącz wysyłkę e-maila z podziękowaniem po pobycie (SMTP/Resend).

## 5. Dane statyczne i mocki w komponentach

- [x] W `lib/tape-chart-data.ts` usuń hardcoded tablice `rooms` i `reservations` (lub zastąp je odczytem z Prisma/API), jeśli są używane gdziekolwiek; zostaw tylko `getDateRange` i `getDefaultDateRange` jeśli używane przez tape-chart.
- [x] W `components/guest-check-in-form.tsx` zastąp symulację OCR w `simulateOcrFromFile`: zaimplementuj prawdziwe odczytanie MRZ/danych z pliku (np. Tesseract lub zewnętrzne API OCR) zamiast zwracania stałych „Kowalski, Jan” i mock MRZ.

## 6. Inne

- [x] W `app/actions/finance.ts` usuń lub zabezpiecz `console.log` przy rejestracji wpłaty (linia ~985) – w produkcji użyć loggera lub wyłączyć logowanie wrażliwych danych.
- [x] W `Test/utils/check-in-helpers.ts` usuń lub warunkuj `console.log` w `prepareAvailableRoom` (np. tylko w trybie debug) – aby nie zaśmiecać outputu testów.
- [x] W `lib/fiscal/mock-driver.ts` usuń `console.log` z druku paragonu/faktury w mocku lub zastąp loggerem – albo zostaw tylko gdy FISCAL_DRIVER=mock (środowisko dev).
