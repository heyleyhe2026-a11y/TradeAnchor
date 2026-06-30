import { prisma } from '../lib/prisma';
import { Prisma } from '../generated/prisma';
import { getTradeNetPnL, getTradeInvestment } from '@tradeanchor/shared';
import { toTradeRoiInput } from '../utils/trade-roi-mapper';
import { PreferencesService } from './preferences.service';
import { toLocalDateKey, toLocalMonthKey } from '../utils/timezone';
import { aggregateTradesInCurrency } from '../utils/roi-fx.helper';

interface DashboardFilters {
  startDate?: string;
  endDate?: string;
  symbol?: string;
  direction?: 'long' | 'short';
}

interface CalendarFilters {
  startDate?: string;
  endDate?: string;
  symbol?: string;
  direction?: 'long' | 'short';
}

const round2 = (value: number) => Math.round(value * 100) / 100;

function formatProfitFactor(value: number): number {
  if (value === Infinity) return Infinity;
  if (!Number.isFinite(value)) return 0;
  return round2(value);
}

export class DashboardService {
  /**
   * Get dashboard statistics (6.1)
   * - Total investment, Total P&L, Win rate
   * - Supports custom filters (time range, symbol)
   * - ROI uses netPnL (after commission); leverage affects investment only
   */
  async getDashboardStats(userId: string, filters?: DashboardFilters) {
    const prefs = await PreferencesService.get(userId);
    const where: Prisma.TradeWhereInput = {
      userId,
      ...(filters?.startDate && { entryTimestamp: { gte: new Date(filters.startDate) } }),
      ...(filters?.endDate && { entryTimestamp: { lte: new Date(filters.endDate) } }),
      ...(filters?.symbol && { tradingSymbol: { contains: filters.symbol, mode: 'insensitive' } }),
      ...(filters?.direction && { positionDirection: filters.direction }),
    };

    const trades = await prisma.trade.findMany({ where });
    const fxAgg = await aggregateTradesInCurrency(trades, prefs.baseCurrency);
    const metrics = fxAgg.metrics;
    const useConverted = fxAgg.convertedCount > 0;

    const bestRow = fxAgg.convertedRows.reduce<(typeof fxAgg.convertedRows)[0] | null>((best, row) => {
      if (!best) return row;
      return row.netPnL > best.netPnL ? row : best;
    }, null);

    const worstRow = fxAgg.convertedRows.reduce<(typeof fxAgg.convertedRows)[0] | null>((worst, row) => {
      if (!worst) return row;
      return row.netPnL < worst.netPnL ? row : worst;
    }, null);

    const symbolMap = new Map<string, { pnl: number; count: number }>();
    fxAgg.convertedRows.forEach((row) => {
      const symbol = row.trade.tradingSymbol ?? 'UNKNOWN';
      const existing = symbolMap.get(symbol) || { pnl: 0, count: 0 };
      symbolMap.set(symbol, { pnl: existing.pnl + row.netPnL, count: existing.count + 1 });
    });
    const topSymbols = [...symbolMap.entries()]
      .sort((a, b) => b[1].pnl - a[1].pnl)
      .slice(0, 5)
      .map(([symbol, data]) => ({ symbol, pnl: round2(data.pnl), count: data.count }));

    const monthlyMap = new Map<string, number>();
    fxAgg.convertedRows.forEach((row) => {
      const month = row.trade.entryTimestamp.toISOString().slice(0, 7);
      monthlyMap.set(month, (monthlyMap.get(month) || 0) + row.netPnL);
    });
    const monthlyPnL = [...monthlyMap.entries()]
      .map(([month, pnl]) => ({ month, pnl: round2(pnl) }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return {
      overview: {
        totalTrades: useConverted ? metrics.tradeCount : trades.length,
        totalInvestment: useConverted ? metrics.totalInvestment : 0,
        totalPnL: useConverted ? metrics.totalGrossPnL : 0,
        netPnL: useConverted ? metrics.totalNetPnL : 0,
        winRate: metrics.winRate,
        avgPnL: metrics.avgPnL,
        profitFactor: formatProfitFactor(metrics.profitFactor),
        roi: metrics.roi,
        displayCurrency: prefs.baseCurrency,
      },
      currencyBreakdown: fxAgg.currencyBreakdown,
      breakdown: {
        winning: metrics.winning,
        losing: metrics.losing,
        breakEven: metrics.breakEven,
        avgWin: metrics.avgWin,
        avgLoss: metrics.avgLoss,
      },
      bestTrade: bestRow?.trade
        ? {
            id: bestRow.trade.id!,
            tradingSymbol: bestRow.trade.tradingSymbol!,
            pnl: round2(bestRow.netPnL),
          }
        : null,
      worstTrade: worstRow?.trade
        ? {
            id: worstRow.trade.id!,
            tradingSymbol: worstRow.trade.tradingSymbol!,
            pnl: round2(worstRow.netPnL),
          }
        : null,
      topSymbols,
      monthlyPnL,
    };
  }

  /**
   * AI Confidence Score (4 dimensions)
   */
  async getConfidenceScore(userId: string): Promise<{
    executionConsistency: number;
    riskExposure: number;
    concentrationRisk: number;
    overTradingSeverity: number;
    overallScore: number;
    summary: string;
  }> {
    const where: Prisma.TradeWhereInput = { userId };
    const trades = await prisma.trade.findMany({ where });
    const totalTrades = trades.length;

    if (totalTrades === 0) {
      return {
        executionConsistency: 0,
        riskExposure: 0,
        concentrationRisk: 0,
        overTradingSeverity: 0,
        overallScore: 0,
        summary: 'no_data',
      };
    }

    const isWin = (t: (typeof trades)[0]) => getTradeNetPnL(toTradeRoiInput(t)) > 0;

    const sortedByDate = [...trades].sort(
      (a, b) => a.entryTimestamp.getTime() - b.entryTimestamp.getTime(),
    );
    const mid = Math.floor(sortedByDate.length / 2);
    const firstHalf = sortedByDate.slice(0, mid);
    const secondHalf = sortedByDate.slice(mid);

    const wr = (arr: typeof trades) => arr.filter(isWin).length / arr.length;
    const wr1 = firstHalf.length > 0 ? wr(firstHalf) : 0;
    const wr2 = secondHalf.length > 0 ? wr(secondHalf) : 0;

    let executionConsistency = Math.max(0, 100 - Math.abs(wr1 - wr2) * 200);
    const overallWr = trades.filter(isWin).length / totalTrades;
    executionConsistency = Math.round(Math.min(100, executionConsistency + overallWr * 30));

    const positionValues = trades
      .map((t) => getTradeInvestment(toTradeRoiInput(t)))
      .filter((v) => v > 0);
    const avgPosition = positionValues.reduce((a, b) => a + b, 0) / positionValues.length || 0;
    const maxPosition = Math.max(...positionValues, 0);
    let riskExposure = avgPosition > 0 ? Math.round(Math.max(0, 100 - (maxPosition / avgPosition - 1) * 50)) : 70;
    riskExposure = Math.max(0, Math.min(100, riskExposure));

    const symbolCountMap = new Map<string, number>();
    trades.forEach((t) => {
      const sym = t.tradingSymbol || 'UNKNOWN';
      symbolCountMap.set(sym, (symbolCountMap.get(sym) || 0) + 1);
    });
    const uniqueSymbols = symbolCountMap.size;
    const maxSymbolPct = Math.max(...symbolCountMap.values()) / totalTrades;

    let concentrationRisk = Math.round(
      Math.min(100, (uniqueSymbols / Math.max(totalTrades * 0.3, 5)) * 60 + (1 - maxSymbolPct) * 40),
    );
    concentrationRisk = Math.max(0, Math.min(100, concentrationRisk));

    const tradingDaysSet = new Set<string>();
    trades.forEach((t) => tradingDaysSet.add(t.entryTimestamp.toISOString().slice(0, 10)));
    const tradingDays = tradingDaysSet.size;
    const tradesPerDay = totalTrades / Math.max(tradingDays, 1);

    let overTradingSeverity: number;
    if (tradesPerDay < 2) overTradingSeverity = Math.round((tradesPerDay / 2) * 30);
    else if (tradesPerDay < 4) overTradingSeverity = Math.round(30 + (tradesPerDay - 2) * 25);
    else overTradingSeverity = Math.round(Math.min(95, 80 + (tradesPerDay - 4) * 8));

    const invertedOverTrading = 100 - overTradingSeverity;
    const overallScore = Math.round(
      executionConsistency * 0.35 +
        riskExposure * 0.25 +
        concentrationRisk * 0.2 +
        invertedOverTrading * 0.2,
    );

    let summary = 'good';
    if (overallScore >= 75) summary = 'excellent';
    else if (overallScore >= 55) summary = 'good';
    else if (overallScore >= 40) summary = 'caution';
    else summary = 'risk';

    return {
      executionConsistency,
      riskExposure,
      concentrationRisk,
      overTradingSeverity,
      overallScore,
      summary,
    };
  }

  /**
   * Get calendar data (7.1)
   * Daily/monthly PnL and returnPct use netPnL (after commission).
   */
  async getCalendarData(userId: string, months?: number, filters?: CalendarFilters) {
    const prefs = await PreferencesService.get(userId);
    const tz = prefs.displayTimezone;
    const dayBasis = prefs.calendarDayBasis;

    let startDate: Date;
    let endDate: Date | undefined;
    const rangeMonths = Math.min(months || 3, 12);

    if (filters?.startDate) {
      startDate = new Date(filters.startDate);
    } else {
      startDate = new Date();
      startDate.setMonth(startDate.getMonth() - rangeMonths);
    }

    if (filters?.endDate) {
      endDate = new Date(filters.endDate);
      endDate.setHours(23, 59, 59, 999);
    }

    const timestampField = dayBasis === 'exit' ? 'exitTimestamp' : 'entryTimestamp';

    const whereClause: Prisma.TradeWhereInput = {
      userId,
      [timestampField]: { gte: startDate, ...(endDate ? { lte: endDate } : {}) },
    };

    if (filters?.symbol) {
      whereClause.tradingSymbol = { contains: filters.symbol, mode: 'insensitive' };
    }

    if (filters?.direction) {
      whereClause.positionDirection = filters.direction;
    }

    const trades = await prisma.trade.findMany({
      where: whereClause,
      orderBy: { entryTimestamp: 'asc' },
    });

    const dailyMap = new Map<string, { pnl: number; trades: number; investment: number }>();
    trades.forEach((t) => {
      const basisTs =
        dayBasis === 'exit' && t.exitTimestamp ? t.exitTimestamp : t.entryTimestamp;
      const input = toTradeRoiInput(t);
      const date = toLocalDateKey(basisTs, tz);
      const net = getTradeNetPnL(input);
      const investment = getTradeInvestment(input);
      const existing = dailyMap.get(date) || { pnl: 0, trades: 0, investment: 0 };
      dailyMap.set(date, {
        pnl: existing.pnl + net,
        trades: existing.trades + 1,
        investment: existing.investment + investment,
      });
    });

    const dailyData = [...dailyMap.entries()].map(([date, d]) => ({
      date,
      pnl: round2(d.pnl),
      trades: d.trades,
      investment: round2(d.investment),
      returnPct: d.investment > 0 ? round2((d.pnl / d.investment) * 100) : 0,
    }));

    const monthSummaryMap = new Map<
      string,
      { pnl: number; trades: number; wins: number; losses: number; investment: number }
    >();
    trades.forEach((t) => {
      const input = toTradeRoiInput(t);
      const basisTs =
        dayBasis === 'exit' && t.exitTimestamp ? t.exitTimestamp : t.entryTimestamp;
      const m = toLocalMonthKey(basisTs, tz);
      const net = getTradeNetPnL(input);
      const investment = getTradeInvestment(input);
      const existing = monthSummaryMap.get(m) || { pnl: 0, trades: 0, wins: 0, losses: 0, investment: 0 };
      const s = {
        pnl: existing.pnl + net,
        trades: existing.trades + 1,
        wins: existing.wins,
        losses: existing.losses,
        investment: existing.investment + investment,
      };
      if (net > 0) s.wins++;
      else if (net < 0) s.losses++;
      monthSummaryMap.set(m, s);
    });

    const monthlySummary = [...monthSummaryMap.entries()]
      .map(([month, d]) => ({
        month,
        pnl: round2(d.pnl),
        trades: d.trades,
        wins: d.wins,
        losses: d.losses,
        winRate: d.trades > 0 ? round2((d.wins / d.trades) * 100) : 0,
        investment: round2(d.investment),
        returnPct: d.investment > 0 ? round2((d.pnl / d.investment) * 100) : 0,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return { dailyData, monthlySummary, rangeMonths };
  }
}

export const dashboardService = new DashboardService();
