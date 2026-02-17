-- Dodaj kolumnę authDisabled do HotelConfig (jeśli nie istnieje)
ALTER TABLE `HotelConfig` ADD COLUMN `authDisabled` BOOLEAN NOT NULL DEFAULT false;

-- Wyłącz logowanie (tryb demo)
UPDATE `HotelConfig` SET `authDisabled` = 1 WHERE `id` = 'default';
