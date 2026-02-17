# Integracja z kasą fiskalną

Program może wysyłać paragony i faktury do kasy fiskalnej przy każdej zarejestrowanej transakcji (obciążenie pokoju, zaliczka, faktura VAT).

## Szybki start — POSNET Trio (3 kroki)

### Krok 1. Ustaw zmienne w `.env`

```env
FISCAL_ENABLED=true
FISCAL_DRIVER=posnet
FISCAL_POSNET_MODEL=trio
FISCAL_POSNET_ENDPOINT=http://127.0.0.1:9977/fiscal/print
```

Po zmianie `.env` zrestartuj serwer aplikacji (`npm run dev` lub restart na produkcji).

### Krok 2. Uruchom bridge POSNET

W osobnym terminalu:

```bash
npm run posnet:bridge
```

Bridge wystartuje na `http://127.0.0.1:9977`. Powinien być uruchomiony cały czas gdy kasa ma działać.

### Krok 3. Przetestuj połączenie

Wejdź w **Ustawienia → Kasa fiskalna** (lub `/ustawienia/kasa-fiskalna`) i kliknij **Testuj połączenie**. Zielony status = wszystko działa.

Alternatywnie w przeglądarce: `http://127.0.0.1:9977/health`

---

## Co drukuje się automatycznie

Po włączeniu (`FISCAL_ENABLED=true`) system automatycznie drukuje:

| Zdarzenie | Dokument | Kiedy |
|-----------|----------|-------|
| Obciążenie pokoju (posting) | **Paragon** | Każda transakcja z API `/api/v1/external/posting` (POS, restauracja) |
| Rejestracja zaliczki | **Paragon** | Przy dodaniu zaliczki w Finansach |
| Wystawienie faktury VAT | **Faktura** | Przy wystawieniu faktury z poziomu rezerwacji (POSNET Trio obsługuje faktury) |

Błąd kasy (np. brak połączenia) **nie cofa** transakcji — transakcja zostaje zapisana, błąd jest logowany.

## Obsługiwane operacje

| Operacja | Endpoint bridge | Opis |
|----------|----------------|------|
| Paragon | `POST /fiscal/print` | Druk paragonu fiskalnego |
| Faktura | `POST /fiscal/invoice` | Druk faktury na kasie (POSNET Trio obsługuje) |
| Raport X | `POST /fiscal/report/x` | Raport informacyjny (nie zamyka dnia) |
| Raport Z | `POST /fiscal/report/z` | Raport dobowy (zamyka dzień, wymagany prawem) |
| Raport okresowy | `POST /fiscal/report/periodic` | Zestawienie raportów Z za okres |
| Storno | `POST /fiscal/storno` | Anulowanie paragonu |
| Health check | `GET /health` | Diagnostyka bridge'a |

## Konfiguracja `.env` — pełna lista

### Podstawowe

```env
# Włączenie kasy fiskalnej
FISCAL_ENABLED=true

# Sterownik: mock | posnet | novitus | elzab
FISCAL_DRIVER=posnet

# NIP hotelu (opcjonalnie)
FISCAL_TAX_ID=1234567890

# Nazwa punktu sprzedaży (opcjonalnie)
FISCAL_POINT_NAME=Recepcja
```

### POSNET (przez HTTP bridge)

```env
# Model drukarki POSNET:
#   trio        - POSNET Trio (terminal+drukarka+kasa) ← ZALECANY
#   thermal_hs  - POSNET Thermal HS (domyślny)
#   ergo        - POSNET Ergo (48 znaków, papier 80mm)
#   neo         - POSNET NEO (57 znaków, e-paragony)
#   neo_xl      - POSNET NEO XL (80 znaków)
#   revo        - POSNET Revo (pełna obsługa KSeF)
#   fv          - POSNET FV (dedykowana do faktur, A4)
#   thermal     - POSNET Thermal (podstawowa)
#   bingo       - POSNET Bingo (przenośna)
#   bingo_hs    - POSNET Bingo HS (przenośna, Bluetooth)
#   mobile_hs   - POSNET Mobile HS (mobilna)
#   temo_hs     - POSNET Temo HS (ekonomiczna)
#   custom      - Niestandardowy (parametry z env)
FISCAL_POSNET_MODEL=trio

# Endpoint bridge'a
FISCAL_POSNET_ENDPOINT=http://127.0.0.1:9977/fiscal/print

# Klucz API (opcjonalnie – zabezpieczenie bridge'a)
# FISCAL_POSNET_API_KEY=twoj-klucz

# Timeout w ms (domyślnie: 8000)
# FISCAL_POSNET_TIMEOUT_MS=8000
```

### Novitus (bezpośrednio TCP/IP)

```env
FISCAL_DRIVER=novitus
FISCAL_NOVITUS_HOST=192.168.1.100
FISCAL_NOVITUS_PORT=9100
# FISCAL_NOVITUS_TIMEOUT_MS=5000
```

### Elzab (bezpośrednio TCP/IP)

```env
FISCAL_DRIVER=elzab
FISCAL_ELZAB_HOST=192.168.1.101
FISCAL_ELZAB_PORT=9100
# FISCAL_ELZAB_TIMEOUT_MS=5000
```

## POSNET Trio — parametry modelu

| Parametr | Wartość |
|----------|---------|
| Typ | Terminal + drukarka + kasa (3w1) |
| Szerokość linii | 48 znaków |
| Protokół | v2 (nowszy) |
| Max pozycji na paragonie | 300 |
| Obsługa faktur | Tak |
| e-Paragony (KSeF) | Tak |
| NIP na paragonie | Tak |
| Kody kreskowe / QR | Tak |
| Grafika / logo | Tak |
| Nagłówek | do 8 linii |
| Stopka | do 6 linii |

## Architektura — jak to działa

```
┌──────────────────┐     HTTP/JSON      ┌──────────────────┐     USB/COM/LAN     ┌──────────────┐
│  Aplikacja       │ ──────────────────→ │  Bridge POSNET   │ ──────────────────→ │  POSNET Trio  │
│  (Next.js)       │  localhost:9977     │  (Node.js)       │  sterownik/OPOS     │  (urządzenie) │
└──────────────────┘                     └──────────────────┘                     └──────────────┘
```

1. Aplikacja hotelowa wysyła JSON z paragonem/fakturą do bridge'a.
2. Bridge tłumaczy JSON na komendy kasy i komunikuje się z urządzeniem.
3. Bridge zwraca wynik (numer paragonu/faktury lub błąd).

## Tryb pracy bridge'a

### Tryb SPOOL (domyślny)

Aktualnie bridge działa w trybie **spool** — przyjmuje zlecenia i zapisuje je jako pliki JSON do `posnet-bridge/spool/`. To pozwala przetestować całą integrację end-to-end bez fizycznej kasy.

### Tryb druku (produkcja)

Aby bridge faktycznie drukował na urządzeniu POSNET Trio:

1. Zainstaluj sterownik POSNET na komputerze (ze strony producenta: https://www.posnet.com.pl/sterowniki)
2. Podłącz kasę przez USB, COM lub LAN
3. Rozszerz `posnet-bridge/server.mjs` o wywołania SDK/OPOS producenta

W pliku `posnet-bridge/server.mjs` w miejscach oznaczonych `spoolWrite(...)` zamień zapis do pliku na wywołanie sterownika POSNET.

## Tryb testowy (mock)

```env
FISCAL_ENABLED=true
FISCAL_DRIVER=mock
```

Sterownik `mock` loguje paragony w konsoli serwera bez wysyłania do żadnego urządzenia. Przydatny do testowania integracji.

## Rozszerzenie o inne kasy

W katalogu `lib/fiscal/`:

- **types.ts** — typy i interfejs `FiscalDriver`
- **mock-driver.ts** — sterownik symulacyjny
- **posnet-http-driver.ts** — sterownik POSNET przez HTTP bridge
- **posnet-models.ts** — konfiguracja modeli POSNET (Trio, NEO, Ergo, itp.)
- **novitus-driver.ts** — sterownik Novitus (TCP/IP)
- **elzab-driver.ts** — sterownik Elzab (TCP/IP)
- **index.ts** — wybór sterownika i eksport funkcji

## Strony w programie

| Strona | Opis |
|--------|------|
| `/ustawienia/kasa-fiskalna` | Konfiguracja kasy — status, test połączenia, instrukcja |
| `/ustawienia/paragon` | Szablon paragonu — nagłówek, stopka, nazwy pozycji |
| `/finance` | Finanse — sekcja "Kasa fiskalna" ze statusem i linkiem do konfiguracji |
