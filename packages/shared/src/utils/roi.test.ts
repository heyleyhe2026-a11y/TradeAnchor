import {
  calculateGrossPnL,
  calculatePnL,
  calculateNetPnL,
  calculateInvestment,
  calculateRoi,
  resolveGrossPnL,
  getTradeNetPnL,
  getTradeInvestment,
  aggregateTradeMetrics,
  type TradeRoiInput,
} from './roi';

describe('calculateGrossPnL', () => {
  it('long profitable', () => {
    expect(calculateGrossPnL('long', 100, 150, 10)).toBe(500);
  });

  it('long losing', () => {
    expect(calculateGrossPnL('long', 200, 150, 5)).toBe(-250);
  });

  it('short profitable', () => {
    expect(calculateGrossPnL('short', 500, 400, 3)).toBe(300);
  });

  it('short losing', () => {
    expect(calculateGrossPnL('short', 100, 120, 10)).toBe(-200);
  });
});

describe('calculatePnL (backward compat alias)', () => {
  it('matches calculateGrossPnL', () => {
    expect(calculatePnL(100, 150, 10, 'long')).toBe(500);
  });
});

describe('calculateNetPnL', () => {
  it('subtracts commission', () => {
    expect(calculateNetPnL(100, 5)).toBe(95);
  });

  it('subtracts commission and swap', () => {
    expect(calculateNetPnL(100, 5, 2)).toBe(93);
  });

  it('treats null fees as zero', () => {
    expect(calculateNetPnL(50, null, null)).toBe(50);
  });

  it('treats negative swap as cost via absolute value', () => {
    expect(calculateNetPnL(100, 2, -1)).toBe(97);
  });
});

describe('calculateInvestment', () => {
  it('no leverage', () => {
    expect(calculateInvestment(100, 10, 1)).toBe(1000);
  });

  it('with leverage divides investment', () => {
    expect(calculateInvestment(100, 10, 10)).toBe(100);
  });

  it('defaults leverage to 1 when null or invalid', () => {
    expect(calculateInvestment(50, 4, null)).toBe(200);
    expect(calculateInvestment(50, 4, 0)).toBe(200);
  });
});

describe('calculateRoi', () => {
  it('computes percentage', () => {
    expect(calculateRoi(50, 1000)).toBe(5);
  });

  it('returns 0 when investment is zero', () => {
    expect(calculateRoi(100, 0)).toBe(0);
  });

  it('returns 0 when investment is negative', () => {
    expect(calculateRoi(100, -10)).toBe(0);
  });
});

describe('resolveGrossPnL / getTradeNetPnL', () => {
  const base: TradeRoiInput = {
    direction: 'long',
    entryPrice: 100,
    exitPrice: 110,
    quantity: 10,
    leverage: 5,
    commission: 3,
  };

  it('uses stored pnl when provided', () => {
    expect(resolveGrossPnL({ ...base, pnl: 42 })).toBe(42);
  });

  it('derives from prices when pnl absent', () => {
    expect(resolveGrossPnL(base)).toBe(100); // (110-100)*10
  });

  it('getTradeNetPnL deducts fees', () => {
    expect(getTradeNetPnL({ ...base, pnl: 100 })).toBe(97);
  });
});

describe('getTradeInvestment', () => {
  it('applies leverage', () => {
    expect(
      getTradeInvestment({
        direction: 'long',
        entryPrice: 100,
        quantity: 10,
        leverage: 10,
      }),
    ).toBe(100);
  });
});

describe('aggregateTradeMetrics', () => {
  const trades: TradeRoiInput[] = [
    {
      direction: 'long',
      entryPrice: 100,
      quantity: 10,
      leverage: 1,
      pnl: 200,
      commission: 10,
    },
    {
      direction: 'short',
      entryPrice: 50,
      quantity: 20,
      leverage: 2,
      pnl: -50,
      commission: 5,
    },
    {
      direction: 'long',
      entryPrice: 10,
      quantity: 5,
      leverage: 1,
      pnl: 0,
    },
  ];

  it('aggregates net pnl and investment with leverage', () => {
    const m = aggregateTradeMetrics(trades);
    // net: (200-10) + (-50-5) + 0 = 135
    expect(m.totalNetPnL).toBe(135);
    // investment: 1000 + 500 + 50 = 1550
    expect(m.totalInvestment).toBe(1550);
    expect(m.roi).toBeCloseTo((135 / 1550) * 100);
  });

  it('win/loss based on net pnl', () => {
    const m = aggregateTradeMetrics(trades);
    expect(m.winning).toBe(1);
    expect(m.losing).toBe(1);
    expect(m.breakEven).toBe(1);
    expect(m.winRate).toBeCloseTo((1 / 3) * 100);
  });

  it('profit factor uses sum wins / abs(sum losses)', () => {
    const m = aggregateTradeMetrics(trades);
    // wins: 190, losses: -55
    expect(m.profitFactor).toBeCloseTo(190 / 55);
  });

  it('empty trades returns zeros', () => {
    const m = aggregateTradeMetrics([]);
    expect(m.tradeCount).toBe(0);
    expect(m.roi).toBe(0);
    expect(m.winRate).toBe(0);
  });

  it('all winners yields infinite profit factor', () => {
    const m = aggregateTradeMetrics([
      { direction: 'long', entryPrice: 10, quantity: 1, pnl: 5 },
    ]);
    expect(m.profitFactor).toBe(Infinity);
  });
});
