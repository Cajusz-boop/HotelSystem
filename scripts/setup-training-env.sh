#!/bin/bash
cd /var/www/hotel-training
# Update DATABASE_URL
sed -i 's|^DATABASE_URL=.*|DATABASE_URL=mysql://hotel:HotelPMS2024%23Secure@localhost:3306/hotel_training|' .env.production.local
# Update NEXT_PUBLIC_APP_URL i NEXT_BASE_PATH (middleware + next.config)
sed -i 's|^NEXT_PUBLIC_APP_URL=.*|NEXT_PUBLIC_APP_URL=https://hotel.karczma-labedz.pl/training|' .env.production.local
grep -q '^NEXT_BASE_PATH=' .env.production.local && sed -i 's|^NEXT_BASE_PATH=.*|NEXT_BASE_PATH=/training|' .env.production.local || echo 'NEXT_BASE_PATH=/training' >> .env.production.local
# Update PORT
sed -i 's|^PORT=.*|PORT=3012|' .env.production.local
echo "Done. Current values:"
grep -E '^DATABASE_URL|^NEXT_PUBLIC_APP_URL|^NEXT_BASE_PATH|^PORT' .env.production.local
