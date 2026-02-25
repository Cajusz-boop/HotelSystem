# Opis elementu UI: przełącznik motywu (ikona księżyca) w sidebarze

## Dla innej AI — identyfikacja i zachowanie

### Co to jest

To **przełącznik motywu jasny/ciemny (Theme Toggle)** w lewym pasku bocznym aplikacji (sidebar). Element wygląda jak **mały ciemnoniebieski prostokąt** z **białą (lub jasnoszary) ikoną księżyca** (crescent moon) wyśrodkowaną wewnątrz. Cienkie, jasne linie u góry i dołu sugerują obramowanie lub oddzielenie od reszty paska.

### Gdzie się znajduje

- **Lokalizacja:** Lewy sidebar, **na dole**, nad linią oddzielającą (border-t), w sekcji z jednym przyciskiem.
- **Struktura:** Sidebar ma ikony nawigacji u góry; na dole jest obszar z jednym przyciskiem — to właśnie Theme Toggle.
- **Widoczność:** Na desktopie sidebar jest widoczny (np. `md:flex`); na wąskich ekranach może być zwinięty w hamburger.

### Wygląd (z obrazu)

- **Tło:** Ciemnoniebieski (odpowiada kolorowi sidebara: `hsl(213 55% 20%)` w motywie jasnym).
- **Ikona:** Biały obrys księżyca (półksiężyc), wypukłość w lewo, wklęsłość w prawo. Prosty, minimalistyczny styl (Lucide React: `Moon`).
- **Rozmiar:** Przycisk ma `h-9 w-9` (36×36 px), ikona `h-4 w-4` (16×16 px).

### Znaczenie ikony

- **Księżyc (Moon)** = aplikacja jest w **motywie jasnym (light)**. Przycisk oznacza: „Włącz ciemny motyw” — po kliknięciu przełączy na dark.
- **Słońce (Sun)** = aplikacja jest w **motywie ciemnym (dark)**. Przycisk oznacza: „Włącz jasny motyw” — po kliknięciu przełączy na light.

Czyli **obraz pokazuje stan „light theme”**: użytkownik widzi księżyc i może kliknąć, żeby włączyć ciemny motyw.

### Zachowanie

1. **Klik:** Wywołuje `toggleTheme()` z `ThemeProvider`: zamienia `light` ↔ `dark`.
2. **Po przełączeniu:** Na `<html>` (documentElement) ustawiana jest lub usuwana klasa `dark`. Style CSS używają selektorów `.dark ...` (np. w Tailwind: `dark:bg-slate-800`).
3. **Trwałość:** Wartość zapisywana w `localStorage` pod kluczem `pms-theme` (`"light"` lub `"dark"`). Przy następnym wejściu skrypt w `<head>` (layout) odczytuje `pms-theme` i od razu dodaje/usuwa klasę `dark` na `<html>`, żeby uniknąć mignięcia jasnego motywu.

### Kontekst techniczny (dla AI pracującej nad kodem)

- **Komponent:** `@/components/theme-toggle.tsx` — `ThemeToggle`, prop `variant="sidebar"`.
- **Użycie w sidebarze:** `components/app-sidebar.tsx` — na dole sidebara: `<ThemeToggle variant="sidebar" />`.
- **Ikony:** `lucide-react` — `Moon` gdy `theme === "light"`, `Sun` gdy `theme === "dark"`.
- **Stan motywu:** `ThemeProvider` (`@/components/theme-provider.tsx`) — context z `theme`, `setTheme`, `toggleTheme`. Klucz w localStorage: `pms-theme`.
- **Aria:** Przy dark: `aria-label="Włącz jasny motyw"`; przy light: `aria-label="Włącz ciemny motyw"`.
- **Klasy przycisku w sidebarze:** `h-9 w-9 text-white/60 hover:text-white hover:bg-white/10` (wariant `sidebar`).

### Jak zlokalizować w testach / selektorach

- Przycisk: `button[aria-label*="motyw"]` (pl) lub `button[aria-label*="theme" i]`.
- Ikona: w środku przycisku element z klasą zawierającą ikonę Lucide (np. po `lucide-moon` w SVG lub atrybucie). W testach w projekcie używany jest m.in. selektor: `button:has([class*="moon"]), button:has([class*="sun"])` (patrz `Test/auth.spec.ts`).

### Podsumowanie jednym zdaniem

**„Ciemnoniebieski prostokąt z białą ikoną księżyca na dole lewego sidebara to przełącznik motywu — w stanie light pokazuje Moon (klik = włączenie dark), w stanie dark pokazuje Sun (klik = włączenie light); stan jest w `localStorage` (`pms-theme`) i w klasie `dark` na `<html>`.”**
