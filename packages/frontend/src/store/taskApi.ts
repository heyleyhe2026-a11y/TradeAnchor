import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const api = createApi({
  reducerPath: 'taskApi',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api/v1/tasks',
    prepareHeaders: (headers) => {
      const token = localStorage.getItem('accessToken');
      if (token) headers.set('Authorization', `Bearer ${token}`);
      return headers;
    },
  }),
  tagTypes: ['Task', 'Badge'],
  endpoints: (builder) => ({
    getTasks: builder.query<any, void>({
      query: () => '/',
      providesTags: ['Task'],
    }),
    getTaskStats: builder.query<any, void>({
      query: () => '/stats',
      providesTags: ['Task'],
    }),
    claimReward: builder.mutation<any, string>({
      query: (taskId) => ({ url: `/${taskId}/claim`, method: 'POST' }),
      invalidatesTags: ['Task'],
    }),
    // Badges — absolute URL to escape baseUrl
    getBadges: builder.query<any, void>({
      query: () => ({ url: '/api/v1/badges' }),
      providesTags: ['Badge'],
    }),
    // Leaderboard endpoints
    getPublisherLeaderboard: builder.query<any, { limit?: number }>({
      query: (params) => ({ url: '/leaderboard/publishers', params }),
      providesTags: ['Task'],
    }),
    getSellerLeaderboard: builder.query<any, { limit?: number }>({
      query: (params) => ({ url: '/leaderboard/sales', params }),
      providesTags: ['Task'],
    }),
    getReturnRateLeaderboard: builder.query<any, { limit?: number; period?: string }>({
      query: (params) => ({ url: '/leaderboard/return-rate', params }),
      providesTags: ['Task'],
    }),
    getViewsLeaderboard: builder.query<any, { limit?: number }>({
      query: (params) => ({ url: '/leaderboard/views', params }),
      providesTags: ['Task'],
    }),
  }),
});

export const {
  useGetTasksQuery,
  useGetTaskStatsQuery,
  useClaimRewardMutation,
  useGetBadgesQuery,
  useGetPublisherLeaderboardQuery,
  useGetSellerLeaderboardQuery,
  useGetReturnRateLeaderboardQuery,
  useGetViewsLeaderboardQuery,
} = api;

export default api;
