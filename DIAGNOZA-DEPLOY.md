# Diagnoza: dlaczego zmiany nie wchodzą na produkcję

## Wniosek główny

**GitHub Actions wdraża kod na inny serwer niż ten, z którego serwowana jest produkcja.**

---

## Fakty

### 1. Serwer produkcyjny (65.108.245.25)

| Element | Wartość |
|---------|---------|
| Host | 65.108.245.25 (ssh hetzner) |
| Git HEAD | `e3c14b7` ("basePath /training dla instancji treningowej") |
| origin/master (po fetch) | `4eeb430` ("Update kosztorysy API route") |
| Build zawiera | "Cena jed" (stary formularz, 4 kolumny) |
| Ostatnia modyfikacja .next | 2026-03-13 12:28 (zgodna z czasem GitHub Actions) |

### 2. GitHub (master)

| Element | Wartość |
|---------|---------|
| Ostatni commit | `4eeb430` |
| kosztorys-form.tsx | 8 kolumn (Cena netto, VAT %, Wartość brutto itd.) |
| Ostatni workflow | Sukces, 13.03.2026 12:24–12:30 |

### 3. Konfiguracja na serwerze

- **Webhook** – `deploy.sh` uruchamiany przez webhook (ostatni: 22.02.2026; jeden deploy padł z "Killed" – brak pamięci)
- **Git** – `git reset --hard origin/master` **nie zostało wykonane** – HEAD nadal na e3c14b7

---

## Przyczyna

1. Workflow GitHub Actions łączy się przez SSH używając `secrets.HETZNER_HOST`.
2. Na serwerze 65.108.245.25 `git reset --hard origin/master` nigdy nie ustawiło HEAD na 4eeb430.
3. Workflow zakończył się sukcesem (green checkmark), więc albo:
   - **HETZNER_HOST wskazuje na inny serwer** niż 65.108.245.25,  
   - albo **workflow nie dociera do produkcyjnego hosta**.

---

## Co zrobić

### 1. Sprawdzić secret HETZNER_HOST

1. GitHub → Repo → **Settings** → **Secrets and variables** → **Actions**
2. Zweryfikować, czy `HETZNER_HOST` = `65.108.245.25`
3. Jeśli jest inny adres – ustawić poprawny IP produkcyjnego serwera.

### 2. Szybkie obejście – ręczny deploy

Na produkcyjnym serwerze:

```bash
ssh hetzner
cd /var/www/hotel
git fetch origin && git reset --hard origin/master
pm2 stop hotel-pms
rm -rf .next
npm ci --production=false
npx prisma@6 generate
NODE_OPTIONS=--max-old-space-size=2048 npm run build
pm2 start hotel-pms
```

Po tym deployu na stronie `/mice/kosztorysy` powinien być formularz z 8 kolumnami.

### 3. Dalsze działania

- Upewnić się, że `HETZNER_HOST` wskazuje na 65.108.245.25.
- Zaktualizować webhook (`deploy.sh`), żeby działał poprawnie (w tym naprawić problem z OOM podczas buildu), albo wyłączyć webhook i polegać na GitHub Actions, jeśli ma trafiać na ten sam serwer.
