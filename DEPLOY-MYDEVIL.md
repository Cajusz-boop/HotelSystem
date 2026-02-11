# Wdrożenie Hotel PMS na mydevil.net (chmura)

Aplikacja łączy się z bazą MySQL na mydevil (`m14753_hotel_system_rezerwacji`). Baza jest już utworzona i dostępna z serwerów mydevil (PhpMyAdmin działa).

## Jedna komenda: build + synchronizacja (CMD / PowerShell)

Z katalogu projektu uruchom:

- **PowerShell:** `.\scripts\deploy-to-mydevil.ps1`
- **CMD:** `scripts\deploy-to-mydevil.bat`

Skrypt: generuje Prisma (native + freebsd14), buduje Next.js, kopiuje static, wysyła **app.js** i **.next** na serwer przez **scp**.

**Porównanie lokal vs chmura:** `.\scripts\compare-local-vs-remote.ps1` — sprawdza, czy pliki (app.js + .next) na serwerze są takie same jak lokalnie (liczby plików i rozmiary). Wymaga SSH (wpisz hasło gdy skrypt poprosi). Przy `scp` wpiszesz hasło SSH (jeśli nie masz klucza). Na końcu na serwerze (SSH) uruchom: `devil www restart hotel.karczma-labedz.pl`.

---

## Wymagania

- Konto mydevil z obsługą Node.js
- Domena skonfigurowana w panelu (Strony WWW → dodana strona typu **Node.js**)
- Dostęp SSH (opcjonalnie, ułatwia wdrożenie)

## 1. Konfiguracja wstępna (SSH, raz)

Zaloguj się SSH i wykonaj (zastąp `domena` swoją domeną):

```bash
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:~/bin:$PATH' >> $HOME/.bash_profile && source $HOME/.bash_profile
```

Wersja Node (np. 20):

```bash
mkdir -p ~/bin && ln -fs /usr/local/bin/node20 ~/bin/node && ln -fs /usr/local/bin/npm20 ~/bin/npm && source $HOME/.bash_profile
```

## 2. Zmienna DATABASE_URL (baza w chmurze)

W `~/.bash_profile` dopisz (użyj danych z `.env.staging`):

```bash
export DATABASE_URL="mysql://m14753_hotel_rez:HASLO@mysql5.mydevil.net:3306/m14753_hotel_system_rezerwacji"
```

Potem: `source $HOME/.bash_profile`.

(W panelu DevilWEB nie da się ustawić zmiennych dla Node – tylko przez SSH / plik.)

## 3. Umieszczenie projektu na serwerze

Główny katalog aplikacji Node na mydevil to:

```text
/usr/home/TWOJ_LOGIN/domains/TWOJA_DOMENA/public_nodejs
```

**Opcja A – upload + build na serwerze (zalecane)**

1. Wgraj cały projekt (FTP / Menedżer plików) do `public_nodejs` (np. jako podkatalog, potem przenieś pliki do `public_nodejs`).
2. SSH w katalog projektu:
   ```bash
   cd ~/domains/TWOJA_DOMENA/public_nodejs
   npm install
   npm run build
   ```
3. Skopiuj pliki statyczne Next.js do standalone (katalog musi istnieć – tworzy go build):
   ```bash
   mkdir -p .next/standalone/.next
   cp -r .next/static .next/standalone/.next/
   ```

**Opcja B – build lokalnie, upload gotowego builda (zalecane, gdy build na serwerze się nie udaje)**

Gdy na serwerze `npm run build` kończy się błędem (np. 404 SWC), zbuduj projekt na swoim PC i wgraj cały katalog z gotowym `.next`.

1. **Lokalnie (Windows, w katalogu projektu):**
   ```powershell
   npm run build
   mkdir -p .next\standalone\.next
   xcopy /E /I .next\static .next\standalone\.next\static
   ```
2. **Wgraj na serwer** (FTP / Menedżer plików) do `domains/hotel.karczma-labedz.pl/public_nodejs`:
   - plik **`app.js`** (z głównego katalogu projektu),
   - cały katalog **`.next`** (wraz z `.next/standalone` i `.next/static`).
   Nie kasuj istniejących na serwerze: `package.json`, `node_modules`, `prisma` – zostaw je (potrzebne do działania).
3. **Na serwerze** tylko restart (bez `npm run build`):
   ```bash
   devil www restart hotel.karczma-labedz.pl
   ```

## 4. Plik startowy dla Passenger

Mydevil uruchamia aplikację przez plik `app.js` w `public_nodejs`. W repozytorium jest już `app.js`, który uruchamia serwer Next.js z builda standalone – upewnij się, że ten plik jest w `public_nodejs` (jak w kroku 3).

Usuń domyślny `index.html` w `public`, jeśli istnieje:

```bash
rm -f ~/domains/TWOJA_DOMENA/public_nodejs/public/index.html
```

## 5. Restart aplikacji

- **Panel:** DevilWEB → Strony WWW → Twoja domena → restart / odśwież.
- **SSH:** `devil www restart TWOJA_DOMENA`

## 6. Weryfikacja

Wejdź na `https://TWOJA_DOMENA`. Aplikacja powinna działać i korzystać z bazy `m14753_hotel_system_rezerwacji` na `mysql5.mydevil.net` (ta sama baza co w PhpMyAdmin).

---

**Uwagi**

- Logi błędów: `~/domains/TWOJA_DOMENA/logs/error.log`
- Po 24 h bez ruchu aplikacja może być wyłączona i uruchomi się przy pierwszym wejściu (zgodnie z [dokumentacją mydevil](https://wiki.mydevil.net/Nodejs))
- Zmiany w schemacie bazy: zob. sekcję **Migracje bazy** poniżej.

---

## Migracje bazy (Prisma Migrate)

Aplikacja używa Prisma z `engineType = "client"` i adapterem MariaDB – **nie trzeba** ustawiać `binaryTargets` (silnik działa na FreeBSD w Node.js).

### Migracja: kolumna `Reservation.companyId` (błąd P2022)

Jeśli na produkcji występuje błąd **P2022** (_The column Reservation.companyId does not exist_), trzeba dodać tę kolumnę w bazie.

#### Krok 1 – Lokalnie (Windows)

1. W katalogu projektu upewnij się, że `.env` ma poprawny `DATABASE_URL` (lokalna MySQL/MariaDB).
2. Zastosuj migrację (dodanie `companyId` do `Reservation`):
   ```powershell
   npx prisma migrate deploy
   ```
   Prisma utworzy tabelę `_prisma_migrations` (jeśli jej nie ma) i wykona migrację `20260211100000_add_reservation_company_id`.
3. **Jeśli kolumna `companyId` już istnieje** (np. po wcześniejszym `prisma db push`) i `migrate deploy` zgłasza błąd, oznacz migrację jako zastosowaną:
   ```powershell
   npx prisma migrate resolve --applied 20260211100000_add_reservation_company_id
   ```
4. Wygeneruj klienta (jeśli potrzeba): `npm run db:generate`.

#### Krok 2 – Produkcja (MyDevil / FreeBSD)

Z Twojego PC nie ma połączenia do bazy na mydevil (P1001), więc migrację uruchamiasz **na serwerze** lub w panelu.

**Opcja A – SSH: migracja z serwera (zalecane)**

1. Upewnij się, że na serwerze jest katalog `prisma` z `schema.prisma` i `prisma/migrations`. Skrypt `deploy-to-mydevil.ps1` kopiuje `prisma` razem z `app.js` i `.next` – po deployu folder `prisma` jest na serwerze.
2. Zaloguj się SSH do mydevil i przejdź do katalogu aplikacji:
   ```bash
   cd ~/domains/hotel.karczma-labedz.pl/public_nodejs
   ```
3. Ustaw `DATABASE_URL` (jeśli nie ma w `~/.bash_profile`):
   ```bash
   export DATABASE_URL="mysql://m14753_hotel_rez:HASLO@mysql5.mydevil.net:3306/m14753_hotel_system_rezerwacji"
   ```
4. Uruchom wdrożenie migracji (zastosuje tylko niezastosowane migracje):
   ```bash
   npx prisma migrate deploy
   ```
5. Zrestartuj aplikację:
   ```bash
   devil www restart hotel.karczma-labedz.pl
   ```

**Opcja B – PhpMyAdmin (gdy nie ma SSH lub migracje nie są na serwerze)**

1. W panelu mydevil wejdź w **MySQL** (PhpMyAdmin) i wybierz bazę `m14753_hotel_system_rezerwacji`.
2. Otwórz zakładkę **SQL** i wklej poniższy skrypt (dodanie kolumny, indeksu i klucza obcego), potem wykonaj:
   ```sql
   -- Dodanie kolumny companyId do Reservation
   ALTER TABLE `Reservation` ADD COLUMN `companyId` VARCHAR(191) NULL;
   CREATE INDEX `Reservation_companyId_idx` ON `Reservation`(`companyId`);
   ALTER TABLE `Reservation` ADD CONSTRAINT `Reservation_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
   ```
4. Jeśli później na serwerze będziesz używać `prisma migrate deploy`, po wykonaniu powyższego SQL zaloguj się SSH i oznacz migrację jako zastosowaną (żeby Prisma jej ponownie nie uruchamiała):
   ```bash
   cd ~/domains/hotel.karczma-labedz.pl/public_nodejs
   export DATABASE_URL="mysql://..."
   npx prisma migrate resolve --applied 20260211100000_add_reservation_company_id
   ```

Po dodaniu kolumny (Opcja A lub B) zrestartuj aplikację; błąd P2022 powinien zniknąć.
