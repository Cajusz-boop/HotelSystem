-- Tylko utworzenie tabeli Property + domyślny obiekt (bez resetu bazy)
-- Uruchom: npx prisma db execute --file prisma/fix-property.sql

-- 1. Utwórz tabelę Property
CREATE TABLE IF NOT EXISTS `Property` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `reservationStatusColors` JSON NULL,
    `paymentStatusColors` JSON NULL,
    `statusCombinationColors` JSON NULL,
    `reservationStatusLabels` JSON NULL,
    `reservationStatusDescriptions` JSON NULL,
    `overbookingLimitPercent` INTEGER NOT NULL DEFAULT 0,
    `localTaxPerPersonPerNight` DECIMAL(10, 2) NULL,
    `mealPrices` JSON NULL,
    `ownerId` VARCHAR(191) NULL,
    `dunningConfig` JSON NULL,
    `housekeepingFloorAssignments` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    UNIQUE INDEX `Property_code_key`(`code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2. Wstaw domyślny obiekt
INSERT IGNORE INTO `Property` (`id`, `name`, `code`, `createdAt`, `updatedAt`)
VALUES ('prop_default_main', 'Obiekt główny', 'default', NOW(3), NOW(3));

-- 3. Przypisz pokoje do obiektu (jeśli Room ma kolumnę propertyId)
--    Uruchom ręcznie jeśli Room nie ma propertyId: ALTER TABLE Room ADD COLUMN propertyId VARCHAR(191) NULL;
UPDATE `Room` SET `propertyId` = 'prop_default_main' WHERE `propertyId` IS NULL OR `propertyId` = '';
