import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';

const notificationBaseQuery = fetchBaseQuery({
  baseUrl: `${API_BASE_URL}/notifications`,
  prepareHeaders: (headers) => {
    const token = localStorage.getItem('accessToken');
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return headers;
  },
});

export const notificationApi = createApi({
  reducerPath: 'notificationApi',
  baseQuery: notificationBaseQuery,
  tagTypes: ['Notification'],
  endpoints: (builder) => ({
    getNotifications: builder.query<{ notifications: any[]; page: number; total: number; totalPages: number }, { page?: number; limit?: number }>({
      query: ({ page = 1, limit = 20 } = {}) => `?page=${page}&limit=${limit}`,
      providesTags: ['Notification'],
    }),
    getUnreadCount: builder.query<{ count: number }, void>({
      query: () => '/unread-count',
      providesTags: ['Notification'],
    }),
    markAsRead: builder.mutation<void, string>({
      query: (id) => ({ url: `/${id}/read`, method: 'PUT' }),
      invalidatesTags: ['Notification'],
    }),
    markAllAsRead: builder.mutation<{ modified: number }, void>({
      query: () => ({ url: '/read-all', method: 'PUT' }),
      invalidatesTags: ['Notification'],
    }),
  }),
});

export const {
  useGetNotificationsQuery,
  useGetUnreadCountQuery,
  useMarkAsReadMutation,
  useMarkAllAsReadMutation,
} = notificationApi;
