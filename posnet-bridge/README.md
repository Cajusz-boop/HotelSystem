# POSNET Trio Bridge v2.0 (Windows)

Usługa pośrednicząca (bridge) między aplikacją hotelową (Next.js) a kasą fiskalną **POSNET Trio**.

Bridge komunikuje się z drukarką POSNET Trio przez **TCP/IP** używając natywnego **protokołu POSNET Online** (STX/ETX, CRC16-CCITT).

## Architektura

```
Program hotelowy (MyDevil, chmura)
    ↓ kolejka FiscalJob w bazie danych
Przeglądarka Chrome (komputer recepcji)
    ↓ FiscalRelay component → HTTP localhost:9977
POSNET Bridge (ten program, Node.js)
    ↓ TCP/IP → 10.119.169.55:6666
Kasa POSNET Trio (WiFi)
    → drukuje paragon/fakturę/raport
```

## Uruchomienie

```bash
npm run posnet:bridge
```

Bridge wystartuje na `http://127.0.0.1:9977`.

## Endpointy

| Metoda | Endpoint | Opis |
|--------|----------|------|
| `GET` | `/health` | Status bridge'a + status drukarki (data/czas) |
| `POST` | `/fiscal/print` | Druk paragonu fiskalnego |
| `POST` | `/fiscal/invoice` | Druk faktury VAT na kasie |
| `POST` | `/fiscal/report/x` | Raport X (informacyjny, nie zamyka dnia) |
| `POST` | `/fiscal/report/z` | Raport Z (dobowy, zamyka dzień) |
| `POST` | `/fiscal/report/periodic` | Raport okresowy/miesięczny |
| `POST` | `/fiscal/storno` | Storno (zwrot towaru) |
| `POST` | `/fiscal/cancel` | Anuluj bieżącą transakcję |

## Konfiguracja (ENV)

| Zmienna | Domyślnie | Opis |
|---------|-----------|------|
| `POSNET_BRIDGE_MODE` | `tcp` | Tryb pracy: `tcp` (drukarka) lub `spool` (pliki JSON) |
| `POSNET_PRINTER_HOST` | `10.119.169.55` | Adres IP drukarki POSNET Trio |
| `POSNET_PRINTER_PORT` | `6666` | Port TCP drukarki |
| `POSNET_PRINTER_TIMEOUT` | `5000` | Timeout połączenia TCP (ms) |
| `POSNET_BRIDGE_PORT` | `9977` | Port HTTP bridge'a |
| `FISCAL_POSNET_API_KEY` | (brak) | Klucz API (opcjonalny) |
| `FISCAL_POSNET_SPOOL_DIR` | `posnet-bridge/spool/` | Katalog spool (tryb spool) |

## Tryby pracy

### Tryb TCP (produkcja)

Bridge łączy się z drukarką POSNET Trio przez TCP/IP i wysyła komendy protokołu POSNET Online:

- `trinit` / `trline` / `trend` — druk paragonu
- `trfvinit` / `trfvline` / `trfvend` — druk faktury VAT
- `trnipset` — NIP nabywcy na paragonie
- `dailyrep` / `dailyrepx` — raport Z / X
- `periodicrep` — raport okresowy
- `prncancel` — anulowanie transakcji
- `rtcget` — health check (odczyt daty/czasu)

### Tryb SPOOL (testy)

Bridge zapisuje zlecenia jako pliki JSON do katalogu `spool/`. Przydatne do testowania integracji bez fizycznej kasy.

Ustaw `POSNET_BRIDGE_MODE=spool`.

## Protokół POSNET Online

Implementacja oparta na specyfikacji POT-I-DEV-37 v5978 (2.11.2023).

- **Ramka:** `STX <komenda> TAB <parametry...> TAB #CRC16 ETX`
- **CRC:** CRC16-CCITT (poly=0x1021, init=0x0000)
- **Kodowanie:** Windows-1250
- **Port TCP:** 6666 (domyślny dla POSNET Online)

## Pliki

| Plik | Opis |
|------|------|
| `server.mjs` | Serwer HTTP bridge'a |
| `posnet-protocol.mjs` | Implementacja protokołu POSNET (CRC, ramki, komendy) |

## Instalacja na komputerze recepcji

Patrz: `posnet-bridge-installer/INSTRUKCJA.md`
