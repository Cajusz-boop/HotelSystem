-- AlterTable: dodanie kolumny companyId do Reservation (relacja z Company)
ALTER TABLE `Reservation` ADD COLUMN `companyId` VARCHAR(191) NULL;

-- CreateIndex: indeks dla zapytań po companyId
CREATE INDEX `Reservation_companyId_idx` ON `Reservation`(`companyId`);

-- AddForeignKey: klucz obcy do Company (ON DELETE SET NULL – zgodnie z @relation)
ALTER TABLE `Reservation` ADD CONSTRAINT `Reservation_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
