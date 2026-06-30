# Phase 1 数据库迁移与 FX 种子数据

本文说明如何应用 **Phase 1** Schema 变更（货币/时区/导入字段 + `fx_rates` 表），以及如何填充汇率数据。

## 前置条件

1. PostgreSQL 已运行且可连接
2. `packages/backend/.env` 中已配置 `DATABASE_URL`，例如：

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tradewise?schema=public
```

3. 已安装依赖（仓库根目录）：

```bash
pnpm install
```

## 步骤 1：生成 Prisma Client

```bash
pnpm --filter @tradeanchor/backend db:generate
```

## 步骤 2：执行迁移

### 开发环境（会记录迁移历史）

```bash
pnpm --filter @tradeanchor/backend db:migrate
```

若提示迁移名，可使用：`phase1_trade_currency_timezone`

### 生产 / CI（只 apply，不交互）

```bash
pnpm --filter @tradeanchor/backend db:migrate:deploy
```

### 迁移内容摘要

| 对象 | 变更 |
|------|------|
| `trades` | `quote_currency`, `swap`, `pnl_source`, 导入元数据字段 |
| `user_preferences` | `calendar_day_basis`, `leaderboard_opt_in` |
| `fx_rates` | 新建日汇率表 |
| 枚举 | `PnlSource` (`calculated` / `broker`) |

历史数据兜底：

- 已有交易的 `quote_currency` → `USD`
- 已有交易的 `pnl_source` → `calculated`
- 已有偏好的 `calendar_day_basis` → `exit`

## 步骤 3：填充 FX 汇率（推荐）

跨币种 Dashboard / 排行榜依赖 `fx_rates` 表。迁移**不会**自动写入汇率。

### 在线拉取（Frankfurter / ECB，默认最近 30 天）

```bash
pnpm --filter @tradeanchor/backend db:seed:fx
```

### 指定天数

```bash
pnpm --filter @tradeanchor/backend db:seed:fx -- --days 90
```

### 离线 / 无网络（固定参考汇率）

```bash
pnpm --filter @tradeanchor/backend db:seed:fx -- --source manual --days 30
```

脚本会写入 `USD` 及 `EUR, GBP, JPY, CNY, HKD, AUD, CAD, CHF, SGD` 之间的日汇率，可重复执行（upsert）。

## 步骤 4：验证

```bash
# 查看 fx_rates 行数
pnpm --filter @tradeanchor/backend db:studio
```

或通过 API（需登录 token）：

```http
GET /api/v1/fx/rate?from=EUR&to=USD&date=2024-06-01
```

## 常见问题

### `type "PnlSource" already exists`

说明枚举已创建。若迁移中断，可手动检查 `_prisma_migrations` 表后重跑 `db:migrate:deploy`，或联系维护者处理半完成状态。

### `relation "fx_rates" does not exist`

迁移未成功执行。先完成步骤 2，再跑 FX seed。

### Dashboard 仍显示未换算金额

1. 确认 `db:seed:fx` 已成功
2. 确认交易 `quote_currency` 与 `baseCurrency` 不同
3. 确认交易日期在 seed 覆盖范围内（默认最近 30 天）

### 仅使用 USD 交易

可跳过 FX seed；Dashboard / 排行榜对 USD 交易无需换算。

## 推荐执行顺序（一键清单）

```bash
pnpm --filter @tradeanchor/backend db:generate
pnpm --filter @tradeanchor/backend db:migrate:deploy
pnpm --filter @tradeanchor/backend db:seed:fx
pnpm --filter @tradeanchor/backend dev
```
