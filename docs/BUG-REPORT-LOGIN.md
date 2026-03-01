# BUG REPORT: Okno logowania PIN

## Opis komponentu

Okno logowania (`/login`) umożliwia szybkie logowanie pracowników hotelu poprzez:
1. Wyświetlenie listy aktywnych użytkowników jako przyciski
2. Po kliknięciu użytkownika — dialog z keypadem do wpisania 4-cyfrowego PIN
3. Automatyczne zalogowanie po wpisaniu poprawnego PIN

### Pliki źródłowe:
- **Frontend:** `app/login/page.tsx`
- **API lista użytkowników:** `app/api/auth/users/route.ts`
- **API logowanie PIN:** `app/api/auth/pin-login/route.ts`
- **Funkcje auth (sesja, hash PIN):** `lib/auth.ts`

---

## BUG 1: Po zalogowaniu strona nie przechodzi na główną — zostaje na /login (KRYTYCZNY)

**Co nie działa:** Po poprawnym wpisaniu PIN i komunikacie "Zalogowano jako X", strona pozostaje na `/login` zamiast przekierować na stronę główną.

**Gdzie w kodzie:** `app/login/page.tsx`, linie 115-118

**Co powinno się dziać:** Po udanym logowaniu → przekierowanie na `/` (lub `/front-office`).

**Co się dzieje:**
```typescript
toast.success(`Zalogowano jako ${selectedUser.name}`);
closePinDialog();
router.push("/");
router.refresh();
```
`router.push("/")` jest wywoływane, ale przekierowanie nie działa — możliwe przyczyny:
- `closePinDialog()` wywołuje re-render przed `router.push`
- Brak `await` lub nieprawidłowa kolejność operacji
- Cookie sesji nie jest ustawiane przed przekierowaniem (race condition)

**Logi/error:** W konsoli przeglądarki sprawdź Network tab — czy cookie `pms_session` jest ustawiane w odpowiedzi `/api/auth/pin-login`.

**Fix propozycja:**
```typescript
// Zamień kolejność lub dodaj delay:
toast.success(`Zalogowano jako ${selectedUser.name}`);
router.push("/");
router.refresh();
// closePinDialog() — wywołaj PO przekierowaniu lub usuń (i tak strona się zmieni)
```

---

## BUG 2: Nie wszystkie konta mają ustawiony PIN — brak możliwości logowania (KRYTYCZNY)

**Co nie działa:** Użytkownicy bez ustawionego PIN (pole `pin` = null) są wyświetlani na liście, ale nie mogą się zalogować.

**Gdzie w kodzie:**
- Lista użytkowników: `app/api/auth/users/route.ts` — nie filtruje po `pin IS NOT NULL`
- Weryfikacja: `app/api/auth/pin-login/route.ts`, linie 64-68

**Co powinno się dziać:**
- OPCJA A: Na liście pokazywać tylko użytkowników z ustawionym PIN
- OPCJA B: Przy kliknięciu użytkownika bez PIN pokazać komunikat "Ustaw PIN w ustawieniach"

**Co się dzieje:**
```typescript
// api/auth/users/route.ts — pobiera WSZYSTKICH aktywnych
const users = await prisma.user.findMany({
  where: { isActive: true },  // brak: pin: { not: null }
  // ...
});

// api/auth/pin-login/route.ts — zwraca błąd dla userów bez PIN
if (!user.pin) {
  return NextResponse.json(
    { error: "PIN nie ustawiony. Użyj logowania przez email/hasło." },
    { status: 401 }
  );
}
```

**Relevantne typy/modele:**
```typescript
// Prisma model User
model User {
  pin          String?  @db.VarChar(128)  // NULLABLE — nie wszyscy mają PIN!
  // ...
}
```

**Fix propozycja (OPCJA A — filtruj listę):**
```typescript
// app/api/auth/users/route.ts
const users = await prisma.user.findMany({
  where: { 
    isActive: true,
    pin: { not: null }  // DODAJ — tylko z PIN
  },
  // ...
});
```

**Fix propozycja (OPCJA B — seed domyślny PIN 1234):**
```typescript
// prisma/seed.ts lub skrypt migracyjny
import { hashPin } from "@/lib/auth";

const defaultPin = await hashPin("1234");
await prisma.user.updateMany({
  where: { pin: null, isActive: true },
  data: { pin: defaultPin }
});
```

---

## BUG 3: Tekst w przyciskach użytkowników wychodzi poza przycisk (overflow)

**Co nie działa:** Długie nazwy użytkowników (np. "Anna Kowalska-Nowak") wylewają się poza obszar przycisku.

**Gdzie w kodzie:** `app/login/page.tsx`, linie 159-167

**Co powinno się dziać:** Tekst powinien się zawijać, skracać z `...` lub przycisk powinien się rozszerzać.

**Co się dzieje:**
```tsx
<Button
  key={user.id}
  variant="outline"
  size="lg"
  className="h-16 text-base font-medium"  // brak overflow handling
  onClick={() => openPinDialog(user)}
>
  {user.name}  // może być bardzo długi
</Button>
```

**Fix propozycja:**
```tsx
<Button
  key={user.id}
  variant="outline"
  size="lg"
  className="h-16 text-base font-medium overflow-hidden text-ellipsis whitespace-nowrap px-2"
  title={user.name}  // tooltip z pełną nazwą
  onClick={() => openPinDialog(user)}
>
  {user.name}
</Button>
```
Lub z zawijaniem:
```tsx
className="h-auto min-h-16 text-base font-medium text-center break-words px-2 py-2"
```

---

## BUG 4: Brak obsługi klawiatury fizycznej

**Co nie działa:** Użytkownik nie może wpisywać PIN z klawiatury komputera — musi klikać przyciski myszką.

**Gdzie w kodzie:** `app/login/page.tsx`, brak `onKeyDown` handler w komponencie Dialog (linie ~195-250)

**Co powinno się dziać:** Po otwarciu dialogu PIN, naciśnięcie klawiszy 0-9 powinno dodawać cyfry, Backspace usuwać, Enter zatwierdzać.

**Co się dzieje:** Input jest `readOnly`, brak event listenerów na klawiaturę — użytkownik musi używać myszki.

**Relevantne typy/modele:**
```typescript
// app/login/page.tsx
const addDigit = (d: string) => {
  if (pin.length >= 4) return;
  setPin((p) => p + d);
  setPinError("");
};
```

**Fix:** Dodać `useEffect` z `addEventListener("keydown")` lub `onKeyDown` na DialogContent.

---

## BUG 5: Niestandardowy układ keypada

**Co nie działa:** Keypad ma układ 7-8-9 / 4-5-6 / 1-2-3 / 0, co jest odwrotne do standardu telefonu i może mylić użytkowników.

**Gdzie w kodzie:** `app/login/page.tsx`, linia 132

**Co powinno się dziać:** Układ jak na telefonie: 1-2-3 / 4-5-6 / 7-8-9 / 0 (na środku)

**Co się dzieje:** 
```typescript
const keypad = ["7", "8", "9", "4", "5", "6", "1", "2", "3", "0"];
```
Zero jest w lewym dolnym rogu zamiast na środku.

**Logi/error:** Brak błędu — to problem UX.

---

## BUG 6: Memory leak w mechanizmie lockout

**Co nie działa:** Blokady po 3 nieudanych próbach są trzymane w pamięci RAM bez limitu i bez cleanup.

**Gdzie w kodzie:** `app/api/auth/pin-login/route.ts`, linie 10-13

**Co powinno się dziać:** Stare wpisy powinny być automatycznie czyszczone po upływie czasu blokady.

**Co się dzieje:**
```typescript
const failedAttempts = new Map<
  string,
  { count: number; lockedUntil: Date }
>();
```
Mapa rośnie przy każdym nowym userId który źle wpisze PIN. Wpisy są usuwane tylko przy **udanym** logowaniu lub przy **kolejnej** próbie po upływie blokady — ale jeśli użytkownik nie wraca, wpis zostaje na zawsze.

**Relevantne typy/modele:**
```typescript
// Prisma model User
model User {
  id           String   @id @default(cuid())
  email        String   @unique
  name         String
  passwordHash String
  role         String   @default("RECEPTION")
  isActive     Boolean  @default(true)
  pin          String?  @db.VarChar(128)
  // ...
}
```

**Fix:** Dodać `setInterval` do czyszczenia wygasłych wpisów lub przenieść lockout do bazy danych.

---

## BUG 7: Potencjalny race condition przy auto-submit

**Co nie działa:** Auto-submit po wpisaniu 4 cyfr może wywołać się wielokrotnie.

**Gdzie w kodzie:** `app/login/page.tsx`, linie 126-130

**Co powinno się dziać:** Jeden request na jeden kompletny PIN.

**Co się dzieje:**
```typescript
useEffect(() => {
  if (pin.length === 4 && selectedUser && !pinLoading) {
    submitPin();
  }
}, [pin, selectedUser, pinLoading, submitPin]);
```
Jeśli `submitPin` zakończy się błędem i wyczyści PIN (`setPin("")`), a następnie użytkownik szybko wpisze kolejny PIN, może dojść do race condition.

**Logi/error:** Możliwe podwójne requesty w Network tab.

---

## BUG 8: Brak aria-label na przyciskach keypada

**Co nie działa:** Przyciski cyfr nie mają opisów dla screen readerów.

**Gdzie w kodzie:** `app/login/page.tsx`, linie 195-206

**Co powinno się dziać:** Każdy przycisk powinien mieć `aria-label="Cyfra X"`.

**Co się dzieje:**
```tsx
{keypad.map((d) => (
  <Button
    key={d}
    variant="outline"
    // brak aria-label
  >
    {d}
  </Button>
))}
```

---

## BUG 9: Hardcoded logo bez fallbacka

**Co nie działa:** Logo `/logo.png` może nie istnieć lub zwracać 404.

**Gdzie w kodzie:** `app/login/page.tsx`, linia 138

**Co powinno się dziać:** Fallback do tekstu lub domyślnego obrazka przy błędzie ładowania.

**Co się dzieje:**
```tsx
<img src="/logo.png" alt="Hotel Łabędź" className="h-20 w-auto rounded-lg" />
```
Brak `onError` handlera.

---

## BUG 10: Lista użytkowników pokazuje WSZYSTKICH aktywnych (potencjalny problem bezpieczeństwa)

**Co nie działa:** API `/api/auth/users` zwraca wszystkich aktywnych użytkowników bez autoryzacji.

**Gdzie w kodzie:** `app/api/auth/users/route.ts`

**Co powinno się dziać:** Rozważyć czy to zamierzone zachowanie — ujawnia listę pracowników każdemu kto zna URL.

**Co się dzieje:**
```typescript
export async function GET() {
  // Brak sprawdzenia autoryzacji
  const users = await prisma.user.findMany({
    where: { isActive: true },
    // ...
  });
}
```

**Relevantne typy/modele:**
```typescript
type UserItem = {
  id: string;
  name: string;
  role: string;
};
```

---

## Dodaj do komponentu (debug helper):

```typescript
const debugReservation = (label: string, data: any) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEBUG ${label}]`, JSON.stringify(data, null, 2));
  }
};

// Użycie w submitPin:
const submitPin = useCallback(async () => {
  debugReservation('PIN_SUBMIT_START', { userId: selectedUser?.id, pinLength: pin.length });
  // ...
  const res = await fetch("/api/auth/pin-login", { ... });
  const data = await res.json();
  debugReservation('PIN_SUBMIT_RESPONSE', { status: res.status, data });
  // ...
}, [selectedUser, pin, router]);
```

---

## Priorytet napraw:

1. **KRYTYCZNY:** BUG 1 (brak przekierowania po logowaniu) — **system nie działa**
2. **KRYTYCZNY:** BUG 2 (brak PIN dla użytkowników) — **nie można się zalogować**
3. **WYSOKI:** BUG 3 (overflow tekstu w przyciskach) — **UX zepsuty**
4. **WYSOKI:** BUG 4 (klawiatura) — podstawowa użyteczność
5. **ŚREDNI:** BUG 7 (race condition) — może powodować dziwne zachowania
6. **ŚREDNI:** BUG 6 (memory leak) — problem przy długim działaniu serwera
7. **ŚREDNI:** BUG 5 (keypad layout) — UX
8. **NISKI:** BUG 8, 9 (a11y, logo) — poprawa jakości
9. **DO DYSKUSJI:** BUG 10 (bezpieczeństwo) — zależy od wymagań

---

## Architektura obecna:

```
┌─────────────────────────────────────────────────────┐
│  /login (page.tsx)                                  │
│  ┌───────────────┐    ┌──────────────────────────┐ │
│  │ Lista users   │───▶│ GET /api/auth/users      │ │
│  │ (przyciski)   │    │ → prisma.user.findMany() │ │
│  └───────────────┘    └──────────────────────────┘ │
│         │                                           │
│         ▼                                           │
│  ┌───────────────┐    ┌──────────────────────────┐ │
│  │ Dialog PIN    │───▶│ POST /api/auth/pin-login │ │
│  │ (keypad)      │    │ → verifyPin() + JWT      │ │
│  └───────────────┘    └──────────────────────────┘ │
│         │                                           │
│         ▼                                           │
│  router.push("/") + cookie pms_session              │
└─────────────────────────────────────────────────────┘
```

---

## Testy do dodania:

```typescript
// Test/login.spec.ts
describe('Login Page', () => {
  it('przekierowuje na / po poprawnym logowaniu');  // BUG 1
  it('pokazuje tylko użytkowników z ustawionym PIN');  // BUG 2
  it('przyciski użytkowników nie mają overflow');  // BUG 3
  it('obsługuje klawiaturę numeryczną');  // BUG 4
  it('blokuje po 3 błędnych PIN');
  it('czyści PIN po błędzie');
  it('nie wysyła wielokrotnych requestów');  // BUG 7
});
```
