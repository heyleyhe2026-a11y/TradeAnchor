/**
 * TradeWise Mock Seed Data Generator
 *
 * Generates realistic US stock and spot gold (XAU/USD) trading data
 * for testing the AI Reports and other features.
 *
 * Usage:
 *   npx ts-node --project tsconfig.json scripts/seed-mock-trades.ts
 *
 * Prerequisites:
 *   1. Backend server running (for API calls)
 *   2. Authenticated user (set ACCESS_TOKEN env var)
 *   3. Or run directly via Prisma: npx prisma db seed
 */

import { PrismaClient, PositionDirection } from '../src/generated/prisma';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

// ============================================================
// CONFIGURATION
// ============================================================

/** Your test user ID — replace with actual user ID from DB */
const TEST_USER_ID = process.env.TEST_USER_ID || '';

/** How many trades to generate per symbol */
const TRADES_PER_SYMBOL = 12;

/** How many days of history to cover */
const HISTORY_DAYS = 180;

// ============================================================
// US STOCK SYMBOLS — Realistic price ranges (USD)
// ============================================================

const US_STOCKS = [
  // Mega-cap tech
  { symbol: 'AAPL',  entryRange: [165, 195],  qtyRange: [50, 300],  avgSpread: 0.015, direction: 'long'  as PositionDirection },
  { symbol: 'MSFT',  entryRange: [330, 410],  qtyRange: [20, 150],  avgSpread: 0.014, direction: 'long'  as PositionDirection },
  { symbol: 'NVDA',  entryRange: [450, 880],  qtyRange: [10, 100],  avgSpread: 0.025, direction: 'long'  as PositionDirection },
  { symbol: 'GOOGL', entryRange: [125, 175],  qtyRange: [30, 200],  avgSpread: 0.013, direction: 'long'  as PositionDirection },
  { symbol: 'AMZN',  entryRange: [145, 200],  qtyRange: [20, 150],  avgSpread: 0.015, direction: 'long'  as PositionDirection },
  { symbol: 'META',  entryRange: [340, 530],  qtyRange: [10, 120],  avgSpread: 0.018, direction: 'long'  as PositionDirection },
  // High-volatility
  { symbol: 'TSLA',  entryRange: [170, 310],  qtyRange: [30, 200],  avgSpread: 0.030, direction: 'mixed'  as PositionDirection },
  { symbol: 'AMD',   entryRange: [120, 185],  qtyRange: [50, 300],  avgSpread: 0.028, direction: 'mixed'  as PositionDirection },
  { symbol: 'NFLX',  entryRange: [380, 620],  qtyRange: [5, 50],   avgSpread: 0.022, direction: 'long'  as PositionDirection },
  // Index ETFs
  { symbol: 'SPY',   entryRange: [440, 520],  qtyRange: [20, 100],  avgSpread: 0.008, direction: 'mixed'  as PositionDirection },
  { symbol: 'QQQ',   entryRange: [380, 460],  qtyRange: [20, 80],   avgSpread: 0.010, direction: 'long'  as PositionDirection },
];

// ============================================================
// SPOT GOLD — XAU/USD (prices in USD per troy ounce)
// ============================================================

const GOLD_SYMBOLS = [
  // XAU/USD spot — realistic 2024-2025 range $1,900-$2,700
  { symbol: 'XAUUSD', entryRange: [1920, 2680], qtyRange: [0.5, 5],   avgSpread: 0.003, direction: 'mixed'  as PositionDirection },
  // Gold mini futures style
  { symbol: 'MGC',    entryRange: [192, 268],    qtyRange: [5, 50],    avgSpread: 0.003, direction: 'mixed'  as PositionDirection },
];

// ============================================================
// UTILITIES
// ============================================================

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1));
}

function randDate(daysBack: number): Date {
  const now = new Date();
  const offset = randInt(0, daysBack);
  const d = new Date(now);
  d.setDate(d.getDate() - offset);
  // Random time during trading hours (9:30–16:00 EST = 14:30–21:00 UTC)
  d.setHours(randInt(14, 20), randInt(0, 59), randInt(0, 59), 0);
  return d;
}

/** Determine realistic win/loss outcome: ~55% wins, ~45% losses */
function generatePnL(
  entry: number,
  direction: PositionDirection,
  spread: number,
): { exit: number; pnl: number; isWin: boolean } {
  const isWin = Math.random() < 0.55;
  const spreadPct = spread * (0.5 + Math.random());
  const movePct = spreadPct * (isWin ? (1 + rand(0.5, 4)) : -(1 + rand(0.3, 3)));

  const exit =
    direction === 'long'
      ? entry * (1 + movePct)
      : entry * (1 - movePct);

  const rawPnl =
    direction === 'long'
      ? (exit - entry)
      : (entry - exit);

  return {
    exit: Math.round(exit * 10000) / 10000,
    pnl: Math.round(rawPnl * 10000) / 10000,
    isWin,
  };
}

/** Build 3 batch names that cover US stocks and gold */
async function ensureBatches(userId: string): Promise<{ stocksBatchId: string; goldBatchId: string }> {
  let stocksBatch = await prisma.batch.findFirst({ where: { userId, name: 'US Stocks Portfolio' } });
  if (!stocksBatch) {
    stocksBatch = await prisma.batch.create({
      data: {
        id: randomUUID(),
        userId,
        name: 'US Stocks Portfolio',
        description: 'Long/short positions in US equities — mega-cap tech, ETFs, high-volatility',
      },
    });
  }

  let goldBatch = await prisma.batch.findFirst({ where: { userId, name: 'Spot Gold (XAU/USD)' } });
  if (!goldBatch) {
    goldBatch = await prisma.batch.create({
      data: {
        id: randomUUID(),
        userId,
        name: 'Spot Gold (XAU/USD)',
        description: 'Spot gold and mini gold futures (MGC) swing trades',
      },
    });
  }

  return { stocksBatchId: stocksBatch.id, goldBatchId: goldBatch.id };
}

// ============================================================
// MAIN GENERATOR
// ============================================================

async function generateStockTrades(
  userId: string,
  batchId: string,
  config: typeof US_STOCKS[number],
): Promise<void> {
  console.log(`  Generating ${TRADES_PER_SYMBOL} trades for ${config.symbol}...`);

  for (let i = 0; i < TRADES_PER_SYMBOL; i++) {
    const entry = rand(config.entryRange[0], config.entryRange[1]);
    const qty   = rand(config.qtyRange[0],   config.qtyRange[1]);

    // 30% chance of holding a position open (no exit yet)
    const isOpen = Math.random() < 0.3;

    const direction: PositionDirection =
      config.direction === 'mixed'
        ? (Math.random() < 0.6 ? 'long' : 'short')
        : config.direction as PositionDirection;

    const entryTimestamp = randDate(HISTORY_DAYS);

    const { exit, pnl, isWin } = generatePnL(entry, direction, config.avgSpread);

    // For open positions, exitTimestamp is null
    const exitTimestamp = isOpen
      ? null
      : new Date(entryTimestamp.getTime() + randInt(30, 480) * 60 * 1000); // 30min–8hr

    // Gold/mini has fractional quantity — round to 2 decimals
    const quantity = config.symbol === 'XAUUSD' || config.symbol === 'MGC'
      ? Math.round(qty * 100) / 100
      : Math.round(qty);

    await prisma.trade.create({
      data: {
        id: randomUUID(),
        userId,
        batchId,
        tradingSymbol: config.symbol,
        positionDirection: direction,
        entryPrice: Math.round(entry * 10000) / 10000,
        exitPrice: isOpen ? null : exit,
        quantity,
        pnl: isOpen ? null : pnl * quantity,
        entryTimestamp,
        exitTimestamp,
      },
    });

    if (isOpen) {
      console.log(`    [OPEN]  ${config.symbol} ${direction.toUpperCase()} @ $${entry} × ${quantity}`);
    } else {
      const emoji = isWin ? '✅' : '❌';
      console.log(`    ${emoji} ${config.symbol} ${direction.toUpperCase()} @ $${entry} → $${exit.toFixed(2)} | P&L $${(pnl * quantity).toFixed(2)}`);
    }
  }
}

async function main() {
  if (!TEST_USER_ID) {
    console.error('❌ Please set TEST_USER_ID env var before running.\n');
    console.error('   Get your user ID from the database:');
    console.error('   SELECT id FROM users LIMIT 1;\n');
    process.exit(1);
  }

  console.log('🚀 TradeWise Mock Data Generator\n');
  console.log(`   User ID: ${TEST_USER_ID}`);
  console.log(`   Trades per symbol: ${TRADES_PER_SYMBOL}`);
  console.log(`   History window: ${HISTORY_DAYS} days\n`);

  // Verify user exists
  const user = await prisma.user.findUnique({ where: { id: TEST_USER_ID } });
  if (!user) {
    console.error(`❌ User ${TEST_USER_ID} not found in database.`);
    process.exit(1);
  }
  console.log(`   Logged in as: ${user.email}\n`);

  // Setup batches
  const { stocksBatchId, goldBatchId } = await ensureBatches(TEST_USER_ID);
  console.log(`   Stocks batch: ${stocksBatchId}`);
  console.log(`   Gold batch:   ${goldBatchId}\n`);

  // ----- US Stocks -----
  console.log('📈 Generating US Stock trades...');
  for (const stock of US_STOCKS) {
    await generateStockTrades(TEST_USER_ID, stocksBatchId, stock);
  }

  // ----- Spot Gold -----
  console.log('\n🥇 Generating Spot Gold trades...');
  for (const gold of GOLD_SYMBOLS) {
    await generateStockTrades(TEST_USER_ID, goldBatchId, gold);
  }

  // ----- Summary -----
  const totalTrades = await prisma.trade.count({ where: { userId: TEST_USER_ID } });
  const stats = await prisma.trade.groupBy({
    by: ['positionDirection'],
    where: { userId: TEST_USER_ID, pnl: { not: null } },
    _count: { _all: true },
    _sum:  { pnl: true },
  });

  console.log('\n✅ Seed complete!');
  console.log(`   Total trades: ${totalTrades}`);
  stats.forEach(s => {
    const dir = s.positionDirection === 'long' ? 'Long' : 'Short';
    console.log(`   ${dir}: ${s._count._all} trades | Net P&L: $${Number(s._sum.pnl || 0).toFixed(2)}`);
  });
  console.log('\n🎯 Ready to test AI Reports with realistic data!\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
