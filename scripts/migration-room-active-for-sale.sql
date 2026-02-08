-- Dodanie kolumny activeForSale do tabeli Room (dla istniejącej bazy, np. PhpMyAdmin)
-- Uruchom ten skrypt, jeśli baza była tworzona wcześniej bez tej kolumny.

-- Jeśli kolumna już istnieje, pomiń lub usuń ją wcześniej: ALTER TABLE `Room` DROP COLUMN `activeForSale`;
ALTER TABLE `Room` ADD COLUMN `activeForSale` BOOLEAN NOT NULL DEFAULT true;
