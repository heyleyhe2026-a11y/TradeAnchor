# TradeWise Monitoring & Observability

This directory contains the monitoring and observability configuration for the TradeWise platform.

## Components

### 1. Prometheus
- **Purpose**: Metrics collection and alerting
- **Port**: 9090
- **Configuration**: `prometheus-config.yaml`
- **Features**:
  - Scrapes metrics from all pods with `prometheus.io/scrape: "true"` annotation
  - Monitors backend, frontend, databases (PostgreSQL, Redis, MongoDB)
  - Collects node metrics via node-exporter
  - Evaluates alerting rules every 30 seconds
  - Retains data for 30 days

### 2. Grafana
- **Purpose**: Metrics visualization and dashboards
- **Port**: 3000
- **Configuration**: `grafana-config.yaml`
- **Default Credentials**: admin/changeme (CHANGE IN PRODUCTION!)
- **Features**:
  - Pre-configured Prometheus datasource
  - TradeWise Platform Overview dashboard
  - Real-time metrics visualization
  - Alerting integration

### 3. Exporters
- **PostgreSQL Exporter**: Port 9187
- **Redis Exporter**: Port 9121
- **MongoDB Exporter**: Port 9216
- **Node Exporter**: Port 9100 (DaemonSet on all nodes)

### 4. Alertmanager
- **Purpose**: Alert routing and notification
- **Port**: 9093
- **Configuration**: `health-check-cronjob.yaml`
- **Features**:
  - Slack notifications
  - PagerDuty integration for critical alerts
  - Alert grouping and deduplication

### 5. Health Check CronJob
- **Purpose**: Automated health monitoring
- **Schedule**: Every minute
- **Checks**:
  - Backend health and readiness
  - Frontend health
  - Prometheus health
  - Grafana health

## Deployment

### Prerequisites
1. Kubernetes cluster with kubectl configured
2. Namespace `tradewise` created
3. Secrets configured (see below)

### Required Secrets

Create the following secrets before deploying:

```bash
# Grafana admin credentials
kubectl create secret generic grafana-secrets \
  --from-literal=admin-user=admin \
  --from-literal=admin-password=<strong-password> \
  -n tradewise

# Database exporter credentials
kubectl create secret generic tradewise-secrets \
  --from-literal=POSTGRES_EXPORTER_DSN="postgresql://user:password@postgres:5432/tradewise?sslmode=disable" \
  --from-literal=MONGODB_EXPORTER_URI="mongodb://user:password@mongodb:27017" \
  --from-literal=SENTRY_DSN="https://your-sentry-dsn" \
  -n tradewise
```

### Deploy Monitoring Stack

```bash
# Deploy Prometheus
kubectl apply -f prometheus-config.yaml

# Deploy Grafana
kubectl apply -f grafana-config.yaml

# Deploy Exporters
kubectl apply -f exporters.yaml

# Deploy Health Check CronJob and Alertmanager
kubectl apply -f health-check-cronjob.yaml
```

### Verify Deployment

```bash
# Check all monitoring pods are running
kubectl get pods -n tradewise -l app=prometheus
kubectl get pods -n tradewise -l app=grafana
kubectl get pods -n tradewise -l app=postgres-exporter
kubectl get pods -n tradewise -l app=redis-exporter
kubectl get pods -n tradewise -l app=mongodb-exporter

# Check services
kubectl get svc -n tradewise | grep -E "prometheus|grafana"
```

## Accessing Dashboards

### Local Development (Port Forwarding)

```bash
# Access Prometheus
kubectl port-forward -n tradewise svc/prometheus 9090:9090
# Open http://localhost:9090

# Access Grafana
kubectl port-forward -n tradewise svc/grafana 3000:3000
# Open http://localhost:3000

# Access Alertmanager
kubectl port-forward -n tradewise svc/alertmanager 9093:9093
# Open http://localhost:9093
```

### Production (Ingress)

Configure ingress rules for:
- Prometheus: `prometheus.mytradewiseoc.com`
- Grafana: `grafana.mytradewiseoc.com`
- Alertmanager: `alertmanager.mytradewiseoc.com`

## Metrics

### Application Metrics

The TradeWise backend exposes metrics at `/metrics` endpoint:

- **HTTP Metrics**:
  - `http_requests_total`: Total HTTP requests
  - `http_request_duration_seconds`: Request duration histogram
  - `active_connections`: Current active connections

- **Database Metrics**:
  - `database_query_duration_seconds`: Query duration
  - `database_connection_pool_size`: Connection pool state

- **Redis Metrics**:
  - `redis_operation_duration_seconds`: Operation duration

- **AI Metrics**:
  - `ai_requests_total`: Total AI API requests
  - `ai_request_duration_seconds`: AI request duration

- **Business Metrics**:
  - `authentication_attempts_total`: Auth attempts
  - `subscription_changes_total`: Subscription changes
  - `payment_transactions_total`: Payment transactions
  - `trade_records_created_total`: Trade records created
  - `rate_limit_exceeded_total`: Rate limit violations

### Infrastructure Metrics

- **Node Metrics** (via node-exporter):
  - CPU usage
  - Memory usage
  - Disk I/O
  - Network traffic

- **PostgreSQL Metrics**:
  - Connection count
  - Query performance
  - Database size
  - Transaction rate

- **Redis Metrics**:
  - Memory usage
  - Hit/miss ratio
  - Command statistics
  - Connected clients

- **MongoDB Metrics**:
  - Operation counters
  - Connection pool
  - Replication lag
  - Collection statistics

## Alerts

### Critical Alerts
- **HighErrorRate**: Error rate > 5% for 5 minutes
- **PodDown**: Pod unavailable for 2 minutes
- **LowSLA**: SLA below 99.5% for 10 minutes
- **DatabaseConnectionPoolExhaustion**: Connection pool > 80% full

### Warning Alerts
- **HighResponseTime**: P95 response time > 2 seconds
- **HighCPUUsage**: CPU usage > 80% for 10 minutes
- **HighMemoryUsage**: Memory usage > 90% for 5 minutes
- **RedisHighMemoryUsage**: Redis memory > 90%

### Info Alerts
- **RateLimitExceeded**: Rate limit exceeded > 10 times/sec

## Alert Routing

Alerts are routed based on severity:

- **Critical**: Slack (#tradewise-critical) + PagerDuty
- **Warning**: Slack (#tradewise-alerts)
- **Info**: Slack (#tradewise-alerts)

## Grafana Dashboards

### TradeWise Platform Overview
- Request rate and error rate
- Response time (P95)
- CPU and memory usage
- Pod count
- Database connections
- Redis memory usage
- SLA percentage

### Custom Dashboards

Create custom dashboards for:
- User activity metrics
- Business KPIs (subscriptions, trades, AI usage)
- Payment processing metrics
- API endpoint performance

## Performance Targets

Based on requirements 18.1-18.10:

- **Landing Page Load**: P95 < 2 seconds
- **Dashboard Load**: P95 < 2 seconds
- **AI Follow-up Response**: P95 < 8 seconds
- **Database Queries**: P95 < 500 milliseconds
- **Monthly SLA**: ≥ 99.5%
- **Concurrent Users**: Support 10,000 users
- **Health Checks**: Every 60 seconds

## Troubleshooting

### Prometheus Not Scraping Metrics

1. Check pod annotations:
```bash
kubectl get pod <pod-name> -n tradewise -o yaml | grep prometheus.io
```

2. Verify service discovery:
```bash
kubectl exec -it -n tradewise <prometheus-pod> -- wget -O- http://localhost:9090/api/v1/targets
```

### Grafana Dashboard Not Loading

1. Check Prometheus datasource:
   - Go to Configuration > Data Sources
   - Test the Prometheus connection

2. Verify Prometheus is accessible:
```bash
kubectl exec -it -n tradewise <grafana-pod> -- wget -O- http://prometheus:9090/-/healthy
```

### High Memory Usage

1. Check Prometheus retention:
```bash
kubectl logs -n tradewise <prometheus-pod> | grep retention
```

2. Adjust retention in `prometheus-config.yaml`:
```yaml
args:
  - '--storage.tsdb.retention.time=15d'  # Reduce from 30d
```

### Missing Metrics

1. Check if exporter is running:
```bash
kubectl get pods -n tradewise | grep exporter
```

2. Check exporter logs:
```bash
kubectl logs -n tradewise <exporter-pod>
```

3. Verify exporter metrics endpoint:
```bash
kubectl exec -it -n tradewise <exporter-pod> -- wget -O- http://localhost:<port>/metrics
```

## Maintenance

### Backup Prometheus Data

```bash
# Create a backup of Prometheus data
kubectl exec -n tradewise <prometheus-pod> -- tar czf /tmp/prometheus-backup.tar.gz /prometheus

# Copy backup to local machine
kubectl cp tradewise/<prometheus-pod>:/tmp/prometheus-backup.tar.gz ./prometheus-backup.tar.gz
```

### Backup Grafana Dashboards

```bash
# Export dashboards via API
curl -H "Authorization: Bearer <api-key>" \
  http://grafana.mytradewiseoc.com/api/dashboards/db/<dashboard-slug> > dashboard.json
```

### Update Monitoring Stack

```bash
# Update Prometheus
kubectl set image deployment/prometheus prometheus=prom/prometheus:v2.49.0 -n tradewise

# Update Grafana
kubectl set image deployment/grafana grafana=grafana/grafana:10.3.0 -n tradewise

# Verify rollout
kubectl rollout status deployment/prometheus -n tradewise
kubectl rollout status deployment/grafana -n tradewise
```

## Security Considerations

1. **Change default passwords**: Update Grafana admin password
2. **Enable authentication**: Configure OAuth or LDAP for Grafana
3. **Restrict access**: Use NetworkPolicies to limit access to monitoring services
4. **Encrypt data**: Enable TLS for Prometheus and Grafana
5. **Audit logs**: Enable audit logging for Grafana

## Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Kubernetes Monitoring Guide](https://kubernetes.io/docs/tasks/debug-application-cluster/resource-metrics-pipeline/)
- [Prometheus Best Practices](https://prometheus.io/docs/practices/)
