# WYNIKI TESTÓW

Rozpoczęto: 2026-02-14 08:02:20

---

**[A2]** **ThemeProvider – motyw**
- Wynik: ✓ PASS
- Czas: 2026-02-14 08:02:20
- Szczegóły: Test Playwright: localStorage pms-theme dark, html ma klasÄ™ dark, brak Hydration failed

**[A3]** **OnboardingGuide – dialog**
- Wynik: ✓ PASS
- Czas: 2026-02-14 08:04:03
- Szczegóły: Dialog onboarding widoczny po mount, brak Hydration failed

**[A4]** **Layout – skrypt theme**
- Wynik: ✓ PASS
- Czas: 2026-02-14 08:04:52

**[A5]** **api-docs – window.location.origin**
- Wynik: ✓ PASS
- Czas: 2026-02-14 08:07:26

**[A6]** **Reports – window.alert**
- Wynik: ✓ PASS
- Czas: 2026-02-14 08:08:24

**[A7]** **Theme toggle**
- Wynik: ✓ PASS
- Czas: 2026-02-14 08:11:37

**[A8]** **Language switcher**
- Wynik: ✓ PASS
- Czas: 2026-02-14 08:12:34

**[B3]** **Link z tokenem – gość**
- Wynik: ✓ PASS
- Czas: 2026-02-14 08:14:30

**[C6]** **NIP – niepoprawny**
- Wynik: ✓ PASS
- Czas: 2026-02-14 09:36:03
- Szczegóły: Walidacja NIP: dokladnie 10 cyfr, odrzucenie 11 cyfr i liter (slice usuniety)

**[C7]** **Email – niepoprawny**
- Wynik: ✓ PASS
- Czas: 2026-02-14 09:38:25
- Szczegóły: Walidacja email w updateGuest (validateOptionalEmail); pusty dozwolony, bez @ zwraca NieprawidĹ‚owy email

**[C8]** **Kwoty ujemne**
- Wynik: ✓ PASS
- Czas: 2026-02-14 09:49:58
- Szczegóły: Walidacja kwot: updateReservation depozyt/przedplata, Blind Drop UI, kaucja toast, updateRoom cena

**[C9]** **Split payment – niepełna suma**
- Wynik: ✓ PASS
- Czas: 2026-02-14 09:50:33
- Szczegóły: validateSplitPayment sprawdza sume metod vs kwota

**[C10]** **Import CSV – puste pliki**
- Wynik: ✓ PASS
- Czas: 2026-02-14 09:51:10
- Szczegóły: parseImportCsv: 0 wierszy i tylko naglowek zwracaja blad; dodano komunikat dla pustego pliku

**[C11]** **Import CSV – złe kodowanie**
- Wynik: ✓ PASS
- Czas: 2026-02-14 09:51:41
- Szczegóły: parseImportCsv: usuwanie BOM na poczatku; UTF-8 z BOM OK

**[C12]** **Select – pusta wartość**
- Wynik: ✓ PASS
- Czas: 2026-02-14 09:52:50
- Szczegóły: updateReservation: pusty status zwraca Wybierz status rezerwacji

**[D1]** **Przeciągnij rezerwację na zajęty pokój**
- Wynik: ✓ PASS
- Czas: 2026-02-14 09:53:25
- Szczegóły: moveReservation waliduje zajety pokoj; dodano toast przy bledzie

**[D2]** **Resize – check-out przed check-in**
- Wynik: ✓ PASS
- Czas: 2026-02-14 09:53:51
- Szczegóły: Resize blokuje checkOut<=checkIn; serwer waliduje daty

**[D3]** **Split – rezerwacja 1 noc**
- Wynik: ✓ PASS
- Czas: 2026-02-14 09:54:42
- Szczegóły: splitReservation odrzuca 1 noc; menu juz pokazuje Podziel tylko przy 2+ nocach

**[D4]** **Klik w zablokowaną komórkę**
- Wynik: ✓ PASS
- Czas: 2026-02-14 09:55:36
- Szczegóły: blockedRanges dziala; dodano toast przy kliku zablokowanej komorki

**[D5]** **Równoczesny edit – dwa okna**
- Wynik: ✓ PASS
- Czas: 2026-02-14 09:56:23
- Szczegóły: updateReservation: optimistic lock po updatedAt przy konflikcie zapisu

**[D6]** **Rezerwacja grupowa – rooming list**
- Wynik: ✓ PASS
- Czas: 2026-02-14 10:06:27
- Szczegóły: deleteReservation usuwa pusta grupe gdy ostatnia rezerwacja z grupy

**[D7]** **Rezerwacja z parkingiem – brak miejsc**
- Wynik: ✓ PASS
- Czas: 2026-02-14 10:07:15
- Szczegóły: createParkingBooking sprawdza konflikt; createReservation rollback + error; updateReservation zwraca blad parkingu

**[D8]** **Rezerwacja godzinowa**
- Wynik: ✓ PASS
- Czas: 2026-02-14 10:07:49
- Szczegóły: checkInTime checkOutTime w schemacie i create/update; walidacja HH:mm i checkOutTime>checkInTime

**[D9]** **Ghost preview – szybki drag**
- Wynik: ✓ PASS
- Czas: 2026-02-14 10:08:17
- Szczegóły: Ghost ma null-checki i guardy; batchowanie React OK

**[D10]** **Zoom / zmiana skali podczas drag**
- Wynik: ✓ PASS
- Czas: 2026-02-14 10:08:53
- Szczegóły: useEffect anuluje drag przy zmianie zoomIndex/viewScale

**[E1]** **Void bez PIN**
- Wynik: ✓ PASS
- Czas: 2026-02-14 10:09:10
- Szczegóły: voidFolioItem i voidTransaction wymagajÄ… PIN powyĹĽej limitu; zwracajÄ… bĹ‚Ä…d

**[E2]** **Void – 3x zły PIN**
- Wynik: ✓ PASS
- Czas: 2026-02-14 10:09:18
- Szczegóły: VOID_PIN_MAX_ATTEMPTS=3, lockout 15min per IP

**[E3]** **Night Audit – podczas transakcji**
- Wynik: ✓ PASS
- Czas: 2026-02-14 10:09:57
- Szczegóły: Night Audit tylko createdAt<today; nowe pĹ‚atnoĹ›ci=createdAt=now(), brak konfliktu

**[E4]** **Faktura – brak NIP**
- Wynik: ✓ PASS
- Czas: 2026-02-14 10:10:57
- Szczegóły: Walidacja NIP w printInvoiceForReservation i createVatInvoice

**[E5]** **Blind Drop – kwota ujemna**
- Wynik: ✓ PASS
- Czas: 2026-02-14 10:11:11
- Szczegóły: blindDropSchema countedCash min(0) odrzuca ujemne

**[E6]** **Folio – transfer do nieistniejącego folio**
- Wynik: ✓ PASS
- Czas: 2026-02-14 10:11:28
- Szczegóły: transferToAnotherReservation zwraca Nie znaleziono docelowej rezerwacji

**[E7]** **Refund – kwota > zapłaconej**
- Wynik: ✓ PASS
- Czas: 2026-02-14 10:11:44
- Szczegóły: refundPayment: amount > refundableAmount zwraca bĹ‚Ä…d

**[E8]** **KSeF – sesja wygasła**
- Wynik: ✓ PASS
- Czas: 2026-02-14 10:12:55
- Szczegóły: Retry: przy 401/403 usuwamy sesjÄ™ i wysyĹ‚amy ponownie z nowÄ… sesjÄ…

**[E9]** **Drukuj paragon – drukarka offline**
- Wynik: ✓ PASS
- Czas: 2026-02-14 10:13:21
- Szczegóły: POSNET driver: AbortController timeout 8s, index.ts try/catch zwraca bĹ‚Ä…d

**[E10]** **Terminal płatniczy – anuluj**
- Wynik: ✓ PASS
- Czas: 2026-02-14 10:14:23
- Szczegóły: !result.success bez rejestracji; komunikat PĹ‚atnoĹ›Ä‡ anulowana na terminalu przy CANCELLED

**[E11]** **Split payment – wiele metod**
- Wynik: ✓ PASS
- Czas: 2026-02-14 10:14:43
- Szczegóły: createSplitPaymentTransaction + registerTransaction SPLIT, validateSplitPayment

**[E12]** **Eksport JPK – pusty zakres**
- Wynik: ✓ PASS
- Czas: 2026-02-14 10:14:58
- Szczegóły: exportJpk/JPK_FA/JPK_VAT: puste findMany â†’ poprawny XML bez wierszy

**[F1]** **Dodaj danie – brak kategorii**
- Wynik: ✓ PASS
- Czas: 2026-02-14 10:15:12
- Szczegóły: createMenuItem: !trimmedCategory â†’ Kategoria jest wymagana

**[F2]** **Danie – cena 0**
- Wynik: ✓ PASS
- Czas: 2026-02-14 10:15:26
- Szczegóły: createMenuItem: price >= 0 przyjmowane (0 dozwolone)

**[F3]** **Zamówienie do nieistniejącej rezerwacji**
- Wynik: ✓ PASS
- Czas: 2026-02-14 10:16:05
- Szczegóły: createOrder: sprawdzenie istnienia rezerwacji przy podanym reservationId

**[F4]** **Obciąż rezerwację – rezerwacja wymeldowana**
- Wynik: ✓ PASS
- Czas: 2026-02-14 10:17:00
- Szczegóły: chargeOrderToReservation zwraca bĹ‚Ä…d gdy status CHECKED_OUT

**[F5]** **Karta dań – pusta**
- Wynik: ✓ PASS
- Czas: 2026-02-14 10:17:23
- Szczegóły: getMenu zwraca data: [] przy braku pozycji, brak crashu

**[F6]** **Alergeny – wszystkie 14**
- Wynik: ✓ PASS
- Czas: 2026-02-14 10:17:38
- Szczegóły: allergens w JSON, brak limitu; createMenuItem/updateMenuItem przyjmujÄ… tablicÄ™

**[F7]** **Dieta + alergeny**
- Wynik: ✓ PASS
- Czas: 2026-02-14 10:18:05
- Szczegóły: createMenuItem/updateMenuItem zapisujÄ… dietTags i allergens rĂłwnolegle

**[F8]** **Zamówienie – 0 sztuk**
- Wynik: ✓ PASS
- Czas: 2026-02-14 10:18:21
- Szczegóły: createOrder: filter quantity>0, przy samych 0 â†’ Brak prawidĹ‚owych pozycji

**[F9]** **Minibar – ujemna ilość**
- Wynik: ✓ PASS
- Czas: 2026-02-14 10:18:55
- Szczegóły: addMinibarToReservation: jawna walidacja quantity >= 0

**[F10]** **Posiłki – raport za pusty okres**
- Wynik: ✓ PASS
- Czas: 2026-02-14 10:19:21
- Szczegóły: getMealCountByDateReport: iteracja po dniach, brak danych = wiersze z zerami

**[G1]** **Sesja wygasła – idle**
- Wynik: ✓ PASS
- Czas: 2026-02-14 10:19:43
- Szczegóły: middleware: IDLE_TIMEOUT 30min, LAST_ACTIVITY, redirect /login?timeout=1

**[G2]** **Password expired**
- Wynik: ✓ PASS
- Czas: 2026-02-14 10:20:09
- Szczegóły: middleware: payload.passwordExpired â†’ redirect /change-password

**[G3]** **2FA – zły kod**
- Wynik: ✓ PASS
- Czas: 2026-02-14 10:20:30
- Szczegóły: verify2FA: verifyTotpToken false â†’ NieprawidĹ‚owy kod.

**[G4]** **2FA – kod sprzed 2 okien**
- Wynik: ✓ PASS
- Czas: 2026-02-14 10:21:07
- Szczegóły: otplib verifySync okno czasowe, stary kod â†’ valid: false

**[G5]** **Wyloguj – aktywna operacja**
- Wynik: ✓ PASS
- Czas: 2026-02-14 10:21:27
- Szczegóły: getSession null po wylogowaniu; akcje zwracajÄ… bĹ‚Ä…d zamiast crashu

**[G6]** **Brak uprawnień**
- Wynik: ✓ PASS
- Czas: 2026-02-14 10:22:41
- Szczegóły: app/finance/layout.tsx: can(role, module.finance) â†’ redirect /?forbidden=1

**[G7]** **API IP whitelist**
- Wynik: ✓ PASS
- Czas: 2026-02-14 10:58:08
- Szczegóły: Middleware matcher poprawiony (api wlaczony). API_IP_WHITELIST=10.0.0.1: request bez IP na liscie zwraca 403; z X-Forwarded-For 10.0.0.1 przechodzi.

**[L3]** **Otwórz 10 kart**
- Wynik: ✓ PASS
- Czas: 2026-02-14 11:44:00
- Szczegóły: Wykonano przez AI

**[L4]** **Eksport dużego raportu**
- Wynik: ✓ PASS
- Czas: 2026-02-14 11:44:45
- Szczegóły: Wykonano przez AI

**[L5]** **Równoczesne zapisy**
- Wynik: ✓ PASS
- Czas: 2026-02-14 11:45:26
- Szczegóły: Wykonano przez AI

**[P1.1.1]** **Test Kolizji**
- Wynik: ✓ PASS
- Czas: 2026-02-14 11:46:43
- Szczegóły: Wykonano przez AI

**[P1.1.2]** **Double Booking (Race Condition)**
- Wynik: ✓ PASS
- Czas: 2026-02-14 11:47:28
- Szczegóły: Wykonano przez AI

**[P1.1.4]** **Ghost Dragging**
- Wynik: ✓ PASS
- Czas: 2026-02-14 11:47:53
- Szczegóły: Wykonano przez AI

**[P1.2.1]** **Zaokrąglenia groszowe**
- Wynik: ✓ PASS
- Czas: 2026-02-14 11:48:52
- Szczegóły: Wykonano przez AI

**[P1.2.2]** **Podwójne obciążenie (Spam Click)**
- Wynik: ✓ PASS
- Czas: 2026-02-14 11:50:02
- Szczegóły: Wykonano przez AI

**[P1.2.3]** **Korekty ujemne**
- Wynik: ✓ PASS
- Czas: 2026-02-14 11:50:31
- Szczegóły: Wykonano przez AI

**[P1.2.4]** **Nocny Audyt vs Transakcje**
- Wynik: ✓ PASS
- Czas: 2026-02-14 11:51:34
- Szczegóły: Wykonano przez AI

**[P1.3.1]** **Wyścig tokenów**
- Wynik: ✓ PASS
- Czas: 2026-02-14 11:54:16
- Szczegóły: Wykonano przez AI

**[P1.3.2]** **IDOR (Brak uprawnień)**
- Wynik: ✓ PASS
- Czas: 2026-02-14 11:55:37
- Szczegóły: Wykonano przez AI

**[P2.1.1]** **Timezone Mismatch**
- Wynik: ✓ PASS
- Czas: 2026-02-14 11:56:20
- Szczegóły: Wykonano przez AI

**[P2.1.2]** **Flicker Test**
- Wynik: ✓ PASS
- Czas: 2026-02-14 11:56:47
- Szczegóły: Wykonano przez AI

**[P2.2.2]** **Emoji Support**
- Wynik: ✓ PASS
- Czas: 2026-02-14 11:57:08
- Szczegóły: Wykonano przez AI

**[P2.2.3]** **Walidacja NIP/PESEL**
- Wynik: ✓ PASS
- Czas: 2026-02-14 11:59:16
- Szczegóły: Wykonano przez AI

**[P2.3.1]** **KSeF Offline**
- Wynik: ✓ PASS
- Czas: 2026-02-14 12:00:07
- Szczegóły: Wykonano przez AI

**[P2.3.2]** **Drukarka fiskalna**
- Wynik: ✓ PASS
- Czas: 2026-02-14 12:22:07
- Szczegóły: Wykonano przez AI

**[P3.1.1]** **Memory Leak**
- Wynik: ✓ PASS
- Czas: 2026-02-14 12:23:09
- Szczegóły: Wykonano przez AI

**[P3.1.2]** **Duży raport**
- Wynik: ✓ PASS
- Czas: 2026-02-14 12:23:30
- Szczegóły: Wykonano przez AI

**[P3.1.3]** **Szybkie filtrowanie**
- Wynik: ✓ PASS
- Czas: 2026-02-14 12:24:15
- Szczegóły: Wykonano przez AI

**[P3.2.2]** **Unicode**
- Wynik: ✓ PASS
- Czas: 2026-02-14 12:24:38
- Szczegóły: Wykonano przez AI

**[S1.1]** **Backdating**
- Wynik: ✓ PASS
- Czas: 2026-02-14 12:25:38
- Szczegóły: Wykonano przez AI

**[S1.2]** **Far Future**
- Wynik: ✓ PASS
- Czas: 2026-02-14 12:26:18
- Szczegóły: Wykonano przez AI

**[S1.3]** **Leap Year**
- Wynik: ✓ PASS
- Czas: 2026-02-14 12:26:36
- Szczegóły: Wykonano przez AI

**[S1.4]** **Room Dirty**
- Wynik: ✓ PASS
- Czas: 2026-02-14 12:27:18
- Szczegóły: Wykonano przez AI

**[S1.5]** **Room OOO**
- Wynik: ✓ PASS
- Czas: 2026-02-14 12:27:35
- Szczegóły: Wykonano przez AI

**[S1.7]** **Max Stay**
- Wynik: ✓ PASS
- Czas: 2026-02-14 12:28:02
- Szczegóły: Wykonano przez AI

**[S1.8]** **Zero Pax**
- Wynik: ✓ PASS
- Czas: 2026-02-14 12:29:14
- Szczegóły: Wykonano przez AI

**[S1.9]** **Overbooking Force**
- Wynik: ✓ PASS
- Czas: 2026-02-14 12:31:01
- Szczegóły: Wykonano przez AI

**[S1.10]** **Overbooking Block**
- Wynik: ✓ PASS
- Czas: 2026-02-14 12:31:59
- Szczegóły: Wykonano przez AI

**[S1.11]** **Guest History Match**
- Wynik: ✓ PASS
- Czas: 2026-02-14 12:34:11
- Szczegóły: Wykonano przez AI

**[S2.1]** **Shorten Stay (od przodu)**
- Wynik: ✓ PASS
- Czas: 2026-02-14 12:35:40
- Szczegóły: Wykonano przez AI

**[S2.2]** **Shorten Stay (od tyłu)**
- Wynik: ✓ PASS
- Czas: 2026-02-14 12:36:34
- Szczegóły: Wykonano przez AI

**[S2.3]** **Extend Stay**
- Wynik: ✓ PASS
- Czas: 2026-02-14 12:37:14
- Szczegóły: Wykonano przez AI

**[S2.4]** **Upgrade Room**
- Wynik: ✓ PASS
- Czas: 2026-02-14 12:37:41
- Szczegóły: Wykonano przez AI

**[S2.5]** **Downgrade Room**
- Wynik: ✓ PASS
- Czas: 2026-02-14 12:38:06
- Szczegóły: Wykonano przez AI

**[S2.6]** **Split Stay**
- Wynik: ✓ PASS
- Czas: 2026-02-14 12:39:02
- Szczegóły: Wykonano przez AI

**[S2.7]** **Rate Plan Change**
- Wynik: ✓ PASS
- Czas: 2026-02-14 12:39:30
- Szczegóły: Wykonano przez AI

**[S2.8]** **Currency Switch**
- Wynik: ✓ PASS
- Czas: 2026-02-14 12:40:15
- Szczegóły: Wykonano przez AI

**[S2.9]** **Add Sharer**
- Wynik: ✓ PASS
- Czas: 2026-02-14 12:41:09
- Szczegóły: Wykonano przez AI

**[S2.10]** **Remove Sharer**
- Wynik: ✓ PASS
- Czas: 2026-02-14 12:41:45
- Szczegóły: Wykonano przez AI

**[S3.1]** **Min Stay Violation**
- Wynik: ✓ PASS
- Czas: 2026-02-14 12:42:44
- Szczegóły: Wykonano przez AI

**[S3.2]** **Manual Override**
- Wynik: ✓ PASS
- Czas: 2026-02-14 12:43:10
- Szczegóły: Wykonano przez AI

**[S3.3]** **Negative Price**
- Wynik: ✓ PASS
- Czas: 2026-02-14 12:44:03
- Szczegóły: Wykonano przez AI

**[S3.4]** **Add-ons Scaling**
- Wynik: ✓ PASS
- Czas: 2026-02-14 12:44:40
- Szczegóły: Wykonano przez AI

**[S3.5]** **Child Aging**
- Wynik: ✓ PASS
- Czas: 2026-02-14 12:45:35
- Szczegóły: Wykonano przez AI

**[S3.6]** **City Tax**
- Wynik: ✓ PASS
- Czas: 2026-02-14 12:46:30
- Szczegóły: Wykonano przez AI

**[S3.7]** **Fixed Rate**
- Wynik: ✓ PASS
- Czas: 2026-02-14 12:47:01
- Szczegóły: Wykonano przez AI

**[S4.1]** **Rooming List Import**
- Wynik: ✓ PASS
- Czas: 2026-02-14 12:47:51
- Szczegóły: Wykonano przez AI

**[S4.2]** **Group Cancellation**
- Wynik: ✓ PASS
- Czas: 2026-02-14 12:48:52
- Szczegóły: Wykonano przez AI

**[S4.3]** **Master Bill Routing**
- Wynik: ✓ PASS
- Czas: 2026-02-14 12:49:27
- Szczegóły: Wykonano przez AI

**[S4.4]** **Staggered Dates**
- Wynik: ✓ PASS
- Czas: 2026-02-14 12:50:05
- Szczegóły: Wykonano przez AI

**[S4.5]** **Pick-up from Block**
- Wynik: ✓ PASS
- Czas: 2026-02-14 12:50:55
- Szczegóły: Wykonano przez AI

**[S4.6]** **Over-Pick**
- Wynik: ✓ PASS
- Czas: 2026-02-14 12:51:51
- Szczegóły: Wykonano przez AI

**[S5.1]** **Modification on Checked-In**
- Wynik: ✓ PASS
- Czas: 2026-02-14 12:52:41
- Szczegóły: Wykonano przez AI

**[S5.2]** **Unknown Room Type**
- Wynik: ✓ PASS
- Czas: 2026-02-14 12:53:22
- Szczegóły: Wykonano przez AI

**[S5.3]** **Price Mismatch**
- Wynik: ✓ PASS
- Czas: 2026-02-14 12:53:51
- Szczegóły: Wykonano przez AI

**[S5.4]** **Long Comments**
- Wynik: ✓ PASS
- Czas: 2026-02-14 12:54:40
- Szczegóły: Wykonano przez AI

**[S5.5]** **Orphan Cancellation**
- Wynik: ✓ PASS
- Czas: 2026-02-14 12:55:23
- Szczegóły: Wykonano przez AI

**[S5.6]** **Virtual Card Parsing**
- Wynik: ✓ PASS
- Czas: 2026-02-14 12:56:21
- Szczegóły: Wykonano przez AI

**[S6.1]** **Early Check-in**
- Wynik: ✓ PASS
- Czas: 2026-02-14 12:58:09
- Szczegóły: Wykonano przez AI

**[S6.2]** **Late Check-out**
- Wynik: ✓ PASS
- Czas: 2026-02-14 12:59:00
- Szczegóły: Wykonano przez AI

**[S6.3]** **Undo Check-in**
- Wynik: ✓ PASS
- Czas: 2026-02-14 12:59:32
- Szczegóły: Wykonano przez AI

**[S6.4]** **Undo Check-out**
- Wynik: ✓ PASS
- Czas: 2026-02-14 13:00:10
- Szczegóły: Wykonano przez AI

**[S6.5]** **Check-out with Balance**
- Wynik: ✓ PASS
- Czas: 2026-02-14 13:00:46
- Szczegóły: Wykonano przez AI

**[S6.6]** **No-Show**
- Wynik: ✓ PASS
- Czas: 2026-02-14 13:01:25
- Szczegóły: Wykonano przez AI

**[S6.7]** **Reinstate**
- Wynik: ✓ PASS
- Czas: 2026-02-14 13:02:15
- Szczegóły: Wykonano przez AI

**[S6.8]** **Auto-Cancel**
- Wynik: ✓ PASS
- Czas: 2026-02-14 13:02:44
- Szczegóły: Wykonano przez AI

**[S7.1]** **Confirmation Email**
- Wynik: ✓ PASS
- Czas: 2026-02-14 13:03:30
- Szczegóły: Wykonano przez AI

**[S7.2]** **Registration Card**
- Wynik: ✓ PASS
- Czas: 2026-02-14 13:04:30
- Szczegóły: Wykonano przez AI

**[S7.3]** **Invoice Data**
- Wynik: ✓ PASS
- Czas: 2026-02-14 13:05:06
- Szczegóły: Wykonano przez AI

