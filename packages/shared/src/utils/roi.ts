/**
 * Unified trade ROI / PnL metrics (Phase 0 — PR-1).
 *
 * Conventions (used across dashboard, leaderboard, and frontend):
 *   grossPnL   = stored pnl field (or price-derived)
 *   netPnL     = grossPnL - abs(commission) - abs(swap)
 *   investment = margin at risk (see calculateInvestment; lot-aware for forex/metals)
 *   roi        = totalNetPnL / totalInvestment × 100
 *
 * Leverage scales investment (margin basis) only — it does NOT amplify PnL.
 */

import { calculateMarginInvestment } from './contractSize';

export type TradeDirection = 'long' | 'short';

export interface TradeRoiInput {
  direction: TradeDirection;
  entryPrice: number;
  exitPrice?: number | null;
  quantity: number;
  leverage?: number | null;
  /** Stored gross P&L; when absent, derived from prices if exitPrice is set */
  pnl?: number | null;
  commission?: number | null;
  swap?: number | null;
  /** Used for lot/contract-aware investment (forex, metals). */
  tradingSymbol?: string;
}

export interface AggregatedTradeMetrics {
  totalGrossPnL: number;
  totalNetPnL: number;
  totalInvestment: number;
  roi: number;
  tradeCount: number;
  winning: number;
  losing: number;
  breakEven: number;
  winRate: number;
  avgPnL: number;
  avgWin: number;
  avgLoss: number;
  /** Standard: sum(winning netPnL) / abs(sum(losing netPnL)) */
  profitFactor: number;
}

/**
 * Gross P&L from price movement (does not include leverage).
 */
export function calculateGrossPnL(
  direction: TradeDirection,
  entryPrice: number,
  exitPrice: number,
  quantity: number,
): number {
  if (direction === 'long') {
    return (exitPrice - entryPrice) * quantity;
  }
  return (entryPrice - exitPrice) * quantity;
}

/** @deprecated Use calculateGrossPnL — kept for backward compatibility */
export function calculatePnL(
  entryPrice: number,
  exitPrice: number,
  quantity: number,
  direction: TradeDirection,
): number {
  return calculateGrossPnL(direction, entryPrice, exitPrice, quantity);
}

/**
 * Net P&L after fees (commission + swap), same currency as gross pnl.
 */
export function calculateNetPnL(
  pnl: number | null | undefined,
  commission?: number | null,
  swap?: number | null,
): number {
  const gross = Number(pnl ?? 0);
  const fees = Math.abs(Number(commission ?? 0)) + Math.abs(Number(swap ?? 0));
  return gross - fees;
}

/**
 * Capital at risk / margin basis for ROI denominator.
 * Pass tradingSymbol for MT4/MT5 lot-based instruments (forex, XAUUSD, etc.).
 */
export function calculateInvestment(
  entryPrice: number,
  quantity: number,
  leverage?: number | null,
  tradingSymbol?: string,
): number {
  return calculateMarginInvestment(entryPrice, quantity, leverage, tradingSymbol);
}

/**
 * ROI as percentage. Returns 0 when investment is zero or negative.
 */
export function calculateRoi(totalNetPnL: number, totalInvestment: number): number {
  if (totalInvestment <= 0) return 0;
  return (totalNetPnL / totalInvestment) * 100;
}

/**
 * Resolve gross P&L for a single trade input.
 */
export function resolveGrossPnL(trade: TradeRoiInput): number {
  if (trade.pnl != null && Number.isFinite(trade.pnl)) {
    return trade.pnl;
  }
  if (trade.exitPrice != null && Number.isFinite(trade.exitPrice)) {
    return calculateGrossPnL(
      trade.direction,
      trade.entryPrice,
      trade.exitPrice,
      trade.quantity,
    );
  }
  return 0;
}

/** Net P&L for a single trade (gross minus fees). */
export function getTradeNetPnL(trade: TradeRoiInput): number {
  return calculateNetPnL(resolveGrossPnL(trade), trade.commission, trade.swap);
}

/** Investment for a single trade. */
export function getTradeInvestment(trade: TradeRoiInput): number {
  return calculateInvestment(
    trade.entryPrice,
    trade.quantity,
    trade.leverage,
    trade.tradingSymbol,
  );
}

/**
 * Aggregate metrics for a set of trades (dashboard / leaderboard).
 * Win/loss is determined by netPnL (> 0 / < 0).
 */
export function aggregateTradeMetrics(trades: TradeRoiInput[]): AggregatedTradeMetrics {
  let totalGrossPnL = 0;
  let totalNetPnL = 0;
  let totalInvestment = 0;
  let winning = 0;
  let losing = 0;
  let breakEven = 0;
  let sumWins = 0;
  let sumLosses = 0;

  for (const trade of trades) {
    const gross = resolveGrossPnL(trade);
    const net = calculateNetPnL(gross, trade.commission, trade.swap);
    const investment = getTradeInvestment(trade);

    totalGrossPnL += gross;
    totalNetPnL += net;
    totalInvestment += investment;

    if (net > 0) {
      winning++;
      sumWins += net;
    } else if (net < 0) {
      losing++;
      sumLosses += net;
    } else {
      breakEven++;
    }
  }

  const tradeCount = trades.length;
  const winRate = tradeCount > 0 ? (winning / tradeCount) * 100 : 0;
  const avgPnL = tradeCount > 0 ? totalNetPnL / tradeCount : 0;
  const avgWin = winning > 0 ? sumWins / winning : 0;
  const avgLoss = losing > 0 ? Math.abs(sumLosses) / losing : 0;

  let profitFactor = 0;
  if (sumLosses !== 0) {
    profitFactor = sumWins / Math.abs(sumLosses);
  } else if (sumWins > 0) {
    profitFactor = Infinity;
  }

  return {
    totalGrossPnL,
    totalNetPnL,
    totalInvestment,
    roi: calculateRoi(totalNetPnL, totalInvestment),
    tradeCount,
    winning,
    losing,
    breakEven,
    winRate,
    avgPnL,
    avgWin,
    avgLoss,
    profitFactor,
  };
}
