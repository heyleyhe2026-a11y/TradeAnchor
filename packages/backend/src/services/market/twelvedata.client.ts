import logger from '../../lib/logger';
import { toTwelveDataInterval, type ChartInterval } from './symbol-resolver';

export interface CandleBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface SymbolSearchHit {
  symbol: string;
  providerSymbol: string;
  name: string;
  exchange?: string;
  instrumentType?: string;
}

export interface MarketQuote {
  symbol: string;
  providerSymbol: string;
  bid: number;
  ask: number;
  mid: number;
  spread: number;
  /** True when bid/ask were estimated from last price (provider has no B/A). */
  spreadEstimated: boolean;
  timestamp: number;
}

interface TwelveDataCandleRow {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume?: string;
}

interface TwelveDataSeriesResponse {
  status?: string;
  code?: number;
  message?: string;
  meta?: { symbol?: string; interval?: string; exchange_timezone?: string };
  values?: TwelveDataCandleRow[];
}

function parseCandleTime(datetime: string): number {
  // Twelve Data returns "YYYY-MM-DD HH:mm:ss" or "YYYY-MM-DD"
  const normalized = datetime.includes('T') ? datetime : datetime.replace(' ', 'T');
  const ms = Date.parse(normalized.endsWith('Z') ? normalized : `${normalized}Z`);
  if (!Number.isFinite(ms)) {
    return Math.floor(Date.parse(datetime) / 1000);
  }
  return Math.floor(ms / 1000);
}

export class TwelveDataClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor() {
    this.apiKey = process.env.TWELVEDATA_API_KEY || '';
    this.baseUrl = (process.env.TWELVEDATA_BASE_URL || 'https://api.twelvedata.com').replace(/\/$/, '');
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async fetchTimeSeries(
    symbol: string,
    interval: ChartInterval,
    outputsize: number,
  ): Promise<CandleBar[]> {
    if (!this.apiKey) {
      throw new Error('TWELVEDATA_API_KEY is not configured');
    }

    const params = new URLSearchParams({
      symbol,
      interval: toTwelveDataInterval(interval),
      outputsize: String(Math.min(Math.max(outputsize, 30), 5000)),
      apikey: this.apiKey,
      timezone: 'UTC',
    });

    const url = `${this.baseUrl}/time_series?${params.toString()}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    const body = (await res.json()) as TwelveDataSeriesResponse;

    if (!res.ok || body.status === 'error') {
      const msg = body.message || `Twelve Data HTTP ${res.status}`;
      logger.warn('Twelve Data time_series error', { symbol, interval, message: msg, code: body.code });
      throw new Error(msg);
    }

    const rows = body.values || [];
    const candles = rows
      .map((row) => ({
        time: parseCandleTime(row.datetime),
        open: Number(row.open),
        high: Number(row.high),
        low: Number(row.low),
        close: Number(row.close),
        volume: row.volume != null ? Number(row.volume) : undefined,
      }))
      .filter((c) => Number.isFinite(c.open) && Number.isFinite(c.close))
      .sort((a, b) => a.time - b.time);

    return candles;
  }

  async searchSymbols(query: string, limit = 20): Promise<SymbolSearchHit[]> {
    if (!this.apiKey) {
      throw new Error('TWELVEDATA_API_KEY is not configured');
    }

    const trimmed = query.trim();
    if (!trimmed) return [];

    const params = new URLSearchParams({
      symbol: trimmed,
      outputsize: String(Math.min(Math.max(limit, 1), 30)),
      apikey: this.apiKey,
    });

    const url = `${this.baseUrl}/symbol_search?${params.toString()}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    const body = (await res.json()) as {
      data?: Array<{
        symbol?: string;
        instrument_name?: string;
        exchange?: string;
        instrument_type?: string;
      }>;
      status?: string;
      message?: string;
    };

    if (!res.ok || body.status === 'error') {
      const msg = body.message || `Twelve Data HTTP ${res.status}`;
      logger.warn('Twelve Data symbol_search error', { query: trimmed, message: msg });
      throw new Error(msg);
    }

    return (body.data || [])
      .filter((row) => row.symbol)
      .map((row) => ({
        symbol: row.symbol!,
        providerSymbol: row.symbol!,
        name: row.instrument_name || row.symbol!,
        exchange: row.exchange,
        instrumentType: row.instrument_type,
      }));
  }

  async fetchQuote(symbol: string): Promise<MarketQuote> {
    if (!this.apiKey) {
      throw new Error('TWELVEDATA_API_KEY is not configured');
    }

    const params = new URLSearchParams({ symbol, apikey: this.apiKey });
    const url = `${this.baseUrl}/quote?${params.toString()}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    const body = (await res.json()) as {
      symbol?: string;
      close?: string;
      bid?: string;
      ask?: string;
      timestamp?: number;
      datetime?: string;
      status?: string;
      message?: string;
    };

    if (!res.ok || body.status === 'error') {
      const msg = body.message || `Twelve Data HTTP ${res.status}`;
      logger.warn('Twelve Data quote error', { symbol, message: msg });
      throw new Error(msg);
    }

    const close = Number(body.close);
    let bid = Number(body.bid);
    let ask = Number(body.ask);
    let spreadEstimated = false;

    if (!Number.isFinite(bid) || !Number.isFinite(ask)) {
      if (!Number.isFinite(close)) {
        throw new Error('Quote price unavailable');
      }
      const spreadPct = symbol.includes('/') ? 0.00015 : 0.001;
      const half = close * spreadPct * 0.5;
      bid = close - half;
      ask = close + half;
      spreadEstimated = true;
    }

    const mid = (bid + ask) / 2;
    const ts = body.timestamp
      ? body.timestamp
      : body.datetime
        ? Math.floor(Date.parse(body.datetime.replace(' ', 'T') + 'Z') / 1000)
        : Math.floor(Date.now() / 1000);

    return {
      symbol,
      providerSymbol: body.symbol || symbol,
      bid,
      ask,
      mid,
      spread: ask - bid,
      spreadEstimated,
      timestamp: ts,
    };
  }
}

export const twelveDataClient = new TwelveDataClient();
