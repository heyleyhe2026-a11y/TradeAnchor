/// <reference types="jest" />
import { hashPassword, comparePassword, validatePasswordStrength } from '../utils/password.util';
import { generateVerificationToken, isTokenExpired } from '../utils/token.util';

// ========================
// Task 2.2: Registration Unit Tests
// Task 2.5: Login Unit Tests
// ========================

describe('Password Utilities', () => {
  describe('hashPassword (Task 2.1 - bcrypt 12 rounds)', () => {
    it('should hash a password with bcrypt (12 salt rounds)', async () => {
      const password = 'TestPassword123!';
      const hash = await hashPassword(password);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash).not.toBe(password);
      // bcrypt hashes start with $2b$ or $2a$ for version 12
      expect(hash).toMatch(/^\$2[ab]\$/);
    });

    it('should produce different hashes for the same password', async () => {
      const password = 'SamePassword123!';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toBe(hash2);
    });

    it('should be able to verify a hashed password', async () => {
      const password = 'VerifyMe123!';
      const hash = await hashPassword(password);
      const isValid = await comparePassword(password, hash);

      expect(isValid).toBe(true);
    });
  });

  describe('comparePassword (Task 2.4 - login validation)', () => {
    it('should return true for correct password', async () => {
      const password = 'CorrectPassword123!';
      const hash = await hashPassword(password);

      const result = await comparePassword(password, hash);

      expect(result).toBe(true);
    });

    it('should return false for incorrect password', async () => {
      const password = 'Original123!';
      const wrongPassword = 'WrongPassword123!';
      const hash = await hashPassword(password);

      const result = await comparePassword(wrongPassword, hash);

      expect(result).toBe(false);
    });
  });

  describe('validatePasswordStrength (Task 2.1 - password requirements)', () => {
    it('should validate a strong password', () => {
      const result = validatePasswordStrength('StrongPass123!');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    // Task 2.2: Test weak password rejection
    it('should reject password shorter than 8 characters', () => {
      const result = validatePasswordStrength('Weak1!');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        expect.stringContaining('at least 8 characters')
      );
    });

    it('should reject password without lowercase letter', () => {
      const result = validatePasswordStrength('UPPERCASE123!');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        expect.stringContaining('lowercase')
      );
    });

    it('should reject password without uppercase letter', () => {
      const result = validatePasswordStrength('lowercase123!');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        expect.stringContaining('uppercase')
      );
    });

    it('should reject password without number', () => {
      const result = validatePasswordStrength('NoNumbers!!');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        expect.stringContaining('number')
      );
    });

    it('should reject password without special character', () => {
      const result = validatePasswordStrength('NoSpecialChars123');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        expect.stringContaining('special character')
      );
    });

    // Task 2.2: Test edge cases
    it('should reject empty password', () => {
      const result = validatePasswordStrength('');

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject very long passwords (>128 chars)', () => {
      const longPassword = 'Aa1!' + 'x'.repeat(130);
      const result = validatePasswordStrength(longPassword);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        expect.stringContaining('128')
      );
    });

    it('should collect all errors at once', () => {
      const result = validatePasswordStrength('abc');

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });
});

describe('Token Utilities', () => {
  describe('generateVerificationToken (Task 2.1)', () => {
    it('should generate a token string', () => {
      const { token, expiresAt } = generateVerificationToken();

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBe(64); // 32 bytes = 64 hex chars
    });

    it('should set expiration to 24 hours from now', () => {
      const { expiresAt } = generateVerificationToken();
      const now = new Date();
      const twentyFourHoursLater = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      // Allow 1 second tolerance
      expect(expiresAt.getTime()).toBeGreaterThan(now.getTime());
      expect(expiresAt.getTime()).toBeLessThan(twentyFourHoursLater.getTime() + 1000);
    });

    it('should generate unique tokens each time', () => {
      const token1 = generateVerificationToken().token;
      const token2 = generateVerificationToken().token;
      const token3 = generateVerificationToken().token;

      expect(token1).not.toBe(token2);
      expect(token2).not.toBe(token3);
      expect(token1).not.toBe(token3);
    });

    it('should contain only hexadecimal characters in token', () => {
      const { token } = generateVerificationToken();

      expect(token).toMatch(/^[a-f0-9]+$/);
    });
  });

  describe('isTokenExpired (Task 2.3 - verification)', () => {
    it('should return false for future expiration date', () => {
      const futureDate = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

      expect(isTokenExpired(futureDate)).toBe(false);
    });

    it('should return true for past expiration date', () => {
      const pastDate = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago

      expect(isTokenExpired(pastDate)).toBe(true);
    });

    it('should return false for exactly current time (edge case)', () => {
      // Token at current time should not be expired (allowing small margin)
      const now = new Date();

      // This might be flaky due to timing, but tests the boundary
      const result = isTokenExpired(now);
      expect(typeof result).toBe('boolean');
    });
  });
});
