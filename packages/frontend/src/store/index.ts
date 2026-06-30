import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { api } from './api';
import { authApi } from './authApi';
import { tradeApi } from './tradeApi';
import { dashboardApi } from './dashboardApi';
import { aiReportApi } from './aiReportApi';
import { diaryApi } from './diaryApi';
import playbookApi from './playbookApi';
import subscriptionApi from './subscriptionApi';
import creditApi from './creditApi';
import preferencesApi from './preferencesApi';
import taskApi from './taskApi';
import { notificationApi } from './notificationApi';

export const store = configureStore({
  reducer: {
    [api.reducerPath]: api.reducer,
    [authApi.reducerPath]: authApi.reducer,
    [tradeApi.reducerPath]: tradeApi.reducer,
    [dashboardApi.reducerPath]: dashboardApi.reducer,
    [aiReportApi.reducerPath]: aiReportApi.reducer,
    [diaryApi.reducerPath]: diaryApi.reducer,
    [playbookApi.reducerPath]: playbookApi.reducer,
    [subscriptionApi.reducerPath]: subscriptionApi.reducer,
    [creditApi.reducerPath]: creditApi.reducer,
    [preferencesApi.reducerPath]: preferencesApi.reducer,
    [taskApi.reducerPath]: taskApi.reducer,
    [notificationApi.reducerPath]: notificationApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(
      api.middleware, authApi.middleware, tradeApi.middleware,
      dashboardApi.middleware, aiReportApi.middleware,
      diaryApi.middleware, playbookApi.middleware, subscriptionApi.middleware,
      creditApi.middleware, preferencesApi.middleware,
      taskApi.middleware, notificationApi.middleware,
    ),
});

// Enable refetchOnFocus and refetchOnReconnect behaviors
setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
