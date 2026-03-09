# FAZA 4: Wyniki testów manualnych — Centrum Sprzedaży

> Data: ___________
> Wykonawca: Łukasz (testy manualne) + automatyczne (Playwright, weryfikacja kodu)

---

## Testy automatyczne / weryfikacja kodu

### ✅ 4.5 Test: pętla GCal webhook
**Weryfikacja kodu** `lib/googleCalendarWebhookProcessor.ts`:
- `processCalendarEvent` NIE wywołuje `updateCalendarEvent` po update bazy ✓
- Po update ustawia `googleCalendarUpdatedAt` ✓

**Wynik: Brak pętli ✓**

### ✅ 4.10 Test: XSS w notatce
**Weryfikacja kodu** `components/centrum-sprzedazy.tsx`:
- Notatki renderowane jako `{ev.notes || "..."}` — zwykły tekst
- Brak `dangerouslySetInnerHTML` ✓

**Wynik: PASS** (bezpieczne renderowanie)

---

## Testy Playwright (uruchom: `npx playwright test Test/centrum-sprzedazy.spec.ts`)

| Test | Scenariusz | Status |
|------|------------|--------|
| 4.1 | Zmiana statusu na DONE | ☐ PASS / ☐ FAIL |
| 4.6 | Polski przecinek w zadatku 1500,50 | ☐ PASS / ☐ FAIL |
| 4.7 | PATCH fail (offline) → rollback | ☐ PASS / ☐ FAIL |
| 4.10 | XSS — script jako tekst | ☐ PASS / ☐ FAIL |

---

## Testy manualne — do wypełnienia przez Łukasza

### ☐ 4.1 Zmiana statusu na DONE
1. Otwórz /centrum-sprzedazy
2. Kliknij imprezę CONFIRMED → DONE
3. Toast "Status: Zakończone"? Odśwież → status DONE? Filtr "Zakończone"? GCal zaktualizowany?

**Wynik: ☐ PASS / ☐ FAIL** ___________

### ☐ 4.2 CANCELLED + przywrócenie
1. Anuluj imprezę → Toast? GCal anulowany?
2. Filtr "Anulowane" → Przywróć → status CONFIRMED? GCal przywrócony?

**Wynik: ☐ PASS / ☐ FAIL** ___________

### ☐ 4.3 Zapis menu
1. KOMUNIA → Menu → "Menu komunijne 235 zł" → wypełnij surówki → Zapisz
2. F12 Network → PATCH 200? Zamknij/otwórz → menu zachowane? F5 → nadal?

**Wynik: ☐ PASS / ☐ FAIL** ___________

### ☐ 4.4 Nowa impreza z Centrum
1. +Nowa impreza → /events/new
2. KOMUNIA, "Test Audyt", Sala Złota, 30 gości, dziś+14
3. Zapisz → redirect /centrum-sprzedazy? "Test Audyt" na liście? GCal?

**Wynik: ☐ PASS / ☐ FAIL** ___________

### ☐ 4.6 Polski przecinek (manual)
1. Impreza → Zadatek → Dodaj → "1500,50" → Zapisz
2. Zadatek = 1500.50 zł (nie 1500)? Po reload nadal 1500.50?

**Wynik: ☐ PASS / ☐ FAIL** ___________

### ☐ 4.7 PATCH fail — rollback (manual)
1. DevTools → Network → Offline
2. Zmień zadatek na opłacony
3. Toast "Błąd zapisu"? Zadatek wraca? Wyłącz Offline → odśwież → OK?

**Wynik: ☐ PASS / ☐ FAIL** ___________

### ☐ 4.8 Szukanie telefonu +48
```sql
SELECT clientPhone FROM EventOrder WHERE clientPhone LIKE '+48%' LIMIT 5;
```
2. Wyszukaj numer BEZ +48
3. Impreza znaleziona?

**Wynik: ☐ PASS / ☐ FAIL / ☐ N/A** ___________

### ☐ 4.9 PUT vs PATCH (race)
1. Centrum + /events/[id]/edit — ta sama impreza
2. Centrum: zadatek 9999 → Zapisz
3. Formularz: Zapisz bez zmiany
4. Odśwież Centrum → zadatek 9999?

**Wynik: ☐ PASS / ☐ FAIL** ___________

### ☐ 4.11 Sala Duża w Gancie
1. Gantt → miesiąc z imprezą "Sala Duża"
2. Impreza w wierszu "Sala Złota"?

**Wynik: ☐ PASS / ☐ FAIL** ___________

---

## Podsumowanie

| Test | Wynik |
|------|-------|
| 4.1 | |
| 4.2 | |
| 4.3 | |
| 4.4 | |
| 4.5 | Brak pętli ✓ |
| 4.6 | |
| 4.7 | |
| 4.8 | |
| 4.9 | |
| 4.10 | PASS ✓ |
| 4.11 | |
