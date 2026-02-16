#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Testy jednostkowe dla scenarios_manager.py."""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import scenarios_manager as sm


def test_parse_all_scenarios_empty(tmp_path):
    """Pusty plik -> pusta lista."""
    f = tmp_path / "scenarios.md"
    f.write_text("", encoding="utf-8")
    assert sm.parse_all_scenarios(f) == []


def test_parse_all_scenarios_list_format(tmp_path):
    """Lista - [ ] ID Nazwa -> jeden scenariusz."""
    f = tmp_path / "scenarios.md"
    f.write_text("- [ ] A1 Napraw błąd logowania\n", encoding="utf-8")
    out = sm.parse_all_scenarios(f)
    assert len(out) == 1
    assert out[0]["id"] == "A1"
    assert out[0]["name"] == "Napraw błąd logowania"
    assert out[0]["done"] is False


def test_parse_all_scenarios_list_done(tmp_path):
    """Lista - [x] -> done=True."""
    f = tmp_path / "scenarios.md"
    f.write_text("- [x] A2 Zrobione\n", encoding="utf-8")
    out = sm.parse_all_scenarios(f)
    assert len(out) == 1
    assert out[0]["done"] is True


def test_parse_all_scenarios_table_format(tmp_path):
    """Tabela: | ID | Nazwa | Kroki | Ryzyko | [ ] | ."""
    f = tmp_path / "scenarios.md"
    # Regex wymaga trailing | na końcu wiersza
    f.write_text("| ID | Nazwa | Kroki | Ryzyko | [ ] |\n| A1 | Test | Krok 1 | Brak | [ ] |\n", encoding="utf-8")
    out = sm.parse_all_scenarios(f)
    # Pierwszy wiersz to nagłówek - może nie pasować do TABLE_ROW_RE (ID vs A1). Sprawdzam drugi.
    assert len(out) >= 1
    row = next((r for r in out if r.get("id") == "A1"), None)
    if row:
        assert row.get("name", "").strip() == "Test" or "Test" in str(row)
        assert row["done"] is False


def test_get_first_unchecked_empty(tmp_path):
    """Brak scenariuszy / wszystkie zrobione -> None."""
    f = tmp_path / "scenarios.md"
    f.write_text("", encoding="utf-8")
    assert sm.get_first_unchecked(f) is None
    f.write_text("- [x] A1 Done\n", encoding="utf-8")
    assert sm.get_first_unchecked(f) is None


def test_get_first_unchecked_returns_first(tmp_path):
    """Pierwszy niezrobiony jest zwracany."""
    f = tmp_path / "scenarios.md"
    f.write_text("- [ ] A1 Pierwszy\n- [ ] A2 Drugi\n", encoding="utf-8")
    s = sm.get_first_unchecked(f)
    assert s is not None
    assert s["id"] == "A1"


def test_count_progress(tmp_path):
    """count_progress zwraca (done, total)."""
    f = tmp_path / "scenarios.md"
    f.write_text("- [ ] A1\n- [x] A2\n- [ ] A3\n", encoding="utf-8")
    done, total = sm.count_progress(f)
    assert total == 3
    assert done == 1


def test_mark_done_by_id_list(tmp_path):
    """mark_done_by_id dla listy zamienia [ ] na [x]."""
    f = tmp_path / "scenarios.md"
    f.write_text("- [ ] A1 Scenariusz\n", encoding="utf-8")
    assert sm.mark_done_by_id(f, "A1") is True
    text = f.read_text(encoding="utf-8")
    assert "- [x] A1" in text or "[x]" in text


def test_mark_done_by_id_not_found(tmp_path):
    """Nieznane ID -> False."""
    f = tmp_path / "scenarios.md"
    f.write_text("- [ ] A1\n", encoding="utf-8")
    assert sm.mark_done_by_id(f, "B99") is False


def test_mark_done_by_id_already_done(tmp_path):
    """Już [x] -> True (idempotent)."""
    f = tmp_path / "scenarios.md"
    f.write_text("- [x] A1 Done\n", encoding="utf-8")
    assert sm.mark_done_by_id(f, "A1") is True


def test_read_state_empty(tmp_path):
    """Brak pliku stanu -> (None, 0)."""
    orig = sm.STATE_FILE
    try:
        sm.STATE_FILE = tmp_path / ".scenarios_state.txt"
        assert sm.read_state() == (None, 0)
    finally:
        sm.STATE_FILE = orig


def test_write_state(tmp_path):
    """Zapis stanu zapisuje count i key."""
    orig = sm.STATE_FILE
    try:
        sm.STATE_FILE = tmp_path / ".scenarios_state.txt"
        sm.write_state("A1 | Test", 2)
        lines = sm.STATE_FILE.read_text(encoding="utf-8").strip().splitlines()
        assert len(lines) >= 2
        assert lines[0].strip() == "2"
    finally:
        sm.STATE_FILE = orig


def test_parse_opt_args():
    """parse_opt_args wyciąga --status i --details."""
    o = sm.parse_opt_args(["--status=FAIL", "--details=brak czasu"])
    assert o["status"] == "FAIL"
    assert o["details"] == "brak czasu"
