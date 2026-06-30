/**
 * Seed daily FX rates into fx_rates table.
 *
 * Usage:
 *   pnpm --filter @tradeanchor/backend db:seed:fx
 *   pnpm --filter @tradeanchor/backend db:seed:fx -- --days 90
 *   pnpm --filter @tradeanchor/backend db:seed:fx -- --source manual
 *
 * Default: fetch last 30 days from Frankfurter (ECB-based, no API key).
 */
import { randomUUID } from 'crypto';
import * as dotenv from 'dotenv';
import path from 'path';
import { PrismaClient } from '../src/generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const SUPPORTED = ['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'HKD', 'AUD', 'CAD', 'CHF', 'SGD'] as const;
const HUB = 'USD';

/** Fallback static rates (1 USD = X) for offline `--source manual`. */
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

function parseArgs() {
  const args = process.argv.slice(2);
  let days = 30;
  let source: 'frankfurter' | 'manual' = 'frankfurter';
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--days' && args[i + 1]) days = Math.max(1, parseInt(args[++i], 10));
    if (args[i] === '--source' && args[i + 1]) source = args[++i] as 'frankfurter' | 'manual';
  }
  return { days, source };
}

function utcDateOnly(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Build all cross rates for a day from USD hub quotes (1 USD = usdTo[currency]). */
function buildCrossRates(usdTo: Record<string, number>): Array<{ from: string; to: string; rate: number }> {
  const pairs: Array<{ from: string; to: string; rate: number }> = [];
  const currencies = SUPPORTED.filter((c) => c !== HUB);

  for (const to of currencies) {
    if (usdTo[to] != null) {
      pairs.push({ from: HUB, to, rate: usdTo[to] });
    }
  }

  for (const from of SUPPORTED) {
    for (const to of SUPPORTED) {
      if (from === to) continue;
      if (from === HUB || to === HUB) continue;
      const usdFrom = from === HUB ? 1 : usdTo[from];
      const usdToRate = to === HUB ? 1 : usdTo[to];
      if (!usdFrom || !usdToRate) continue;
      // 1 FROM = (usdToRate / usdFrom) TO
      pairs.push({ from, to, rate: usdToRate / usdFrom });
    }
  }

  return pairs;
}

async function fetchFrankfurterRange(days: number): Promise<Map<string, Record<string, number>>> {
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 1); // ECB lags ~1 day
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (days - 1));

  const targets = SUPPORTED.filter((c) => c !== HUB).join(',');
  const url =
    `https://api.frankfurter.app/${formatDate(start)}..${formatDate(end)}` +
    `?from=${HUB}&to=${targets}`;

  console.log(`Fetching: ${url}`);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Frankfurter API ${res.status}: ${await res.text()}`);
  }

  const body = (await res.json()) as {
    rates: Record<string, Record<string, number>>;
  };

  const byDate = new Map<string, Record<string, number>>();
  for (const [date, quotes] of Object.entries(body.rates)) {
    byDate.set(date, { ...quotes, USD: 1 });
  }
  return byDate;
}

async function main() {
  const { days, source } = parseArgs();

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Copy .env.example → .env first.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool), log: ['error'] });

  try {
    let byDate = new Map<string, Record<string, number>>();

    if (source === 'manual') {
      const today = utcDateOnly(new Date());
      for (let i = 0; i < days; i++) {
        const d = new Date(today);
        d.setUTCDate(d.getUTCDate() - i);
        byDate.set(formatDate(d), { ...MANUAL_USD_RATES, USD: 1 });
      }
      console.log(`Using manual USD hub rates for ${byDate.size} day(s).`);
    } else {
      byDate = await fetchFrankfurterRange(days);
      console.log(`Fetched ${byDate.size} day(s) from Frankfurter.`);
    }

    let upserted = 0;

    for (const [dateStr, usdTo] of byDate.entries()) {
      const rateDate = utcDateOnly(new Date(`${dateStr}T00:00:00.000Z`));
      const pairs = buildCrossRates(usdTo);

      for (const { from, to, rate } of pairs) {
        await prisma.fxRate.upsert({
          where: {
            rateDate_fromCurrency_toCurrency: {
              rateDate,
              fromCurrency: from,
              toCurrency: to,
            },
          },
          create: {
            id: randomUUID(),
            rateDate,
            fromCurrency: from,
            toCurrency: to,
            rate,
            source: source === 'manual' ? 'manual' : 'ecb',
          },
          update: {
            rate,
            source: source === 'manual' ? 'manual' : 'ecb',
          },
        });
        upserted++;
      }
    }

    console.log(`✅ FX seed complete: ${upserted} rate rows upserted across ${byDate.size} day(s).`);
    console.log(`   Currencies: ${SUPPORTED.join(', ')}`);
    console.log(`   Re-run safely — upserts are idempotent.`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error('❌ FX seed failed:', err);
  process.exit(1);
});
