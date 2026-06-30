/** Broker CSV column mapping presets (Phase 3). */

import { isLotBasedSymbol } from '@tradeanchor/shared';

/** cTrader Closed Positions: Volume is in units (100000 units = 1.00 standard lot). */
export const CTRADER_VOLUME_UNITS_PER_LOT = 100_000;

export type BrokerPresetKey =
  | 'generic'
  | 'mt4'
  | 'mt5'
  | 'ctrader'
  | 'ibkr'
  | 'schwab'
  | 'futu'
  | 'tiger';

export interface BrokerPreset {
  key: BrokerPresetKey;
  label: string;
  labelZh: string;
  defaultTimezone: string;
  defaultQuoteCurrency: string;
  /** Fixed header row index when auto-detect is not used. */
  headerRowIndex?: number;
  /** MT4/MT5 account history uses duplicated Time/Price columns for open vs close. */
  duplicateOpenCloseColumns?: boolean;
  /** Default position direction when export has no direction column. */
  defaultDirection?: 'long' | 'short';
  /** Closing transaction side: SELL => long, BUY => short (IBKR closed lots). */
  inferDirectionFromClosingSide?: boolean;
  /** MT4/MT5/cTrader exports omit leverage — default display leverage (1x baseline margin). */
  defaultLeverage?: number;
  /** When set, Volume column is raw units — divide by this to get MT-style lots. */
  volumeUnitsPerLot?: number;
  /** P&L column is net of commission/swap (MT4/MT5 Profit); import converts to gross. */
  pnlColumnIsNet?: boolean;
  /** Maps TARGET_FIELDS key → common header aliases (case-insensitive exact match). */
  columnAliases: Record<string, string[]>;
  derivedFields?: {
    entryPrice?: { numerator: 'costBasis'; denominator: 'quantity' };
    exitPrice?: { numerator: 'proceeds'; denominator: 'quantity' };
  };
  helperFields?: Record<'costBasis' | 'proceeds', string[]>;
}

export const BROKER_PRESETS: BrokerPreset[] = [
  {
    key: 'generic',
    label: 'Generic CSV',
    labelZh: '通用 CSV',
    defaultTimezone: 'UTC',
    defaultQuoteCurrency: 'USD',
    columnAliases: {},
  },
  {
    key: 'mt4',
    label: 'MetaTrader 4',
    labelZh: 'MetaTrader 4',
    defaultTimezone: 'Europe/Helsinki',
    defaultQuoteCurrency: 'USD',
    defaultLeverage: 1,
    pnlColumnIsNet: true,
    columnAliases: {
      symbol: ['item', 'symbol'],
      direction: ['type', 'direction'],
      entryPrice: ['open price', 'price'],
      exitPrice: ['close price'],
      quantity: ['size', 'volume', 'lots'],
      pnl: ['profit', 'pnl'],
      commission: ['commission', 'fee'],
      swap: ['swap'],
      entryDate: ['open time', 'time'],
      exitDate: ['close time'],
    },
  },
  {
    key: 'mt5',
    label: 'MetaTrader 5',
    labelZh: 'MetaTrader 5',
    defaultTimezone: 'Europe/Helsinki',
    defaultQuoteCurrency: 'USD',
    defaultLeverage: 1,
    pnlColumnIsNet: true,
    duplicateOpenCloseColumns: true,
    columnAliases: {
      symbol: ['symbol', 'item'],
      direction: ['type', 'direction'],
      entryPrice: ['price', 'open price'],
      exitPrice: ['close price', 'price__2'],
      quantity: ['volume', 'lots', 'size'],
      pnl: ['profit', 'pnl'],
      commission: ['commission', 'fee'],
      swap: ['swap'],
      entryDate: ['open time', 'time'],
      exitDate: ['close time', 'time__2'],
      leverage: ['leverage'],
    },
  },
  {
    key: 'ctrader',
    label: 'cTrader',
    labelZh: 'cTrader',
    defaultTimezone: 'UTC',
    defaultQuoteCurrency: 'USD',
    defaultLeverage: 1,
    volumeUnitsPerLot: CTRADER_VOLUME_UNITS_PER_LOT,
    columnAliases: {
      symbol: ['symbol', 'instrument'],
      direction: ['direction', 'opening direction', 'side', 'type'],
      entryPrice: ['entry price', 'open price', 'opening price'],
      exitPrice: ['close price', 'closing price', 'exit price'],
      quantity: ['volume', 'qty', 'size', 'lots'],
      pnl: ['gross profit', 'profit', 'pnl', 'net profit'],
      commission: ['commission', 'commissions', 'fee'],
      swap: ['swap', 'swaps'],
      entryDate: ['opening time', 'open time', 'entry time'],
      exitDate: ['closing time', 'close time', 'exit time'],
      quoteCurrency: ['currency', 'deposit currency'],
    },
  },
  {
    key: 'ibkr',
    label: 'Interactive Brokers',
    labelZh: '盈透 IBKR',
    defaultTimezone: 'America/New_York',
    defaultQuoteCurrency: 'USD',
    inferDirectionFromClosingSide: true,
    columnAliases: {
      symbol: ['symbol', 'description'],
      direction: ['buy/sell', 'side'],
      entryPrice: ['open price', 'origtradeprice', 'trade price open'],
      exitPrice: ['close price', 'closeprice', 'trade price', 'tradeprice'],
      quantity: ['quantity', 'qty'],
      pnl: ['realized p/l', 'fifo p/l realized', 'fifopnlrealized', 'pnl', 'p/l'],
      commission: ['ibcommission', 'comm/fee', 'commission'],
      quoteCurrency: ['currencyprimary', 'currency'],
      entryDate: ['opendatetime', 'open date time', 'open time', 'entry date'],
      exitDate: ['date/time', 'datetime', 'trade date', 'close time', 'exit date'],
    },
    helperFields: {
      costBasis: ['costbasis', 'cost basis', 'basis'],
      proceeds: ['proceeds'],
    },
    derivedFields: {
      entryPrice: { numerator: 'costBasis', denominator: 'quantity' },
      exitPrice: { numerator: 'proceeds', denominator: 'quantity' },
    },
  },
  {
    key: 'schwab',
    label: 'Charles Schwab',
    labelZh: 'Charles Schwab',
    defaultTimezone: 'America/New_York',
    defaultQuoteCurrency: 'USD',
    defaultDirection: 'long',
    columnAliases: {
      symbol: ['symbol', 'instrument'],
      direction: ['action', 'side'],
      entryPrice: ['cost per share', 'open price', 'buy price', 'price'],
      exitPrice: ['proceeds per share', 'close price', 'sell price'],
      quantity: ['quantity', 'qty'],
      pnl: ['gain/loss ($)', 'gain/loss', 'gain loss', 'realized gain/loss'],
      commission: ['fees', 'fees & comm', 'commission'],
      entryDate: ['acquired/opened date', 'acquired date', 'opened date', 'open date', 'trade date'],
      exitDate: ['closed date/time', 'closed date', 'close date'],
    },
  },
  {
    key: 'futu',
    label: 'Futu / Moomoo',
    labelZh: '富途 / Moomoo',
    defaultTimezone: 'Asia/Hong_Kong',
    defaultQuoteCurrency: 'USD',
    defaultDirection: 'long',
    columnAliases: {
      symbol: ['代码', '股票代码', 'symbol', 'ticker', 'code'],
      direction: ['方向', '操作', 'side', 'direction', '买卖'],
      entryPrice: ['买入均价', '买入成本', '开仓均价', 'entry price', 'buy price', 'open price'],
      exitPrice: ['卖出均价', '平仓均价', 'exit price', 'sell price', 'close price'],
      quantity: ['成交数量', '数量', 'quantity', 'qty', 'shares'],
      pnl: ['已实现盈亏', '盈亏', 'pnl', 'profit', 'realized p/l'],
      commission: ['合计费用', '费用', 'commission', 'fees', '手续费'],
      quoteCurrency: ['币种', 'currency'],
      entryDate: ['建仓时间', '买入时间', '开仓时间', 'entry time', 'open time'],
      exitDate: ['平仓时间', '卖出时间', 'close time', 'exit time'],
    },
  },
  {
    key: 'tiger',
    label: 'Tiger Brokers',
    labelZh: '老虎证券',
    defaultTimezone: 'Asia/Hong_Kong',
    defaultQuoteCurrency: 'USD',
    defaultDirection: 'long',
    columnAliases: {
      symbol: ['代码', '股票代码', 'symbol', 'ticker', 'code'],
      direction: ['方向', '操作', 'side', 'direction'],
      entryPrice: ['买入均价', '成本价', '开仓价', 'entry price', 'buy price'],
      exitPrice: ['卖出均价', '平仓价', 'exit price', 'sell price'],
      quantity: ['成交数量', '数量', 'quantity', 'qty'],
      pnl: ['已实现盈亏', '盈亏', 'pnl', 'profit'],
      commission: ['合计费用', '费用', 'commission', 'fees'],
      quoteCurrency: ['币种', 'currency'],
      entryDate: ['建仓时间', '开仓时间', 'entry time', 'open time'],
      exitDate: ['平仓时间', 'close time', 'exit time'],
    },
  },
];

export function getBrokerPreset(key: BrokerPresetKey): BrokerPreset {
  return BROKER_PRESETS.find((p) => p.key === key) ?? BROKER_PRESETS[0];
}

function findHeaderIndex(headers: string[], aliases: string[]): number {
  const lowerHeaders = headers.map((h) => h.toLowerCase().trim());
  for (const alias of aliases) {
    const idx = lowerHeaders.indexOf(alias.toLowerCase());
    if (idx >= 0) return idx;
  }
  return -1;
}

/** Auto-map CSV headers using preset aliases. */
export function autoMapColumns(headers: string[], preset: BrokerPreset): Record<string, string> {
  const mapping: Record<string, string> = {};
  const usedHeaders = new Set<string>();

  const tryMap = (field: string, aliases: string[]) => {
    for (const alias of aliases) {
      const idx = headers.findIndex(
        (h, i) =>
          !usedHeaders.has(headers[i]) &&
          h.toLowerCase().trim() === alias.toLowerCase(),
      );
      if (idx >= 0) {
        mapping[field] = headers[idx];
        usedHeaders.add(headers[idx]);
        return;
      }
    }
  };

  for (const [field, aliases] of Object.entries(preset.columnAliases)) {
    tryMap(field, aliases);
  }

  if (preset.helperFields) {
    for (const [field, aliases] of Object.entries(preset.helperFields)) {
      tryMap(field, aliases);
    }
  }

  if (preset.duplicateOpenCloseColumns) {
    if (!mapping.entryDate) {
      const idx = findHeaderIndex(headers, ['time']);
      if (idx >= 0 && !usedHeaders.has(headers[idx])) {
        mapping.entryDate = headers[idx];
        usedHeaders.add(headers[idx]);
      }
    }
    if (!mapping.exitDate) {
      const idx = findHeaderIndex(headers, ['time__2']);
      if (idx >= 0) mapping.exitDate = headers[idx];
    }
    if (!mapping.entryPrice) {
      const idx = findHeaderIndex(headers, ['price']);
      if (idx >= 0 && !usedHeaders.has(headers[idx])) {
        mapping.entryPrice = headers[idx];
        usedHeaders.add(headers[idx]);
      }
    }
    if (!mapping.exitPrice) {
      const idx = findHeaderIndex(headers, ['price__2']);
      if (idx >= 0) mapping.exitPrice = headers[idx];
    }
  }

  return mapping;
}

export function resolveDirection(
  rawDirection: string,
  preset: BrokerPreset,
): 'long' | 'short' | null {
  const lower = rawDirection.toLowerCase().trim();

  if (preset.inferDirectionFromClosingSide) {
    if (lower === 'sell') return 'long';
    if (lower === 'buy') return 'short';
  }

  if (['long', 'buy', 'b', '多', '多头', '做多', 'l', '买入', '买'].includes(lower)) return 'long';
  if (['short', 'sell', 's', '空', '空头', '做空', '卖出', '卖'].includes(lower)) return 'short';

  return preset.defaultDirection ?? null;
}

/** Normalize broker fee signs; MT platforms report Profit net of fees. */
export function normalizeBrokerImportAmounts(
  presetKey: BrokerPresetKey,
  amounts: { pnl?: number; commission?: number; swap?: number },
): { pnl?: number; commission?: number; swap?: number } {
  let { pnl, commission, swap } = amounts;

  if (commission != null) commission = Math.abs(commission);
  if (swap != null) swap = Math.abs(swap);

  const preset = getBrokerPreset(presetKey);
  if (preset.pnlColumnIsNet && pnl != null && (commission != null || swap != null)) {
    pnl = pnl + (commission ?? 0) + (swap ?? 0);
  }

  return { pnl, commission, swap };
}

/**
 * cTrader exports Volume in units (e.g. 100000 = 1 lot); MT4 uses lots (1.00).
 * Only converts forex/metals when value looks like units, not already in lots.
 */
export function normalizeBrokerImportQuantity(
  preset: BrokerPreset,
  symbol: string,
  quantity: number,
): number {
  const unitsPerLot = preset.volumeUnitsPerLot;
  if (!unitsPerLot || quantity <= 0) return quantity;

  const sym = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!isLotBasedSymbol(sym)) return quantity;

  // Already in lots (e.g. 0.5, 1.5, 2) — skip
  if (quantity < unitsPerLot / 100) return quantity;

  return quantity / unitsPerLot;
}

export function resolveDerivedPrice(
  field: 'entryPrice' | 'exitPrice',
  preset: BrokerPreset,
  values: Record<string, string | number | null | undefined>,
  parseNumber: (value: string) => number | null,
): number | undefined {
  const rule = preset.derivedFields?.[field];
  if (!rule) return undefined;

  const numerator = values[rule.numerator];
  const denominator = values[rule.denominator];
  if (typeof numerator === 'number' && typeof denominator === 'number' && denominator !== 0) {
    return Math.abs(numerator / denominator);
  }

  const numRaw = typeof numerator === 'string' ? numerator : '';
  const denRaw = typeof denominator === 'string' ? denominator : '';
  const num = parseNumber(numRaw);
  const den = parseNumber(denRaw);
  if (num == null || den == null || den === 0) return undefined;
  return Math.abs(num / den);
}
