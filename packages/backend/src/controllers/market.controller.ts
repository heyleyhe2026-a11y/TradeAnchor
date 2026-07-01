import { Request, Response, NextFunction } from 'express';
import { marketService } from '../services/market.service';

export class MarketController {
  async getSymbols(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const symbols = await marketService.getUserSymbols(req.user!.id);
      res.status(200).json({ symbols });
    } catch (error) {
      next(error);
    }
  }

  async getCandles(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const symbol = String(req.query.symbol || '');
      const interval = String(req.query.interval || 'H1');
      const outputsize = req.query.outputsize ? Number(req.query.outputsize) : undefined;

      const data = await marketService.getCandles(symbol, interval, outputsize);
      res.status(200).json(data);
    } catch (error) {
      next(error);
    }
  }

  async searchSymbols(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const q = String(req.query.q || '');
      const results = await marketService.searchSymbols(req.user!.id, q);
      res.status(200).json({ results });
    } catch (error) {
      next(error);
    }
  }

  async getQuote(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const symbol = String(req.query.symbol || '');
      const data = await marketService.getQuote(symbol);
      res.status(200).json(data);
    } catch (error) {
      next(error);
    }
  }
}

export const marketController = new MarketController();
