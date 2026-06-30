/// <reference types="jest" />
import { z } from 'zod';
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  refreshTokenSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
} from './auth.validator';

describe('Auth Validators', () => {
  // ========================
  // Task 2.2: Registration Tests
  // ========================
  describe('registerSchema (Task 2.2)', () => {
    describe('Valid Registration Request', () => {
      it('should accept valid registration data', () => {
        const validData = {
          email: 'user@example.com',
          password: 'StrongPass123!',
          countryCode: 'US',
        };

        const result = registerSchema.safeParse(validData);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.email).toBe('user@example.com');
          expect(result.data.password).toBe('StrongPass123!');
          expect(result.data.countryCode).toBe('US');
        }
      });

      it('should normalize email to lowercase', () => {
        const data = {
          email: 'USER@EXAMPLE.COM',
          password: 'StrongPass123!',
          countryCode: 'us',
        };

        const result = registerSchema.safeParse(data);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.email).toBe('user@example.com');
        }
      });

      it('should normalize country code to uppercase', () => {
        const data = {
          email: 'user@example.com',
          password: 'StrongPass123!',
          countryCode: 'cn',
        };

        const result = registerSchema.safeParse(data);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.countryCode).toBe('CN');
        }
      });

      it('should trim whitespace from email', () => {
        const data = {
          email: '  user@example.com  ',
          password: 'StrongPass123!',
          countryCode: 'US',
        };

        const result = registerSchema.safeParse(data);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.email).toBe('user@example.com');
        }
      });
    });

    describe('Invalid Email Format', () => {
      it('should reject email without @ symbol', () => {
        const data = {
          email: 'invalid-email',
          password: 'StrongPass123!',
          countryCode: 'US',
        };

        const result = registerSchema.safeParse(data);

        expect(result.success).toBe(false);
        if (!result.success) {
          const emailError = result.error.issues.find(
            (issue) => issue.path[0] === 'email'
          );
          expect(emailError).toBeDefined();
        }
      });

      it('should reject email without domain', () => {
        const data = {
          email: 'user@',
          password: 'StrongPass123!',
          countryCode: 'US',
        };

        const result = registerSchema.safeParse(data);

        expect(result.success).toBe(false);
      });

      it('should reject empty string email', () => {
        const data = {
          email: '',
          password: 'StrongPass123!',
          countryCode: 'US',
        };

        const result = registerSchema.safeParse(data);

        expect(result.success).toBe(false);
      });

      it('should reject email shorter than 5 characters', () => {
        const data = {
          email: 'a@b.co',
          password: 'StrongPass123!',
          countryCode: 'US',
        };

        const result = registerSchema.safeParse(data);

        expect(result.success).toBe(false);
      });
    });

    describe('Weak Password Rejection', () => {
      it('should reject password shorter than 8 characters', () => {
        const data = {
          email: 'user@example.com',
          password: 'Weak1!',
          countryCode: 'US',
        };

        const result = registerSchema.safeParse(data);

        expect(result.success).toBe(false);
        if (!result.success) {
          const passwordError = result.error.issues.find(
            (issue) => issue.path[0] === 'password'
          );
          expect(passwordError?.message).toContain('at least 8 characters');
        }
      });

      it('should reject password without uppercase letter', () => {
        const data = {
          email: 'user@example.com',
          password: 'lowercase1!',
          countryCode: 'US',
        };

        const result = registerSchema.safeParse(data);

        expect(result.success).toBe(false);
      });

      it('should reject password without lowercase letter', () => {
        const data = {
          email: 'user@example.com',
          password: 'UPPERCASE1!',
          countryCode: 'US',
        };

        const result = registerSchema.safeParse(data);

        expect(result.success).toBe(false);
      });

      it('should reject password without number', () => {
        const data = {
          email: 'user@example.com',
          password: 'NoNumbers!',
          countryCode: 'US',
        };

        const result = registerSchema.safeParse(data);

        expect(result.success).toBe(false);
      });

      it('should reject password without special character', () => {
        const data = {
          email: 'user@example.com',
          password: 'NoSpecialChar1',
          countryCode: 'US',
        };

        const result = registerSchema.safeParse(data);

        expect(result.success).toBe(false);
      });

      it('should reject password longer than 128 characters', () => {
        const data = {
          email: 'user@example.com',
          password: 'Aa1!' + 'x'.repeat(130),
          countryCode: 'US',
        };

        const result = registerSchema.safeParse(data);

        expect(result.success).toBe(false);
      });

      it('should reject empty password', () => {
        const data = {
          email: 'user@example.com',
          password: '',
          countryCode: 'US',
        };

        const result = registerSchema.safeParse(data);

        expect(result.success).toBe(false);
      });
    });

    describe('Country Code Validation', () => {
      it('should reject non-2-character country code', () => {
        const data = {
          email: 'user@example.com',
          password: 'StrongPass123!',
          countryCode: 'USA',
        };

        const result = registerSchema.safeParse(data);

        expect(result.success).toBe(false);
      });

      it('should reject single character country code', () => {
        const data = {
          email: 'user@example.com',
          password: 'StrongPass123!',
          countryCode: 'U',
        };

        const result = registerSchema.safeParse(data);

        expect(result.success).toBe(false);
      });

      it('should reject numeric country code', () => {
        const data = {
          email: 'user@example.com',
          password: 'StrongPass123!',
          countryCode: '12',
        };

        const result = registerSchema.safeParse(data);

        expect(result.success).toBe(false);
      });
    });
  });

  // ========================
  // Task 2.5: Login Tests
  // ========================
  describe('loginSchema (Task 2.5)', () => {
    describe('Valid Login Requests', () => {
      it('should accept valid login credentials', () => {
        const validData = {
          email: 'user@example.com',
          password: 'anypassword123',
        };

        const result = loginSchema.safeParse(validData);

        expect(result.success).toBe(true);
      });

      it('should accept lowercase email and convert to lowercase', () => {
        const data = {
          email: 'USER@Example.COM',
          password: 'password',
        };

        const result = loginSchema.safeParse(data);

        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.email).toBe('user@example.com');
        }
      });
    });

    describe('Invalid Credential Tests', () => {
      it('should reject invalid email format', () => {
        const data = {
          email: 'not-an-email',
          password: 'password',
        };

        const result = loginSchema.safeParse(data);

        expect(result.success).toBe(false);
      });

      it('should reject empty email', () => {
        const data = {
          email: '',
          password: 'password',
        };

        const result = loginSchema.safeParse(data);

        expect(result.success).toBe(false);
      });

      it('should reject empty password', () => {
        const data = {
          email: 'user@example.com',
          password: '',
        };

        const result = loginSchema.safeParse(data);

        expect(result.success).toBe(false);
      });
    });
  });

  // ========================
  // Email Verification Schema
  // ========================
  describe('verifyEmailSchema', () => {
    it('should accept valid token', () => {
      const result = verifyEmailSchema.safeParse({
        token: 'abc123def456',
      });

      expect(result.success).toBe(true);
    });

    it('should reject empty token', () => {
      const result = verifyEmailSchema.safeParse({ token: '' });

      expect(result.success).toBe(false);
    });

    it('should trim whitespace from token', () => {
      const result = verifyEmailSchema.safeParse({ token: '  abc123  ' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.token).toBe('abc123');
      }
    });
  });

  // ========================
  // Refresh Token Schema
  // ========================
  describe('refreshTokenSchema', () => {
    it('should accept valid refresh token', () => {
      const result = refreshTokenSchema.safeParse({
        refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      });

      expect(result.success).toBe(true);
    });

    it('should reject empty refresh token', () => {
      const result = refreshTokenSchema.safeParse({ refreshToken: '' });

      expect(result.success).toBe(false);
    });
  });

  // ========================
  // Password Reset Schemas
  // ========================
  describe('passwordResetRequestSchema', () => {
    it('should accept valid email for reset request', () => {
      const result = passwordResetRequestSchema.safeParse({
        email: 'user@example.com',
      });

      expect(result.success).toBe(true);
    });

    it('should reject invalid email for reset request', () => {
      const result = passwordResetRequestSchema.safeParse({ email: 'invalid' });

      expect(result.success).toBe(false);
    });
  });

  describe('passwordResetSchema', () => {
    it('should accept valid password reset data', () => {
      const result = passwordResetSchema.safeParse({
        token: 'reset-token-123',
        newPassword: 'NewPassword123!',
      });

      expect(result.success).toBe(true);
    });

    it('should reject weak new password in reset', () => {
      const result = passwordResetSchema.safeParse({
        token: 'reset-token-123',
        newPassword: 'weak',
      });

      expect(result.success).toBe(false);
    });

    it('should reject missing token in reset', () => {
      const result = passwordResetSchema.safeParse({
        token: '',
        newPassword: 'NewPassword123!',
      });

      expect(result.success).toBe(false);
    });
  });
});
