import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { buildAttributionQueryParams } from '../utils/signupAttribution';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';

// Auth-related types
export interface SignupAttributionPayload {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  referrer?: string;
  landingPage?: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  countryCode?: string;
  attribution?: SignupAttributionPayload;
}

export interface RegisterResponse {
  success: boolean;
  message: string;
  data: {
    userId: string;
    email: string;
  };
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  data: {
    user: {
      id: string;
      email: string;
      tier: string;
      locale: string;
      emailVerified: boolean;
      displayName?: string | null;
      avatarUrl?: string | null;
    };
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
}

export interface VerifyEmailRequest {
  token: string;
}

export interface VerifyEmailResponse {
  success: boolean;
  message: string;
  data: {
    userId: string;
    email: string;
    emailVerified: boolean;
  };
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface ResendVerificationResponse {
  success: boolean;
  message: string;
}

export interface PasswordResetCodeRequest {
  email?: string;
}

export interface PasswordResetConfirmRequest {
  email?: string;
  code: string;
  newPassword: string;
}

export interface PasswordResetResponse {
  success: boolean;
  message: string;
}

export interface RefreshTokenResponse {
  success: boolean;
  message: string;
  data: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
}

// OAuth login URL builders (redirect to backend which redirects to provider)
export const oauthUrls = {
  google: () => {
    const params = buildAttributionQueryParams();
    const qs = params.toString();
    return `${API_BASE_URL}/auth/google${qs ? `?${qs}` : ''}`;
  },
};

function decodeBase64Json<T>(base64: string): T | null {
  try {
    // URLSearchParams treats '+' as space in query strings — restore before decoding
    const normalized = base64.replace(/ /g, '+');
    const bytes = Uint8Array.from(atob(normalized), (char) => char.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

// Parse OAuth callback data from URL query param
export function parseOAuthCallback(searchParams: URLSearchParams): { user: any; accessToken: string; refreshToken: string; expiresIn: number } | null {
  const oauthParam = searchParams.get('oauth');
  if (!oauthParam) return null;
  return decodeBase64Json(oauthParam);
}

// Profile types
export interface UserProfile {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  locale: string;
  emailVerified: boolean;
}

export interface UpdateProfileRequest {
  displayName?: string;
  avatarUrl?: string;
}

// Auth API baseQuery — includes auth token for profile endpoints
const authBaseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  prepareHeaders: (headers) => {
    const token = localStorage.getItem('accessToken');
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return headers;
  },
});

export const authApi = createApi({
  reducerPath: 'authApi',
  baseQuery: authBaseQuery,
  tagTypes: ['Auth'],
  endpoints: (builder) => ({
    // POST /auth/register
    register: builder.mutation<RegisterResponse, RegisterRequest>({
      query: (credentials) => ({
        url: '/auth/register',
        method: 'POST',
        body: credentials,
      }),
      invalidatesTags: ['Auth'],
    }),

    // POST /auth/login
    login: builder.mutation<LoginResponse, LoginRequest>({
      query: (credentials) => ({
        url: '/auth/login',
        method: 'POST',
        body: credentials,
      }),
      invalidatesTags: ['Auth'],
    }),

    // POST /auth/verify-email
    verifyEmail: builder.mutation<VerifyEmailResponse, VerifyEmailRequest>({
      query: ({ token }) => ({
        url: '/auth/verify-email',
        method: 'POST',
        body: { token },
      }),
    }),

    // POST /auth/refresh
    refreshToken: builder.mutation<RefreshTokenResponse, RefreshTokenRequest>({
      query: ({ refreshToken }) => ({
        url: '/auth/refresh',
        method: 'POST',
        body: { refreshToken },
      }),
    }),

    // POST /auth/resend-verification
    resendVerification: builder.mutation<ResendVerificationResponse, void>({
      query: () => ({
        url: '/auth/resend-verification',
        method: 'POST',
      }),
    }),

    // POST /auth/logout (requires auth)
    logout: builder.mutation<{ success: boolean; message: string }, void>({
      query: () => ({
        url: '/auth/logout',
        method: 'POST',
      }),
    }),

    // GET /auth/profile (requires auth)
    getProfile: builder.query<UserProfile, void>({
      query: () => ({
        url: '/auth/profile',
      }),
      providesTags: ['Auth'],
    }),

    // PUT /auth/profile (requires auth)
    updateProfile: builder.mutation<{ success: boolean; data: UserProfile }, UpdateProfileRequest>({
      query: (body) => ({
        url: '/auth/profile',
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['Auth'],
    }),

    // POST /auth/avatar (requires auth, multipart)
    uploadAvatar: builder.mutation<{ success: boolean; data: UserProfile }, FormData>({
      query: (formData) => ({
        url: '/auth/avatar',
        method: 'POST',
        body: formData,
        formData: true,
      }),
      invalidatesTags: ['Auth'],
    }),

    // POST /auth/password-reset/request-code
    requestPasswordResetCode: builder.mutation<PasswordResetResponse, PasswordResetCodeRequest>({
      query: (body) => ({
        url: '/auth/password-reset/request-code',
        method: 'POST',
        body,
      }),
    }),

    // POST /auth/password-reset/confirm
    confirmPasswordReset: builder.mutation<PasswordResetResponse, PasswordResetConfirmRequest>({
      query: (body) => ({
        url: '/auth/password-reset/confirm',
        method: 'POST',
        body,
      }),
    }),
  }),
});

// Export hooks
export const {
  useRegisterMutation,
  useLoginMutation,
  useVerifyEmailMutation,
  useRefreshTokenMutation,
  useLogoutMutation,
  useGetProfileQuery,
  useUpdateProfileMutation,
  useUploadAvatarMutation,
  useResendVerificationMutation,
  useRequestPasswordResetCodeMutation,
  useConfirmPasswordResetMutation,
} = authApi;

// Token storage utilities
export const tokenStorage = {
  getAccessToken: () => localStorage.getItem('accessToken'),
  getRefreshToken: () => localStorage.getItem('refreshToken'),
  setTokens: (accessToken: string, refreshToken: string) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
  },
  clearTokens: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  },
  getUser: () => {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },
  setUser: (user: unknown) => {
    localStorage.setItem('user', JSON.stringify(user));
  },
};
