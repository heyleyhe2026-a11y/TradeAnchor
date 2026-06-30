import { z } from 'zod';

/**
 * User registration validation schema
 */
export const registerSchema = z.object({
  email: z
    .string()
    .email('Invalid email format')
    .min(5, 'Email must be at least 5 characters')
    .max(255, 'Email must not exceed 255 characters')
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must not exceed 128 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    ),
  countryCode: z
    .string()
    .length(2, 'Country code must be 2 characters')
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, 'Invalid country code format'),
  attribution: z
    .object({
      utmSource: z.string().max(120).trim().optional(),
      utmMedium: z.string().max(120).trim().optional(),
      utmCampaign: z.string().max(120).trim().optional(),
      utmTerm: z.string().max(120).trim().optional(),
      utmContent: z.string().max(120).trim().optional(),
      referrer: z.string().max(500).trim().optional(),
      landingPage: z.string().max(500).trim().optional(),
    })
    .optional(),
});

/**
 * User login validation schema
 */
export const loginSchema = z.object({
  email: z
    .string()
    .email('Invalid email format')
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .min(1, 'Password is required'),
});

/**
 * Email verification validation schema
 */
export const verifyEmailSchema = z.object({
  token: z
    .string()
    .min(1, 'Verification token is required')
    .trim(),
});

/**
 * Refresh token validation schema
 */
export const refreshTokenSchema = z.object({
  refreshToken: z
    .string()
    .min(1, 'Refresh token is required')
    .trim(),
});

const passwordFieldSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must not exceed 128 characters')
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
  );

/**
 * Password reset code request validation schema
 */
export const passwordResetCodeRequestSchema = z.object({
  email: z
    .string()
    .email('Invalid email format')
    .toLowerCase()
    .trim()
    .optional(),
});

/**
 * Password reset confirmation validation schema (code + new password)
 */
export const passwordResetConfirmSchema = z.object({
  email: z
    .string()
    .email('Invalid email format')
    .toLowerCase()
    .trim()
    .optional(),
  code: z
    .string()
    .length(6, 'Verification code must be 6 digits')
    .regex(/^\d{6}$/, 'Verification code must be 6 digits'),
  newPassword: passwordFieldSchema,
});

/** @deprecated Use passwordResetCodeRequestSchema */
export const passwordResetRequestSchema = z.object({
  email: z.string().email('Invalid email format').toLowerCase().trim(),
});

/** @deprecated Use passwordResetConfirmSchema */
export const passwordResetSchema = z.object({
  token: z.string().min(1, 'Reset token is required').trim(),
  newPassword: passwordFieldSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type PasswordResetCodeRequestInput = z.infer<typeof passwordResetCodeRequestSchema>;
export type PasswordResetConfirmInput = z.infer<typeof passwordResetConfirmSchema>;
export type PasswordResetRequestInput = z.infer<typeof passwordResetRequestSchema>;
export type PasswordResetInput = z.infer<typeof passwordResetSchema>;
