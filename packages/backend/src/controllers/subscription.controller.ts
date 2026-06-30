import { Request, Response } from 'express';
import { SubscriptionService } from '../services/subscription.service';

export const subscriptionController = {
  async getCurrent(req: Request, res: Response) {
    const sub = await SubscriptionService.getCurrentSubscription(req.user!.id);
    res.json({ success: true, data: sub });
  },

  async upgrade(req: Request, res: Response) {
    const { tier } = req.body;
    if (!['pro', 'prem'].includes(tier)) return res.status(400).json({ error: 'Invalid target tier' });
    const sub = await SubscriptionService.upgrade(req.user!.id, tier);
    res.status(201).json({ success: true, data: sub });
  },

  async downgrade(req: Request, res: Response) {
    const sub = await SubscriptionService.downgrade(req.user!.id);
    res.json({ success: true, data: sub, message: 'Access continues until end of billing cycle' });
  },

  async setAutoRenew(req: Request, res: Response) {
    const { autoRenew } = req.body;
    const sub = await SubscriptionService.setAutoRenew(req.user!.id, !!autoRenew);
    res.json({
      success: true,
      data: sub,
      message: autoRenew
        ? 'Auto-renew enabled'
        : 'Subscription will remain active until the end of the current billing period',
    });
  },

  async getHistory(req: Request, res: Response) {
    const history = await SubscriptionService.getHistory(req.user!.id);
    res.json({ success: true, data: history });
  },
};
