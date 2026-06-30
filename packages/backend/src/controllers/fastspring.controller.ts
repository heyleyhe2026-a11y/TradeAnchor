import { Request, Response } from 'express';
import { FastSpringService } from '../services/fastspring.service';

export const fastspringController = {
  /**
   * POST /api/v1/webhooks/fastspring
   * Receives webhook events from FastSpring.
   *
   * FastSpring sends:
   *  Header: X-FS-Signature (base64 HMAC-SHA256)
   *  Header: X-FS-Timestamp
   *  Body: JSON payload with events array
   */
  async handleWebhook(req: Request, res: Response) {
    const fsSignature = req.headers['x-fs-signature'] as string;
    const fsTimestamp = req.headers['x-fs-timestamp'] as string;
    const secret = process.env.FASTSPRING_WEBHOOK_SECRET;

    // Verify signature if secret is configured
    if (secret) {
      if (!fsSignature || !fsTimestamp) {
        return res.status(400).json({ error: 'Missing signature headers' });
      }
      // req.body is already parsed by express.json(), need raw body for verification
      const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      const isValid = FastSpringService.verifySignature(rawBody, fsSignature, fsTimestamp, secret);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    try {
      const result = await FastSpringService.handleWebhook(req.body);

      if (result.errors.length > 0 && result.processed === 0) {
        return res.status(500).json({ success: false, errors: result.errors });
      }

      // Always return 200 so FS doesn't retry
      res.json({
        success: true,
        processed: result.processed,
        errors: result.errors.length > 0 ? result.errors : undefined,
      });
    } catch (e: any) {
      console.error('[FastSpring] Webhook processing failed:', e);
      // Still return 200 to prevent retries on malformed payloads
      res.status(200).json({ success: false, error: e.message });
    }
  },

  /**
   * Generate checkout URL for frontend redirect.
   */
  async getCheckoutUrl(req: Request, res: Response) {
    const { product } = req.query;
    if (!product || !['advanced', 'professional'].includes(product as string)) {
      return res.status(400).json({ error: 'Invalid product. Use "advanced" or "professional"' });
    }
    const url = FastSpringService.generateCheckoutUrl(
      product as string,
      req.user!.email,
      process.env.FASTSPRING_WEB_CHECKOUT_URL || process.env.FASTSPRING_STORE_URL,
    );
    res.json({ checkoutUrl: url });
  },
};
