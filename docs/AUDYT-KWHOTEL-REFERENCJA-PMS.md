# KWHotel — Pełna Referencja Funkcji PMS — Wynik audytu

**Data audytu:** 2026-02-26  
**Projekt:** Next.js + TypeScript PMS (Karczma Łabędź)  
**Źródło:** Baza Wiedzy KWHotel + specyfikacja techniczna

---

## Legenda statusów

| Symbol | Znaczenie |
|-------|-----------|
| ✅ | Mamy — funkcja zaimplementowana |
| ⚠️ | Częściowo — brakuje elementów |
| ❌ | Brak — do zaimplementowania |
| ⏭️ | Nie dotyczy (np. hostel, camping) |

---

## SEKCJA 1: ZARZĄDZANIE BAZĄ NOCLEGOWĄ

| # | Funkcja KWHotel | Status | Co brakuje |
|---|-----------------|--------|------------|
| 1.1 | Baza wyposażenia pokoi | ⚠️ | **Mamy:** `Room.amenities` (JSON). **Brak:** Osobnej tabeli katalogu wyposażenia (np. `room_equipment`) i UI do zarządzania listą + przypisywania do pokoi (obecnie tylko ręczna edycja JSON). |
| 1.2 | Śledzenie stanu wyposażenia (do naprawy/wymiany) | ❌ | Brak tabeli stanu wyposażenia (status, lista napraw). `MaintenanceIssue` dotyczy pokoju, nie pojedynczego wyposażenia. |
| 1.3 | Typy pokoi (Room Types) | ⚠️ | **Mamy:** `RoomType` (name, basePrice, sortOrder). **Brak:** Opis (description), cena za osobę (price_per_person), liczba łóżek w typie (beds_count — jest w Room, nie w RoomType). |
| 1.4 | Widoczność typu w statystykach | ❌ | Brak pola `visible_in_stats: boolean` w `RoomType`. |
| 1.5 | Tłumaczenia nazw typów | ❌ | Brak `room_type_translations` lub pola JSON `translations` w RoomType (dla Booking Engine). |
| 1.6 | Multi-property | ⚠️ | **Mamy:** `Property`, `Room.propertyId`. **Brak:** `RoomType` nie ma `propertyId` — typy są globalne; dla pełnego multi-property typy powinny być per property. |
| 1.7 | Tworzenie pokoi | ✅ | Tabela `rooms` (number, type, status, price, beds, description, floor, building, amenities, activeForSale, itd.). UI: `/pokoje`. |
| 1.8 | Status housekeepingu (4+ poziomy) | ✅ | Enum `RoomStatus`: CLEAN, DIRTY, OOO, INSPECTION, INSPECTED, CHECKOUT_PENDING, MAINTENANCE. UI: ikony statusu na grafiku, zmiana w RoomStatusIcon / updateRoomStatus. Masowe ustawianie — sprawdzić czy jest przycisk "ustaw wszystkie". |
| 1.9 | Pokój do remontu | ✅ | `Room.activeForSale = false` — nie pokazywany na grafiku do rezerwacji (logika w tape-chart). |
| 1.10 | Priorytet sprzedaży | ❌ | Brak pola `sell_priority` (number) w Room. |
| 1.11 | Eksport pokoi do CSV | ❌ | Brak endpointu/przycisku eksportu listy pokoi do CSV. |
| 1.12 | Usuwanie i przywracanie pokoi | ❌ | Brak soft-delete (`deleted_at` / `is_deleted`) i widoku "usunięte pokoje". |
| 1.13 | Konfiguracja hostelowa | ⏭️ | Nie dotyczy (Karczma). |
| 1.14 | Opis dodatkowy pokoju | ⚠️ | **Mamy:** `Room.description`, `technicalNotes`. **Brak:** Wielu opisów (krótki/długi/wewnętrzny) — np. JSON `descriptions` lub tabela. |

---

## SEKCJA 2: GRAFIK REZERWACJI (TapeChart / Gantt)

| # | Funkcja KWHotel | Status | Co brakuje |
|---|-----------------|--------|------------|
| 2.1 | Grafik wizualny Gantt/TapeChart | ✅ | Komponent `components/tape-chart/index.tsx`, `KwhotelGrafik`, wiersze = pokoje, kolumny = dni, paski = rezerwacje. |
| 2.2 | Drag & drop rezerwacji | ✅ | DndContext (dnd-kit), CellDroppable, moveReservation — zmiana pokoju/dat po drop. |
| 2.3 | Kolorowe statusy rezerwacji | ✅ | RESERVATION_STATUS_BG w `lib/tape-chart-types.ts`, tryb koloru wg statusu i wg źródła/kanału. |
| 2.4 | Podświetlanie weekendów | ✅ | `_isWeekendDate`, `weekendIndices` w TapeChartOverviewBar i MonthlyOverviewDialog — kolumny Sob/Nie inny kolor. |
| 2.5 | Podsumowanie wolnych pokoi na dzień | ✅ | TapeChartOverviewBar — wolne pokoje per dzień (np. "X/Y"). |
| 2.6 | Wyświetlanie cen dziennych na grafiku | ✅ | getEffectivePricesBatch, overlay cen w komórkach (np. kwhotel-grafik, index). |
| 2.7 | Dostępność na cały miesiąc | ✅ | MonthlyOverviewDialog — widok miesięczny z liczbą wolnych pokoi. |
| 2.8 | Źródła rezerwacji na grafiku | ✅ | Źródło/kanał na pasku (rateCodeName/rateCode), tooltip, tryb koloru "Kanał". |
| 2.9 | Wydarzenia specjalne na grafiku | ⚠️ | **Mamy:** `HotelEvent` (startDate, endDate, eventType). **Brak:** Overlay/banner wydarzeń na osi czasu grafiku (integracja z TapeChart). |
| 2.10 | Filtrowanie pokoi i typów | ✅ | Filtr pokoi/typów w UI grafiku (lista filtrów, pokoje zgrupowane). |
| 2.11 | Grupowanie pokoi wg typów | ✅ | Sortowanie/grupowanie wierszy po typie (room.type). |
| 2.12 | Zmiana skali grafiku | ✅ | Slider zoom (columnWidthPx, rowHeightPx), przyciski ZoomIn/ZoomOut. |
| 2.13 | Szybki powrót do "dziś" | ✅ | Przycisk "Dziś" / scroll do today. |
| 2.14 | Wyszukiwanie pokoju wg kryteriów | ⚠️ | **Brak:** Dedykowany formularz "Znajdź pokój: 2 os., balkon, 15–18.03" z listą pasujących. Dostępność jest w MonthlyOverview i przy tworzeniu rezerwacji, ale nie jako osobna wyszukiwarka. |
| 2.15 | Wyszukiwanie rezerwacji po ID | ✅ | searchByConfirmationNumber w actions/reservations; front-office ma searchParams reservationId. |
| 2.16 | Drukowanie grafiku | ✅ | Okno print (export dialog z datami/pokojami), window.print(). |
| 2.17 | Dodatkowe statusy rezerwacji | ⚠️ | **Mamy:** 5 statusów (CONFIRMED, CHECKED_IN, CHECKED_OUT, CANCELLED, NO_SHOW). **Brak:** Rozszerzalne statusy (np. "Wymaga potwierdzenia", "VIP") — enum stały; kolory konfigurowalne w Property.reservationStatusColors. |

---

## SEKCJA 3: OKNO REZERWACJI (tworzenie + edycja)

| # | Funkcja KWHotel | Status | Co brakuje |
|---|-----------------|--------|------------|
| 3.1 | Rezerwacja pojedyncza | ✅ | UnifiedReservationDialog, POST/update w actions/reservations (daty, pokój, gość, cena, status, uwagi). |
| 3.2 | Rezerwacja grupowa | ✅ | ReservationGroup, groupId w Reservation, GroupReservationSheet. |
| 3.3 | Rezerwacja "Out of order" | ✅ | RoomBlock (blockType RENOVATION, MAINTENANCE, itd.) + Room.status OOO. RoomBlockSheet. |
| 3.4 | Dane klienta w rezerwacji | ✅ | reservation.guestId, Guest (name, email, phone, documentType, documentNumber, address, itd.), formularz w oknie rezerwacji. |
| 3.5 | Cena rezerwacji + ceny dzienne | ⚠️ | **Mamy:** RatePlan per roomType/okres, getEffectivePricesBatch — cena per dzień z planu. **Brak:** Tabela reservation_days z zapisaną ceną per dzień (nadpisania) lub pole daily_rates JSON — obecnie cena liczona z RatePlan on-the-fly. |
| 3.6 | Zaliczki i wpłaty | ✅ | advancePayment JSON, Transaction (historia wpłat), settlement tab (zaliczka, do zapłaty). |
| 3.7 | Posiłki w rezerwacji | ✅ | MealConsumption (reservationId, date, mealType, quantity, amount), MealsTab w unified dialog. |
| 3.8 | Towary i usługi w rezerwacji | ✅ | MinibarConsumption, ReservationSurcharge (SurchargeType), ReceptionSale, UslugiTab (szkielet). |
| 3.9 | Opłata miejscowa (klimatyczna) | ✅ | Property.localTaxPerPersonPerNight, chargeLocalTax w finance. |
| 3.10 | Zniżka/rabat | ⚠️ | **Mamy:** rateCodePrice, corporateContracts, rabaty w wycenie. **Brak:** Jawnych pól discount_type (percent/amount), discount_value na rezerwacji (część w rateCode/cennikach). |
| 3.11 | Gwarancja kartą | ✅ | cardGuarantee JSON (lastFourDigits, expiryMonth, status). |
| 3.12 | Status rezerwacji | ✅ | status enum (CONFIRMED, CHECKED_IN, CHECKED_OUT, CANCELLED, NO_SHOW). |
| 3.13 | Źródło rezerwacji | ✅ | source (OTA, PHONE, EMAIL, WALK_IN, WEBSITE, BOOKING_ENGINE). |
| 3.14 | Kanał rezerwacji | ✅ | channel (DIRECT, BOOKING_COM, itd.). |
| 3.15 | Segment rezerwacji | ✅ | marketSegment (BUSINESS, LEISURE, GROUP, itd.). |
| 3.16 | Numer rezerwacji online (OTA) | ❌ | Brak pola `online_reservation_id` (string) w Reservation dla ID z Booking.com/Expedia. |
| 3.17 | Komentarze/uwagi | ✅ | notes, internalNotes, specialRequests; pierwsza linia na pasku grafiku (np. w tooltip). |
| 3.18 | Przypomnienia | ⚠️ | **Mamy:** advancePayment.dueDate, CheckInReminderNotification. **Brak:** Tabela reminders (reservation_id, date, message) i system powiadomień (cron/mail/SMS). |
| 3.19 | Historia rezerwacji | ⚠️ | **Mamy:** AuditLog (entityType Reservation). **Brak:** Dedykowany widok "Historia zmian" w oknie rezerwacji (kto, kiedy, co). |
| 3.20 | Usuwanie rezerwacji z powodem | ⚠️ | **Mamy:** cancellationReason, cancelledAt, cancelledBy. **Brak:** Wymóg podania powodu przy usuwaniu (soft delete) i widok "usunięte rezerwacje". |
| 3.21 | Własne pola (custom fields) | ⚠️ | **Mamy:** HotelConfig.customFormFields (RESERVATION, CHECK_IN, GUEST), UI pola-formularzy. **Brak:** Persystencja wartości per rezerwacja (np. reservation_custom_values lub JSON na Reservation/Guest). |
| 3.22 | Wystawianie dokumentów z rezerwacji | ✅ | Przyciski Faktura/Proforma/Rachunek w DocumentsTab i menu paska, createVatInvoice, createReceipt, printFiscalReceiptForReservation. |
| 3.23 | Potwierdzenie rezerwacji (PDF/mail) | ✅ | Generowanie PDF potwierdzenia (actions/reservations), endpoint confirmation PDF; wysyłka maila (szablony EmailTemplate). |
| 3.24 | Zmiana waluty | ✅ | CurrencyExchangeRate, CurrencyConversion, pole currency w dokumentach. |
| 3.25 | Depozyt | ✅ | securityDeposit JSON (amount, collected, returned). |
| 3.26 | Dokumenty klienta (dowód/paszport) | ✅ | Guest (documentType, documentNumber, documentExpiry, mrz). |
| 3.27 | Usługi godzinowe | ✅ | checkInTime, checkOutTime na Reservation; RatePlan / cennik godzinowy — sprawdzić pełną logikę. |
| 3.28 | Voucher | ✅ | GiftVoucher, VoucherRedemption, VoucherTemplate. |
| 3.29 | Data wymagana zaliczki | ✅ | advancePayment.dueDate. |
| 3.30 | Przypisanie do grupy | ✅ | groupId, ReservationGroup. |

---

## SEKCJA 4: DASHBOARD

| # | Funkcja KWHotel | Status | Co brakuje |
|---|-----------------|--------|------------|
| 4.1 | Lista przyjazdów na dziś | ✅ | getDashboardData: todayCheckIns, arrivals (checkIn = today). Dashboard page + CheckInReminderNotification. |
| 4.2 | Lista wyjazdów na dziś | ✅ | todayCheckOuts (checkOut = today). |
| 4.3 | Trwające rezerwacje | ✅ | status CHECKED_IN, QuickStatsDialog (checkedIn), raporty InHouseGuests. |
| 4.4 | No-show | ✅ | Status NO_SHOW; raport getNoShowReport na stronie Raporty. |
| 4.5 | Szybka rezerwacja (Quick booking) | ⚠️ | **Mamy:** Tworzenie rezerwacji z grafiku (klik w komórkę), wybór daty/typu. **Brak:** Dedykowany widok "Quick booking" (data + typ + ilość → system proponuje pokój i cenę) na dashboardzie. |
| 4.6 | Statystyki obłożenia | ✅ | getOccupancyReport, wykresy (DashboardCharts), KPI obłożenie %. |
| 4.7 | Statystyki dzienne | ✅ | todayKpi (occupancy, ADR, RevPAR), wolne pokoje, przyjazdy/wyjazdy, dirty/OOO. |

---

## SEKCJA 5: BAZA KLIENTÓW (CRM)

| # | Funkcja KWHotel | Status | Co brakuje |
|---|-----------------|--------|------------|
| 5.1 | Dane klienta — pełne | ✅ | Guest: name, email, phone, address (street, city, postalCode, country), dateOfBirth, placeOfBirth, nationality, gender, documentType/Number, NIP w Company. |
| 5.2 | Firma + osoba na jednym kliencie | ✅ | Company (NIP, name, address, contactPerson), Reservation.companyId, ReservationFolio (billTo GUEST/COMPANY). |
| 5.3 | Statusy klientów | ✅ | isVip, vipLevel, isBlacklisted, guestType, segment. |
| 5.4 | Własne pola klienta | ⚠️ | **Mamy:** HotelConfig.customFormFields GUEST. **Brak:** Tabela customer_custom_values lub JSON na Guest do zapisu wartości. |
| 5.5 | Historia rezerwacji klienta | ✅ | getReservationsByGuestId, profil gościa (guests/[id]). |
| 5.6 | Rabat na okres | ⚠️ | **Mamy:** CorporateContract (discountPercent, validFrom/To) dla firm. **Brak:** Tabela customer_discounts (customer_id, percentage, date_from, date_to) dla gości indywidualnych. |
| 5.7 | Zdjęcie klienta | ✅ | Guest.photoUrl. |
| 5.8 | Historia dokumentów klienta | ✅ | Faktury/rachunki powiązane z rezerwacją → gość; ConsolidatedInvoice dla firm. |
| 5.9 | Import/eksport CSV | ⚠️ | **Brak:** Endpointy POST /api/customers/import, GET /api/customers/export (goście). Eksport kontrahentów/firm może być częściowo w raportach. |
| 5.10 | RODO — zgoda na mailing | ✅ | gdprMarketingConsent, gdprMarketingConsentDate. |
| 5.11 | RODO — trwałe usunięcie | ✅ | gdprAnonymizedAt, prawo do zapomnienia (endpoint/anonymization w actions). |
| 5.12 | Wyszukiwanie klientów | ✅ | searchGuests (po nazwisku, email, telefon), kontrahenci?tab=goscie. |

---

## SEKCJA 6: KSIĘGA MELDUNKOWA

| # | Funkcja KWHotel | Status | Co brakuje |
|---|-----------------|--------|------------|
| 6.1 | Księga meldunkowa z filtrami | ⚠️ | **Mamy:** Raport policyjny (getPoliceReport) — CSV po dacie; GUS. **Brak:** Dedykowana strona "Księga meldunkowa" z filtrami (daty, status, pokój) i listą gości. |
| 6.2 | Lista gości wg dat | ✅ | Raport policyjny po dacie; raporty DailyCheckIns, DailyCheckOuts, InHouseGuests. |
| 6.3 | Pełna lista danych w wynikach | ⚠️ | Raport policyjny ma: gość, pokój, daty, obywatelstwo, dokument. **Brak:** Konfigurowalne kolumny (segment, kanał, źródło, zaliczka, cena, płeć, wiek) w jednym widoku księgi. |
| 6.4 | Eksport do CSV | ✅ | GET /api/reports/police?date= → CSV; GUS. |
| 6.5 | Drukowanie raportów | ⚠️ | Print z przeglądarki; **brak:** dedykowany widok do druku księgi. |
| 6.6 | Domyślny wzorzec raportu | ❌ | Brak zapisywania preferencji kolumn (localStorage lub user preferences w DB). |

---

## SEKCJA 7: CENNIKI I PLANY CENOWE

| # | Funkcja KWHotel | Status | Co brakuje |
|---|-----------------|--------|------------|
| 7.1 | Plany cenowe (Rate Plans) | ✅ | RatePlan (roomTypeId, validFrom, validTo, price, minStayNights, maxStayNights, isNonRefundable). |
| 7.2 | Okresy cenowe | ✅ | RatePlan = okres z ceną (wiele wpisów per roomType). |
| 7.3 | Cena bazowa + cena za osobę | ⚠️ | **Mamy:** basePrice w RoomType, price w RatePlan (za pokój/dobę). **Brak:** Osobna cena za osobę (price_per_person) w RatePlan / RoomType. |
| 7.4 | Grupy wiekowe (dzieci 0–6, 7–12, 13–17) | ❌ | Brak pól adult_price, child1/2/3_price w planach. |
| 7.5 | Restrykcje | ✅ | minStayNights, maxStayNights; isWeekendHoliday. **Brak:** closed_to_arrival, closed_to_departure. |
| 7.6 | Przenoszenie cen między planami | ❌ | Brak UI "kopiuj plan z modyfikacją %". |
| 7.7 | Ceny indywidualnie na każdy dzień | ❌ | Brak tabeli daily_rates (date, room_type_id, price) nadpisującej RatePlan. |
| 7.8 | Zmiany hurtowe | ❌ | Brak bulk update cen dla wielu typów naraz. |
| 7.9 | Posiłki w planie cenowym | ⚠️ | **Mamy:** mealPlan na rezerwacji (RO, BB, HB, FB, AI), Property.mealPrices. **Brak:** Relacja rate_plan ↔ meal_types (które posiłki w cenie). |
| 7.10 | Status zwrotny/bezzwrotny | ✅ | RatePlan.isNonRefundable. |
| 7.11 | Cenniki za usługi stałe | ✅ | SurchargeType (parking, zwierzę, itd.), Property.localTaxPerPersonPerNight. |
| 7.12 | Cenniki godzinowe | ⚠️ | **Mamy:** checkInTime/checkOutTime na rezerwacji. **Brak:** Tabela hourly_rates (room_type_id, price_per_hour) i logika wyceny. |
| 7.13 | Ceny na grafiku | ✅ | getEffectivePricesBatch, overlay w komórkach. |
| 7.14 | Pobyty długoterminowe | ❌ | Brak long_stay_discounts (min_days, discount_percent). |
| 7.15–7.19 | OTA / Channel Manager | ⚠️ | **Mamy:** ChannelMapping, ChannelPropertyConfig, availability API, channel-manager page. **Brak:** Pełna synchronizacja cen/dostępności do Booking/Expedia, auto-pobieranie rezerwacji, "praca na zasobach" (auto-assignment pokoju przy check-in). |

---

## SEKCJA 8: DOKUMENTY FINANSOWE

| # | Funkcja KWHotel | Status | Co brakuje |
|---|-----------------|--------|------------|
| 8.1 | Faktury VAT | ✅ | Invoice (number, amountNet/Vat/Gross, buyerNip/Name, KSeF). |
| 8.2 | Faktury zaliczkowe | ✅ | Proforma; faktura na zaliczkę (advance). |
| 8.3 | Proformy | ✅ | Proforma. |
| 8.4 | Korekty faktur | ✅ | InvoiceCorrection. |
| 8.5 | Rachunki | ✅ | Receipt (zwolnienie VAT). |
| 8.6 | Noty księgowe (opłata miejscowa) | ✅ | AccountingNote (type DEBIT/CREDIT). |
| 8.7 | Paragony fiskalne | ✅ | Integracja z drukarką (FiscalJob, FiscalReceiptTemplate), api/fiscal. |
| 8.8 | Dokumenty kasowe KP/KW | ✅ | CashShift, BlindDropRecord; rozliczenia w finance. |
| 8.9 | Dokumenty bankowe | ⚠️ | **Mamy:** BankReconciliationReport. **Brak:** Tabela bank_documents (potwierdzenia wpłat). |
| 8.10 | Automatyczna numeracja | ✅ | DocumentNumberingConfig, DocumentNumberCounter. |
| 8.11 | Dwa typy płatności na dokumencie | ⚠️ | **Brak:** Pola payment_type_1/2, payment_amount_1/2 na fakturze/rachunku. |
| 8.12 | Obsługa walut | ✅ | CurrencyExchangeRate, currency na dokumentach. |
| 8.13 | Status zapłacono | ✅ | Receipt.isPaid, paidAt; faktury — status w KSeF / oznaczanie. **Brak:** Hurtowe "oznacz jako zapłacone" dla wielu dokumentów. |
| 8.14 | Historia zmian dokumentu | ⚠️ | **Mamy:** AuditLog. **Brak:** Widok "Historia dokumentu" w UI. |
| 8.15 | Powiązanie z rezerwacją | ✅ | reservationId na Invoice, Proforma, Receipt, AccountingNote. |
| 8.16 | Pola własne na fakturze | ❌ | Brak custom fields na fakturze. |
| 8.17 | Eksport do CSV | ✅ | api/finance/export. |
| 8.18 | Eksport do księgowości | ✅ | AccountingExport (Optima, Subiekt, wFirma, Fakturownia), integracje. |
| 8.19 | Stawki GTU | ⚠️ | **Sprawdzić:** gtu_code na pozycjach (Invoice items w Transaction/pozycje). |
| 8.20 | JPK | ✅ | api/finance/jpk, jpk-vat, jpk-fa. |
| 8.21 | KSeF | ✅ | KsefSession, KsefSentBatch, api/ksef, ustawienia/ksef. |
| 8.22 | Przypisywanie wpłat do towarów | ❌ | Brak mapowania wpłat na pozycje przy częściowej płatności. |
| 8.23 | Baza asortymentu | ⚠️ | **Mamy:** Pozycje z nazwą (np. "Nocleg"). **Brak:** Tabela assortment (name, default_price, vat_rate, gtu). |
| 8.24 | Link do płatności online | ✅ | PaymentLink, /pay/[token]. |
| 8.25 | Przedrostki dokumentów | ✅ | DocumentNumberingConfig.prefix. |

---

## SEKCJA 9: WYSYŁKA MAILI I SMS

| # | Funkcja KWHotel | Status | Co brakuje |
|---|-----------------|--------|------------|
| 9.1 | Potwierdzenia rezerwacji mailem | ✅ | EmailTemplate (CONFIRMATION), wysyłka (sendConfirmationEmail itd.). |
| 9.2 | Wysyłka SMS | ✅ | SmsLog, integracja (provider), ustawienia/sms. |
| 9.3 | Szablony wiadomości | ✅ | EmailTemplate (type, subject, bodyHtml, availableVariables). |
| 9.4 | Zmienne dynamiczne | ✅ | Dokumentacja availableVariables; replace w treści (guestName, checkIn, room, itd.). |
| 9.5 | Automatyczna wysyłka | ⚠️ | **Mamy:** CheckInReminderNotification, cron (scheduled-reports). **Brak:** Crony: auto-mail po utworzeniu rezerwacji, dzień przed przyjazdem, po wymeldowaniu. |
| 9.6 | Podziękowania za pobyt | ⚠️ | **Mamy:** Szablon THANK_YOU w EmailTemplate. **Brak:** Trigger/cron po wymeldowaniu wysyłający mail. |

---

## SEKCJA 10: POSIŁKI, TOWARY I USŁUGI

| # | Funkcja KWHotel | Status | Co brakuje |
|---|-----------------|--------|------------|
| 10.1 | Typy posiłków | ⚠️ | **Mamy:** MealConsumption (mealType), Property.mealPrices (breakfast, lunch, dinner). **Brak:** Tabela meal_types (name, time_from, time_to, duration, price, vat). |
| 10.2 | Czas serwowania i konsumpcji | ❌ | Brak pól serving_time_from/to, duration_minutes (w meal_types). |
| 10.3 | Raport posiłków | ✅ | getMealReport, getMealCountByDateReport, strona /meals. |
| 10.4 | Drukowanie raportu posiłków | ⚠️ | Print z przeglądarki; **brak:** dedykowany layout do druku dla kuchni. |
| 10.5 | Eksport do Excel | ✅ | exportToExcel w raportach (meals). |
| 10.6 | Baza towarów i usług | ✅ | MinibarItem, ShopProduct, SurchargeType. |
| 10.7 | Usługi godzinowe | ✅ | checkInTime/checkOutTime; RentalItem, RentalBooking (np. rowery). |

---

## SEKCJA 11: RAPORTY I STATYSTYKI

| # | Funkcja KWHotel | Status | Co brakuje |
|---|-----------------|--------|------------|
| 11.1 | Wykresy obłożenia | ✅ | DashboardCharts, getOccupancyReport. |
| 11.2 | Wskaźnik obłożenia (łóżka vs pokoje) | ⚠️ | **Mamy:** Obłożenie per pokój. **Brak:** Przełącznik calculation_method = 'beds' / 'rooms'. |
| 11.3 | Raport pokoi | ✅ | Raporty per room type, rezerwacje per pokój (w raportach). |
| 11.4 | Raport finansowy | ✅ | getRevenueReport, RevenueBySegment/Source/Channel/RoomType. |
| 11.5 | Raporty zmianowe | ✅ | getCashShiftReport, ShiftHandover. |
| 11.6 | Automatyczna wysyłka raportów | ✅ | ScheduledReport, api/cron/scheduled-reports. |
| 11.7 | Eksport do Excel/CSV | ✅ | exportToExcel, CSV (police, GUS). |
| 11.8 | Drukowanie raportów | ✅ | Print. |
| 11.9 | Mini rejestr sprzedaży | ✅ | JPK VAT, raporty sprzedaży. |

---

## SEKCJA 12: NARZĘDZIA I KONFIGURACJA

| # | Funkcja KWHotel | Status | Co brakuje |
|---|-----------------|--------|------------|
| 12.1 | Uprawnienia użytkowników (role) | ✅ | User.role (RECEPTION, MANAGER, HOUSEKEEPING, OWNER), Permission, RoleGroup, RoleGroupPermission, can(). |
| 12.2 | Logi działań | ✅ | AuditLog (entityType, action, userId, timestamp). |
| 12.3 | Wielu użytkowników jednocześnie | ✅ | Aplikacja wielodostępowa; **sprawdzić:** optimistic locking przy konfliktach edycji. |
| 12.4 | Konfiguracja faktur | ✅ | InvoiceTemplate, HotelConfig, DocumentNumberingConfig. |
| 12.5 | Edytor szablonów dokumentów | ✅ | Szablony HTML/PDF (InvoiceTemplate, DocumentTemplate), ustawienia. |
| 12.6 | Konfiguracja opłaty miejscowej | ✅ | Property.localTaxPerPersonPerNight. |
| 12.7 | Obsługa walut | ✅ | CurrencyExchangeRate. |
| 12.8 | Kopie zapasowe | ✅ | api/cron/backup, api/admin/backup, api/admin/restore. |

---

## SEKCJA 13: MODUŁY DODATKOWE

| # | Moduł | Status | Co brakuje |
|---|-------|--------|------------|
| 13.1 | Booking Engine | ✅ | /booking, BookingForm — rezerwacje online. |
| 13.2 | Elektroniczna Karta Meldunkowa | ✅ | Web Check-in (podpis), karta meldunkowa PDF, registration-card/pdf. |
| 13.3 | Odprawa Online (Self Check-in) | ✅ | /check-in/guest/[token], WebCheckInToken, WebCheckInSignature. |
| 13.4 | Housekeeping (Hotel Clean App) | ✅ | CleaningSchedule, MaintenanceIssue, /housekeeping, /sprzatanie, GrafikSprzatanTab. |
| 13.5 | POS gastronomiczny | ✅ | Gastronomia (/gastronomy), Order, OrderItem, stoliki, rachunki. |
| 13.6–13.12 | Camping, Spa, Menu, Parking, Właściciele, App, AI | ⏭️ | Zgodnie z dokumentem — pominięte lub opcjonalne. |

---

## SEKCJA 14: INTEGRACJE

| # | Integracja | Status | Co brakuje |
|---|------------|--------|------------|
| 14.1 | Bramki płatnicze | ✅ | PaymentLink, webhook payment, TPay/Stripe (sprawdzić konfigurację). |
| 14.2 | KSeF | ✅ | KsefSession, wysyłka faktur, UPO, ustawienia/ksef. |
| 14.3 | SMS API | ✅ | SmsLog, provider, ustawienia/sms. |
| 14.4 | Email | ✅ | EmailTemplate, SMTP/Resend (konfiguracja). |
| 14.5 | OTA / Channel Manager | ⚠️ | ChannelMapping, availability API; pełna synchronizacja dwukierunkowa do rozbudowy. |
| 14.6 | Drukarki fiskalne | ✅ | api/fiscal, FiscalJob. |
| 14.7 | Terminale płatnicze | ⚠️ | CardSettlementBatch; integracja z terminalem — częściowo. |
| 14.8 | Eksport do księgowości | ✅ | AccountingExport. |
| 14.9 | Zamki do drzwi | ⏭️ | Niski priorytet. |
| 14.10 | POSbistro/gastronomia | ✅ | Gastronomia, Order, integracja. |

---

# PODSUMOWANIE — TOP 20 BRAKUJĄCYCH / DO DOPRACOWANIA

Kryteria: 🔴 krytyczne, 🟠 ważne, 🟡 przydatne, 🟢 nice to have.

| Lp | Funkcja | Priorytet | Gdzie implementować |
|----|---------|-----------|----------------------|
| 1 | **online_reservation_id** (ID rezerwacji z OTA) | 🔴 | Prisma: Reservation.online_reservation_id (String?). UI: pole w oknie rezerwacji (SettlementTab). |
| 2 | **Księga meldunkowa** — dedykowana strona z filtrami i konfigurowalnymi kolumnami | 🔴 | Nowa strona /ksiega-meldunkowa, komponent tabeli z filtrami (daty, status, pokój), zapis kolumn (user prefs). |
| 3 | **Ceny dzienne na rezerwację** (zapis nadpisań per dzień) | 🔴 | Tabela reservation_days (reservation_id, date, price) lub Reservation.dailyRates JSON. Aktualizacja getEffectivePricesBatch i rozliczeń. |
| 4 | **Eksport pokoi do CSV** | 🟠 | Endpoint GET /api/rooms/export lub action exportRoomsToCsv; przycisk na /pokoje. |
| 5 | **Przypomnienia (reminders)** — tabela + cron (mail/SMS) | 🟠 | Tabela reminders (reservation_id, remind_at, message, sent_at). Cron api/cron/reminders. UI: zakładka w oknie rezerwacji. |
| 6 | **Historia rezerwacji** — widok w oknie rezerwacji | 🟠 | Zapytanie AuditLog WHERE entityType=Reservation AND entityId=id. Komponent "Historia zmian" w UnifiedReservationDialog. |
| 7 | **Widoczność typu w statystykach** (visible_in_stats) | 🟠 | RoomType.visible_in_stats (Boolean, default true). Filtrowanie w raportach obłożenia/RevPAR. |
| 8 | **Soft-delete pokoi** + przywracanie | 🟠 | Room.deleted_at (DateTime?). Scope domyślny: where deleted_at null. Strona "Usunięte pokoje" w ustawieniach/pokoje. |
| 9 | **Własne pola rezerwacji** — persystencja wartości | 🟠 | Reservation.customFieldValues JSON lub tabela reservation_custom_values. Zapis z formularza (customFormFields RESERVATION). |
| 10 | **Daily rates** (nadpisanie ceny na konkretny dzień) | 🟠 | Tabela daily_rates (date, room_type_id, price). Logika w getEffectivePricesBatch (najpierw daily_rates, potem RatePlan). UI w cenniku. |
| 11 | **Quick booking na dashboardzie** | 🟡 | Komponent "Szybka rezerwacja": daty + typ pokoju + ilość → lista dostępnych pokoi + cena → przycisk "Rezerwuj". |
| 12 | **Wydarzenia na grafiku** (HotelEvent overlay) | 🟡 | W TapeChart: pobrać HotelEvent w zakresie dat; renderować banner/nakładkę na osi czasu. |
| 13 | **Wyszukiwanie pokoju wg kryteriów** ("2 os., balkon, 15–18.03") | 🟡 | Formularz w Front Office lub osobna strona: kryteria (daty, osoby, roomFeatures) → GET /api/rooms/availability z filtrami → lista pokoi. |
| 14 | **Priorytet sprzedaży pokoi** (sell_priority) | 🟡 | Room.sell_priority (Int, default 0). Sortowanie wierszy grafiku i w propozycjach przy rezerwacji. |
| 15 | **Tłumaczenia nazw typów pokoi** (Booking Engine) | 🟡 | RoomType.translations JSON lub room_type_translations. Użyć w API availability i w widoku rezerwacji online. |
| 16 | **Rabat na okres dla gościa** (customer_discounts) | 🟡 | Tabela customer_discounts (guest_id, percentage, date_from, date_to). Uwzględnienie w wycenie przy rezerwacji. |
| 17 | **Import/eksport bazy gości CSV** | 🟡 | POST /api/guests/import (CSV), GET /api/guests/export. Strona kontrahenci → Goście → Import/Eksport. |
| 18 | **Domyślny wzorzec raportu** (zapis kolumn księgi) | 🟡 | User preferences (tabela lub localStorage): guest_list_columns. |
| 19 | **Zamknięcie do przyjazdu/wyjazdu** (closed_to_arrival/departure) | 🟡 | RatePlan: closedToArrival, closedToDeparture (Boolean). Walidacja przy tworzeniu rezerwacji. |
| 20 | **Grupy wiekowe w cenniku** (dziecko 0–6, 7–12, 13–17) | 🟢 | RatePlan lub osobna tabela: adult_price, child1_price, child2_price, child3_price. Kalkulacja w wycenie (children + childrenAges). |

---

# KROK 3 — SZCZEGÓŁY IMPLEMENTACJI (wybrane)

## 1. online_reservation_id

- **Prisma:** W modelu `Reservation` dodać: `onlineReservationId String?` (np. ID z Booking.com).
- **API:** W create/update rezerwacji przyjmować pole; w search rezerwacji uwzględnić wyszukiwanie po tym polu.
- **UI:** Pole tekstowe w zakładce Rozliczenie/Dane w UnifiedReservationDialog (SettlementTab).

## 2. Księga meldunkowa

- **Strona:** `app/ksiega-meldunkowa/page.tsx` + client component z tabelą (DataTable).
- **API/action:** `getGuestListReport(dateFrom, dateTo, filters)` — rezerwacje z gośćmi, pokoje, daty, zaliczka, status, segment, kanał, źródło; opcjonalnie kolumny z Guest (płeć, wiek).
- **Filtry:** daty, status rezerwacji, pokój, segment.
- **Kolumny:** Konfigurowalne (zapis w localStorage lub User/Preferences).
- **Eksport:** Przycisk CSV (już wzór w police report).

## 3. Ceny dzienne (reservation_days / dailyRates)

- **Opcja A:** Pole `Reservation.dailyRates Json?` — np. `{ "2026-03-01": 350, "2026-03-02": 400 }`. Przy wycenie: jeśli dzień w dailyRates, użyj tej ceny; inaczej z RatePlan.
- **Opcja B:** Tabela `ReservationDay` (reservationId, date, price).
- **Actions:** W `getEffectivePricesBatch` (lub osobna funkcja dla rezerwacji) uwzględnić nadpisania. W create/update rezerwacji zapisywać dailyRates gdy użytkownik edytuje ceny per dzień.
- **UI:** W SettlementTab — tabela dni z edytowalną ceną (opcjonalnie).

## 4. Eksport pokoi do CSV

- **Action:** `exportRoomsToCsv(propertyId?)` — prisma.room.findMany (gdzie deleted_at null), mapowanie do wierszy CSV.
- **Endpoint:** GET /api/rooms/export lub server action z zwrotem pliku (Content-Disposition).
- **UI:** Przycisk "Eksport CSV" na stronie /pokoje.

## 5. Przypomnienia (reminders)

- **Prisma:** Model `Reminder` (id, reservationId, remindAt DateTime, message String?, channel EMAIL|SMS, sentAt DateTime?, createdAt).
- **Cron:** GET /api/cron/reminders — co 15 min: Reminder gdzie remindAt <= now() i sentAt null → wyślij mail/SMS, ustaw sentAt.
- **UI:** Zakładka "Przypomnienia" w oknie rezerwacji: lista + formularz dodawania (data, godzina, wiadomość, kanał).

---

**Koniec audytu.**  
Dalsze punkty z TOP 20 można realizować analogicznie (schemat DB → action/API → UI).
