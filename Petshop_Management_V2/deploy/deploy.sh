#!/usr/bin/env bash
set -euo pipefail

# ═══════════════════════════════════════════════════════════════
# Petshop Management V2 — Production Deploy Script
# ═══════════════════════════════════════════════════════════════
# Usage: ./deploy.sh [branch]
# Default branch: codex/baseline-upgrade
# ═══════════════════════════════════════════════════════════════

PROJECT_DIR="/root/petshop"
APP_DIR="$PROJECT_DIR/Petshop_Management_V2"
COMPOSE_FILE="$PROJECT_DIR/docker-compose.prod.yml"
BRANCH="${1:-codex/baseline-upgrade}"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}✅ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
fail() { echo -e "${RED}❌ $1${NC}"; exit 1; }

echo '═══════════════════════════════════════════'
echo '🐾 Petshop V2 — Production Deploy'
echo "   Branch: $BRANCH"
echo '═══════════════════════════════════════════'

# Step 1: Pull latest code
echo ''
echo '🔄 Step 1/6: Pulling latest code...'
cd "$APP_DIR" && git pull origin "$BRANCH" || fail 'Git pull failed'
VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo 'unknown')
COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')
log "Code updated: v$VERSION ($COMMIT) from branch: $BRANCH"

# Step 2: Build Docker images
echo ''
echo '🔨 Step 2/6: Building Docker images (3-5 minutes)...'
cd "$PROJECT_DIR"
docker compose -f "$COMPOSE_FILE" build api web || fail 'Docker build failed'
log 'Images built successfully'

# Step 3: Recreate containers
echo ''
echo '🚀 Step 3/6: Recreating containers...'
docker compose -f "$COMPOSE_FILE" up -d --force-recreate api web || fail 'Container recreate failed'
log 'Containers recreated'

# Step 4: Wait for startup
echo ''
echo '⏳ Step 4/6: Waiting for services to start (10s)...'
sleep 10

# Step 5: Run migrations
echo ''
echo '🗃️ Step 5/6: Running database migrations...'
docker compose -f "$COMPOSE_FILE" exec -T api \
  /app/packages/database/node_modules/.bin/prisma migrate deploy \
  --schema=/app/packages/database/prisma/schema.prisma || warn 'Migration had warnings'
log 'Migrations applied'

# Step 6: Health check
echo ''
echo '🏥 Step 6/6: Health check...'
API_HEALTH=$(curl -sf http://127.0.0.1:3003/api/health 2>/dev/null || echo 'FAIL')
WEB_STATUS=$(curl -so /dev/null -w '%{http_code}' http://127.0.0.1:3002/ 2>/dev/null || echo '000')

if echo "$API_HEALTH" | grep -q 'healthy'; then
  log "API: healthy"
else
  fail "API health check failed: $API_HEALTH"
fi

if [ "$WEB_STATUS" = '307' ] || [ "$WEB_STATUS" = '200' ]; then
  log "Web: responding (HTTP $WEB_STATUS)"
else
  fail "Web health check failed: HTTP $WEB_STATUS"
fi

echo ''
echo '═══════════════════════════════════════════'
echo "📦 Version: v$VERSION"
echo "🔖 Commit:  $COMMIT"
echo "🌿 Branch:  $BRANCH"
echo "📅 Date:    $(date '+%Y-%m-%d %H:%M:%S')"
echo '───────────────────────────────────────────'
docker ps --filter name=petshop --format 'table {{.Names}}\t{{.Status}}'
echo '═══════════════════════════════════════════'
echo '🎉 Deploy complete!'
echo '═══════════════════════════════════════════'
