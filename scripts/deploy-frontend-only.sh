#!/bin/bash
# Frontend-only deploy: rebuild frontend image, no backend, no nginx config upload
set -e

ARCHIVE="/tmp/tradewise_frontend_only.tar.gz"
if [ ! -f "$ARCHIVE" ]; then
  echo "Archive missing: $ARCHIVE"
  exit 1
fi

LOCAL_SIZE=$(stat -c%s "$ARCHIVE" 2>/dev/null || stat -f%z "$ARCHIVE")
echo "Archive size: $LOCAL_SIZE bytes"

echo "[1/4] Extracting frontend source..."
sudo chown -R ubuntu:ubuntu /opt/tradewise/packages/frontend /opt/tradewise/packages/shared 2>/dev/null || true
cd /tmp
tar xzf tradewise_frontend_only.tar.gz -C /opt/tradewise/
sudo chown -R ubuntu:ubuntu /opt/tradewise/packages/frontend /opt/tradewise/packages/shared 2>/dev/null || true
rm -f tradewise_frontend_only.tar.gz

echo "[2/4] Building frontend image..."
cd /opt/tradewise
sudo docker build -f Dockerfile.frontend -t tradewise-frontend:latest .

echo "[3/4] Restarting frontend..."
sudo docker-compose -f docker-compose.prod.yml up -d --no-deps frontend

echo "[4/4] Health check..."
sleep 12
curl -sf http://127.0.0.1:8080/health && echo " frontend OK" || echo " frontend health check failed"

sudo docker-compose -f docker-compose.prod.yml ps frontend
echo ""
echo ">>> FRONTEND-ONLY DEPLOYMENT COMPLETE"
