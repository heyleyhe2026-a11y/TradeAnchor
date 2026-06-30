#!/bin/bash
set -e

echo "========================================="
echo "  TradeWise Frontend + Prerender Deploy"
echo "========================================="

if [ ! -f /tmp/tradewise_fe_prerender.tar.gz ]; then
  echo "Archive missing: /tmp/tradewise_fe_prerender.tar.gz"
  exit 1
fi

echo "[1/7] Fixing permissions and extracting..."
sudo chown -R ubuntu:ubuntu /opt/tradewise/packages/frontend /opt/tradewise/packages/shared /opt/tradewise/packages/prerender 2>/dev/null || true
cd /tmp
sudo tar xzf tradewise_fe_prerender.tar.gz -C /opt/tradewise/
sudo chown -R ubuntu:ubuntu /opt/tradewise/packages/frontend /opt/tradewise/packages/shared /opt/tradewise/packages/prerender /opt/tradewise/nginx 2>/dev/null || true
rm -f tradewise_fe_prerender.tar.gz

echo "[2/7] Verifying deploy files..."
test -f /opt/tradewise/packages/frontend/src/components/playbooks/PlaybookPublishedAt.tsx
test -f /opt/tradewise/packages/frontend/src/hooks/useDisplayTimezone.ts

echo "[3/7] Updating system nginx config..."
sudo cp /opt/tradewise/nginx/gateway.conf /etc/nginx/sites-available/tradewise
sudo nginx -t

echo "[4/7] Building frontend image..."
cd /opt/tradewise
sudo docker build -f Dockerfile.frontend -t tradewise-frontend:latest .

echo "[5/7] Building prerender image..."
sudo docker build -f packages/prerender/Dockerfile -t tradewise-prerender:latest packages/prerender

echo "[6/7] Restarting frontend + prerender..."
sudo docker-compose -f docker-compose.prod.yml up -d --no-deps frontend prerender
sudo systemctl reload nginx

echo "[7/7] Health checks..."
sleep 12
curl -sf http://127.0.0.1:8080/health && echo " frontend OK" || echo " frontend health check failed"
curl -sf http://127.0.0.1:3002/health && echo " prerender OK" || echo " prerender health check failed"
curl -sf -o /dev/null -w "blog HTTP %{http_code}\n" http://127.0.0.1:8080/blog/monday-gap-breakout-xauusd-ea

echo ""
sudo docker-compose -f docker-compose.prod.yml ps frontend prerender
echo ""
echo ">>> DEPLOYMENT COMPLETE!"
