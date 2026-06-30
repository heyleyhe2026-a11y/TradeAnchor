/**
 * Phase 0 ROI metrics — cross-module consistency checks.
 * Ensures Dashboard, Leaderboard, and shared RoiCalculator use the same formulas.
 */
import { aggregateTradeMetrics, getTradeNetPnL } from '@tradeanchor/shared';
import { toTradeRoiInput } from '../utils/trade-roi-mapper';

const SAMPLE_TRADES = [
  {
    userId: 'u1',
    positionDirection: 'long',
    entryPrice: 100,
    exitPrice: 110,
    quantity: 10,
    leverage: 2,
    pnl: 100,
    commission: 10,
    entryTimestamp: new Date('2024-01-10T10:00:00Z'),
    exitTimestamp: new Date('2024-05-15T10:00:00Z'),
  },
  {
    userId: 'u1',
    positionDirection: 'short',
    entryPrice: 50,
    exitPrice: 45,
    quantity: 20,
    leverage: 1,
    pnl: 100,
    commission: 5,
    entryTimestamp: new Date('2024-02-01T10:00:00Z'),
    exitTimestamp: new Date('2024-05-20T10:00:00Z'),
  },
];

describe('ROI metrics consistency (Phase 0)', () => {
  it('aggregateTradeMetrics matches manual netPnL / investment formula', () => {
    const inputs = SAMPLE_TRADES.map(toTradeRoiInput);
    const metrics = aggregateTradeMetrics(inputs);

    const manualNet = inputs.reduce(
      (sum, t) => sum + getTradeNetPnL(t),
      0,
    );
    // investment: 100*10/2 + 50*20/1 = 500 + 1000 = 1500
    const manualInvestment = 500 + 1000;
    const manualRoi = (manualNet / manualInvestment) * 100;

    expect(metrics.totalNetPnL).toBe(manualNet);
    expect(metrics.totalInvestment).toBe(manualInvestment);
    expect(metrics.roi).toBeCloseTo(manualRoi);
    // net: (100-10)+(100-5) = 185
    expect(metrics.totalNetPnL).toBe(185);
    expect(metrics.roi).toBeCloseTo((185 / 1500) * 100);
  });

  it('win rate uses netPnL sign, not gross', () => {
    const inputs = [
      toTradeRoiInput({
        positionDirection: 'long',
        entryPrice: 10,
        quantity: 1,
        leverage: 1,
        pnl: 5,
        commission: 10,
      }),
      toTradeRoiInput({
        positionDirection: 'long',
        entryPrice: 10,
        quantity: 1,
        leverage: 1,
        pnl: 20,
        commission: 2,
      }),
    ];
    const metrics = aggregateTradeMetrics(inputs);
    // first trade gross +5 but net -5 -> loss; second net +18 -> win
    expect(metrics.winning).toBe(1);
    expect(metrics.losing).toBe(1);
    expect(metrics.winRate).toBe(50);
  });

  it('leverage affects investment but not gross pnl', () => {
    const lowLev = toTradeRoiInput({
      positionDirection: 'long',
      entryPrice: 100,
      exitPrice: 110,
      quantity: 10,
      leverage: 1,
      pnl: 100,
      commission: 0,
    });
    const highLev = toTradeRoiInput({
      positionDirection: 'long',
      entryPrice: 100,
      exitPrice: 110,
      quantity: 10,
      leverage: 10,
      pnl: 100,
      commission: 0,
    });

    const mLow = aggregateTradeMetrics([lowLev]);
    const mHigh = aggregateTradeMetrics([highLev]);

    expect(mLow.totalGrossPnL).toBe(mHigh.totalGrossPnL);
    expect(mLow.totalInvestment).toBe(1000);
    expect(mHigh.totalInvestment).toBe(100);
    expect(mHigh.roi).toBeGreaterThan(mLow.roi);
  });

  it('profit factor uses sum of wins / abs(sum of losses)', () => {
    const metrics = aggregateTradeMetrics(SAMPLE_TRADES.map(toTradeRoiInput));
    // wins net: 90 + 95 = 185; no losses
    expect(metrics.profitFactor).toBe(Infinity);
  });
});
