import { Request, Response } from 'express';
import { CreditService } from '../services/credit.service';

export const creditController = {
  async getBalance(req: Request, res: Response) {
    const balance = await CreditService.getBalance(req.user!.id);
    res.json({ success: true, data: balance });
  },

  async spend(req: Request, res: Response) {
    const { amount } = req.body;
    const result = await CreditService.spendCredits(req.user!.id, amount);
    res.json({ success: true, data: result });
  },

  async getHistory(req: Request, res: Response) {
    const result = await CreditService.getHistory(req.user!.id, req.query as any);
    res.json({ success: true, ...result });
  },
};
