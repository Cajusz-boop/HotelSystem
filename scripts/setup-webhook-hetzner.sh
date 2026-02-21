#!/bin/bash
# Skrypt instalacyjny dla webhook na Hetzner
# Uruchom: bash setup-webhook-hetzner.sh
# 
# PRZED URUCHOMIENIEM:
# 1. Wygeneruj losowy secret: openssl rand -hex 32
# 2. Ustaw go poniżej w WEBHOOK_SECRET

set -e

WEBHOOK_SECRET="${WEBHOOK_SECRET:-CHANGE_ME}"
HOTEL_DIR="/var/www/hotel"

echo "=== Setup GitHub Webhook na Hetzner ==="

if [ "$WEBHOOK_SECRET" = "CHANGE_ME" ]; then
    echo ""
    echo "BŁĄD: Musisz ustawić WEBHOOK_SECRET!"
    echo ""
    echo "Uruchom:"
    echo "  export WEBHOOK_SECRET=\$(openssl rand -hex 32)"
    echo "  bash setup-webhook-hetzner.sh"
    echo ""
    echo "Lub jednolinijkowo:"
    echo "  WEBHOOK_SECRET=\$(openssl rand -hex 32) bash setup-webhook-hetzner.sh"
    exit 1
fi

echo "Webhook secret: $WEBHOOK_SECRET"
echo "(Zapisz go - będziesz go potrzebować w GitHubie!)"
echo ""

# 1. Sklonuj repo jeśli nie istnieje
if [ ! -d "$HOTEL_DIR/.git" ]; then
    echo "Klonowanie repo..."
    git clone https://github.com/Cajusz-boop/HotelSystem.git $HOTEL_DIR
fi

cd $HOTEL_DIR

# 2. Zainstaluj dependencies (potrzebne do builda)
echo "Installing dependencies..."
npm ci

# 3. Skopiuj pliki webhooka
echo "Copying webhook files..."
cp scripts/webhook-server.js webhook-server.js
cp scripts/deploy.sh deploy.sh
chmod +x deploy.sh

# 4. Utwórz .env dla webhooka
echo "WEBHOOK_SECRET=$WEBHOOK_SECRET" > .env.webhook

# 5. Dodaj konfigurację nginx dla webhooka
echo "Configuring nginx..."
NGINX_WEBHOOK_CONF='
    # GitHub Webhook endpoint
    location /webhook {
        proxy_pass http://127.0.0.1:9000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Hub-Signature-256 $http_x_hub_signature_256;
        proxy_read_timeout 300;
    }
'

# Sprawdź czy już jest webhook w nginx
if ! grep -q "location /webhook" /etc/nginx/sites-available/hotel; then
    echo "Dodaję webhook do nginx config..."
    # Dodaj przed ostatnim } w server block
    sed -i '/^}/i\
    # GitHub Webhook endpoint\
    location /webhook {\
        proxy_pass http://127.0.0.1:9000;\
        proxy_http_version 1.1;\
        proxy_set_header Host $host;\
        proxy_set_header X-Real-IP $remote_addr;\
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\
        proxy_set_header X-Hub-Signature-256 $http_x_hub_signature_256;\
        proxy_read_timeout 300;\
    }' /etc/nginx/sites-available/hotel
    
    nginx -t && systemctl reload nginx
    echo "Nginx OK"
else
    echo "Webhook już skonfigurowany w nginx"
fi

# 6. Uruchom webhook server przez PM2
echo "Starting webhook server..."
cd $HOTEL_DIR
WEBHOOK_SECRET=$WEBHOOK_SECRET pm2 start webhook-server.js --name github-webhook --update-env 2>/dev/null || \
WEBHOOK_SECRET=$WEBHOOK_SECRET pm2 restart github-webhook --update-env

pm2 save

echo ""
echo "=========================================="
echo "Setup zakończony!"
echo ""
echo "Teraz skonfiguruj webhook w GitHubie:"
echo ""
echo "1. Wejdź na: https://github.com/Cajusz-boop/HotelSystem/settings/hooks/new"
echo ""
echo "2. Wypełnij:"
echo "   Payload URL: https://hotel.karczma-labedz.pl/webhook"
echo "   Content type: application/json"
echo "   Secret: $WEBHOOK_SECRET"
echo "   Events: Just the push event"
echo ""
echo "3. Kliknij 'Add webhook'"
echo ""
echo "Test: curl -I https://hotel.karczma-labedz.pl/webhook"
echo "Logi: pm2 logs github-webhook"
echo "=========================================="
