-- RateCode + kolumna rateCodeId w Reservation (dla bazy utworzonej ze starego schema-for-phpmyadmin.sql)
-- Uruchom w PHPMyAdmin, jeśli widzisz błąd "Unknown field 'rateCode'".

-- 1. Tabela RateCode
CREATE TABLE IF NOT EXISTS `RateCode` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `price` DECIMAL(10, 2) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    UNIQUE INDEX `RateCode_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2. Kolumna rateCodeId w Reservation (jeśli nie istnieje)
-- Jeśli kolumna już istnieje, pomiń ten blok lub usuń kolumnę wcześniej.
ALTER TABLE `Reservation` ADD COLUMN `rateCodeId` VARCHAR(191) NULL;

-- 3. Indeks i klucz obcy (opcjonalnie – może wymagać usunięcia istniejących FK)
-- ALTER TABLE `Reservation` ADD INDEX `Reservation_rateCodeId_idx`(`rateCodeId`);
-- ALTER TABLE `Reservation` ADD CONSTRAINT `Reservation_rateCodeId_fkey` FOREIGN KEY (`rateCodeId`) REFERENCES `RateCode`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
