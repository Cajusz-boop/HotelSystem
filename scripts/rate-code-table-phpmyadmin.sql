-- Tabela RateCode + kolumna rateCodeId w Reservation – do wykonania w PhpMyAdmin
-- Wykonaj: USE twoja_baza; then paste below

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

-- Dodaj kolumnę rateCodeId do Reservation (jeśli nie ma)
-- ALTER TABLE `Reservation` ADD COLUMN `rateCodeId` VARCHAR(191) NULL;
-- ALTER TABLE `Reservation` ADD INDEX `Reservation_rateCodeId_idx`(`rateCodeId`);
-- ALTER TABLE `Reservation` ADD CONSTRAINT `Reservation_rateCodeId_fkey` FOREIGN KEY (`rateCodeId`) REFERENCES `RateCode`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
