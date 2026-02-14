-- CreateTable: ReservationGroup
CREATE TABLE `ReservationGroup` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NULL,
  `note` TEXT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable: RoomBlock
CREATE TABLE `RoomBlock` (
  `id` VARCHAR(191) NOT NULL,
  `roomId` VARCHAR(191) NOT NULL,
  `startDate` DATE NOT NULL,
  `endDate` DATE NOT NULL,
  `reason` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddColumn: Reservation.groupId
ALTER TABLE `Reservation`
  ADD COLUMN `groupId` VARCHAR(191) NULL;

-- AddIndex: Reservation.groupId
CREATE INDEX `Reservation_groupId_idx` ON `Reservation`(`groupId`);

-- AddIndex: RoomBlock.roomId
CREATE INDEX `RoomBlock_roomId_idx` ON `RoomBlock`(`roomId`);

-- AddIndex: RoomBlock.start_end_idx
CREATE INDEX `RoomBlock_start_end_idx` ON `RoomBlock`(`startDate`, `endDate`);

-- AddForeignKey: Reservation.groupId -> ReservationGroup.id
ALTER TABLE `Reservation`
  ADD CONSTRAINT `Reservation_groupId_fkey`
  FOREIGN KEY (`groupId`) REFERENCES `ReservationGroup`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: RoomBlock.roomId -> Room.id
ALTER TABLE `RoomBlock`
  ADD CONSTRAINT `RoomBlock_roomId_fkey`
  FOREIGN KEY (`roomId`) REFERENCES `Room`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
