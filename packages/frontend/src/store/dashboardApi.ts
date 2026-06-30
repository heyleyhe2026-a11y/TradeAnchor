import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

export interface DashboardStats {
  overview: {
    totalTrades: number;
    totalInvestment: number;
    /** Gross P&L before commission */
    totalPnL: number;
    /** Net P&L after commission (used for ROI) */
    netPnL: number;
    winRate: number;
    avgPnL: number;
    profitFactor: number;
    roi: number;
    displayCurrency?: string;
  };
  currencyBreakdown?: Array<{
    currency: string;
    netPnl: number;
    investment: number;
    roi: number;
    tradeCount: number;
  }>;
  breakdown: {
    winning: number;
    losing: number;
    breakEven: number;
    avgWin: number;
    avgLoss: number;
  };
  bestTrade: { id: string; tradingSymbol: string; pnl: number } | null;
  worstTrade: { id: string; tradingSymbol: string; pnl: number } | null;
  topSymbols: Array<{ symbol: string; pnl: number; count: number }>;
  monthlyPnL: Array<{ month: string; pnl: number }>;
}

export interface CalendarData {
  dailyData: Array<{ date: string; pnl: number; trades: number; investment: number; returnPct: number }>;
  monthlySummary: Array<{
    month: string;
    pnl: number;
    trades: number;
    wins: number;
    losses: number;
    winRate: number;
    investment: number;
    returnPct: number;
  }>;
  rangeMonths: number;
}

export interface ConfidenceScore {
  executionConsistency: number;
  riskExposure: number;
  concentrationRisk: number;
  overTradingSeverity: number;
  overallScore: number;
  summary: string;
}

export const dashboardApi = createApi({
  reducerPath: 'dashboardApi',
  baseQuery: fetchBaseQuery({
    baseUrl: API_BASE,
    prepareHeaders: (headers) => {
      const token = localStorage.getItem('accessToken');
      if (token) headers.set('Authorization', `Bearer ${token}`);
      return headers;
    },
  }),
  tagTypes: ['Dashboard'],
  endpoints: (builder) => ({
    getDashboardStats: builder.query<DashboardStats, { startDate?: string; endDate?: string; symbol?: string; direction?: string } | void>({
      query: (params) => {
        const qs = params ? '?' + new URLSearchParams(
          Object.entries(params).filter(([,v]) => v !== undefined).map(([k,v]) => [k, String(v)] as [string,string])
        ).toString() : '';
        return `/dashboard/stats${qs}`;
      },
      providesTags: ['Dashboard'],
    }),

    getCalendarData: builder.query<CalendarData, { months?: number; symbol?: string; direction?: string } | void>({
      query: (params) => {
        const qs = params ? '?' + new URLSearchParams(
          Object.entries(params).filter(([,v]) => v !== undefined).map(([k,v]) => [k, String(v)] as [string,string])
        ).toString() : '';
        return `/dashboard/calendar${qs}`;
      },
      providesTags: ['Dashboard'],
    }),

    getCalendarDataByRange: builder.query<CalendarData, { startDate?: string; endDate?: string; symbol?: string; direction?: string } | void>({
      query: (params) => {
        const qs = params ? '?' + new URLSearchParams(
          Object.entries(params).filter(([,v]) => v !== undefined).map(([k,v]) => [k, String(v)] as [string,string])
        ).toString() : '';
        return `/dashboard/calendar${qs}`;
      },
      providesTags: ['Dashboard'],
    }),

    getConfidenceScore: builder.query<ConfidenceScore, void>({
      query: () => '/dashboard/confidence',
      providesTags: ['Dashboard'],
    }),
  }),
});

export const {
  useGetDashboardStatsQuery,
  useGetCalendarDataQuery,
  useGetCalendarDataByRangeQuery,
  useGetConfidenceScoreQuery,
} = dashboardApi;
