import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const api = createApi({
  reducerPath: 'subscriptionApi',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api/v1',
    prepareHeaders: (headers) => {
      const token = localStorage.getItem('accessToken');
      if (token) headers.set('Authorization', `Bearer ${token}`);
      return headers;
    },
  }),
  tagTypes: ['Subscription'],
  endpoints: (builder) => ({
    getCurrentSubscription: builder.query<any, void>({
      query: () => '/subscriptions/current',
      providesTags: ['Subscription'],
    }),
    upgradeSubscription: builder.mutation<any, { tier: string }>({
      query: (body) => ({ url: '/subscriptions/upgrade', method: 'POST', body }),
    }),
    downgradeSubscription: builder.mutation<void, void>({
      query: () => ({ url: '/subscriptions/downgrade', method: 'POST' }),
    }),
    setAutoRenew: builder.mutation<any, { autoRenew: boolean }>({
      query: (body) => ({ url: '/subscriptions/auto-renew', method: 'PUT', body }),
      invalidatesTags: ['Subscription'],
    }),
    getSubscriptionHistory: builder.query<any, void>({
      query: () => '/subscriptions/history',
    }),
    // ── Payment Checkout (Creem or FastSpring via PAYMENT_PROVIDER) ──
    getCheckoutUrl: builder.query<{ checkoutUrl: string; provider?: string }, string>({
      query: (product) => `/webhooks/checkout?product=${product}`,
    }),
  }),
});

export const {
  useGetCurrentSubscriptionQuery,
  useUpgradeSubscriptionMutation,
  useDowngradeSubscriptionMutation,
  useSetAutoRenewMutation,
  useGetSubscriptionHistoryQuery,
  useGetCheckoutUrlQuery,
} = api;

/** @deprecated use useGetCheckoutUrlQuery */
export const useGetFastSpringCheckoutUrlQuery = useGetCheckoutUrlQuery;

export default api;
