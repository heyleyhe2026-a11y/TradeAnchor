import { calculateMarginInvestment, getContractSize } from './contractSize';
import { calculateInvestment, getTradeInvestment } from './roi';

describe('contract size / margin investment', () => {
  it('uses 100 oz per lot for XAUUSD at 100:1 leverage', () => {
    expect(
      calculateMarginInvestment(2345, 0.5, 100, 'XAUUSD'),
    ).toBeCloseTo(1172.5);
  });

  it('uses 100k per lot for EURUSD at 100:1 leverage', () => {
    expect(
      calculateMarginInvestment(1.085, 1, 100, 'EURUSD'),
    ).toBeCloseTo(1085);
  });

  it('uses base-notional margin for USDJPY', () => {
    expect(
      calculateMarginInvestment(148.5, 1, 100, 'USDJPY'),
    ).toBeCloseTo(1000);
  });

  it('treats equities as shares (contract size 1)', () => {
    expect(getContractSize('AAPL')).toBe(1);
    expect(calculateMarginInvestment(178.5, 100, 1, 'AAPL')).toBeCloseTo(17850);
  });

  it('getTradeInvestment passes symbol through TradeRoiInput', () => {
    expect(
      getTradeInvestment({
        direction: 'short',
        entryPrice: 2345,
        quantity: 0.5,
        leverage: 100,
        tradingSymbol: 'XAUUSD',
      }),
    ).toBeCloseTo(1172.5);
  });

  it('calculateInvestment without symbol keeps stock semantics', () => {
    expect(calculateInvestment(100, 10, 1)).toBe(1000);
  });
});
