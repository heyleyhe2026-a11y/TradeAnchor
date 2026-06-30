import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { getContentLocale } from '../utils/contentLocale';

const api = createApi({
  reducerPath: 'playbookApi',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api/v1/playbooks',
    prepareHeaders: (headers) => {
      const token = localStorage.getItem('accessToken');
      if (token) headers.set('Authorization', `Bearer ${token}`);
      return headers;
    },
  }),
  tagTypes: ['Playbook', 'Purchase', 'Rating', 'Favorite', 'Comment', 'Like'],
  endpoints: (builder) => ({
    getPlaybooks: builder.query<any, { page?: number; limit?: number; search?: string; status?: string; userId?: string; sortBy?: string; sortOrder?: string; locale?: string }>({
      query: (params) => ({ url: '', params: { ...params, locale: params.locale ?? getContentLocale() } }),
      providesTags: ['Playbook'],
    }),
    getMarketplace: builder.query<any, { page?: number; limit?: number; search?: string; tag?: string; sortBy?: string; sortOrder?: string; locale?: string }>({
      query: (params) => ({ url: '/marketplace', params: { ...params, locale: params.locale ?? getContentLocale() } }),
      providesTags: ['Playbook'],
    }),
    getPlaybookById: builder.query<any, string | { id: string; locale?: string }>({
      query: (arg) => {
        const id = typeof arg === 'string' ? arg : arg.id;
        const locale = typeof arg === 'string' ? getContentLocale() : (arg.locale ?? getContentLocale());
        return { url: `/${id}`, params: { locale } };
      },
      providesTags: (_result, _error, arg) => [{ type: 'Playbook', id: typeof arg === 'string' ? arg : arg.id }],
    }),
    createPlaybook: builder.mutation<any, Partial<any>>({
      query: (body) => ({ url: '', method: 'POST', body }),
      invalidatesTags: ['Playbook'],
    }),
    updatePlaybook: builder.mutation<{ id: string }, { id: string } & Partial<any>>({
      query: ({ id, ...body }) => ({ url: `/${id}`, method: 'PUT', body }),
      invalidatesTags: ['Playbook'],
    }),
    deletePlaybook: builder.mutation<void, string>({
      query: (id) => ({ url: `/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Playbook'],
    }),
    purchasePlaybook: builder.mutation<any, string>({
      query: (id) => ({ url: `/${id}/purchase`, method: 'POST' }),
      invalidatesTags: ['Purchase'],
    }),
    getMyPurchases: builder.query<any, { page?: number; limit?: number; locale?: string }>({
      query: (params) => ({ url: '/my/purchases', params: { ...params, locale: params?.locale ?? getContentLocale() } }),
      providesTags: ['Purchase'],
    }),
    getMyBrowsed: builder.query<any, { page?: number; limit?: number; locale?: string }>({
      query: (params) => ({ url: '/my/browsed', params: { ...params, locale: params?.locale ?? getContentLocale() } }),
      providesTags: ['Playbook'],
    }),
    getAuthorStats: builder.query<any, void>({
      query: () => '/my/author-stats',
      providesTags: ['Playbook'],
    }),

    ratePlaybook: builder.mutation<any, any>({
      query: ({ id, ...body }) => ({ url: `/${id}/rate`, method: 'POST', body }),
      invalidatesTags: ['Rating'],
    }),
    updateRating: builder.mutation<any, any>({
      query: ({ id, ...body }) => ({ url: `/${id}/rate`, method: 'PUT', body }),
      invalidatesTags: ['Rating'],
    }),
    getRatings: builder.query<any, { id: string; page?: number; limit?: number }>({
      query: ({ id, ...params }) => ({ url: `/${id}/rates`, params }),
      providesTags: (_res, _err, arg) => [{ type: 'Rating', id: arg.id }],
    }),
    getUserRating: builder.query<any, string>({
      query: (id) => `/${id}/my-rating`,
      providesTags: (_res, _err, id) => [{ type: 'Rating', id }],
    }),
    deleteRating: builder.mutation<void, string>({
      query: (id) => ({ url: `/${id}/rate`, method: 'DELETE' }),
      invalidatesTags: ['Rating'],
    }),

    // Comments (评论/回复)
    createComment: builder.mutation<any, { id: string; content: string; parentId?: string }>({
      query: ({ id, ...body }) => ({ url: `/${id}/comments`, method: 'POST', body }),
      invalidatesTags: (_res, _err, arg) => [
        { type: 'Comment', id: arg.id },
        { type: 'Playbook', id: arg.id },
        'Playbook',
      ],
    }),
    getComments: builder.query<any, { id: string; page?: number; limit?: number; locale?: string }>({
      query: ({ id, ...params }) => ({
        url: `/${id}/comments`,
        params: { ...params, locale: params.locale ?? getContentLocale() },
      }),
      providesTags: (_res, _err, arg) => [{ type: 'Comment', id: arg.id }],
    }),
    deleteComment: builder.mutation<{ commentCount: number }, { id: string; commentId: string }>({
      query: ({ id, commentId }) => ({ url: `/${id}/comments/${commentId}`, method: 'DELETE' }),
      transformResponse: (response: { success: boolean; data?: { commentCount: number } }) =>
        response.data ?? { commentCount: 0 },
      invalidatesTags: (_res, _err, arg) => [
        { type: 'Comment', id: arg.id },
        { type: 'Playbook', id: arg.id },
        'Playbook',
      ],
    }),

    // Favorites (收藏)
    toggleFavorite: builder.mutation<{ favorited: boolean }, string>({
      query: (id) => ({ url: `/${id}/favorite`, method: 'POST' }),
      invalidatesTags: ['Favorite'],
    }),
    getMyFavorites: builder.query<any, { page?: number; limit?: number; locale?: string }>({
      query: (params) => ({ url: '/my/favorites', params: { ...params, locale: params?.locale ?? getContentLocale() } }),
      providesTags: ['Favorite'],
    }),

    // Likes (点赞)
    toggleLike: builder.mutation<{ liked: boolean; likeCount: number }, string>({
      query: (id) => ({ url: `/${id}/like`, method: 'POST' }),
      invalidatesTags: ['Like', 'Playbook'],
    }),
    getMyLikes: builder.query<{ playbookIds: string[] }, void>({
      query: () => '/my/likes',
      transformResponse: (response: { success: boolean; playbookIds?: string[] }) => ({
        playbookIds: response.playbookIds ?? [],
      }),
      providesTags: ['Like'],
    }),
  }),
});

export const {
  useGetPlaybooksQuery,
  useGetMarketplaceQuery,
  useGetPlaybookByIdQuery,
  useCreatePlaybookMutation,
  useUpdatePlaybookMutation,
  useDeletePlaybookMutation,
  usePurchasePlaybookMutation,
  useGetMyPurchasesQuery,
  useGetMyBrowsedQuery,
  useGetAuthorStatsQuery,
  useRatePlaybookMutation,
  useUpdateRatingMutation,
  useGetRatingsQuery,
  useGetUserRatingQuery,
  useDeleteRatingMutation,
  useToggleFavoriteMutation,
  useGetMyFavoritesQuery,
  useToggleLikeMutation,
  useGetMyLikesQuery,
  // Comments
  useCreateCommentMutation,
  useGetCommentsQuery,
  useDeleteCommentMutation,
} = api;

export default api;
