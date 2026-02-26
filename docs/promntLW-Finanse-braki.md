# MODUŁ: Finanse — Braki i rozbudowa (referencja KWHotel)

> **CEL:** Uzupełnić moduł finansów o brakujące funkcje względem referencji KWHotel.
> **STAN OBECNY:** Pełna obsługa folio, transakcji, faktur VAT, proform, rachunków, not księgowych, kas (KP/KW), linków płatności, voucherów, walut, druku fiskalnego, KSeF, JPK, terminali płatniczych.
> **ZASADA:** Przeczytaj CAŁY dokument. Przy implementacji nie pomijaj sekcji.

---

## ISTNIEJĄCE ZASOBY (NIE USUWAJ, ROZBUDUJ)

### Modele Prisma (finanse)

- **Transaction** — obciążenia, wpłaty, rabaty, void, refund; folioNumber, category, VAT, powiązanie z Invoice/Receipt
- **ReservationFolio** — folia (split checks), billTo (GUEST/COMPANY), powiązanie z gośćmi
- **Invoice**, **InvoiceCorrection** — faktury VAT, KSeF (ksefUuid, ksefStatus, ksefUpoUrl)
- **Proforma**, **Receipt** — proformy, rachunki (zwolnienie VAT), isPaid, paidAt
- **AccountingNote** — noty księgowe (opłata miejscowa: DEBIT/CREDIT)
- **PaymentLink** — link do płatności online, token, expiry
- **CashShift**, **BlindDropRecord** — zmiana kasy, ślepa wpłata
- **DocumentNumberingConfig**, **DocumentNumberCounter** — numeracja dokumentów
- **InvoiceTemplate**, **FiscalReceiptTemplate**, **DocumentTemplate** — szablony
- **CurrencyExchangeRate**, **CurrencyConversion** — waluty, kursy NBP
- **GiftVoucher**, **VoucherRedemption**, **VoucherTemplate**
- **CardPreauth**, **CardSettlementBatch** — preautoryzacje, rozliczenia terminali

### Server Actions (`app/actions/finance.ts`)

- **Numeracja:** getDocumentNumberingConfig, updateDocumentNumberingConfig, generateNextDocumentNumber
- **Kasa:** getCurrentCashShift, openCashShift, closeCashShift, getCashShiftHistory, submitBlindDrop
- **Transakcje:** registerTransaction, voidTransaction, createSplitPaymentTransaction, refundPayment
- **Folio:** getFolioSummary, getFolioItems, addFolioCharge, addFolioPayment, addFolioDiscount, voidFolioItem, transferFolioItem, createNewFolio, setFolioAssignment, getReservationGuestsForFolio
- **Depozyt/kaucja:** collectSecurityDeposit, refundSecurityDeposit, getRefundableAmount
- **Obciążenia:** postRoomChargeOnCheckout, chargeLocalTax, chargeMealConsumptionsToReservation, chargeGastronomyToReservation, chargeOrderToReservation, chargeSpaBookingToReservation, itd.
- **Faktury:** createVatInvoice, getInvoicesForReservation, createInvoiceCorrection, updateInvoice, ensureInvoiceEditable
- **Proformy:** createProforma, getProformasForReservation
- **Rachunki:** createReceipt, getReceiptsForReservation, markReceiptAsPaid/Unpaid, deleteReceipt
- **Noty księgowe:** createAccountingNote, getAccountingNotesForReservation, markAccountingNoteAsPaid, cancelAccountingNote
- **Płatności online:** createPaymentLink, getPaymentLinkByToken, registerPaymentFromLink
- **Karty:** getCardPreauthsForReservation, createCardPreauth, captureCardPreauth, releaseCardPreauth
- **Druk fiskalny:** printFiscalReceiptForReservation, printFiscalXReportAction, printFiscalZReportAction, printFiscalStornoAction
- **Waluty:** getExchangeRate, syncNbpExchangeRates, convertCurrency, getActiveExchangeRates
- **Vouchery:** createVoucher, redeemVoucher, getVoucherByCode, validateVoucher, getVoucherTemplates
- **Terminale:** initializePaymentTerminalAction, processPaymentTerminalTransactionAction, processTerminalSaleAction, itd.
- **Raporty:** getVatSalesRegister, getVatPurchasesRegister, getKpirReport, getManagementReportData, getCashSumForToday, getTransactionsForToday
- **Night Audit:** runNightAudit

### UI

- **Settlement tab** (tape-chart) — rozliczenie rezerwacji: folia, wpłaty, rabaty, kaucja, NIP/faktura, status płatności
- **Booking** — PaymentStep, createPaymentLink, potwierdzenie z linkiem do płatności
- **Dokumenty** — przyciski Faktura/Proforma/Rachunek w oknie rezerwacji; createVatInvoice, printFiscalReceiptForReservation

---

## BRAKI (do uzupełnienia)

Poniżej lista luk względem audytu KWHotel (SEKCJA 8: DOKUMENTY FINANSOWE + powiązane). Każdy punkt można potraktować jako osobny TASK do implementacji.

### A. Dokumenty i płatności

| # | Brak | Opis | Gdzie |
|---|------|------|--------|
| A1 | **Dwa typy płatności na dokumencie** | Faktura/rachunek: payment_type_1, payment_amount_1, payment_type_2, payment_amount_2 (np. gotówka + karta). | Invoice, Receipt: nowe pola lub JSON paymentBreakdown. UI: przy zapisie/edycji dokumentu. |
| A2 | **Przypisywanie wpłat do towarów** | Przy częściowej płatności — mapowanie kwoty wpłaty na konkretne pozycje (która pozycja jest opłacona w jakiej części). | Transaction lub nowa tabela payment_allocation (paymentId, transactionId, amount). UI: w oknie rozliczenia przy wielu pozycjach. |
| A3 | **Hurtowe „oznacz jako zapłacone”** | Zaznaczenie wielu faktur/rachunków i jednym przyciskiem ustawienie statusu zapłacono + data. | Action: markDocumentsAsPaid(ids[], paidAt). Strona listy dokumentów (jeśli będzie). |
| A4 | **Dokumenty bankowe** | Tabela potwierdzeń wpłat z banku (np. CSV import, dopasowanie do faktur). | Nowy model BankDocument lub BankStatementLine; opcjonalnie reconciliation z Invoice/Receipt. |
| A5 | **Historia dokumentu w UI** | Widok „Historia zmian” dla faktury/rachunku (kto, kiedy, co zmienił). | Zapytanie AuditLog WHERE entityType IN ('Invoice','Receipt') AND entityId = id. Komponent w oknie podglądu dokumentu. |

### B. Baza asortymentu i GTU

| # | Brak | Opis | Gdzie |
|---|------|------|--------|
| B1 | **Baza asortymentu** | Tabela pozycji do fakturowania: nazwa, cena domyślna, stawka VAT, kod GTU (zamiast wpisywania ręcznego przy każdej pozycji). | Model AssortmentItem (name, defaultPrice, vatRate, gtuCode, category). UI: ustawienia → Asortyment. |
| B2 | **Stawki GTU na pozycjach** | Jawny kod GTU na pozycji faktury (pole gtu_code w Transaction lub w pozycjach Invoice). | Transaction.gtuCode (String?) lub w JSON pozycji faktury. Weryfikacja w JPK. |
| B3 | **Pola własne na fakturze** | Konfigurowalne pola dodatkowe na fakturze (np. zamówienie, projekt). | HotelConfig.invoiceCustomFields (JSON) + Invoice.customFieldValues (JSON) lub tabela. |

### C. Raporty i eksport

| # | Brak | Opis | Gdzie |
|---|------|------|--------|
| C1 | **Eksport dokumentów do CSV** | Lista faktur/rachunków z filtrami (daty, rezerwacja, kontrahent) → CSV. | api/finance/export lub action exportInvoicesToCsv — sprawdzić czy jest; jeśli nie, dodać. |
| C2 | **Raport rozliczeń kartowych** | Podsumowanie transakcji kartą per zmiana / per batch z dopasowaniem do wpłat. | CardSettlementBatch — sprawdzić getCardSettlementSummary; ewentualnie rozszerzyć o kolumnę „dopasowane rezerwacje”. |

### D. Integracje i terminale

| # | Brak | Opis | Gdzie |
|---|------|------|--------|
| D1 | **Terminale płatnicze — pełna integracja** | CardSettlementBatch istnieje; dopracować przepływ: automatyczne dopasowanie transakcji terminala do rezerwacji/folio. | Sprawdzić processTerminalSaleAction → Transaction; UI: lista nierozliczonych transakcji kartą. |
| D2 | **Link płatności — powiadomienie po wpłacie** | Po opłaceniu linku (registerPaymentFromLink) — automatyczny mail do gościa z potwierdzeniem. | Wywołanie po registerPaymentFromLink: sendEmail (szablon PAYMENT_CONFIRMED) lub rozszerzenie webhooka. |

### E. Księgowość i compliance

| # | Brak | Opis | Gdzie |
|---|------|------|--------|
| E1 | **JPK — weryfikacja GTU** | Upewnić się, że JPK VAT/FA zawiera poprawne kody GTU z pozycji. | Przejrzeć api/finance/jpk, api/finance/jpk-vat, jpk-fa; dodać GTU jeśli brak. |
| E2 | **KSeF — retry i kolejka** | Przy błędzie wysyłki (timeout, błąd MF) — ponowienie i kolejka zamiast jednorazowej próby. | Kolejka zadań (np. KsefQueue) lub retry w api/ksef z backoff. |

### F. UX i edge case’y

| # | Brak | Opis | Gdzie |
|---|------|------|--------|
| F1 | **Limit void bez PIN** | Powyżej kwoty (np. 500 PLN) — wymagany PIN managera przy void. | finance.ts: voidTransaction — sprawdzić verifyManagerPin i DEFAULT_MAX_VOID_AMOUNT; UI: modal PIN przy void. |
| F2 | **Blokada void po czasie** | Ograniczenie voidów np. do 24 h od transakcji (konfigurowalne). | Transaction.postedAt; w voidTransaction: jeśli (now - postedAt) > maxVoidHours → błąd. Konfiguracja w Property lub HotelConfig. |
| F3 | **Podsumowanie salda w jednym miejscu** | Na rozliczeniu: „Do zapłaty”, „Zapłacono”, „Saldo” z podziałem na folia (gdy split). | Settlement tab — sprawdzić czy wyświetlane; ewentualnie jeden blok „Podsumowanie salda” nad listą folii. |

---

## PRIORYTETYZACJA (sugestia)

| Priorytet | Punkty | Uwagi |
|-----------|--------|--------|
| 🔴 Krytyczne | A1, A2, B2, E1 | Płatności na dokumencie, GTU, JPK — wymagania księgowe/prawne. |
| 🟠 Ważne | A3, A5, B1, D1, F1 | Usprawnienia codziennej pracy: oznaczanie zapłaconych, historia, asortyment, terminal, PIN przy void. |
| 🟡 Przydatne | A4, C1, D2, E2, F2 | Bank, eksport CSV, mail po płatności, retry KSeF, limit czasu void. |
| 🟢 Nice to have | B3, C2, F3 | Pola własne faktury, raport kart, podsumowanie salda. |

---

## ODNIESIENIA

- **Audyt:** `docs/AUDYT-KWHOTEL-REFERENCJA-PMS.md` — SEKCJA 8 (Dokumenty finansowe), SEKCJA 14 (Integracje).
- **Kod:** `app/actions/finance.ts`, `components/tape-chart/tabs/settlement-tab.tsx`, `lib/finance-constants.ts`.
- **Schema:** `prisma/schema.prisma` — Transaction, Invoice, Receipt, ReservationFolio, CashShift, PaymentLink, DocumentNumberingConfig.

---

**Koniec dokumentu.**  
Implementację robić po punktach (np. TASK A1, TASK B1), z zachowaniem istniejących API i bez usuwania obecnej logiki.
