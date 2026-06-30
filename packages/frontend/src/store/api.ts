import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

// Base API URL - should be configured via environment variables
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';

export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: API_BASE_URL,
    prepareHeaders: (headers) => {
      // Get token from localStorage
      const token = localStorage.getItem('accessToken');
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: [
    'User',
    'Trade',
    'Dashboard',
    'AIReport',
    'Diary',
    'Playbook',
    'Subscription',
    'Payment',
    'Credits',
    'Task',
    'Badge',
  ],
  endpoints: () => ({}),
});
