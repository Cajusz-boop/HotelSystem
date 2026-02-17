# Instrukcja podłączenia kasy POSNET Trio — krok po kroku

## Co jest potrzebne

- Komputer w recepcji (Windows 11, Chrome)
- Kasa POSNET Trio podłączona do tego komputera (WiFi)
- Pendrive z tym folderem

---

## KROK 1 — Zainstaluj Node.js (jednorazowo)

Node.js to program potrzebny do uruchomienia bridge'a. Instalujesz go raz i zapominasz.

1. Otwórz Chrome na komputerze w recepcji
2. Wejdź na stronę: **https://nodejs.org**
3. Kliknij **duży zielony przycisk po lewej** (z napisem "LTS" — to stabilna wersja)
4. Poczekaj aż plik się pobierze (np. `node-v22.x.x-x64.msi`)
5. **Kliknij dwukrotnie** na pobrany plik
6. Klikaj **Next → Next → Next → Install → Finish** (niczego nie zmieniaj)
7. **Zrestartuj komputer** (ważne! bez restartu może nie działać)

### Jak sprawdzić czy się zainstalowało:

1. Naciśnij na klawiaturze **Win + R** (klawisz Windows + litera R)
2. Wpisz: `cmd` i naciśnij Enter
3. W czarnym oknie wpisz: `node --version` i naciśnij Enter
4. Powinno pokazać coś jak: `v22.14.0` — to znaczy że działa

---

## KROK 2 — Skopiuj folder bridge'a na komputer

1. Włóż pendrive z tym folderem do komputera w recepcji
2. Otwórz pendrive w Eksploratorze plików
3. Skopiuj **cały folder** `posnet-bridge-installer` na pulpit
   - Kliknij prawym na folder → Kopiuj
   - Przejdź na Pulpit → Kliknij prawym → Wklej
4. Na pulpicie powinien być folder `posnet-bridge-installer` z plikami:
   - `URUCHOM-BRIDGE.bat` ← tym uruchamiasz bridge
   - `TEST-BRIDGE.bat` ← tym testujesz czy działa
   - `server.mjs` ← to jest sam bridge (nie ruszaj)
   - `INSTRUKCJA.md` ← ta instrukcja

---

## KROK 3 — Uruchom bridge (codziennie rano)

1. Wejdź do folderu `posnet-bridge-installer` na pulpicie
2. **Kliknij dwukrotnie** na `URUCHOM-BRIDGE.bat`
3. Pojawi się czarne okno z napisem:

```
  ====================================================
  POSNET Trio Bridge v1.1.0
  Nasluchuje na: http://127.0.0.1:9977
  ====================================================

  Bridge dziala. Nie zamykaj tego okna!
```

4. **NIE ZAMYKAJ tego okna!** Musi być otwarte cały czas gdy pracujesz z kasą.
   Możesz je zminimalizować (kliknij `-` w prawym górnym rogu okna).

### Jeśli zobaczysz błąd "Node.js nie jest zainstalowany":
Wróć do KROKU 1 i zainstaluj Node.js. Po instalacji zrestartuj komputer.

---

## KROK 4 — Otwórz program hotelowy

1. Otwórz **Chrome**
2. Wejdź na: **https://hotel.karczma-labedz.pl**
3. Zaloguj się
4. Gotowe — paragony i faktury będą się drukować automatycznie

---

## KROK 5 — Sprawdź czy bridge działa (opcjonalnie)

1. Kliknij dwukrotnie na `TEST-BRIDGE.bat`
2. Jeśli zobaczysz **"OK! Bridge dziala prawidlowo."** — wszystko jest w porządku
3. Jeśli zobaczysz błąd — sprawdź czy okno bridge'a (z KROKU 3) jest otwarte

---

## Codzienne użytkowanie

Każdego dnia rano:

1. Włącz komputer
2. Kliknij `URUCHOM-BRIDGE.bat` (czarne okno — zminimalizuj)
3. Otwórz Chrome → https://hotel.karczma-labedz.pl
4. Pracuj normalnie — paragony drukują się automatycznie

Wieczorem:
- Możesz zamknąć czarne okno bridge'a
- Albo po prostu wyłącz komputer — bridge zamknie się sam

---

## Rozwiązywanie problemów

### "Paragon się nie wydrukował"
1. Sprawdź czy czarne okno bridge'a jest otwarte (KROK 3)
2. Jeśli nie — uruchom `URUCHOM-BRIDGE.bat` ponownie
3. Sprawdź czy kasa POSNET Trio jest włączona i podłączona do WiFi

### "Bridge nie odpowiada"
1. Zamknij czarne okno bridge'a (jeśli jest otwarte)
2. Uruchom `URUCHOM-BRIDGE.bat` ponownie

### "Node.js nie jest zainstalowany"
1. Zainstaluj Node.js (KROK 1)
2. Zrestartuj komputer
3. Spróbuj ponownie

### Komputer się zrestartował / wyłączył
- Bridge nie uruchamia się automatycznie po restarcie
- Trzeba ponownie kliknąć `URUCHOM-BRIDGE.bat`
