# Wdrozenie Hotel PMS na mydevil.net

Aplikacja laczy sie z baza MySQL na mydevil (`m14753_hotel_system_rezerwacji`).

## Szybki deploy (jedna komenda)

Z katalogu projektu:

```powershell
.\scripts\deploy-to-mydevil.ps1
```

Skrypt automatycznie:
1. Generuje Prisma client
2. Buduje Next.js (standalone)
3. Generuje SQL diff dla schematu bazy (z `IF NOT EXISTS`)
4. Usuwa stary `.next` na serwerze (zapobiega konfliktom starych plikow)
5. Pakuje i wysyla ZIP na serwer (app.js + .next/standalone + prisma + SQL)
6. Wykonuje migracje bazy (`mysql --force`) i restartuje aplikacje

Po zakonczeniu strona jest dostepna: https://hotel.karczma-labedz.pl

---

## Konfiguracja (jednorazowo)

### 1. Plik .env.deploy

Utworz plik `.env.deploy` w katalogu projektu (jest w `.gitignore` — nie trafi do repo):

```
DEPLOY_SSH_USER=karczma-labedz
DEPLOY_SSH_HOST=panel5.mydevil.net
DEPLOY_REMOTE_PATH=domains/hotel.karczma-labedz.pl/public_nodejs
DEPLOY_DOMAIN=hotel.karczma-labedz.pl

# Produkcyjna baza MySQL
DEPLOY_DB_HOST=mysql5.mydevil.net
DEPLOY_DB_USER=m14753_hotel_rez
DEPLOY_DB_PASS=TWOJE_HASLO
DEPLOY_DB_NAME=m14753_hotel_system_rezerwacji
DEPLOY_DATABASE_URL=mysql://m14753_hotel_rez:TWOJE_HASLO@mysql5.mydevil.net/m14753_hotel_system_rezerwacji
```

### 2. Klucz SSH (opcjonalnie, eliminuje wpisywanie hasla)

Bez klucza SSH skrypt pyta o haslo 3 razy (usun .next, wyslij ZIP, migracja+restart).
Z kluczem — zero pytan.

**Generowanie klucza (PowerShell, raz):**

```powershell
ssh-keygen -t ed25519 -f $env:USERPROFILE\.ssh\mydevil_key -N '""'
```

**Kopiowanie klucza na serwer:**

```powershell
type $env:USERPROFILE\.ssh\mydevil_key.pub | ssh karczma-labedz@panel5.mydevil.net "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
```

(Wpisz haslo SSH po raz ostatni.)

**Konfiguracja SSH (plik `%USERPROFILE%\.ssh\config`):**

```
Host mydevil panel5.mydevil.net
  HostName panel5.mydevil.net
  User karczma-labedz
  IdentityFile ~/.ssh/mydevil_key
```

Po tym `ssh mydevil` i `scp ... mydevil:...` dzialaja bez hasla.

### 3. Konfiguracja serwera (SSH, raz)

Zaloguj sie SSH i wykonaj:

```bash
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:~/bin:$PATH' >> $HOME/.bash_profile && source $HOME/.bash_profile
```

Wersja Node (np. 20):

```bash
mkdir -p ~/bin && ln -fs /usr/local/bin/node20 ~/bin/node && ln -fs /usr/local/bin/npm20 ~/bin/npm && source $HOME/.bash_profile
```

### 4. Zmienna DATABASE_URL na serwerze

W `~/.bash_profile` dopisz:

```bash
export DATABASE_URL="mysql://m14753_hotel_rez:HASLO@mysql5.mydevil.net:3306/m14753_hotel_system_rezerwacji"
```

Potem: `source $HOME/.bash_profile`.

Oraz upewnij sie, ze plik `.env` w `public_nodejs` na serwerze zawiera to samo `DATABASE_URL`.

---

## Co robi skrypt krok po kroku

```
deploy-to-mydevil.ps1
  |
  1. npx prisma generate
  2. npm run build  (postbuild kopiuje static + .prisma do standalone)
  3. npx prisma migrate diff --from-empty --script  ->  _deploy_schema_diff.sql
  |   (CREATE TABLE IF NOT EXISTS — bezpieczne, nie nadpisuje istniejacych tabel)
  |
  4. ssh: rm -rf .next  (usuwa stary build — kluczowe!)
  5. ZIP + scp + unzip  (pelny .next/standalone + app.js + prisma + SQL)
  6. ssh: mysql --force < SQL  (dodaje nowe tabele/kolumny, ignoruje bledy duplikatow)
  |  ssh: devil www restart
  |
  -> Strona dziala
```

### Dlaczego usuwamy stary .next?

SCP/unzip **doklada** pliki do istniejacego katalogu — nie usuwa starych.
Jesli stary build mial plik `webpack-runtime.js` (8 KB) a nowy ma inny (1.5 KB),
stary plik zostaje i aplikacja sie crashuje (`MODULE_NOT_FOUND`).
Usuniecie `.next` przed wgraniem nowego builda eliminuje ten problem.

### Dlaczego mysql --force zamiast prisma db push?

Prisma `db push` wymaga binarki `schema-engine`, ktora nie istnieje dla FreeBSD14.
Dlatego generujemy SQL lokalnie (Windows) i wykonujemy go na serwerze przez `mysql`.
Flaga `--force` sprawia, ze bledy typu "table already exists" sa ignorowane.

---

## Troubleshooting

### Internal Server Error po deploy

```bash
ssh karczma-labedz@panel5.mydevil.net
tail -30 ~/domains/hotel.karczma-labedz.pl/logs/error.log
```

### Blad P2022 (ColumnNotFound)

Baza nie ma kolumny, ktora Prisma oczekuje. Rozwiazanie: wygeneruj ALTER TABLE lokalnie
i wykonaj na serwerze. Skrypt deployu robi to automatycznie (krok 3 + 6).

Jesli musisz recznie:

```powershell
# Lokalnie (Windows):
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > fix.sql
# Edytuj fix.sql: zamien CREATE TABLE na CREATE TABLE IF NOT EXISTS
# Wyslij i wykonaj:
scp fix.sql karczma-labedz@panel5.mydevil.net:domains/hotel.karczma-labedz.pl/public_nodejs/
ssh karczma-labedz@panel5.mydevil.net "cd ~/domains/hotel.karczma-labedz.pl/public_nodejs && mysql --force -h mysql5.mydevil.net -u m14753_hotel_rez -pHASLO m14753_hotel_system_rezerwacji < fix.sql"
```

### Gateway Timeout (504)

Aplikacja sie uruchamia wolno. Poczekaj 30s i odswiez. Passenger na MyDevil ma timeout ~60s.

### Seed (pierwszy deploy — pusta baza)

Po pierwszym deployu tabela `User` jest pusta. Dodaj admina przez PhpMyAdmin (SQL):

```sql
INSERT INTO `User` (`id`, `email`, `name`, `passwordHash`, `role`, `createdAt`, `updatedAt`, `totpEnabled`)
VALUES ('admin-001', 'admin@hotel.local', 'Administrator',
  '$2b$10$9Tc1XDhVhuG7NBWD9kcn3eWhXHSsfpwx9s/bJQUMpwuAVDgqd2bru',
  'MANAGER', NOW(), NOW(), 0);
```

Haslo: `Admin1234#`. Przy pierwszym logowaniu aplikacja poprosi o zmiane.

---

## Struktura na serwerze

```
~/domains/hotel.karczma-labedz.pl/
  public_nodejs/
    app.js              <- punkt wejscia Passenger
    .env                <- DATABASE_URL produkcji
    .next/
      standalone/       <- pelny build Next.js (server.js + node_modules + .next)
    prisma/
      schema.prisma     <- schemat bazy
    node_modules/       <- zaleznosci (juz na serwerze, nie wysylane przy deploy)
    package.json        <- juz na serwerze
  logs/
    error.log           <- logi bledow
```

## Porownanie lokal vs serwer

```powershell
.\scripts\compare-local-vs-remote.ps1
```

Sprawdza, czy pliki na serwerze sa takie same jak lokalnie (liczba plikow i rozmiary).
