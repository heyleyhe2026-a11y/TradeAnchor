import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { dashboardApi } from './dashboardApi';
import { tradeApi } from './tradeApi';

export interface NotificationPreferences {
  email: boolean;
  push: boolean;
  aiReports: boolean;
  profitAlerts: boolean;
}

export interface UserPreferences {
  locale: string;
  language: string;
  timezone: string;
  displayTimezone: string;
  currency: string;
  baseCurrency: string;
  calendarDayBasis: 'entry' | 'exit';
  leaderboardOptIn: boolean;
  dashboardDefaultFilters: Record<string, unknown>;
  dashboardLayout: unknown[];
  notifications: NotificationPreferences;
}

export type UserPreferencesUpdate = Partial<
  Pick<
    UserPreferences,
    | 'locale'
    | 'timezone'
    | 'displayTimezone'
    | 'currency'
    | 'baseCurrency'
    | 'calendarDayBasis'
    | 'leaderboardOptIn'
    | 'dashboardDefaultFilters'
    | 'dashboardLayout'
  > & { notifications: Partial<NotificationPreferences> }
>;

const api = createApi({
  reducerPath: 'preferencesApi',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api/v1/preferences',
    prepareHeaders: (headers) => {
      const token = localStorage.getItem('accessToken');
      if (token) headers.set('Authorization', `Bearer ${token}`);
      return headers;
    },
  }),
  tagTypes: ['Preferences'],
  endpoints: (builder) => ({
    getPreferences: builder.query<UserPreferences, void>({
      query: () => '',
      transformResponse: (response: { success: boolean; data: UserPreferences }) => response.data,
      providesTags: ['Preferences'],
    }),
    updatePreferences: builder.mutation<UserPreferences, UserPreferencesUpdate>({
      query: (body) => ({ url: '', method: 'PUT', body }),
      transformResponse: (response: { success: boolean; data: UserPreferences }) => response.data,
      invalidatesTags: ['Preferences'],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(dashboardApi.util.invalidateTags(['Dashboard']));
          dispatch(tradeApi.util.invalidateTags([{ type: 'Trade', id: 'LIST' }]));
        } catch {
          /* ignore */
        }
      },
    }),
    resetPreferences: builder.mutation<void, void>({
      query: () => ({ url: '/reset', method: 'POST' }),
      invalidatesTags: ['Preferences'],
    }),
  }),
});

export const {
  useGetPreferencesQuery, useUpdatePreferencesMutation,
  useResetPreferencesMutation,
} = api;

export default api;
