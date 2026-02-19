# Instrukcja podłączenia kasy POSNET Trio — krok po kroku

## Co jest potrzebne

- Komputer w recepcji (Windows 11, Chrome)
- Kasa POSNET Trio podłączona do sieci WiFi (adres IP: 10.119.169.55, port: 6666)
- Pendrive z tym folderem

## Pliki w folderze

| Plik | Do czego służy |
|------|---------------|
| `URUCHOM-BRIDGE.bat` | Ręczne uruchomienie bridge'a (z widocznym oknem) |
| `ZAINSTALUJ-AUTOSTART.bat` | **Jednorazowo** — włącza autostart po starcie Windows |
| `ODINSTALUJ-AUTOSTART.bat` | Wyłącza autostart |
| `TEST-BRIDGE.bat` | Sprawdza czy bridge działa |
| `bridge-silent.vbs` | Uruchamia bridge w tle (bez okna) — używany przez autostart |
| `bridge.env` | **Konfiguracja** — adres IP drukarki, port, tryb pracy |
| `server.mjs` | Sam bridge (nie ruszaj) |
| `posnet-protocol.mjs` | Protokół komunikacji z drukarką (nie ruszaj) |

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
4. Na pulpicie powinien być folder `posnet-bridge-installer` z plikami wymienionymi wyżej

---

## KROK 3 — Sprawdź konfigurację (bridge.env)

Otwórz plik `bridge.env` w Notatniku i sprawdź ustawienia:

```
POSNET_BRIDGE_MODE=tcp
POSNET_PRINTER_HOST=10.119.169.55
POSNET_PRINTER_PORT=6666
```

- **POSNET_PRINTER_HOST** — adres IP drukarki POSNET Trio (domyślnie 10.119.169.55)
- **POSNET_PRINTER_PORT** — port TCP drukarki (domyślnie 6666)
- **POSNET_BRIDGE_MODE** — `tcp` = prawdziwa drukarka, `spool` = tryb testowy

Jeśli adres IP drukarki jest inny, zmień go w tym pliku.

---

## KROK 4 — Włącz autostart (jednorazowo, ZALECANE)

Dzięki temu bridge będzie uruchamiał się **automatycznie** po każdym włączeniu komputera — w tle, bez żadnego okna. Nikt nie musi o niczym pamiętać.

1. Wejdź do folderu `posnet-bridge-installer` na pulpicie
2. **Kliknij dwukrotnie** na `ZAINSTALUJ-AUTOSTART.bat`
3. Pojawi się okno z napisem **"SUKCES! Autostart zostal zainstalowany."**
4. Naciśnij dowolny klawisz, żeby zamknąć okno
5. **Gotowe!** Od teraz bridge startuje sam.

### Co się dzieje po włączeniu autostartu:

- Po każdym uruchomieniu/restarcie Windows bridge startuje w tle
- Nie ma żadnego okna do minimalizowania — działa niewidocznie
- Bridge łączy się z drukarką POSNET Trio przez WiFi (TCP/IP)
- Program hotelowy łączy się z bridge'em automatycznie

### Jak wyłączyć autostart:

Kliknij dwukrotnie na `ODINSTALUJ-AUTOSTART.bat` — usunie skrót z Autostartu i zatrzyma bridge.

---

## KROK 5 (alternatywa) — Ręczne uruchomienie (jeśli nie chcesz autostartu)

Jeśli z jakiegoś powodu nie chcesz autostartu, możesz uruchamiać bridge ręcznie:

1. Wejdź do folderu `posnet-bridge-installer` na pulpicie
2. **Kliknij dwukrotnie** na `URUCHOM-BRIDGE.bat`
3. Pojawi się czarne okno z informacjami o bridge'u i połączeniu z drukarką
4. Jeśli zobaczysz `✓ Drukarka odpowiada!` — wszystko działa
5. **NIE ZAMYKAJ tego okna!** Musi być otwarte cały czas gdy pracujesz z kasą.

---

## KROK 6 — Sprawdź czy bridge działa

1. Kliknij dwukrotnie na `TEST-BRIDGE.bat`
2. Jeśli zobaczysz **"OK! Bridge dziala prawidlowo."** — wszystko jest w porządku
3. Jeśli zobaczysz błąd — sprawdź czy bridge jest uruchomiony (autostart lub ręcznie)

---

## KROK 7 — Otwórz program hotelowy

1. Otwórz **Chrome**
2. Wejdź na: **https://hotel.karczma-labedz.pl**
3. Zaloguj się
4. Przejdź do **Ustawienia → Kasa fiskalna** i kliknij **Testuj połączenie**
5. Zielony status = wszystko działa, paragony będą się drukować automatycznie

---

## Jak to działa (schemat)

```
Program hotelowy (chmura)
    ↓ (kolejka zleceń w bazie danych)
Przeglądarka Chrome (komputer recepcji)
    ↓ (HTTP na localhost:9977)
POSNET Bridge (ten program)
    ↓ (TCP/IP na 10.119.169.55:6666)
Kasa POSNET Trio (WiFi)
    → drukuje paragon
```

Bridge jest pośrednikiem między programem hotelowym a kasą fiskalną.
Komunikuje się z kasą protokołem POSNET Online przez TCP/IP.

---

## Codzienne użytkowanie

### Z autostartem (KROK 4):
1. Włącz komputer — bridge startuje sam w tle
2. Otwórz Chrome → https://hotel.karczma-labedz.pl
3. Pracuj normalnie — paragony drukują się automatycznie
4. Wyłącz komputer — bridge zamknie się sam

### Bez autostartu (KROK 5):
1. Włącz komputer
2. Kliknij `URUCHOM-BRIDGE.bat` (czarne okno — zminimalizuj)
3. Otwórz Chrome → https://hotel.karczma-labedz.pl
4. Pracuj normalnie
5. Wyłącz komputer

---

## Rozwiązywanie problemów

### "Paragon się nie wydrukował"
1. Uruchom `TEST-BRIDGE.bat` — sprawdź czy bridge działa
2. Jeśli nie działa — kliknij `URUCHOM-BRIDGE.bat`
3. Sprawdź czy kasa POSNET Trio jest włączona i podłączona do WiFi
4. Sprawdź czy adres IP w `bridge.env` jest poprawny

### "Bridge nie odpowiada" (TEST-BRIDGE pokazuje błąd)
1. Jeśli masz autostart — zrestartuj komputer
2. Jeśli nie — kliknij `URUCHOM-BRIDGE.bat`
3. Jeśli dalej nie działa — sprawdź czy Node.js jest zainstalowany (KROK 1)

### "Nie można połączyć się z drukarką"
1. Sprawdź czy kasa POSNET Trio jest włączona
2. Sprawdź czy kasa jest podłączona do sieci WiFi "Labedz"
3. Sprawdź adres IP drukarki — powinien być 10.119.169.55
4. Jeśli IP się zmienił — zaktualizuj `bridge.env`

### "Node.js nie jest zainstalowany"
1. Zainstaluj Node.js (KROK 1)
2. Zrestartuj komputer
3. Spróbuj ponownie

### Komputer się zrestartował / wyłączył
- **Z autostartem:** Bridge uruchomi się sam — nic nie musisz robić
- **Bez autostartu:** Trzeba ponownie kliknąć `URUCHOM-BRIDGE.bat`
