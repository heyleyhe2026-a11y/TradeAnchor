import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const api = createApi({
  reducerPath: 'creditApi',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api/v1/credits',
    prepareHeaders: (headers) => {
      const token = localStorage.getItem('accessToken');
      if (token) headers.set('Authorization', `Bearer ${token}`);
      return headers;
    },
  }),
  endpoints: (builder) => ({
    getCreditBalance: builder.query<any, void>({
      query: () => '/balance',
    }),
    spendCredits: builder.mutation<any, { amount: number }>({
      query: (body) => ({ url: '/spend', method: 'POST', body }),
    }),
    getCreditHistory: builder.query<any, { page?: number; limit?: number }>({
      query: (params) => ({ url: '/history', params }),
    }),
  }),
});

export const {
  useGetCreditBalanceQuery, useSpendCreditsMutation,
  useGetCreditHistoryQuery,
} = api;

export default api;
