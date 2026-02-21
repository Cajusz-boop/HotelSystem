# Instrukcja synchronizacji Bistro → HotelSystem

## Podsumowanie

System synchronizuje zamówienia gastronomiczne z **KWHotel** (lokalny serwer w firmie) 
do **HotelSystem** (serwer Hetzner). Dzięki temu w zakładce "Posiłki" w rezerwacji 
automatycznie pojawiają się dania zamówione na pokój.

## Jak to działa

1. **Jest rezerwacja w HotelSystem** → obciążenie trafia bezpośrednio na rezerwację
2. **Nie ma rezerwacji** → obciążenie trafia do listy "Nieprzypisane" gdzie recepcja może je:
   - Przypisać do właściwej rezerwacji
   - Anulować (jeśli błędne)

## Architektura

```
┌─────────────────────────┐         INTERNET         ┌─────────────────────────┐
│   SERWER LOKALNY        │                          │   SERWER HETZNER        │
│   (10.119.169.20)       │                          │   (65.108.245.25)       │
│                         │                          │                         │
│   ┌─────────────────┐   │    HTTP POST (co 5 min)  │   ┌─────────────────┐   │
│   │ Baza KWHotel    │   │ ──────────────────────►  │   │ API HotelSystem │   │
│   │ (MySQL)         │   │                          │   │ /api/v1/external│   │
│   └─────────────────┘   │                          │   │ /posting        │   │
│           │             │                          │   └────────┬────────┘   │
│           ▼             │                          │            │            │
│   ┌─────────────────┐   │                          │            ▼            │
│   │ Skrypt Python   │   │                          │   ┌─────────────────┐   │
│   │ sync-bistro.py  │   │                          │   │ Baza hotel_pms  │   │
│   └─────────────────┘   │                          │   │ (MariaDB)       │   │
│                         │                          │   └─────────────────┘   │
└─────────────────────────┘                          └─────────────────────────┘
```

---

## Krok 1: Ustaw klucz API na Hetzner

### 1.1 Wygeneruj bezpieczny klucz API

```powershell
# Na swoim komputerze - wygeneruj losowy klucz
[System.Guid]::NewGuid().ToString() + "-" + [System.Guid]::NewGuid().ToString()
```

Przykładowy wynik: `a1b2c3d4-e5f6-7890-abcd-ef1234567890-f0e1d2c3-b4a5-6789-0123-456789abcdef`

### 1.2 Dodaj klucz do .env na serwerze Hetzner

```bash
ssh hetzner

# Edytuj plik .env
nano /var/www/hotel/.env

# Dodaj linię:
EXTERNAL_API_KEY=a1b2c3d4-e5f6-7890-abcd-ef1234567890-f0e1d2c3-b4a5-6789-0123-456789abcdef

# Zapisz (Ctrl+O, Enter) i wyjdź (Ctrl+X)

# Zrestartuj aplikację
pm2 restart hotel-pms
```

---

## Krok 2: Zainstaluj skrypt na serwerze lokalnym

### 2.1 Połącz się przez AnyDesk z serwerem (10.119.169.20)

### 2.2 Zainstaluj Python (jeśli nie ma)

Pobierz z: https://www.python.org/downloads/
- Podczas instalacji zaznacz "Add Python to PATH"

### 2.3 Zainstaluj biblioteki

Otwórz CMD lub PowerShell na serwerze lokalnym:

```cmd
pip install mysql-connector-python requests
```

### 2.4 Skopiuj skrypt

Utwórz folder `C:\Scripts` i skopiuj tam plik `sync-bistro-to-hetzner.py`.

### 2.5 Edytuj konfigurację w skrypcie

Otwórz `C:\Scripts\sync-bistro-to-hetzner.py` w Notatniku i zmień:

```python
CONFIG = {
    "db_host": "localhost",
    "db_port": 3306,
    "db_name": "kwhotel",
    "db_user": "admin",
    "db_password": "gracho123",  # <- hasło do bazy KWHotel
    
    "api_url": "https://hotel.karczma-labedz.pl/api/v1/external/posting",
    "api_key": "TUTAJ_WSTAW_KLUCZ_API",  # <- ten sam klucz co na Hetzner!
    
    "state_file": "C:\\Scripts\\bistro-sync-state.json",
    "log_file": "C:\\Scripts\\bistro-sync.log",
}
```

### 2.6 Przetestuj ręcznie

```cmd
cd C:\Scripts
python sync-bistro-to-hetzner.py
```

Powinieneś zobaczyć:
```
[...] [INFO] === START SYNCHRONIZACJI BISTRO ===
[...] [INFO] Połączono z bazą KWHotel
[...] [INFO] Znaleziono X nowych zamówień do wysłania
[...] [INFO] Wysyłam: pokój 004, kwota 123.45 PLN, pozycji: 3
[...] [INFO]   OK: transactionId=abc123...
```

---

## Krok 3: Ustaw automatyczne uruchamianie (co 5 minut)

### 3.1 Otwórz Harmonogram zadań

- Naciśnij `Win+R`, wpisz `taskschd.msc`, Enter

### 3.2 Utwórz nowe zadanie

1. Kliknij **"Utwórz zadanie podstawowe..."**
2. Nazwa: `Synchronizacja Bistro`
3. Wyzwalacz: **Codziennie** → ustaw godzinę startu
4. Akcja: **Uruchom program**
5. Program: `python.exe`  
   (lub pełna ścieżka: `C:\Python312\python.exe`)
6. Argumenty: `C:\Scripts\sync-bistro-to-hetzner.py`
7. Zakończ

### 3.3 Zmień wyzwalacz na "co 5 minut"

1. Znajdź zadanie w liście
2. Kliknij prawym → **Właściwości**
3. Zakładka **Wyzwalacze** → Edytuj
4. Zaznacz **"Powtarzaj zadanie co:"** → `5 minut`
5. **"przez okres:"** → `Czas nieokreślony`
6. OK

---

## Weryfikacja

### Sprawdź logi synchronizacji

Na serwerze lokalnym sprawdź plik:
```
C:\Scripts\bistro-sync.log
```

### Sprawdź czy dane pojawiają się w HotelSystem

1. Otwórz https://hotel.karczma-labedz.pl/front-office
2. Kliknij na rezerwację zameldowanego gościa
3. Przejdź do zakładki **"Posiłki"**
4. Powinny być widoczne zamówienia z Bistro

---

## Rozwiązywanie problemów

### "Brak połączenia z bazą"
- Sprawdź czy MySQL działa na serwerze lokalnym
- Sprawdź hasło w CONFIG

### "BŁĄD HTTP 401"
- Sprawdź czy klucz API jest taki sam na Hetzner i w skrypcie
- Sprawdź czy PM2 został zrestartowany po dodaniu klucza

### "BŁĄD HTTP 404 - Brak aktywnej rezerwacji"
- Gość musi być zameldowany (status CHECKED_IN) żeby obciążenie trafiło na pokój
- Numer pokoju musi się zgadzać (np. "004" vs "4")

### Skrypt nie uruchamia się automatycznie
- Sprawdź czy Python jest w PATH
- W Harmonogramie zadań → Właściwości → "Uruchom niezależnie od tego, czy użytkownik jest zalogowany"

---

## Pliki

| Plik | Lokalizacja | Opis |
|------|-------------|------|
| `sync-bistro-to-hetzner.py` | `C:\Scripts\` | Główny skrypt synchronizacji |
| `bistro-sync-state.json` | `C:\Scripts\` | Stan (ostatnie zsynchronizowane ID) |
| `bistro-sync.log` | `C:\Scripts\` | Logi synchronizacji |

---

## Kontakt

Problemy zgłaszaj do osoby zarządzającej systemem HotelSystem.
