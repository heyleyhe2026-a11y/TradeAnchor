/**
 * MT4/MT5/cTrader "Volume" is in lots — map symbol → units per lot for margin/notional.
 * Stocks and generic CSV use contract size 1 (quantity = shares).
 */

const METAL_CONTRACTS: Record<string, number> = {
  XAUUSD: 100,
  GOLD: 100,
  XAGUSD: 5000,
  SILVER: 5000,
};

const FOREX_LOT = 100_000;

function normalizeSymbol(symbol: string): string {
  return symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Units per 1.0 lot (MT4 Volume). Returns 1 for equities / unknown. */
export function getContractSize(symbol: string): number {
  const s = normalizeSymbol(symbol);
  if (METAL_CONTRACTS[s]) return METAL_CONTRACTS[s];
  if (/^[A-Z]{6}$/.test(s)) return FOREX_LOT;
  return 1;
}

/** True when quantity should be interpreted as MT lots (forex/metals). */
export function isLotBasedSymbol(symbol: string): boolean {
  return getContractSize(symbol) > 1;
}

/**
 * Margin / capital at risk for ROI denominator.
 * Forex & metals use standard lot contract sizes; equities use price × shares.
 */
export function calculateMarginInvestment(
  entryPrice: number,
  quantity: number,
  leverage?: number | null,
  symbol?: string,
): number {
  const lv = leverage != null && leverage > 0 ? leverage : 1;
  if (!symbol) {
    return (entryPrice * quantity) / lv;
  }

  const sym = normalizeSymbol(symbol);
  const contractSize = getContractSize(sym);

  if (contractSize === FOREX_LOT) {
    // USD-quoted JPY pairs: margin in USD ≈ lots × 100k / leverage (price is JPY per USD)
    if (sym.startsWith('USD') && sym.endsWith('JPY')) {
      return (quantity * contractSize) / lv;
    }
    // Other majors/crosses: notional in quote currency
    return (quantity * contractSize * entryPrice) / lv;
  }

  if (contractSize > 1) {
    return (entryPrice * quantity * contractSize) / lv;
  }

  return (entryPrice * quantity) / lv;
}
