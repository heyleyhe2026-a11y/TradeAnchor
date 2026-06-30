/// <reference types="jest" />
import { TradeService } from './trade.service';

// Mock Prisma client
jest.mock('../lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
    trade: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

import { prisma } from '../lib/prisma';

describe('TradeService - PnL Calculation (4.5)', () => {
  let service: TradeService;

  beforeEach(() => {
    service = new TradeService();
    jest.clearAllMocks();
  });

  // --- PnL Calculation Tests ---
  describe('calculatePnL - Long position', () => {
    it('should calculate correct PnL for profitable long trade', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-1',
        subscriptions: [{ tier: 'pro', status: 'active' }],
      });
      (prisma.trade.create as jest.Mock).mockImplementation((args: any) =>
        Promise.resolve({ id: 't1', ...args.data })
      );

      const result = await service.createTrade('user-1', {
        tradingSymbol: 'AAPL',
        positionDirection: 'long',
        entryPrice: 100,
        exitPrice: 150,
        quantity: 10,
        entryTimestamp: '2024-01-01T00:00:00Z',
        exitTimestamp: '2024-01-02T00:00:00Z',
      });

      expect(result.pnl).toBe(500); // (150-100)*10
    });

    it('should calculate correct PnL for losing long trade', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-1',
        subscriptions: [{ tier: 'pro', status: 'active' }],
      });
      (prisma.trade.create as jest.Mock).mockImplementation((args: any) =>
        Promise.resolve({ id: 't2', ...args.data })
      );

      const result = await service.createTrade('user-1', {
        tradingSymbol: 'TSLA',
        positionDirection: 'long',
        entryPrice: 200,
        exitPrice: 150,
        quantity: 5,
        entryTimestamp: '2024-01-01T00:00:00Z',
        exitTimestamp: '2024-01-02T00:00:00Z',
      });

      expect(result.pnl).toBe(-250); // (150-200)*5
    });
  });

  describe('calculatePnL - Short position', () => {
    it('should calculate correct PnL for profitable short trade', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-1',
        subscriptions: [{ tier: 'pro', status: 'active' }],
      });
      (prisma.trade.create as jest.Mock).mockImplementation((args: any) =>
        Promise.resolve({ id: 't3', ...args.data })
      );

      const result = await service.createTrade('user-1', {
        tradingSymbol: 'NVDA',
        positionDirection: 'short',
        entryPrice: 500,
        exitPrice: 400,
        quantity: 3,
        entryTimestamp: '2024-01-01T00:00:00Z',
        exitTimestamp: '2024-01-02T00:00:00Z',
      });

      expect(result.pnl).toBe(300); // (500-400)*3
    });

    it('should calculate correct PnL for losing short trade', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-1',
        subscriptions: [{ tier: 'pro', status: 'active' }],
      });
      (prisma.trade.create as jest.Mock).mockImplementation((args: any) =>
        Promise.resolve({ id: 't4', ...args.data })
      );

      const result = await service.createTrade('user-1', {
        tradingSymbol: 'AMD',
        positionDirection: 'short',
        entryPrice: 100,
        exitPrice: 150,
        quantity: 4,
        entryTimestamp: '2024-01-01T00:00:00Z',
        exitTimestamp: '2024-01-02T00:00:00Z',
      });

      expect(result.pnl).toBe(-200); // (100-150)*4
    });
  });

  describe('leverage does not affect stored PnL', () => {
    it('same prices with leverage 1 vs 10 produce identical gross pnl', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-1',
        subscriptions: [{ tier: 'pro', status: 'active' }],
      });
      (prisma.trade.create as jest.Mock).mockImplementation((args: any) =>
        Promise.resolve({ id: args.data.leverage, ...args.data })
      );

      const base = {
        tradingSymbol: 'BTCUSD',
        positionDirection: 'long' as const,
        entryPrice: 100,
        exitPrice: 110,
        quantity: 10,
        entryTimestamp: '2024-01-01T00:00:00Z',
        exitTimestamp: '2024-01-02T00:00:00Z',
      };

      const low = await service.createTrade('user-1', { ...base, leverage: 1 });
      const high = await service.createTrade('user-1', { ...base, leverage: 10 });

      expect(low.pnl).toBe(100);
      expect(high.pnl).toBe(100);
    });
  });

  // --- Field Validation Tests ---
  describe('Field validation via service', () => {
    it('should reject trade without symbol', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-1',
        subscriptions: [{ tier: 'pro', status: 'active' }],
      });

      await expect(
        service.createTrade('user-1', {
          tradingSymbol: '',
          positionDirection: 'long',
          entryPrice: 100,
          exitPrice: 110,
          quantity: 1,
          entryTimestamp: '2024-01-01T00:00:00Z',
          exitTimestamp: '2024-01-02T00:00:00Z',
        })
      ).rejects.toThrow();
    });

    it('should reject zero or negative price', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-1',
        subscriptions: [{ tier: 'pro', status: 'active' }],
      });

      await expect(
        service.createTrade('user-1', {
          tradingSymbol: 'AAPL',
          positionDirection: 'long',
          entryPrice: 0,
          exitPrice: 110,
          quantity: 1,
          entryTimestamp: '2024-01-01T00:00:00Z',
          exitTimestamp: '2024-01-02T00:00:00Z',
        })
      ).rejects.toThrow();
    });
  });

  // --- Subscription Tier Limit Tests ---
  describe('Subscription tier limits', () => {
    it('should allow trades for pro users beyond limit', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-pro',
        subscriptions: [{ tier: 'pro', status: 'active' }],
      });
      (prisma.trade.count as jest.Mock).mockResolvedValue(1000);
      (prisma.trade.create as jest.Mock).mockImplementation((args: any) =>
        Promise.resolve({ id: 't5', ...args.data })
      );

      const result = await service.createTrade('user-pro', {
        tradingSymbol: 'AAPL',
        positionDirection: 'long',
        entryPrice: 100,
        exitPrice: 110,
        quantity: 10,
        entryTimestamp: '2024-01-01T00:00:00Z',
        exitTimestamp: '2024-01-02T00:00:00Z',
      });

      expect(result.tradingSymbol).toBe('AAPL');
    });

    it('should block free user at 500 trades limit', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-free',
        subscriptions: [{ tier: 'free', status: 'active' }],
      });
      (prisma.trade.count as jest.Mock).mockResolvedValue(500);

      await expect(
        service.createTrade('user-free', {
          tradingSymbol: 'AAPL',
          positionDirection: 'long',
          entryPrice: 100,
          exitPrice: 110,
          quantity: 1,
          entryTimestamp: '2024-01-01T00:00:00Z',
          exitTimestamp: '2024-01-02T00:00:00Z',
        })
      ).rejects.toThrow('Trade limit reached');
    });
  });

  // --- Filtering & Search Tests ---
  describe('Filtering and search', () => {
    it('should filter by symbol (case insensitive)', async () => {
      const mockTrades = [
        { id: '1', tradingSymbol: 'AAPL', userId: 'u1' },
        { id: '2', tradingSymbol: 'TSLA', userId: 'u1' },
      ];
      (prisma.trade.count as jest.Mock).mockResolvedValue(1);
      (prisma.trade.findMany as jest.Mock).mockResolvedValue([mockTrades[0]]);

      const result = await service.getTrades('u1', { page: 1, limit: 20, sort: 'date', order: 'desc', symbol: 'aapl' });

      expect(prisma.trade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tradingSymbol: { contains: 'aapl', mode: 'insensitive' },
          }),
        })
      );
      expect(result.trades.length).toBe(1);
    });

    it('should filter by direction', async () => {
      (prisma.trade.count as jest.Mock).mockResolvedValue(5);
      (prisma.trade.findMany as jest.Mock).mockResolvedValue([]);

      await service.getTrades('u1', { page: 1, limit: 20, sort: 'date', order: 'desc', direction: 'short' });

      expect(prisma.trade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            positionDirection: 'short',
          }),
        })
      );
    });

    it('should filter by PnL range', async () => {
      (prisma.trade.count as jest.Mock).mockResolvedValue(3);
      (prisma.trade.findMany as jest.Mock).mockResolvedValue([]);

      await service.getTrades('u1', { page: 1, limit: 20, sort: 'date', order: 'desc', minPnL: 0, maxPnL: 1000 });

      expect(prisma.trade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            pnl: { gte: 0, lte: 1000 },
          }),
        })
      );
    });

    it('should filter by date range', async () => {
      (prisma.trade.count as jest.Mock).mockResolvedValue(10);
      (prisma.trade.findMany as jest.Mock).mockResolvedValue([]);

      await service.getTrades('u1', {
        page: 1, limit: 20, sort: 'date', order: 'desc',
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-12-31T23:59:59Z',
      });

      expect(prisma.trade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            entryTimestamp: { gte: new Date('2024-01-01T00:00:00Z') },
          }),
        })
      );
    });

    it('should combine multiple filters', async () => {
      (prisma.trade.count as jest.Mock).mockResolvedValue(2);
      (prisma.trade.findMany as jest.Mock).mockResolvedValue([]);

      await service.getTrades('u1', {
        page: 1, limit: 50, sort: 'pnl', order: 'asc',
        symbol: 'AAPL',
        direction: 'long',
        minPnL: 100,
      });

      expect(prisma.trade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tradingSymbol: { contains: 'AAPL', mode: 'insensitive' },
            positionDirection: 'long',
            pnl: { gte: 100 },
          }),
          orderBy: { pnl: 'asc' },
          skip: 0,
          take: 50,
        })
      );
    });
  });

  // --- Pagination Tests ---
  describe('Pagination', () => {
    it('should return correct pagination metadata', async () => {
      (prisma.trade.count as jest.Mock).mockResolvedValue(25);
      (prisma.trade.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getTrades('u1', { page: 2, limit: 10, sort: 'date', order: 'desc' });

      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.total).toBe(25);
      expect(result.totalPages).toBe(3); // ceil(25/10) = 3
      expect(prisma.trade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 })
      );
    });

    it('should default to page 1 with correct offset', async () => {
      (prisma.trade.count as jest.Mock).mockResolvedValue(5);
      (prisma.trade.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getTrades('u1', { page: 1, limit: 20, sort: 'date', order: 'desc' });

      expect(result.page).toBe(1);
      expect(prisma.trade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 })
      );
    });
  });

  // --- Sorting Tests ---
  describe('Sorting', () => {
    it('should sort by date descending (default)', async () => {
      (prisma.trade.count as jest.Mock).mockResolvedValue(1);
      (prisma.trade.findMany as jest.Mock).mockResolvedValue([]);

      await service.getTrades('u1', { page: 1, limit: 20, sort: 'date', order: 'desc' });

      expect(prisma.trade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { entryTimestamp: 'desc' } })
      );
    });

    it('should sort by pnl ascending', async () => {
      (prisma.trade.count as jest.Mock).mockResolvedValue(1);
      (prisma.trade.findMany as jest.Mock).mockResolvedValue([]);

      await service.getTrades('u1', { page: 1, limit: 20, sort: 'pnl', order: 'asc' });

      expect(prisma.trade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { pnl: 'asc' } })
      );
    });

    it('should sort by symbol', async () => {
      (prisma.trade.count as jest.Mock).mockResolvedValue(1);
      (prisma.trade.findMany as jest.Mock).mockResolvedValue([]);

      await service.getTrades('u1', { page: 1, limit: 20, sort: 'symbol', order: 'asc' });

      expect(prisma.trade.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { tradingSymbol: 'asc' } })
      );
    });
  });

  // --- CRUD Operations ---
  describe('Update and Delete', () => {
    it('should update trade and recalculate PnL', async () => {
      const existingTrade = {
        id: 't1',
        tradingSymbol: 'AAPL',
        positionDirection: 'long' as const,
        entryPrice: 100,
        exitPrice: 110,
        quantity: 10,
        pnl: 100,
        entryTimestamp: new Date(),
        exitTimestamp: new Date(),
        userId: 'u1',
      };
      (prisma.trade.findFirst as jest.Mock).mockResolvedValue(existingTrade);
      (prisma.trade.update as jest.Mock).mockImplementation((args: any) =>
        Promise.resolve({ ...existingTrade, ...args.data })
      );

      const result = await service.updateTrade('u1', 't1', {
        exitPrice: 120,
      });

      expect(result.pnl).toBe(200); // (120-100)*10
    });

    it('should delete a valid trade', async () => {
      (prisma.trade.findFirst as jest.Mock).mockResolvedValue({ id: 't1', userId: 'u1' });
      (prisma.trade.delete as jest.Mock).mockResolvedValue({});

      await service.deleteTrade('u1', 't1');

      expect(prisma.trade.delete).toHaveBeenCalledWith({ where: { id: 't1' } });
    });

    it('should throw error when deleting non-existent trade', async () => {
      (prisma.trade.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.deleteTrade('u1', 'non-existent')).rejects.toThrow('Trade not found');
    });
  });
});
