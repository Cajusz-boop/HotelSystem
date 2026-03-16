-- AlterTable
ALTER TABLE `Reservation` ADD COLUMN `receiptNumber` VARCHAR(64) NULL,
    ADD COLUMN `receiptDate` DATE NULL;

-- AlterTable
ALTER TABLE `EventOrder` ADD COLUMN `receiptNumber` VARCHAR(64) NULL,
    ADD COLUMN `receiptDate` DATE NULL;
