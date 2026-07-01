/** Map user / broker symbols to Twelve Data ticker format. */

const INDEX_MAP: Record<string, string> = {
  SPX500: 'SPX',
  US500: 'SPX',
  NAS100: 'NDX',
  US100: 'NDX',
  US30: 'DJI',
  DJ30: 'DJI',
};

const ALIAS_MAP: Record<string, string> = {
  GOLD: 'XAU/USD',
  XAUUSD: 'XAU/USD',
  SILVER: 'XAG/USD',
  XAGUSD: 'XAG/USD',
  BTCUSD: 'BTC/USD',
  ETHUSD: 'ETH/USD',
};

export function normalizeUserSymbol(symbol: string): string {
  return symbol.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function toTwelveDataSymbol(symbol: string): string {
  const raw = symbol.trim().toUpperCase();
  if (raw.includes('/')) return raw;

  const compact = normalizeUserSymbol(symbol);
  if (ALIAS_MAP[compact]) return ALIAS_MAP[compact];
  if (INDEX_MAP[compact]) return INDEX_MAP[compact];

  if (compact.endsWith('USDT') && compact.length > 4) {
    return `${compact.slice(0, -4)}/USDT`;
  }
  if (compact.endsWith('USD') && compact.length > 3 && compact !== 'USDC' && compact !== 'USDT') {
    const base = compact.slice(0, -3);
    if (base.length >= 2) return `${base}/USD`;
  }
  if (/^[A-Z]{6}$/.test(compact)) {
    return `${compact.slice(0, 3)}/${compact.slice(3)}`;
  }

  return compact;
}

export type ChartInterval =
  | 'M1' | 'M5' | 'M15' | 'M30' | 'H1' | 'H4' | 'D1' | 'W1';

const INTERVAL_TO_TWELVE: Record<ChartInterval, string> = {
  M1: '1min',
  M5: '5min',
  M15: '15min',
  M30: '30min',
  H1: '1h',
  H4: '4h',
  D1: '1day',
  W1: '1week',
};

const VALID_INTERVALS = new Set<string>(Object.keys(INTERVAL_TO_TWELVE));

export function parseChartInterval(value: string): ChartInterval | null {
  const upper = value.trim().toUpperCase();
  return VALID_INTERVALS.has(upper) ? (upper as ChartInterval) : null;
}

export function toTwelveDataInterval(interval: ChartInterval): string {
  return INTERVAL_TO_TWELVE[interval];
}

export function cacheTtlSeconds(interval: ChartInterval): number {
  switch (interval) {
    case 'M1': return 60;
    case 'M5': return 120;
    case 'M15': return 180;
    case 'M30': return 300;
    case 'H1': return 300;
    case 'H4': return 600;
    case 'D1': return 1800;
    case 'W1': return 3600;
    default: return 300;
  }
}

export function defaultOutputSize(interval: ChartInterval): number {
  switch (interval) {
    case 'M1':
    case 'M5':
      return 300;
    case 'M15':
    case 'M30':
      return 250;
    case 'H1':
    case 'H4':
      return 200;
    default:
      return 150;
  }
}

export interface LocalSymbolHit {
  symbol: string;
  providerSymbol: string;
  name: string;
  exchange: string;
}

const LOCAL_CATALOG: LocalSymbolHit[] = [
  { symbol: 'XAUUSD', providerSymbol: 'XAU/USD', name: 'Gold Spot', exchange: 'FOREX' },
  { symbol: 'XAGUSD', providerSymbol: 'XAG/USD', name: 'Silver Spot', exchange: 'FOREX' },
  { symbol: 'EURUSD', providerSymbol: 'EUR/USD', name: 'Euro / US Dollar', exchange: 'FOREX' },
  { symbol: 'GBPUSD', providerSymbol: 'GBP/USD', name: 'British Pound / US Dollar', exchange: 'FOREX' },
  { symbol: 'USDJPY', providerSymbol: 'USD/JPY', name: 'US Dollar / Japanese Yen', exchange: 'FOREX' },
  { symbol: 'AUDUSD', providerSymbol: 'AUD/USD', name: 'Australian Dollar / US Dollar', exchange: 'FOREX' },
  { symbol: 'USDCAD', providerSymbol: 'USD/CAD', name: 'US Dollar / Canadian Dollar', exchange: 'FOREX' },
  { symbol: 'USDCHF', providerSymbol: 'USD/CHF', name: 'US Dollar / Swiss Franc', exchange: 'FOREX' },
  { symbol: 'NZDUSD', providerSymbol: 'NZD/USD', name: 'New Zealand Dollar / US Dollar', exchange: 'FOREX' },
  { symbol: 'BTCUSD', providerSymbol: 'BTC/USD', name: 'Bitcoin / US Dollar', exchange: 'CRYPTO' },
  { symbol: 'ETHUSD', providerSymbol: 'ETH/USD', name: 'Ethereum / US Dollar', exchange: 'CRYPTO' },
  { symbol: 'NAS100', providerSymbol: 'NDX', name: 'NASDAQ 100', exchange: 'INDEX' },
  { symbol: 'US500', providerSymbol: 'SPX', name: 'S&P 500', exchange: 'INDEX' },
  { symbol: 'US30', providerSymbol: 'DJI', name: 'Dow Jones Industrial Average', exchange: 'INDEX' },
  { symbol: 'SPX500', providerSymbol: 'SPX', name: 'S&P 500', exchange: 'INDEX' },
];

function rankLocalMatch(item: LocalSymbolHit, qCompact: string, qRaw: string): number {
  const compact = normalizeUserSymbol(item.symbol);
  const providerCompact = normalizeUserSymbol(item.providerSymbol);
  const nameUpper = item.name.toUpperCase();
  if (compact === qCompact || providerCompact === qCompact) return 0;
  if (compact.startsWith(qCompact) || providerCompact.startsWith(qCompact)) return 1;
  if (nameUpper.startsWith(qRaw)) return 2;
  if (compact.includes(qCompact) || providerCompact.includes(qCompact) || nameUpper.includes(qRaw)) return 3;
  return 99;
}

/** Fuzzy match against common broker symbols and optional user trade symbols. */
export function searchLocalSymbols(query: string, extraSymbols: string[] = []): LocalSymbolHit[] {
  const qRaw = query.trim().toUpperCase();
  const qCompact = normalizeUserSymbol(query);
  if (!qCompact) return [];

  const pool: LocalSymbolHit[] = [...LOCAL_CATALOG];
  const seen = new Set(pool.map((item) => normalizeUserSymbol(item.symbol)));

  for (const sym of extraSymbols) {
    const compact = normalizeUserSymbol(sym);
    if (!compact || seen.has(compact)) continue;
    seen.add(compact);
    pool.push({
      symbol: sym.trim().toUpperCase(),
      providerSymbol: toTwelveDataSymbol(sym),
      name: sym.trim().toUpperCase(),
      exchange: 'TRADES',
    });
  }

  return pool
    .map((item) => ({ item, rank: rankLocalMatch(item, qCompact, qRaw) }))
    .filter(({ rank }) => rank < 99)
    .sort((a, b) => a.rank - b.rank || a.item.symbol.localeCompare(b.item.symbol))
    .slice(0, 12)
    .map(({ item }) => item);
}
