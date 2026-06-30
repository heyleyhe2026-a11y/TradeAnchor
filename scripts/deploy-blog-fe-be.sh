#!/bin/bash
# Lean deploy: frontend + backend images only (no nginx config, no prerender)
set -e

ARCHIVE="/tmp/tradewise_blog_fe_be.tar.gz"
if [ ! -f "$ARCHIVE" ]; then
  echo "Archive missing: $ARCHIVE"
  exit 1
fi

LOCAL_SIZE=$(stat -c%s "$ARCHIVE" 2>/dev/null || stat -f%z "$ARCHIVE")
echo "Archive size: $LOCAL_SIZE bytes"

echo "[1/5] Extracting source (no config files in archive)..."
sudo chown -R ubuntu:ubuntu /opt/tradewise/packages/backend /opt/tradewise/packages/frontend /opt/tradewise/packages/shared 2>/dev/null || true
cd /tmp
tar xzf tradewise_blog_fe_be.tar.gz -C /opt/tradewise/
sudo chown -R ubuntu:ubuntu /opt/tradewise/packages/backend /opt/tradewise/packages/frontend /opt/tradewise/packages/shared 2>/dev/null || true
rm -f tradewise_blog_fe_be.tar.gz

echo "[2/5] Verifying blog articles in source..."
grep -q 'the-one-eurusd-volatility-scalper-mt4' /opt/tradewise/packages/frontend/src/data/blogArticles.ts
grep -q 'gold-dashboard-ai-m1-scalper-mt4' /opt/tradewise/packages/frontend/src/data/blogArticles.ts
grep -q 'xauusd-one-candle-ny-session-scalper-mt4' /opt/tradewise/packages/frontend/src/data/blogArticles.ts
grep -q 'aquilagold-h1-dual-sma-breakout-mt4' /opt/tradewise/packages/frontend/src/data/blogArticles.ts
echo "Blog slugs OK"

echo "[3/5] Building backend image..."
cd /opt/tradewise
sudo docker build -f Dockerfile.backend -t tradewise-backend:latest .

echo "[4/5] Building frontend image..."
sudo docker build --no-cache -f Dockerfile.frontend -t tradewise-frontend:latest .

echo "[5/5] Restarting backend + frontend..."
sudo docker-compose -f docker-compose.prod.yml up -d --no-deps backend frontend

echo "Health checks..."
sleep 15
curl -sf http://127.0.0.1:3000/health && echo " backend OK" || echo " backend health check failed"
curl -sf http://127.0.0.1:8080/health && echo " frontend OK" || echo " frontend health check failed"

sudo docker-compose -f docker-compose.prod.yml ps backend frontend
echo ""
echo ">>> BLOG FE+BE DEPLOYMENT COMPLETE"
