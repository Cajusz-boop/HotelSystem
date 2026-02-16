# Bridge Symplex Bistro → API postingu (dania na pokój)

Skrypt przetwarzający **pliki z eksportu** (Symplex Bistro) i wysyłający obciążenia na pokój do API systemu hotelowego (`POST /api/v1/external/posting`).

Obciążenia (z listą dań) pojawiają się w systemie hotelowym w zakładce **Posiłki** przy rezerwacji.

## Kiedy używać

- Kelner w Bistro nabija rachunek na pokój.
- Bistro eksportuje zamknięte rachunki „na pokój" do wskazanego folderu.
- Bridge okresowo czyta ten folder, parsuje pliki i wywołuje API hotelu.
- W systemie hotelowym w rezerwacji gościa widać co jadł, kiedy i za ile.

## Konfiguracja (zmienne środowiska)

| Zmienna | Opis |
|--------|------|
| `POSTING_URL` | Pełny URL API postingu, np. `https://twoj-hotel.example.com/api/v1/external/posting` |
| `EXTERNAL_API_KEY` | Klucz API (taki sam jak w `.env` aplikacji hotelowej) |
| `SYMPLEX_WATCH_DIR` | Folder, z którego bridge czyta pliki (np. eksport Bistro) |
| `SYMPLEX_PROCESSED_DIR` | Folder na przetworzone pliki (domyślnie: `SYMPLEX_WATCH_DIR/processed`) |

## Formaty pliku wejściowego

### Format 1: Prosty (tylko kwota)

```
roomNumber;amount;description
```

Przykład:

```
101;89.50;Restauracja obiad
203;24.00;Bar
```

### Format 2: Rozszerzony (z pozycjami dań)

```
roomNumber;amount;receiptNumber;cashierName;item1Name:qty:price|item2Name:qty:price|...
```

Przykład:

```
101;89.50;R-2024-0142;Anna K.;Zupa dnia:1:15.00|Kotlet schabowy:1:45.00|Kawa:2:8.00|Deser:1:13.50
203;24.00;R-2024-0143;Tomek M.;Piwo:2:12.00
```

W tym formacie system hotelowy otrzymuje pełną listę dań — recepcjonista widzi w zakładce "Posiłki" dokładnie co gość zamówił.

### Rozpoznawanie formatu

Bridge automatycznie rozpoznaje format:
- 5+ pól i pole piąte zawiera `:` → format rozszerzony
- inaczej → format prosty

## Konfiguracja Bistro (po stronie Symplex)

W Symplex Bistro trzeba skonfigurować eksport zamkniętych rachunków „na pokój" do wskazanego folderu. Dopasuj format eksportu w konfiguracji Bistro lub Small Business:

1. **Skontaktuj się z dealerem Symplex** i poproś o ustawienie eksportu rachunków „na pokój" do folderu `SYMPLEX_WATCH_DIR`.
2. Ustal format eksportu (prosty lub rozszerzony z pozycjami).
3. Jeśli Bistro eksportuje w **formacie EDI Symplex** ([opis](http://symplex.eu/?q=node%2F80)), dopisz parser sekcji `[Dokument]`/`[PozX]` w `run.mjs`.

## Uruchomienie

Jednorazowe przetworzenie folderu:

```bash
npm run symplex:bridge
```

lub:

```bash
node symplex-bridge/run.mjs
```

Zaplanowane (np. co minutę) – w **Windows (Harmonogram zadań)**:

```bash
node c:\sciezka\do\HotelSystem\symplex-bridge\run.mjs
```

## Zabezpieczenia

- Używaj `EXTERNAL_API_KEY` i trzymaj go tylko po stronie bridge'a i `.env` hotelu.
- `POSTING_URL` powinien być HTTPS w produkcji.
- Folder `SYMPLEX_WATCH_DIR` powinien być dostępny tylko dla usługi bridge.
