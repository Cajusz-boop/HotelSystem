# Hotel PMS – system rezerwacji dla hoteli

Next.js 14, TypeScript, Prisma, MySQL. Panel recepcji, grafik (tape chart), meldunek, cennik, gospodarka pokojowa, finanse, raporty.

---

## Uruchomienie od zera

### 1. Zależności

```bash
npm install
```

### 2. Baza danych

- Skopiuj plik z przykładową konfiguracją:
  ```bash
  cp .env.example .env
  ```
- Otwórz `.env` i ustaw **DATABASE_URL** (MySQL), np.:
  ```
  DATABASE_URL="mysql://USER:HASLO@localhost:3306/hotel_pms"
  ```

### 3. Schemat bazy

- **Prisma (lokalnie):**
  ```bash
  npx prisma db push
  ```
  albo migracje:
  ```bash
  npx prisma migrate dev
  ```

- **PhpMyAdmin / ręcznie:**  
  Zaimportuj skrypty z katalogu `scripts/`:
  - `schema-for-phpmyadmin.sql` – pełna struktura tabel
  - `migration-room-active-for-sale.sql` – jeśli baza była tworzona wcześniej (dodanie kolumny `activeForSale` w tabeli `Room`)
  - `seed-for-phpmyadmin.sql` – opcjonalne dane startowe

### 4. Seed (opcjonalnie)

```bash
npm run db:seed
```

### 5. Uruchomienie

- **Tryb deweloperski:**
  ```bash
  npm run dev
  ```
  Aplikacja: http://localhost:3000

- **Produkcja:**
  ```bash
  npm run build
  npm start
  ```

---

## Skrypty

| Skrypt | Opis |
|--------|------|
| `npm run dev` | Serwer deweloperski |
| `npm run build` | Build produkcyjny |
| `npm start` | Uruchomienie po buildzie |
| `npm run db:generate` | Generowanie klienta Prisma |
| `npm run db:push` | Zastosowanie schematu do bazy (bez migracji) |
| `npm run db:migrate` | Migracje (dev) |
| `npm run db:seed` | Seed danych |
| `npm run test:e2e` | Testy E2E (Playwright) |

---

## Moduły

- **Panel** – dashboard (VIP Arrival, Dirty Rooms)
- **Recepcja** – grafik (tape chart), drag & drop, undo/redo, Room Guard
- **Meldunek** – formularz gościa, MRZ, Parse & Forget
- **Pokoje** – dodawanie/usuwanie pokoi, wycofywanie i przywracanie do sprzedaży
- **Cennik** – stawki, typy pokoi, stawki sezonowe, kody stawek
- **Gospodarka** – Housekeeping (statusy CLEAN/DIRTY/OOO), offline-first
- **Finanse** – Night Audit, Blind Drop, Void, zaliczki
- **Raporty** – raport dobowy (Management Report)

---

## Wdrożenie produkcyjne

### Hetzner (główny serwer)

**Pierwszy raz na nowym komputerze:**
```powershell
.\scripts\setup-ssh.ps1
```

Skrypt skonfiguruje SSH. Musisz też **ręcznie skopiować klucz** `~/.ssh/hetzner_key` z komputera, który już ma dostęp.

**Deploy:**
```powershell
.\scripts\deploy-to-hetzner.ps1
```

### MyDevil (backup)

Zobacz plik `DEPLOY-MYDEVIL.md`.
