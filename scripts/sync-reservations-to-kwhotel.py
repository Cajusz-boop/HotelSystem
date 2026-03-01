#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Synchronizacja rezerwacji z HotelSystem do KWHotel.
Uruchamiany co 5 minut na serwerze KWHotel (10.119.169.20).

Pobiera rezerwacje z HotelSystem API i wstawia/aktualizuje je w bazie KWHotel.
"""

import os
import sys
import json
import logging
import pymysql
import requests
from datetime import datetime, timedelta
from pathlib import Path

# Konfiguracja logowania
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] [%(levelname)s] %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(Path(__file__).parent / 'sync-reservations.log', encoding='utf-8')
    ]
)
logger = logging.getLogger(__name__)

# === KONFIGURACJA ===

# HotelSystem API
HOTELSYSTEM_API_URL = "https://hotel.karczma-labedz.pl/api/v1/external/reservations-export"
HOTELSYSTEM_API_KEY = "a89f3281-8ae4-4c06-a351-987b35caa4f"

# KWHotel MySQL (lokalnie na serwerze)
KWHOTEL_DB_HOST = "localhost"
KWHOTEL_DB_USER = "root"
KWHOTEL_DB_PASS = "root123"
KWHOTEL_DB_NAME = "kwhotel"

# Plik stanu (ostatnia synchronizacja)
STATE_FILE = Path(__file__).parent / "sync-reservations-state.json"

# Zakres synchronizacji (dni do przodu)
SYNC_DAYS_AHEAD = 60


def load_state():
    """Wczytaj stan ostatniej synchronizacji."""
    if STATE_FILE.exists():
        try:
            with open(STATE_FILE, 'r') as f:
                return json.load(f)
        except Exception:
            pass
    return {"last_sync": None, "synced_ids": {}}


def save_state(state):
    """Zapisz stan synchronizacji."""
    with open(STATE_FILE, 'w') as f:
        json.dump(state, f, indent=2)


def get_kwhotel_room_id(cursor, room_number):
    """Znajdź ID pokoju w KWHotel po numerze."""
    cursor.execute("SELECT id FROM rooms WHERE name = %s LIMIT 1", (room_number,))
    row = cursor.fetchone()
    return row['id'] if row else None


def get_or_create_kwhotel_client(cursor, guest_name, company_name=None):
    """Znajdź lub utwórz klienta w KWHotel."""
    if not guest_name and not company_name:
        return None
    
    search_name = company_name or guest_name
    
    # Szukaj istniejącego klienta
    cursor.execute(
        "SELECT KlientID FROM klienci WHERE Nazwa LIKE %s OR Firma LIKE %s LIMIT 1",
        (f"%{search_name}%", f"%{search_name}%")
    )
    row = cursor.fetchone()
    if row:
        return row['KlientID']
    
    # Utwórz nowego klienta
    if company_name:
        cursor.execute(
            "INSERT INTO klienci (Nazwa, Firma, DataUtworzenia) VALUES (%s, %s, NOW())",
            (guest_name or company_name, company_name)
        )
    else:
        cursor.execute(
            "INSERT INTO klienci (Nazwa, DataUtworzenia) VALUES (%s, NOW())",
            (guest_name,)
        )
    return cursor.lastrowid


def sync_reservation_to_kwhotel(cursor, res, synced_ids):
    """Synchronizuj pojedynczą rezerwację do KWHotel."""
    hs_id = res['id']
    room_number = res['roomNumber']
    
    # Znajdź pokój w KWHotel
    room_id = get_kwhotel_room_id(cursor, room_number)
    if not room_id:
        logger.warning(f"Pokoj {room_number} nie istnieje w KWHotel - pomijam rezerwacje {hs_id}")
        return False
    
    # Znajdź lub utwórz klienta
    client_id = get_or_create_kwhotel_client(
        cursor, 
        res.get('guestName'), 
        res.get('companyName')
    )
    
    # Przygotuj dane
    data_od = datetime.strptime(res['checkIn'], '%Y-%m-%d')
    data_do = datetime.strptime(res['checkOut'], '%Y-%m-%d')
    osob = (res.get('adults') or 1) + (res.get('children') or 0)
    cena = res.get('totalPrice') or 0
    uwagi = f"[HotelSystem:{hs_id}] {res.get('notes') or ''}"[:1024]
    
    # Status: 1 = potwierdzona, 2 = zameldowana
    status_id = 2 if res['status'] == 'CHECKED_IN' else 1
    status2_id = 2 if res['status'] == 'CHECKED_IN' else 1
    
    # Sprawdź czy rezerwacja już istnieje (po ID w uwagach)
    kw_id = synced_ids.get(hs_id)
    
    if kw_id:
        # Aktualizuj istniejącą
        cursor.execute("""
            UPDATE rezerwacje SET
                PokojID = %s,
                DataOd = %s,
                DataDo = %s,
                KlientID = %s,
                Osob = %s,
                Cena = %s,
                Uwagi = %s,
                status_id = %s,
                status2_id = %s,
                modefied_date = NOW()
            WHERE RezerwacjaID = %s
        """, (room_id, data_od, data_do, client_id, osob, cena, uwagi, status_id, status2_id, kw_id))
        logger.info(f"Zaktualizowano: {room_number} ({res['checkIn']} - {res['checkOut']}) KW_ID={kw_id}")
    else:
        # Sprawdź czy nie ma duplikatu (ten sam pokój i daty)
        cursor.execute("""
            SELECT RezerwacjaID FROM rezerwacje 
            WHERE PokojID = %s AND DataOd = %s AND DataDo = %s AND usun = 0
            LIMIT 1
        """, (room_id, data_od, data_do))
        existing = cursor.fetchone()
        
        if existing:
            kw_id = existing['RezerwacjaID']
            # Aktualizuj i oznacz jako zsynchronizowaną
            cursor.execute("""
                UPDATE rezerwacje SET
                    KlientID = %s,
                    Osob = %s,
                    Cena = %s,
                    Uwagi = %s,
                    status_id = %s,
                    status2_id = %s,
                    modefied_date = NOW()
                WHERE RezerwacjaID = %s
            """, (client_id, osob, cena, uwagi, status_id, status2_id, kw_id))
            synced_ids[hs_id] = kw_id
            logger.info(f"Polaczono istniejaca: {room_number} ({res['checkIn']} - {res['checkOut']}) KW_ID={kw_id}")
        else:
            # Utwórz nową rezerwację
            cursor.execute("""
                INSERT INTO rezerwacje (
                    PokojID, DataOd, DataDo, KlientID, Osob, Cena, Uwagi,
                    status_id, status2_id, DataUtworzenia, SposRozlicz, 
                    CenaDzieci, WplataZaliczka, CenaTowaryGrupy
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, NOW(), 0,
                    0, 0, 0
                )
            """, (room_id, data_od, data_do, client_id, osob, cena, uwagi, status_id, status2_id))
            kw_id = cursor.lastrowid
            synced_ids[hs_id] = kw_id
            logger.info(f"Utworzono: {room_number} ({res['checkIn']} - {res['checkOut']}) KW_ID={kw_id}")
    
    return True


def main():
    logger.info("=== START SYNCHRONIZACJI REZERWACJI ===")
    
    state = load_state()
    synced_ids = state.get("synced_ids", {})
    last_sync = state.get("last_sync")
    
    # Pobierz rezerwacje z HotelSystem API
    try:
        today = datetime.now().strftime('%Y-%m-%d')
        future = (datetime.now() + timedelta(days=SYNC_DAYS_AHEAD)).strftime('%Y-%m-%d')
        
        params = {
            "from": today,
            "to": future,
        }
        if last_sync:
            params["modifiedSince"] = last_sync
        
        headers = {
            "X-API-Key": HOTELSYSTEM_API_KEY,
            "Content-Type": "application/json"
        }
        
        logger.info(f"Pobieranie rezerwacji z HotelSystem ({today} - {future})...")
        response = requests.get(HOTELSYSTEM_API_URL, params=params, headers=headers, timeout=30)
        response.raise_for_status()
        data = response.json()
        
        if not data.get("success"):
            logger.error(f"API zwrocilo blad: {data.get('error')}")
            return
        
        reservations = data.get("reservations", [])
        logger.info(f"Pobrano {len(reservations)} rezerwacji")
        
        if not reservations:
            logger.info("Brak rezerwacji do synchronizacji")
            return
        
    except requests.RequestException as e:
        logger.error(f"Blad polaczenia z HotelSystem API: {e}")
        return
    except Exception as e:
        logger.error(f"Blad pobierania danych: {e}")
        return
    
    # Połącz z bazą KWHotel
    try:
        conn = pymysql.connect(
            host=KWHOTEL_DB_HOST,
            user=KWHOTEL_DB_USER,
            password=KWHOTEL_DB_PASS,
            database=KWHOTEL_DB_NAME,
            charset='utf8mb4',
            cursorclass=pymysql.cursors.DictCursor
        )
        logger.info("Polaczono z baza KWHotel")
    except pymysql.Error as e:
        logger.error(f"Blad polaczenia z baza KWHotel: {e}")
        return
    
    # Synchronizuj rezerwacje
    success_count = 0
    error_count = 0
    
    try:
        with conn.cursor() as cursor:
            for res in reservations:
                try:
                    if sync_reservation_to_kwhotel(cursor, res, synced_ids):
                        success_count += 1
                    else:
                        error_count += 1
                except Exception as e:
                    logger.error(f"Blad synchronizacji rezerwacji {res.get('id')}: {e}")
                    error_count += 1
            
            conn.commit()
    finally:
        conn.close()
    
    # Zapisz stan
    state["last_sync"] = datetime.now().isoformat()
    state["synced_ids"] = synced_ids
    save_state(state)
    
    logger.info(f"=== KONIEC: sukces={success_count}, bledy={error_count} ===")


if __name__ == "__main__":
    main()
