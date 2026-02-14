#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scenarios_manager.py
Manager scenariuszy testowych dla autonomicznego agenta.

- Czyta SCENARIUSZE-BLEDOW.md (tabele Markdown + ewentualne listy - [ ])
- next: zwraca pierwszy niewykonany scenariusz (ID + nazwa + kroki/ryzyko jeśli są)
- done <ID> --status=PASS|FAIL|SKIP --details="..." : oznacza [x] i dopisuje wynik do TEST-RESULTS.md
- skip <ID> --details="..." : alias done z SKIP
- stats: postęp + podsumowanie PASS/FAIL/SKIP
- reset: kasuje pliki stanu/licznika/sygnału

WAŻNE:
- Batch Limit korzysta z tych samych plików co manager.py:
  .batch_count i .batch_complete (żeby supervisor.py działał identycznie)
- Możesz ustawić limit przez ENV:
  SCENARIOS_BATCH_LIMIT=0 (wyłącza limit)
  SCENARIOS_BATCH_LIMIT=999 (duży limit)
"""

import re
import sys
import os
from pathlib import Path
from datetime import datetime

# KONFIGURACJA
BASE_DIR = Path(__file__).resolve().parent
SCENARIOS_FILE = BASE_DIR / "SCENARIUSZE-BLEDOW.md"
RESULTS_FILE = BASE_DIR / "TEST-RESULTS.md"
STATE_FILE = BASE_DIR / ".scenarios_state.txt"

# UWAGA: te same nazwy co w manager.py (żeby supervisor.py restartował tak samo)
BATCH_COUNT_FILE = BASE_DIR / ".batch_count"
SIGNAL_FILE = BASE_DIR / ".batch_complete"

MAX_SAME_FETCHES = 3

# Batch limit: domyślnie 10, ale można nadpisać ENV.
# Ustaw SCENARIOS_BATCH_LIMIT=0 aby WYŁĄCZYĆ limit i nie zatrzymywać pętli.
def _get_batch_limit() -> int:
    raw = os.environ.get("SCENARIOS_BATCH_LIMIT", "").strip()
    if raw == "":
        return 10
    try:
        return int(raw)
    except Exception:
        return 10

# UTF-8 fix dla Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Wiersz tabeli: | A2 | Nazwa | Kroki | Ryzyko | [ ] |
TABLE_ROW_RE = re.compile(
    r'^\|\s*(?P<id>[A-Za-z0-9]+(?:\.[A-Za-z0-9]+)*)\s*\|\s*(?P<name>.*?)\|\s*(?P<steps>.*?)\|\s*(?P<risk>.*?)\|\s*\[\s*(?P<done>[xX ]?)\s*\]\s*\|\s*$'
)
# Lista: - [ ] A2 ...
LIST_ROW_RE = re.compile(
    r'^\-\s+\[\s*(?P<done>[xX ]?)\s*\]\s*(?P<id>[A-Za-z0-9]+(?:\.[A-Za-z0-9]+)*)\b(?P<rest>.*)$'
)

def _read_int(path: Path) -> int:
    if not path.exists():
        return 0
    try:
        return int(path.read_text(encoding="utf-8").strip() or "0")
    except Exception:
        return 0

def _write_int(path: Path, value: int) -> None:
    path.write_text(str(value), encoding="utf-8")

def check_batch_limit() -> None:
    limit = _get_batch_limit()
    if limit <= 0:
        return  # WYŁĄCZONE
    count = _read_int(BATCH_COUNT_FILE)
    if count >= limit:
        print(f"BATCH LIMIT ({limit}) REACHED. REQUESTING RESTART...")
        SIGNAL_FILE.write_text("ready_for_restart", encoding="utf-8")
        _write_int(BATCH_COUNT_FILE, 0)
        sys.exit(0)

def increment_batch_count() -> None:
    count = _read_int(BATCH_COUNT_FILE)
    _write_int(BATCH_COUNT_FILE, count + 1)

def read_state() -> tuple[str | None, int]:
    if not STATE_FILE.exists():
        return None, 0
    try:
        lines = STATE_FILE.read_text(encoding="utf-8", errors="replace").splitlines()
        if len(lines) < 2:
            return None, 0
        count = int(lines[0].strip())
        content = "\n".join(lines[1:]).strip()
        return (content or None), count
    except Exception:
        return None, 0

def write_state(key: str, count: int) -> None:
    STATE_FILE.write_text(f"{count}\n{key}\n", encoding="utf-8")

def parse_all_scenarios(md_path: Path) -> list[dict]:
    if not md_path.exists():
        return []
    text = md_path.read_text(encoding="utf-8", errors="replace")
    out: list[dict] = []
    for idx, line in enumerate(text.splitlines()):
        m = TABLE_ROW_RE.match(line)
        if m:
            out.append({
                "type": "table",
                "line_index": idx,
                "id": m.group("id").strip(),
                "name": m.group("name").strip(),
                "steps": m.group("steps").strip(),
                "risk": m.group("risk").strip(),
                "done": (m.group("done") or "").strip().lower() == "x",
                "raw": line,
            })
            continue
        m2 = LIST_ROW_RE.match(line)
        if m2:
            out.append({
                "type": "list",
                "line_index": idx,
                "id": m2.group("id").strip(),
                "name": (m2.group("rest") or "").strip(),
                "steps": "",
                "risk": "",
                "done": (m2.group("done") or "").strip().lower() == "x",
                "raw": line,
            })
    return out

def get_first_unchecked(md_path: Path) -> dict | None:
    for s in parse_all_scenarios(md_path):
        if not s["done"]:
            return s
    return None

def count_progress(md_path: Path) -> tuple[int, int]:
    all_s = parse_all_scenarios(md_path)
    total = len(all_s)
    done = sum(1 for s in all_s if s["done"])
    return done, total

def mark_done_by_id(md_path: Path, scenario_id: str) -> bool:
    if not md_path.exists():
        return False
    lines = md_path.read_text(encoding="utf-8", errors="replace").splitlines()

    # Tabela
    for i, line in enumerate(lines):
        m = TABLE_ROW_RE.match(line)
        if m and m.group("id").strip() == scenario_id:
            if (m.group("done") or "").strip().lower() == "x":
                return True
            # ustaw ostatni checkbox na [x]
            lines[i] = re.sub(r'\[\s*\]\s*\|\s*$', r'[x] |', line)
            md_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
            return True

    # Lista
    for i, line in enumerate(lines):
        m2 = LIST_ROW_RE.match(line)
        if m2 and m2.group("id").strip() == scenario_id:
            if (m2.group("done") or "").strip().lower() == "x":
                return True
            lines[i] = re.sub(r'^\-\s+\[\s*\]\s*', '- [x] ', line)
            md_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
            return True

    return False

def ensure_results_header() -> None:
    if RESULTS_FILE.exists():
        return
    RESULTS_FILE.write_text(
        "# WYNIKI TESTÓW\n\n"
        f"Rozpoczęto: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"
        "---\n\n",
        encoding="utf-8"
    )

def append_result(scenario_id: str, name: str, status: str, details: str = "") -> None:
    ensure_results_header()
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    icon = {"PASS": "✓", "FAIL": "✗", "SKIP": "⊘"}.get(status, "?")
    with open(RESULTS_FILE, "a", encoding="utf-8") as f:
        f.write(f"**[{scenario_id}]** {name}\n")
        f.write(f"- Wynik: {icon} {status}\n")
        f.write(f"- Czas: {ts}\n")
        if details:
            f.write(f"- Szczegóły: {details}\n")
        f.write("\n")

def parse_opt_args(argv: list[str]) -> dict:
    out = {"status": "PASS", "details": ""}
    for a in argv:
        if a.startswith("--status="):
            out["status"] = a.split("=", 1)[1].upper()
        elif a.startswith("--details="):
            out["details"] = a.split("=", 1)[1]
    return out

def read_scenario_name(md_path: Path, scenario_id: str) -> str:
    for s in parse_all_scenarios(md_path):
        if s["id"] == scenario_id:
            return s.get("name") or ""
    return ""

def main() -> None:
    cmd = sys.argv[1] if len(sys.argv) > 1 else "next"

    if cmd == "next":
        check_batch_limit()

        s = get_first_unchecked(SCENARIOS_FILE)
        if s is None:
            done, total = count_progress(SCENARIOS_FILE)
            print(f"KONIEC: Wszystkie scenariusze wykonane ({done}/{total}).")
            sys.exit(0)

        key = f'{s["id"]} | {s.get("name","")}'
        last, cnt = read_state()
        cnt = (cnt + 1) if (last == key) else 1
        if cnt > MAX_SAME_FETCHES:
            print(f"SAFETY STOP: Scenariusz pobierany {cnt} razy bez sukcesu.", file=sys.stderr)
            sys.exit(2)
        write_state(key, cnt)

        done, total = count_progress(SCENARIOS_FILE)
        print(f"[{done+1}/{total}] TWOJ SCENARIUSZ:")
        print(f"ID: {s['id']}")
        if s.get("name"):
            print(f"Nazwa: {s['name']}")
        if s.get("steps"):
            print(f"Kroki: {s['steps']}")
        if s.get("risk"):
            print(f"Ryzyko/Oczek.: {s['risk']}")
        return

    if cmd in ("done", "skip"):
        if len(sys.argv) < 3:
            print('Użycie: python scenarios_manager.py done <ID> --status=PASS|FAIL|SKIP --details="..."', file=sys.stderr)
            print('       python scenarios_manager.py skip <ID> --details="powód"', file=sys.stderr)
            sys.exit(1)

        scenario_id = sys.argv[2].strip()
        opts = parse_opt_args(sys.argv[3:])

        status = "SKIP" if cmd == "skip" else opts["status"]
        if status not in ("PASS", "FAIL", "SKIP"):
            print("BŁĄD: --status musi być PASS, FAIL albo SKIP", file=sys.stderr)
            sys.exit(1)

        name = read_scenario_name(SCENARIOS_FILE, scenario_id) or "(brak nazwy)"
        if not mark_done_by_id(SCENARIOS_FILE, scenario_id):
            print(f"BŁĄD: Nie znaleziono scenariusza ID={scenario_id} w {SCENARIOS_FILE.name}", file=sys.stderr)
            sys.exit(1)

        append_result(scenario_id, name, status, opts["details"])
        write_state("", 0)
        increment_batch_count()

        done, total = count_progress(SCENARIOS_FILE)
        print(f"SUKCES: {scenario_id} oznaczony jako [x]. Status: {status}")
        print(f"POSTĘP: {done}/{total} ({(done*100//total) if total else 0}%)")
        return

    if cmd == "stats":
        done, total = count_progress(SCENARIOS_FILE)
        print("STATYSTYKI SCENARIUSZY:")
        print(f"  Wykonane: {done}")
        print(f"  Pozostałe: {total - done}")
        print(f"  Razem: {total}")
        print(f"  Postęp: {(done*100//total) if total else 0}%")

        if RESULTS_FILE.exists():
            content = RESULTS_FILE.read_text(encoding="utf-8", errors="replace")
            passes = content.count("✓ PASS")
            fails = content.count("✗ FAIL")
            skips = content.count("⊘ SKIP")
            print("\nWYNIKI:")
            print(f"  ✓ PASS: {passes}")
            print(f"  ✗ FAIL: {fails}")
            print(f"  ⊘ SKIP: {skips}")
        return

    if cmd == "reset":
        # Czyścimy tylko scenariusze + batch pliki (te same co manager.py)
        for f in [STATE_FILE, BATCH_COUNT_FILE, SIGNAL_FILE]:
            if f.exists():
                f.unlink()
        print("RESET: Stan scenarios_manager wyzerowany.")
        return

    print(f"Nieznana komenda: {cmd}", file=sys.stderr)
    print("Dostępne: next, done, skip, stats, reset", file=sys.stderr)
    sys.exit(1)

if __name__ == "__main__":
    main()
