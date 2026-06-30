/// <reference types="jest" />
import {
  sendVerificationEmail,
  getVerificationEmailTemplate,
  testEmailConnection,
} from './email.service';

// ========================
// Email Service Tests (Task 2.1 - email integration)
// ========================

describe('Email Service', () => {
  describe('getVerificationEmailTemplate (Task 2.1)', () => {
    it('should generate HTML email template with verification link', () => {
      const templateData = {
        email: 'test@example.com',
        verificationToken: 'abc123def456',
      };

      const html = getVerificationEmailTemplate(templateData);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('TradeAnchor');
      expect(html).toContain('Verify Your Email');
      expect(html).toContain('test@example.com');
    });

    it('should include verification URL in template', () => {
      const templateData = {
        email: 'user@test.com',
        verificationToken: 'token123',
        verificationUrl: 'http://localhost:5173/verify-email?token=token123&email=user%40test.com',
      };

      const html = getVerificationEmailTemplate(templateData);

      expect(html).toContain('verify-email?token=token123');
    });

    it('should generate default URL when no custom URL provided', () => {
      process.env.FRONTEND_URL = 'http://example.com';
      
      const html = getVerificationEmailTemplate({
        email: 'test@example.com',
        verificationToken: 'my-token-123',
      });

      // Should contain frontend URL in the generated link
      expect(html).toContain('my-token-123');

      delete process.env.FRONTEND_URL;
    });

    it('should include 24-hour expiration notice', () => {
      const html = getVerificationEmailTemplate({
        email: 'test@example.com',
        verificationToken: 'token456',
      });

      expect(html).toContain('24 hours');
    });

    it('should contain copyright with current year', () => {
      const html = getVerificationEmailTemplate({
        email: 'test@example.com',
        verificationToken: 'token789',
      });

      const currentYear = new Date().getFullYear();
      expect(html).toContain(currentYear.toString());
    });
  });

  describe('sendVerificationEmail', () => {
    // Save original env vars
    let originalSmtpUser: string | undefined;
    let originalSmtpPassword: string | undefined;

    beforeAll(() => {
      originalSmtpUser = process.env.SMTP_USER;
      originalSmtpPassword = process.env.SMTP_PASSWORD;
    });

    afterAll(() => {
      if (originalSmtpUser !== undefined) {
        process.env.SMTP_USER = originalSmtpUser;
      } else {
        delete process.env.SMTP_USER;
      }
      if (originalSmtpPassword !== undefined) {
        process.env.SMTP_PASSWORD = originalSmtpPassword;
      } else {
        delete process.env.SMTP_PASSWORD;
      }
    });

    it('should succeed when SMTP is not configured (dev mode)', async () => {
      // Ensure no SMTP config
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASSWORD;

      const result = await sendVerificationEmail(
        'test@example.com',
        'verification-token-test'
      );

      // In development mode without SMTP, it should return success (mock)
      expect(result.success).toBe(true);
    });

    it('should handle valid input parameters', async () => {
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASSWORD;

      const result = await sendVerificationEmail(
        'valid.email@domain.com',
        'valid-token-123'
      );

      expect(result.success).toBe(true);
    });
  });

  describe('testEmailConnection', () => {
    it('should return true when SMTP is not configured', async () => {
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASSWORD;

      const result = await testEmailConnection();

      expect(result).toBe(true);
    });
  });
});
