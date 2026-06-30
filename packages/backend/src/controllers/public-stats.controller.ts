import { Request, Response, NextFunction } from 'express';
import { getPublicStats } from '../services/public-stats.service';

/**
 * GET /api/v1/public/stats
 * Public platform stats for landing page (no auth required)
 */
export async function getStats(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const stats = await getPublicStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
}
