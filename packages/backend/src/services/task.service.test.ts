/// <reference types="jest" />
import { TaskService, LEADERBOARD_MIN_TRADES } from './task.service';

jest.mock('../lib/prisma', () => ({
  prisma: {
    trade: { findMany: jest.fn() },
    user: { findUnique: jest.fn() },
    userPreference: { findMany: jest.fn() },
  },
}));

import { prisma } from '../lib/prisma';

function makeTrades(userId: string, count: number, pnl = 100, commission = 0) {
  return Array.from({ length: count }, (_, i) => ({
    userId,
    positionDirection: 'long',
    entryPrice: 100,
    exitPrice: 110,
    quantity: 10,
    leverage: 2,
    pnl,
    commission,
    swap: 0,
    quoteCurrency: 'USD',
    entryTimestamp: new Date(`2024-05-${String(i + 1).padStart(2, '0')}T10:00:00Z`),
    exitTimestamp: new Date(`2024-05-${String(i + 10).padStart(2, '0')}T10:00:00Z`),
  }));
}

describe('TaskService.getReturnRateLeaderboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-06-01T12:00:00Z'));
    (prisma.userPreference.findMany as jest.Mock).mockResolvedValue([
      { userId: 'user-a' },
      { userId: 'user-b' },
    ]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('ranks by net ROI with leverage; requires min trades and investment', async () => {
    (prisma.trade.findMany as jest.Mock).mockResolvedValue([
      ...makeTrades('user-a', LEADERBOARD_MIN_TRADES, 100, 10),
      ...makeTrades('user-b', LEADERBOARD_MIN_TRADES, 200, 0),
    ]);

    (prisma.user.findUnique as jest.Mock).mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve({
        id: where.id,
        displayName: where.id === 'user-a' ? 'Trader A' : 'Trader B',
        avatarUrl: null,
        email: `${where.id}@test.com`,
      }),
    );

    const result = await TaskService.getReturnRateLeaderboard(10, '3m');

    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result[0].userId).toBe('user-b');
    expect(result[0].platformCurrency).toBe('USD');
    expect(result[0].tradeCount).toBe(LEADERBOARD_MIN_TRADES);
  });

  it('excludes users with fewer than min trades', async () => {
    (prisma.trade.findMany as jest.Mock).mockResolvedValue(makeTrades('user-a', 2));
    const result = await TaskService.getReturnRateLeaderboard(10, '1m');
    expect(result).toEqual([]);
  });

  it('returns empty array when no qualifying trades', async () => {
    (prisma.trade.findMany as jest.Mock).mockResolvedValue([]);
    const result = await TaskService.getReturnRateLeaderboard(10, '1m');
    expect(result).toEqual([]);
  });
});
