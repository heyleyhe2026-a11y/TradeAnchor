import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { marketApi, MARKET_SYMBOLS_TAG } from './marketApi';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';

export interface Trade {
  id: string;
  tradingSymbol: string;
  positionDirection: 'long' | 'short';
  entryPrice: number;
  exitPrice: number | null;
  quantity: number;
  leverage: number;
  pnl: number;
  commission: number | null;
  swap?: number | null;
  quoteCurrency?: string;
  pnlSource?: 'calculated' | 'broker';
  netPnl?: number;
  investment?: number;
  /** Report currency used for list display amounts (converted from quoteCurrency). */
  displayCurrency?: string;
  entryTimestamp: string;
  exitTimestamp: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTradeRequest {
  tradingSymbol: string;
  positionDirection: 'long' | 'short';
  entryPrice: number;
  exitPrice?: number;
  quantity: number;
  leverage?: number;
  commission?: number;
  entryTimestamp: string;
  exitTimestamp?: string;
}

export interface UpdateTradeRequest {
  tradingSymbol?: string;
  positionDirection?: 'long' | 'short';
  entryPrice?: number;
  exitPrice?: number;
  quantity?: number;
  leverage?: number;
  pnl?: number;
  commission?: number;
  entryTimestamp?: string;
  exitTimestamp?: string;
}

export interface TradeQueryParams {
  symbol?: string;
  direction?: 'long' | 'short';
  startDate?: string;
  endDate?: string;
  minPnL?: number;
  maxPnL?: number;
  page?: number;
  limit?: number;
  sort?: 'date' | 'pnl' | 'symbol';
  order?: 'asc' | 'desc';
}

export interface TradesResponse {
  trades: Trade[];
  displayCurrency?: string;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface TradeStats {
  total: number;
  winning: number;
  losing: number;
  winRate: number;
  totalPnL: number;
  avgPnL: number;
}

export interface ImportTradesRequest {
  importSource?: string;
  sourceTimezone?: string;
  defaultQuoteCurrency?: string;
  trades: {
    tradingSymbol: string;
    positionDirection: 'long' | 'short';
    entryPrice: number;
    exitPrice?: number;
    quantity: number;
    leverage?: number;
    entryTimestamp: string;
    exitTimestamp?: string;
    pnl?: number;
    commission?: number;
    swap?: number;
    quoteCurrency?: string;
    pnlSource?: 'calculated' | 'broker';
    externalTicketId?: string;
  }[];
}

export interface ImportTradesResult {
  imported: number;
  skipped?: number;
  failed: number;
  importBatchId?: string;
  errors: string[];
}

/** Refresh chart "Your symbols" after trade records change. */
async function refreshMarketSymbolsOnTradeChange(
  _: unknown,
  { dispatch, queryFulfilled }: { dispatch: (action: unknown) => void; queryFulfilled: Promise<unknown> },
) {
  try {
    await queryFulfilled;
    dispatch(marketApi.util.invalidateTags([MARKET_SYMBOLS_TAG]));
  } catch {
    // mutation failed — keep existing symbol list
  }
}

export const tradeApi = createApi({
  reducerPath: 'tradeApi',
  baseQuery: fetchBaseQuery({
    baseUrl: API_BASE_URL,
    prepareHeaders: (headers) => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ['Trade', 'Dashboard'],
  endpoints: (builder) => ({
    getTrades: builder.query<TradesResponse, TradeQueryParams>({
      query: (params) => ({ url: '/trades', params }),
      providesTags: (result) =>
        result?.trades
          ? [
              ...result.trades.map(({ id }) => ({ type: 'Trade' as const, id })),
              { type: 'Trade' as const, id: 'LIST' },
            ]
          : [{ type: 'Trade' as const, id: 'LIST' }],
    }),

    getTradeById: builder.query<Trade, string>({
      query: (id) => `/trades/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Trade', id }],
    }),

    createTrade: builder.mutation<Trade, CreateTradeRequest>({
      query: (trade) => ({ url: '/trades', method: 'POST', body: trade }),
      invalidatesTags: [{ type: 'Trade', id: 'LIST' }, { type: 'Dashboard' }],
      onQueryStarted: refreshMarketSymbolsOnTradeChange,
    }),

    updateTrade: builder.mutation<Trade, { id: string; data: UpdateTradeRequest }>({
      query: ({ id, data }) => ({ url: `/trades/${id}`, method: 'PUT', body: data }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Trade', id },
        { type: 'Trade', id: 'LIST' },
        { type: 'Dashboard' },
      ],
      onQueryStarted: refreshMarketSymbolsOnTradeChange,
    }),

    deleteTrade: builder.mutation<void, string>({
      query: (id) => ({ url: `/trades/${id}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Trade', id: 'LIST' }, { type: 'Dashboard' }],
      onQueryStarted: refreshMarketSymbolsOnTradeChange,
    }),

    batchDeleteTrades: builder.mutation<{ deleted: number }, string[]>({
      query: (ids) => ({ url: '/trades', method: 'DELETE', body: { ids } }),
      invalidatesTags: [{ type: 'Trade', id: 'LIST' }, { type: 'Dashboard' }],
      onQueryStarted: refreshMarketSymbolsOnTradeChange,
    }),

    batchUpdateLeverage: builder.mutation<{ updated: number }, { ids: string[]; leverage: number }>({
      query: ({ ids, leverage }) => ({ url: '/trades/batch-leverage', method: 'PATCH', body: { ids, leverage } }),
      invalidatesTags: [{ type: 'Trade', id: 'LIST' }, { type: 'Dashboard' }],
    }),

    importTrades: builder.mutation<ImportTradesResult, ImportTradesRequest>({
      query: (body) => ({ url: '/trades/import', method: 'POST', body }),
      invalidatesTags: [{ type: 'Trade', id: 'LIST' }, { type: 'Dashboard' }],
      onQueryStarted: refreshMarketSymbolsOnTradeChange,
    }),
  }),
});

export const {
  useGetTradesQuery,
  useGetTradeByIdQuery,
  useLazyGetTradeByIdQuery,
  useCreateTradeMutation,
  useUpdateTradeMutation,
  useDeleteTradeMutation,
  useBatchDeleteTradesMutation,
  useBatchUpdateLeverageMutation,
  useImportTradesMutation,
} = tradeApi;
