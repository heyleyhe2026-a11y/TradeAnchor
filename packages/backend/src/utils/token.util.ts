import crypto from 'crypto';

/**
 * Generate random token for email verification, password reset, etc.
 */
export function generateRandomToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate verification token with expiration
 */
export function generateVerificationToken(): {
  token: string;
  expiresAt: Date;
} {
  const token = generateRandomToken(32);
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours expiration

  return { token, expiresAt };
}

/**
 * Check if token is expired
 */
export function isTokenExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt;
}

/** Generate a 6-digit numeric verification code */
export function generateSixDigitCode(): string {
  return String(crypto.randomInt(100000, 1000000));
}
