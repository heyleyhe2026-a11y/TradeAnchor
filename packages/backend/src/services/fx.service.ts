import { prisma } from '../lib/prisma';

/** Platform currency for cross-user leaderboard comparison. */
export const PLATFORM_CURRENCY = 'USD';

/** Offline fallback (1 USD = X) when fx_rates table has no row. */
const MANUAL_USD_RATES: Record<string, number> = {
  EUR: 0.92,
  GBP: 0.79,
  JPY: 149.5,
  CNY: 7.24,
  HKD: 7.82,
  AUD: 1.53,
  CAD: 1.36,
  CHF: 0.88,
  SGD: 1.34,
};

function utcDateOnly(d: Date): Date {
  const day = new Date(d);
  day.setUTCHours(0, 0, 0, 0);
  return day;
}

export class FxService {
  /**
   * Multiplier: amount_in_from × rate = amount_in_to.
   * Falls back to nearest prior date, then latest stored rate.
   */
  static async lookupRateMultiplier(
    fromCurrency: string,
    toCurrency: string,
    rateDate: Date,
  ): Promise<number | null> {
    const from = fromCurrency.toUpperCase();
    const to = toCurrency.toUpperCase();
    if (from === to) return 1;

    const day = utcDateOnly(rateDate);

    const findMultiplier = async (onOrBefore?: Date): Promise<number | null> => {
      const dateFilter = onOrBefore ? { rateDate: { lte: onOrBefore } } : {};

      const direct = await prisma.fxRate.findFirst({
        where: { fromCurrency: from, toCurrency: to, ...dateFilter },
        orderBy: { rateDate: 'desc' },
      });
      if (direct) return Number(direct.rate);

      const inverse = await prisma.fxRate.findFirst({
        where: { fromCurrency: to, toCurrency: from, ...dateFilter },
        orderBy: { rateDate: 'desc' },
      });
      if (inverse && Number(inverse.rate) !== 0) {
        return 1 / Number(inverse.rate);
      }
      return null;
    };

    const dbRate = (await findMultiplier(day)) ?? (await findMultiplier());
    if (dbRate != null) return dbRate;

    return this.manualRateMultiplier(from, to);
  }

  /** USD-hub static rates for dev / missing ECB data. */
  private static manualRateMultiplier(from: string, to: string): number | null {
    const fromU = from.toUpperCase();
    const toU = to.toUpperCase();
    if (fromU === toU) return 1;

    const fromPerUsd = fromU === 'USD' ? 1 : MANUAL_USD_RATES[fromU];
    const toPerUsd = toU === 'USD' ? 1 : MANUAL_USD_RATES[toU];
    if (!fromPerUsd || !toPerUsd) return null;

    // amount_in_from × (toPerUsd / fromPerUsd) = amount_in_to
    return toPerUsd / fromPerUsd;
  }

  /**
   * Convert amount from one currency to another using stored daily rate.
   * Returns amount unchanged when currencies match.
   * Throws when no rate is available (Phase 2 strict mode).
   */
  static async convert(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    rateDate: Date,
  ): Promise<number> {
    const from = fromCurrency.toUpperCase();
    const to = toCurrency.toUpperCase();
    if (from === to) return amount;
    if (!Number.isFinite(amount)) return 0;

    const multiplier = await this.lookupRateMultiplier(from, to, rateDate);
    if (multiplier == null) {
      throw new Error(
        `No FX rate for ${from}→${to} on ${utcDateOnly(rateDate).toISOString().slice(0, 10)}`,
      );
    }
    return amount * multiplier;
  }

  /** Convert when rate exists; otherwise return null (caller decides fallback). */
  static async tryConvert(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    rateDate: Date,
  ): Promise<number | null> {
    const from = fromCurrency.toUpperCase();
    const to = toCurrency.toUpperCase();
    if (from === to) return amount;
    if (!Number.isFinite(amount)) return 0;

    const multiplier = await this.lookupRateMultiplier(from, to, rateDate);
    if (multiplier == null) return null;
    return amount * multiplier;
  }

  static async upsertRate(
    rateDate: Date,
    fromCurrency: string,
    toCurrency: string,
    rate: number,
    source = 'manual',
  ) {
    const day = new Date(rateDate);
    day.setUTCHours(0, 0, 0, 0);
    return prisma.fxRate.upsert({
      where: {
        rateDate_fromCurrency_toCurrency: {
          rateDate: day,
          fromCurrency: fromCurrency.toUpperCase(),
          toCurrency: toCurrency.toUpperCase(),
        },
      },
      create: {
        rateDate: day,
        fromCurrency: fromCurrency.toUpperCase(),
        toCurrency: toCurrency.toUpperCase(),
        rate,
        source,
      },
      update: { rate, source },
    });
  }
}
