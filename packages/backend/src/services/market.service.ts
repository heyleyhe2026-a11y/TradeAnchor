import { prisma } from '../lib/prisma';
import { getRedisClient } from '../lib/redis';
import logger from '../lib/logger';
import { ApiError } from '../middleware/error.middleware';
import {
  cacheTtlSeconds,
  defaultOutputSize,
  normalizeUserSymbol,
  parseChartInterval,
  searchLocalSymbols,
  toTwelveDataSymbol,
  type ChartInterval,
} from './market/symbol-resolver';
import { twelveDataClient, type CandleBar, type SymbolSearchHit, type MarketQuote } from './market/twelvedata.client';

export interface MarketSymbolItem {
  symbol: string;
  tradeCount: number;
  providerSymbol: string;
}

export interface MarketCandlesResult {
  symbol: string;
  providerSymbol: string;
  interval: ChartInterval;
  candles: CandleBar[];
  cached: boolean;
}

export type { SymbolSearchHit, MarketQuote };

class MarketService {
  async getUserSymbols(userId: string): Promise<MarketSymbolItem[]> {
    const rows = await prisma.trade.groupBy({
      by: ['tradingSymbol'],
      where: { userId },
      _count: { _all: true },
      orderBy: { _count: { tradingSymbol: 'desc' } },
    });

    return rows.map((row) => {
      const symbol = row.tradingSymbol;
      return {
        symbol,
        tradeCount: row._count._all,
        providerSymbol: toTwelveDataSymbol(symbol),
      };
    });
  }

  async getCandles(
    symbol: string,
    intervalInput: string,
    outputsizeInput?: number,
  ): Promise<MarketCandlesResult> {
    if (!twelveDataClient.isConfigured()) {
      throw new ApiError(503, 'Market data provider is not configured', 'MARKET_NOT_CONFIGURED');
    }

    const interval = parseChartInterval(intervalInput);
    if (!interval) {
      throw new ApiError(400, 'Invalid interval', 'INVALID_INTERVAL');
    }

    const compact = normalizeUserSymbol(symbol);
    if (!compact) {
      throw new ApiError(400, 'Symbol is required', 'SYMBOL_REQUIRED');
    }

    const providerSymbol = toTwelveDataSymbol(symbol);
    const outputsize = outputsizeInput ?? defaultOutputSize(interval);
    const cacheKey = `market:candles:${providerSymbol}:${interval}:${outputsize}`;

    try {
      const redis = getRedisClient();
      const cached = await redis.get(cacheKey);
      if (cached) {
        const candles = JSON.parse(cached) as CandleBar[];
        return { symbol, providerSymbol, interval, candles, cached: true };
      }
    } catch (err) {
      logger.warn('Market cache read failed', { error: err instanceof Error ? err.message : err });
    }

    const candles = await twelveDataClient.fetchTimeSeries(providerSymbol, interval, outputsize);

    try {
      const redis = getRedisClient();
      await redis.setex(cacheKey, cacheTtlSeconds(interval), JSON.stringify(candles));
    } catch (err) {
      logger.warn('Market cache write failed', { error: err instanceof Error ? err.message : err });
    }

    return { symbol, providerSymbol, interval, candles, cached: false };
  }

  async searchSymbols(userId: string, query: string): Promise<SymbolSearchHit[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const cacheKey = `market:search:${trimmed.toUpperCase()}`;
    try {
      const redis = getRedisClient();
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as SymbolSearchHit[];
      }
    } catch (err) {
      logger.warn('Market search cache read failed', { error: err instanceof Error ? err.message : err });
    }

    const userSymbols = await this.getUserSymbols(userId);
    const localHits = searchLocalSymbols(trimmed, userSymbols.map((s) => s.symbol));
    const merged: SymbolSearchHit[] = localHits.map((item) => ({
      symbol: item.symbol,
      providerSymbol: item.providerSymbol,
      name: item.name,
      exchange: item.exchange,
    }));

    const seen = new Set(merged.map((item) => item.providerSymbol.toUpperCase()));

    if (twelveDataClient.isConfigured()) {
      try {
        const remote = await twelveDataClient.searchSymbols(trimmed, 20);
        for (const hit of remote) {
          const key = hit.providerSymbol.toUpperCase();
          if (seen.has(key)) continue;
          seen.add(key);
          merged.push(hit);
        }
      } catch (err) {
        logger.warn('Market symbol search remote failed', {
          query: trimmed,
          error: err instanceof Error ? err.message : err,
        });
      }
    }

    const results = merged.slice(0, 20);

    try {
      const redis = getRedisClient();
      await redis.setex(cacheKey, 3600, JSON.stringify(results));
    } catch (err) {
      logger.warn('Market search cache write failed', { error: err instanceof Error ? err.message : err });
    }

    return results;
  }

  async getQuote(symbol: string): Promise<MarketQuote & { cached: boolean }> {
    if (!twelveDataClient.isConfigured()) {
      throw new ApiError(503, 'Market data provider is not configured', 'MARKET_NOT_CONFIGURED');
    }

    const compact = normalizeUserSymbol(symbol);
    if (!compact) {
      throw new ApiError(400, 'Symbol is required', 'SYMBOL_REQUIRED');
    }

    const providerSymbol = toTwelveDataSymbol(symbol);
    const cacheKey = `market:quote:${providerSymbol}`;

    try {
      const redis = getRedisClient();
      const cached = await redis.get(cacheKey);
      if (cached) {
        const quote = JSON.parse(cached) as MarketQuote;
        return { ...quote, cached: true };
      }
    } catch (err) {
      logger.warn('Market quote cache read failed', { error: err instanceof Error ? err.message : err });
    }

    const quote = await twelveDataClient.fetchQuote(providerSymbol);

    try {
      const redis = getRedisClient();
      await redis.setex(cacheKey, 2, JSON.stringify(quote));
    } catch (err) {
      logger.warn('Market quote cache write failed', { error: err instanceof Error ? err.message : err });
    }

    return { ...quote, symbol, providerSymbol, cached: false };
  }
}

export const marketService = new MarketService();
