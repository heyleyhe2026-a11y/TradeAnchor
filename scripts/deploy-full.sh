#!/bin/bash
set -e

echo "========================================="
echo "  TradeWise Full Deploy (BE + FE + Migration)"
echo "========================================="

ARCHIVE="/tmp/tradewise_full_deploy.tar.gz"
if [ ! -f "$ARCHIVE" ]; then
  echo "Archive missing: $ARCHIVE"
  exit 1
fi

echo "[1/8] Extracting..."
sudo chown -R ubuntu:ubuntu /opt/tradewise/packages/backend /opt/tradewise/packages/frontend /opt/tradewise/packages/shared /opt/tradewise/packages/prerender 2>/dev/null || true
cd /tmp
sudo tar xzf tradewise_full_deploy.tar.gz -C /opt/tradewise/
sudo chown -R ubuntu:ubuntu /opt/tradewise/packages /opt/tradewise/nginx 2>/dev/null || true
rm -f tradewise_full_deploy.tar.gz

echo "[2/8] Running database migration (signup attribution)..."
MIGRATION="/opt/tradewise/packages/backend/prisma/migrations/20260615120000_add_signup_attribution/migration.sql"
if [ -f "$MIGRATION" ]; then
  sudo docker exec -i tradewise-postgres psql -U tradewise -d tradewise < "$MIGRATION"
  echo "Migration applied."
else
  echo "WARNING: migration file not found at $MIGRATION"
fi

echo "[3/8] Updating nginx..."
sudo cp /opt/tradewise/nginx/gateway.conf /etc/nginx/sites-available/tradewise
sudo nginx -t

echo "[4/8] Building backend image..."
cd /opt/tradewise
sudo docker build -f Dockerfile.backend -t tradewise-backend:latest .

echo "[5/8] Building frontend image..."
sudo docker build -f Dockerfile.frontend -t tradewise-frontend:latest .

echo "[6/8] Building prerender image..."
sudo docker build -f packages/prerender/Dockerfile -t tradewise-prerender:latest packages/prerender

echo "[7/8] Restarting backend + frontend + prerender..."
sudo docker-compose -f docker-compose.prod.yml up -d --no-deps backend frontend prerender
sudo systemctl reload nginx

echo "[8/8] Health checks..."
sleep 15
curl -sf http://127.0.0.1:3000/health && echo " backend OK" || echo " backend health check failed"
curl -sf http://127.0.0.1:8080/health && echo " frontend OK" || echo " frontend health check failed"
curl -sf http://127.0.0.1:3002/health && echo " prerender OK" || echo " prerender health check failed"

echo ""
sudo docker-compose -f docker-compose.prod.yml ps backend frontend prerender
echo ""
echo ">>> DEPLOYMENT COMPLETE!"
