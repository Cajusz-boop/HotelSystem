#!/bin/bash
# Deploy script uruchamiany przez webhook lub ręcznie
# Lokalizacja na serwerze: /var/www/hotel/deploy.sh

set -e
cd /var/www/hotel

LOG_FILE="/var/www/hotel/deploy.log"
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "=== Deploy started ==="

# 0. Backup production .env before git pull
log "Backing up production .env..."
cp /var/www/hotel/.env /tmp/hotel-env-backup 2>/dev/null || true

# 1. Git pull
log "Git pull..."
git fetch origin
git reset --hard origin/master 2>/dev/null || git reset --hard origin/main
log "Git pull OK"

# 1.5 Restore production .env (git pull may have overwritten it)
log "Restoring production .env..."
cp /tmp/hotel-env-backup /var/www/hotel/.env 2>/dev/null || true

# 2. Install dependencies (tylko jesli package.json sie zmienil)
if [ package.json -nt node_modules/.package-lock.json ] 2>/dev/null; then
    log "Installing dependencies..."
    npm ci --production=false
    log "npm ci OK"
else
    log "Dependencies up to date - skipping npm ci"
fi

# 3. Prisma generate (tylko jesli schema sie zmienila)
SCHEMA_HASH=$(md5sum prisma/schema.prisma | cut -d' ' -f1)
LAST_HASH_FILE="/var/www/hotel/.last_schema_hash"
LAST_HASH=""
[ -f "$LAST_HASH_FILE" ] && LAST_HASH=$(cat "$LAST_HASH_FILE")

if [ "$SCHEMA_HASH" != "$LAST_HASH" ]; then
    log "Prisma generate..."
    npx prisma generate
    npx prisma db push --accept-data-loss 2>/dev/null || true
    echo "$SCHEMA_HASH" > "$LAST_HASH_FILE"
    log "Prisma OK"
else
    log "Schema unchanged - skipping prisma"
fi

# 4. Build
log "Building..."
npm run build
log "Build OK"

# 5. Kopiuj static do standalone
log "Copying static files..."
cp -r .next/static .next/standalone/.next/
cp -r public .next/standalone/ 2>/dev/null || true
log "Static OK"

# 6. WAZNE: Kopiuj produkcyjny .env do standalone
log "Copying production .env to standalone..."
cp /var/www/hotel/.env /var/www/hotel/.next/standalone/.env
log ".env copied OK"

# 7. WAZNE: Kopiuj Prisma client do standalone
log "Copying Prisma client to standalone..."
cp -r /var/www/hotel/node_modules/.prisma /var/www/hotel/.next/standalone/node_modules/ 2>/dev/null || true
cp -r /var/www/hotel/node_modules/@prisma /var/www/hotel/.next/standalone/node_modules/ 2>/dev/null || true
log "Prisma client copied OK"

# 8. Usun .git ze standalone (oszczednosc miejsca)
log "Removing .git from standalone..."
rm -rf /var/www/hotel/.next/standalone/.git 2>/dev/null || true
log ".git removed OK"

# 9. Restart PM2
log "Restarting PM2..."
pm2 restart hotel-pms --update-env || pm2 start .next/standalone/server.js --name hotel-pms
pm2 save
log "PM2 restart OK"

log "=== Deploy completed ==="
echo ""
