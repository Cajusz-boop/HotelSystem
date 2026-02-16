# Testy skryptów Pythona (manager, scenarios_manager)

## Uruchomienie

Z katalogu głównego projektu:

```bash
# Zainstaluj zależności (jednorazowo)
pip install -r requirements-py.txt

# Uruchom wszystkie testy
pytest tests/ -v

# Krótszy output
pytest tests/ -v --tb=short
```

Na Windows (gdy `python` nie jest w PATH):

```bash
py -m pytest tests/ -v
# lub
python3 -m pytest tests/ -v
```

## Co jest testowane

- **manager.py**: `get_first_unchecked_task`, `mark_task_done`, `read_state`, `write_state`
- **scenarios_manager.py**: `parse_all_scenarios`, `get_first_unchecked`, `count_progress`, `mark_done_by_id`, `read_state`, `write_state`, `parse_opt_args`

Testy używają tymczasowych katalogów (pytest `tmp_path`) i nie modyfikują plików projektu.
