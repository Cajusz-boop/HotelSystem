# Serwer Lokalny HotelSystem

Backup/failover serwer na wypadek braku internetu.

## Dane dostępowe

| Co | Wartość |
|----|---------|
| **IP serwera** | `10.119.169.20` |
| **URL aplikacji** | `http://10.119.169.20:3000` lub `http://localhost:3000` |
| **MySQL user** | `root` |
| **MySQL pass** | `root123` |
| **Baza danych** | `hotel_pms` |
| **Lokalizacja kodu** | `E:\HotelSystem` |

## Zarządzanie aplikacją

### Sprawdzenie statusu
```cmd
pm2 list
```

### Logi aplikacji
```cmd
pm2 logs hotel-pms
```

### Restart aplikacji
```cmd
pm2 restart hotel-pms
```

### Zatrzymanie
```cmd
pm2 stop hotel-pms
```

## Aktualizacja kodu

Po zmianach w głównym repozytorium, na serwerze lokalnym uruchom:

```cmd
E:\HotelSystem\scripts\aktualizuj-serwer-lokalny.bat
```

Skrypt automatycznie:
1. Pobiera zmiany z GitHub (`git pull`)
2. Instaluje nowe biblioteki (`npm install`)
3. Generuje Prisma Client
4. Buduje aplikację
5. Restartuje PM2

## Synchronizacja bazy danych

### Kierunek: Hetzner (produkcja) → Lokalny

```cmd
E:\HotelSystem\scripts\sync-db-from-hetzner.bat
```

**Kiedy używać:**
- Po przywróceniu internetu (żeby mieć aktualne dane z produkcji)
- Przed planowaną przerwą w internecie

**UWAGA:** To nadpisuje dane na serwerze lokalnym!

## Kiedy używać serwera lokalnego

1. **Brak internetu** - wejdź na `http://10.119.169.20:3000` zamiast `hotel.karczma-labedz.pl`
2. **Awaria głównego serwera** - serwer lokalny ma kopię bazy

## Ważne informacje

- Serwer uruchamia się automatycznie po restarcie Windows (Task Scheduler)
- Baza lokalna to KOPIA - zmiany zrobione lokalnie NIE trafiają automatycznie na Hetzner
- Po pracy offline należy ręcznie przenieść dane (eksport/import) lub podjąć decyzję które dane zachować

## SSH do Hetzner (z serwera lokalnego)

```cmd
ssh root@65.108.245.25
```

Klucz SSH: `C:\Users\Admin\.ssh\id_ed25519`

## Troubleshooting

### Aplikacja nie działa
```cmd
pm2 list
pm2 logs hotel-pms --lines 50
```

### MySQL nie działa
Sprawdź czy usługa WAMP MySQL jest uruchomiona:
```cmd
net start wampmysqld64
```

### Port 3000 zajęty
```cmd
netstat -ano | findstr :3000
taskkill /PID <numer_pid> /F
pm2 restart hotel-pms
```
