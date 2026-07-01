/**
 * Quick smoke test: login + import generic sample CSV via API.
 * Usage: npx tsx scripts/verify-import-samples.ts
 */
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const API = `http://localhost:${process.env.PORT || 3001}/api/v1`;
const EMAIL = process.env.SEED_TEST_EMAIL || 'free@example.com';
const PASSWORD = process.env.SEED_PASSWORD || 'ChangeMeInDev123!';

async function login(): Promise<string> {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Login failed: ${JSON.stringify(json)}`);
  return json.data.accessToken as string;
}

function parseCsv(filePath: string) {
  const text = fs.readFileSync(filePath, 'utf-8');
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(',');
  const rows = lines.slice(1).map((line) => {
    const vals = line.split(',');
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h.trim()] = vals[i]?.trim() ?? ''; });
    return row;
  });
  return { headers, rows };
}

function toIso(dateStr: string): string {
  const d = new Date(dateStr.replace(/\./g, '-'));
  return d.toISOString();
}

function buildGenericPayload(rows: Record<string, string>[]) {
  return rows.map((r) => ({
    tradingSymbol: r.symbol.toUpperCase(),
    positionDirection: r.direction.toLowerCase() === 'short' ? 'short' : 'long',
    entryPrice: parseFloat(r.entryPrice),
    exitPrice: parseFloat(r.exitPrice),
    quantity: parseFloat(r.quantity),
    leverage: parseFloat(r.leverage || '1'),
    pnl: parseFloat(r.pnl),
    commission: parseFloat(r.commission || '0'),
    swap: r.swap ? parseFloat(r.swap) : undefined,
    pnlSource: 'broker' as const,
    entryTimestamp: toIso(r.entryTime),
    exitTimestamp: toIso(r.exitTime),
  }));
}

async function importTrades(token: string, body: object) {
  const res = await fetch(`${API}/trades/import`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
}

async function main() {
  console.log('🔐 Logging in...');
  const token = await login();
  console.log('✅ Login OK');

  const samplePath = path.join(__dirname, '..', '..', '..', 'samples', 'import', 'generic-trades.csv');
  const { rows } = parseCsv(samplePath);
  const trades = buildGenericPayload(rows);

  console.log(`📤 Importing ${trades.length} trades from generic-trades.csv...`);
  const result = await importTrades(token, {
    importSource: 'generic',
    sourceTimezone: 'UTC',
    defaultQuoteCurrency: 'USD',
    trades,
  });

  console.log(`Status: ${result.status}`);
  console.log(JSON.stringify(result.json, null, 2));

  if (!result.json.success) process.exit(1);
  console.log('✅ Import smoke test passed');
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
