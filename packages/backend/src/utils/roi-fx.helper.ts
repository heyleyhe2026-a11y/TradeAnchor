import {
  aggregateTradeMetrics,
  calculateRoi,
  getTradeInvestment,
  getTradeNetPnL,
  resolveGrossPnL,
  type TradeRoiInput,
} from '@tradeanchor/shared';
import { FxService } from '../services/fx.service';
import { toTradeRoiInput, type TradeRoiSource } from './trade-roi-mapper';

export type TradeWithCurrency = TradeRoiSource & {
  id?: string;
  tradingSymbol?: string;
  quoteCurrency?: string | null;
  entryTimestamp: Date;
  exitTimestamp?: Date | null;
};

export type ConvertedTradeRow = {
  trade: TradeWithCurrency;
  netPnL: number;
  investment: number;
  grossPnL: number;
  quoteCurrency: string;
};

export type CurrencyBreakdownRow = {
  currency: string;
  netPnl: number;
  investment: number;
  roi: number;
  tradeCount: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

async function convertField(
  amount: number | null | undefined,
  quote: string,
  target: string,
  rateDate: Date,
): Promise<number | null | undefined> {
  if (amount == null) return amount;
  if (quote === target) return amount;
  const converted = await FxService.tryConvert(amount, quote, target, rateDate);
  return converted ?? amount;
}

/** Convert trade monetary fields to user's report currency for list display. */
export async function convertTradeForDisplay(
  trade: TradeWithCurrency & {
    entryPrice: number;
    exitPrice?: number | null;
    pnl?: number | null;
    commission?: number | null;
    swap?: number | null;
  },
  targetCurrency: string,
): Promise<{
  displayCurrency: string;
  entryPrice: number;
  exitPrice: number | null;
  pnl: number;
  commission: number | null;
  swap: number | null;
  netPnl: number;
  investment: number;
}> {
  const quote = (trade.quoteCurrency ?? 'USD').toUpperCase();
  const target = targetCurrency.toUpperCase();
  const entryDate = new Date(trade.entryTimestamp);
  const exitDate = trade.exitTimestamp ? new Date(trade.exitTimestamp) : entryDate;
  const nativeInput = toTradeRoiInput(trade);

  const entryPrice = round2(
    (await convertField(Number(trade.entryPrice), quote, target, entryDate)) ?? Number(trade.entryPrice),
  );
  const exitPriceRaw = trade.exitPrice != null ? Number(trade.exitPrice) : null;
  const exitPrice =
    exitPriceRaw != null
      ? round2((await convertField(exitPriceRaw, quote, target, exitDate)) ?? exitPriceRaw)
      : null;

  const nativeGross = resolveGrossPnL(nativeInput);
  const pnl = round2((await convertField(nativeGross, quote, target, exitDate)) ?? nativeGross);

  const commission =
    trade.commission != null
      ? round2(
          (await convertField(Math.abs(Number(trade.commission)), quote, target, exitDate)) ??
            Math.abs(Number(trade.commission)),
        )
      : null;
  const swap =
    trade.swap != null
      ? round2(
          (await convertField(Math.abs(Number(trade.swap)), quote, target, exitDate)) ??
            Math.abs(Number(trade.swap)),
        )
      : null;

  const nativeNet = getTradeNetPnL(nativeInput);
  const netPnl = round2((await convertField(nativeNet, quote, target, exitDate)) ?? nativeNet);
  const nativeInv = getTradeInvestment(nativeInput);
  const investment = round2((await convertField(nativeInv, quote, target, entryDate)) ?? nativeInv);

  return {
    displayCurrency: target,
    entryPrice,
    exitPrice,
    pnl,
    commission,
    swap,
    netPnl,
    investment,
  };
}

/** Aggregate per-currency buckets without FX conversion. */
export function aggregateByQuoteCurrency(trades: TradeWithCurrency[]): CurrencyBreakdownRow[] {
  const map = new Map<string, TradeRoiInput[]>();
  for (const t of trades) {
    const cur = (t.quoteCurrency ?? 'USD').toUpperCase();
    const list = map.get(cur) ?? [];
    list.push(toTradeRoiInput(t));
    map.set(cur, list);
  }
  return [...map.entries()].map(([currency, inputs]) => {
    const m = aggregateTradeMetrics(inputs);
    return {
      currency,
      netPnl: round2(m.totalNetPnL),
      investment: round2(m.totalInvestment),
      roi: round2(m.roi),
      tradeCount: m.tradeCount,
    };
  });
}

/** Convert each trade to target currency (with FX date fallback). */
export async function convertTradesToCurrency(
  trades: TradeWithCurrency[],
  targetCurrency: string,
): Promise<ConvertedTradeRow[]> {
  const target = targetCurrency.toUpperCase();
  const rows: ConvertedTradeRow[] = [];

  for (const t of trades) {
    const input = toTradeRoiInput(t);
    const quote = (t.quoteCurrency ?? 'USD').toUpperCase();
    const net = getTradeNetPnL(input);
    const inv = getTradeInvestment(input);
    const gross = input.pnl != null ? Number(input.pnl) : net;
    const rateDate = t.exitTimestamp ?? t.entryTimestamp;

    const netConv =
      quote === target ? net : await FxService.tryConvert(net, quote, target, rateDate);
    const invConv =
      quote === target ? inv : await FxService.tryConvert(inv, quote, target, t.entryTimestamp);

    if (netConv === null || invConv === null) continue;

    rows.push({
      trade: t,
      netPnL: netConv,
      investment: invConv,
      grossPnL: quote === target ? gross : (await FxService.tryConvert(gross, quote, target, rateDate)) ?? gross,
      quoteCurrency: quote,
    });
  }

  return rows;
}

export type ConvertedAggregateMetrics = {
  totalGrossPnL: number;
  totalNetPnL: number;
  totalInvestment: number;
  roi: number;
  tradeCount: number;
  convertedCount: number;
  winning: number;
  losing: number;
  breakEven: number;
  winRate: number;
  avgPnL: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
};

export function aggregateConvertedRows(rows: ConvertedTradeRow[]): ConvertedAggregateMetrics {
  let totalGrossPnL = 0;
  let totalNetPnL = 0;
  let totalInvestment = 0;
  let winning = 0;
  let losing = 0;
  let breakEven = 0;
  let sumWins = 0;
  let sumLosses = 0;

  for (const row of rows) {
    totalGrossPnL += row.grossPnL;
    totalNetPnL += row.netPnL;
    totalInvestment += row.investment;

    if (row.netPnL > 0) {
      winning++;
      sumWins += row.netPnL;
    } else if (row.netPnL < 0) {
      losing++;
      sumLosses += row.netPnL;
    } else {
      breakEven++;
    }
  }

  const tradeCount = rows.length;
  const winRate = tradeCount > 0 ? (winning / tradeCount) * 100 : 0;
  const avgPnL = tradeCount > 0 ? totalNetPnL / tradeCount : 0;
  const avgWin = winning > 0 ? sumWins / winning : 0;
  const avgLoss = losing > 0 ? Math.abs(sumLosses) / losing : 0;

  let profitFactor = 0;
  if (sumLosses !== 0) profitFactor = sumWins / Math.abs(sumLosses);
  else if (sumWins > 0) profitFactor = Infinity;

  return {
    totalGrossPnL: round2(totalGrossPnL),
    totalNetPnL: round2(totalNetPnL),
    totalInvestment: round2(totalInvestment),
    roi: round2(calculateRoi(totalNetPnL, totalInvestment)),
    tradeCount,
    convertedCount: tradeCount,
    winning,
    losing,
    breakEven,
    winRate: round2(winRate),
    avgPnL: round2(avgPnL),
    avgWin: round2(avgWin),
    avgLoss: round2(avgLoss),
    profitFactor,
  };
}

/**
 * Convert each trade to target currency and aggregate.
 * Uses FX fallback so historical imports (e.g. Tiger HKD) are not dropped.
 */
export async function aggregateTradesInCurrency(
  trades: TradeWithCurrency[],
  targetCurrency: string,
): Promise<{
  totalNetPnL: number;
  totalInvestment: number;
  roi: number;
  tradeCount: number;
  convertedCount: number;
  displayCurrency: string;
  currencyBreakdown: CurrencyBreakdownRow[];
  convertedRows: ConvertedTradeRow[];
  metrics: ConvertedAggregateMetrics;
}> {
  const target = targetCurrency.toUpperCase();
  const breakdown = aggregateByQuoteCurrency(trades);
  const convertedRows = await convertTradesToCurrency(trades, target);
  const metrics = aggregateConvertedRows(convertedRows);

  return {
    totalNetPnL: metrics.totalNetPnL,
    totalInvestment: metrics.totalInvestment,
    roi: metrics.roi,
    tradeCount: trades.length,
    convertedCount: metrics.convertedCount,
    displayCurrency: target,
    currencyBreakdown: breakdown,
    convertedRows,
    metrics,
  };
}
