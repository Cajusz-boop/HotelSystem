#!/bin/bash
cd /var/www/hotel
mysql -u hotel hotel_pms '-pHotelPMS2024#Secure' -N -e "SELECT COUNT(id) FROM FiscalJob WHERE status='pending'"
