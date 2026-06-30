import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  autoMapColumns,
  CTRADER_VOLUME_UNITS_PER_LOT,
  getBrokerPreset,
  normalizeBrokerImportAmounts,
  normalizeBrokerImportQuantity,
  resolveDirection,
} from './brokerPresets';
import { dedupeHeaders, findHeaderRowIndex, parseImportCsv } from './csvImport';

const samplesDir = join(__dirname, '../../../../samples/import');

describe('broker import presets', () => {
  it('maps MT4 account history with separate open/close columns', () => {
    const csv = readFileSync(join(samplesDir, 'mt4-trades.csv'), 'utf8');
    const { headers, rows } = parseImportCsv(csv, 'mt4');
    const mapping = autoMapColumns(headers, getBrokerPreset('mt4'));

    expect(mapping.symbol).toBe('Item');
    expect(mapping.direction).toBe('Type');
    expect(mapping.entryPrice).toBe('Open Price');
    expect(mapping.exitPrice).toBe('Close Price');
    expect(mapping.entryDate).toBe('Open Time');
    expect(mapping.exitDate).toBe('Close Time');
    expect(rows.length).toBe(7);
  });

  it('maps MT5 native position history columns including duplicate Time/Price', () => {
    const csv = readFileSync(join(samplesDir, 'mt5-trades.csv'), 'utf8');
    const { headers, rows } = parseImportCsv(csv, 'mt5');
    const mapping = autoMapColumns(headers, getBrokerPreset('mt5'));

    expect(headers).toContain('Time__2');
    expect(headers).toContain('Price__2');
    expect(mapping.symbol).toBe('Symbol');
    expect(mapping.direction).toBe('Type');
    expect(mapping.entryDate).toBe('Time');
    expect(mapping.exitDate).toBe('Time__2');
    expect(mapping.entryPrice).toBe('Price');
    expect(mapping.exitPrice).toBe('Price__2');
    expect(rows.length).toBeGreaterThan(0);
  });

  it('maps cTrader closed positions export', () => {
    const csv = readFileSync(join(samplesDir, 'ctrader-trades.csv'), 'utf8');
    const { headers } = parseImportCsv(csv, 'ctrader');
    const mapping = autoMapColumns(headers, getBrokerPreset('ctrader'));

    expect(mapping.symbol).toBe('Symbol');
    expect(mapping.direction).toBe('Direction');
    expect(mapping.entryPrice).toBe('Entry Price');
    expect(mapping.exitPrice).toBe('Close Price');
    expect(mapping.entryDate).toBe('Opening Time');
    expect(mapping.exitDate).toBe('Closing Time');
    expect(mapping.pnl).toBe('Gross profit');
    expect(resolveDirection('Buy', getBrokerPreset('ctrader'))).toBe('long');
  });

  it('maps IBKR Flex Query closed lots and infers long from closing SELL', () => {
    const csv = readFileSync(join(samplesDir, 'ibkr-trades.csv'), 'utf8');
    const { headers } = parseImportCsv(csv, 'ibkr');
    const mapping = autoMapColumns(headers, getBrokerPreset('ibkr'));

    expect(mapping.symbol).toBe('Symbol');
    expect(mapping.direction).toBe('Buy/Sell');
    expect(mapping.entryDate).toBe('OpenDateTime');
    expect(mapping.exitDate).toBe('Date/Time');
    expect(mapping.costBasis).toBe('CostBasis');
    expect(mapping.exitPrice).toBe('ClosePrice');
    expect(resolveDirection('SELL', getBrokerPreset('ibkr'))).toBe('long');
    expect(resolveDirection('BUY', getBrokerPreset('ibkr'))).toBe('short');
  });

  it('skips Schwab account prefix rows and maps Realized Gain/Loss columns', () => {
    const csv = readFileSync(join(samplesDir, 'schwab-trades.csv'), 'utf8');
    const lines = csv.trim().split(/\r?\n/);
    expect(findHeaderRowIndex(lines, 'schwab')).toBe(4);

    const { headers } = parseImportCsv(csv, 'schwab');
    const mapping = autoMapColumns(headers, getBrokerPreset('schwab'));

    expect(mapping.symbol).toBe('Symbol');
    expect(mapping.entryPrice).toBe('Cost Per Share');
    expect(mapping.exitPrice).toBe('Proceeds Per Share');
    expect(mapping.entryDate).toBe('Acquired/Opened Date');
    expect(mapping.exitDate).toBe('Closed Date/Time');
    expect(resolveDirection('', getBrokerPreset('schwab'))).toBe('long');
  });

  it('skips Futu prefix rows and maps Chinese column headers', () => {
    const csv = readFileSync(join(samplesDir, 'futu-trades.csv'), 'utf8');
    const lines = csv.trim().split(/\r?\n/);
    expect(findHeaderRowIndex(lines, 'futu')).toBe(4);

    const { headers } = parseImportCsv(csv, 'futu');
    const mapping = autoMapColumns(headers, getBrokerPreset('futu'));

    expect(mapping.symbol).toBe('代码');
    expect(mapping.entryPrice).toBe('买入均价');
    expect(mapping.exitPrice).toBe('卖出均价');
    expect(mapping.entryDate).toBe('建仓时间');
    expect(mapping.exitDate).toBe('平仓时间');
    expect(mapping.pnl).toBe('已实现盈亏');
    expect(resolveDirection('', getBrokerPreset('futu'))).toBe('long');
  });

  it('maps Tiger Brokers export with Chinese headers', () => {
    const csv = readFileSync(join(samplesDir, 'tiger-trades.csv'), 'utf8');
    const { headers } = parseImportCsv(csv, 'tiger');
    const mapping = autoMapColumns(headers, getBrokerPreset('tiger'));

    expect(mapping.symbol).toBe('代码');
    expect(mapping.entryDate).toBe('建仓时间');
    expect(mapping.exitDate).toBe('平仓时间');
    expect(headers.length).toBeGreaterThan(5);
  });

  it('normalizes MT4 negative commission and net profit to gross pnl', () => {
    const result = normalizeBrokerImportAmounts('mt4', {
      pnl: 65,
      commission: -2,
      swap: -0.5,
    });
    expect(result.commission).toBe(2);
    expect(result.swap).toBe(0.5);
    expect(result.pnl).toBe(67.5);
  });

  it('converts cTrader Volume units to lots for forex and metals', () => {
    const preset = getBrokerPreset('ctrader');
    expect(normalizeBrokerImportQuantity(preset, 'EURUSD', 100_000)).toBe(1);
    expect(normalizeBrokerImportQuantity(preset, 'AUDUSD', 300_000)).toBe(3);
    expect(normalizeBrokerImportQuantity(preset, 'XAUUSD', 50_000)).toBe(0.5);
    expect(normalizeBrokerImportQuantity(preset, 'EURUSD', 1.5)).toBe(1.5);
    expect(normalizeBrokerImportQuantity(preset, 'AAPL', 100)).toBe(100);
    expect(CTRADER_VOLUME_UNITS_PER_LOT).toBe(100_000);
  });

  it('keeps cTrader gross profit when commission and swap are present', () => {
    const result = normalizeBrokerImportAmounts('ctrader', {
      pnl: 700,
      commission: -2,
      swap: -0.5,
    });
    expect(result.pnl).toBe(700);
    expect(result.commission).toBe(2);
    expect(result.swap).toBe(0.5);
  });
});
