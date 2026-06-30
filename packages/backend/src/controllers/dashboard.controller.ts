import { Request, Response, NextFunction } from 'express';
import { dashboardService } from '../services/dashboard.service';

export class DashboardController {
  /**
   * GET /v1/dashboard/stats
   */
  async getDashboardStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filters = {
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
        symbol: req.query.symbol as string | undefined,
        direction: (req.query.direction === 'long' || req.query.direction === 'short' ? req.query.direction : undefined) as 'long' | 'short' | undefined,
      };
      const stats = await dashboardService.getDashboardStats(req.user!.id, filters);
      res.status(200).json(stats);
    } catch (error) { next(error); }
  }

  /**
   * GET /v1/dashboard/confidence
   */
  async getConfidenceScore(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const score = await dashboardService.getConfidenceScore(req.user!.id);
      res.status(200).json(score);
    } catch (error) { next(error); }
  }

  /**
   * GET /v1/dashboard/calendar
   */
  async getCalendarData(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const months = req.query.months ? parseInt(String(req.query.months)) : undefined;
      const filters = {
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
        symbol: req.query.symbol as string | undefined,
        direction: (req.query.direction === 'long' || req.query.direction === 'short' ? req.query.direction : undefined) as 'long' | 'short' | undefined,
      };
      const data = await dashboardService.getCalendarData(req.user!.id, months, filters);
      res.status(200).json(data);
    } catch (error) { next(error); }
  }
}

export const dashboardController = new DashboardController();
