import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

export type AssetCategory = 'us_stocks' | 'forex' | 'crypto' | 'futures' | 'mixed';

export interface AIReport {
  reportId: string;
  userId: string;
  locale: string;
  aiModel: string;
  generatedAt: string;
  content: {
    // V2 fields
    reportType?: 'quick' | 'deep';
    assetCategory?: AssetCategory;
    quickSnapshot?: {
      sentiment: 'bullish' | 'bearish' | 'neutral';
      keySupport: string;
      keyResistance: string;
      shortTermBias: string;
      stopLossHint: string;
      coreRisk: string;
    };
    assetOverview?: any;
    technicalAnalysis?: any;
    fundSentiment?: any;
    driversEvents?: any;
    riskAssessment?: { level: 'high' | 'medium' | 'low'; riskFactors: string[]; explanation: string };
    tradingSuggestions?: any;
    categorySpecific?: any;

    // Legacy V1 fields
    summary: string;
    tradingPatterns: Array<{ pattern:string; frequency:number; impact:string; examples:string[] }>;
    strengths: string[];
    weaknesses: string[];
    improvementSuggestions: Array<{ priority:string; suggestion:string; expectedImpact:string }>;
    statistics: { totalTrades:number; winRate:number; avgPnL:number; maxDrawdown:number; bestPerformingSymbol:string; worstPerformingSymbol:string; timeAnalysis?:any };
  };
  metadata: { generationTimeMs:number; tokensUsed:number; dataPointsAnalyzed:number };
  creditsAwarded?: number;
}

export interface AIQuestion {
  questionId: string;
  userId: string;
  reportId: string;
  question: string;
  answer: string;
  aiModel: string;
  locale: string;
  askedAt: string;
  answeredAt: string;
  responseTimeMs: number;
  creditsAwarded?: number;
}

export interface PaginatedReports { reports: AIReport[]; page:number; limit:number; total:number; totalPages:number; }
export interface PaginatedQuestions { questions: AIQuestion[]; page:number; limit:number; total:number; totalPages:number; }
export interface QuestionQuota { allowed: boolean; used: number; limit: number; }

export interface GenerateReportInput {
  aiModel: string;
  locale?: string;
  /** Report type: quick (concise) or deep (full analysis) */
  reportType?: 'quick' | 'deep';
  /** Asset category for differentiated analysis */
  assetCategory?: AssetCategory;
  /** Specific trade IDs selected by user */
  tradeIds?: string[];
  /** Filter criteria (used when no specific tradeIds) */
  filters?: {
    symbol?: string;
    direction?: 'long' | 'short';
    startDate?: string;
    endDate?: string;
  };
  /** When true, backend will deduct credits for this request (user already confirmed) */
  confirmCreditPayment?: boolean;
}

export const aiReportApi = createApi({
  reducerPath: 'aiReportApi',
  baseQuery: fetchBaseQuery({
    baseUrl: API_BASE,
    prepareHeaders: (headers) => {
      const token = localStorage.getItem('accessToken');
      if (token) headers.set('Authorization', `Bearer ${token}`);
      return headers;
    },
  }),
  tagTypes: ['AiReport', 'AiQuestion'],
  endpoints: (builder) => ({
    generateReport: builder.mutation<AIReport, GenerateReportInput>({
      query: (body) => ({ url:'/ai/reports', method:'POST', body }),
      transformResponse: (response: { success: boolean; data: AIReport }) => response.data,
      invalidatesTags: ['AiReport'],
    }),
    listReports: builder.query<PaginatedReports, void>({
      query: () => '/ai/reports',
      providesTags: ['AiReport'],
    }),
    getReport: builder.query<AIReport, string>({
      query: (id) => `/ai/reports/${id}`,
      transformResponse: (response: { success: boolean; data: AIReport }) => response.data,
      providesTags: (_result,_error,id) => [{ type:'AiReport', id }],
    }),

    // AI Follow-up Questions
    askQuestion: builder.mutation<AIQuestion, { reportId: string; question: string; locale?: string; confirmCreditPayment?: boolean }>({
      query: (body) => ({ url:'/ai/questions', method:'POST', body }),
      transformResponse: (response: { success: boolean; data: AIQuestion }) => response.data,
      invalidatesTags: ['AiQuestion'],
    }),
    listQuestions: builder.query<PaginatedQuestions, { page?:number; limit?:number }>({
      query: ({page=1, limit=20}) => `/ai/questions?page=${page}&limit=${limit}`,
      providesTags: ['AiQuestion'],
    }),
    checkQuota: builder.query<QuestionQuota, void>({
      query: () => '/ai/questions/quota',
      transformResponse: (response: { success: boolean; data: QuestionQuota }) => response.data,
    }),
  }),
});

export const {
  useGenerateReportMutation,
  useListReportsQuery,
  useGetReportQuery,
  useAskQuestionMutation,
  useListQuestionsQuery,
  useCheckQuotaQuery,
} = aiReportApi;
