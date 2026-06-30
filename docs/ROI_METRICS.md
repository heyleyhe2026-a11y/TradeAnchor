# TradeWise ROI Metrics (Phase 0)

Unified formulas used by **Dashboard**, **Trading Calendar**, **Return Rate Leaderboard**, and **Trade Records** (net P&L column).

Implementation: `@tradeanchor/shared` → `packages/shared/src/utils/roi.ts`

## Core formulas

```
grossPnL   = stored pnl (or (exit − entry) × qty for long; inverse for short)
netPnL     = grossPnL − commission − swap        // swap = 0 until Phase 1
investment = entryPrice × quantity / leverage   // leverage defaults to 1
roi        = Σ netPnL / Σ investment × 100%
```

**Leverage** scales the ROI denominator (margin / capital at risk) only. It does **not** multiply P&L.

## Where each metric is used

| Surface | P&L shown | ROI basis | Period / grouping |
|---------|-----------|-----------|-------------------|
| Dashboard KPI — Total P&L | **netPnL** (card) | netPnL / investment | Filter: `entryTimestamp` |
| Dashboard — ROI | — | same as above | same |
| Dashboard — Win rate | netPnL > 0 | — | same |
| Dashboard — Profit factor | Σ winning net / \|Σ losing net\| | — | same |
| Trade list — P&L column | gross `pnl` | — | — |
| Trade list — Net P&L | netPnL | — | — |
| Trade form preview | gross (+ net if commission) | — | — |
| Calendar daily/monthly | netPnL | net / investment per day | `entryTimestamp` (UTC date) |
| Return rate leaderboard | — | netPnL / investment | Closed trades by **`exitTimestamp`** |

## API fields (Dashboard)

- `overview.totalPnL` — gross sum (legacy field name)
- `overview.netPnL` — net sum; drives ROI and main P&L card
- `overview.roi` — percentage from netPnL and investment

## Leaderboard API meta

`GET /api/v1/leaderboard/return-rate` includes:

```json
{
  "meta": {
    "formula": "netPnL / (entryPrice × qty / leverage)",
    "periodBasis": "exitTimestamp",
    "pnlIncludesFees": true
  }
}
```

## Phase 1+ (implemented)

- `quoteCurrency`, `swap`, `pnlSource`, import metadata on `Trade`
- User `displayTimezone` / `baseCurrency` / `calendarDayBasis` / `leaderboardOptIn`
- Settings page regional controls
- Import: broker preset, timezone/currency confirmation, dedup by ticket
- Calendar: local timezone day keys + entry/exit basis
- `FxRate` table + `GET /api/v1/fx/rate` (rates must be seeded manually until ECB sync)

## Phase 2 notes

- Dashboard converts to `baseCurrency` when FX rates exist; otherwise falls back to raw sums
- Leaderboard: min 5 trades, min $100 investment, opt-in, platform USD
