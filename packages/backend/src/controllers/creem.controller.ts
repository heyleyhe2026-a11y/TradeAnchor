import { Request, Response } from 'express';
import { CreemService } from '../services/creem.service';
import { getPaymentProvider } from '../lib/payment-provider';

export const creemController = {
  /**
   * POST /api/v1/webhooks/creem
   * Mounted in app.ts with express.raw() for signature verification.
   */
  async handleWebhook(req: Request, res: Response) {
    const signature = req.headers['creem-signature'] as string | undefined;
    const secret = process.env.CREEM_WEBHOOK_SECRET;
    const rawBody = req.body instanceof Buffer ? req.body.toString('utf8') : String(req.body ?? '');

    if (secret) {
      if (!signature) {
        return res.status(401).json({ error: 'Missing creem-signature header' });
      }
      if (!CreemService.verifySignature(rawBody, signature, secret)) {
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    try {
      const event = JSON.parse(rawBody);
      const result = await CreemService.handleWebhook(event);
      return res.json({ success: true, ...result });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.error('[Creem] Webhook processing failed:', message);
      return res.status(500).json({ success: false, error: message });
    }
  },

  /**
   * GET /api/v1/webhooks/checkout?product=pro|prem|professional|advanced
   */
  async getCheckoutUrl(req: Request, res: Response) {
    const product = String(req.query.product || '');
    const tierKey = CreemService.normalizeTierKey(product);

    if (!tierKey || !CreemService.isCheckoutProductKey(product)) {
      return res.status(400).json({
        error: 'Invalid product. Use "pro", "prem", "professional", or "advanced"',
      });
    }

    try {
      const checkoutUrl = await CreemService.createCheckout(
        tierKey,
        req.user!.id,
        req.user!.email,
      );
      return res.json({ checkoutUrl, provider: getPaymentProvider() });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.error('[Creem] Checkout creation failed:', message);
      return res.status(500).json({ error: message });
    }
  },
};
