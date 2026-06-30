import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { TaskService } from '../services/task.service';

export const badgeController = {
  async getBadges(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;

      // Ensure badges are seeded in DB (task.service handles both tasks + badges)
      await TaskService.seedDefaults();

      const [allBadges, earnedBadges] = await Promise.all([
        prisma.badge.findMany({
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        }),
        prisma.userBadge.findMany({
          where: { userId },
          include: { badge: true },
        }),
      ]);

      const earnedKeys = new Set(earnedBadges.map((ub) => ub.badge.key));

      const result = allBadges.map((badge) => ({
        ...badge,
        earnedAt: earnedBadges.find((ub) => ub.badgeId === badge.id)?.earnedAt || null,
        isEarned: earnedKeys.has(badge.key),
      }));

      res.json({
        success: true,
        data: {
          badges: result,
          earnedCount: earnedKeys.size,
          totalCount: allBadges.length,
        },
      });
    } catch (err) {
      next(err);
    }
  },
};
