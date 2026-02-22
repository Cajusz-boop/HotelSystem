# Setup na nowym komputerze

Instrukcja konfiguracji środowiska deweloperskiego na nowym komputerze (Windows).

---

## SZYBKI START (automatyczny)

Po sklonowaniu repo **kliknij dwukrotnie** na plik:

```
KLIKNIJ-SETUP.bat
```

I to wszystko! Skrypt automatycznie:
- Sprawdzi Node.js i Git
- Zainstaluje zależności npm
- Utworzy plik .env
- Skonfiguruje bazę danych (Prisma)
- Uruchomi aplikację

**Wymagania:** Node.js, Git, MySQL (XAMPP) muszą być zainstalowane wcześniej.

---

## Instrukcja ręczna (jeśli wolisz krok po kroku)

### 1. Wymagane oprogramowanie

Zainstaluj (jeśli nie masz):
- [Node.js LTS](https://nodejs.org/) (wersja 18+)
- [Git](https://git-scm.com/download/win)
- [XAMPP](https://www.apachefriends.org/) lub inny MySQL
- [VS Code](https://code.visualstudio.com/) lub [Cursor](https://cursor.sh/)

### 2. Konfiguracja Git (jednorazowo)

```powershell
git config --global user.name "Twoje Imię"
git config --global user.email "twoj@email.com"
```

### 3. Klonowanie repozytorium

```powershell
cd C:\
git clone https://github.com/Cajusz-boop/HotelSystem.git
cd HotelSystem
```

### 4. Logowanie do GitHub

#### Opcja A: GitHub CLI (zalecane)

```powershell
# Zainstaluj GitHub CLI jeśli nie masz
winget install GitHub.cli

# Zaloguj się
gh auth login
```

Wybierz: GitHub.com → HTTPS → Login with browser

#### Opcja B: Credential Manager

Przy pierwszym `git push` przeglądarka poprosi o logowanie.

### 5. Instalacja zależności

```powershell
npm install
```

### 6. Konfiguracja bazy danych

1. Uruchom MySQL (XAMPP → Start MySQL)
2. Utwórz bazę w phpMyAdmin lub przez terminal:
   ```sql
   CREATE DATABASE hotel_pms;
   ```
3. Skopiuj plik środowiskowy:
   ```powershell
   copy .env.example .env
   ```
4. Edytuj `.env` i ustaw `DATABASE_URL`:
   ```
   DATABASE_URL="mysql://root:@localhost:3306/hotel_pms"
   ```
5. Uruchom migrację Prisma:
   ```powershell
   npx prisma db push
   npx prisma generate
   ```

### 7. Uruchomienie aplikacji

```powershell
npm run dev
```

Otwórz http://localhost:3011

---

## Deploy na Hetzner

### Wymagane: Klucz SSH

Skopiuj klucz prywatny `hetzner_key` z komputera A do:
```
C:\Users\TWOJ_USER\.ssh\hetzner_key
```

Lub wygeneruj nowy i dodaj publiczny do serwera:
```powershell
ssh-keygen -t ed25519 -f $env:USERPROFILE\.ssh\hetzner_key
```

### Workflow (identyczny jak na komputerze A)

```powershell
# 1. Zapisz zmiany
git add .
git commit -m "opis zmian"

# 2. Wyślij na GitHub
git push origin master

# 3. Deploy:
.\scripts\deploy-to-hetzner.ps1
```

---

## Szybki checklist

- [ ] Node.js zainstalowany (`node -v`)
- [ ] Git skonfigurowany (`git config --list`)
- [ ] Repo sklonowane
- [ ] Zalogowany do GitHub (`gh auth status`)
- [ ] MySQL działa
- [ ] `.env` skonfigurowany
- [ ] `npm install` wykonane
- [ ] `npx prisma db push` wykonane
- [ ] Klucz SSH do Hetzner skopiowany

---

*Plik utworzony: 2026-02-22*
