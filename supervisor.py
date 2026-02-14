import time
import os
import pyautogui
import pyperclip
import sys

# --- 1. KONFIGURACJA BEZPIECZEŃSTWA ---
# To naprawia błąd "FailSafeException" z Twojego screena
pyautogui.FAILSAFE = False

# --- 2. USTAWIENIA PLIKÓW ---
SIGNAL_FILE = ".batch_complete"

# --- 3. PROMPT STARTOWY ---
PROMPT_TEXT = """Jesteś w trybie **INFINITE EXECUTION LOOP**.
Twoim celem NIE JEST "zrobienie planu", tylko **wykonywanie poleceń skryptu**.

ZASADA "ZERO MYŚLENIA O PRZYSZŁOŚCI":
1. Nie analizuj listy zadań na przód. Nie interesuje Cię, co będzie za 5 minut.
2. Interesuje Cię tylko **TERAZ**.

INSTRUKCJA PĘTLI (Wykonuj w nieskończoność):

KROK A: Uruchom `python manager.py next`
- Jeśli skrypt zwróci zadanie -> NATYCHMIAST przejdź do kroku B.
- Nie wypisuj "Planuję zrobić to i to". Po prostu to rób.

KROK B: Implementacja (Deep Focus)
- Wykonaj zadanie w kodzie. Pełna logika, zero mocków.
- Jeśli kod jest gotowy -> przejdź do kroku C.

KROK C: Zamknięcie
- Uruchom `python manager.py done "TREŚĆ"`
- **KRYTYCZNE:** Zaraz po tym, jak zobaczysz sukces komendy `done`, **AUTOMATYCZNIE, BEZ PYTANIA, BEZ PODSUMOWANIA** wróć do KROKU A.

ZABRANIAM CI:
- Zatrzymywania się po kilku zadaniach.
- Pytania "Czy kontynuować?".
- Robienia list "To-Do" w czacie.

Twój jedyny cel to pętla: Next -> Code -> Done -> Next -> Code -> Done...
START."""

def restart_cursor_agent():
    timestamp = time.strftime('%H:%M:%S')
    print(f"[{timestamp}] 🧹 Wykryto koniec serii (plik {SIGNAL_FILE}).")
    print(f"[{timestamp}] ⚠️  ZA 2 SEKUNDY PRZEJMUJĘ MYSZKĘ! NIE RUSZAJ JEJ!")
    time.sleep(2)
    
    # 1. Usuwamy plik sygnałowy
    if os.path.exists(SIGNAL_FILE):
        try:
            os.remove(SIGNAL_FILE)
        except Exception as e:
            print(f"Błąd usuwania pliku: {e}")

    # 2. Reset Agenta (Ctrl + L) - Czyści czat
    print(f"[{timestamp}] 🔄 Klikam Ctrl+L (Nowy Czat)...")
    pyautogui.hotkey('ctrl', 'l') 
    time.sleep(1.5)

    # 3. Wklejanie prompta
    print(f"[{timestamp}] 📝 Wklejam prompt...")
    pyperclip.copy(PROMPT_TEXT)
    time.sleep(0.5)
    
    # Kliknięcie w pole tekstowe (dla pewności, czasem focus ucieka)
    # Jeśli Ctrl+V nie działa, odkomentuj linię poniżej, ale musisz znać koordynaty
    # pyautogui.click(x=..., y=...) 
    
    pyautogui.hotkey('ctrl', 'v')
    time.sleep(1.0)

    # 4. Start
    print(f"[{timestamp}] ▶️  Wciskam Enter...")
    pyautogui.press('enter')
    
    print(f"[{timestamp}] 🚀 Nowy Agent uruchomiony. Czekam na kolejne zadania...")

def main():
    print("=========================================")
    print("   NADZORCA URUCHOMIONY (SUPERVISOR)     ")
    print("=========================================")
    print("Ten skrypt czeka na plik: .batch_complete")
    
    # Test na start - sprawdźmy czy biblioteki działają
    print("\n[TEST] Sprawdzam pozycję myszki...")
    print(f"[TEST] Myszka jest tu: {pyautogui.position()}")
    print("[TEST] Jeśli widzisz te napisy, Supervisor działa i CZEKA na manager.py.\n")

    # Na starcie kasujemy stare flagi, żeby nie odpalić restartu od razu
    if os.path.exists(SIGNAL_FILE):
        os.remove(SIGNAL_FILE)

    while True:
        if os.path.exists(SIGNAL_FILE):
            restart_cursor_agent()
        
        # Czekamy, żeby nie spalić procesora
        time.sleep(2)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nZatrzymano Nadzorcę.")