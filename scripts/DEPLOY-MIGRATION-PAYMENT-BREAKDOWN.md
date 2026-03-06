# Bezpieczna migracja: paymentBreakdown w ConsolidatedInvoice

## Co zmieniamy
Dodajemy kolumnę `paymentBreakdown` (JSON, opcjonalna) do tabeli `ConsolidatedInvoice` – forma płatności na fakturze zbiorczej.

## Czy coś się rozpadnie?
**Nie.** Zmiana jest w pełni bezpieczna:
- Tylko **dodanie** kolumny (nullable)
- Istniejące rekordy: NULL
- Brak modyfikacji i usuwania istniejących kolumn

---

## Sposób 1: Standardowy deploy (zalecany)

GitHub Actions **już wykonuje** `npx prisma db push` podczas deployu. Wystarczy:

```powershell
git add .
git commit -m "paymentBreakdown dla faktury zbiorczej"
git push origin master
```

Workflow wykona m.in.:
1. `npx prisma generate`
2. `npm run build`
3. `npx prisma db push --skip-generate`
4. `pm2 start hotel-pms`

**Krótka przerwa na czas deployu** (ok. 1–2 min) – normalne zachowanie.

---

## Sposób 2: Migracja ręczna przed deployem (mniejsza przerwa)

Jeśli chcesz dodać kolumnę **przed** wdrożeniem kodu (np. dla szybszego deployu):

### Krok 1: Backup bazy (zalecany)
```bash
ssh hetzner "mysqldump -u hotel -p hotel_pms > /tmp/hotel_pms_backup_$(date +%Y%m%d_%H%M).sql"
```

### Krok 2: Migracja na produkcji
```bash
ssh hetzner "cd /var/www/hotel && npx prisma db push --skip-generate"
```

Lub ręcznie przez MySQL:
```bash
ssh hetzner
mysql -u hotel -p hotel_pms -e "ALTER TABLE ConsolidatedInvoice ADD COLUMN paymentBreakdown JSON NULL;"
```

### Krok 3: Deploy kodu
```powershell
git push origin master
```

### Krok 4: Weryfikacja
```bash
ssh hetzner "pm2 logs hotel-pms --lines 20"
# Sprawdź /kontrahenci → firma → faktury zbiorcze → Edytuj
```

---

## Sposób 3: Awaryjny (gdy prisma db push nie zadziała)

1. Skopiuj `scripts/migrate-payment-breakdown-consolidated-invoice.sql` na serwer.
2. Uruchom:
   ```bash
   mysql -u hotel -p hotel_pms < migrate-payment-breakdown-consolidated-invoice.sql
   ```
3. Uruchom deploy: `git push origin master`.

**Uwaga:** W Prisma/MySQL nazwa tabeli może być `ConsolidatedInvoice` lub `consolidatedinvoice` (w zależności od konfiguracji). Jeśli pojawi się błąd „Table doesn't exist”, sprawdź nazwę tabeli:
```sql
SHOW TABLES LIKE '%consolidated%';
```

---

## Opcjonalnie: db push przed zatrzymaniem aplikacji

W `.github/workflows/deploy.yml` możesz zmienić kolejność tak, żeby `prisma db push` działał **przed** `pm2 stop`:

1. Schema jest aktualizowany przy działającej starej aplikacji (nowa kolumna jest ignorowana).
2. Jeśli db push się nie uda, aplikacja dalej działa.
3. Dopiero potem: stop, build, start.

Obecna kolejność jest jednak poprawna i bezpieczna – migracja jest dodaniem kolumny NULL.

---

## Rollback

Jeśli trzeba cofnąć migrację (rzadko):
```sql
ALTER TABLE ConsolidatedInvoice DROP COLUMN paymentBreakdown;
```
**Uwaga:** Usunie zapisane rozbicia płatności. Kod należy cofnąć przez `git revert`.
