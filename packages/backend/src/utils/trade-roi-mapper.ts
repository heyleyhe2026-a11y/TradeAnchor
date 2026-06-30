import type { TradeRoiInput } from '@tradeanchor/shared';
import { isLotBasedSymbol } from '@tradeanchor/shared';

/**
 * MT4/MT5/cTrader margin divisor baked into contract-size investment.
 * Display leverage 1x → notional ÷ 100; display 100x → notional ÷ 10,000.
 */
export const BROKER_LOT_MARGIN_DIVISOR = 100;

const BROKER_IMPORT_SOURCES = new Set(['mt4', 'mt5', 'ctrader']);

/** Minimal trade fields needed for ROI metrics. */
export type TradeRoiSource = {
  tradingSymbol?: string;
  positionDirection: string;
  entryPrice: unknown;
  exitPrice?: unknown | null;
  quantity: unknown;
  leverage?: unknown | null;
  importSource?: string | null;
  pnl?: unknown | null;
  commission?: unknown | null;
  swap?: unknown | null;
};

function isBrokerLotTrade(trade: TradeRoiSource): boolean {
  const src = trade.importSource?.toLowerCase();
  if (src && BROKER_IMPORT_SOURCES.has(src)) return true;
  // Legacy imports before import_source column existed
  return Boolean(trade.tradingSymbol && isLotBasedSymbol(trade.tradingSymbol));
}

/**
 * Leverage passed into margin/investment for broker lot trades:
 * investment = contractNotional / (displayLeverage × 100).
 */
export function resolveEffectiveLeverage(trade: TradeRoiSource): number {
  const raw = trade.leverage != null && Number(trade.leverage) > 0 ? Number(trade.leverage) : 1;

  if (isBrokerLotTrade(trade)) {
    return raw * BROKER_LOT_MARGIN_DIVISOR;
  }

  return raw;
}

export function toTradeRoiInput(trade: TradeRoiSource): TradeRoiInput {
  return {
    direction: trade.positionDirection as 'long' | 'short',
    tradingSymbol: trade.tradingSymbol,
    entryPrice: Number(trade.entryPrice),
    exitPrice: trade.exitPrice != null ? Number(trade.exitPrice) : null,
    quantity: Number(trade.quantity),
    leverage: resolveEffectiveLeverage(trade),
    pnl: trade.pnl != null ? Number(trade.pnl) : null,
    commission: trade.commission != null ? Number(trade.commission) : null,
    swap: trade.swap != null ? Number(trade.swap) : null,
  };
}
