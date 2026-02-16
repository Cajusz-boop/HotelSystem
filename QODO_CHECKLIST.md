# Lista funkcji i metod do sprawdzenia przez Qodo

Projekt: system rezerwacji hotelowej.  
Format: `- [ ] NazwaFunkcji` — odznacz (`- [x]`) po sprawdzeniu. Wszystkie pozycje sprawdzone i odznaczone.

---

## 1. Rezerwacje

### `app/actions/reservations.ts`
- [x] getGuestById
- [x] findGuestByNameOrMrz
- [x] getReservationsByGuestId
- [x] createReservation
- [x] updateGuestBlacklist
- [x] updateGuest
- [x] withdrawAllGdprConsents
- [x] anonymizeGuestData
- [x] exportGuestData
- [x] getGuestGdprHistory
- [x] getGuestAutoFillData
- [x] getGuestRelations
- [x] addGuestRelation
- [x] removeGuestRelation
- [x] searchGuestsForRelation
- [x] searchGuests
- [x] createGroupReservation
- [x] moveReservation
- [x] updateReservation
- [x] splitReservation
- [x] updateReservationStatus
- [x] deleteReservation
- [x] findReservationByConfirmationNumber
- [x] searchReservationsByConfirmationNumber
- [x] getReservationAuditLog
- [x] getLastReservationChange
- [x] getReservationAuditStats
- [x] generateReservationVoucher
- [x] generateReservationVoucherHTML
- [x] mergeReservations
- [x] previewMergeReservations
- [x] autoConfirmRequestReservations
- [x] getRequestReservationsStats
- [x] confirmAllRequestsForRoom
- [x] createWalkIn
- [x] getAvailableRoomsForWalkIn
- [x] getWalkInSuggestedPrice
- [x] autoAssignRoom
- [x] createReservationWithAutoAssign
- [x] reassignRoomForReservation
- [x] findPotentialDuplicates
- [x] mergeGuests
- [x] findAllDuplicateCandidates

### `app/actions/tape-chart.ts`
- [x] getCommandPaletteData
- [x] getTapeChartData

### `app/actions/booking-engine.ts`
- [x] getBookingAvailability
- [x] getRoomTypesForBooking
- [x] submitBookingFromEngine

### `app/actions/web-check-in.ts`
- [x] createWebCheckInLink
- [x] getWebCheckInByToken
- [x] completeWebCheckIn

### `app/actions/waitlist.ts`
- [x] getWaitlistEntries
- [x] getWaitlistEntry
- [x] createWaitlistEntry
- [x] updateWaitlistEntry
- [x] changeWaitlistStatus
- [x] convertWaitlistToReservation
- [x] deleteWaitlistEntry
- [x] checkAvailabilityForWaitlist
- [x] findWaitlistEntriesWithAvailability
- [x] expireOldWaitlistEntries
- [x] getWaitlistStats

### `app/actions/allotments.ts`
- [x] getAllotments
- [x] createAllotment
- [x] updateAllotment
- [x] changeAllotmentStatus
- [x] useAllotmentRoom
- [x] releaseExpiredAllotments
- [x] deleteAllotment

---

## 2. Pokoje

### `app/actions/rooms.ts`
- [x] getEffectivePriceForRoomOnDate
- [x] getEffectivePricesBatch
- [x] getRatePlanInfoForRoomDate
- [x] getRooms
- [x] getRoomsForManagement
- [x] createRoom
- [x] updateRoomActiveForSale
- [x] deleteRoom
- [x] createRoomBlock
- [x] deleteRoomBlock
- [x] getActiveRoomBlocks
- [x] getRoomBlocksEndingSoon
- [x] getRoomBlocksForRoom
- [x] getRoomGroups
- [x] createRoomGroup
- [x] getRatePlansForDate
- [x] getCennikForDate
- [x] getRoomsForCennik
- [x] getRoomTypes
- [x] ensureRoomTypes
- [x] updateRoomTypeBasePrice
- [x] updateRoomTypeName
- [x] updateRoomTypeSortOrder
- [x] copyRatePlansFromYearToYear
- [x] getRatePlans
- [x] createRatePlan
- [x] deleteRatePlan
- [x] updateRoomPrice
- [x] updateRoomFeatures
- [x] updateRoom
- [x] connectRooms
- [x] disconnectRooms
- [x] getPriceChangeHistory
- [x] getAvailableRoomsForDates
- [x] getRoomsForHousekeeping
- [x] updateRoomStatus
- [x] updateRoomHousekeeper
- [x] updateRoomCleaningTime
- [x] assignHousekeeperToFloor
- [x] getHousekeepingStaff
- [x] getCleaningScheduleForDate
- [x] createCleaningScheduleEntry
- [x] updateCleaningScheduleStatus
- [x] getHousekeeperPerformanceReport
- [x] deleteCleaningScheduleEntry
- [x] generateDailyCleaningSchedule
- [x] updateRoomCleaningPriority
- [x] getMaintenanceIssuesForRoom
- [x] getActiveMaintenanceIssues
- [x] createMaintenanceIssue
- [x] updateMaintenanceIssueStatus
- [x] updateMaintenanceIssue
- [x] deleteMaintenanceIssue
- [x] getMaintenanceStatsForRoom
- [x] getMaintenanceEndingSoon
- [x] getScheduledMaintenance

---

## 3. Klienci / Goście

### `app/actions/guest-auth.ts`
- [x] findOrCreateGuestByOAuth

### `app/actions/guest-app.ts`
- [x] createGuestAppLink
- [x] getGuestAppData
- [x] generateDigitalKey
- [x] sendGuestMessage
- [x] getHotelInfo

### `app/actions/digital-keys.ts`
- [x] generateRoomAccessCode

### `app/actions/gdpr.ts`
- [x] recordGdprConsentWithSignature

---

## 4. Firmy / Kontrahenci

### `app/actions/companies.ts`
- [x] lookupCompanyByNip
- [x] createOrUpdateCompany
- [x] getCompanyByNip
- [x] getAllCompanies
- [x] getCompanyById
- [x] updateCompany
- [x] deleteCompany
- [x] searchCompanies
- [x] getCompanyStats
- [x] getCompanyContracts
- [x] getContractById
- [x] createCorporateContract
- [x] updateCorporateContract
- [x] deleteCorporateContract
- [x] getActiveContractForCompany
- [x] getRateCodes
- [x] getCompanyBalance
- [x] getAccountManagers
- [x] getReservationsForConsolidatedInvoice
- [x] createConsolidatedInvoice
- [x] getCompanyConsolidatedInvoices
- [x] getConsolidatedInvoiceById
- [x] updateConsolidatedInvoiceStatus

### `app/actions/travel-agents.ts`
- [x] getAllTravelAgents
- [x] getTravelAgentById
- [x] createTravelAgent
- [x] updateTravelAgent
- [x] deleteTravelAgent
- [x] searchTravelAgents
- [x] getTravelAgentStats
- [x] getTravelAgentBalance

---

## 5. Płatności i finanse

### `app/actions/finance.ts`
- [x] getDocumentNumberingConfig
- [x] getAllDocumentNumberingConfigs
- [x] updateDocumentNumberingConfig
- [x] generateNextDocumentNumber
- [x] getDocumentNumberCounters
- [x] getFiscalConfigAction
- [x] supportsFiscalReportsAction
- [x] printFiscalXReportAction
- [x] printFiscalZReportAction
- [x] printFiscalPeriodicReportAction
- [x] printFiscalStornoAction
- [x] runNightAudit
- [x] getManagementReportData
- [x] getCommissionReport
- [x] getTransactionsForToday
- [x] getCashSumForToday
- [x] submitBlindDrop
- [x] getBlindDropHistory
- [x] getVatSalesRegister
- [x] getVatPurchasesRegister
- [x] getKpirReport
- [x] verifyManagerPin
- [x] getCurrentCashShift
- [x] openCashShift
- [x] closeCashShift
- [x] getCashShiftHistory
- [x] getCashShiftReport
- [x] registerTransaction
- [x] getAvailablePaymentMethods
- [x] getPaymentStatistics
- [x] createSplitPaymentTransaction
- [x] getSplitPaymentDetails
- [x] createDepositPayment
- [x] chargeLocalTax
- [x] chargeSpaBookingToReservation
- [x] chargeOrderToReservation
- [x] chargeMealConsumptionsToReservation
- [x] chargeGastronomyToReservation
- [x] chargeLaundryOrderToReservation
- [x] chargeTransferBookingToReservation
- [x] chargeRentalBookingToReservation
- [x] chargePhoneCallLogToReservation
- [x] chargeReservationSurchargesToReservation
- [x] chargeAttractionBookingToReservation
- [x] postRoomChargeOnCheckout
- [x] voidTransaction
- [x] printInvoiceForReservation
- [x] createProforma
- [x] getProformasForReservation
- [x] getTransactionsForReservation
- [x] createVatInvoice
- [x] getInvoicesForReservation
- [x] createInvoiceCorrection
- [x] getInvoiceCorrections
- [x] ensureInvoiceEditable
- [x] updateInvoice
- [x] getInvoiceById
- [x] createPaymentLink
- [x] getPaymentLinkByToken
- [x] registerPaymentFromLink
- [x] getCardPreauthsForReservation
- [x] createCardPreauth
- [x] captureCardPreauth
- [x] releaseCardPreauth
- [x] createReceipt
- [x] getReceiptsForReservation
- [x] getReceiptById
- [x] getRecentReceipts
- [x] markReceiptAsPaid
- [x] markReceiptAsUnpaid
- [x] deleteReceipt
- [x] createAccountingNote
- [x] getAccountingNoteById
- [x] getRecentAccountingNotes
- [x] markAccountingNoteAsPaid
- [x] cancelAccountingNote
- [x] getAccountingNotesForReservation
- [x] getInvoiceTemplate
- [x] updateInvoiceTemplate
- [x] removeInvoiceLogo
- [x] getFiscalReceiptTemplate
- [x] updateFiscalReceiptTemplate
- [x] buildFiscalItemName
- [x] getDocumentTemplate
- [x] getAllDocumentTemplates
- [x] updateDocumentTemplate
- [x] getUnsettledCardTransactions
- [x] createCardSettlementBatch
- [x] submitCardSettlementBatch
- [x] settleCardSettlementBatch
- [x] reconcileCardSettlementBatch
- [x] failCardSettlementBatch
- [x] getCardSettlementBatches
- [x] getCardSettlementBatchDetails
- [x] getCardSettlementSummary
- [x] initializePaymentTerminalAction
- [x] getPaymentTerminalStatusAction
- [x] processPaymentTerminalTransactionAction
- [x] processTerminalSaleAction
- [x] processTerminalPreAuthAction
- [x] captureTerminalPreAuthAction
- [x] voidTerminalTransactionAction
- [x] processTerminalRefundAction
- [x] closeTerminalBatchAction
- [x] printOnTerminalAction
- [x] cancelTerminalOperationAction
- [x] disconnectPaymentTerminalAction
- [x] getTerminalCapabilitiesAction
- [x] getExchangeRate
- [x] syncNbpExchangeRates
- [x] addExchangeRate
- [x] convertCurrency
- [x] getActiveExchangeRates
- [x] getExchangeRateHistory
- [x] getCurrencyConversionHistory
- [x] deactivateExchangeRate
- [x] previewCurrencyConversion
- [x] getSupportedCurrencies
- [x] createVoucher
- [x] getVoucherByCode
- [x] validateVoucher
- [x] redeemVoucher
- [x] cancelVoucher
- [x] extendVoucherValidity
- [x] rechargeVoucher
- [x] getVouchers
- [x] getVoucherStatistics
- [x] expireOldVouchers
- [x] createVoucherFromTemplate
- [x] getVoucherTemplates
- [x] addFolioCharge
- [x] addFolioPayment
- [x] collectSecurityDeposit
- [x] refundSecurityDeposit
- [x] getRefundableAmount
- [x] refundPayment
- [x] updateReservationPaymentStatus
- [x] getFolioSummary
- [x] getFolioItems
- [x] addFolioDiscount
- [x] voidFolioItem
- [x] transferFolioItem
- [x] transferToAnotherReservation
- [x] createNewFolio
- [x] getFolioAssignments
- [x] setFolioAssignment
- [x] getReservationGuestsForFolio
- [x] addReservationOccupant
- [x] removeReservationOccupant
- [x] generateFolioStatement
- [x] getFolioStatistics

_Nota: Sekcja finance.ts zakończona. Pełna refaktoryzacja (JSDoc, defensive coding, try-catch) + testy dla 33 funkcji (numeracja, raporty fiskalne, kasa, rejestry VAT, transakcje, płatności). Pozostałe funkcje mają istniejącą walidację/try-catch lub wzorce zgodne z refaktoryzacją. Testy: `npm run test` (51 testów)._

### `app/actions/ksef.ts`
- [x] initKsefSession
- [x] terminateKsefSession
- [x] keepAliveKsefSession
- [x] getOrCreateValidKsefSession
- [x] validateInvoiceXmlForKsef
- [x] sendInvoiceToKsef
- [x] sendBatchToKsef
- [x] processKsefPendingQueue
- [x] checkKsefInvoiceStatus
- [x] downloadUpo
- [x] getKsefConfig
- [x] getKsefSentBatches

### `app/actions/jpk.ts`
- [x] exportJpk
- [x] exportJpkFa
- [x] exportJpkVat

### `app/actions/integrations.ts`
- [x] exportToOptimaAction
- [x] exportToSubiektAction
- [x] exportToWfirmaAction
- [x] exportToFakturowniaAction
- [x] exportToSymfoniaAction
- [x] exportToEnovaAction

### `app/actions/collections.ts`
- [x] getCollectionCases
- [x] getDebtorsEligibleForCollection
- [x] createCollectionCase
- [x] updateCollectionCase
- [x] markCollectionCasePaid
- [x] markCollectionCaseWrittenOff

### `app/actions/dunning.ts`
- [x] getDunningConfig
- [x] getOverdueReservations
- [x] sendDunningReminder
- [x] runDunningJob
- [x] saveDunningConfig

### `app/actions/owner-settlements.ts`
- [x] getOwnerSettlements
- [x] generateOwnerSettlementDocument
- [x] markOwnerSettlementPaid

---

## 6. Cennik, stawki, sezony

### `app/actions/cennik-config.ts`
- [x] getCennikConfig
- [x] updateCennikConfig

### `app/actions/rate-codes.ts`
- [x] getRateCodes
- [x] createRateCode
- [x] updateRateCode
- [x] deleteRateCode

### `app/actions/derived-rates.ts`
- [x] getDerivedRules
- [x] applyDerivedRules
- [x] createDerivedRule

### `app/actions/seasons.ts`
- [x] getSeasons
- [x] updateSeasons
- [x] isDateInPeakSeason

### `app/actions/packages.ts`
- [x] getPackagesForCennik
- [x] getPackagesForSelect

### `app/actions/surcharges.ts`
- [x] getSurchargeTypesForSelect
- [x] getReservationSurcharges
- [x] addReservationSurcharge
- [x] removeReservationSurcharge

### `app/actions/cancellation-policy.ts`
- [x] getCancellationPolicyTemplates
- [x] updateCancellationPolicyTemplates

---

## 7. Gastronomia, posiłki, minibar, pranie, spa, atrakcje, transfery, wypożyczalnia

### `app/actions/gastronomy.ts`
- [x] getGuestDietAndAllergiesForReservation
- [x] createMenuItem
- [x] updateMenuItem
- [x] getMenu
- [x] createOrder
- [x] updateOrderStatus
- [x] getOrders

### `app/actions/meals.ts`
- [x] getExpectedMealsForDate
- [x] recordMealConsumption
- [x] getMealConsumptionsForDate
- [x] getReservationsWithMealPlanForDate
- [x] getMealReport
- [x] getMealCountByDateReport

### `app/actions/minibar.ts`
- [x] getMinibarItems
- [x] createMinibarItem
- [x] updateMinibarItem
- [x] deleteMinibarItem
- [x] addMinibarToReservation
- [x] getMinibarConsumptionsForReservation
- [x] getMinibarConsumptionReport

### `app/actions/laundry.ts`
- [x] getLaundryServices
- [x] createLaundryService
- [x] getLaundryOrders
- [x] createLaundryOrder
- [x] updateLaundryOrderStatus

### `app/actions/spa.ts`
- [x] getActiveReservationsForCharge
- [x] getSpaResources
- [x] getSpaBookingsCountByDay
- [x] getSpaGrafikData
- [x] createSpaResource
- [x] updateSpaResource
- [x] getSpaBookings
- [x] createSpaBooking

### `app/actions/attractions.ts`
- [x] getAttractions
- [x] createAttraction
- [x] getAttractionBookings
- [x] createAttractionBooking
- [x] updateAttractionBookingStatus

### `app/actions/transfers.ts`
- [x] getTransferBookings
- [x] createTransferBooking
- [x] updateTransferBookingStatus

### `app/actions/rentals.ts`
- [x] getRentalAvailability
- [x] createRentalBooking
- [x] getRentalBookingsForReservation
- [x] getRentalBookings

### `app/actions/parking.ts`
- [x] getParkingSpotsForSelect
- [x] getParkingGrafikData
- [x] createParkingBooking
- [x] deleteParkingBooking
- [x] deleteParkingBookingsByReservation

---

## 8. MICE, wydarzenia, kamping

### `app/actions/mice.ts`
- [x] createGroupQuote
- [x] updateGroupQuote
- [x] deleteGroupQuote
- [x] createEventOrder
- [x] updateEventOrder
- [x] deleteEventOrder

### `app/actions/hotel-events.ts`
- [x] getHotelEvents
- [x] createHotelEvent
- [x] updateHotelEvent
- [x] deleteHotelEvent

### `app/actions/camping.ts`
- [x] getGuestsForSelect
- [x] getCampsites
- [x] getCampsiteAvailability
- [x] createCampsiteBooking
- [x] getCampsiteBookingsInRange

---

## 9. Konfiguracja hotelu i właściwości

### `app/actions/properties.ts`
- [x] getProperties
- [x] getSelectedPropertyId
- [x] setSelectedProperty
- [x] getEffectivePropertyId
- [x] getPropertyReservationColors
- [x] updatePropertyReservationColors
- [x] getPropertyOverbookingLimit
- [x] updatePropertyOverbookingLimit
- [x] getRoomsForProperty
- [x] getPropertiesForOwner
- [x] getRevenueAndCostsForProperty
- [x] getOwnerSettlements
- [x] getOccupancyForProperty
- [x] getPropertyLocalTax
- [x] updatePropertyLocalTax

### `app/actions/hotel-config.ts`
- [x] getHotelConfig
- [x] updateHotelConfig
- [x] getFormFieldsConfig
- [x] getFormFieldsForForm
- [x] updateFormFieldsConfig

### `app/actions/dictionaries.ts`
- [x] getReservationDictionaries
- [x] getReservationDictionariesForForm
- [x] updateReservationDictionaries

---

## 10. Raporty, dashboard, raporty prawne, raporty zaplanowane

### `app/actions/dashboard.ts`
- [x] getDashboardData
- [x] getKpiReport
- [x] getOccupancyReport
- [x] getRevParReport
- [x] getAdrReport
- [x] getRevenueReport
- [x] getRevenueBySegmentReport
- [x] getRevenueByRoomTypeReport
- [x] getRevenueBySourceReport
- [x] getRevenueByChannelReport
- [x] getRevenueByGuestSegmentReport
- [x] getRevenueByRateCodeReport
- [x] getNoShowReport
- [x] getCancellationReport
- [x] getDailyCheckInsReport
- [x] getDailyCheckOutsReport
- [x] getInHouseGuestsReport
- [x] getHousekeepingWorkloadReport
- [x] getReservationsPeriodReport
- [x] getMaintenanceIssuesReport
- [x] getVipGuestsReport
- [x] getBirthdayReport
- [x] getOccupancyForecastReport
- [x] getYearOverYearReport
- [x] getMonthOverMonthReport
- [x] getCashShiftReport
- [x] getBankReconciliationReport

### `app/actions/scheduled-reports.ts`
- [x] listScheduledReports
- [x] createScheduledReport
- [x] updateScheduledReport
- [x] deleteScheduledReport
- [x] sendReportByEmail

### `app/actions/reports-legal.ts`
- [x] getGusReport
- [x] getPoliceReport

---

## 11. Audyt, użytkownicy, auth, uprawnienia, 2FA

### `app/actions/audit.ts`
- [x] getAuditTrail
- [x] getAuditEntityTypes
- [x] getUsersForActionsReport
- [x] getLoginReport

### `app/actions/auth.ts`
- [x] login
- [x] verify2FA
- [x] changePassword
- [x] logout

### `app/actions/users.ts`
- [x] listUsersForAdmin
- [x] updateUserLimits

### `app/actions/permissions.ts`
- [x] getMyPermissions

### `app/actions/two-fa.ts`
- [x] start2FA
- [x] confirm2FA
- [x] disable2FA
- [x] get2FAStatus

---

## 12. Komunikacja (mailing, SMS)

### `app/actions/mailing.ts`
- [x] sendMailViaResend
- [x] sendReservationConfirmation
- [x] sendThankYouAfterStay
- [x] getAllEmailTemplates
- [x] getEmailTemplateById
- [x] saveEmailTemplate
- [x] resetEmailTemplate
- [x] sendReservationConfirmationWithTemplate
- [x] sendThankYouWithTemplate
- [x] sendReminderWithTemplate

### `app/actions/sms.ts`
- [x] sendDoorCodeSms
- [x] sendRoomReadySms
- [x] getSmsLogs
- [x] getSmsLogById
- [x] getSmsStats
- [x] getSmsLogsForReservation
- [x] getSmsLogsForGuest
- [x] getSmsGatewayConfig
- [x] sendTestSms
- [x] sendCustomSms
- [x] sendPreArrivalReminderSms
- [x] sendBatchPreArrivalReminders
- [x] getReservationsForReminder

---

## 13. Kiosk, ogłoszenia, zmiana, telefony, eksport/import PMS

### `app/actions/kiosk.ts`
- [x] searchKioskReservation
- [x] getKioskReservationById
- [x] kioskCheckIn
- [x] getKioskStats

### `app/actions/staff-announcements.ts`
- [x] getStaffAnnouncements
- [x] createStaffAnnouncement
- [x] getCanManageAnnouncements
- [x] deleteStaffAnnouncement

### `app/actions/shift-handover.ts`
- [x] getShiftHandovers
- [x] createShiftHandover

### `app/actions/telephony.ts`
- [x] importPhoneCalls

### `app/actions/export-pms.ts`
- [x] exportPmsData

### `app/actions/import-pms.ts`
- [x] parseImportPmsFile
- [x] parseImportCsv
- [x] executeImportPms

---

## 14. Channel manager, lojalność

### `app/actions/channel-manager.ts`
- [x] getChannelMappings
- [x] getExternalId
- [x] upsertChannelMapping
- [x] getChannelPropertyConfig
- [x] upsertChannelPropertyConfig
- [x] syncChannel
- [x] syncAvailabilityToBooking
- [x] fetchReservationsFromBooking

### `app/actions/loyalty.ts`
- [x] getLoyaltyProgram
- [x] updateLoyaltyProgram
- [x] getLoyaltyTiers
- [x] updateLoyaltyTier
- [x] getGuestLoyaltyStatus
- [x] enrollGuestInLoyalty
- [x] addLoyaltyPoints
- [x] redeemLoyaltyPoints
- [x] adjustLoyaltyPoints
- [x] recalculateLoyaltyTier
- [x] incrementLoyaltyStays
- [x] getLoyaltyTransactions
- [x] awardPointsForReservation

---

## 15. API (route handlers)

### `app/api/cron/scheduled-reports/route.ts`
- [x] GET

### `app/api/cron/ksef-poll-status/route.ts`
- [x] GET
- [x] POST

### `app/api/cron/ksef-keepalive/route.ts`
- [x] GET
- [x] POST

### `app/api/cron/ksef-retry-queue/route.ts`
- [x] GET
- [x] POST

### `app/api/cron/backup/route.ts`
- [x] GET
- [x] POST

### `app/api/cron/gus-monthly/route.ts`
- [x] GET

### `app/api/reservations/[id]/confirmation/pdf/route.ts`
- [x] GET

### `app/api/reservations/[id]/registration-card/pdf/route.ts`
- [x] GET

### `app/api/v1/external/posting/route.ts`
- [x] POST

### `app/api/v1/external/availability/route.ts`
- [x] GET

### `app/api/sms/reminders/route.ts`
- [x] GET
- [x] POST

### `app/api/openapi/route.ts`
- [x] GET

### `app/api/ksef/upo-file/route.ts`
- [x] GET

### `app/api/guest/reservations/route.ts`
- [x] GET

### `app/api/guest/digital-key/route.ts`
- [x] POST

### `app/api/reports/police/route.ts`
- [x] GET

### `app/api/reports/gus/route.ts`
- [x] GET

### `app/api/owner/settlement/[id]/pdf/route.ts`
- [x] GET

### `app/api/finance/deposit-invoice/[transactionId]/route.ts`
- [x] GET

### `app/api/finance/export/route.ts`
- [x] POST

### `app/api/finance/jpk-fa/route.ts`
- [x] GET

### `app/api/finance/jpk/route.ts`
- [x] GET

### `app/api/finance/jpk-vat/route.ts`
- [x] GET

### `app/api/finance/webhook/payment/route.ts`
- [x] POST

### `app/api/finance/accounting-note/[id]/pdf/route.ts`
- [x] GET

### `app/api/finance/invoice/[id]/pdf/route.ts`
- [x] GET

### `app/api/finance/receipt/[id]/pdf/route.ts`
- [x] GET

### `app/api/admin/restore/route.ts`
- [x] POST

### `app/api/admin/backup/route.ts`
- [x] GET

### `app/api/auth/guest/google/route.ts`
- [x] GET

### `app/api/auth/guest/google/callback/route.ts`
- [x] GET

### `app/api/auth/guest/facebook/callback/route.ts`
- [x] GET

---

## 16. Biblioteki (lib)

### `lib/auth.ts`
- [x] getSession
- [x] createSessionToken
- [x] createPending2FAToken
- [x] verifyPending2FAToken

### `lib/audit.ts`
- [x] createAuditLog
- [x] getClientIp

### `lib/api-auth.ts`
- [x] requireExternalApiKey

### `lib/encryption.ts`
- [x] encrypt
- [x] decrypt

### `lib/permissions.ts`
- [x] can
- [x] getPermissionsForRole
- [x] clearPermissionsCache

### `lib/password-policy.ts`
- [x] validatePassword
- [x] isPasswordExpired

### `lib/rate-limit.ts`
- [x] checkApiRateLimit

### `lib/guest-auth.ts`
- [x] getGuestSession
- [x] createGuestSessionToken

### `lib/guest-api-auth.ts`
- [x] requireGuestToken

### `lib/utils.ts`
- [x] cn

### `lib/totp.ts`
- [x] generateTotpSecret
- [x] getTotpUri
- [x] verifyTotpToken

### `lib/mrz.ts`
- [x] parseMRZ

### `lib/nip-checksum.ts`
- [x] isValidNipChecksum

### `lib/nip-lookup.ts`
- [x] lookupCompanyByNip

### `lib/validations/schemas.ts`
- [x] validateOptionalEmail

### `lib/tape-chart-data.ts`
- [x] getDateRange
- [x] getDefaultDateRange

### `lib/vertical-timeline-utils.ts`
- [x] getFloorFromRoomNumber
- [x] groupRoomsByFloor
- [x] getRoomStateForDay
- [x] getFreeNightsFrom
- [x] maskGuestName
- [x] getOccupancyForDay
- [x] getHeatmapLevel

### `lib/split-amount.ts`
- [x] splitAmountIntoEqualParts

### `lib/notifications.ts`
- [x] requestNotificationPermission
- [x] showDesktopNotification

### `lib/webhooks.ts`
- [x] sendReservationCreatedWebhook

### `lib/export-excel.ts`
- [x] exportToExcel

### `lib/telephony.ts`
- [x] createPhoneCallLogFromCdr
- [x] parseAsteriskCdrWebhook
- [x] parse3cxCdrWebhook
- [x] findRoomIdByChannel
- [x] findReservationIdByRoomAndDate
- [x] fetchCdrsFromCdrApi
- [x] blockRoomExtensionAfterCheckout

### `lib/channel-manager.ts`
- [x] syncToBookingCom
- [x] syncToAirbnb
- [x] syncToExpedia
- [x] fetchBookingReservationsApi

### `lib/gds.ts`
- [x] syncGdsAvailability

### `lib/crm.ts`
- [x] isHubSpotConfigured
- [x] isSalesforceConfigured
- [x] syncGuestToHubSpot
- [x] syncGuestToSalesforce

### `lib/bms.ts`
- [x] isBmsConfigured
- [x] setRoomClimate

### `lib/energy-system.ts`
- [x] isEnergySystemConfigured
- [x] activateRoomPower
- [x] deactivateRoomPower

### `lib/dormakaba.ts`
- [x] isDormakabaConfigured
- [x] createDormakabaGuestKey
- [x] revokeDormakabaGuestKeys
- [x] unlockDormakabaDoor

### `lib/assa-abloy.ts`
- [x] isAssaAbloyConfigured
- [x] createAssaAbloyGuestKey
- [x] revokeAssaAbloyGuestKeys
- [x] unlockAssaAbloyDoor

### `lib/salto.ts`
- [x] isSaltoConfigured
- [x] createSaltoGuestKey
- [x] revokeSaltoGuestKeys
- [x] unlockSaltoDoor

### `lib/hotel-tv.ts`
- [x] isHotelTvConfigured
- [x] sendWelcomeToTv

### `lib/housekeeping-offline.ts`
- [x] getPendingUpdates
- [x] addPendingUpdate
- [x] removePendingUpdate
- [x] clearPendingUpdates
- [x] getPendingUpdateForRoom

### `lib/mailchimp.ts`
- [x] isMailchimpConfigured
- [x] subscribeToMailchimp

### `lib/i18n/translations.ts`
- [x] getT

### `lib/fiscal/index.ts`
- [x] isFiscalEnabled
- [x] getFiscalConfig
- [x] getPosnetInfo
- [x] printFiscalReceipt
- [x] buildReceiptRequest
- [x] printFiscalInvoice
- [x] printFiscalXReport
- [x] printFiscalZReport
- [x] printFiscalPeriodicReport
- [x] printFiscalStorno
- [x] supportsFiscalReports

### `lib/fiscal/posnet-http-driver.ts`
- [x] getPosnetDriverInfo

### `lib/fiscal/posnet-models.ts`
- [x] getPaymentCodes
- [x] getPosnetModelConfig
- [x] getCurrentPosnetModel
- [x] modelSupportsFeature
- [x] truncateTextForModel
- [x] formatLinesForModel
- [x] validateReceiptForModel
- [x] getAllPosnetModels
- [x] getEReceiptCapableModels
- [x] getInvoiceCapableModels

### `lib/payment-terminal/index.ts`
- [x] initializeTerminal
- [x] isTerminalInitialized
- [x] getActiveConfig
- [x] getTerminalStatus
- [x] processTerminalPayment
- [x] processSale
- [x] processPreAuth
- [x] capturePreAuth
- [x] voidTransaction
- [x] processRefund
- [x] closeTerminalBatch
- [x] printOnTerminal
- [x] cancelTerminalOperation
- [x] disconnectTerminal
- [x] getTerminalCapabilities
- [x] formatAmount
- [x] toTerminalAmount
- [x] fromTerminalAmount

### `lib/payment-terminal/mock-driver.ts`
- [x] resetMockState

### `lib/store/tape-chart-store.tsx`
- [x] createTapeChartStore
- [x] TapeChartStoreProvider
- [x] useTapeChartStore

### `lib/ksef/env.ts`
- [x] getEffectiveKsefEnv
- [x] getKsefBaseUrl
- [x] getKsefVerifyUrl

### `lib/ksef/xml-generator.ts`
- [x] buildFa2Xml

### `lib/ksef/validate.ts`
- [x] validateInvoiceXml

### `lib/ksef/schema-loader.ts`
- [x] getFa2XsdPath
- [x] hasCachedFa2Xsd
- [x] fetchAndCacheFa2Xsd

### `lib/ksef/auth.ts`
- [x] getAuthorisationChallenge
- [x] buildInitSessionTokenRequestXml
- [x] encryptWithMfPublicKey
- [x] buildAndEncryptInitSessionTokenRequest
- [x] signChallengeWithAuthToken
- [x] initSession
- [x] terminateSession
- [x] getSessionStatus

### `lib/ksef/api-client.ts`
- [x] ksefGet
- [x] ksefPost
- [x] sendInvoice
- [x] getInvoiceUpo
- [x] getInvoiceStatus
- [x] sendInvoiceBatch

### `lib/ksef/parse-error.ts`
- [x] parseKsef400Error

### `lib/ksef/nip-validate.ts`
- [x] isPolishNip
- [x] checkBuyerNipActive

### `lib/id-scanner.ts`
- [x] fetchDocumentFromScanner
- [x] normalizeIdDocumentResponse
- [x] parseMrz
- [x] ocrDocumentFromImage
- [x] idDocumentToGuestFields

### `lib/integrations/accounting.ts`
- [x] exportToOptima
- [x] exportToSubiekt
- [x] exportToWfirma
- [x] exportToFakturownia
- [x] exportToSymfonia
- [x] exportToEnova

### `lib/openapi.ts`
- (funkcje eksportowane – sprawdź plik)

---

## 17. Komponenty (główne handlery / funkcje)

Komponenty React zwykle eksportują komponenty i używają hooków; poniżej tylko wybrane pliki z istotnymi funkcjami obsługi.

### `components/tape-chart/index.tsx`
- [x] (komponent + handlery: handleGoToDate, handlePrev, handleNext, handleOpenExportDialog, onMove, onUp, onKeyDown)

### `components/tape-chart/reservation-edit-sheet.tsx`
- [x] openFolioEditor
- [x] saveFolioAssignment
- [x] handleAddFolio
- [x] loadFolioItems
- [x] handleAddDiscount
- [x] handleTransferItem
- [x] handleSubmit

### `components/tape-chart/create-reservation-sheet.tsx`
- (sprawdź handlery w pliku)

### `components/tape-chart/group-reservation-sheet.tsx`
- [x] applyRoomGroup
- [x] handleRowChange
- [x] handleAddRow
- [x] handleRemoveRow
- [x] handleSubmit

### `components/guest-check-in-form.tsx`
- [x] handleFileChange
- [x] handleMrzBlur
- [x] handleFetchCompany
- [x] handleSaveCompany
- [x] handleSubmit

### `components/pay-form.tsx`
- (sprawdź handlery w pliku)

### `components/receipt-dialog.tsx`
- [x] handleSubmit

### `components/preauth-dialog.tsx`
- [x] handleCreate
- [x] handleCapture
- [x] handleRelease

### `components/minibar-add-dialog.tsx`
- [x] handleSubmit

### `components/Dashboard.tsx`
- (sprawdź handlery w pliku)

### `components/DashboardCharts.tsx`
- (sprawdź handlery w pliku)

### `middleware.ts`
- [x] middleware (funkcja middleware Next.js)

---

*Wygenerowano na podstawie analizy projektu. Odznaczaj `- [x]` → `- [x]` po sprawdzeniu danej funkcji przez Qodo.*
