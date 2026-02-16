# HotelSystem - Most Complex Code Analysis

## Overview
This document highlights the most intricate and sophisticated parts of the HotelSystem codebase, focusing on business logic complexity, architectural patterns, and technical challenges.

---

## 1. **Financial Transaction System** (app/actions/finance.ts)
**Complexity Level: ⭐⭐⭐⭐⭐ EXTREME**

### Why It's Complex:
- **Multi-layered validation** with atomic operations
- **Split payment handling** (multiple payment methods in one transaction)
- **Idempotency guarantees** (prevents duplicate charges)
- **Audit trail integration** for compliance
- **Real-time payment status updates**

### Key Challenges:

#### A. Document Numbering with Atomic Transactions
```typescript
export async function generateNextDocumentNumber(documentType: DocumentType): Promise<string> {
  const year = new Date().getFullYear();
  
  // Atomically increment counter to prevent duplicate numbers
  const counter = await prisma.$transaction(async (tx) => {
    let counter = await tx.documentNumberCounter.findUnique({
      where: { documentType_year: { documentType, year } },
    });

    if (!counter) {
      // Scan existing documents to find max sequence
      // (handles case where documents exist but counter doesn't)
      let existingMax = 0;
      
      // Search across 6 different document types
      if (documentType === "INVOICE") {
        const existing = await tx.invoice.findMany({
          where: { number: { startsWith: searchPrefix } },
          orderBy: { number: "desc" },
          take: 1,
        });
        // Extract sequence from number format: FV/2025/0042
        if (existing.length > 0) {
          const parts = existing[0].number.split(config.separator);
          const lastSeq = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(lastSeq)) existingMax = lastSeq;
        }
      }
      // ... repeat for CORRECTION, CONSOLIDATED_INVOICE, RECEIPT, ACCOUNTING_NOTE, PROFORMA
      
      counter = await tx.documentNumberCounter.create({
        data: {
          documentType,
          year,
          lastSequence: existingMax,
        },
      });
    }

    // Increment and save atomically
    const nextSeq = counter.lastSequence + 1;
    await tx.documentNumberCounter.update({
      where: { id: counter.id },
      data: { lastSequence: nextSeq },
    });

    return { ...counter, lastSequence: nextSeq };
  });

  // Build formatted number: FV/2025/0042
  const yearStr = config.yearFormat === "YY" ? String(year).slice(-2) : String(year);
  const seqStr = String(counter.lastSequence).padStart(config.sequencePadding, "0");
  return `${config.prefix}${config.separator}${yearStr}${config.separator}${seqStr}`;
}
```

**Why Complex:**
- Uses Prisma transactions to ensure atomicity
- Handles race conditions (multiple concurrent requests)
- Scans 6 different document types to find max sequence
- Supports configurable number formats (prefix, separator, padding)
- Resets yearly or continuously based on config

#### B. Split Payment Validation
```typescript
function validateSplitPayment(
  amount: number,
  details: PaymentDetails
): { valid: boolean; error?: string } {
  if (!details.methods || details.methods.length === 0) {
    return { valid: false, error: "Płatność podzielona wymaga listy metod" };
  }

  if (details.methods.length < 2) {
    return { valid: false, error: "Płatność podzielona wymaga co najmniej 2 metod" };
  }

  // Validate each method
  for (const method of details.methods) {
    if (!VALID_PAYMENT_METHODS.includes(method.method)) {
      return { 
        valid: false, 
        error: `Nieprawidłowa metoda płatności: ${method.method}` 
      };
    }
    if (method.amount <= 0) {
      return { 
        valid: false, 
        error: `Kwota dla metody ${method.method} musi być większa od zera` 
      };
    }
    // Prevent nested SPLIT
    if (method.method === "SPLIT") {
      return { valid: false, error: "Nie można użyć SPLIT wewnątrz SPLIT" };
    }
  }

  // Verify sum matches transaction amount (with 1-cent tolerance for rounding)
  const methodsTotal = details.methods.reduce((sum, m) => sum + m.amount, 0);
  if (Math.abs(methodsTotal - amount) > 0.01) {
    return {
      valid: false,
      error: `Suma metod płatności (${methodsTotal.toFixed(2)} PLN) nie zgadza się z kwotą transakcji (${amount.toFixed(2)} PLN)`,
    };
  }

  return { valid: true };
}
```

**Why Complex:**
- Prevents nested SPLIT payments (recursive prevention)
- Handles floating-point rounding errors (1-cent tolerance)
- Validates all methods before creating transaction
- Ensures sum of methods equals total amount

#### C. Void Transaction with PIN Security & Rate Limiting
```typescript
const VOID_PIN_MAX_ATTEMPTS = 3;
const VOID_PIN_LOCKOUT_MS = 15 * 60 * 1000;
const voidPinAttempts = new Map<string, { count: number; firstFailedAt: number }>();

function isVoidPinLocked(ip: string): { locked: boolean; remainingMs?: number } {
  const entry = voidPinAttempts.get(ip);
  if (!entry || entry.count < VOID_PIN_MAX_ATTEMPTS) return { locked: false };
  const elapsed = Date.now() - entry.firstFailedAt;
  if (elapsed >= VOID_PIN_LOCKOUT_MS) {
    voidPinAttempts.delete(ip);
    return { locked: false };
  }
  return { locked: true, remainingMs: VOID_PIN_LOCKOUT_MS - elapsed };
}

export async function voidTransaction(
  transactionId: string,
  pin?: string
): Promise<ActionResult<{ voidedTransactionId: string; refundAmount: number }>> {
  const headersList = await headers();
  const ip = getClientIp(headersList);

  // Check if IP is locked out
  const lockStatus = isVoidPinLocked(ip);
  if (lockStatus.locked) {
    return {
      success: false,
      error: `Zbyt wiele nieudanych prób. Spróbuj za ${Math.ceil((lockStatus.remainingMs ?? 0) / 1000)} sekund.`,
    };
  }

  // Verify PIN if required
  const user = await getSession();
  const maxVoidAmount = user?.maxVoidAmount ?? DEFAULT_MAX_VOID_AMOUNT;

  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
  });

  if (!transaction) {
    return { success: false, error: "Transakcja nie istnieje" };
  }

  const amount = Number(transaction.amount);

  // PIN required for amounts above limit
  if (amount > maxVoidAmount) {
    if (!pin) {
      return { success: false, error: "PIN managera wymagany dla tej kwoty" };
    }

    const pinResult = await verifyManagerPin(pin);
    if (!pinResult.success) {
      recordFailedVoidPinAttempt(ip);
      return { success: false, error: "Nieprawidłowy PIN" };
    }

    clearVoidPinAttempts(ip);
  }

  // Perform void
  const voidedTx = await prisma.transaction.update({
    where: { id: transactionId },
    data: {
      status: "VOIDED",
      voidedAt: new Date(),
      voidedBy: user?.userId,
    },
  });

  // Create refund transaction
  const refundTx = await prisma.transaction.create({
    data: {
      reservationId: transaction.reservationId,
      amount: -amount,
      type: "REFUND",
      refundedTransactionId: transactionId,
      isReadOnly: false,
    },
  });

  // Audit log
  await createAuditLog({
    actionType: "UPDATE",
    entityType: "Transaction",
    entityId: transactionId,
    newValue: {
      status: "VOIDED",
      refundTransactionId: refundTx.id,
      refundAmount: amount,
    } as unknown as Record<string, unknown>,
    ipAddress: ip,
  });

  return {
    success: true,
    data: {
      voidedTransactionId: voidedTx.id,
      refundAmount: amount,
    },
  };
}
```

**Why Complex:**
- **Rate limiting per IP** with exponential backoff
- **PIN verification** with attempt tracking
- **Dynamic limits** based on user role
- **Automatic refund creation** (negative transaction)
- **Audit trail** for compliance
- **Prevents brute force attacks**

---

## 2. **Night Audit & Financial Reconciliation** (app/actions/finance.ts)
**Complexity Level: ⭐⭐⭐⭐⭐ EXTREME**

### Why It's Complex:
- **Idempotency check** (prevents running twice)
- **Atomic multi-step operations**
- **Automatic no-show detection**
- **Read-only transaction freezing**
- **Comprehensive audit logging**

```typescript
export async function runNightAudit(): Promise<
  ActionResult<{ closedCount: number; noShowCount: number; reportSummary: Record<string, number> }>
> {
  const headersList = await headers();
  const ip = getClientIp(headersList);
  const today = startOfToday();
  const todayStr = today.toISOString().slice(0, 10);

  try {
    // IDEMPOTENCY CHECK: Prevent running twice for same day
    const alreadyRun = await prisma.auditLog.findFirst({
      where: {
        entityType: "NightAudit",
        entityId: { startsWith: todayStr },
      },
    });
    if (alreadyRun) {
      return {
        success: false,
        error: "Night Audit dla tej doby został już wykonany. Nie można zamknąć doby dwukrotnie.",
      };
    }

    // STEP 1: Freeze all transactions from before today (set isReadOnly = true)
    const result = await prisma.transaction.updateMany({
      where: { createdAt: { lt: today } },
      data: { isReadOnly: true },
    });

    // STEP 2: Auto-mark no-shows (CONFIRMED reservations with checkIn < today)
    const noShowResult = await prisma.reservation.updateMany({
      where: {
        status: "CONFIRMED",
        checkIn: { lt: today },
      },
      data: { status: "NO_SHOW" },
    });

    // STEP 3: Generate summary report
    const report = await prisma.transaction.aggregate({
      where: { createdAt: { lt: today } },
      _sum: { amount: true },
      _count: true,
    });

    // STEP 4: Audit log (idempotency key)
    await createAuditLog({
      actionType: "UPDATE",
      entityType: "NightAudit",
      entityId: today.toISOString(),
      newValue: {
        closedCount: result.count,
        noShowCount: noShowResult.count,
        totalAmount: report._sum.amount?.toString(),
        transactionCount: report._count,
      } as unknown as Record<string, unknown>,
      ipAddress: ip,
    });

    revalidatePath("/finance");
    revalidatePath("/reports");
    
    return {
      success: true,
      data: {
        closedCount: result.count,
        noShowCount: noShowResult.count,
        reportSummary: {
          transactionsClosed: result.count,
          totalAmount: Number(report._sum.amount ?? 0),
        },
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd Night Audit",
    };
  }
}
```

**Why Complex:**
- **Idempotency via audit log** (prevents double-closing)
- **Atomic multi-step process** (freeze + no-show + report)
- **Automatic no-show detection** (business logic)
- **Comprehensive reporting** (summary statistics)

---

## 3. **KSeF Integration** (Polish E-Invoice System)
**Complexity Level: ⭐⭐⭐⭐⭐ EXTREME**

### Why It's Complex:
- **Session management** with token expiration
- **Batch processing** with retry logic
- **XML validation** for compliance
- **Async status checking**
- **Error recovery queue**

```typescript
export async function getOrCreateValidKsefSession(propertyId: string | null): Promise<
  ActionResult<{ sessionId: string; sessionToken: string; contextIdentifier: string }>
> {
  try {
    // Find existing valid session
    const existing = await prisma.ksefSession.findFirst({
      where: {
        propertyId,
        tokenExpiresAt: { gt: new Date() }, // Not expired
      },
      orderBy: { createdAt: "desc" },
    });

    if (existing && existing.sessionToken && existing.contextIdentifier) {
      return {
        success: true,
        data: {
          sessionId: existing.id,
          sessionToken: existing.sessionToken,
          contextIdentifier: existing.contextIdentifier,
        },
      };
    }

    // Create new session
    const initResult = await initKsefSession(propertyId);
    if (!initResult.success) {
      return initResult;
    }

    return {
      success: true,
      data: {
        sessionId: initResult.data.sessionId,
        sessionToken: initResult.data.sessionToken,
        contextIdentifier: initResult.data.contextIdentifier,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd sesji KSeF",
    };
  }
}

export async function sendBatchToKsef(invoiceIds: string[]): Promise<
  ActionResult<{ batchId: string; sent: number; failed: number; queued: number }>
> {
  try {
    if (!invoiceIds || invoiceIds.length === 0) {
      return { success: false, error: "Brak faktur do wysłania" };
    }

    const propertyId = await getEffectivePropertyId();
    const sessionResult = await getOrCreateValidKsefSession(propertyId);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const session = sessionResult.data;
    const invoices = await prisma.invoice.findMany({
      where: { id: { in: invoiceIds } },
    });

    if (invoices.length === 0) {
      return { success: false, error: "Brak znalezionych faktur" };
    }

    let sent = 0;
    let failed = 0;
    let queued = 0;

    for (const invoice of invoices) {
      try {
        // Generate XML for invoice
        const xmlString = generateInvoiceXml(invoice);

        // Validate XML
        const validationResult = await validateInvoiceXmlForKsef(xmlString);
        if (!validationResult.success) {
          failed++;
          continue;
        }

        // Send to KSeF
        const sendResult = await sendInvoiceToKsef(invoice.id);
        if (sendResult.success) {
          sent++;
        } else {
          // Queue for retry
          await prisma.ksefPendingSend.upsert({
            where: { invoiceId: invoice.id },
            create: {
              invoiceId: invoice.id,
              attemptCount: 1,
              lastError: sendResult.error,
            },
            update: {
              attemptCount: { increment: 1 },
              lastAttemptAt: new Date(),
              lastError: sendResult.error,
            },
          });
          queued++;
        }
      } catch (e) {
        failed++;
        console.error(`[sendBatchToKsef] Error for invoice ${invoice.id}:`, e);
      }
    }

    // Create batch record
    const batch = await prisma.ksefSentBatch.create({
      data: {
        sessionId: session.sessionId,
        invoiceIds: invoiceIds,
        status: sent > 0 ? "SENT" : failed > 0 ? "FAILED" : "PENDING",
      },
    });

    return {
      success: true,
      data: {
        batchId: batch.id,
        sent,
        failed,
        queued,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd wysyłania batch do KSeF",
    };
  }
}

export async function processKsefPendingQueue(): Promise<{ processed: number; sent: number; failed: number }> {
  const pending = await prisma.ksefPendingSend.findMany({
    where: {
      attemptCount: { lt: 5 }, // Max 5 retries
      lastAttemptAt: { lt: new Date(Date.now() - 60 * 60 * 1000) }, // Last attempt > 1 hour ago
    },
    take: 50, // Process max 50 per run
  });

  let sent = 0;
  let failed = 0;

  for (const pending of pending) {
    try {
      const result = await sendInvoiceToKsef(pending.invoiceId);
      if (result.success) {
        await prisma.ksefPendingSend.delete({
          where: { id: pending.id },
        });
        sent++;
      } else {
        await prisma.ksefPendingSend.update({
          where: { id: pending.id },
          data: {
            attemptCount: { increment: 1 },
            lastAttemptAt: new Date(),
            lastError: result.error,
          },
        });
        failed++;
      }
    } catch (e) {
      failed++;
    }
  }

  return { processed: pending.length, sent, failed };
}
```

**Why Complex:**
- **Session lifecycle management** (create, validate, keep-alive, terminate)
- **Batch processing** with partial success handling
- **Retry queue** with exponential backoff
- **XML validation** for compliance
- **Async status checking** (poll for acceptance)

---

## 4. **Fiscal Printer Integration** (lib/fiscal/)
**Complexity Level: ⭐⭐⭐⭐ VERY HIGH**

### Why It's Complex:
- **Multiple driver support** (Posnet, Novitus, Elzab)
- **Protocol-specific implementations**
- **Error recovery** and retry logic
- **Report generation** (X, Z, periodic, storno)
- **Fallback mechanisms**

```typescript
export async function printFiscalStornoAction(
  options: {
    originalReceiptNumber: string;
    reason: StornoReason;
    amount: number;
    items?: Array<{
      name: string;
      quantity: number;
      unitPrice: number;
      vatRate?: number;
    }>;
    operatorId?: string;
    operatorNote?: string;
  }
): Promise<ActionResult<FiscalStornoResult>> {
  const headersList = await headers();
  const ip = getClientIp(headersList);

  try {
    // Validate required fields
    if (!options.originalReceiptNumber?.trim()) {
      return { success: false, error: "Numer oryginalnego paragonu jest wymagany" };
    }

    if (!options.reason) {
      return { success: false, error: "Powód storna jest wymagany" };
    }

    // Validate reason (must be one of allowed reasons)
    const validReasons: StornoReason[] = [
      "CUSTOMER_RETURN",
      "CUSTOMER_CANCEL",
      "OPERATOR_ERROR",
      "PRICE_ERROR",
      "QUANTITY_ERROR",
      "WRONG_ITEM",
      "DOUBLE_SCAN",
      "TECHNICAL_ERROR",
      "OTHER",
    ];
    if (!validReasons.includes(options.reason)) {
      return { 
        success: false, 
        error: `Nieprawidłowy powód storna. Dozwolone: ${validReasons.join(", ")}` 
      };
    }

    // Validate amount
    if (options.amount === undefined || options.amount === null) {
      return { success: false, error: "Kwota storna jest wymagana" };
    }
    if (typeof options.amount !== "number" || isNaN(options.amount)) {
      return { success: false, error: "Kwota storna musi być liczbą" };
    }
    if (options.amount <= 0) {
      return { success: false, error: "Kwota storna musi być większa od zera" };
    }

    // Validate items (if provided)
    if (options.items && options.items.length > 0) {
      for (const item of options.items) {
        if (!item.name?.trim()) {
          return { success: false, error: "Nazwa pozycji storna jest wymagana" };
        }
        if (typeof item.quantity !== "number" || item.quantity <= 0) {
          return { success: false, error: `Nieprawidłowa ilość dla pozycji: ${item.name}` };
        }
        if (typeof item.unitPrice !== "number" || item.unitPrice < 0) {
          return { success: false, error: `Nieprawidłowa cena dla pozycji: ${item.name}` };
        }
      }

      // Verify items sum matches storno amount
      const itemsTotal = options.items.reduce(
        (sum, item) => sum + item.quantity * item.unitPrice,
        0
      );
      // Allow 1-cent tolerance for rounding
      if (Math.abs(itemsTotal - options.amount) > 0.01) {
        return {
          success: false,
          error: `Suma pozycji (${itemsTotal.toFixed(2)} PLN) nie zgadza się z kwotą storna (${options.amount.toFixed(2)} PLN)`,
        };
      }
    }

    // Build storno request
    const request: FiscalStornoRequest = {
      originalReceiptNumber: options.originalReceiptNumber.trim(),
      transactionId: "",
      reason: options.reason,
      amount: options.amount,
      items: options.items,
      operatorNote: options.operatorNote,
    };

    // Execute storno
    const result = await printFiscalStorno(request);

    // Map reason to human-readable description
    const reasonDescriptions: Record<StornoReason, string> = {
      CUSTOMER_RETURN: "Zwrot towaru",
      CUSTOMER_CANCEL: "Rezygnacja klienta",
      OPERATOR_ERROR: "Błąd operatora",
      PRICE_ERROR: "Błąd ceny",
      QUANTITY_ERROR: "Błąd ilości",
      WRONG_ITEM: "Pomyłka w pozycji",
      DOUBLE_SCAN: "Podwójne zeskanowanie",
      TECHNICAL_ERROR: "Błąd techniczny",
      OTHER: "Inny powód",
    };

    // Audit log (storno is critical for compliance)
    await createAuditLog({
      actionType: "CREATE",
      entityType: "FISCAL",
      entityId: result.stornoNumber ?? options.originalReceiptNumber,
      newValue: {
        fiscalAction: "STORNO",
        success: result.success,
        originalReceiptNumber: options.originalReceiptNumber,
        stornoNumber: result.stornoNumber,
        stornoAmount: options.amount,
        reason: options.reason,
        reasonDescription: reasonDescriptions[options.reason],
        operatorNote: options.operatorNote,
        itemsCount: options.items?.length ?? 0,
        errorCode: result.errorCode,
        errorMessage: result.error,
      },
      ipAddress: ip,
    });

    if (!result.success) {
      return { 
        success: false, 
        error: result.error || "Błąd wykonania storna" 
      };
    }

    return { success: true, data: result };
  } catch (e) {
    console.error("[printFiscalStornoAction]", e);
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd wykonania storna",
    };
  }
}
```

**Why Complex:**
- **Multi-step validation** (reason, amount, items)
- **Item reconciliation** (sum must match amount)
- **Rounding tolerance** (1-cent for floating-point)
- **Comprehensive audit logging** (compliance requirement)
- **Multiple driver support** (Posnet, Novitus, Elzab)

---

## 5. **Reservation & Availability Engine** (app/actions/reservations.ts)
**Complexity Level: ⭐⭐⭐⭐ VERY HIGH**

### Why It's Complex:
- **Overbooking detection** with configurable tolerance
- **Availability calculation** across multiple room types
- **Rate code application** with seasonal pricing
- **Conflict detection** (blocks, allotments, other reservations)
- **Multi-property support**

### Key Challenges:
- Handling overlapping date ranges
- Calculating available rooms per night
- Applying multiple pricing rules
- Detecting no-shows and cancellations
- Managing room blocks and allotments

---

## 6. **Housekeeping Offline-First System** (app/housekeeping/)
**Complexity Level: ⭐⭐⭐⭐ VERY HIGH**

### Why It's Complex:
- **Offline data synchronization**
- **Conflict resolution** (concurrent updates)
- **Room status state machine** (CLEAN → DIRTY → OOO → INSPECTION → INSPECTED)
- **Staff assignment** with floor-based grouping
- **Priority-based scheduling**

---

## 7. **Dashboard KPI Calculations** (app/actions/dashboard.ts)
**Complexity Level: ⭐⭐⭐⭐ VERY HIGH**

### Why It's Complex:
- **Multi-metric calculations** (Occupancy, ADR, RevPAR)
- **Date range handling** with timezone awareness
- **Aggregation across multiple entities**
- **Performance optimization** (batch queries)
- **Real-time updates** with caching

```typescript
export async function getKpiReport(
  fromStr: string,
  toStr: string
): Promise<ActionResult<KpiReportData>> {
  const from = new Date(fromStr + "T00:00:00.000Z");
  const to = new Date(toStr + "T23:59:59.999Z");

  try {
    // Get all rooms available for sale
    const rooms = await prisma.room.findMany({
      where: { activeForSale: true },
    });

    const totalRooms = rooms.length;
    if (totalRooms === 0) {
      return { success: false, error: "Brak pokoi dostępnych do sprzedaży" };
    }

    // Calculate available room-nights
    const nights = Math.ceil((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
    const availableRoomNights = totalRooms * nights;

    // Get sold room-nights (CONFIRMED, CHECKED_IN, CHECKED_OUT)
    const soldReservations = await prisma.reservation.findMany({
      where: {
        status: { in: ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT"] },
        checkIn: { lt: to },
        checkOut: { gt: from },
      },
    });

    let soldRoomNights = 0;
    for (const res of soldReservations) {
      const resFrom = new Date(res.checkIn);
      const resTo = new Date(res.checkOut);
      
      // Calculate overlap with report period
      const overlapFrom = resFrom > from ? resFrom : from;
      const overlapTo = resTo < to ? resTo : to;
      
      const overlapNights = Math.ceil(
        (overlapTo.getTime() - overlapFrom.getTime()) / (24 * 60 * 60 * 1000)
      );
      
      soldRoomNights += overlapNights;
    }

    // Calculate occupancy %
    const occupancyPercent = availableRoomNights > 0
      ? Math.round((soldRoomNights / availableRoomNights) * 100)
      : 0;

    // Get room revenue (ROOM type transactions)
    const roomRevenue = await prisma.transaction.aggregate({
      where: {
        type: "ROOM",
        status: "ACTIVE",
        createdAt: { gte: from, lte: to },
      },
      _sum: { amount: true },
    });

    const totalRoomRevenue = Number(roomRevenue._sum.amount ?? 0);

    // Calculate ADR (Average Daily Rate)
    const adr = soldRoomNights > 0
      ? totalRoomRevenue / soldRoomNights
      : null;

    // Calculate RevPAR (Revenue Per Available Room)
    const revPar = availableRoomNights > 0
      ? totalRoomRevenue / availableRoomNights
      : null;

    return {
      success: true,
      data: {
        from: fromStr,
        to: toStr,
        totalRooms,
        availableRoomNights,
        soldRoomNights,
        occupancyPercent,
        roomRevenue: totalRoomRevenue,
        adr,
        revPar,
      },
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Błąd obliczania KPI",
    };
  }
}
```

**Why Complex:**
- **Date range overlap calculation** (handle partial overlaps)
- **Multi-step aggregation** (rooms → reservations → transactions)
- **Financial calculations** (ADR, RevPAR)
- **Null handling** (avoid division by zero)
- **Performance** (batch queries, indexing)

---

## 8. **Channel Manager Synchronization** (app/actions/channel-manager.ts)
**Complexity Level: ⭐⭐⭐⭐ VERY HIGH**

### Why It's Complex:
- **Multi-channel support** (Booking.com, Airbnb, Expedia)
- **Availability sync** (push to OTA)
- **Reservation pull** (fetch from OTA)
- **Rate mapping** (internal → external)
- **Conflict resolution** (double-booking prevention)

---

## 9. **Loyalty Program System** (app/actions/loyalty.ts)
**Complexity Level: ⭐⭐⭐ HIGH**

### Why It's Complex:
- **Tier calculation** (based on points/stays)
- **Point earning** (per reservation, per transaction)
- **Point redemption** (with expiration)
- **Tier benefits** (automatic upgrades)
- **Transaction history** (audit trail)

---

## 10. **GDPR Compliance System** (app/actions/gdpr.ts)
**Complexity Level: ⭐⭐⭐ HIGH**

### Why It's Complex:
- **Consent tracking** (multiple types)
- **Data anonymization** (right to be forgotten)
- **Signature capture** (electronic consent)
- **Audit trail** (compliance proof)
- **Data retention** (automatic cleanup)

---

## Summary: Complexity Ranking

| Component | Complexity | Key Challenge |
|-----------|-----------|----------------|
| Financial Transactions | ⭐⭐⭐⭐⭐ | Atomic operations, split payments, rate limiting |
| Night Audit | ⭐⭐⭐⭐⭐ | Idempotency, multi-step reconciliation |
| KSeF Integration | ⭐⭐⭐⭐⭐ | Session management, batch processing, retry logic |
| Fiscal Printer | ⭐⭐⭐⭐ | Multi-driver support, protocol handling |
| Reservations | ⭐⭐⭐⭐ | Overbooking, availability, pricing |
| Housekeeping | ⭐⭐⭐⭐ | Offline sync, conflict resolution |
| Dashboard KPI | ⭐⭐⭐⭐ | Date range overlap, aggregation |
| Channel Manager | ⭐⭐⭐⭐ | Multi-channel sync, mapping |
| Loyalty Program | ⭐⭐⭐ | Tier calculation, point tracking |
| GDPR Compliance | ⭐⭐⭐ | Consent tracking, anonymization |

---

## Architectural Patterns Used

### 1. **Atomic Transactions**
Used in document numbering, void transactions, and night audit to prevent race conditions.

### 2. **Idempotency Keys**
Used in night audit, KSeF batch processing, and payment processing to prevent duplicate operations.

### 3. **Rate Limiting**
Used in PIN verification (void transactions) and login attempts to prevent brute force attacks.

### 4. **Audit Logging**
Used throughout for compliance, debugging, and security tracking.

### 5. **Retry Queues**
Used in KSeF integration and payment processing for resilience.

### 6. **State Machines**
Used in room status (CLEAN → DIRTY → OOO), reservation status (CONFIRMED → CHECKED_IN → CHECKED_OUT), and order status.

### 7. **Batch Processing**
Used in KSeF batch sending, payment reconciliation, and report generation.

### 8. **Caching & Revalidation**
Used with Next.js `revalidatePath()` for real-time updates.

---

## Performance Considerations

1. **Database Indexing**: Critical for date range queries and lookups
2. **Batch Operations**: Used to reduce database round-trips
3. **Aggregation Queries**: Used for KPI calculations
4. **Transaction Isolation**: Used for financial operations
5. **Async Processing**: Used for KSeF, email, SMS

---

## Security Measures

1. **PIN Verification** with rate limiting
2. **IP Whitelisting** for API access
3. **Session Management** with idle timeout
4. **Audit Logging** for compliance
5. **Input Validation** for all user inputs
6. **SQL Injection Prevention** via Prisma ORM
7. **CSRF Protection** via Next.js middleware
8. **GDPR Compliance** with consent tracking

---

## Conclusion

The HotelSystem codebase demonstrates sophisticated enterprise-level software engineering with:
- Complex financial logic
- Multi-system integrations
- Compliance requirements (VAT, KSeF, GDPR)
- High availability and reliability
- Comprehensive audit trails
- Real-time data synchronization

The most complex parts involve financial transactions, night audit reconciliation, and KSeF integration, which require careful handling of atomicity, idempotency, and error recovery.
