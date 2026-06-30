import { getTradeInvestment } from '@tradeanchor/shared';
import { resolveEffectiveLeverage, toTradeRoiInput } from './trade-roi-mapper';

describe('resolveEffectiveLeverage', () => {
  it('scales MT4 display leverage by 100 for margin divisor', () => {
    expect(
      resolveEffectiveLeverage({
        positionDirection: 'long',
        entryPrice: 1,
        quantity: 1,
        leverage: 1,
        importSource: 'mt4',
        tradingSymbol: 'EURUSD',
      }),
    ).toBe(100);

    expect(
      resolveEffectiveLeverage({
        positionDirection: 'long',
        entryPrice: 1,
        quantity: 1,
        leverage: 100,
        importSource: 'mt4',
        tradingSymbol: 'EURUSD',
      }),
    ).toBe(10_000);
  });

  it('applies broker divisor to legacy lot-based forex without import_source', () => {
    expect(
      resolveEffectiveLeverage({
        positionDirection: 'long',
        entryPrice: 2345,
        quantity: 0.5,
        leverage: 1,
        tradingSymbol: 'XAUUSD',
      }),
    ).toBe(100);
  });

  it('keeps equities on raw leverage', () => {
    expect(
      resolveEffectiveLeverage({
        positionDirection: 'long',
        entryPrice: 150,
        quantity: 100,
        leverage: 50,
        tradingSymbol: 'AAPL',
      }),
    ).toBe(50);
  });
});

describe('MT4 sample investment', () => {
  const mt4Rows = [
    { tradingSymbol: 'EURUSD', entryPrice: 1.085, quantity: 1 },
    { tradingSymbol: 'XAUUSD', entryPrice: 2345, quantity: 0.5 },
    { tradingSymbol: 'GBPUSD', entryPrice: 1.265, quantity: 2 },
    { tradingSymbol: 'USDJPY', entryPrice: 148.5, quantity: 1 },
    { tradingSymbol: 'EURUSD', entryPrice: 1.098, quantity: 1.5 },
    { tradingSymbol: 'AUDUSD', entryPrice: 0.652, quantity: 3 },
    { tradingSymbol: 'USDCAD', entryPrice: 1.365, quantity: 1 },
  ];

  const sumInvestment = (displayLeverage: number) =>
    mt4Rows.reduce((sum, row) => {
      const input = toTradeRoiInput({
        positionDirection: 'long',
        leverage: displayLeverage,
        importSource: 'mt4',
        ...row,
      });
      return sum + getTradeInvestment(input);
    }, 0);

  it('totals $10,755.5 at display 1x', () => {
    expect(sumInvestment(1)).toBeCloseTo(10_755.5, 0);
  });

  it('totals $107.55 at display 100x', () => {
    expect(sumInvestment(100)).toBeCloseTo(107.55, 1);
  });
});
