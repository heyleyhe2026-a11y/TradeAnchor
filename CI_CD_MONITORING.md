# CI/CD 和监控配置文档

本文档描述 TradeWise 平台的 CI/CD 流水线和监控系统的配置和使用。

## 目录

1. [CI/CD 流水线](#cicd-流水线)
2. [Docker 配置](#docker-配置)
3. [Kubernetes 部署](#kubernetes-部署)
4. [Prometheus 监控](#prometheus-监控)
5. [Grafana 可视化](#grafana-可视化)
6. [Sentry 错误追踪](#sentry-错误追踪)
7. [健康检查](#健康检查)
8. [告警配置](#告警配置)

---

## CI/CD 流水线

### GitHub Actions 工作流

位置: `.github/workflows/ci.yml`

#### 工作流阶段

1. **Lint (代码检查)**
   - 运行 ESLint
   - 检查代码格式 (Prettier)

2. **Type Check (类型检查)**
   - 生成 Prisma Client
   - 运行 TypeScript 类型检查

3. **Test (测试)**
   - 启动测试数据库 (PostgreSQL, Redis, MongoDB)
   - 运行数据库迁移
   - 执行单元测试和集成测试
   - 上传代码覆盖率报告到 Codecov

4. **Build (构建)**
   - 构建后端和前端应用
   - 上传构建产物

5. **Security Scan (安全扫描)**
   - 使用 Trivy 扫描文件系统漏洞
   - 运行 npm audit
   - 上传结果到 GitHub Security

6. **Docker Build (Docker 镜像构建)**
   - 构建后端和前端 Docker 镜像
   - 推送到 Docker Hub
   - 扫描镜像漏洞

7. **Deploy Staging (部署到预发布环境)**
   - 触发条件: push 到 `develop` 分支
   - 更新 Kubernetes 部署
   - 运行冒烟测试

8. **Deploy Production (部署到生产环境)**
   - 触发条件: push 到 `main` 分支
   - 更新 Kubernetes 部署
   - 运行冒烟测试
   - 发送 Slack 通知

#### 环境变量配置

需要在 GitHub Secrets 中配置以下变量:

```
DOCKER_USERNAME          # Docker Hub 用户名
DOCKER_PASSWORD          # Docker Hub 密码
KUBE_CONFIG_STAGING      # Staging 环境 Kubernetes 配置
KUBE_CONFIG_PRODUCTION   # Production 环境 Kubernetes 配置
SLACK_WEBHOOK            # Slack Webhook URL (用于通知)
```

#### 触发条件

- **Push**: `main` 或 `develop` 分支
- **Pull Request**: 针对 `main` 或 `develop` 分支

---

## Docker 配置

### 后端 Dockerfile

位置: `Dockerfile.backend`

**特性:**
- 多阶段构建优化镜像大小
- 使用 Node.js 20 Alpine 基础镜像
- 非 root 用户运行 (nodejs:1001)
- 内置健康检查
- 生产依赖优化

**构建命令:**
```bash
docker build -f Dockerfile.backend -t tradewise/backend:latest .
```

### 前端 Dockerfile

位置: `Dockerfile.frontend`

**特性:**
- 多阶段构建
- Nginx Alpine 作为生产服务器
- 非 root 用户运行 (nginx:1001)
- 自定义 Nginx 配置
- 内置健康检查

**构建命令:**
```bash
docker build -f Dockerfile.frontend -t tradewise/frontend:latest .
```

### Docker Compose

位置: `docker-compose.yml`

**服务:**
- PostgreSQL 15
- Redis 7
- MongoDB 6

**使用:**
```bash
# 启动所有服务
docker-compose up -d

# 停止所有服务
docker-compose down

# 查看日志
docker-compose logs -f
```

---

## Kubernetes 部署

### 命名空间

```bash
kubectl apply -f k8s/namespace.yaml
```

### 配置和密钥

1. **ConfigMap** (`k8s/configmap.yaml`)
   - 环境变量配置
   - 应用配置

2. **Secrets** (`k8s/secret.yaml`)
   - 数据库凭证
   - API 密钥
   - JWT 密钥

**创建密钥:**
```bash
kubectl create secret generic tradewise-secrets \
  --from-literal=DATABASE_URL="postgresql://..." \
  --from-literal=JWT_SECRET="..." \
  --from-literal=OPENAI_API_KEY="..." \
  --from-literal=SENTRY_DSN="..." \
  -n tradewise
```

### 部署

#### 后端部署

位置: `k8s/backend-deployment.yaml`

**特性:**
- 3 个副本 (最小)
- 滚动更新策略
- 资源限制: 512Mi-1Gi 内存, 250m-1000m CPU
- 健康检查和就绪探针
- Prometheus 指标注解
- 水平自动扩展 (HPA): 3-10 个副本

**部署命令:**
```bash
kubectl apply -f k8s/backend-deployment.yaml
```

#### 前端部署

位置: `k8s/frontend-deployment.yaml`

**特性:**
- 2 个副本 (最小)
- 滚动更新策略
- 资源限制: 256Mi-512Mi 内存, 100m-500m CPU
- 健康检查和就绪探针
- 水平自动扩展 (HPA): 2-5 个副本

**部署命令:**
```bash
kubectl apply -f k8s/frontend-deployment.yaml
```

### Ingress

位置: `k8s/ingress.yaml`

**配置:**
- HTTPS/TLS 终止
- 路由规则
- 速率限制

**部署命令:**
```bash
kubectl apply -f k8s/ingress.yaml
```

### 验证部署

```bash
# 查看所有资源
kubectl get all -n tradewise

# 查看 Pod 状态
kubectl get pods -n tradewise

# 查看服务
kubectl get svc -n tradewise

# 查看 HPA 状态
kubectl get hpa -n tradewise

# 查看日志
kubectl logs -f deployment/tradewise-backend -n tradewise
```

---

## Prometheus 监控

### 配置

位置: `k8s/monitoring/prometheus-config.yaml`

#### 抓取配置

1. **Kubernetes API Server**
2. **Kubernetes Nodes**
3. **Kubernetes Pods** (带 `prometheus.io/scrape: "true"` 注解)
4. **TradeWise Backend** (自定义指标)
5. **PostgreSQL Exporter**
6. **Redis Exporter**
7. **MongoDB Exporter**
8. **Node Exporter**

#### 告警规则

- **HighErrorRate**: 错误率 > 5% 持续 5 分钟
- **HighResponseTime**: P95 响应时间 > 2 秒
- **PodDown**: Pod 宕机超过 2 分钟
- **HighCPUUsage**: CPU 使用率 > 80% 持续 10 分钟
- **HighMemoryUsage**: 内存使用率 > 90% 持续 5 分钟
- **DatabaseConnectionPoolExhaustion**: 连接池 > 80% 满
- **RedisHighMemoryUsage**: Redis 内存 > 90%
- **RateLimitExceeded**: 速率限制超过 10 次/秒
- **LowSLA**: SLA < 99.5% 持续 10 分钟

### 部署

```bash
kubectl apply -f k8s/monitoring/prometheus-config.yaml
```

### 访问 Prometheus

```bash
# 端口转发
kubectl port-forward -n tradewise svc/prometheus 9090:9090

# 访问 http://localhost:9090
```

### 应用指标

后端应用在 `/metrics` 端点暴露以下指标:

#### HTTP 指标
- `tradewise_http_requests_total`: HTTP 请求总数
- `tradewise_http_request_duration_seconds`: HTTP 请求持续时间
- `tradewise_active_connections`: 活跃连接数

#### 数据库指标
- `tradewise_database_query_duration_seconds`: 数据库查询持续时间
- `tradewise_database_connection_pool_size`: 连接池大小

#### Redis 指标
- `tradewise_redis_operation_duration_seconds`: Redis 操作持续时间

#### AI 指标
- `tradewise_ai_requests_total`: AI 请求总数
- `tradewise_ai_request_duration_seconds`: AI 请求持续时间

#### 业务指标
- `tradewise_authentication_attempts_total`: 认证尝试次数
- `tradewise_subscription_changes_total`: 订阅变更次数
- `tradewise_payment_transactions_total`: 支付交易次数
- `tradewise_trade_records_created_total`: 交易记录创建次数
- `tradewise_rate_limit_exceeded_total`: 速率限制超限次数

---

## Grafana 可视化

### 配置

位置: `k8s/monitoring/grafana-config.yaml`

### 部署

```bash
kubectl apply -f k8s/monitoring/grafana-config.yaml
```

### 访问 Grafana

```bash
# 端口转发
kubectl port-forward -n tradewise svc/grafana 3000:3000

# 访问 http://localhost:3000
# 默认凭证: admin/changeme (生产环境请修改!)
```

### 预配置仪表板

#### TradeWise Platform Overview

包含以下面板:

1. **Request Rate**: 请求速率
2. **Error Rate**: 错误率
3. **Response Time (P95)**: P95 响应时间
4. **CPU Usage**: CPU 使用率
5. **Memory Usage**: 内存使用率
6. **Pod Count**: Pod 数量
7. **Database Connections**: 数据库连接数
8. **Redis Memory Usage**: Redis 内存使用
9. **SLA (Success Rate)**: SLA 成功率

### 自定义仪表板

可以创建自定义仪表板监控:
- 用户活动指标
- 业务 KPI (订阅、交易、AI 使用)
- 支付处理指标
- API 端点性能

---

## Sentry 错误追踪

### 配置

后端已集成 Sentry SDK,位置: `packages/backend/src/lib/sentry.ts`

### 环境变量

```bash
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
NODE_ENV=production
APP_VERSION=1.0.0
```

### 功能

1. **自动错误捕获**
   - 未处理的异常
   - Promise rejections
   - HTTP 错误 (状态码 >= 500)

2. **性能监控**
   - HTTP 请求追踪
   - 数据库查询追踪
   - 性能分析

3. **上下文信息**
   - 用户信息
   - 请求信息
   - 自定义标签

4. **过滤规则**
   - 不发送验证错误
   - 不发送 404 错误
   - 不发送速率限制错误

### 手动使用

```typescript
import { captureException, captureMessage, setUser } from './lib/sentry';

// 捕获异常
try {
  // 代码
} catch (error) {
  captureException(error, { context: 'additional info' });
}

// 捕获消息
captureMessage('Something important happened', 'info');

// 设置用户上下文
setUser({ id: 'user-id', email: 'user@example.com' });
```

### 访问 Sentry

登录 [sentry.io](https://sentry.io) 查看错误报告和性能数据。

---

## 健康检查

### 端点

#### 1. `/health` - 简单健康检查

**用途**: Kubernetes liveness probe

**响应:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:00:00.000Z",
  "uptime": 3600
}
```

#### 2. `/health/ready` - 就绪检查

**用途**: Kubernetes readiness probe

**响应:**
```json
{
  "status": "ready",
  "timestamp": "2024-01-15T10:00:00.000Z"
}
```

#### 3. `/health/detailed` - 详细健康检查

**用途**: 监控和调试

**响应:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:00:00.000Z",
  "uptime": 3600,
  "checks": {
    "database": {
      "status": "healthy",
      "responseTime": 5
    },
    "redis": {
      "status": "healthy",
      "responseTime": 2
    },
    "mongodb": {
      "status": "healthy",
      "responseTime": 3
    }
  }
}
```

### 自动化健康检查

位置: `k8s/monitoring/health-check-cronjob.yaml`

**特性:**
- 每分钟运行一次
- 检查后端、前端、Prometheus、Grafana
- 失败时记录日志

**部署:**
```bash
kubectl apply -f k8s/monitoring/health-check-cronjob.yaml
```

**查看日志:**
```bash
kubectl logs -n tradewise -l app=health-check-monitor
```

---

## 告警配置

### Alertmanager

位置: `k8s/monitoring/health-check-cronjob.yaml`

#### 告警路由

- **Critical**: Slack (#tradewise-critical) + PagerDuty
- **Warning**: Slack (#tradewise-alerts)
- **Info**: Slack (#tradewise-alerts)

#### 配置 Slack Webhook

```bash
kubectl create secret generic alertmanager-secrets \
  --from-literal=SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..." \
  --from-literal=PAGERDUTY_SERVICE_KEY="..." \
  -n tradewise
```

### 部署 Alertmanager

```bash
kubectl apply -f k8s/monitoring/health-check-cronjob.yaml
```

### 访问 Alertmanager

```bash
kubectl port-forward -n tradewise svc/alertmanager 9093:9093
# 访问 http://localhost:9093
```

---

## 性能目标

根据需求 18.1-18.10:

| 指标 | 目标 |
|------|------|
| Landing 页面加载 | P95 < 2 秒 |
| Dashboard 加载 | P95 < 2 秒 |
| AI 追问响应 | P95 < 8 秒 |
| 数据库查询 | P95 < 500 毫秒 |
| 月度 SLA | ≥ 99.5% |
| 并发用户 | 支持 10,000 用户 |
| 健康检查频率 | 每 60 秒 |

---

## 故障排查

### Prometheus 未抓取指标

1. 检查 Pod 注解:
```bash
kubectl get pod <pod-name> -n tradewise -o yaml | grep prometheus.io
```

2. 验证服务发现:
```bash
kubectl exec -it -n tradewise <prometheus-pod> -- wget -O- http://localhost:9090/api/v1/targets
```

### Grafana 仪表板无法加载

1. 检查 Prometheus 数据源:
   - 进入 Configuration > Data Sources
   - 测试 Prometheus 连接

2. 验证 Prometheus 可访问:
```bash
kubectl exec -it -n tradewise <grafana-pod> -- wget -O- http://prometheus:9090/-/healthy
```

### 高内存使用

1. 检查 Prometheus 保留期:
```bash
kubectl logs -n tradewise <prometheus-pod> | grep retention
```

2. 调整保留期 (在 `prometheus-config.yaml`):
```yaml
args:
  - '--storage.tsdb.retention.time=15d'  # 从 30 天减少到 15 天
```

### 缺失指标

1. 检查 exporter 是否运行:
```bash
kubectl get pods -n tradewise | grep exporter
```

2. 查看 exporter 日志:
```bash
kubectl logs -n tradewise <exporter-pod>
```

3. 验证 exporter 指标端点:
```bash
kubectl exec -it -n tradewise <exporter-pod> -- wget -O- http://localhost:<port>/metrics
```

---

## 维护

### 备份 Prometheus 数据

```bash
# 创建备份
kubectl exec -n tradewise <prometheus-pod> -- tar czf /tmp/prometheus-backup.tar.gz /prometheus

# 复制到本地
kubectl cp tradewise/<prometheus-pod>:/tmp/prometheus-backup.tar.gz ./prometheus-backup.tar.gz
```

### 备份 Grafana 仪表板

```bash
# 通过 API 导出仪表板
curl -H "Authorization: Bearer <api-key>" \
  http://grafana.mytradewiseoc.com/api/dashboards/db/<dashboard-slug> > dashboard.json
```

### 更新监控栈

```bash
# 更新 Prometheus
kubectl set image deployment/prometheus prometheus=prom/prometheus:v2.49.0 -n tradewise

# 更新 Grafana
kubectl set image deployment/grafana grafana=grafana/grafana:10.3.0 -n tradewise

# 验证部署
kubectl rollout status deployment/prometheus -n tradewise
kubectl rollout status deployment/grafana -n tradewise
```

---

## 安全考虑

1. **修改默认密码**: 更新 Grafana 管理员密码
2. **启用认证**: 为 Grafana 配置 OAuth 或 LDAP
3. **限制访问**: 使用 NetworkPolicies 限制对监控服务的访问
4. **加密数据**: 为 Prometheus 和 Grafana 启用 TLS
5. **审计日志**: 启用 Grafana 审计日志

---

## 资源

- [Prometheus 文档](https://prometheus.io/docs/)
- [Grafana 文档](https://grafana.com/docs/)
- [Kubernetes 监控指南](https://kubernetes.io/docs/tasks/debug-application-cluster/resource-metrics-pipeline/)
- [Sentry 文档](https://docs.sentry.io/)
- [GitHub Actions 文档](https://docs.github.com/en/actions)

---

## 总结

本配置实现了以下需求 (Requirements 18.4, 18.8, 18.9):

✅ **CI/CD 流水线**
- GitHub Actions 自动化测试、构建、部署
- 多环境支持 (Staging, Production)
- 安全扫描和漏洞检测

✅ **Docker 和 Kubernetes**
- 多阶段 Docker 构建优化
- Kubernetes 部署配置
- 水平自动扩展 (HPA)
- 滚动更新策略

✅ **Prometheus + Grafana 监控**
- 全面的指标收集
- 预配置告警规则
- 可视化仪表板
- 数据库和 Redis 监控

✅ **Sentry 错误追踪**
- 自动错误捕获
- 性能监控
- 用户上下文追踪

✅ **自动化健康检查**
- Kubernetes 健康探针
- 定时健康检查 CronJob
- 多层次健康检查端点

✅ **告警系统**
- Alertmanager 配置
- Slack 和 PagerDuty 集成
- 告警分级和路由
