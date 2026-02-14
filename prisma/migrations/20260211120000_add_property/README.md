# Migracja Property (wiele obiektów)

Po `npx prisma db push` uruchom zawartość `migration.sql` w PhpMyAdmin (lub MySQL CLI), jeśli w bazie są już istniejące wiersze `Room` bez `propertyId`.

Kolejność:
1. `npx prisma db push`
2. Wykonaj `migration.sql` (INSERT Property + UPDATE Room)
3. (Opcjonalnie) `npx prisma db seed` lub `npx tsx prisma/seed-kwhotel.ts`
