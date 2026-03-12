# Pełna weryfikacja funkcji — raport

Ten dokument zawiera wyniki weryfikacji punkt po punkcie, wraz z pełnym kodem i instrukcjami testowania.

---

## SEKCJE WYBOR

### 1. console.log przed renderowaniem siatki dań

**Dodano w** `components/events/menu-modul.tsx` (linia ~403):

```javascript
const sek = pakiet.sekcje.find((s) => s.id === aktywnaSekcja);
console.log("SEKCJA:", sek?.id, sek?.typ, JSON.stringify(sek?.dania));
```

**Oczekiwany output dla sekcji "Surówki"** (jeśli istnieje w pakiecie):

```
SEKCJA: surowki wybor ["Surówka z marchewki","Surówka z kapusty",...]
```

Jeśli `s.dania` jest `[]`, problem leży w definicji sekcji w API/bazie (`/api/menu-packages`, tabela `MenuPackageSection`).

---

### 2. Pełny JSX prawego panelu (od `{(() => {` do `})()}`)

```jsx
{(() => {
  const sek = pakiet.sekcje.find((s) => s.id === aktywnaSekcja);
  console.log("SEKCJA:", sek?.id, sek?.typ, JSON.stringify(sek?.dania));
  if (!sek) return <div style={{ color: "#9ca3af", fontSize: "13px" }}>Wybierz sekcję z lewej</div>;
  const limit = "limit" in sek ? (sek.limit as number) : 0;
  const wybrane = wybory[sek.id] || [];
  const pelne = sek.typ === "wybor" && wybrane.length >= limit;
  return (
    <>
      <div style={{ marginBottom: "16px", paddingBottom: "12px", borderBottom: "1px solid #f3f4f6" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#111827" }}>{sek.label.replace(/ \(.*\)/, "")}</h3>
          {sek.typ === "wybor" && wybrane.length > 0 && (
            <button onClick={() => clearSekcja(sek.id)} style={{ fontSize: "11px", color: "#6b7280", background: "none", border: "1px solid #e5e7eb", borderRadius: "4px", padding: "2px 8px", cursor: "pointer" }}>Wyczyść</button>
          )}
        </div>
        <p style={{ margin: "5px 0 0", fontSize: "12px", color: "#6b7280" }}>
          {sek.typ === "fixed"
            ? `${sek.dania.length} ${sek.dania.length === 1 ? "danie" : sek.dania.length < 5 ? "dania" : "dań"} w zestawie — kliknij ✎ aby zmienić danie`
            : pelne ? `✓ Wybrano ${wybrane.length} z ${limit} — odznacz danie aby zmienić` : `Wybierz ${wybrane.length} z ${limit}`}
        </p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
        {sek.dania.map((d: string) => {
          if (sek.typ === "fixed") {
            const zamiennik = zamienniki[d];
            return (
              <div key={d} style={{ padding: "14px 16px", borderRadius: "8px", border: `2px solid ${zamiennik ? "#f59e0b" : "#e5e7eb"}", background: zamiennik ? "#fffbeb" : "#fafafa", ... }}>
                <span>...</span>
                <button onClick={() => zamiennik ? usunZamiennik(d) : otworzModalZamiennik(sek.label, d)}>
                  {zamiennik ? "✕ Usuń zamiennik" : "✎ Zmień danie"}
                </button>
              </div>
            );
          }
          const sel = wybrane.includes(d);
          const zablok = !sel && pelne;
          return (
            <div
              key={d}
              onClick={() => !zablok && toggleWybor(sek.id, d, limit)}
              style={{ ... cursor: zablok ? "not-allowed" : "pointer", ... }}
            >
              <div>✓</div>
              <span>{d}</span>
            </div>
          );
        })}
      </div>
    </>
  );
})()}
```

---

### 3. Czy karty dań mają onClick podpięty do toggleWybor?

**Tak.** Dla sekcji `typ === "wybor"`:

```jsx
onClick={() => !zablok && toggleWybor(sek.id, d, limit)}
```

- `!zablok` blokuje kliknięcie gdy limit już osiągnięty
- Po kliknięciu wywoływane jest `toggleWybor(sek.id, d, limit)`

**Weryfikacja w React DevTools:** W komponencie `MenuTab` sprawdź stan `wybory`. Po kliknięciu karty dania `wybory[sek.id]` powinien się zaktualizować (dodać/usunąć element).

---

### 4. Pełny kod `toggleWybor`

```typescript
const toggleWybor = useCallback((sekcjaId: string, danie: string, limit: number) => {
  setWybory((prev) => {
    const curr = prev[sekcjaId] || [];
    if (curr.includes(danie)) return { ...prev, [sekcjaId]: curr.filter((d) => d !== danie) };
    if (curr.length >= limit) return prev;
    return { ...prev, [sekcjaId]: [...curr, danie] };
  });
}, []);
```

- Jeśli danie już jest w `curr` → usuwa je
- Jeśli `curr.length >= limit` → nie dodaje (zwraca poprzedni stan)
- W przeciwnym razie dodaje `danie` do `curr`

---

## ZAMIENNIKI

### 5. Modal zamiennika — otwarcie i lista dań

**Dodano console.log w** `otworzModalZamiennik`:

```javascript
console.log("otworzModalZamiennik:", { sekcjaLabel, oryginalDanie, url, daniaCount: dania.length, dania });
```

**Instrukcja:** Otwórz sekcję "Zupa", kliknij "Zmień danie". Oczekiwany output:

```json
{
  "sekcjaLabel": "Zupa",
  "oryginalDanie": "Rosół",
  "url": "/api/dishes?category=Zupa",
  "daniaCount": N,
  "dania": [{ "id": "...", "name": "...", "category": "..." }, ...]
}
```

Jeśli `daniaCount === 0` i `url` zwraca puste, użyty jest fallback do `/api/dishes`.

---

### 6. Stan `zamienniki` po wyborze zamiennika

**Dodano console.log w** `wybierzZamiennik`:

```javascript
setZamienniki((prev) => {
  const next = { ...prev, [modalZamiennik.oryginalDanie]: nazwaDania };
  console.log("ZAMIENNIKI:", next);
  return next;
});
```

**Oczekiwany output po wyborze np. "Barszcz" zamiast "Rosół":**

```json
ZAMIENNIKI: { "Rosół": "Barszcz" }
```

---

### 7. Payload przy zapisie

**Dodano w** `handleSave`:

```javascript
const payload = { pakietId, wybory, doplaty, dopWybory, notatka, zamienniki };
console.log("PAYLOAD:", JSON.stringify(payload));
onSave?.(payload);
```

**Oczekiwany output po kliknięciu "Zapisz":**

```json
PAYLOAD: {"pakietId":"...","wybory":{"sekcja1":["danie1","danie2"]},"doplaty":{},"dopWybory":{},"notatka":"","zamienniki":{"Rosół":"Barszcz"}}
```

`zamienniki` są w payloadzie i trafiają do API (PUT event-orders) w `body.menu.zamienniki`.

---

## ZAPIS DO GOOGLE DOCS

### 8. Dokument "Oferta menu"

**Instrukcja:** Po zapisaniu imprezy z menu:
1. Otwórz imprezę
2. Kliknij link "Oferta menu" (menuDocUrl) lub sprawdź w Google Docs folder
3. Sprawdź czy dokument zawiera:
   - wybrane dania (włącznie z sekcji wybor)
   - zamienniki z dopiskiem `(zamiennik za: X)`

Funkcja `buildMenuLines` w `lib/googleDocs.ts` buduje te linie (patrz punkt 23).

---

### 9. Logi PM2 po PUT imprezy

```bash
ssh hetzner "pm2 logs hotel-pms --lines 50"
```

Sprawdź czy nie ma błędów związanych z:
- `updateMenuDoc`
- `buildMenuLines`
- `insertText` / Google Docs API

---

### 10. Checklist operacyjna (DOCX)

**Źródło:** `lib/googleDocs.ts` — funkcja `buildChecklistRows`. Sekcja menu (ostatnie ~20 wierszy):

```typescript
["", ""],
["PAKIET MENU", event.menu?.pakietId ? (event.packageName ?? event.menu.pakietId) : "— nie wybrano —"],
...(event.menu?.zamienniki && Object.keys(event.menu.zamienniki).length > 0
  ? [["ZAMIENNIKI", Object.entries(event.menu.zamienniki).map(([orig, zam]) => `${zam} zamiast ${orig}`).join(", ")]] as [string, string][]
  : []),
[
  "WYBRANE DANIA",
  (() => {
    const wybrane = Object.values(event.menu?.wybory ?? {}).flat();
    const zam = event.menu?.zamienniki ?? {};
    return wybrane
      .map((d) => {
        const orig = Object.entries(zam).find(([, z]) => z === d)?.[0];
        return orig ? `${d} zamiast ${orig}` : d;
      })
      .join(", ") || "—";
  })(),
],
["DOPŁATY", ...],
["NOTATKA MENU", event.menu?.notatka ?? "—"],
```

Checklist ma pola: PAKIET MENU, ZAMIENNIKI, WYBRANE DANIA, DOPŁATY, NOTATKA MENU.

---

## FORMULARZ NOWEJ IMPREZY

### 11. STYPA — ukryte pola

Dla `eventType === "STYPA"`:
- `showZespol: false` → ukryte: orkiestra/DJ, kamerzysta, fotograf
- `showDekoracje: false` → ukryte: kwiaty, wazony, winietki, kolor dekoracji
- `showFacebook: false` → ukryta: zgoda na Facebook

**Źródło:** `components/events/event-form-tabs.tsx` — `EVENT_TYPE_FIELDS_CONFIG`.

---

### 12. FIRMOWA

- `showDekoracje: false` → ukryte pola dekoracji
- `showFacebook: false` → ukryta zgoda na Facebook
- `showZespol: true` → orkiestra/kamerzysta/fotograf widoczne

---

### 13. WESELE

- `showChurch: true` → widoczne pole "Godzina kościoła"
- `showBrideOrchestra: true` → widoczne: "Stół Pary Młodej", "Stół orkiestry"
- `showPoprawiny: true` → widoczne pole "Poprawiny"

---

### 14. labelStyle i inputStyle.fontSize

**Z pliku** `components/events/event-form-tabs.tsx`:

```typescript
const labelStyle = {
  fontSize: "13px",
  fontWeight: 700,
  color: "#888",
  textTransform: "uppercase" as const,
  display: "block" as const,
  marginBottom: "6px"
};

const inputStyle = {
  width: "100%",
  padding: "10px 14px",
  border: "1px solid #ddd",
  borderRadius: "4px",
  fontSize: "15px",
  outline: "none" as const,
  fontFamily: "inherit",
};
```

**labelStyle.fontSize:** `"13px"`  
**inputStyle.fontSize:** `"15px"`

---

## SZEROKOŚĆ MODALA

**Źródło:** `components/centrum-sprzedazy.tsx` — linia 1000:

```jsx
<div ref={ref} style={{
  background: "white",
  borderRadius: "8px",
  width: "100%",
  maxWidth: zakladka === "menu" ? "920px" : "560px",
  maxHeight: "85vh",
  transition: "max-width 0.2s ease",
  display: "flex",
  flexDirection: "column",
  boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
  overflowY: "auto",
  border: "1px solid #e2e8f0"
}}>
```

**Szerokość modala jest dynamiczna:**
- zakładka `"menu"` → `maxWidth: "920px"`
- pozostałe → `maxWidth: "560px"`

---

## TRYB PODGLĄDU MENU

### 15. Zamienniki z dopiskiem "(zam. za: X)"

**Kod** (linie 283–289 w `menu-modul.tsx`):

```jsx
{lista.map((d: string) => {
  const display = zamienniki[d] ?? d;
  const isZamiennik = !!zamienniki[d];
  return (
    <li key={d} title={isZamiennik ? `zamiennik za: ${d}` : undefined}>
      {isZamiennik ? `${display} (zam. za: ${d})` : display}
    </li>
  );
})}
```

Tak — zamienniki są pokazywane z dopiskiem `(zam. za: X)`.

---

### 16. Sekcje wybor w podglądzie

W podglądzie używana jest zmienna:

```javascript
const lista = s.typ === "fixed" ? s.dania : (wybory[s.id] || []);
```

Dla sekcji `"wybor"` w podglądzie pokazywane są **tylko wybrane dania** (`wybory[s.id]`), nie pełna lista oferty.

---

## DRUK

### 17. Zamienniki w wydruku

**Kod** `generatePrintHTML` (linie 117–121 w `menu-modul.tsx`):

```javascript
const lista = s.typ === "fixed" ? s.dania : (wybory[s.id] || []);
const items = lista.map((d: string) => {
  const display = zam[d] ? `${zam[d]} <small style="color:#64748b">(zam. za: ${d})</small>` : d;
  return `<li>${display}</li>`;
}).join("");
```

Zamienniki są drukowane z dopiskiem `(zam. za: X)` w wydruku.

---

### 18. Fragment generatePrintHTML — budowanie dań

**Dla sekcji fixed i wybor** (ten sam blok):

```javascript
const sekcjeHTML = pakiet.sekcje.map((s) => {
  const lista = s.typ === "fixed" ? s.dania : (wybory[s.id] || []);
  if (!lista.length) return "";
  const items = lista.map((d: string) => {
    const display = zam[d] ? `${zam[d]} <small style="color:#64748b">(zam. za: ${d})</small>` : d;
    return `<li>${display}</li>`;
  }).join("");
  return `<div class="sekcja">...<ul>${items}</ul></div>`;
}).join("");
```

- **fixed:** `lista = s.dania` — wszystkie dania z sekcji
- **wybor:** `lista = wybory[s.id] || []` — tylko wybrane
- **zamienniki:** `zam[d]` — zamiennik z dopiskiem `(zam. za: d)`

---

## Podsumowanie zmian w kodzie

1. `console.log("SEKCJA:", ...)` — przed renderem prawego panelu
2. `console.log("otworzModalZamiennik:", ...)` — przy otwieraniu modala zamiennika
3. `console.log("ZAMIENNIKI:", next)` — po wyborze zamiennika
4. `console.log("PAYLOAD:", ...)` — w handleSave przed wywołaniem onSave

Po weryfikacji można usunąć te logi lub zostawić pod flagą dev.
