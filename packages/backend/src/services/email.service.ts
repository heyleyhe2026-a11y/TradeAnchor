import nodemailer from 'nodemailer';
import logger from '../lib/logger';

// Email configuration interface
interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  fromAddress: string;
  fromName: string;
}

interface VerificationEmailData {
  email: string;
  verificationToken: string;
  verificationUrl?: string;
}

let transporter: nodemailer.Transporter | null = null;

/**
 * Get or create email transporter (lazy initialization)
 */
function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    const config: EmailConfig = {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER || '',
      password: process.env.SMTP_PASSWORD || '',
      fromAddress: process.env.EMAIL_FROM_ADDRESS || 'noreply@mytradewiseoc.com',
      fromName: process.env.EMAIL_FROM_NAME || 'TradeAnchor',
    };

    if (!config.user || !config.password) {
      logger.warn('SMTP credentials not configured. Emails will be logged to console only.');
    }

    transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.user && config.password
        ? {
            user: config.user,
            pass: config.password,
          }
        : undefined,
    });
  }

  return transporter;
}

/**
 * Send via Resend REST API (preferred when RESEND_API_KEY is set)
 */
async function sendViaResendApi(
  to: string,
  subject: string,
  html: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY || process.env.SMTP_PASSWORD;
  const fromAddress = process.env.EMAIL_FROM_ADDRESS || 'onboarding@resend.dev';
  const fromName = process.env.EMAIL_FROM_NAME || 'TradeAnchor';

  // eslint-disable-next-line no-console
  console.log(`[RESEND_SEND] to=${to} from=${fromName}<${fromAddress}> apiKey=${apiKey?.slice(0, 8)}...`);

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${fromName} <${fromAddress}>`,
        to: [to],
        subject,
        html,
      }),
    });

    const data = await response.json() as Record<string, any>;

    if (!response.ok) {
      const errorMsg = data?.message || data?.error?.message || JSON.stringify(data);
      // eslint-disable-next-line no-console
      console.error(`[RESEND_ERROR] status=${response.status} to=${to} body=`, JSON.stringify(data));
      logger.error(`Resend API error for ${to}`, { status: response.status, error: errorMsg });
      return { success: false, error: `Resend API ${response.status}: ${errorMsg}` };
    }

    const messageId = String(data.id || '');
    logger.info(`Email sent via Resend API to ${to}`, { messageId });
    return { success: true, messageId };

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Resend API fetch failed for ${to}`, { error: errorMessage, fullError: String(error) });
    return { success: false, error: errorMessage };
  }
}

/**
 * Send an email
 */
async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const config = {
    from: `${process.env.EMAIL_FROM_NAME || 'TradeAnchor'} <${process.env.EMAIL_FROM_ADDRESS || 'noreply@mytradewiseoc.com'}>`,
    to,
    subject,
    html,
    text: text || html.replace(/<[^>]*>/g, ''),
  };

  // If SMTP is not configured, log the email for development
  if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    logger.info(`[EMAIL MOCK] Would send email to ${to}`, {
      to,
      subject,
      config,
    });
    return { success: true, messageId: 'mock-message-id' };
  }

  // Use Resend API when available (preferred over SMTP)
  if (process.env.SMTP_HOST === 'smtp.resend.com') {
    return sendViaResendApi(to, subject, html);
  }

  // Fallback to nodemailer SMTP
  try {
    const info = await getTransporter().sendMail(config);
    logger.info(`Email sent successfully to ${to}`, { messageId: info.messageId });
    return { success: true, messageId: info.messageId };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const fullError = error instanceof Object ? JSON.stringify(error) : String(error);
    logger.error(`Failed to send email to ${to}`, { error: errorMessage, fullError });
    return { success: false, error: errorMessage };
  }
}

/**
 * Generate verification email HTML template
 */
export function getVerificationEmailTemplate(data: VerificationEmailData): string {
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const verificationUrl = data.verificationUrl ||
    `${baseUrl}/verify-email?token=${data.verificationToken}&email=${encodeURIComponent(data.email)}`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email - TradeAnchor</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <!-- Header -->
    <tr>
      <td style="background-color: #1976d2; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="color: #ffffff; margin: 0; font-size: 28px;">TradeAnchor</h1>
        <p style="color: #bbdefb; margin: 8px 0 0 0; font-size: 16px;">AI-Powered Trading Journal Platform</p>
      </td>
    </tr>
    
    <!-- Content -->
    <tr>
      <td style="background-color: #ffffff; padding: 40px 30px; border: 1px solid #e0e0e0; border-top: none;">
        <h2 style="color: #333; margin: 0 0 20px 0; font-size: 22px;">Verify Your Email Address</h2>
        
        <p style="color: #555; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
          Thank you for registering with TradeAnchor! Please click the button below to verify your email address and activate your account.
        </p>

        <div style="text-align: center; margin: 32px 0;">
          <a href="${verificationUrl}"
             style="display: inline-block; background-color: #1976d2; color: #ffffff; padding: 14px 36px; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600;">
            Verify Email Address
          </a>
        </div>

        <p style="color: #777; font-size: 14px; line-height: 1.6; margin: 0 0 8px 0;">
          Or copy and paste this URL into your browser:
        </p>
        <p style="word-break: break-all; color: #1976d2; font-size: 13px; background-color: #f5f5f5; padding: 12px; border-radius: 4px; margin: 0 0 24px 0;">
          ${verificationUrl}
        </p>

        <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 24px 0;" />

        <p style="color: #999; font-size: 13px; line-height: 1.5; margin: 0;">
          This verification link will expire in <strong>24 hours</strong>. If you did not create a TradeAnchor account, you can safely ignore this email.
        </p>
      </td>
    </tr>
    
    <!-- Footer -->
    <tr>
      <td style="background-color: #fafafa; padding: 20px 30px; text-align: center; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="color: #999; font-size: 12px; margin: 0 0 8px 0;">
          &copy; ${new Date().getFullYear()} TradeAnchor. All rights reserved.
        </p>
        <p style="color: #bbb; font-size: 11px; margin: 0;">
          This is an automated message. Please do not reply to this email.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Send verification email to user
 */
function getPasswordResetCodeEmailTemplate(email: string, code: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:40px auto;background:#fff;border-radius:8px;border:1px solid #e0e0e0;">
    <tr>
      <td style="padding:32px 30px 16px;text-align:center;">
        <h1 style="margin:0;font-size:22px;color:#0a0e17;">TradeAnchor</h1>
        <p style="margin:8px 0 0;color:#64748b;font-size:13px;">Password Reset Verification</p>
      </td>
    </tr>
    <tr>
      <td style="padding:8px 30px 32px;">
        <p style="color:#334155;font-size:15px;line-height:1.6;">Hello,</p>
        <p style="color:#334155;font-size:15px;line-height:1.6;">You requested to reset the password for <strong>${email}</strong>. Use the verification code below:</p>
        <p style="text-align:center;margin:28px 0;">
          <span style="display:inline-block;padding:14px 28px;background:#0a0e17;color:#00d4aa;font-size:32px;font-weight:700;letter-spacing:8px;border-radius:8px;">${code}</span>
        </p>
        <p style="color:#ef4444;font-size:14px;text-align:center;font-weight:600;">This code expires in 1 minute.</p>
        <p style="color:#94a3b8;font-size:13px;line-height:1.5;margin-top:24px;">If you did not request a password reset, you can safely ignore this email.</p>
      </td>
    </tr>
    <tr>
      <td style="background:#fafafa;padding:16px 30px;text-align:center;border-top:1px solid #e0e0e0;border-radius:0 0 8px 8px;">
        <p style="color:#999;font-size:12px;margin:0;">&copy; ${new Date().getFullYear()} TradeAnchor</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendPasswordResetCodeEmail(
  email: string,
  code: string,
): Promise<{ success: boolean; error?: string }> {
  const html = getPasswordResetCodeEmailTemplate(email, code);
  return sendEmail(email, 'Your TradeAnchor Password Reset Code', html);
}

export async function sendVerificationEmail(
  email: string,
  verificationToken: string
): Promise<{ success: boolean; error?: string }> {
  const templateData: VerificationEmailData = {
    email,
    verificationToken,
  };

  const html = getVerificationEmailTemplate(templateData);

  return sendEmail(
    email,
    'Verify Your Email Address - TradeAnchor',
    html
  );
}

/**
 * Test email service connection
 */
export const emailService = {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetCodeEmail,
  getVerificationEmailTemplate,
  testEmailConnection,
};

export async function testEmailConnection(): Promise<boolean> {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    logger.info('SMTP not configured, skipping connection test');
    return true;
  }

  try {
    await getTransporter().verify();
    logger.info('SMTP connection verified successfully');
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('SMTP connection test failed', { error: errorMessage });
    return false;
  }
}
