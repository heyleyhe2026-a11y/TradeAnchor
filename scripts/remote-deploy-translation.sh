#!/bin/bash
set -e
echo "=== TradeAnchor deploy (remote only) ==="

echo "[1/5] Extract..."
cd /tmp && tar xzf tradewise_deploy.tar.gz -C /opt/tradewise/
rm -f /tmp/tradewise_deploy.tar.gz

echo "[2/5] DB migration..."
MIGRATION="/opt/tradewise/packages/backend/prisma/migrations/20260626120000_add_content_translations/migration.sql"
TABLE_EXISTS=$(sudo docker exec tradewise-postgres psql -U tradewise -d tradewise -tAc "SELECT 1 FROM information_schema.tables WHERE table_name='content_translations'" 2>/dev/null || echo "")
if [ "$TABLE_EXISTS" != "1" ] && [ -f "$MIGRATION" ]; then
  sudo docker exec -i tradewise-postgres psql -U tradewise -d tradewise < "$MIGRATION"
  echo "Migration applied."
else
  echo "Migration skipped (exists or missing file)."
fi

echo "[3/5] Build backend..."
cd /opt/tradewise && sudo docker build -f Dockerfile.backend -t tradewise-backend:latest .

echo "[4/5] Build frontend..."
sudo docker build -f Dockerfile.frontend -t tradewise-frontend:latest .

echo "[5/5] Restart backend + frontend..."
cd /opt/tradewise && sudo docker-compose -f docker-compose.prod.yml up -d --no-deps backend frontend

sleep 12
curl -sf http://127.0.0.1:3000/health && echo " backend OK"
curl -sf http://127.0.0.1:8080/health && echo " frontend OK"
sudo docker-compose -f docker-compose.prod.yml ps backend frontend
echo "=== DONE ==="
