#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Manager skryptu dla autonomicznego agenta.
- Czyta TASKS.md
- Zarządza Safety Stop (max 3 próby)
- Zarządza Batch Limit (reset agenta po X zadaniach)
"""

import re
import sys
import os
from pathlib import Path

# KONFIGURACJA
TASKS_FILE = Path(__file__).resolve().parent / "TASKS.md"
STATE_FILE = Path(__file__).resolve().parent / ".manager_state.txt"
BATCH_COUNT_FILE = Path(__file__).resolve().parent / ".batch_count"
SIGNAL_FILE = Path(__file__).resolve().parent / ".batch_complete"

MAX_SAME_TASK_FETCHES = 3
BATCH_LIMIT = 10  # <--- Po tylu zadaniach wymuszamy reset Agenta

# UTF-8 fix dla Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

def check_batch_limit():
    """Sprawdza, czy osiągnięto limit zadań w jednej sesji."""
    count = 0
    if BATCH_COUNT_FILE.exists():
        try:
            with open(BATCH_COUNT_FILE, "r", encoding="utf-8") as f:
                count = int(f.read().strip())
        except (ValueError, OSError):
            count = 0

    if count >= BATCH_LIMIT:
        print(f"BATCH LIMIT ({BATCH_LIMIT}) REACHED. REQUESTING RESTART...")
        # Tworzymy plik-sygnał dla supervisor.py
        SIGNAL_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(SIGNAL_FILE, "w", encoding="utf-8") as f:
            f.write("ready_for_restart")
        # Zerujemy licznik (supervisor i tak zrestartuje proces, ale dla porządku)
        with open(BATCH_COUNT_FILE, "w", encoding="utf-8") as f:
            f.write("0")
        # Kończymy z kodem 0, ale bez wypisywania zadania -> Agent się zatrzyma
        sys.exit(0)

def increment_batch_count():
    """Zwiększa licznik wykonanych zadań w tej serii."""
    count = 0
    if BATCH_COUNT_FILE.exists():
        try:
            with open(BATCH_COUNT_FILE, "r", encoding="utf-8") as f:
                count = int(f.read().strip())
        except (ValueError, OSError):
            count = 0

    BATCH_COUNT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(BATCH_COUNT_FILE, "w", encoding="utf-8") as f:
        f.write(str(count + 1))

def read_state() -> tuple[str | None, int]:
    if not STATE_FILE.exists():
        return None, 0
    try:
        with open(STATE_FILE, "r", encoding="utf-8") as f:
            lines = f.read().strip().splitlines()
        if len(lines) < 2:
            return None, 0
        count = int(lines[0].strip())
        content = "\n".join(lines[1:]).strip()
        return content or None, count
    except (ValueError, OSError):
        return None, 0

def write_state(content_stripped: str, count: int) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        f.write(str(count) + "\n")
        f.write(content_stripped or "")

def get_first_unchecked_task(tasks_path: Path) -> str | None:
    if not tasks_path.exists():
        return None
    with open(tasks_path, "r", encoding="utf-8") as f:
        text = f.read()
    pattern = r"^-\s+\[\s\]\s+(.+)$"
    for match in re.finditer(pattern, text, re.MULTILINE):
        return match.group(1).strip()
    return None

def mark_task_done(tasks_path: Path, task_content: str) -> bool:
    if not tasks_path.exists():
        return False
    with open(tasks_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    # Próbujemy znaleźć dokładne dopasowanie
    marker = "- [ ] " + task_content
    if marker not in content:
        # Fallback: czasem AI gubi spacje lub znaki specjalne, spróbujmy luźniejszego dopasowania
        # Ale dla bezpieczeństwa trzymamy się ścisłego, ewentualnie AI dostanie błąd i poprawi
        return False
        
    content = content.replace(marker, "- [x] " + task_content, 1)
    
    with open(tasks_path, "w", encoding="utf-8") as f:
        f.write(content)
    return True

def main() -> None:
    cmd = sys.argv[1] if len(sys.argv) > 1 else "next"

    if cmd == "done":
        if len(sys.argv) < 3:
            print('Użycie: python manager.py done "Treść zadania"', file=sys.stderr)
            sys.exit(1)
        
        task_content = sys.argv[2]
        if mark_task_done(TASKS_FILE, task_content):
            print("SUKCES: Zadanie oznaczone jako [x].")
            write_state("", 0) # Reset licznika prób dla tego zadania
            increment_batch_count() # <--- WAŻNE: Zwiększamy licznik serii
        else:
            print(f"BŁĄD: Nie znaleziono zadania w {TASKS_FILE.name}: '{task_content}'", file=sys.stderr)
            sys.exit(1)
        return

    if cmd == "next":
        # Najpierw sprawdzamy, czy nie czas na restart
        check_batch_limit()

        task_line = get_first_unchecked_task(TASKS_FILE)
        if task_line is None:
            print("KONIEC: Brak zadań do wykonania.")
            # Możemy też dać sygnał supervisorowi, żeby przestał restartować
            sys.exit(0)

        last_content, fetch_count = read_state()
        
        # Logika Safety Stop
        if last_content == task_line:
            fetch_count += 1
        else:
            fetch_count = 1

        if fetch_count > MAX_SAME_TASK_FETCHES:
            print(f"SAFETY STOP: Zadanie pobrane {fetch_count} razy bez sukcesu.", file=sys.stderr)
            print("Zatrzymuję pracę, aby nie spalić tokenów.", file=sys.stderr)
            sys.exit(2)

        write_state(task_line, fetch_count)
        print("TWOJE ZADANIE:", task_line)
        return

if __name__ == "__main__":
    main()