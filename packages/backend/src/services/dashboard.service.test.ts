/// <reference types="jest" />
import { DashboardService } from './dashboard.service';

jest.mock('../lib/prisma', () => ({
  prisma: {
    trade: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('./preferences.service', () => ({
  PreferencesService: {
    get: jest.fn().mockResolvedValue({
      baseCurrency: 'USD',
      displayTimezone: 'UTC',
      calendarDayBasis: 'entry',
    }),
  },
}));

import { prisma } from '../lib/prisma';

describe('DashboardService', () => {
  const service = new DashboardService();
  const userId = 'user-1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getDashboardStats', () => {
    it('uses netPnL for ROI and win rate; investment includes leverage', async () => {
      (prisma.trade.findMany as jest.Mock).mockResolvedValue([
        {
          id: 't1',
          tradingSymbol: 'AAPL',
          positionDirection: 'long',
          entryPrice: 100,
          exitPrice: 110,
          quantity: 10,
          leverage: 2,
          pnl: 100,
          commission: 10,
          quoteCurrency: 'USD',
          entryTimestamp: new Date('2024-01-15T10:00:00Z'),
        },
        {
          id: 't2',
          tradingSymbol: 'TSLA',
          positionDirection: 'short',
          entryPrice: 200,
          exitPrice: 190,
          quantity: 5,
          leverage: 1,
          pnl: 50,
          commission: 5,
          quoteCurrency: 'USD',
          entryTimestamp: new Date('2024-01-16T10:00:00Z'),
        },
      ]);

      const result = await service.getDashboardStats(userId);

      // net: (100-10) + (50-5) = 135; gross: 150
      expect(result.overview.totalPnL).toBe(150);
      expect(result.overview.netPnL).toBe(135);
      // investment: (100*10/2) + (200*5/1) = 500 + 1000 = 1500
      expect(result.overview.totalInvestment).toBe(1500);
      expect(result.overview.roi).toBeCloseTo((135 / 1500) * 100);
      expect(result.overview.winRate).toBe(100);
      expect(result.breakdown.winning).toBe(2);
    });

    it('profit factor uses sum wins / abs(sum losses)', async () => {
      (prisma.trade.findMany as jest.Mock).mockResolvedValue([
        {
          id: 't1',
          tradingSymbol: 'AAPL',
          positionDirection: 'long',
          entryPrice: 10,
          quantity: 1,
          leverage: 1,
          pnl: 100,
          commission: 0,
          entryTimestamp: new Date('2024-01-01'),
        },
        {
          id: 't2',
          tradingSymbol: 'TSLA',
          positionDirection: 'long',
          entryPrice: 10,
          quantity: 1,
          leverage: 1,
          pnl: -40,
          commission: 0,
          entryTimestamp: new Date('2024-01-02'),
        },
      ]);

      const result = await service.getDashboardStats(userId);
      expect(result.overview.profitFactor).toBeCloseTo(100 / 40);
    });
  });

  describe('getCalendarData', () => {
    it('daily returnPct uses net pnl over investment', async () => {
      (prisma.trade.findMany as jest.Mock).mockResolvedValue([
        {
          id: 't1',
          tradingSymbol: 'EURUSD',
          positionDirection: 'long',
          entryPrice: 1,
          quantity: 100,
          leverage: 10,
          pnl: 50,
          commission: 5,
          entryTimestamp: new Date('2024-03-01T12:00:00Z'),
        },
      ]);

      const result = await service.getCalendarData(userId, 3);

      expect(result.dailyData).toHaveLength(1);
      expect(result.dailyData[0].pnl).toBe(45);
      expect(result.dailyData[0].investment).toBe(10);
      expect(result.dailyData[0].returnPct).toBeCloseTo(450);
    });
  });
});
