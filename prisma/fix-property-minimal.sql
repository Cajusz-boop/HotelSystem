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

INSERT IGNORE INTO `Property` (`id`, `name`, `code`, `createdAt`, `updatedAt`)
VALUES ('prop_default_main', 'Obiekt główny', 'default', NOW(3), NOW(3));
