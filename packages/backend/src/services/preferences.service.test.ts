/// <reference types="jest" />
import { PreferencesService } from './preferences.service';

jest.mock('../lib/prisma', () => ({
  prisma: {
    userPreference: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

import { prisma } from '../lib/prisma';

const userId = 'user-123';

const dbRow = {
  userId,
  locale: 'zh',
  timezone: 'Asia/Shanghai',
  currencyFormat: 'CNY',
  calendarDayBasis: 'exit',
  leaderboardOptIn: true,
  notificationEmail: false,
  notificationSubscription: true,
  notificationPlaybook: false,
  notificationCreditsExpiring: true,
  dashboardFilters: { symbol: 'AAPL', __notificationPush: true },
  dashboardLayout: [{ id: 'chart' }],
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('PreferencesService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('get', () => {
    it('returns API shape mapped from user_preferences row', async () => {
      (prisma.userPreference.upsert as jest.Mock).mockResolvedValue(dbRow);

      const result = await PreferencesService.get(userId);

      expect(prisma.userPreference.upsert).toHaveBeenCalledWith({
        where: { userId },
        create: { userId },
        update: {},
      });
      expect(result).toEqual({
        locale: 'zh',
        language: 'zh',
        timezone: 'Asia/Shanghai',
        displayTimezone: 'Asia/Shanghai',
        currency: 'CNY',
        baseCurrency: 'CNY',
        calendarDayBasis: 'exit',
        leaderboardOptIn: true,
        dashboardDefaultFilters: { symbol: 'AAPL' },
        dashboardLayout: [{ id: 'chart' }],
        notifications: {
          email: false,
          push: true,
          aiReports: false,
          profitAlerts: true,
          subscription: true,
          playbook: false,
        },
      });
    });
  });

  describe('update', () => {
    it('maps notification toggles to DB columns', async () => {
      (prisma.userPreference.upsert as jest.Mock).mockResolvedValue(dbRow);
      (prisma.userPreference.findUnique as jest.Mock).mockResolvedValue(dbRow);
      (prisma.userPreference.update as jest.Mock).mockResolvedValue({
        ...dbRow,
        notificationEmail: true,
        notificationPlaybook: true,
        notificationCreditsExpiring: false,
        dashboardFilters: { symbol: 'AAPL', __notificationPush: false },
      });

      const result = await PreferencesService.update(userId, {
        notifications: {
          email: true,
          push: false,
          aiReports: true,
          profitAlerts: false,
        },
      });

      expect(prisma.userPreference.update).toHaveBeenCalledWith({
        where: { userId },
        data: expect.objectContaining({
          notificationEmail: true,
          notificationPlaybook: true,
          notificationCreditsExpiring: false,
          dashboardFilters: expect.objectContaining({
            symbol: 'AAPL',
            __notificationPush: false,
          }),
        }),
      });
      expect(result.notifications.email).toBe(true);
      expect(result.notifications.push).toBe(false);
      expect(result.notifications.aiReports).toBe(true);
      expect(result.notifications.profitAlerts).toBe(false);
    });

    it('maps currency and timezone to DB fields', async () => {
      (prisma.userPreference.upsert as jest.Mock).mockResolvedValue(dbRow);
      (prisma.userPreference.update as jest.Mock).mockResolvedValue({
        ...dbRow,
        timezone: 'America/New_York',
        currencyFormat: 'USD',
      });

      const result = await PreferencesService.update(userId, {
        timezone: 'America/New_York',
        currency: 'USD',
      });

      expect(prisma.userPreference.update).toHaveBeenCalledWith({
        where: { userId },
        data: {
          timezone: 'America/New_York',
          currencyFormat: 'USD',
        },
      });
      expect(result.timezone).toBe('America/New_York');
      expect(result.currency).toBe('USD');
    });
  });

  describe('reset', () => {
    it('restores defaults in user_preferences table', async () => {
      (prisma.userPreference.upsert as jest.Mock)
        .mockResolvedValueOnce({ userId })
        .mockResolvedValueOnce({
          userId,
          locale: 'en',
          timezone: 'UTC',
          currencyFormat: 'USD',
          notificationEmail: true,
          notificationSubscription: true,
          notificationPlaybook: true,
          notificationCreditsExpiring: true,
          dashboardFilters: {},
          dashboardLayout: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        });

      const result = await PreferencesService.reset(userId);

      expect(prisma.userPreference.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId },
          update: expect.objectContaining({
            locale: 'en',
            timezone: 'UTC',
            currencyFormat: 'USD',
            notificationEmail: true,
          }),
        }),
      );
      expect(result.locale).toBe('en');
      expect(result.notifications.email).toBe(true);
      expect(result.notifications.push).toBe(false);
    });
  });
});
