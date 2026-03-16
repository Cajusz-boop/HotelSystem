# AGENTS — Instrukcje dla Cursora

> Ten plik jest czytany przez Cursor przed rozpoczęciem pracy. Zawsze go przestrzegaj.

## Start każdego nowego zadania

**Krok 0:** Przeczytaj wszystkie pliki w `.cursor/rules/`:

| Plik | Zawartość |
|------|-----------|
| `workflow.mdc` | Trójfazowy proces (Faza 1 rekonesans → Faza 2 implementacja → Faza 3 self-check) |
| `nextjs-prisma-mydevil.mdc` | Deploy (git push), Hetzner, MyDevil, PowerShell |
| `code-quality.mdc` | Anti-compression, TypeScript, error handling |
| `dev-server-troubleshooting.mdc` | Naprawa localhost:3011, EADDRINUSE, runtime errors |
| `debugging.mdc` | Diagnoza przed implementacją (gdy naprawiasz bugi) |

**Krok 1:** Dla każdego zadania stosuj trójfazowy proces z `workflow.mdc`. Nigdy nie przechodź do Fazy 2 bez zatwierdzenia Fazy 1.

**Krok 2:** Zawsze czytaj `ARCHITECTURE.md` przed implementacją.
