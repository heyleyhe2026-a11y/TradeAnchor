import { Request, Response, NextFunction } from 'express';
import { TaskService, LEADERBOARD_MIN_TRADES, LEADERBOARD_MIN_INVESTMENT_USD } from '../services/task.service';
import { PLATFORM_CURRENCY } from '../services/fx.service';

export const taskController = {
  async getTasks(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const grouped = await TaskService.getGroupedByCategory(userId);
      res.json({ success: true, data: grouped });
    } catch (err) {
      next(err);
    }
  },

  async getStats(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const stats = await TaskService.getUserStats(userId);
      res.json({ success: true, data: stats });
    } catch (err) {
      next(err);
    }
  },

  async claimReward(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { taskId } = req.params;
      const result = await TaskService.claimRewards(userId, taskId);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  // ===== Leaderboard Endpoints =====

  async getPublisherLeaderboard(req: Request, res: Response, next: NextFunction) {
    try {
      const limit = Number(req.query.limit) || 10;
      const data = await TaskService.getPublisherLeaderboard(limit);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async getSellerLeaderboard(req: Request, res: Response, next: NextFunction) {
    try {
      const limit = Number(req.query.limit) || 10;
      const data = await TaskService.getSellerLeaderboard(limit);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async getReturnRateLeaderboard(req: Request, res: Response, next: NextFunction) {
    try {
      const limit = Number(req.query.limit) || 10;
      const period = (req.query.period as string) || '3m';
      const validPeriods = ['1m', '3m', '6m', '12m'];
      if (!validPeriods.includes(period)) {
        res.status(400).json({ success: false, message: 'Invalid period. Use: 1m, 3m, 6m, or 12m' });
        return;
      }
      const data = await TaskService.getReturnRateLeaderboard(limit, period as any);
      res.json({
        success: true,
        data,
        meta: {
          formula: 'netPnL / (entryPrice × qty / leverage)',
          periodBasis: 'exitTimestamp',
          pnlIncludesFees: true,
          platformCurrency: PLATFORM_CURRENCY,
          minTrades: LEADERBOARD_MIN_TRADES,
          minInvestmentUsd: LEADERBOARD_MIN_INVESTMENT_USD,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  async getViewsLeaderboard(req: Request, res: Response, next: NextFunction) {
    try {
      const limit = Number(req.query.limit) || 10;
      const data = await TaskService.getViewsLeaderboard(limit);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
};
