import { calculateGrossPnL, calculateNetPnL } from '@tradeanchor/shared';
import type { Trade } from '../store/tradeApi';

type TradePnLFields = Pick<
  Trade,
  'pnl' | 'entryPrice' | 'exitPrice' | 'quantity' | 'positionDirection' | 'commission' | 'swap'
>;

/** Gross P&L — matches backend stored `pnl` (price diff × qty, no leverage). */
export function getTradeGrossPnL(trade: TradePnLFields): number | null {
  if (trade.pnl != null && !Number.isNaN(trade.pnl)) {
    return trade.pnl;
  }
  if (trade.exitPrice == null || Number.isNaN(trade.exitPrice)) {
    return null;
  }
  return calculateGrossPnL(
    trade.positionDirection,
    Number(trade.entryPrice),
    Number(trade.exitPrice),
    Number(trade.quantity),
  );
}

/** Net P&L after commission and swap. */
export function getTradeNetPnL(trade: TradePnLFields): number | null {
  const gross = getTradeGrossPnL(trade);
  if (gross == null) return null;
  return calculateNetPnL(gross, trade.commission ?? 0, trade.swap ?? 0);
}

export function previewPnLFromPrices(
  direction: 'long' | 'short',
  entryPrice: number,
  exitPrice: number,
  quantity: number,
  commission = 0,
  swap = 0,
): { gross: number; net: number } | null {
  if (!Number.isFinite(entryPrice) || !Number.isFinite(exitPrice) || !Number.isFinite(quantity)) {
    return null;
  }
  const gross = calculateGrossPnL(direction, entryPrice, exitPrice, quantity);
  const net = calculateNetPnL(gross, commission, swap);
  return { gross, net };
}
