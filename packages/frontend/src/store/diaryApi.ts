import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

export interface DiaryEntry {
  id: string; userId: string; title: string; content: string;
  tradeIds: string[]; createdAt: string; updatedAt: string;
  creditsAwarded?: number;
}

export const diaryApi = createApi({
  reducerPath: 'diaryApi',
  baseQuery: fetchBaseQuery({
    baseUrl: API_BASE,
    prepareHeaders: (headers) => {
      const token = localStorage.getItem('accessToken');
      if (token) headers.set('Authorization', `Bearer ${token}`);
      return headers;
    },
  }),
  tagTypes: ['Diary'],
  endpoints: (builder) => ({
    getDiaries: builder.query<{entries:DiaryEntry[];total:number;totalPages:number},void>({
      query: () => '/diary',
      providesTags: ['Diary'],
    }),
    getDiaryById: builder.query<DiaryEntry, string>({
      query: (id) => `/diary/${id}`,
      providesTags: (_r,_e,id)=>[{type:'Diary' as const,id}],
    }),
    createDiary: builder.mutation<DiaryEntry,{title:string;content:string}>({
      query: (body) => ({ url:'/diary', method:'POST', body }),
      transformResponse: (response: { success: boolean; data: DiaryEntry }) => response.data,
      invalidatesTags: ['Diary'],
    }),
    updateDiary: builder.mutation<DiaryEntry,{id:string;data:{title?:string;content?:string}}>({
      query: ({id,...rest})=>({url:`/diary/${id}`,method:'PUT',body:rest.data}),
      invalidatesTags:['Diary'],
    }),
    deleteDiary: builder.mutation<void,string>({
      query:(id)=>({url:`/diary/${id}`,method:'DELETE'}),
      invalidatesTags:['Diary'],
    }),
  }),
});

export const { useGetDiariesQuery,useGetDiaryByIdQuery,useCreateDiaryMutation,useUpdateDiaryMutation,useDeleteDiaryMutation }=diaryApi;
