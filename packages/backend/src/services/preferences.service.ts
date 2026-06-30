import { prisma } from '../lib/prisma';
import { Prisma, UserPreference } from '../generated/prisma';
import { isValidCurrency, isValidTimezone, type CalendarDayBasis } from '../utils/timezone';

/** Reserved key inside dashboardFilters for push notification toggle (no dedicated DB column yet). */
const PUSH_FILTER_KEY = '__notificationPush';

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  aiReports: boolean;
  profitAlerts: boolean;
  subscription?: boolean;
  playbook?: boolean;
}

/** API response shape — kept stable for frontend and notification service. */
export interface UserPreferencesApi {
  locale: string;
  /** @deprecated Use locale — alias kept for backward compatibility */
  language: string;
  timezone: string;
  /** IANA timezone for display and calendar day boundaries */
  displayTimezone: string;
  currency: string;
  /** ISO 4217 currency for dashboard/AI report aggregation */
  baseCurrency: string;
  calendarDayBasis: CalendarDayBasis;
  leaderboardOptIn: boolean;
  dashboardDefaultFilters: Record<string, unknown>;
  dashboardLayout: unknown[];
  notifications: NotificationPreferences;
}

export type UserPreferencesUpdate = Partial<{
  locale: string;
  language: string;
  timezone: string;
  displayTimezone: string;
  currency: string;
  baseCurrency: string;
  calendarDayBasis: CalendarDayBasis;
  leaderboardOptIn: boolean;
  dashboardDefaultFilters: Record<string, unknown>;
  dashboardLayout: unknown[];
  notifications: Partial<NotificationPreferences>;
}>;

const DEFAULT_NOTIFICATIONS: NotificationPreferences = {
  email: true,
  push: false,
  aiReports: true,
  profitAlerts: true,
};

function rowToApi(row: UserPreference): UserPreferencesApi {
  const rawFilters = (row.dashboardFilters as Record<string, unknown> | null) ?? {};
  const push = rawFilters[PUSH_FILTER_KEY] === true;
  const { [PUSH_FILTER_KEY]: _push, ...dashboardDefaultFilters } = rawFilters;
  const basis = row.calendarDayBasis === 'entry' ? 'entry' : 'exit';

  return {
    locale: row.locale,
    language: row.locale,
    timezone: row.timezone,
    displayTimezone: row.timezone,
    currency: row.currencyFormat,
    baseCurrency: row.currencyFormat,
    calendarDayBasis: basis,
    leaderboardOptIn: row.leaderboardOptIn,
    dashboardDefaultFilters,
    dashboardLayout: (row.dashboardLayout as unknown[]) ?? [],
    notifications: {
      email: row.notificationEmail,
      push,
      aiReports: row.notificationPlaybook,
      profitAlerts: row.notificationCreditsExpiring,
      subscription: row.notificationSubscription,
      playbook: row.notificationPlaybook,
    },
  };
}

export class PreferencesService {
  /** Ensure a preference row exists for the user. */
  static async ensureRow(userId: string): Promise<UserPreference> {
    return prisma.userPreference.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  static async get(userId: string): Promise<UserPreferencesApi> {
    const row = await this.ensureRow(userId);
    return rowToApi(row);
  }

  static async update(userId: string, prefs: UserPreferencesUpdate): Promise<UserPreferencesApi> {
    await this.ensureRow(userId);

    const data: Prisma.UserPreferenceUpdateInput = {};

    if (prefs.locale !== undefined || prefs.language !== undefined) {
      data.locale = prefs.locale ?? prefs.language!;
    }
    const tz = prefs.displayTimezone ?? prefs.timezone;
    if (tz !== undefined) {
      if (!isValidTimezone(tz)) {
        throw new Error('Invalid timezone');
      }
      data.timezone = tz;
    }
    const currency = prefs.baseCurrency ?? prefs.currency;
    if (currency !== undefined) {
      if (!isValidCurrency(currency)) {
        throw new Error('Invalid currency code');
      }
      data.currencyFormat = currency.toUpperCase();
    }
    if (prefs.calendarDayBasis !== undefined) {
      if (prefs.calendarDayBasis !== 'entry' && prefs.calendarDayBasis !== 'exit') {
        throw new Error('calendarDayBasis must be entry or exit');
      }
      data.calendarDayBasis = prefs.calendarDayBasis;
    }
    if (prefs.leaderboardOptIn !== undefined) {
      data.leaderboardOptIn = prefs.leaderboardOptIn;
    }
    if (prefs.dashboardLayout !== undefined) {
      data.dashboardLayout = prefs.dashboardLayout as Prisma.InputJsonValue;
    }

    const needsFilterUpdate =
      prefs.dashboardDefaultFilters !== undefined ||
      prefs.notifications?.push !== undefined;

    if (needsFilterUpdate) {
      const existing = await prisma.userPreference.findUnique({ where: { userId } });
      const filters: Record<string, unknown> = {
        ...((existing?.dashboardFilters as Record<string, unknown> | null) ?? {}),
      };

      if (prefs.dashboardDefaultFilters !== undefined) {
        for (const [key, value] of Object.entries(prefs.dashboardDefaultFilters)) {
          if (key !== PUSH_FILTER_KEY) {
            filters[key] = value;
          }
        }
      }
      if (prefs.notifications?.push !== undefined) {
        filters[PUSH_FILTER_KEY] = prefs.notifications.push;
      }

      data.dashboardFilters = filters as Prisma.InputJsonValue;
    }

    if (prefs.notifications) {
      const n = prefs.notifications;
      if (n.email !== undefined) data.notificationEmail = n.email;
      if (n.aiReports !== undefined) data.notificationPlaybook = n.aiReports;
      if (n.profitAlerts !== undefined) data.notificationCreditsExpiring = n.profitAlerts;
      if (n.subscription !== undefined) data.notificationSubscription = n.subscription;
      if (n.playbook !== undefined) data.notificationPlaybook = n.playbook;
    }

    const updated = await prisma.userPreference.update({
      where: { userId },
      data,
    });

    return rowToApi(updated);
  }

  static async reset(userId: string): Promise<UserPreferencesApi> {
    await prisma.userPreference.upsert({
      where: { userId },
      create: {
        userId,
        locale: 'en',
        timezone: 'UTC',
        currencyFormat: 'USD',
        calendarDayBasis: 'exit',
        leaderboardOptIn: true,
        notificationEmail: DEFAULT_NOTIFICATIONS.email,
        notificationSubscription: true,
        notificationPlaybook: DEFAULT_NOTIFICATIONS.aiReports,
        notificationCreditsExpiring: DEFAULT_NOTIFICATIONS.profitAlerts,
        dashboardFilters: {},
        dashboardLayout: [],
      },
      update: {
        locale: 'en',
        timezone: 'UTC',
        currencyFormat: 'USD',
        calendarDayBasis: 'exit',
        leaderboardOptIn: true,
        notificationEmail: DEFAULT_NOTIFICATIONS.email,
        notificationSubscription: true,
        notificationPlaybook: DEFAULT_NOTIFICATIONS.aiReports,
        notificationCreditsExpiring: DEFAULT_NOTIFICATIONS.profitAlerts,
        dashboardFilters: {},
        dashboardLayout: [],
      },
    });

    return this.get(userId);
  }
}
