import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

export type ChartInterval = 'M1' | 'M5' | 'M15' | 'M30' | 'H1' | 'H4' | 'D1' | 'W1';

export type IndicatorId = 'sma20' | 'ema20' | 'rsi14' | 'macd' | 'bb20';

export interface MarketSymbolItem {
  symbol: string;
  tradeCount: number;
  providerSymbol: string;
}

export interface CandleBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface MarketCandlesResponse {
  symbol: string;
  providerSymbol: string;
  interval: ChartInterval;
  candles: CandleBar[];
  cached: boolean;
}

export interface SymbolSearchHit {
  symbol: string;
  providerSymbol: string;
  name: string;
  exchange?: string;
  instrumentType?: string;
}

export interface MarketQuoteResponse {
  symbol: string;
  providerSymbol: string;
  bid: number;
  ask: number;
  mid: number;
  spread: number;
  spreadEstimated: boolean;
  timestamp: number;
  cached: boolean;
}

export const CHART_INTERVALS: ChartInterval[] = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1'];

/** Tag for user trade-derived symbol list; separate from candle cache tags. */
export const MARKET_SYMBOLS_TAG = { type: 'Market' as const, id: 'SYMBOLS' };

export const marketApi = createApi({
  reducerPath: 'marketApi',
  baseQuery: fetchBaseQuery({
    baseUrl: API_BASE,
    prepareHeaders: (headers) => {
      const token = localStorage.getItem('accessToken');
      if (token) headers.set('Authorization', `Bearer ${token}`);
      return headers;
    },
  }),
  tagTypes: ['Market'],
  endpoints: (builder) => ({
    getMarketSymbols: builder.query<{ symbols: MarketSymbolItem[] }, void>({
      query: () => '/market/symbols',
      providesTags: [MARKET_SYMBOLS_TAG],
    }),
    searchMarketSymbols: builder.query<{ results: SymbolSearchHit[] }, string>({
      query: (q) => `/market/search?${new URLSearchParams({ q }).toString()}`,
    }),
    getMarketCandles: builder.query<
      MarketCandlesResponse,
      { symbol: string; interval: ChartInterval }
    >({
      query: ({ symbol, interval }) =>
        `/market/candles?${new URLSearchParams({ symbol, interval }).toString()}`,
      providesTags: (_r, _e, arg) => [{ type: 'Market', id: `${arg.symbol}-${arg.interval}` }],
    }),
    getMarketQuote: builder.query<MarketQuoteResponse, string>({
      query: (symbol) => `/market/quote?${new URLSearchParams({ symbol }).toString()}`,
    }),
  }),
});

export const {
  useGetMarketSymbolsQuery,
  useLazySearchMarketSymbolsQuery,
  useGetMarketCandlesQuery,
  useGetMarketQuoteQuery,
} = marketApi;
