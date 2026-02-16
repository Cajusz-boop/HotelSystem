-- Utworzenie bazy dla projektu HotelSystem (XAMPP).
-- Uruchom w phpMyAdmin (zakładka SQL) lub: mysql -u root -p < scripts/create-db-hotelsystem.sql

CREATE DATABASE IF NOT EXISTS hotelsystem
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
