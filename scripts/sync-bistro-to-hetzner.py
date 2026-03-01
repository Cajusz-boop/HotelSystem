#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SKRYPT SYNCHRONIZACJI BISTRO → HOTELSYSTEM
============================================
Pobiera nowe zamówienia z bazy KWHotel i wysyła do API HotelSystem.

INSTALACJA NA SERWERZE LOKALNYM:
1. Zainstaluj Python 3.x: https://www.python.org/downloads/
2. Zainstaluj zależności: pip install pymysql requests
3. Skopiuj ten plik na serwer (np. C:\\Scripts\\sync-bistro.py)
4. Edytuj CONFIG poniżej (hasła, klucz API)
5. Dodaj do Harmonogramu zadań Windows:
   - Program: python.exe
   - Argumenty: C:\\Scripts\\sync-bistro.py
   - Wyzwalacz: Co 5 minut
"""

import json
import os
import sys
from datetime import datetime, timedelta
from decimal import Decimal
import logging

# =============================================================================
# KONFIGURACJA - ZMIEŃ TE WARTOŚCI!
# =============================================================================

CONFIG = {
    # Baza danych KWHotel (lokalny serwer)
    "db_host": "localhost",
    "db_port": 3306,
    "db_name": "kwhotel",
    "db_user": "admin",
    "db_password": "gracho123",
    
    # API HotelSystem (Hetzner)
    "api_url": "https://hotel.karczma-labedz.pl/api/v1/external/posting",
    "api_key": "a89f3281-8ae4-4c06-a351-987b35caa4f",  # Klucz z .env na Hetzner (EXTERNAL_API_KEY)
    
    # Plik ze stanem synchronizacji
    "state_file": "C:\\Scripts\\bistro-sync-state.json",
    
    # Logowanie
    "log_file": "C:\\Scripts\\bistro-sync.log",
}

# =============================================================================
# SETUP LOGOWANIA
# =============================================================================

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(CONFIG["log_file"], encoding="utf-8"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# =============================================================================
# FUNKCJE POMOCNICZE
# =============================================================================

def get_sync_state():
    """Odczytaj ostatni zsynchronizowany ID."""
    if os.path.exists(CONFIG["state_file"]):
        try:
            with open(CONFIG["state_file"], "r") as f:
                return json.load(f)
        except:
            pass
    return {"last_id": 0, "last_sync": None}


def save_sync_state(last_id):
    """Zapisz stan synchronizacji."""
    state = {
        "last_id": last_id,
        "last_sync": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
    with open(CONFIG["state_file"], "w") as f:
        json.dump(state, f, indent=2)


def get_room_number(symbol):
    """Wyciągnij numer pokoju z symbolu (np. '004 140/185' -> '004')."""
    if not symbol:
        return "000"
    # Pierwsze 3 cyfry
    import re
    match = re.match(r"^(\d{3})", symbol)
    if match:
        return match.group(1)
    # Litery + cyfry (np. "SI 020")
    match = re.match(r"^([A-Z]+\s*\d+)", symbol)
    if match:
        return match.group(1).strip()
    # Fallback - pierwszy segment
    return symbol.split()[0] if symbol else "000"


def decimal_to_float(obj):
    """Konwersja Decimal do float dla JSON."""
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError


# =============================================================================
# GŁÓWNA LOGIKA
# =============================================================================

def main():
    logger.info("=== START SYNCHRONIZACJI BISTRO ===")
    
    # Sprawdź klucz API
    if CONFIG["api_key"] == "TUTAJ_WSTAW_KLUCZ_API":
        logger.error("BŁĄD: Nie ustawiono klucza API! Edytuj CONFIG w skrypcie.")
        sys.exit(1)
    
    # Importy (mogą nie być zainstalowane)
    try:
        import pymysql
        import requests
    except ImportError as e:
        logger.error(f"Brak wymaganej biblioteki: {e}")
        logger.error("Zainstaluj: pip install pymysql requests")
        sys.exit(1)
    
    # Pobierz stan
    state = get_sync_state()
    last_id = state.get("last_id", 0)
    logger.info(f"Ostatnio zsynchronizowane ID: {last_id}")
    
    try:
        # Połącz z bazą KWHotel
        conn = pymysql.connect(
            host=CONFIG["db_host"],
            port=CONFIG["db_port"],
            database=CONFIG["db_name"],
            user=CONFIG["db_user"],
            password=CONFIG["db_password"],
            charset="utf8mb4",
            cursorclass=pymysql.cursors.DictCursor
        )
        cursor = conn.cursor()
        logger.info("Połączono z bazą KWHotel")
        
        # Pobierz nowe pozycje gastronomiczne
        query = """
        SELECT 
            ra.RezerwAsortymentID,
            ra.RezerwacjaID,
            ra.Nazwa,
            ra.Ilosc,
            ra.Netto,
            ra.VAT,
            ra.data,
            r.PokojID,
            p.Symbol as PokojSymbol
        FROM rezerwasortyment ra
        JOIN rezerwacje r ON ra.RezerwacjaID = r.RezerwacjaID
        JOIN pokoje p ON r.PokojID = p.PokojID
        WHERE ra.RezerwAsortymentID > %s
          AND ra.data >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        ORDER BY ra.RezerwAsortymentID ASC
        LIMIT 100
        """
        cursor.execute(query, (last_id,))
        rows = cursor.fetchall()
        cursor.close()
        conn.close()
        
        # Grupuj po rezerwacji
        orders_by_reservation = {}
        max_id = last_id
        
        for row in rows:
            item_id = row["RezerwAsortymentID"]
            rez_id = row["RezerwacjaID"]
            nazwa = row["Nazwa"]
            ilosc = float(row["Ilosc"] or 1)
            netto = float(row["Netto"] or 0)
            vat = float(row["VAT"] or 0)
            pokoj_symbol = row["PokojSymbol"] or ""
            
            # Cena brutto
            brutto = round(netto * (1 + vat / 100), 2)
            
            item = {
                "id": item_id,
                "name": nazwa,
                "quantity": int(ilosc),
                "unitPrice": brutto
            }
            
            if rez_id not in orders_by_reservation:
                orders_by_reservation[rez_id] = {
                    "roomNumber": get_room_number(pokoj_symbol),
                    "items": [],
                    "timestamp": row["data"]
                }
            orders_by_reservation[rez_id]["items"].append(item)
            
            if item_id > max_id:
                max_id = item_id
        
        count = len(orders_by_reservation)
        logger.info(f"Znaleziono {count} nowych zamówień do wysłania")
        
        if count == 0:
            logger.info("Brak nowych danych do synchronizacji")
            return
        
        # Wyślij każde zamówienie do API
        success_count = 0
        error_count = 0
        
        for rez_id, order in orders_by_reservation.items():
            room_number = order["roomNumber"]
            items = order["items"]
            
            # Suma
            total_amount = sum(it["quantity"] * it["unitPrice"] for it in items)
            total_amount = round(total_amount, 2)
            
            # Pomiń zamówienia z kwotą <= 0
            if total_amount <= 0:
                logger.info(f"Pomijam: pokój {room_number}, kwota {total_amount} PLN (kwota <= 0)")
                success_count += 1  # nie liczymy jako błąd
                continue
            
            # Body dla API
            body = {
                "roomNumber": room_number,
                "amount": total_amount,
                "type": "RESTAURANT",
                "description": "Zamówienie z Bistro (KWHotel)",
                "posSystem": "KWHotel Bistro",
                "items": [
                    {"name": it["name"], "quantity": it["quantity"], "unitPrice": it["unitPrice"]}
                    for it in items
                ]
            }
            
            logger.info(f"Wysyłam: pokój {room_number}, kwota {total_amount} PLN, pozycji: {len(items)}")
            
            try:
                response = requests.post(
                    CONFIG["api_url"],
                    json=body,
                    headers={"X-API-Key": CONFIG["api_key"]},
                    timeout=30
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get("success"):
                        if data.get("unassigned"):
                            logger.info(f"  OK (nieprzypisane): {data.get('reason', 'zapisano jako nieprzypisane')}")
                        else:
                            logger.info(f"  OK: transactionId={data.get('transactionId')}")
                        success_count += 1
                    else:
                        logger.error(f"  BŁĄD API: {data.get('error')}")
                        error_count += 1
                else:
                    logger.error(f"  BŁĄD HTTP {response.status_code}: {response.text[:200]}")
                    error_count += 1
                    
            except Exception as e:
                logger.error(f"  BŁĄD: {e}")
                error_count += 1
        
        # Zapisz stan
        if success_count > 0:
            save_sync_state(max_id)
            logger.info(f"Zapisano stan: last_id={max_id}")
        
        logger.info(f"=== KONIEC: sukces={success_count}, błędy={error_count} ===")
        
    except Exception as e:
        logger.error(f"BŁĄD KRYTYCZNY: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
