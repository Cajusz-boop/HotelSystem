-- CreateTable
CREATE TABLE `Property` (
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
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Property_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OwnerSettlement` (
    `id` VARCHAR(191) NOT NULL,
    `propertyId` VARCHAR(191) NOT NULL,
    `ownerId` VARCHAR(191) NOT NULL,
    `periodFrom` DATE NOT NULL,
    `periodTo` DATE NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'PLN',
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `documentGeneratedAt` DATETIME(3) NULL,
    `paidAt` DATETIME NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `OwnerSettlement_ownerId_idx`(`ownerId`),
    INDEX `OwnerSettlement_status_idx`(`status`),
    UNIQUE INDEX `OwnerSettlement_propertyId_periodFrom_key`(`propertyId`, `periodFrom`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChannelPropertyConfig` (
    `id` VARCHAR(191) NOT NULL,
    `propertyId` VARCHAR(191) NOT NULL,
    `channel` VARCHAR(191) NOT NULL,
    `externalPropertyId` VARCHAR(191) NOT NULL,
    `roomTypeMappings` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ChannelPropertyConfig_propertyId_idx`(`propertyId`),
    INDEX `ChannelPropertyConfig_channel_idx`(`channel`),
    UNIQUE INDEX `ChannelPropertyConfig_propertyId_channel_key`(`propertyId`, `channel`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChannelMapping` (
    `id` VARCHAR(191) NOT NULL,
    `propertyId` VARCHAR(191) NOT NULL,
    `channel` VARCHAR(191) NOT NULL,
    `internalType` VARCHAR(191) NOT NULL,
    `internalId` VARCHAR(191) NOT NULL,
    `externalId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ChannelMapping_propertyId_idx`(`propertyId`),
    INDEX `ChannelMapping_propertyId_channel_idx`(`propertyId`, `channel`),
    UNIQUE INDEX `ChannelMapping_propertyId_channel_internalType_internalId_key`(`propertyId`, `channel`, `internalType`, `internalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AccountingExport` (
    `id` VARCHAR(191) NOT NULL,
    `propertyId` VARCHAR(191) NULL,
    `system` VARCHAR(191) NOT NULL,
    `lastExportAt` DATETIME(3) NULL,
    `config` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AccountingExport_propertyId_idx`(`propertyId`),
    INDEX `AccountingExport_system_idx`(`system`),
    UNIQUE INDEX `AccountingExport_propertyId_system_key`(`propertyId`, `system`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KsefSession` (
    `id` VARCHAR(191) NOT NULL,
    `propertyId` VARCHAR(191) NULL,
    `nip` VARCHAR(191) NOT NULL,
    `sessionToken` TEXT NOT NULL,
    `tokenExpiresAt` DATETIME(3) NOT NULL,
    `challenge` TEXT NULL,
    `contextIdentifier` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastKeepAliveAt` DATETIME(3) NULL,

    INDEX `KsefSession_propertyId_idx`(`propertyId`),
    INDEX `KsefSession_nip_idx`(`nip`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KsefSentBatch` (
    `id` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `invoiceIds` JSON NOT NULL,
    `batchReferenceNumber` VARCHAR(191) NULL,
    `sentAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` VARCHAR(191) NOT NULL,

    INDEX `KsefSentBatch_sessionId_idx`(`sessionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `KsefPendingSend` (
    `id` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `queuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastAttemptAt` DATETIME(3) NULL,
    `attemptCount` INTEGER NOT NULL DEFAULT 0,
    `lastError` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `KsefPendingSend_invoiceId_key`(`invoiceId`),
    INDEX `KsefPendingSend_invoiceId_idx`(`invoiceId`),
    INDEX `KsefPendingSend_queuedAt_idx`(`queuedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ParkingSpot` (
    `id` VARCHAR(191) NOT NULL,
    `propertyId` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ParkingSpot_propertyId_idx`(`propertyId`),
    UNIQUE INDEX `ParkingSpot_propertyId_number_key`(`propertyId`, `number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ParkingBooking` (
    `id` VARCHAR(191) NOT NULL,
    `parkingSpotId` VARCHAR(191) NOT NULL,
    `reservationId` VARCHAR(191) NULL,
    `startDate` DATE NOT NULL,
    `endDate` DATE NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ParkingBooking_parkingSpotId_idx`(`parkingSpotId`),
    INDEX `ParkingBooking_reservationId_idx`(`reservationId`),
    INDEX `ParkingBooking_startDate_endDate_idx`(`startDate`, `endDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RoomType` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `basePrice` DECIMAL(10, 2) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `visibleInStats` BOOLEAN NOT NULL DEFAULT true,
    `maxOccupancy` INTEGER NULL,
    `bedsDescription` VARCHAR(200) NULL,
    `photoUrl` VARCHAR(500) NULL,
    `translations` JSON NULL,
    `rateCodeId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `RoomType_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RatePlan` (
    `id` VARCHAR(191) NOT NULL,
    `roomTypeId` VARCHAR(191) NOT NULL,
    `validFrom` DATE NOT NULL,
    `validTo` DATE NOT NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `pricePerPerson` DECIMAL(10, 2) NULL,
    `adultPrice` DECIMAL(10, 2) NULL,
    `child1Price` DECIMAL(10, 2) NULL,
    `child2Price` DECIMAL(10, 2) NULL,
    `child3Price` DECIMAL(10, 2) NULL,
    `minStayNights` INTEGER NULL,
    `maxStayNights` INTEGER NULL,
    `isNonRefundable` BOOLEAN NOT NULL DEFAULT false,
    `isWeekendHoliday` BOOLEAN NOT NULL DEFAULT false,
    `closedToArrival` BOOLEAN NOT NULL DEFAULT false,
    `closedToDeparture` BOOLEAN NOT NULL DEFAULT false,
    `seasonId` VARCHAR(191) NULL,
    `includedMealPlan` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `RatePlan_roomTypeId_idx`(`roomTypeId`),
    INDEX `RatePlan_validFrom_validTo_idx`(`validFrom`, `validTo`),
    INDEX `RatePlan_seasonId_idx`(`seasonId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DerivedRateRule` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `value` DECIMAL(10, 2) NOT NULL,
    `description` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MinibarItem` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `unit` VARCHAR(191) NOT NULL DEFAULT 'szt',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MinibarConsumption` (
    `id` VARCHAR(191) NOT NULL,
    `reservationId` VARCHAR(191) NOT NULL,
    `minibarItemId` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MinibarConsumption_reservationId_idx`(`reservationId`),
    INDEX `MinibarConsumption_minibarItemId_idx`(`minibarItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Room` (
    `id` VARCHAR(191) NOT NULL,
    `propertyId` VARCHAR(191) NULL,
    `number` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `status` ENUM('CLEAN', 'DIRTY', 'OOO', 'INSPECTION', 'INSPECTED', 'CHECKOUT_PENDING', 'MAINTENANCE') NOT NULL,
    `price` DECIMAL(10, 2) NULL,
    `reason` VARCHAR(191) NULL,
    `activeForSale` BOOLEAN NOT NULL DEFAULT true,
    `sellPriority` INTEGER NOT NULL DEFAULT 0,
    `isDeleted` BOOLEAN NOT NULL DEFAULT false,
    `deletedAt` DATETIME NULL,
    `deletedBy` VARCHAR(191) NULL,
    `roomFeatures` JSON NULL,
    `beds` INTEGER NOT NULL DEFAULT 1,
    `surfaceArea` DECIMAL(6, 2) NULL,
    `floor` VARCHAR(191) NULL,
    `building` VARCHAR(191) NULL,
    `view` VARCHAR(191) NULL,
    `exposure` VARCHAR(191) NULL,
    `bedTypes` JSON NULL,
    `photos` JSON NULL,
    `amenities` JSON NULL,
    `inventory` JSON NULL,
    `connectedRooms` JSON NULL,
    `cleaningPriority` VARCHAR(191) NULL,
    `assignedHousekeeper` VARCHAR(191) NULL,
    `estimatedCleaningMinutes` INTEGER NULL,
    `maxOccupancy` INTEGER NOT NULL DEFAULT 2,
    `description` TEXT NULL,
    `technicalNotes` TEXT NULL,
    `nextServiceDate` DATE NULL,
    `nextServiceNote` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Room_propertyId_idx`(`propertyId`),
    INDEX `Room_propertyId_status_idx`(`propertyId`, `status`),
    UNIQUE INDEX `Room_number_key`(`number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RoomGroup` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `propertyId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `RoomGroup_propertyId_idx`(`propertyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RoomGroupRoom` (
    `id` VARCHAR(191) NOT NULL,
    `roomGroupId` VARCHAR(191) NOT NULL,
    `roomId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `RoomGroupRoom_roomId_key`(`roomId`),
    INDEX `RoomGroupRoom_roomGroupId_idx`(`roomGroupId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Guest` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `photoUrl` VARCHAR(500) NULL,
    `emergencyContactName` VARCHAR(191) NULL,
    `emergencyContactPhone` VARCHAR(191) NULL,
    `emergencyContactRelation` VARCHAR(191) NULL,
    `occupation` VARCHAR(191) NULL,
    `guestType` VARCHAR(191) NOT NULL DEFAULT 'INDIVIDUAL',
    `segment` VARCHAR(191) NULL,
    `dateOfBirth` DATE NULL,
    `placeOfBirth` VARCHAR(191) NULL,
    `nationality` VARCHAR(191) NULL,
    `gender` VARCHAR(191) NULL,
    `street` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `postalCode` VARCHAR(191) NULL,
    `country` VARCHAR(191) NULL,
    `documentType` VARCHAR(191) NULL,
    `documentNumber` VARCHAR(191) NULL,
    `documentExpiry` DATE NULL,
    `documentIssuedBy` VARCHAR(191) NULL,
    `mrz` VARCHAR(191) NULL,
    `isVip` BOOLEAN NOT NULL DEFAULT false,
    `vipLevel` VARCHAR(191) NULL,
    `isBlacklisted` BOOLEAN NOT NULL DEFAULT false,
    `preferences` JSON NULL,
    `totalStays` INTEGER NOT NULL DEFAULT 0,
    `lastStayDate` DATE NULL,
    `mealPreferences` JSON NULL,
    `healthAllergies` TEXT NULL,
    `healthNotes` TEXT NULL,
    `favoriteMinibarItems` JSON NULL,
    `staffNotes` TEXT NULL,
    `customFields` JSON NULL,
    `gdprDataProcessingConsent` BOOLEAN NOT NULL DEFAULT false,
    `gdprDataProcessingDate` DATETIME(3) NULL,
    `gdprConsentSignature` JSON NULL,
    `gdprMarketingConsent` BOOLEAN NOT NULL DEFAULT false,
    `gdprMarketingConsentDate` DATETIME(3) NULL,
    `gdprThirdPartyConsent` BOOLEAN NOT NULL DEFAULT false,
    `gdprThirdPartyConsentDate` DATETIME(3) NULL,
    `gdprConsentWithdrawnAt` DATETIME(3) NULL,
    `gdprAnonymizedAt` DATETIME(3) NULL,
    `gdprNotes` TEXT NULL,
    `loyaltyCardNumber` VARCHAR(191) NULL,
    `loyaltyPoints` INTEGER NOT NULL DEFAULT 0,
    `loyaltyTierId` VARCHAR(191) NULL,
    `loyaltyEnrolledAt` DATETIME(3) NULL,
    `loyaltyTotalPoints` INTEGER NOT NULL DEFAULT 0,
    `loyaltyTotalStays` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Guest_loyaltyCardNumber_key`(`loyaltyCardNumber`),
    INDEX `Guest_loyaltyTierId_idx`(`loyaltyTierId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GuestDiscount` (
    `id` VARCHAR(191) NOT NULL,
    `guestId` VARCHAR(191) NOT NULL,
    `percentage` DECIMAL(5, 2) NOT NULL,
    `dateFrom` DATE NOT NULL,
    `dateTo` DATE NOT NULL,
    `reason` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `GuestDiscount_guestId_idx`(`guestId`),
    INDEX `GuestDiscount_dateFrom_dateTo_idx`(`dateFrom`, `dateTo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GuestAppToken` (
    `id` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `guestId` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `GuestAppToken_token_key`(`token`),
    INDEX `GuestAppToken_guestId_idx`(`guestId`),
    INDEX `GuestAppToken_token_idx`(`token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GuestRelation` (
    `id` VARCHAR(191) NOT NULL,
    `sourceGuestId` VARCHAR(191) NOT NULL,
    `targetGuestId` VARCHAR(191) NOT NULL,
    `relationType` VARCHAR(191) NOT NULL,
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `GuestRelation_sourceGuestId_idx`(`sourceGuestId`),
    INDEX `GuestRelation_targetGuestId_idx`(`targetGuestId`),
    UNIQUE INDEX `GuestRelation_sourceGuestId_targetGuestId_key`(`sourceGuestId`, `targetGuestId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Company` (
    `id` VARCHAR(191) NOT NULL,
    `nip` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `address` VARCHAR(191) NULL,
    `postalCode` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `country` VARCHAR(191) NOT NULL DEFAULT 'POL',
    `contactPerson` VARCHAR(191) NULL,
    `contactEmail` VARCHAR(191) NULL,
    `contactPhone` VARCHAR(191) NULL,
    `contactPosition` VARCHAR(191) NULL,
    `paymentTermDays` INTEGER NOT NULL DEFAULT 14,
    `creditLimit` DECIMAL(12, 2) NULL,
    `billingEmail` VARCHAR(191) NULL,
    `billingNotes` VARCHAR(191) NULL,
    `accountManagerId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Company_nip_key`(`nip`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReservationOccupant` (
    `id` VARCHAR(191) NOT NULL,
    `reservationId` VARCHAR(191) NOT NULL,
    `guestId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ReservationOccupant_reservationId_idx`(`reservationId`),
    INDEX `ReservationOccupant_guestId_idx`(`guestId`),
    UNIQUE INDEX `ReservationOccupant_reservationId_guestId_key`(`reservationId`, `guestId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReservationFolio` (
    `id` VARCHAR(191) NOT NULL,
    `reservationId` VARCHAR(191) NOT NULL,
    `folioNumber` INTEGER NOT NULL,
    `billTo` VARCHAR(191) NOT NULL,
    `guestId` VARCHAR(191) NULL,
    `companyId` VARCHAR(191) NULL,
    `label` VARCHAR(200) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ReservationFolio_reservationId_idx`(`reservationId`),
    INDEX `ReservationFolio_companyId_idx`(`companyId`),
    INDEX `ReservationFolio_guestId_idx`(`guestId`),
    UNIQUE INDEX `ReservationFolio_reservationId_folioNumber_key`(`reservationId`, `folioNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReservationDayRate` (
    `id` VARCHAR(191) NOT NULL,
    `reservationId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `rate` DECIMAL(10, 2) NOT NULL,

    INDEX `ReservationDayRate_reservationId_idx`(`reservationId`),
    UNIQUE INDEX `ReservationDayRate_reservationId_date_key`(`reservationId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TravelAgent` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `nip` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `postalCode` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `country` VARCHAR(191) NOT NULL DEFAULT 'POL',
    `contactPerson` VARCHAR(191) NULL,
    `contactEmail` VARCHAR(191) NULL,
    `contactPhone` VARCHAR(191) NULL,
    `website` VARCHAR(191) NULL,
    `commissionPercent` DECIMAL(5, 2) NOT NULL DEFAULT 10,
    `commissionType` VARCHAR(191) NOT NULL DEFAULT 'NET',
    `paymentTermDays` INTEGER NOT NULL DEFAULT 14,
    `creditLimit` DECIMAL(12, 2) NULL,
    `rateCodeId` VARCHAR(191) NULL,
    `useNetRates` BOOLEAN NOT NULL DEFAULT true,
    `discountPercent` DECIMAL(5, 2) NULL,
    `iataNumber` VARCHAR(191) NULL,
    `licenseNumber` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TravelAgent_code_key`(`code`),
    INDEX `TravelAgent_code_idx`(`code`),
    INDEX `TravelAgent_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RateCode` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `price` DECIMAL(10, 2) NULL,
    `basePrice` DECIMAL(10, 2) NULL,
    `pricePerPerson` DECIMAL(10, 2) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `RateCode_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CorporateContract` (
    `id` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NOT NULL,
    `rateCodeId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NULL,
    `discountPercent` DECIMAL(5, 2) NULL,
    `fixedPricePerNight` DECIMAL(10, 2) NULL,
    `validFrom` DATETIME(3) NOT NULL,
    `validTo` DATETIME(3) NOT NULL,
    `minNightsPerYear` INTEGER NULL,
    `minRevenuePerYear` DECIMAL(12, 2) NULL,
    `paymentTermDays` INTEGER NOT NULL DEFAULT 14,
    `commissionPercent` DECIMAL(5, 2) NULL,
    `contactPerson` VARCHAR(191) NULL,
    `contactEmail` VARCHAR(191) NULL,
    `contactPhone` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CorporateContract_companyId_idx`(`companyId`),
    INDEX `CorporateContract_validFrom_validTo_idx`(`validFrom`, `validTo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Reservation` (
    `id` VARCHAR(191) NOT NULL,
    `confirmationNumber` VARCHAR(191) NULL,
    `guestId` VARCHAR(191) NOT NULL,
    `roomId` VARCHAR(191) NOT NULL,
    `companyId` VARCHAR(191) NULL,
    `rateCodeId` VARCHAR(191) NULL,
    `rateCodePrice` DECIMAL(10, 2) NULL,
    `groupId` VARCHAR(191) NULL,
    `checkIn` DATE NOT NULL,
    `checkOut` DATE NOT NULL,
    `checkInTime` VARCHAR(191) NULL,
    `checkOutTime` VARCHAR(191) NULL,
    `eta` VARCHAR(191) NULL,
    `etd` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW') NOT NULL,
    `source` VARCHAR(191) NULL,
    `channel` VARCHAR(191) NULL,
    `marketSegment` VARCHAR(191) NULL,
    `tripPurpose` VARCHAR(191) NULL,
    `mealPlan` VARCHAR(191) NULL,
    `roomPreferences` JSON NULL,
    `pax` INTEGER NULL,
    `adults` INTEGER NULL,
    `children` INTEGER NULL,
    `childrenAges` JSON NULL,
    `petInfo` JSON NULL,
    `paymentStatus` VARCHAR(191) NULL,
    `securityDeposit` JSON NULL,
    `cardGuarantee` JSON NULL,
    `isCreditCardGuaranteed` BOOLEAN NOT NULL DEFAULT false,
    `notesVisibleOnChart` BOOLEAN NOT NULL DEFAULT false,
    `showNotesOnChart` BOOLEAN NOT NULL DEFAULT false,
    `advancePayment` JSON NULL,
    `advanceDueDate` DATE NULL,
    `extraStatus` VARCHAR(191) NULL,
    `reminderAt` DATETIME(3) NULL,
    `externalReservationNumber` VARCHAR(191) NULL,
    `currency` VARCHAR(191) NULL,
    `cancellationReason` VARCHAR(191) NULL,
    `deletionReason` VARCHAR(191) NULL,
    `cancellationCode` VARCHAR(191) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `cancelledBy` VARCHAR(191) NULL,
    `alerts` JSON NULL,
    `travelAgentId` VARCHAR(191) NULL,
    `agentCommission` DECIMAL(5, 2) NULL,
    `bedsBooked` INTEGER NULL,
    `notes` VARCHAR(191) NULL,
    `internalNotes` TEXT NULL,
    `specialRequests` TEXT NULL,
    `webCheckInSignedAt` DATETIME(3) NULL,
    `webCheckInSignature` JSON NULL,
    `kioskCheckInAt` DATETIME(3) NULL,
    `kioskSignature` JSON NULL,
    `digitalKeyCode` JSON NULL,
    `invoiceSingleLine` BOOLEAN NOT NULL DEFAULT true,
    `invoiceScope` VARCHAR(191) NOT NULL DEFAULT 'ALL',
    `paidAmountOverride` DECIMAL(12, 2) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `packageId` VARCHAR(191) NULL,

    UNIQUE INDEX `Reservation_confirmationNumber_key`(`confirmationNumber`),
    INDEX `Reservation_checkIn_checkOut_idx`(`checkIn`, `checkOut`),
    INDEX `Reservation_roomId_idx`(`roomId`),
    INDEX `Reservation_status_checkIn_checkOut_idx`(`status`, `checkIn`, `checkOut`),
    INDEX `Reservation_roomId_checkIn_checkOut_idx`(`roomId`, `checkIn`, `checkOut`),
    INDEX `Reservation_rateCodeId_idx`(`rateCodeId`),
    INDEX `Reservation_companyId_idx`(`companyId`),
    INDEX `Reservation_groupId_idx`(`groupId`),
    INDEX `Reservation_travelAgentId_idx`(`travelAgentId`),
    INDEX `Reservation_source_idx`(`source`),
    INDEX `Reservation_channel_idx`(`channel`),
    INDEX `Reservation_marketSegment_idx`(`marketSegment`),
    INDEX `Reservation_packageId_idx`(`packageId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SurchargeType` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `chargeType` VARCHAR(191) NOT NULL DEFAULT 'PER_NIGHT',
    `propertyId` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `SurchargeType_code_key`(`code`),
    INDEX `SurchargeType_propertyId_idx`(`propertyId`),
    INDEX `SurchargeType_code_idx`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReservationSurcharge` (
    `id` VARCHAR(191) NOT NULL,
    `reservationId` VARCHAR(191) NOT NULL,
    `surchargeTypeId` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `amountOverride` DECIMAL(10, 2) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ReservationSurcharge_reservationId_idx`(`reservationId`),
    INDEX `ReservationSurcharge_surchargeTypeId_idx`(`surchargeTypeId`),
    UNIQUE INDEX `ReservationSurcharge_reservationId_surchargeTypeId_key`(`reservationId`, `surchargeTypeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Package` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `totalPrice` DECIMAL(10, 2) NULL,
    `propertyId` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Package_code_key`(`code`),
    INDEX `Package_propertyId_idx`(`propertyId`),
    INDEX `Package_code_idx`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PackageComponent` (
    `id` VARCHAR(191) NOT NULL,
    `packageId` VARCHAR(191) NOT NULL,
    `componentType` VARCHAR(191) NOT NULL,
    `refValue` VARCHAR(191) NULL,
    `label` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `unitPrice` DECIMAL(10, 2) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PackageComponent_packageId_idx`(`packageId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Dish` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `defaultPrice` DECIMAL(10, 2) NOT NULL,
    `vatRate` DECIMAL(5, 4) NOT NULL,
    `category` VARCHAR(191) NULL,
    `gtuCode` VARCHAR(191) NULL,
    `allergens` JSON NULL,
    `dietTags` JSON NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Dish_code_key`(`code`),
    INDEX `Dish_name_idx`(`name`),
    INDEX `Dish_category_idx`(`category`),
    INDEX `Dish_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MenuPackage` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `eventTypes` JSON NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `rules` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `MenuPackage_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MenuPackageSection` (
    `id` VARCHAR(191) NOT NULL,
    `packageId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `choiceLimit` INTEGER NULL,
    `dishes` JSON NOT NULL,
    `dishIds` JSON NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    INDEX `MenuPackageSection_packageId_idx`(`packageId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MenuPackageSurcharge` (
    `id` VARCHAR(191) NOT NULL,
    `packageId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `pricePerPerson` DECIMAL(10, 2) NULL,
    `flatPrice` DECIMAL(10, 2) NULL,
    `hasChoice` BOOLEAN NOT NULL DEFAULT false,
    `choiceLimit` INTEGER NULL,
    `options` JSON NULL,
    `description` VARCHAR(191) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    INDEX `MenuPackageSurcharge_packageId_idx`(`packageId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ShopProduct` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `sku` VARCHAR(191) NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `category` VARCHAR(191) NOT NULL DEFAULT 'OTHER',
    `propertyId` VARCHAR(191) NULL,
    `stockQty` INTEGER NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ShopProduct_sku_key`(`sku`),
    INDEX `ShopProduct_propertyId_idx`(`propertyId`),
    INDEX `ShopProduct_category_idx`(`category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReceptionSale` (
    `id` VARCHAR(191) NOT NULL,
    `reservationId` VARCHAR(191) NULL,
    `guestId` VARCHAR(191) NULL,
    `totalAmount` DECIMAL(12, 2) NOT NULL,
    `paymentMethod` VARCHAR(191) NULL,
    `transactionId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ReceptionSale_reservationId_idx`(`reservationId`),
    INDEX `ReceptionSale_guestId_idx`(`guestId`),
    INDEX `ReceptionSale_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReceptionSaleItem` (
    `id` VARCHAR(191) NOT NULL,
    `receptionSaleId` VARCHAR(191) NOT NULL,
    `shopProductId` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `unitPrice` DECIMAL(10, 2) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,

    INDEX `ReceptionSaleItem_receptionSaleId_idx`(`receptionSaleId`),
    INDEX `ReceptionSaleItem_shopProductId_idx`(`shopProductId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PhoneCallLog` (
    `id` VARCHAR(191) NOT NULL,
    `roomId` VARCHAR(191) NULL,
    `reservationId` VARCHAR(191) NULL,
    `externalId` VARCHAR(191) NOT NULL,
    `startedAt` DATETIME(3) NOT NULL,
    `durationSec` INTEGER NOT NULL DEFAULT 0,
    `cost` DECIMAL(10, 4) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PhoneCallLog_roomId_idx`(`roomId`),
    INDEX `PhoneCallLog_reservationId_idx`(`reservationId`),
    INDEX `PhoneCallLog_externalId_idx`(`externalId`),
    INDEX `PhoneCallLog_startedAt_idx`(`startedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `userId` VARCHAR(191) NULL,
    `actionType` ENUM('CREATE', 'UPDATE', 'DELETE') NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NULL,
    `oldValue` JSON NULL,
    `newValue` JSON NULL,
    `ipAddress` VARCHAR(191) NULL,

    INDEX `AuditLog_timestamp_idx`(`timestamp`),
    INDEX `AuditLog_entityType_entityId_idx`(`entityType`, `entityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LoginLog` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `email` VARCHAR(254) NOT NULL,
    `loggedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ipAddress` VARCHAR(45) NULL,
    `success` BOOLEAN NOT NULL DEFAULT true,

    INDEX `LoginLog_loggedAt_idx`(`loggedAt`),
    INDEX `LoginLog_userId_idx`(`userId`),
    INDEX `LoginLog_email_idx`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DunningLog` (
    `id` VARCHAR(191) NOT NULL,
    `reservationId` VARCHAR(191) NOT NULL,
    `level` INTEGER NOT NULL,
    `channel` VARCHAR(191) NOT NULL DEFAULT 'EMAIL',
    `recipientEmail` VARCHAR(254) NULL,
    `recipientPhone` VARCHAR(50) NULL,
    `success` BOOLEAN NOT NULL DEFAULT true,
    `errorMessage` TEXT NULL,
    `sentAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `balanceAtSend` DECIMAL(12, 2) NOT NULL,
    `dueDate` DATE NOT NULL,

    INDEX `DunningLog_reservationId_idx`(`reservationId`),
    INDEX `DunningLog_sentAt_idx`(`sentAt`),
    INDEX `DunningLog_reservationId_level_idx`(`reservationId`, `level`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CollectionCase` (
    `id` VARCHAR(191) NOT NULL,
    `reservationId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'IN_COLLECTION',
    `agencyName` VARCHAR(200) NULL,
    `handedOverAt` DATETIME NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CollectionCase_reservationId_key`(`reservationId`),
    INDEX `CollectionCase_status_idx`(`status`),
    INDEX `CollectionCase_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Transaction` (
    `id` VARCHAR(191) NOT NULL,
    `reservationId` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `paymentMethod` VARCHAR(191) NULL,
    `isReadOnly` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `paymentDetails` JSON NULL,
    `description` TEXT NULL,
    `quantity` DECIMAL(10, 2) NOT NULL DEFAULT 1,
    `unitPrice` DECIMAL(12, 2) NULL,
    `vatRate` DECIMAL(5, 2) NOT NULL DEFAULT 8,
    `vatAmount` DECIMAL(12, 2) NULL,
    `netAmount` DECIMAL(12, 2) NULL,
    `category` VARCHAR(191) NULL,
    `subcategory` VARCHAR(191) NULL,
    `departmentCode` VARCHAR(191) NULL,
    `gtuCode` VARCHAR(191) NULL,
    `invoiceId` VARCHAR(191) NULL,
    `receiptId` VARCHAR(191) NULL,
    `folioNumber` INTEGER NOT NULL DEFAULT 1,
    `transferredFrom` VARCHAR(191) NULL,
    `transferredTo` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `voidedAt` DATETIME(3) NULL,
    `voidedBy` VARCHAR(191) NULL,
    `voidReason` VARCHAR(191) NULL,
    `postedBy` VARCHAR(191) NULL,
    `postedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `isManualOverride` BOOLEAN NOT NULL DEFAULT false,
    `originalAmount` DECIMAL(12, 2) NULL,
    `appliesToTransactionId` VARCHAR(191) NULL,
    `refundedTransactionId` VARCHAR(191) NULL,
    `externalRef` TEXT NULL,
    `notes` TEXT NULL,

    INDEX `Transaction_reservationId_idx`(`reservationId`),
    INDEX `Transaction_reservationId_status_idx`(`reservationId`, `status`),
    INDEX `Transaction_appliesToTransactionId_idx`(`appliesToTransactionId`),
    INDEX `Transaction_refundedTransactionId_idx`(`refundedTransactionId`),
    INDEX `Transaction_paymentMethod_idx`(`paymentMethod`),
    INDEX `Transaction_folioNumber_idx`(`folioNumber`),
    INDEX `Transaction_category_idx`(`category`),
    INDEX `Transaction_status_idx`(`status`),
    INDEX `Transaction_postedAt_idx`(`postedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Proforma` (
    `id` VARCHAR(191) NOT NULL,
    `reservationId` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `issuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `overrides` JSON NULL,

    INDEX `Proforma_reservationId_idx`(`reservationId`),
    UNIQUE INDEX `Proforma_number_key`(`number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Invoice` (
    `id` VARCHAR(191) NOT NULL,
    `reservationId` VARCHAR(191) NULL,
    `companyId` VARCHAR(191) NULL,
    `sourceType` VARCHAR(191) NOT NULL DEFAULT 'RESERVATION',
    `sourceId` VARCHAR(191) NULL,
    `invoiceType` VARCHAR(191) NULL DEFAULT 'NORMAL',
    `advanceInvoiceId` VARCHAR(191) NULL,
    `number` VARCHAR(191) NOT NULL,
    `amountNet` DECIMAL(12, 2) NOT NULL,
    `amountVat` DECIMAL(12, 2) NOT NULL,
    `amountGross` DECIMAL(12, 2) NOT NULL,
    `vatRate` DECIMAL(5, 2) NOT NULL,
    `marginMode` BOOLEAN NOT NULL DEFAULT false,
    `buyerNip` VARCHAR(191) NOT NULL,
    `buyerName` VARCHAR(191) NOT NULL,
    `buyerAddress` VARCHAR(191) NULL,
    `buyerPostalCode` VARCHAR(191) NULL,
    `buyerCity` VARCHAR(191) NULL,
    `receiverName` VARCHAR(191) NULL,
    `receiverAddress` VARCHAR(191) NULL,
    `receiverPostalCode` VARCHAR(191) NULL,
    `receiverCity` VARCHAR(191) NULL,
    `issuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deliveryDate` DATETIME(3) NULL,
    `placeOfIssue` VARCHAR(191) NULL,
    `paymentMethod` VARCHAR(191) NULL,
    `paymentDueDate` DATETIME(3) NULL,
    `paymentDays` INTEGER NULL,
    `issuedByName` VARCHAR(191) NULL,
    `receivedByName` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ksefUuid` VARCHAR(191) NULL,
    `ksefReferenceNumber` VARCHAR(191) NULL,
    `ksefStatus` ENUM('DRAFT', 'PENDING', 'SENT', 'ACCEPTED', 'REJECTED', 'VERIFICATION') NULL,
    `ksefUpoUrl` VARCHAR(191) NULL,
    `ksefPublishedAt` DATETIME(3) NULL,
    `ksefErrorMessage` TEXT NULL,
    `paymentBreakdown` JSON NULL,
    `customFieldValues` JSON NULL,
    `notes` TEXT NULL,
    `sellerOverride` JSON NULL,
    `documentOverrides` JSON NULL,
    `invoiceScope` VARCHAR(191) NULL,
    `consolidatedStatus` VARCHAR(191) NULL,
    `paidAt` DATETIME(3) NULL,
    `periodFrom` DATE NULL,
    `periodTo` DATE NULL,

    INDEX `Invoice_reservationId_idx`(`reservationId`),
    INDEX `Invoice_companyId_idx`(`companyId`),
    INDEX `Invoice_sourceType_sourceId_idx`(`sourceType`, `sourceId`),
    UNIQUE INDEX `Invoice_number_key`(`number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InvoiceReservation` (
    `id` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `reservationId` VARCHAR(191) NOT NULL,
    `guestName` VARCHAR(191) NOT NULL,
    `roomNumber` VARCHAR(191) NOT NULL,
    `checkIn` DATE NOT NULL,
    `checkOut` DATE NOT NULL,
    `nights` INTEGER NOT NULL,
    `amountNet` DECIMAL(12, 2) NOT NULL,
    `amountVat` DECIMAL(12, 2) NOT NULL,
    `amountGross` DECIMAL(12, 2) NOT NULL,
    `description` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `InvoiceReservation_invoiceId_idx`(`invoiceId`),
    INDEX `InvoiceReservation_reservationId_idx`(`reservationId`),
    UNIQUE INDEX `InvoiceReservation_invoiceId_reservationId_key`(`invoiceId`, `reservationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InvoiceLineItem` (
    `id` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `quantity` DECIMAL(10, 2) NOT NULL DEFAULT 1,
    `unit` VARCHAR(191) NOT NULL DEFAULT 'szt.',
    `unitPrice` DECIMAL(12, 2) NOT NULL,
    `vatRate` DECIMAL(5, 2) NOT NULL DEFAULT 8,
    `amountNet` DECIMAL(12, 2) NOT NULL,
    `amountVat` DECIMAL(12, 2) NOT NULL,
    `amountGross` DECIMAL(12, 2) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    INDEX `InvoiceLineItem_invoiceId_idx`(`invoiceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InvoiceCorrection` (
    `id` VARCHAR(191) NOT NULL,
    `invoiceId` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `amountGross` DECIMAL(12, 2) NOT NULL,
    `reason` VARCHAR(191) NULL,
    `issuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `InvoiceCorrection_invoiceId_idx`(`invoiceId`),
    UNIQUE INDEX `InvoiceCorrection_number_key`(`number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Receipt` (
    `id` VARCHAR(191) NOT NULL,
    `reservationId` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `items` JSON NULL,
    `buyerName` VARCHAR(191) NOT NULL,
    `buyerAddress` VARCHAR(191) NULL,
    `buyerPostalCode` VARCHAR(191) NULL,
    `buyerCity` VARCHAR(191) NULL,
    `buyerNip` VARCHAR(191) NULL,
    `sellerName` VARCHAR(191) NOT NULL,
    `sellerAddress` VARCHAR(191) NULL,
    `sellerPostalCode` VARCHAR(191) NULL,
    `sellerCity` VARCHAR(191) NULL,
    `sellerNip` VARCHAR(191) NULL,
    `vatExemptionBasis` VARCHAR(191) NULL,
    `paymentMethod` VARCHAR(191) NULL,
    `paymentBreakdown` JSON NULL,
    `paymentDueDate` DATE NULL,
    `isPaid` BOOLEAN NOT NULL DEFAULT false,
    `paidAt` DATETIME(3) NULL,
    `serviceDate` DATE NULL,
    `issuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `notes` TEXT NULL,

    UNIQUE INDEX `Receipt_number_key`(`number`),
    INDEX `Receipt_reservationId_idx`(`reservationId`),
    INDEX `Receipt_issuedAt_idx`(`issuedAt`),
    INDEX `Receipt_buyerName_idx`(`buyerName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AccountingNote` (
    `id` VARCHAR(191) NOT NULL,
    `reservationId` VARCHAR(191) NULL,
    `companyId` VARCHAR(191) NULL,
    `number` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `category` VARCHAR(191) NULL,
    `issuerName` VARCHAR(191) NOT NULL,
    `issuerAddress` VARCHAR(191) NULL,
    `issuerPostalCode` VARCHAR(191) NULL,
    `issuerCity` VARCHAR(191) NULL,
    `issuerNip` VARCHAR(191) NULL,
    `recipientName` VARCHAR(191) NOT NULL,
    `recipientAddress` VARCHAR(191) NULL,
    `recipientPostalCode` VARCHAR(191) NULL,
    `recipientCity` VARCHAR(191) NULL,
    `recipientNip` VARCHAR(191) NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'PLN',
    `referenceDocument` VARCHAR(191) NULL,
    `referenceDate` DATE NULL,
    `dueDate` DATE NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ISSUED',
    `paidAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `cancelledReason` VARCHAR(191) NULL,
    `issuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `internalNotes` TEXT NULL,

    UNIQUE INDEX `AccountingNote_number_key`(`number`),
    INDEX `AccountingNote_reservationId_idx`(`reservationId`),
    INDEX `AccountingNote_companyId_idx`(`companyId`),
    INDEX `AccountingNote_type_idx`(`type`),
    INDEX `AccountingNote_status_idx`(`status`),
    INDEX `AccountingNote_issuedAt_idx`(`issuedAt`),
    INDEX `AccountingNote_recipientName_idx`(`recipientName`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaymentLink` (
    `id` VARCHAR(191) NOT NULL,
    `reservationId` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `expiresAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PaymentLink_token_key`(`token`),
    INDEX `PaymentLink_reservationId_idx`(`reservationId`),
    INDEX `PaymentLink_token_idx`(`token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CardPreauth` (
    `id` VARCHAR(191) NOT NULL,
    `reservationId` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `externalId` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'HOLD',
    `expiresAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CardPreauth_reservationId_idx`(`reservationId`),
    INDEX `CardPreauth_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CardSettlementBatch` (
    `id` VARCHAR(191) NOT NULL,
    `propertyId` VARCHAR(191) NULL,
    `periodFrom` DATETIME(3) NOT NULL,
    `periodTo` DATETIME(3) NOT NULL,
    `transactionCount` INTEGER NOT NULL,
    `totalAmount` DECIMAL(12, 2) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `batchNumber` VARCHAR(191) NULL,
    `terminalId` VARCHAR(191) NULL,
    `externalReference` VARCHAR(191) NULL,
    `settlementDate` DATETIME(3) NULL,
    `settlementAmount` DECIMAL(12, 2) NULL,
    `discrepancyAmount` DECIMAL(12, 2) NULL,
    `discrepancyReason` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `submittedBy` VARCHAR(191) NULL,
    `settledBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `transactionDetails` JSON NULL,

    INDEX `CardSettlementBatch_status_idx`(`status`),
    INDEX `CardSettlementBatch_periodFrom_periodTo_idx`(`periodFrom`, `periodTo`),
    INDEX `CardSettlementBatch_batchNumber_idx`(`batchNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WebCheckInToken` (
    `id` VARCHAR(191) NOT NULL,
    `reservationId` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `WebCheckInToken_token_key`(`token`),
    INDEX `WebCheckInToken_reservationId_idx`(`reservationId`),
    INDEX `WebCheckInToken_token_idx`(`token`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReservationGroup` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `note` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RoomBlock` (
    `id` VARCHAR(191) NOT NULL,
    `roomId` VARCHAR(191) NOT NULL,
    `startDate` DATE NOT NULL,
    `endDate` DATE NOT NULL,
    `reason` VARCHAR(191) NULL,
    `blockType` VARCHAR(191) NOT NULL DEFAULT 'OTHER',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RoomBlock_roomId_idx`(`roomId`),
    INDEX `RoomBlock_startDate_endDate_idx`(`startDate`, `endDate`),
    INDEX `RoomBlock_blockType_idx`(`blockType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Allotment` (
    `id` VARCHAR(191) NOT NULL,
    `companyName` VARCHAR(191) NOT NULL,
    `roomTypeId` VARCHAR(191) NULL,
    `roomCount` INTEGER NOT NULL DEFAULT 1,
    `startDate` DATE NOT NULL,
    `endDate` DATE NOT NULL,
    `releaseDate` DATE NOT NULL,
    `releaseDays` INTEGER NOT NULL DEFAULT 7,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `usedCount` INTEGER NOT NULL DEFAULT 0,
    `note` VARCHAR(191) NULL,
    `contactEmail` VARCHAR(191) NULL,
    `contactPhone` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Allotment_roomTypeId_idx`(`roomTypeId`),
    INDEX `Allotment_startDate_endDate_idx`(`startDate`, `endDate`),
    INDEX `Allotment_releaseDate_idx`(`releaseDate`),
    INDEX `Allotment_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WaitlistEntry` (
    `id` VARCHAR(191) NOT NULL,
    `guestName` VARCHAR(191) NOT NULL,
    `guestEmail` VARCHAR(191) NULL,
    `guestPhone` VARCHAR(191) NULL,
    `guestId` VARCHAR(191) NULL,
    `roomTypeId` VARCHAR(191) NULL,
    `desiredCheckIn` DATE NOT NULL,
    `desiredCheckOut` DATE NOT NULL,
    `pax` INTEGER NOT NULL DEFAULT 2,
    `flexibleDates` BOOLEAN NOT NULL DEFAULT false,
    `flexibilityDays` INTEGER NOT NULL DEFAULT 0,
    `priority` INTEGER NOT NULL DEFAULT 0,
    `status` VARCHAR(191) NOT NULL DEFAULT 'WAITING',
    `notes` VARCHAR(191) NULL,
    `notifiedAt` DATETIME(3) NULL,
    `convertedReservationId` VARCHAR(191) NULL,
    `expiresAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `WaitlistEntry_guestId_idx`(`guestId`),
    INDEX `WaitlistEntry_roomTypeId_idx`(`roomTypeId`),
    INDEX `WaitlistEntry_desiredCheckIn_desiredCheckOut_idx`(`desiredCheckIn`, `desiredCheckOut`),
    INDEX `WaitlistEntry_status_idx`(`status`),
    INDEX `WaitlistEntry_priority_idx`(`priority`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CennikConfig` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'default',
    `currency` VARCHAR(191) NOT NULL DEFAULT 'PLN',
    `vatPercent` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    `pricesAreNetto` BOOLEAN NOT NULL DEFAULT true,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DailyRateOverride` (
    `id` VARCHAR(191) NOT NULL,
    `propertyId` VARCHAR(191) NOT NULL,
    `roomTypeId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `price` DECIMAL(10, 2) NULL,
    `pricePerPerson` DECIMAL(10, 2) NULL,
    `adultPrice` DECIMAL(10, 2) NULL,
    `child1Price` DECIMAL(10, 2) NULL,
    `child2Price` DECIMAL(10, 2) NULL,
    `child3Price` DECIMAL(10, 2) NULL,
    `closedToArrival` BOOLEAN NOT NULL DEFAULT false,
    `closedToDeparture` BOOLEAN NOT NULL DEFAULT false,
    `isClosed` BOOLEAN NOT NULL DEFAULT false,
    `reason` VARCHAR(191) NULL,

    INDEX `DailyRateOverride_propertyId_idx`(`propertyId`),
    INDEX `DailyRateOverride_roomTypeId_idx`(`roomTypeId`),
    INDEX `DailyRateOverride_date_idx`(`date`),
    UNIQUE INDEX `DailyRateOverride_propertyId_roomTypeId_date_key`(`propertyId`, `roomTypeId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LongStayDiscount` (
    `id` VARCHAR(191) NOT NULL,
    `propertyId` VARCHAR(191) NOT NULL,
    `minNights` INTEGER NOT NULL,
    `discountPercent` DECIMAL(5, 2) NULL,
    `discountFixed` DECIMAL(10, 2) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,

    INDEX `LongStayDiscount_propertyId_idx`(`propertyId`),
    UNIQUE INDEX `LongStayDiscount_propertyId_minNights_key`(`propertyId`, `minNights`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ServiceRate` (
    `id` VARCHAR(191) NOT NULL,
    `propertyId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `calculationMethod` VARCHAR(191) NOT NULL DEFAULT 'PER_NIGHT',
    `vatRate` DECIMAL(5, 4) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    INDEX `ServiceRate_propertyId_idx`(`propertyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AgeGroupConfig` (
    `id` VARCHAR(191) NOT NULL,
    `propertyId` VARCHAR(191) NOT NULL,
    `group` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `ageFrom` INTEGER NOT NULL,
    `ageTo` INTEGER NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,

    INDEX `AgeGroupConfig_propertyId_idx`(`propertyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Season` (
    `id` VARCHAR(191) NOT NULL,
    `propertyId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `color` VARCHAR(191) NULL,
    `dateFrom` DATE NOT NULL,
    `dateTo` DATE NOT NULL,
    `year` INTEGER NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,

    INDEX `Season_propertyId_idx`(`propertyId`),
    INDEX `Season_year_idx`(`year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HotelConfig` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'default',
    `name` VARCHAR(191) NOT NULL DEFAULT '',
    `address` VARCHAR(500) NULL,
    `postalCode` VARCHAR(20) NULL,
    `city` VARCHAR(200) NULL,
    `nip` VARCHAR(20) NULL,
    `krs` VARCHAR(20) NULL,
    `logoUrl` VARCHAR(1000) NULL,
    `phone` VARCHAR(50) NULL,
    `email` VARCHAR(254) NULL,
    `website` VARCHAR(500) NULL,
    `defaultCheckInTime` VARCHAR(5) NULL,
    `defaultCheckOutTime` VARCHAR(5) NULL,
    `floors` JSON NULL,
    `customFormFields` JSON NULL,
    `reservationDictionaries` JSON NULL,
    `seasons` JSON NULL,
    `cancellationPolicyTemplates` JSON NULL,
    `authDisabled` BOOLEAN NOT NULL DEFAULT false,
    `sessionSettings` JSON NULL,
    `maxVoidHours` INTEGER NULL,
    `bankAccount` VARCHAR(50) NULL,
    `bankName` VARCHAR(200) NULL,
    `bookingNotificationEmail` VARCHAR(254) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ScheduledReport` (
    `id` VARCHAR(191) NOT NULL,
    `reportType` VARCHAR(191) NOT NULL,
    `scheduleType` VARCHAR(191) NOT NULL DEFAULT 'DAILY',
    `scheduleTime` VARCHAR(5) NOT NULL,
    `scheduleDayOfWeek` INTEGER NULL,
    `recipientEmails` VARCHAR(1000) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `lastRunAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ScheduledReport_enabled_idx`(`enabled`),
    INDEX `ScheduledReport_lastRunAt_idx`(`lastRunAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GroupQuote` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `validUntil` DATE NULL,
    `totalAmount` DECIMAL(12, 2) NULL,
    `items` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EventOrder` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `eventType` VARCHAR(191) NOT NULL DEFAULT 'INNE',
    `clientName` VARCHAR(191) NULL,
    `clientPhone` VARCHAR(191) NULL,
    `clientEmail` VARCHAR(255) NULL,
    `eventDate` DATE NULL,
    `timeStart` VARCHAR(191) NULL,
    `timeEnd` VARCHAR(191) NULL,
    `roomName` VARCHAR(191) NULL,
    `guestCount` INTEGER NULL,
    `adultsCount` INTEGER NULL,
    `children03` INTEGER NULL,
    `children47` INTEGER NULL,
    `orchestraCount` INTEGER NULL,
    `cameramanCount` INTEGER NULL,
    `photographerCount` INTEGER NULL,
    `churchTime` VARCHAR(191) NULL,
    `brideGroomTable` VARCHAR(191) NULL,
    `orchestraTable` VARCHAR(191) NULL,
    `packageId` VARCHAR(191) NULL,
    `cakesAndDesserts` TEXT NULL,
    `menu` JSON NULL,
    `cakeOrderedAt` VARCHAR(191) NULL,
    `cakeArrivalTime` VARCHAR(191) NULL,
    `cakeServedAt` VARCHAR(191) NULL,
    `drinksArrival` VARCHAR(191) NULL,
    `drinksStorage` VARCHAR(191) NULL,
    `champagneStorage` VARCHAR(191) NULL,
    `alcoholUnderStairs` BOOLEAN NOT NULL DEFAULT false,
    `firstBottlesBy` VARCHAR(191) NULL,
    `coolersWithIce` VARCHAR(191) NULL,
    `alcoholServiceBy` VARCHAR(191) NULL,
    `wineLocation` VARCHAR(191) NULL,
    `beerWhen` VARCHAR(191) NULL,
    `alcoholAtTeamTable` BOOLEAN NOT NULL DEFAULT false,
    `cakesSwedishTable` BOOLEAN NOT NULL DEFAULT false,
    `fruitsSwedishTable` BOOLEAN NOT NULL DEFAULT false,
    `ownFlowers` BOOLEAN NOT NULL DEFAULT false,
    `ownVases` BOOLEAN NOT NULL DEFAULT false,
    `decorationColor` VARCHAR(191) NULL,
    `placeCards` BOOLEAN NOT NULL DEFAULT false,
    `placeCardsLayout` VARCHAR(191) NULL,
    `tableLayout` VARCHAR(191) NULL,
    `breadWelcomeBy` VARCHAR(191) NULL,
    `extraAttractions` TEXT NULL,
    `specialRequests` TEXT NULL,
    `facebookConsent` BOOLEAN NOT NULL DEFAULT false,
    `ownNapkins` BOOLEAN NOT NULL DEFAULT false,
    `dutyPerson` VARCHAR(191) NULL,
    `afterpartyEnabled` BOOLEAN NOT NULL DEFAULT false,
    `afterpartyTimeFrom` VARCHAR(191) NULL,
    `afterpartyTimeTo` VARCHAR(191) NULL,
    `afterpartyGuests` INTEGER NULL,
    `afterpartyMenu` TEXT NULL,
    `afterpartyMusic` VARCHAR(191) NULL,
    `googleCalendarEventId` VARCHAR(191) NULL,
    `googleCalendarCalId` VARCHAR(255) NULL,
    `googleCalendarEvents` JSON NULL,
    `googleCalendarSynced` BOOLEAN NOT NULL DEFAULT false,
    `googleCalendarSyncedAt` DATETIME(3) NULL,
    `googleCalendarError` TEXT NULL,
    `googleCalendarUpdatedAt` DATETIME(3) NULL,
    `googleAttachments` JSON NULL,
    `checklistDocId` VARCHAR(191) NULL,
    `menuDocId` VARCHAR(191) NULL,
    `checklistDocUrl` VARCHAR(191) NULL,
    `menuDocUrl` VARCHAR(191) NULL,
    `depositAmount` DECIMAL(10, 2) NULL,
    `depositPaid` BOOLEAN NOT NULL DEFAULT false,
    `depositDueDate` DATE NULL,
    `isPoprawiny` BOOLEAN NOT NULL DEFAULT false,
    `parentEventId` VARCHAR(191) NULL,
    `eventNumber` VARCHAR(20) NULL,
    `quoteId` VARCHAR(191) NULL,
    `roomIds` JSON NULL,
    `dateFrom` DATE NOT NULL,
    `dateTo` DATE NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `notes` TEXT NULL,
    `assignedTo` VARCHAR(255) NULL,
    `checklist` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EventOrder_dateFrom_idx`(`dateFrom`),
    INDEX `EventOrder_status_idx`(`status`),
    INDEX `EventOrder_eventType_idx`(`eventType`),
    INDEX `EventOrder_parentEventId_idx`(`parentEventId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GoogleCalendarWatchChannel` (
    `id` VARCHAR(191) NOT NULL,
    `channelId` VARCHAR(191) NOT NULL,
    `resourceId` VARCHAR(191) NOT NULL,
    `calendarId` VARCHAR(191) NOT NULL,
    `expiration` DATETIME(3) NOT NULL,
    `syncToken` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `isActive` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `GoogleCalendarWatchChannel_channelId_key`(`channelId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Campsite` (
    `id` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'dzia┼éka',
    `pricePerDay` DECIMAL(10, 2) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CampsiteBooking` (
    `id` VARCHAR(191) NOT NULL,
    `campsiteId` VARCHAR(191) NOT NULL,
    `reservationId` VARCHAR(191) NULL,
    `guestId` VARCHAR(191) NULL,
    `startDate` DATE NOT NULL,
    `endDate` DATE NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CampsiteBooking_campsiteId_idx`(`campsiteId`),
    INDEX `CampsiteBooking_reservationId_idx`(`reservationId`),
    INDEX `CampsiteBooking_guestId_idx`(`guestId`),
    INDEX `CampsiteBooking_startDate_endDate_idx`(`startDate`, `endDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RentalItem` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `pricePerDay` DECIMAL(10, 2) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `unit` VARCHAR(191) NOT NULL DEFAULT 'szt',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RentalBooking` (
    `id` VARCHAR(191) NOT NULL,
    `rentalItemId` VARCHAR(191) NOT NULL,
    `reservationId` VARCHAR(191) NULL,
    `guestId` VARCHAR(191) NULL,
    `startDate` DATE NOT NULL,
    `endDate` DATE NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `RentalBooking_rentalItemId_idx`(`rentalItemId`),
    INDEX `RentalBooking_reservationId_idx`(`reservationId`),
    INDEX `RentalBooking_guestId_idx`(`guestId`),
    INDEX `RentalBooking_startDate_endDate_idx`(`startDate`, `endDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SpaResource` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SpaBooking` (
    `id` VARCHAR(191) NOT NULL,
    `resourceId` VARCHAR(191) NOT NULL,
    `reservationId` VARCHAR(191) NULL,
    `start` DATETIME(3) NOT NULL,
    `end` DATETIME(3) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'BOOKED',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `SpaBooking_resourceId_idx`(`resourceId`),
    INDEX `SpaBooking_reservationId_idx`(`reservationId`),
    INDEX `SpaBooking_start_end_idx`(`start`, `end`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MenuItem` (
    `id` VARCHAR(191) NOT NULL,
    `externalId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `dietTags` JSON NULL,
    `allergens` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `MenuItem_externalId_key`(`externalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AssortmentItem` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `defaultPrice` DECIMAL(10, 2) NOT NULL,
    `vatRate` DECIMAL(5, 4) NOT NULL,
    `gtuCode` VARCHAR(191) NULL,
    `category` VARCHAR(191) NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Order` (
    `id` VARCHAR(191) NOT NULL,
    `roomId` VARCHAR(191) NULL,
    `reservationId` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Order_roomId_idx`(`roomId`),
    INDEX `Order_reservationId_idx`(`reservationId`),
    INDEX `Order_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OrderItem` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `menuItemId` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `unitPrice` DECIMAL(10, 2) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `OrderItem_orderId_idx`(`orderId`),
    INDEX `OrderItem_menuItemId_idx`(`menuItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MealConsumption` (
    `id` VARCHAR(191) NOT NULL,
    `reservationId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `mealType` VARCHAR(191) NOT NULL,
    `paxCount` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MealConsumption_date_idx`(`date`),
    INDEX `MealConsumption_reservationId_idx`(`reservationId`),
    UNIQUE INDEX `MealConsumption_reservationId_date_mealType_key`(`reservationId`, `date`, `mealType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LaundryService` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `unit` VARCHAR(191) NOT NULL DEFAULT 'szt',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LaundryOrder` (
    `id` VARCHAR(191) NOT NULL,
    `reservationId` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `requestedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deliveredAt` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `LaundryOrder_reservationId_idx`(`reservationId`),
    INDEX `LaundryOrder_status_idx`(`status`),
    INDEX `LaundryOrder_requestedAt_idx`(`requestedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LaundryOrderItem` (
    `id` VARCHAR(191) NOT NULL,
    `laundryOrderId` VARCHAR(191) NOT NULL,
    `laundryServiceId` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `unitPrice` DECIMAL(10, 2) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LaundryOrderItem_laundryOrderId_idx`(`laundryOrderId`),
    INDEX `LaundryOrderItem_laundryServiceId_idx`(`laundryServiceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TransferBooking` (
    `id` VARCHAR(191) NOT NULL,
    `reservationId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `direction` VARCHAR(191) NOT NULL,
    `scheduledAt` DATETIME(3) NOT NULL,
    `place` VARCHAR(191) NOT NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'BOOKED',
    `chargedAt` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TransferBooking_reservationId_idx`(`reservationId`),
    INDEX `TransferBooking_scheduledAt_idx`(`scheduledAt`),
    INDEX `TransferBooking_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Attraction` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `price` DECIMAL(10, 2) NOT NULL,
    `description` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AttractionBooking` (
    `id` VARCHAR(191) NOT NULL,
    `reservationId` VARCHAR(191) NOT NULL,
    `attractionId` VARCHAR(191) NOT NULL,
    `scheduledAt` DATETIME(3) NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `unitPrice` DECIMAL(10, 2) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'BOOKED',
    `chargedAt` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AttractionBooking_reservationId_idx`(`reservationId`),
    INDEX `AttractionBooking_attractionId_idx`(`attractionId`),
    INDEX `AttractionBooking_scheduledAt_idx`(`scheduledAt`),
    INDEX `AttractionBooking_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmailTemplate` (
    `id` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `bodyHtml` TEXT NOT NULL,
    `bodyText` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `availableVariables` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `EmailTemplate_type_key`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SmsLog` (
    `id` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `recipientPhone` VARCHAR(191) NOT NULL,
    `recipientName` VARCHAR(191) NULL,
    `messageBody` TEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'SENT',
    `errorMessage` VARCHAR(191) NULL,
    `reservationId` VARCHAR(191) NULL,
    `guestId` VARCHAR(191) NULL,
    `provider` VARCHAR(191) NOT NULL DEFAULT 'TWILIO',
    `providerMsgId` VARCHAR(191) NULL,
    `sentByUserId` VARCHAR(191) NULL,
    `metadata` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SmsLog_type_idx`(`type`),
    INDEX `SmsLog_status_idx`(`status`),
    INDEX `SmsLog_reservationId_idx`(`reservationId`),
    INDEX `SmsLog_guestId_idx`(`guestId`),
    INDEX `SmsLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BlindDropRecord` (
    `id` VARCHAR(191) NOT NULL,
    `performedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `countedCash` DECIMAL(12, 2) NOT NULL,
    `expectedCash` DECIMAL(12, 2) NOT NULL,
    `difference` DECIMAL(12, 2) NOT NULL,
    `isShortage` BOOLEAN NOT NULL,
    `performedByUserId` VARCHAR(191) NULL,

    INDEX `BlindDropRecord_performedAt_idx`(`performedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CashShift` (
    `id` VARCHAR(191) NOT NULL,
    `openedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `closedAt` DATETIME(3) NULL,
    `openingBalance` DECIMAL(12, 2) NOT NULL,
    `closingBalance` DECIMAL(12, 2) NULL,
    `expectedCashAtClose` DECIMAL(12, 2) NULL,
    `difference` DECIMAL(12, 2) NULL,
    `openedByUserId` VARCHAR(191) NULL,
    `closedByUserId` VARCHAR(191) NULL,
    `notes` TEXT NULL,

    INDEX `CashShift_openedAt_idx`(`openedAt`),
    INDEX `CashShift_closedAt_idx`(`closedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CashDocument` (
    `id` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `description` VARCHAR(191) NULL,
    `cashShiftId` VARCHAR(191) NULL,
    `reservationId` VARCHAR(191) NULL,
    `invoiceId` VARCHAR(191) NULL,
    `receiptId` VARCHAR(191) NULL,
    `issuedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CashDocument_cashShiftId_idx`(`cashShiftId`),
    INDEX `CashDocument_reservationId_idx`(`reservationId`),
    INDEX `CashDocument_invoiceId_idx`(`invoiceId`),
    INDEX `CashDocument_receiptId_idx`(`receiptId`),
    INDEX `CashDocument_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `passwordChangedAt` DATETIME(3) NULL,
    `role` VARCHAR(191) NOT NULL DEFAULT 'RECEPTION',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `pin` VARCHAR(128) NULL,
    `maxDiscountPercent` DECIMAL(5, 2) NULL,
    `maxDiscountAmount` DECIMAL(12, 2) NULL,
    `maxVoidAmount` DECIMAL(12, 2) NULL,
    `totpSecret` VARCHAR(64) NULL,
    `totpEnabled` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ShiftHandover` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `authorId` VARCHAR(191) NULL,
    `content` TEXT NOT NULL,
    `shiftDate` DATE NULL,
    `propertyId` VARCHAR(191) NULL,

    INDEX `ShiftHandover_createdAt_idx`(`createdAt`),
    INDEX `ShiftHandover_shiftDate_idx`(`shiftDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HotelEvent` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(300) NOT NULL,
    `startDate` DATE NOT NULL,
    `endDate` DATE NULL,
    `eventType` VARCHAR(191) NOT NULL DEFAULT 'OTHER',
    `description` TEXT NULL,
    `color` VARCHAR(20) NULL,
    `propertyId` VARCHAR(191) NULL,
    `isPublic` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `HotelEvent_startDate_idx`(`startDate`),
    INDEX `HotelEvent_propertyId_idx`(`propertyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StaffAnnouncement` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(500) NOT NULL,
    `body` TEXT NOT NULL,
    `authorId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `validUntil` DATE NULL,
    `isPinned` BOOLEAN NOT NULL DEFAULT false,

    INDEX `StaffAnnouncement_createdAt_idx`(`createdAt`),
    INDEX `StaffAnnouncement_validUntil_idx`(`validUntil`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Permission` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Permission_code_key`(`code`),
    INDEX `Permission_code_idx`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RolePermission` (
    `id` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL,
    `permissionId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RolePermission_role_idx`(`role`),
    INDEX `RolePermission_permissionId_idx`(`permissionId`),
    UNIQUE INDEX `RolePermission_role_permissionId_key`(`role`, `permissionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RoleGroup` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `RoleGroup_code_key`(`code`),
    INDEX `RoleGroup_code_idx`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RoleGroupPermission` (
    `id` VARCHAR(191) NOT NULL,
    `roleGroupId` VARCHAR(191) NOT NULL,
    `permissionId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `RoleGroupPermission_roleGroupId_idx`(`roleGroupId`),
    INDEX `RoleGroupPermission_permissionId_idx`(`permissionId`),
    UNIQUE INDEX `RoleGroupPermission_roleGroupId_permissionId_key`(`roleGroupId`, `permissionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LoyaltyProgram` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'default',
    `name` VARCHAR(191) NOT NULL DEFAULT 'Program Lojalno┼Ťciowy',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `pointsPerPln` DECIMAL(10, 4) NOT NULL DEFAULT 1,
    `pointsForCheckIn` INTEGER NOT NULL DEFAULT 0,
    `pointsForBirthday` INTEGER NOT NULL DEFAULT 0,
    `tierCalculationMode` VARCHAR(191) NOT NULL DEFAULT 'POINTS',
    `cardNumberPrefix` VARCHAR(191) NOT NULL DEFAULT 'LOY',
    `cardNumberNextSeq` INTEGER NOT NULL DEFAULT 1,
    `termsUrl` VARCHAR(191) NULL,
    `welcomeMessage` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LoyaltyTier` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `minPoints` INTEGER NOT NULL DEFAULT 0,
    `minStays` INTEGER NOT NULL DEFAULT 0,
    `color` VARCHAR(191) NULL,
    `icon` VARCHAR(191) NULL,
    `discountPercent` DECIMAL(5, 2) NULL,
    `bonusPointsPercent` DECIMAL(5, 2) NULL,
    `earlyCheckIn` BOOLEAN NOT NULL DEFAULT false,
    `lateCheckOut` BOOLEAN NOT NULL DEFAULT false,
    `roomUpgrade` BOOLEAN NOT NULL DEFAULT false,
    `welcomeDrink` BOOLEAN NOT NULL DEFAULT false,
    `freeBreakfast` BOOLEAN NOT NULL DEFAULT false,
    `prioritySupport` BOOLEAN NOT NULL DEFAULT false,
    `loungeAccess` BOOLEAN NOT NULL DEFAULT false,
    `freeParking` BOOLEAN NOT NULL DEFAULT false,
    `customBenefits` JSON NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `LoyaltyTier_code_key`(`code`),
    INDEX `LoyaltyTier_sortOrder_idx`(`sortOrder`),
    INDEX `LoyaltyTier_minPoints_idx`(`minPoints`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LoyaltyTransaction` (
    `id` VARCHAR(191) NOT NULL,
    `guestId` VARCHAR(191) NOT NULL,
    `reservationId` VARCHAR(191) NULL,
    `type` VARCHAR(191) NOT NULL,
    `points` INTEGER NOT NULL,
    `balanceAfter` INTEGER NOT NULL,
    `reason` VARCHAR(191) NULL,
    `referenceType` VARCHAR(191) NULL,
    `referenceId` VARCHAR(191) NULL,
    `expiresAt` DATETIME(3) NULL,
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `LoyaltyTransaction_guestId_idx`(`guestId`),
    INDEX `LoyaltyTransaction_reservationId_idx`(`reservationId`),
    INDEX `LoyaltyTransaction_type_idx`(`type`),
    INDEX `LoyaltyTransaction_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CleaningSchedule` (
    `id` VARCHAR(191) NOT NULL,
    `roomId` VARCHAR(191) NOT NULL,
    `assignedTo` VARCHAR(191) NULL,
    `scheduledDate` DATE NOT NULL,
    `scheduledTime` VARCHAR(191) NULL,
    `estimatedDuration` INTEGER NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `priority` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `completedAt` DATETIME(3) NULL,
    `completedBy` VARCHAR(191) NULL,
    `propertyId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CleaningSchedule_roomId_idx`(`roomId`),
    INDEX `CleaningSchedule_scheduledDate_idx`(`scheduledDate`),
    INDEX `CleaningSchedule_assignedTo_idx`(`assignedTo`),
    INDEX `CleaningSchedule_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MaintenanceIssue` (
    `id` VARCHAR(191) NOT NULL,
    `roomId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `category` VARCHAR(191) NOT NULL,
    `priority` VARCHAR(191) NOT NULL DEFAULT 'MEDIUM',
    `status` VARCHAR(191) NOT NULL DEFAULT 'REPORTED',
    `reportedBy` VARCHAR(191) NULL,
    `reportedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `assignedTo` VARCHAR(191) NULL,
    `assignedAt` DATETIME(3) NULL,
    `resolvedAt` DATETIME(3) NULL,
    `resolvedBy` VARCHAR(191) NULL,
    `resolutionNotes` TEXT NULL,
    `estimatedCost` DECIMAL(10, 2) NULL,
    `actualCost` DECIMAL(10, 2) NULL,
    `roomWasOOO` BOOLEAN NOT NULL DEFAULT false,
    `isScheduled` BOOLEAN NOT NULL DEFAULT false,
    `scheduledStartDate` DATE NULL,
    `scheduledEndDate` DATE NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MaintenanceIssue_roomId_idx`(`roomId`),
    INDEX `MaintenanceIssue_status_idx`(`status`),
    INDEX `MaintenanceIssue_category_idx`(`category`),
    INDEX `MaintenanceIssue_priority_idx`(`priority`),
    INDEX `MaintenanceIssue_reportedAt_idx`(`reportedAt`),
    INDEX `MaintenanceIssue_scheduledEndDate_idx`(`scheduledEndDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DocumentNumberingConfig` (
    `id` VARCHAR(191) NOT NULL,
    `documentType` VARCHAR(191) NOT NULL,
    `prefix` VARCHAR(191) NOT NULL,
    `separator` VARCHAR(191) NOT NULL DEFAULT '/',
    `yearFormat` VARCHAR(191) NOT NULL DEFAULT 'YYYY',
    `sequencePadding` INTEGER NOT NULL DEFAULT 4,
    `resetYearly` BOOLEAN NOT NULL DEFAULT true,
    `includeMonth` BOOLEAN NOT NULL DEFAULT false,
    `seriesLetter` VARCHAR(191) NOT NULL DEFAULT 'A',
    `sequenceStart` INTEGER NOT NULL DEFAULT 1,
    `description` VARCHAR(191) NULL,
    `exampleNumber` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DocumentNumberingConfig_documentType_key`(`documentType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DocumentNumberCounter` (
    `id` VARCHAR(191) NOT NULL,
    `documentType` VARCHAR(191) NOT NULL,
    `year` INTEGER NOT NULL,
    `month` INTEGER NOT NULL DEFAULT 0,
    `lastSequence` INTEGER NOT NULL DEFAULT 0,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DocumentNumberCounter_documentType_idx`(`documentType`),
    UNIQUE INDEX `DocumentNumberCounter_documentType_year_month_key`(`documentType`, `year`, `month`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InvoiceTemplate` (
    `id` VARCHAR(191) NOT NULL,
    `templateType` VARCHAR(191) NOT NULL DEFAULT 'DEFAULT',
    `logoBase64` MEDIUMTEXT NULL,
    `logoUrl` VARCHAR(191) NULL,
    `logoWidth` INTEGER NOT NULL DEFAULT 150,
    `logoPosition` VARCHAR(191) NOT NULL DEFAULT 'left',
    `sellerName` VARCHAR(191) NULL,
    `sellerAddress` VARCHAR(191) NULL,
    `sellerPostalCode` VARCHAR(191) NULL,
    `sellerCity` VARCHAR(191) NULL,
    `sellerNip` VARCHAR(191) NULL,
    `sellerPhone` VARCHAR(191) NULL,
    `sellerEmail` VARCHAR(191) NULL,
    `sellerWebsite` VARCHAR(191) NULL,
    `sellerBankName` VARCHAR(191) NULL,
    `sellerBankAccount` VARCHAR(191) NULL,
    `headerText` TEXT NULL,
    `footerText` TEXT NULL,
    `paperSize` VARCHAR(191) NOT NULL DEFAULT 'A4',
    `fontSize` INTEGER NOT NULL DEFAULT 14,
    `fontFamily` VARCHAR(191) NOT NULL DEFAULT 'system-ui, sans-serif',
    `primaryColor` VARCHAR(191) NOT NULL DEFAULT '#111111',
    `accentColor` VARCHAR(191) NOT NULL DEFAULT '#2563eb',
    `paymentTermsText` TEXT NULL,
    `thanksText` VARCHAR(191) NULL,
    `roomProductName` VARCHAR(191) NULL,
    `defaultPaymentMethod` VARCHAR(191) NULL DEFAULT 'przelew',
    `defaultPaymentDays` INTEGER NULL DEFAULT 14,
    `placeOfIssue` VARCHAR(191) NULL,
    `issuedByName` VARCHAR(191) NULL,
    `showPkwiu` BOOLEAN NOT NULL DEFAULT false,
    `showUnit` BOOLEAN NOT NULL DEFAULT true,
    `showDiscount` BOOLEAN NOT NULL DEFAULT false,
    `defaultUnit` VARCHAR(191) NULL DEFAULT 'szt.',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `InvoiceTemplate_templateType_key`(`templateType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DocumentTemplate` (
    `id` VARCHAR(191) NOT NULL,
    `templateType` VARCHAR(191) NOT NULL,
    `useInvoiceLogo` BOOLEAN NOT NULL DEFAULT true,
    `logoBase64` MEDIUMTEXT NULL,
    `logoUrl` VARCHAR(191) NULL,
    `logoWidth` INTEGER NOT NULL DEFAULT 150,
    `logoPosition` VARCHAR(191) NOT NULL DEFAULT 'left',
    `useInvoiceSeller` BOOLEAN NOT NULL DEFAULT true,
    `hotelName` VARCHAR(191) NULL,
    `hotelAddress` VARCHAR(191) NULL,
    `hotelPostalCode` VARCHAR(191) NULL,
    `hotelCity` VARCHAR(191) NULL,
    `hotelPhone` VARCHAR(191) NULL,
    `hotelEmail` VARCHAR(191) NULL,
    `hotelWebsite` VARCHAR(191) NULL,
    `title` VARCHAR(191) NULL,
    `headerText` TEXT NULL,
    `footerText` TEXT NULL,
    `termsText` TEXT NULL,
    `welcomeText` TEXT NULL,
    `fontSize` INTEGER NOT NULL DEFAULT 14,
    `fontFamily` VARCHAR(191) NOT NULL DEFAULT 'system-ui, sans-serif',
    `primaryColor` VARCHAR(191) NOT NULL DEFAULT '#111111',
    `accentColor` VARCHAR(191) NOT NULL DEFAULT '#2563eb',
    `showIdField` BOOLEAN NOT NULL DEFAULT true,
    `showSignatureField` BOOLEAN NOT NULL DEFAULT true,
    `showVehicleField` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DocumentTemplate_templateType_key`(`templateType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CurrencyExchangeRate` (
    `id` VARCHAR(191) NOT NULL,
    `fromCurrency` VARCHAR(191) NOT NULL DEFAULT 'PLN',
    `toCurrency` VARCHAR(191) NOT NULL,
    `buyRate` DECIMAL(12, 6) NOT NULL,
    `sellRate` DECIMAL(12, 6) NOT NULL,
    `midRate` DECIMAL(12, 6) NOT NULL,
    `source` VARCHAR(191) NOT NULL DEFAULT 'MANUAL',
    `sourceReference` VARCHAR(191) NULL,
    `effectiveDate` DATETIME(3) NOT NULL,
    `expiresAt` DATETIME(3) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CurrencyExchangeRate_fromCurrency_toCurrency_idx`(`fromCurrency`, `toCurrency`),
    INDEX `CurrencyExchangeRate_effectiveDate_idx`(`effectiveDate`),
    INDEX `CurrencyExchangeRate_isActive_idx`(`isActive`),
    UNIQUE INDEX `CurrencyExchangeRate_fromCurrency_toCurrency_effectiveDate_key`(`fromCurrency`, `toCurrency`, `effectiveDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CurrencyConversion` (
    `id` VARCHAR(191) NOT NULL,
    `transactionId` VARCHAR(191) NULL,
    `reservationId` VARCHAR(191) NULL,
    `originalAmount` DECIMAL(12, 2) NOT NULL,
    `originalCurrency` VARCHAR(191) NOT NULL,
    `convertedAmount` DECIMAL(12, 2) NOT NULL,
    `convertedCurrency` VARCHAR(191) NOT NULL DEFAULT 'PLN',
    `exchangeRateId` VARCHAR(191) NULL,
    `appliedRate` DECIMAL(12, 6) NOT NULL,
    `rateType` VARCHAR(191) NOT NULL DEFAULT 'MID',
    `spreadPercent` DECIMAL(5, 2) NULL,
    `spreadAmount` DECIMAL(12, 2) NULL,
    `convertedBy` VARCHAR(191) NULL,
    `convertedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `CurrencyConversion_reservationId_idx`(`reservationId`),
    INDEX `CurrencyConversion_transactionId_idx`(`transactionId`),
    INDEX `CurrencyConversion_originalCurrency_idx`(`originalCurrency`),
    INDEX `CurrencyConversion_convertedAt_idx`(`convertedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GiftVoucher` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'MONETARY',
    `originalValue` DECIMAL(12, 2) NOT NULL,
    `currentBalance` DECIMAL(12, 2) NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'PLN',
    `minPurchaseAmount` DECIMAL(12, 2) NULL,
    `maxDiscountAmount` DECIMAL(12, 2) NULL,
    `maxUsages` INTEGER NULL,
    `usageCount` INTEGER NOT NULL DEFAULT 0,
    `validFrom` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `validUntil` DATETIME(3) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    `purchaserName` VARCHAR(191) NULL,
    `purchaserEmail` VARCHAR(191) NULL,
    `purchaserPhone` VARCHAR(191) NULL,
    `recipientName` VARCHAR(191) NULL,
    `recipientEmail` VARCHAR(191) NULL,
    `recipientMessage` TEXT NULL,
    `purchaseDate` DATETIME(3) NULL,
    `purchasePrice` DECIMAL(12, 2) NULL,
    `purchaseTransactionId` VARCHAR(191) NULL,
    `allowedServices` JSON NULL,
    `allowedRoomTypes` JSON NULL,
    `blackoutDates` JSON NULL,
    `campaignId` VARCHAR(191) NULL,
    `campaignName` VARCHAR(191) NULL,
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `GiftVoucher_code_key`(`code`),
    INDEX `GiftVoucher_code_idx`(`code`),
    INDEX `GiftVoucher_status_idx`(`status`),
    INDEX `GiftVoucher_validUntil_idx`(`validUntil`),
    INDEX `GiftVoucher_purchaserEmail_idx`(`purchaserEmail`),
    INDEX `GiftVoucher_recipientEmail_idx`(`recipientEmail`),
    INDEX `GiftVoucher_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VoucherRedemption` (
    `id` VARCHAR(191) NOT NULL,
    `voucherId` VARCHAR(191) NOT NULL,
    `reservationId` VARCHAR(191) NULL,
    `transactionId` VARCHAR(191) NULL,
    `redeemedAmount` DECIMAL(12, 2) NOT NULL,
    `discountAmount` DECIMAL(12, 2) NOT NULL,
    `originalTotal` DECIMAL(12, 2) NULL,
    `finalTotal` DECIMAL(12, 2) NULL,
    `balanceBefore` DECIMAL(12, 2) NOT NULL,
    `balanceAfter` DECIMAL(12, 2) NOT NULL,
    `guestName` VARCHAR(191) NULL,
    `guestEmail` VARCHAR(191) NULL,
    `redeemedBy` VARCHAR(191) NULL,
    `redeemedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `notes` TEXT NULL,

    INDEX `VoucherRedemption_voucherId_idx`(`voucherId`),
    INDEX `VoucherRedemption_reservationId_idx`(`reservationId`),
    INDEX `VoucherRedemption_redeemedAt_idx`(`redeemedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VoucherTemplate` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'MONETARY',
    `defaultValue` DECIMAL(12, 2) NOT NULL,
    `defaultPrice` DECIMAL(12, 2) NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'PLN',
    `defaultValidityDays` INTEGER NULL,
    `defaultMinPurchase` DECIMAL(12, 2) NULL,
    `defaultMaxDiscount` DECIMAL(12, 2) NULL,
    `defaultMaxUsages` INTEGER NULL,
    `allowedServices` JSON NULL,
    `allowedRoomTypes` JSON NULL,
    `imageUrl` VARCHAR(191) NULL,
    `templateHtml` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `VoucherTemplate_isActive_idx`(`isActive`),
    INDEX `VoucherTemplate_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FiscalReceiptTemplate` (
    `id` VARCHAR(191) NOT NULL,
    `headerLine1` VARCHAR(191) NULL,
    `headerLine2` VARCHAR(191) NULL,
    `headerLine3` VARCHAR(191) NULL,
    `footerLine1` VARCHAR(191) NULL,
    `footerLine2` VARCHAR(191) NULL,
    `footerLine3` VARCHAR(191) NULL,
    `itemNameRoom` VARCHAR(191) NOT NULL DEFAULT 'Nocleg',
    `itemNameDeposit` VARCHAR(191) NOT NULL DEFAULT 'Zaliczka',
    `itemNameMinibar` VARCHAR(191) NOT NULL DEFAULT 'Minibar',
    `itemNameService` VARCHAR(191) NOT NULL DEFAULT 'Us┼éuga',
    `itemNameLocalTax` VARCHAR(191) NOT NULL DEFAULT 'Op┼éata miejscowa',
    `itemNameParking` VARCHAR(191) NOT NULL DEFAULT 'Parking',
    `defaultVatRate` INTEGER NOT NULL DEFAULT 8,
    `includeRoomNumber` BOOLEAN NOT NULL DEFAULT true,
    `includeStayDates` BOOLEAN NOT NULL DEFAULT false,
    `roomNumberFormat` VARCHAR(191) NOT NULL DEFAULT 'pok. {roomNumber}',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FiscalJob` (
    `id` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
    `payload` JSON NOT NULL,
    `result` JSON NULL,
    `error` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,

    INDEX `FiscalJob_status_createdAt_idx`(`status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UnassignedGastronomyCharge` (
    `id` VARCHAR(191) NOT NULL,
    `roomNumber` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `description` TEXT NULL,
    `posSystem` VARCHAR(191) NULL,
    `receiptNumber` VARCHAR(191) NULL,
    `cashierName` VARCHAR(191) NULL,
    `items` JSON NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `assignedToReservationId` VARCHAR(191) NULL,
    `assignedAt` DATETIME(3) NULL,
    `assignedBy` VARCHAR(191) NULL,
    `createdTransactionId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `UnassignedGastronomyCharge_status_idx`(`status`),
    INDEX `UnassignedGastronomyCharge_roomNumber_idx`(`roomNumber`),
    INDEX `UnassignedGastronomyCharge_createdAt_idx`(`createdAt`),
    INDEX `UnassignedGastronomyCharge_assignedToReservationId_idx`(`assignedToReservationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `OwnerSettlement` ADD CONSTRAINT `OwnerSettlement_propertyId_fkey` FOREIGN KEY (`propertyId`) REFERENCES `Property`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChannelPropertyConfig` ADD CONSTRAINT `ChannelPropertyConfig_propertyId_fkey` FOREIGN KEY (`propertyId`) REFERENCES `Property`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChannelMapping` ADD CONSTRAINT `ChannelMapping_propertyId_fkey` FOREIGN KEY (`propertyId`) REFERENCES `Property`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AccountingExport` ADD CONSTRAINT `AccountingExport_propertyId_fkey` FOREIGN KEY (`propertyId`) REFERENCES `Property`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KsefSession` ADD CONSTRAINT `KsefSession_propertyId_fkey` FOREIGN KEY (`propertyId`) REFERENCES `Property`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `KsefSentBatch` ADD CONSTRAINT `KsefSentBatch_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `KsefSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ParkingSpot` ADD CONSTRAINT `ParkingSpot_propertyId_fkey` FOREIGN KEY (`propertyId`) REFERENCES `Property`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ParkingBooking` ADD CONSTRAINT `ParkingBooking_parkingSpotId_fkey` FOREIGN KEY (`parkingSpotId`) REFERENCES `ParkingSpot`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ParkingBooking` ADD CONSTRAINT `ParkingBooking_reservationId_fkey` FOREIGN KEY (`reservationId`) REFERENCES `Reservation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RoomType` ADD CONSTRAINT `RoomType_rateCodeId_fkey` FOREIGN KEY (`rateCodeId`) REFERENCES `RateCode`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RatePlan` ADD CONSTRAINT `RatePlan_roomTypeId_fkey` FOREIGN KEY (`roomTypeId`) REFERENCES `RoomType`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RatePlan` ADD CONSTRAINT `RatePlan_seasonId_fkey` FOREIGN KEY (`seasonId`) REFERENCES `Season`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MinibarConsumption` ADD CONSTRAINT `MinibarConsumption_reservationId_fkey` FOREIGN KEY (`reservationId`) REFERENCES `Reservation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MinibarConsumption` ADD CONSTRAINT `MinibarConsumption_minibarItemId_fkey` FOREIGN KEY (`minibarItemId`) REFERENCES `MinibarItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Room` ADD CONSTRAINT `Room_propertyId_fkey` FOREIGN KEY (`propertyId`) REFERENCES `Property`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RoomGroup` ADD CONSTRAINT `RoomGroup_propertyId_fkey` FOREIGN KEY (`propertyId`) REFERENCES `Property`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RoomGroupRoom` ADD CONSTRAINT `RoomGroupRoom_roomGroupId_fkey` FOREIGN KEY (`roomGroupId`) REFERENCES `RoomGroup`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RoomGroupRoom` ADD CONSTRAINT `RoomGroupRoom_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `Room`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Guest` ADD CONSTRAINT `Guest_loyaltyTierId_fkey` FOREIGN KEY (`loyaltyTierId`) REFERENCES `LoyaltyTier`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GuestDiscount` ADD CONSTRAINT `GuestDiscount_guestId_fkey` FOREIGN KEY (`guestId`) REFERENCES `Guest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GuestAppToken` ADD CONSTRAINT `GuestAppToken_guestId_fkey` FOREIGN KEY (`guestId`) REFERENCES `Guest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GuestRelation` ADD CONSTRAINT `GuestRelation_sourceGuestId_fkey` FOREIGN KEY (`sourceGuestId`) REFERENCES `Guest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GuestRelation` ADD CONSTRAINT `GuestRelation_targetGuestId_fkey` FOREIGN KEY (`targetGuestId`) REFERENCES `Guest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Company` ADD CONSTRAINT `Company_accountManagerId_fkey` FOREIGN KEY (`accountManagerId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReservationOccupant` ADD CONSTRAINT `ReservationOccupant_reservationId_fkey` FOREIGN KEY (`reservationId`) REFERENCES `Reservation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReservationOccupant` ADD CONSTRAINT `ReservationOccupant_guestId_fkey` FOREIGN KEY (`guestId`) REFERENCES `Guest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReservationFolio` ADD CONSTRAINT `ReservationFolio_reservationId_fkey` FOREIGN KEY (`reservationId`) REFERENCES `Reservation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReservationFolio` ADD CONSTRAINT `ReservationFolio_guestId_fkey` FOREIGN KEY (`guestId`) REFERENCES `Guest`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReservationFolio` ADD CONSTRAINT `ReservationFolio_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReservationDayRate` ADD CONSTRAINT `ReservationDayRate_reservationId_fkey` FOREIGN KEY (`reservationId`) REFERENCES `Reservation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TravelAgent` ADD CONSTRAINT `TravelAgent_rateCodeId_fkey` FOREIGN KEY (`rateCodeId`) REFERENCES `RateCode`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CorporateContract` ADD CONSTRAINT `CorporateContract_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CorporateContract` ADD CONSTRAINT `CorporateContract_rateCodeId_fkey` FOREIGN KEY (`rateCodeId`) REFERENCES `RateCode`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Reservation` ADD CONSTRAINT `Reservation_guestId_fkey` FOREIGN KEY (`guestId`) REFERENCES `Guest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Reservation` ADD CONSTRAINT `Reservation_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `Room`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Reservation` ADD CONSTRAINT `Reservation_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Reservation` ADD CONSTRAINT `Reservation_rateCodeId_fkey` FOREIGN KEY (`rateCodeId`) REFERENCES `RateCode`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Reservation` ADD CONSTRAINT `Reservation_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `ReservationGroup`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Reservation` ADD CONSTRAINT `Reservation_travelAgentId_fkey` FOREIGN KEY (`travelAgentId`) REFERENCES `TravelAgent`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Reservation` ADD CONSTRAINT `Reservation_packageId_fkey` FOREIGN KEY (`packageId`) REFERENCES `Package`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SurchargeType` ADD CONSTRAINT `SurchargeType_propertyId_fkey` FOREIGN KEY (`propertyId`) REFERENCES `Property`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReservationSurcharge` ADD CONSTRAINT `ReservationSurcharge_reservationId_fkey` FOREIGN KEY (`reservationId`) REFERENCES `Reservation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReservationSurcharge` ADD CONSTRAINT `ReservationSurcharge_surchargeTypeId_fkey` FOREIGN KEY (`surchargeTypeId`) REFERENCES `SurchargeType`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Package` ADD CONSTRAINT `Package_propertyId_fkey` FOREIGN KEY (`propertyId`) REFERENCES `Property`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PackageComponent` ADD CONSTRAINT `PackageComponent_packageId_fkey` FOREIGN KEY (`packageId`) REFERENCES `Package`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MenuPackageSection` ADD CONSTRAINT `MenuPackageSection_packageId_fkey` FOREIGN KEY (`packageId`) REFERENCES `MenuPackage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MenuPackageSurcharge` ADD CONSTRAINT `MenuPackageSurcharge_packageId_fkey` FOREIGN KEY (`packageId`) REFERENCES `MenuPackage`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShopProduct` ADD CONSTRAINT `ShopProduct_propertyId_fkey` FOREIGN KEY (`propertyId`) REFERENCES `Property`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReceptionSale` ADD CONSTRAINT `ReceptionSale_reservationId_fkey` FOREIGN KEY (`reservationId`) REFERENCES `Reservation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReceptionSale` ADD CONSTRAINT `ReceptionSale_guestId_fkey` FOREIGN KEY (`guestId`) REFERENCES `Guest`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReceptionSaleItem` ADD CONSTRAINT `ReceptionSaleItem_receptionSaleId_fkey` FOREIGN KEY (`receptionSaleId`) REFERENCES `ReceptionSale`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReceptionSaleItem` ADD CONSTRAINT `ReceptionSaleItem_shopProductId_fkey` FOREIGN KEY (`shopProductId`) REFERENCES `ShopProduct`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PhoneCallLog` ADD CONSTRAINT `PhoneCallLog_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `Room`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PhoneCallLog` ADD CONSTRAINT `PhoneCallLog_reservationId_fkey` FOREIGN KEY (`reservationId`) REFERENCES `Reservation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DunningLog` ADD CONSTRAINT `DunningLog_reservationId_fkey` FOREIGN KEY (`reservationId`) REFERENCES `Reservation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CollectionCase` ADD CONSTRAINT `CollectionCase_reservationId_fkey` FOREIGN KEY (`reservationId`) REFERENCES `Reservation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_reservationId_fkey` FOREIGN KEY (`reservationId`) REFERENCES `Reservation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_appliesToTransactionId_fkey` FOREIGN KEY (`appliesToTransactionId`) REFERENCES `Transaction`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transaction` ADD CONSTRAINT `Transaction_refundedTransactionId_fkey` FOREIGN KEY (`refundedTransactionId`) REFERENCES `Transaction`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Proforma` ADD CONSTRAINT `Proforma_reservationId_fkey` FOREIGN KEY (`reservationId`) REFERENCES `Reservation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_reservationId_fkey` FOREIGN KEY (`reservationId`) REFERENCES `Reservation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Invoice` ADD CONSTRAINT `Invoice_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceReservation` ADD CONSTRAINT `InvoiceReservation_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceReservation` ADD CONSTRAINT `InvoiceReservation_reservationId_fkey` FOREIGN KEY (`reservationId`) REFERENCES `Reservation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceLineItem` ADD CONSTRAINT `InvoiceLineItem_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InvoiceCorrection` ADD CONSTRAINT `InvoiceCorrection_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Receipt` ADD CONSTRAINT `Receipt_reservationId_fkey` FOREIGN KEY (`reservationId`) REFERENCES `Reservation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AccountingNote` ADD CONSTRAINT `AccountingNote_reservationId_fkey` FOREIGN KEY (`reservationId`) REFERENCES `Reservation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AccountingNote` ADD CONSTRAINT `AccountingNote_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentLink` ADD CONSTRAINT `PaymentLink_reservationId_fkey` FOREIGN KEY (`reservationId`) REFERENCES `Reservation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CardPreauth` ADD CONSTRAINT `CardPreauth_reservationId_fkey` FOREIGN KEY (`reservationId`) REFERENCES `Reservation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WebCheckInToken` ADD CONSTRAINT `WebCheckInToken_reservationId_fkey` FOREIGN KEY (`reservationId`) REFERENCES `Reservation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RoomBlock` ADD CONSTRAINT `RoomBlock_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `Room`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Allotment` ADD CONSTRAINT `Allotment_roomTypeId_fkey` FOREIGN KEY (`roomTypeId`) REFERENCES `RoomType`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WaitlistEntry` ADD CONSTRAINT `WaitlistEntry_guestId_fkey` FOREIGN KEY (`guestId`) REFERENCES `Guest`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WaitlistEntry` ADD CONSTRAINT `WaitlistEntry_roomTypeId_fkey` FOREIGN KEY (`roomTypeId`) REFERENCES `RoomType`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DailyRateOverride` ADD CONSTRAINT `DailyRateOverride_propertyId_fkey` FOREIGN KEY (`propertyId`) REFERENCES `Property`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DailyRateOverride` ADD CONSTRAINT `DailyRateOverride_roomTypeId_fkey` FOREIGN KEY (`roomTypeId`) REFERENCES `RoomType`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LongStayDiscount` ADD CONSTRAINT `LongStayDiscount_propertyId_fkey` FOREIGN KEY (`propertyId`) REFERENCES `Property`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ServiceRate` ADD CONSTRAINT `ServiceRate_propertyId_fkey` FOREIGN KEY (`propertyId`) REFERENCES `Property`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AgeGroupConfig` ADD CONSTRAINT `AgeGroupConfig_propertyId_fkey` FOREIGN KEY (`propertyId`) REFERENCES `Property`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Season` ADD CONSTRAINT `Season_propertyId_fkey` FOREIGN KEY (`propertyId`) REFERENCES `Property`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CampsiteBooking` ADD CONSTRAINT `CampsiteBooking_campsiteId_fkey` FOREIGN KEY (`campsiteId`) REFERENCES `Campsite`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CampsiteBooking` ADD CONSTRAINT `CampsiteBooking_reservationId_fkey` FOREIGN KEY (`reservationId`) REFERENCES `Reservation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CampsiteBooking` ADD CONSTRAINT `CampsiteBooking_guestId_fkey` FOREIGN KEY (`guestId`) REFERENCES `Guest`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RentalBooking` ADD CONSTRAINT `RentalBooking_rentalItemId_fkey` FOREIGN KEY (`rentalItemId`) REFERENCES `RentalItem`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RentalBooking` ADD CONSTRAINT `RentalBooking_reservationId_fkey` FOREIGN KEY (`reservationId`) REFERENCES `Reservation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RentalBooking` ADD CONSTRAINT `RentalBooking_guestId_fkey` FOREIGN KEY (`guestId`) REFERENCES `Guest`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SpaBooking` ADD CONSTRAINT `SpaBooking_resourceId_fkey` FOREIGN KEY (`resourceId`) REFERENCES `SpaResource`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SpaBooking` ADD CONSTRAINT `SpaBooking_reservationId_fkey` FOREIGN KEY (`reservationId`) REFERENCES `Reservation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `Room`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Order` ADD CONSTRAINT `Order_reservationId_fkey` FOREIGN KEY (`reservationId`) REFERENCES `Reservation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OrderItem` ADD CONSTRAINT `OrderItem_menuItemId_fkey` FOREIGN KEY (`menuItemId`) REFERENCES `MenuItem`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MealConsumption` ADD CONSTRAINT `MealConsumption_reservationId_fkey` FOREIGN KEY (`reservationId`) REFERENCES `Reservation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LaundryOrder` ADD CONSTRAINT `LaundryOrder_reservationId_fkey` FOREIGN KEY (`reservationId`) REFERENCES `Reservation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LaundryOrderItem` ADD CONSTRAINT `LaundryOrderItem_laundryOrderId_fkey` FOREIGN KEY (`laundryOrderId`) REFERENCES `LaundryOrder`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LaundryOrderItem` ADD CONSTRAINT `LaundryOrderItem_laundryServiceId_fkey` FOREIGN KEY (`laundryServiceId`) REFERENCES `LaundryService`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TransferBooking` ADD CONSTRAINT `TransferBooking_reservationId_fkey` FOREIGN KEY (`reservationId`) REFERENCES `Reservation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttractionBooking` ADD CONSTRAINT `AttractionBooking_reservationId_fkey` FOREIGN KEY (`reservationId`) REFERENCES `Reservation`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AttractionBooking` ADD CONSTRAINT `AttractionBooking_attractionId_fkey` FOREIGN KEY (`attractionId`) REFERENCES `Attraction`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BlindDropRecord` ADD CONSTRAINT `BlindDropRecord_performedByUserId_fkey` FOREIGN KEY (`performedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CashShift` ADD CONSTRAINT `CashShift_openedByUserId_fkey` FOREIGN KEY (`openedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CashShift` ADD CONSTRAINT `CashShift_closedByUserId_fkey` FOREIGN KEY (`closedByUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CashDocument` ADD CONSTRAINT `CashDocument_cashShiftId_fkey` FOREIGN KEY (`cashShiftId`) REFERENCES `CashShift`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CashDocument` ADD CONSTRAINT `CashDocument_reservationId_fkey` FOREIGN KEY (`reservationId`) REFERENCES `Reservation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CashDocument` ADD CONSTRAINT `CashDocument_invoiceId_fkey` FOREIGN KEY (`invoiceId`) REFERENCES `Invoice`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CashDocument` ADD CONSTRAINT `CashDocument_receiptId_fkey` FOREIGN KEY (`receiptId`) REFERENCES `Receipt`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ShiftHandover` ADD CONSTRAINT `ShiftHandover_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StaffAnnouncement` ADD CONSTRAINT `StaffAnnouncement_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RolePermission` ADD CONSTRAINT `RolePermission_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `Permission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RoleGroupPermission` ADD CONSTRAINT `RoleGroupPermission_roleGroupId_fkey` FOREIGN KEY (`roleGroupId`) REFERENCES `RoleGroup`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RoleGroupPermission` ADD CONSTRAINT `RoleGroupPermission_permissionId_fkey` FOREIGN KEY (`permissionId`) REFERENCES `Permission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LoyaltyTransaction` ADD CONSTRAINT `LoyaltyTransaction_guestId_fkey` FOREIGN KEY (`guestId`) REFERENCES `Guest`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CleaningSchedule` ADD CONSTRAINT `CleaningSchedule_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `Room`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MaintenanceIssue` ADD CONSTRAINT `MaintenanceIssue_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `Room`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VoucherRedemption` ADD CONSTRAINT `VoucherRedemption_voucherId_fkey` FOREIGN KEY (`voucherId`) REFERENCES `GiftVoucher`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UnassignedGastronomyCharge` ADD CONSTRAINT `UnassignedGastronomyCharge_assignedToReservationId_fkey` FOREIGN KEY (`assignedToReservationId`) REFERENCES `Reservation`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

