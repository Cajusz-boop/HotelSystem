"""
Testy jednostkowe dla manager.py.
Uruchom: pytest tests/test_manager.py -v
"""

import os
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

# Dodaj katalog główny projektu do ścieżki
REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))


def test_import_manager():
    """Manager powinien się importować bez błędów."""
    import manager as m  # noqa: F401
    assert hasattr(m, "get_first_unchecked_task")
    assert hasattr(m, "mark_task_done")
    assert hasattr(m, "read_state")
    assert hasattr(m, "write_state")
    assert hasattr(m, "check_batch_limit")
    assert hasattr(m, "increment_batch_count")


class TestGetFirstUncheckedTask:
    """Testy get_first_unchecked_task()."""

    def test_pusty_plik(self, tmp_path):
        import manager as m

        tasks_file = tmp_path / "TASKS.md"
        tasks_file.write_text("", encoding="utf-8")

        with patch.object(m, "TASKS_FILE", tasks_file):
            result = m.get_first_unchecked_task(tasks_file)
        assert result is None

    def test_brak_nieodznaczonych(self, tmp_path):
        import manager as m

        tasks_file = tmp_path / "TASKS.md"
        tasks_file.write_text(
            "- [x] Zadanie 1\n- [x] Zadanie 2\n",
            encoding="utf-8",
        )

        with patch.object(m, "TASKS_FILE", tasks_file):
            result = m.get_first_unchecked_task(tasks_file)
        assert result is None

    def test_pierwsze_nieodznaczone(self, tmp_path):
        import manager as m

        tasks_file = tmp_path / "TASKS.md"
        tasks_file.write_text(
            "- [x] Gotowe\n- [ ] Do zrobienia\n- [ ] Drugie\n",
            encoding="utf-8",
        )

        with patch.object(m, "TASKS_FILE", tasks_file):
            result = m.get_first_unchecked_task(tasks_file)
        assert result == "Do zrobienia"

    def test_plik_nie_istnieje(self, tmp_path):
        import manager as m

        missing = tmp_path / "nie_istnieje.md"
        result = m.get_first_unchecked_task(missing)
        assert result is None


class TestMarkTaskDone:
    """Testy mark_task_done()."""

    def test_znalezione_zadanie(self, tmp_path):
        import manager as m

        tasks_file = tmp_path / "TASKS.md"
        tasks_file.write_text("- [ ] Zadanie testowe\n- [ ] Drugie\n", encoding="utf-8")

        result = m.mark_task_done(tasks_file, "Zadanie testowe")
        assert result is True

        content = tasks_file.read_text(encoding="utf-8")
        assert "- [x] Zadanie testowe" in content
        assert "- [ ] Drugie" in content

    def test_nieznalezione_zadanie(self, tmp_path):
        import manager as m

        tasks_file = tmp_path / "TASKS.md"
        tasks_file.write_text("- [ ] Inne zadanie\n", encoding="utf-8")

        result = m.mark_task_done(tasks_file, "Nieistniejące")
        assert result is False
        assert "- [ ] Inne zadanie" in tasks_file.read_text(encoding="utf-8")

    def test_plik_nie_istnieje(self, tmp_path):
        import manager as m

        missing = tmp_path / "nie_istnieje.md"
        result = m.mark_task_done(missing, "cokolwiek")
        assert result is False


class TestReadWriteState:
    """Testy read_state() i write_state()."""

    def test_read_brak_pliku(self, tmp_path):
        import manager as m

        state_file = tmp_path / ".manager_state.txt"
        with patch.object(m, "STATE_FILE", state_file):
            content, count = m.read_state()
        assert content is None
        assert count == 0

    def test_write_i_read(self, tmp_path):
        import manager as m

        state_file = tmp_path / ".manager_state.txt"
        with patch.object(m, "STATE_FILE", state_file):
            m.write_state("treść zadania", 3)
            content, count = m.read_state()
        assert content == "treść zadania"
        assert count == 3

    def test_write_pusty_content(self, tmp_path):
        import manager as m

        state_file = tmp_path / ".manager_state.txt"
        with patch.object(m, "STATE_FILE", state_file):
            m.write_state("", 0)
            content, count = m.read_state()
        assert content is None or content == ""
        assert count == 0


class TestBatchLimit:
    """Testy check_batch_limit() i increment_batch_count()."""

    def test_check_batch_limit_ponizej_progu(self, tmp_path):
        import manager as m

        batch_file = tmp_path / ".batch_count"
        batch_file.write_text("5", encoding="utf-8")
        signal_file = tmp_path / ".batch_complete"

        with patch.object(m, "BATCH_COUNT_FILE", batch_file), patch.object(
            m, "SIGNAL_FILE", signal_file
        ), patch.object(m, "BATCH_LIMIT", 10):
            # Nie powinno rzucać ani wywoływać sys.exit w tym przypadku
            m.check_batch_limit()
        assert not signal_file.exists()

    def test_check_batch_limit_osiagniety(self, tmp_path):
        import manager as m

        batch_file = tmp_path / ".batch_count"
        batch_file.write_text("10", encoding="utf-8")
        signal_file = tmp_path / ".batch_complete"

        with patch.object(m, "BATCH_COUNT_FILE", batch_file), patch.object(
            m, "SIGNAL_FILE", signal_file
        ), patch.object(m, "BATCH_LIMIT", 10):
            with pytest.raises(SystemExit) as exc_info:
                m.check_batch_limit()
            assert exc_info.value.code == 0
        assert signal_file.exists()
        assert signal_file.read_text(encoding="utf-8").strip() == "ready_for_restart"

    def test_increment_batch_count(self, tmp_path):
        import manager as m

        batch_file = tmp_path / ".batch_count"
        batch_file.write_text("2", encoding="utf-8")

        with patch.object(m, "BATCH_COUNT_FILE", batch_file):
            m.increment_batch_count()
        assert batch_file.read_text(encoding="utf-8").strip() == "3"

    def test_increment_batch_count_brak_pliku(self, tmp_path):
        import manager as m

        batch_file = tmp_path / ".batch_count"
        assert not batch_file.exists()

        with patch.object(m, "BATCH_COUNT_FILE", batch_file):
            m.increment_batch_count()
        assert batch_file.read_text(encoding="utf-8").strip() == "1"


class TestMainNext:
    """Testy komendy 'next'."""

    def test_next_brak_zadan(self, tmp_path, capsys):
        import manager as m

        tasks_file = tmp_path / "TASKS.md"
        tasks_file.write_text("- [x] Wszystko gotowe\n", encoding="utf-8")
        state_file = tmp_path / ".state"
        batch_file = tmp_path / ".batch"

        with patch.object(m, "TASKS_FILE", tasks_file), patch.object(
            m, "STATE_FILE", state_file
        ), patch.object(m, "BATCH_COUNT_FILE", batch_file), patch.object(
            m, "SIGNAL_FILE", tmp_path / ".signal"
        ), patch.object(m, "BATCH_LIMIT", 10), patch.object(
            sys, "argv", ["manager.py", "next"]
        ):
            with pytest.raises(SystemExit) as exc_info:
                m.main()
            assert exc_info.value.code == 0
        out = capsys.readouterr().out
        assert "KONIEC" in out or "Brak zadań" in out

    def test_next_zwraca_zadanie(self, tmp_path, capsys):
        import manager as m

        tasks_file = tmp_path / "TASKS.md"
        tasks_file.write_text("- [ ] Testowe zadanie z next\n", encoding="utf-8")
        state_file = tmp_path / ".state"
        batch_file = tmp_path / ".batch"

        with patch.object(m, "TASKS_FILE", tasks_file), patch.object(
            m, "STATE_FILE", state_file
        ), patch.object(m, "BATCH_COUNT_FILE", batch_file), patch.object(
            m, "SIGNAL_FILE", tmp_path / ".signal"
        ), patch.object(
            m, "BATCH_LIMIT", 10
        ), patch.object(
            sys, "argv", ["manager.py", "next"]
        ):
            m.main()
        out = capsys.readouterr().out
        assert "TWOJE ZADANIE:" in out
        assert "Testowe zadanie z next" in out


class TestMainDone:
    """Testy komendy 'done'."""

    def test_done_brak_arg(self, capsys):
        import manager as m

        with patch.object(sys, "argv", ["manager.py", "done"]):
            with pytest.raises(SystemExit) as exc_info:
                m.main()
            assert exc_info.value.code == 1
        err = capsys.readouterr().err
        assert "Użycie" in err or "done" in err

    def test_done_sukces(self, tmp_path, capsys):
        import manager as m

        tasks_file = tmp_path / "TASKS.md"
        tasks_file.write_text("- [ ] Sukces zadanie\n", encoding="utf-8")

        with patch.object(m, "TASKS_FILE", tasks_file), patch.object(
            m, "STATE_FILE", tmp_path / ".state"
        ), patch.object(m, "BATCH_COUNT_FILE", tmp_path / ".batch"), patch.object(
            sys, "argv", ["manager.py", "done", "Sukces zadanie"]
        ):
            m.main()
        out = capsys.readouterr().out
        assert "SUKCES" in out or "x" in out

    def test_done_nieznane_zadanie(self, tmp_path, capsys):
        import manager as m

        tasks_file = tmp_path / "TASKS.md"
        tasks_file.write_text("- [ ] Inne\n", encoding="utf-8")

        with patch.object(m, "TASKS_FILE", tasks_file), patch.object(
            sys, "argv", ["manager.py", "done", "Nieistniejące zadanie"]
        ):
            with pytest.raises(SystemExit) as exc_info:
                m.main()
            assert exc_info.value.code == 1
        err = capsys.readouterr().err
        assert "BŁĄD" in err or "Nie znaleziono" in err
