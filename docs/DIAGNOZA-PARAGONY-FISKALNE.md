# Diagnoza: Paragony fiskalne drukują się tylko przy niektórych opcjach

**Data:** 2025-03-12  
**Cel:** Pełna mapa przepływu druku paragonów przed wprowadzeniem zmian

---

## 1. Mapa wszystkich miejsc wywołania druku paragonu

### 1.1 `printFiscalReceiptForReservation(reservationId, paymentType, amountOverride?)`

| Plik | Linia | Skąd wywoływane | Parametry |
|------|-------|-----------------|-----------|
| `components/tape-chart/unified-reservation-dialog.tsx` | 943 | `handleDocChoice("posnet")` lub `handleDocChoice("both")` z dialogu post-checkout | `docChoiceResId`, `docPaymentMethod`, `amtRec` (gdy both) lub undefined |
| `components/tape-chart/unified-reservation-dialog.tsx` | 1559 | Przycisk "Wystaw 2 faktury + paragon" w `splitInvoiceDialogOpen` (Dwie faktury: hotel + gastronomia) | `reservation.id`, `splitReceiptPaymentMethod`, `receiptAmt` |

**Warunek:** W obu przypadkach wymagane jest **`docChoiceResId`** (pojedyncza rezerwacja) – dla wyboru "Paragon" lub "Faktura + Paragon" w `handleDocChoice`.  
Dla **rezerwacji zbiorczych** (`docChoiceResIds.length > 0`) `docChoiceResId` jest ustawiane na `null`, więc blok paragonu **nigdy się nie wykonuje** (patrz punkt 2).

### 1.2 `printFiscalReceiptForConsolidatedInvoice(invoiceId, amount, paymentType)`

| Plik | Linia | Skąd wywoływane | Parametry |
|------|-------|-----------------|-----------|
| `app/kontrahenci/page.tsx` | 1067 | `handleDocPosnetReceipt` z ConsolidatedInvoiceDocumentDialog | `docDialogInvoice.id`, amount, paymentType |
| `app/kontrahenci/page.tsx` | 1077 | `handleDocBoth` (Faktura + Paragon) – faktura zbiorcza z listy kontrahentów | `docDialogInvoice.id`, `amountReceipt`, paymentType |

**Uwaga:** Ten przepływ działa na stronie **Kontrahenci** dla już istniejących faktur zbiorczych, nie w unified-reservation-dialog.

### 1.3 `printFiscalReceipt(receiptRequest)` (niski poziom – lib/fiscal)

| Plik | Linia | Skąd wywoływane | Parametry |
|------|-------|-----------------|-----------|
| `app/actions/finance.ts` | 4156 | `printFiscalReceiptForReservation` | receiptRequest z pozycjami z transakcji |
| `app/actions/finance.ts` | 4206 | `printFiscalReceiptForConsolidatedInvoice` | receiptRequest (jedna pozycja) |
| `app/actions/finance.ts` | 2792 | `createDepositPayment` (zaliczka) | receiptRequest z buildReceiptRequest |
| `app/actions/finance.ts` | 684 | `testFiscalConnectionAction` (test połączenia) | testowy request |

### 1.4 Przepływ POSNET (relay vs direct)

- Przy `FISCAL_DRIVER=posnet` funkcja `printFiscalReceipt` **nie** wywołuje drivera bezpośrednio.
- Zamiast tego wywołuje `enqueueFiscalJob("receipt", request)` → zapis do tabeli `FiscalJob`.
- Komponent `FiscalRelay` w przeglądarce co ~3 s odpytuje `/api/fiscal/pending`, pobiera job i wysyła go do bridge’a `localhost:9977`.
- Drukowanie odbywa się **po stronie klienta** (maszyna z uruchomionym bridge’em).

---

## 2. Przepływ w unified-reservation-dialog.tsx

### 2.1 Opcje wystawiania dokumentów

#### A. Menu "Wystaw dokument" (z footera – `handleIssueDoc`)

| Opcja | Handler | Czy zawiera druk paragonu? |
|-------|---------|----------------------------|
| Faktura VAT | `handleIssueDoc("vat")` | Nie – otwiera `docChoiceOpen` |
| Dwie faktury (hotel + gastronomia) | Otwiera `splitInvoiceDialogOpen` | Tak, jeśli `splitReceiptAmount > 0` (wywołanie w linii 1559) |
| **Paragon** | `handleIssueDoc("posnet")` | Otwiera `docChoiceOpen` – faktyczny druk w `handleDocChoice` |
| Faktura proforma | `handleIssueDoc("proforma")` | Nie |
| Potwierdzenie rezerwacji | `handleIssueDoc("potwierdzenie")` | Nie (toast „w przygotowaniu”) |

#### B. Dialog "Wystawić dokument?" (post-checkout – `handleDocChoice`)

| Opcja | Handler | Warunek druku paragonu |
|-------|---------|------------------------|
| Faktura (inv) + Paragon (rec) — Wystaw oba | `handleDocChoice("both")` | `amtRec > 0` **i** `docChoiceResId` |
| Faktura VAT (PDF) | `handleDocChoice("vat")` | Nie |
| **Paragon (kasa fiskalna POSNET)** | `handleDocChoice("posnet")` | **Wymaga `docChoiceResId`** |
| Bez dokumentu | `handleDocChoice("none")` | Nie |
| Dwie faktury (hotel + gastronomia) | Otwiera `splitInvoiceDialogOpen` | Paragon tylko jeśli `splitReceiptAmount > 0` |

### 2.2 Kluczowy warunek w handleDocChoice (linie 942–960)

```typescript
if ((choice === "posnet" || (choice === "both" && amtRec > 0)) && docChoiceResId) {
  const result = await printFiscalReceiptForReservation(docChoiceResId, ...);
  // ...
}
```

- Warunek `docChoiceResId` jest wymagany.
- Przy **rezerwacji zbiorczej** (`isConsolidated`) w `handleIssueDoc` ustawiane jest:
  - `setDocChoiceResId(null)`
  - `setDocChoiceResIds([...consolidatedReservationIds])`
- Przy takim stanie `docChoiceResId` jest `null` → blok paragonu **nigdy się nie wykonuje** dla rezerwacji zbiorczych.

### 2.3 Dwie faktury (hotel + gastronomia)

- Osobny dialog `splitInvoiceDialogOpen`.
- Wywołuje `createSplitVatInvoices`, potem przy `receiptAmt > 0`:
  - `printFiscalReceiptForReservation(reservation.id, splitReceiptPaymentMethod, receiptAmt)`
- Działa tylko dla **pojedynczej** rezerwacji (`reservation.id`).

---

## 3. Konfiguracja drukarki fiskalnej (POSNET)

### 3.1 Zmienne środowiskowe (`.env.example`, `posnet-bridge/README.md`)

| Zmienna | Domyślnie | Opis |
|---------|-----------|------|
| `FISCAL_ENABLED` | (false) | `true` włącza integrację |
| `FISCAL_DRIVER` | `mock` | `posnet` / `novitus` / `elzab` |
| `FISCAL_POSNET_ENDPOINT` | `http://127.0.0.1:9977/fiscal/print` | Adres bridge’a (Next.js → bridge) |
| `FISCAL_POSNET_API_KEY` | (brak) | Opcjonalny klucz API |
| `FISCAL_POSNET_TIMEOUT_MS` | `8000` | Timeout żądań do bridge’a |
| `FISCAL_POSNET_REPORT_TIMEOUT_MS` | `30000` | Timeout dla raportów X/Z/okresowych |
| `FISCAL_RECEIPT_TIMEOUT_MS` | `15000` | Timeout w lib/fiscal dla paragonu (tylko gdy nie używa relay) |
| `FISCAL_POSNET_MODEL` | `thermal_hs` | Model drukarki (thermal, ergo, neo, revo itd.) |
| `POSNET_BRIDGE_PORT` | `9977` | Port bridge’a |
| `POSNET_PRINTER_HOST` | `10.119.169.55` | IP drukarki POSNET Trio |
| `POSNET_PRINTER_PORT` | `6666` | Port TCP drukarki |
| `POSNET_PRINTER_TIMEOUT` | `5000` | Timeout połączenia z drukarką |
| `POSNET_BRIDGE_MODE` | `tcp` | `tcp` (drukarka) lub `spool` (pliki JSON) |

### 3.2 Inicjalizacja połączenia

- **lib/fiscal/posnet-http-driver.ts** – sterownik HTTP; nie inicjuje połączenia, wysyła `fetch()` na `FISCAL_POSNET_ENDPOINT`.
- **posnet-bridge/server.mjs** – serwer HTTP nasłuchujący na `POSNET_BRIDGE_PORT`; przy trybie `tcp` łączy się z drukarką przez `POSNET_PRINTER_HOST` i `POSNET_PRINTER_PORT`.
- Przy `FISCAL_DRIVER=posnet` lib/fiscal **nie** używa posnet-http-driver bezpośrednio; zamiast tego `enqueueFiscalJob` → FiscalJob w DB → FiscalRelay w przeglądarce → bridge na localhost.

### 3.3 Obsługa błędów

- **posnet-http-driver.ts** – `AbortController` + `setTimeout`; przy `AbortError` zwracany komunikat np.  
  `Timeout POSNET bridge (8000 ms) - model: ...`.
- **lib/fiscal/index.ts** – przy driverze innym niż posnet (direct) – `FISCAL_RECEIPT_TIMEOUT_MS` (15 s), przy timeout zwracany błąd.
- **posnet-bridge/server.mjs** – połączenie TCP z drukarką; brak jawnej obsługi timeoutu w pliku – zależy od konfiguracji Node/konkretnych wywołań.
- **testFiscalConnectionAction** (finance.ts, linia 618+) – `GET {baseUrl}/health` z timeoutem; przy błędzie zwraca komunikat typu:  
  `Bridge odpowiedział HTTP X` lub  
  `Błąd połączenia. Uruchom bridge: npm run posnet:bridge`.

---

## 4. Logi błędów przy nieudanym druku

### 4.1 console.error / logger.error

| Lokalizacja | Kod | Kiedy |
|-------------|-----|-------|
| `app/actions/finance.ts` | 2794 | `console.error("[FISCAL] Błąd druku paragonu zaliczki:", fiscalResult.error)` – przy błędzie paragonu zaliczki w `createDepositPayment` |
| `app/actions/finance.ts` | 753, 809, 929, 1084 | `console.error` w akcjach raportów X/Z, okresowych, storno – nie dotyczy zwykłego paragonu rezerwacji |

### 4.2 Brak logowania błędów paragonu w głównym przepływie

- `printFiscalReceiptForReservation` – zwraca `{ success: false, error }`, **bez** `console.error`.
- `handleDocChoice` w unified-reservation-dialog – przy błędzie wyświetla toast:  
  `toast.error("error" in result ? result.error : "Błąd druku paragonu")`.
- `printFiscalReceipt` (lib/fiscal) – zwraca obiekt z `error`, bez logowania.
- **posnet-http-driver** – zwraca `{ success: false, error: msg }`, bez `console.error`.
- **FiscalRelay** – przy błędzie bridge’a:  
  `toast.error(\`Nie udało się wydrukować dokumentu fiskalnego: ${result.error}\`)` – tylko w UI, brak logowania na serwerze.

### 4.3 Gdy drukarka nie odpowiada

- Przy relay: job trafia do FiscalJob; FiscalRelay wysyła go do bridge’a; przy błędzie:
  - toast w przeglądarce,
  - `/api/fiscal/complete` oznaczany jako error z `error` w payloadzie.
- W logach serwera brak dedykowanego wpisu – błąd jest po stronie bridge’a/klienta.

---

## 5. Różnica między działającymi a niedziałającymi opcjami

### 5.1 Działające

| Opcja | Przepływ | Warunki |
|-------|----------|---------|
| Paragon (pojedyncza rezerwacja) | handleDocChoice("posnet") → printFiscalReceiptForReservation | `docChoiceResId` ustawione, pojedyncza rezerwacja |
| Faktura + Paragon (pojedyncza) | handleDocChoice("both") | `amtRec > 0`, `docChoiceResId` ustawione |
| Dwie faktury + paragon | splitInvoiceDialogOpen | `receiptAmt > 0`, `reservation.id` |
| Paragon zaliczki | createDepositPayment | FISCAL_ENABLED, buildReceiptRequest → printFiscalReceipt |
| Paragon faktury zbiorczej (Kontrahenci) | handleDocPosnetReceipt → printFiscalReceiptForConsolidatedInvoice | Istniejąca faktura zbiorcza |

### 5.2 Niedziałające / brak obsługi

| Opcja | Przyczyna |
|-------|-----------|
| **Paragon przy rezerwacji zbiorczej** | W handleIssueDoc ustawiane jest `docChoiceResId = null`. Warunek `&& docChoiceResId` w handleDocChoice powoduje, że blok paragonu się nie wykonuje. Brak alternatywy (np. `printFiscalReceiptForConsolidatedInvoice` z nowo utworzoną fakturą zbiorczą). |
| Faktura + Paragon (zbiorcza) | Analogicznie – brak obsługi paragonu dla `docChoiceResIds`. |

### 5.3 Co jest inne w przepływie

- **Pojedyncza rezerwacja:**  
  `docChoiceResId` = ID rezerwacji → `printFiscalReceiptForReservation(docChoiceResId, ...)` – wywołanie jest wykonywane.
- **Rezerwacja zbiorcza:**  
  `docChoiceResId = null`, `docChoiceResIds = [id1, id2, ...]` → warunek `&& docChoiceResId` jest false → brak wywołania druku paragonu.

Nie ma różnic w:
- typie transakcji (gotówka/karta/przelew) – przekazywany jako parametr,
- scope (HOTEL_ONLY/GASTRONOMY_ONLY/ALL) – `printFiscalReceiptForReservation` pobiera wszystkie typy obciążeń z rezerwacji,
- równoczesnym wystawianiu faktury – przy `choice === "both"` najpierw faktura, potem paragon; różnica jest tylko w warunku `docChoiceResId`.

---

## 6. Modele w schema.prisma

### 6.1 FiscalReceiptTemplate (szablon paragonu)

```prisma
model FiscalReceiptTemplate {
  id               String   @id @default(cuid())
  headerLine1      String?  // np. "HOTEL ŁABĘDŹ"
  headerLine2      String?
  headerLine3      String?
  footerLine1      String?
  footerLine2      String?
  footerLine3      String?
  itemNameRoom     String   @default("Nocleg")
  itemNameDeposit  String   @default("Zaliczka")
  itemNameMinibar  String   @default("Minibar")
  itemNameService  String   @default("Usługa")
  itemNameLocalTax String   @default("Opłata miejscowa")
  itemNameParking  String   @default("Parking")
  defaultVatRate   Int      @default(8)
  includeRoomNumber Boolean @default(true)
  includeStayDates Boolean @default(false)
  roomNumberFormat String?  // opcjonalny format numeru pokoju
  // ...
}
```

Brak modelu `FiscalReceipt` z konkretnymi wydrukowanymi paragonami – paragony nie są zapisywane jako rekordy, tylko generowane i drukowane w locie.

### 6.2 FiscalJob (kolejka zadań fiskalnych)

```prisma
model FiscalJob {
  id        String   @id @default(cuid())
  type      String   // "receipt", "invoice", "report_x", "report_z", "report_periodic", "storno"
  status    String   @default("pending")  // "pending", "processing", "done", "error"
  payload   Json
  result    Json?
  error     String?  @db.Text
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  attempts  Int      @default(0)

  @@index([status, createdAt])
}
```

Relacje: brak FK do Reservation/Invoice – `payload` zawiera dane (np. reservationId, items) jako JSON.

---

## 7. Podsumowanie – co działa, a co nie

| Ścieżka | Druk paragonu |
|---------|----------------|
| Paragon (pojedyncza rezerwacja, post-checkout) | działa |
| Faktura + Paragon (pojedyncza, post-checkout) | działa |
| Dwie faktury + paragon (hotel + gastronomia) | działa |
| Paragon (rezerwacja zbiorcza, post-checkout) | nie działa – brak wywołania |
| Faktura + Paragon (rezerwacja zbiorcza) | nie działa – brak wywołania paragonu |
| Paragon faktury zbiorczej (Kontrahenci) | działa |
| Paragon zaliczki (createDepositPayment) | działa (błąd logowany w console) |
| Test połączenia (Ustawienia → Kasa fiskalna) | działa |

Główna przyczyna: w unified-reservation-dialog nie ma obsługi paragonu dla rezerwacji zbiorczych (`docChoiceResIds`), a warunek `&& docChoiceResId` wyklucza ten przypadek.
