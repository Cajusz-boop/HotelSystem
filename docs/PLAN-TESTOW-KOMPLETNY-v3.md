# PLAN TESTÓW KOMPLETNY v3 — HotelSystem PMS
# Oparty o RZECZYWISTY dzień pracy recepcji hotelowej

## INSTRUKCJA DLA AI (Cursor)

Ten plan testuje system PMS tak jak używa go PRAWDZIWA RECEPCJONISTKA.
Nie testujemy "czy strona się otwiera" — testujemy "czy recepcja może pracować".

**Zasady:**
- Serwer dev: `http://localhost:3011`
- Baza: PRODUKCYJNA
- Dane testowe: prefix `E2E_` w nazwisku/opisie
- Testy E2E Playwright: prawdziwe klikanie w przeglądarce
- Przed pisaniem testów: przeanalizuj @Codebase (selektory, formularze, przyciski)
- Każdy test = screenshot w `screenshots/v3/`
- Jeśli test pada → napraw KOD APLIKACJI (nie test!) → uruchom ponownie
- Po każdej fazie: zapisz wynik w sekcji RAPORT na końcu pliku

---

## FAZA 0: PRZYGOTOWANIE ✅ (zaliczona 2026-02-26)

### 0.1 — Przywróć bazę produkcyjną
- Baza produkcyjna: 44 694 rezerwacji, 19 808 gości, 28 pokoi, 6 faktur
- Przywracanie: `npm run db:pull` + `npm run db:restore` (gdy potrzeba)

### 0.2 — Mapa UI
- `docs/UI-SELECTORS-MAP.md` — dialog rezerwacji, TapeChart, Rozliczenie, /finance, Booking Engine, przyciski akcji

---

## FAZA 1: PORANEK — PRZYJĘCIE ZMIANY ✅ (4/4)

Testy: `tests/plan-v3-faza1.spec.ts`
