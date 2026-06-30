import { describe, it, expect } from 'vitest';
import { getTradeGrossPnL, getTradeNetPnL, previewPnLFromPrices } from './tradeMetrics';

describe('tradeMetrics', () => {
  it('getTradeNetPnL subtracts commission', () => {
    expect(
      getTradeNetPnL({
        pnl: 100,
        entryPrice: 10,
        exitPrice: 20,
        quantity: 10,
        positionDirection: 'long',
        commission: 8,
        swap: 2,
      }),
    ).toBe(90);
  });

  it('previewPnLFromPrices does not multiply by leverage', () => {
    const preview = previewPnLFromPrices('long', 100, 110, 10, 5);
    expect(preview).toEqual({ gross: 100, net: 95 });
  });

  it('getTradeGrossPnL derives from prices when pnl missing', () => {
    expect(
      getTradeGrossPnL({
        pnl: undefined as unknown as number,
        entryPrice: 50,
        exitPrice: 55,
        quantity: 4,
        positionDirection: 'long',
        commission: 0,
      }),
    ).toBe(20);
  });
});
