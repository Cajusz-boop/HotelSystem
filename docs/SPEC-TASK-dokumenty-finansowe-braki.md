# SPEC-TASK: Dokumenty finansowe — braki i rozbudowa

> **Stan:** AssortmentItem + gtuCode na Transaction już istnieją.
> **Dodane:** model CashDocument (KP/KW), Invoice.invoiceType (enum), Invoice.advanceInvoiceId, workflow zaliczkowa→końcowa, korekty, split payment.

---

## 1. Stan istniejący (bez zmian)

- **AssortmentItem** — baza asortymentu (nazwa, cena, VAT, GTU). Strona `/ustawienia/asortyment`.
- **Transaction.gtuCode** — kod GTU na pozycji (do JPK). Ustawiany m.in. w `postRoomChargeOnCheckout` (ROOM → GTU_11).
- **Invoice** — faktura VAT (number, amountNet/Vat/Gross, buyerNip/Name, KSeF, paymentBreakdown, customFieldValues).
- **InvoiceCorrection** — korekty faktury (number, amountGross, reason).
- **Receipt** — rachunek (nie-VAT), paymentBreakdown.
- **CashShift** — zmiana kasy (otwarcie/zamknięcie, openingBalance, closingBalance).
- **Split payment** — na fakturze/rachunku: `paymentBreakdown` JSON `[{ type: "CASH", amount: 100 }, { type: "CARD", amount: 50 }]`.

---

## 2. Dodane w schemacie Prisma

### Enum InvoiceType

```prisma
enum InvoiceType {
  NORMAL   // faktura standardowa
  ADVANCE  // faktura zaliczkowa
  FINAL    // faktura końcowa (po zaliczce)
}
```

### Invoice — nowe pola

- **invoiceType** — `InvoiceType @default(NORMAL)`.
- **advanceInvoiceId** — `String?`; gdy `invoiceType = FINAL`, ID faktury zaliczkowej rozliczanej tą fakturą.
- **advanceInvoice** — relacja do `Invoice` (faktura zaliczkowa).
- **finalInvoices** — relacja odwrotna (faktury końcowe wystawione do tej zaliczki).

### Model CashDocument (KP/KW)

- **type** — `"KP"` (Kasa przyjmie) lub `"KW"` (Kasa wyda).
- **number** — unikalny numer (np. KP/2026/001, KW/2026/001).
- **amount** — kwota.
- **issuedAt**, **description**.
- **cashShiftId** — opcjonalnie zmiana.
- **reservationId** — opcjonalnie rezerwacja.
- **invoiceId** — opcjonalnie faktura (np. wpłata na fakturę).
- **receiptId** — opcjonalnie rachunek.

Relacje zwrotne: `CashShift.cashDocuments`, `Reservation.cashDocuments`, `Invoice.cashDocuments`, `Receipt.cashDocuments`.

---

## 3. Workflow: zaliczkowa → końcowa

1. **Faktura zaliczkowa** — wystawienie faktury z `invoiceType = ADVANCE` (np. na przedpłatę).
2. **Faktura końcowa** — wystawienie faktury z `invoiceType = FINAL` i `advanceInvoiceId = id faktury zaliczkowej`. Kwota końcowa = obciążenia minus zaliczka (z faktury zaliczkowej).

Akcje (w `app/actions/finance.ts` lub osobny moduł):

- **createAdvanceInvoice(reservationId, amountGross, ...)** — generuje numer FV, tworzy `Invoice` z `invoiceType: ADVANCE`.
- **createFinalInvoiceFromAdvance(reservationId, advanceInvoiceId, ...)** — tworzy `Invoice` z `invoiceType: FINAL`, `advanceInvoiceId`; kwoty po odjęciu zaliczki.

---

## 4. Korekty faktur

- Istniejący model **InvoiceCorrection** (number, amountGross, reason).
- Istniejąca akcja **createInvoiceCorrection**, **getInvoiceCorrections**.
- W UI: możliwość wystawienia korekty do faktury (lista korekt przy fakturze).

---

## 5. KP/KW (dokumenty kasowe)

- **CashDocument** — dokument KP (Kasa przyjmie) lub KW (Kasa wyda).
- Numeracja: osobna sekwencja dla KP i KW (np. w `DocumentNumberingConfig` lub dedykowany licznik).
- Akcje:
  - **createCashDocument({ type: "KP"|"KW", amount, description?, cashShiftId?, reservationId?, invoiceId?, receiptId? })**
  - **getCashDocumentsForShift(cashShiftId)**
  - **getCashDocumentsForReservation(reservationId)**
  - **getCashDocumentsForInvoice(invoiceId)**

---

## 6. Split payment

- Już zaimplementowane: **paymentBreakdown** na `Invoice` i `Receipt` (JSON: `[{ type, amount }]`).
- UI: rozbicie płatności w panelu faktury/rachunku (DocumentsTab, ReceiptDialog).

---

## 7. Odniesienia w kodzie

- Schema: `prisma/schema.prisma` — `InvoiceType`, `Invoice`, `CashDocument`, `CashShift`, `Reservation`, `Receipt`.
- Akcje: `app/actions/finance.ts` — createVatInvoice, updateInvoice, createInvoiceCorrection; do rozbudowy: createAdvanceInvoice, createFinalInvoiceFromAdvance, createCashDocument, getCashDocuments*.
- Numeracja: `DocumentNumberingConfig` / `generateNextDocumentNumber` — ewentualnie rozszerzenie o typy KP/KW.
