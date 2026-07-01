# 导入样例 CSV（券商原始导出格式）

用于验证 **交易记录 → 导入** 各券商 Preset 的**零手工改列**导入流程。  
样例文件刻意模拟各平台真实导出结构（含多余列、重复列名、账户前缀行等），上传后选择对应 Preset 即可自动映射。

## 支持的平台 Preset

| Preset | 样例文件 | 模拟来源 |
|--------|----------|----------|
| Generic CSV | `generic-trades.csv` | TradeWise 通用模板（对照用） |
| MetaTrader 4 | `mt4-trades.csv` | MT4 账户历史 → 右键 Save as Report / 订单导出 |
| MetaTrader 5 | `mt5-trades.csv` | MT5 账户历史 Report（含重复 Time/Price 列） |
| cTrader | `ctrader-trades.csv` | cTrader 历史 → Closed Positions 导出 |
| Interactive Brokers | `ibkr-trades.csv` | IBKR Flex Query → Trades → Closed Lots |
| Charles Schwab | `schwab-trades.csv` | Schwab Realized Gain/Loss（含账户前缀行） |
| 富途 / Moomoo | `futu-trades.csv` | 富途牛牛 → 已实现盈亏明细（中文列名 + 前缀行） |
| 老虎证券 | `tiger-trades.csv` | 老虎证券 → 已实现盈亏（中文列名 + 前缀行） |

## 手动验证步骤

1. 启动前后端：`pnpm dev`（根目录）
2. 登录测试账号（见 `packages/backend/prisma/seed.ts`）
3. 打开 http://localhost:5173/app/trades → **导入**
4. 选择对应 **Broker / Platform**（必须与上表一致）
5. 上传 CSV → 确认列映射已自动匹配 → 导入
6. 在 Dashboard / 交易列表核对 net PnL 与 ROI

## 各 Preset 要点

### MetaTrader 4 / 5
- **MT4**：独立列 `Open Time` / `Close Time`、`Open Price` / `Close Price`，`Item` → 代码
- **MT5**：重复列名 `Time`、`Price` → 自动识别为 `Time__2` / `Price__2`

### cTrader
- `Direction`（Buy/Sell）、`Opening Time` / `Closing Time`、`Gross profit` 等原生列名
- **`Volume` 为单位数**（100000 = 1.00 标准手），导入时自动 ÷100000 转为手数；MT4 的 `Size` 已是手数，无需换算

### 富途 / 老虎证券
- 自动跳过前几行账户/导出信息
- 中文列名：`代码`、`建仓时间`、`买入均价`、`已实现盈亏` 等
- 默认方向为 **long**（股票已平仓记录）

### Interactive Brokers / Schwab
- 见各 Preset 说明（Closed Lots / Realized G/L）

## 测试账号

运行 `pnpm db:seed` 后会创建三个本地测试账号（见 `packages/backend/prisma/seed.ts`）：

| 邮箱 | 套餐 |
|------|------|
| `free@example.com` | Free |
| `pro@example.com` | Pro |
| `premium@example.com` | Premium |

密码由环境变量 `SEED_PASSWORD` 控制，默认 `ChangeMeInDev123!`（仅用于本地开发）。

## 说明与后续计划

- 当前 Preset 覆盖 **8 个主流平台** + Generic 通用模板。
- 样例均为 **已平仓 round-trip**（一行一笔完整交易）。
- 尚未支持：逐笔成交自动配对（如富途/老虎「成交明细」、IBKR Executions）、用户自定义映射模板。
- 计划扩展：TradingView、Binance、OANDA、盈透以外更多 A 股券商等 — 可按用户需求继续添加。

- 日期需在**最近 1 年内**（后端校验）；样例均为 2026 年 5 月。
