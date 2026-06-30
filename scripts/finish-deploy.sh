#!/bin/bash
set -e
echo "=== Finish deploy (frontend + restart) ==="

mkdir -p /opt/tradewise/packages
cd /tmp && tar xzf fe_deploy.tar.gz -C /opt/tradewise/
cp /tmp/docker-compose.prod.yml /opt/tradewise/docker-compose.prod.yml
rm -f /tmp/fe_deploy.tar.gz

echo "Build frontend..."
cd /opt/tradewise && sudo docker build -f Dockerfile.frontend -t tradewise-frontend:latest .

echo "Restart backend + frontend with new images..."
cd /opt/tradewise && sudo docker-compose -f docker-compose.prod.yml up -d --no-deps backend frontend

sleep 15
curl -sf http://127.0.0.1:3000/health && echo " backend OK"
curl -sf http://127.0.0.1:8080/health && echo " frontend OK"
sudo docker-compose -f docker-compose.prod.yml ps backend frontend
echo "=== DONE ==="
