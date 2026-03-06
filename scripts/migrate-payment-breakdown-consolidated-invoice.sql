-- Migracja: dodanie kolumny paymentBreakdown do ConsolidatedInvoice
-- Zmiana: pola rozbicia płatności (np. Gotówka, Karta) na fakturze zbiorczej
--
-- BEZPIECZEŃSTWO:
-- - Kolumna jest NULLABLE – istniejące rekordy dostaną NULL
-- - Brak utraty danych
-- - Brak zmiany istniejących kolumn
--
-- Uruchomienie ręczne (jeśli prisma db push zawiedzie):
--   mysql -u hotel -p hotel_pms < scripts/migrate-payment-breakdown-consolidated-invoice.sql
-- Lub przez PhpMyAdmin: skopiuj zawartość i wykonaj.

-- Prisma/MySQL: domyślna nazwa tabeli = ConsolidatedInvoice (PascalCase)
ALTER TABLE `ConsolidatedInvoice` ADD COLUMN `paymentBreakdown` JSON NULL;
