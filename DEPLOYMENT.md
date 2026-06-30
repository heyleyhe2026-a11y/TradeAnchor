# TradeWise Platform Deployment Guide

This guide covers the complete deployment process for the TradeWise platform, including CI/CD setup, Kubernetes deployment, and monitoring configuration.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [CI/CD Configuration](#cicd-configuration)
4. [Kubernetes Deployment](#kubernetes-deployment)
5. [Monitoring Setup](#monitoring-setup)
6. [Sentry Error Tracking](#sentry-error-tracking)
7. [Health Checks](#health-checks)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Tools
- Docker (v24.0+)
- Kubernetes cluster (v1.28+)
- kubectl (v1.28+)
- pnpm (v8.0+)
- Node.js (v20.0+)

### Cloud Resources
- Container registry (Docker Hub, AWS ECR, or GCR)
- Kubernetes cluster (EKS, GKE, or AKS)
- PostgreSQL database
- Redis instance
- MongoDB instance
- Object storage (S3 or equivalent)

### External Services
- Sentry account for error tracking
- Slack workspace for alerts (optional)
- PagerDuty account for critical alerts (optional)

## Environment Setup

### 1. Clone Repository

```bash
git clone https://github.com/your-org/tradewise.git
cd tradewise
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Configure Environment Variables

Create environment files for each environment:

**Development (.env.development)**
```env
NODE_ENV=development
DATABASE_URL=postgresql://user:password@localhost:5432/tradewise
REDIS_URL=redis://localhost:6379
MONGODB_URL=mongodb://localhost:27017/tradewise
JWT_SECRET=your-dev-jwt-secret
JWT_REFRESH_SECRET=your-dev-refresh-secret
SENTRY_DSN=https://your-sentry-dsn
```

**Staging (.env.staging)**
```env
NODE_ENV=staging
DATABASE_URL=postgresql://user:password@staging-db:5432/tradewise
REDIS_URL=redis://staging-redis:6379
MONGODB_URL=mongodb://staging-mongo:27017/tradewise
JWT_SECRET=your-staging-jwt-secret
JWT_REFRESH_SECRET=your-staging-refresh-secret
SENTRY_DSN=https://your-sentry-dsn
```

**Production (.env.production)**
```env
NODE_ENV=production
DATABASE_URL=postgresql://user:password@prod-db:5432/tradewise
REDIS_URL=redis://prod-redis:6379
MONGODB_URL=mongodb://prod-mongo:27017/tradewise
JWT_SECRET=your-prod-jwt-secret
JWT_REFRESH_SECRET=your-prod-refresh-secret
SENTRY_DSN=https://your-sentry-dsn
OPENAI_API_KEY=your-openai-key
```

## CI/CD Configuration

### 1. GitHub Actions Setup

The CI/CD pipeline is configured in `.github/workflows/ci.yml` and includes:

- **Lint**: Code quality checks
- **Type Check**: TypeScript validation
- **Test**: Unit and integration tests
- **Build**: Application build
- **Security Scan**: Vulnerability scanning
- **Docker Build**: Container image creation
- **Deploy**: Automated deployment to staging/production

### 2. Configure GitHub Secrets

Add the following secrets to your GitHub repository:

```bash
# Docker Hub credentials
DOCKER_USERNAME=your-docker-username
DOCKER_PASSWORD=your-docker-password

# Kubernetes configurations
KUBE_CONFIG_STAGING=<base64-encoded-kubeconfig-staging>
KUBE_CONFIG_PRODUCTION=<base64-encoded-kubeconfig-production>

# Slack webhook for notifications
SLACK_WEBHOOK=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

### 3. Encode Kubeconfig

```bash
# Encode kubeconfig for GitHub secrets
cat ~/.kube/config-staging | base64 -w 0
cat ~/.kube/config-production | base64 -w 0
```

### 4. Trigger Deployment

Deployments are triggered automatically:

- **Staging**: Push to `develop` branch
- **Production**: Push to `main` branch

Manual deployment:
```bash
# Trigger workflow manually
gh workflow run ci.yml --ref main
```

## Kubernetes Deployment

### 1. Create Namespace

```bash
kubectl apply -f k8s/namespace.yaml
```

### 2. Configure Secrets

```bash
# Create database secrets
kubectl create secret generic tradewise-secrets \
  --from-literal=DATABASE_URL="postgresql://user:password@postgres:5432/tradewise" \
  --from-literal=MONGODB_USER="tradewise" \
  --from-literal=MONGODB_PASSWORD="your-password" \
  --from-literal=JWT_SECRET="your-jwt-secret" \
  --from-literal=JWT_REFRESH_SECRET="your-refresh-secret" \
  --from-literal=OPENAI_API_KEY="your-openai-key" \
  --from-literal=SENTRY_DSN="https://your-sentry-dsn" \
  --from-literal=POSTGRES_EXPORTER_DSN="postgresql://exporter:password@postgres:5432/tradewise?sslmode=disable" \
  --from-literal=MONGODB_EXPORTER_URI="mongodb://exporter:password@mongodb:27017" \
  -n tradewise
```

### 3. Configure ConfigMaps

```bash
kubectl apply -f k8s/configmap.yaml
```

### 4. Deploy Applications

```bash
# Deploy backend
kubectl apply -f k8s/backend-deployment.yaml

# Deploy frontend
kubectl apply -f k8s/frontend-deployment.yaml

# Deploy ingress
kubectl apply -f k8s/ingress.yaml
```

### 5. Verify Deployment

```bash
# Check pod status
kubectl get pods -n tradewise

# Check services
kubectl get svc -n tradewise

# Check ingress
kubectl get ingress -n tradewise

# View logs
kubectl logs -f -n tradewise deployment/tradewise-backend
kubectl logs -f -n tradewise deployment/tradewise-frontend
```

### 6. Database Migration

```bash
# Run database migrations
kubectl exec -it -n tradewise deployment/tradewise-backend -- pnpm run db:migrate:deploy

# Seed database (optional)
kubectl exec -it -n tradewise deployment/tradewise-backend -- pnpm run db:seed
```

## Monitoring Setup

### 1. Deploy Monitoring Stack

```bash
# Deploy Prometheus
kubectl apply -f k8s/monitoring/prometheus-config.yaml

# Deploy Grafana
kubectl apply -f k8s/monitoring/grafana-config.yaml

# Deploy Exporters
kubectl apply -f k8s/monitoring/exporters.yaml

# Deploy Health Check CronJob
kubectl apply -f k8s/monitoring/health-check-cronjob.yaml
```

### 2. Configure Grafana

```bash
# Port forward to access Grafana
kubectl port-forward -n tradewise svc/grafana 3000:3000

# Open http://localhost:3000
# Default credentials: admin/changeme
```

**Change default password:**
1. Login with default credentials
2. Go to Profile > Change Password
3. Set a strong password

**Import dashboards:**
1. Go to Dashboards > Import
2. Upload dashboard JSON files from `k8s/monitoring/`

### 3. Configure Alertmanager

Update `k8s/monitoring/health-check-cronjob.yaml` with your alert channels:

```yaml
# Slack webhook
slack_api_url: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'

# PagerDuty service key
pagerduty_configs:
- service_key: 'YOUR_PAGERDUTY_SERVICE_KEY'
```

Apply the configuration:
```bash
kubectl apply -f k8s/monitoring/health-check-cronjob.yaml
```

### 4. Verify Monitoring

```bash
# Check Prometheus targets
kubectl port-forward -n tradewise svc/prometheus 9090:9090
# Open http://localhost:9090/targets

# Check metrics endpoint
kubectl port-forward -n tradewise svc/tradewise-backend-service 3000:3000
# Open http://localhost:3000/metrics
```

## Sentry Error Tracking

### 1. Create Sentry Project

1. Go to https://sentry.io
2. Create a new project for TradeWise
3. Copy the DSN

### 2. Configure Sentry

Add Sentry DSN to Kubernetes secrets:
```bash
kubectl create secret generic tradewise-secrets \
  --from-literal=SENTRY_DSN="https://your-sentry-dsn" \
  -n tradewise \
  --dry-run=client -o yaml | kubectl apply -f -
```

### 3. Verify Sentry Integration

```bash
# Check backend logs for Sentry initialization
kubectl logs -n tradewise deployment/tradewise-backend | grep Sentry

# Expected output:
# Sentry initialized for environment: production
```

### 4. Test Error Tracking

Trigger a test error:
```bash
curl -X POST https://api.mytradewiseoc.com/test-error
```

Check Sentry dashboard for the error report.

## Health Checks

### 1. Health Check Endpoints

The backend exposes three health check endpoints:

- **Liveness**: `/health` - Basic server health
- **Readiness**: `/health/ready` - Service dependencies health
- **Full Health**: `/health/full` - Comprehensive health check

### 2. Test Health Checks

```bash
# Liveness check
curl http://api.mytradewiseoc.com/health

# Readiness check
curl http://api.mytradewiseoc.com/health/ready

# Full health check
curl http://api.mytradewiseoc.com/health/full
```

### 3. Automated Health Monitoring

A CronJob runs every minute to check service health:

```bash
# View health check logs
kubectl logs -n tradewise job/health-check-monitor-<timestamp>

# View CronJob status
kubectl get cronjobs -n tradewise
```

## Scaling

### 1. Manual Scaling

```bash
# Scale backend
kubectl scale deployment tradewise-backend --replicas=5 -n tradewise

# Scale frontend
kubectl scale deployment tradewise-frontend --replicas=3 -n tradewise
```

### 2. Horizontal Pod Autoscaling

HPA is configured automatically based on CPU and memory usage:

```bash
# View HPA status
kubectl get hpa -n tradewise

# Expected output:
# NAME                      REFERENCE                        TARGETS         MINPODS   MAXPODS   REPLICAS
# tradewise-backend-hpa     Deployment/tradewise-backend     45%/70%         3         10        3
# tradewise-frontend-hpa    Deployment/tradewise-frontend    30%/70%         2         5         2
```

### 3. Load Testing

```bash
# Install k6
brew install k6  # macOS
# or download from https://k6.io/

# Run load test
k6 run scripts/load-test.js
```

## Rollback

### 1. View Deployment History

```bash
kubectl rollout history deployment/tradewise-backend -n tradewise
```

### 2. Rollback to Previous Version

```bash
# Rollback backend
kubectl rollout undo deployment/tradewise-backend -n tradewise

# Rollback to specific revision
kubectl rollout undo deployment/tradewise-backend --to-revision=2 -n tradewise
```

### 3. Verify Rollback

```bash
kubectl rollout status deployment/tradewise-backend -n tradewise
```

## Troubleshooting

### Pod Not Starting

```bash
# Check pod status
kubectl describe pod <pod-name> -n tradewise

# Check logs
kubectl logs <pod-name> -n tradewise

# Check events
kubectl get events -n tradewise --sort-by='.lastTimestamp'
```

### Database Connection Issues

```bash
# Test database connection
kubectl exec -it -n tradewise deployment/tradewise-backend -- \
  node -e "require('./dist/lib/prisma').prisma.\$connect().then(() => console.log('Connected')).catch(console.error)"
```

### High Memory Usage

```bash
# Check memory usage
kubectl top pods -n tradewise

# Increase memory limits
kubectl set resources deployment/tradewise-backend \
  --limits=memory=2Gi \
  -n tradewise
```

### Slow Response Times

```bash
# Check Prometheus metrics
kubectl port-forward -n tradewise svc/prometheus 9090:9090
# Open http://localhost:9090
# Query: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Check database query performance
kubectl exec -it -n tradewise deployment/tradewise-backend -- \
  node -e "require('./dist/lib/prisma').prisma.\$queryRaw\`SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10\`"
```

### Certificate Issues

```bash
# Check certificate
kubectl get certificate -n tradewise

# Describe certificate
kubectl describe certificate tradewise-tls -n tradewise

# Check cert-manager logs
kubectl logs -n cert-manager deployment/cert-manager
```

## Maintenance

### 1. Backup Database

```bash
# PostgreSQL backup
kubectl exec -it -n tradewise <postgres-pod> -- \
  pg_dump -U tradewise tradewise > backup-$(date +%Y%m%d).sql

# MongoDB backup
kubectl exec -it -n tradewise <mongodb-pod> -- \
  mongodump --db tradewise --out /tmp/backup
```

### 2. Update Dependencies

```bash
# Update npm packages
pnpm update

# Update Docker images
docker pull node:20-alpine
docker pull postgres:15-alpine
docker pull redis:7-alpine
docker pull mongo:6
```

### 3. Rotate Secrets

```bash
# Generate new JWT secret
NEW_SECRET=$(openssl rand -base64 32)

# Update secret
kubectl create secret generic tradewise-secrets \
  --from-literal=JWT_SECRET="$NEW_SECRET" \
  -n tradewise \
  --dry-run=client -o yaml | kubectl apply -f -

# Restart pods to pick up new secret
kubectl rollout restart deployment/tradewise-backend -n tradewise
```

## Performance Optimization

### 1. Enable Caching

Ensure Redis is properly configured and caching is enabled:

```bash
# Check Redis connection
kubectl exec -it -n tradewise deployment/tradewise-backend -- \
  node -e "require('./dist/lib/redis').redis.ping().then(console.log)"
```

### 2. Database Optimization

```bash
# Analyze database performance
kubectl exec -it -n tradewise <postgres-pod> -- \
  psql -U tradewise -c "SELECT * FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 10;"

# Create missing indexes
kubectl exec -it -n tradewise deployment/tradewise-backend -- \
  pnpm run db:migrate:deploy
```

### 3. CDN Configuration

Configure CloudFlare or AWS CloudFront for static assets:

1. Point CDN to frontend service
2. Configure caching rules
3. Enable compression
4. Set appropriate cache headers

## Security Checklist

- [ ] Change all default passwords
- [ ] Enable HTTPS/TLS for all services
- [ ] Configure network policies
- [ ] Enable pod security policies
- [ ] Rotate secrets regularly
- [ ] Enable audit logging
- [ ] Configure RBAC properly
- [ ] Scan images for vulnerabilities
- [ ] Enable rate limiting
- [ ] Configure firewall rules

## Support

For issues or questions:
- GitHub Issues: https://github.com/your-org/tradewise/issues
- Documentation: https://docs.mytradewiseoc.com
- Email: support@mytradewiseoc.com
