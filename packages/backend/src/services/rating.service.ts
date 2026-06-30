import { prisma } from '../lib/prisma';
import { CreateRatingDto, UpdateRatingDto } from '../validators/rating.validator';

export class RatingService {
  /** Rate a playbook (create or update) */
  async ratePlaybook(userId: string, playbookId: string, data: CreateRatingDto | UpdateRatingDto) {
    // Verify playbook exists
    const playbook = await prisma.playbook.findUnique({ where: { id: playbookId } });
    if (!playbook || playbook.status !== 'published') {
      throw new Error('Strategy not found or not published');
    }

    const existing = await (prisma as any).playbookRating.findUnique({
      where: { playbookId_userId: { playbookId, userId } },
    });

    if (existing) {
      return (prisma as any).playbookRating.update({
        where: { id: existing.id },
        data: { ...data, updatedAt: new Date() },
      });
    }

    return (prisma as any).playbookRating.create({
      data: { userId, playbookId, ...data },
    });
  }

  /** Get all ratings for a playbook (with user info) */
  async getRatings(playbookId: string, page = 1, limit = 20) {
    const p = Number(page) || 1;
    const l = Number(limit) || 20;
    const skip = (p - 1) * l;

    const [ratings, total] = await Promise.all([
      (prisma as any).playbookRating.findMany({
        where: { playbookId },
        include: {
          user: { select: { id: true, displayName: true, avatarUrl: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: l,
      }),
      (prisma as any).playbookRating.count({ where: { playbookId } }),
    ]);

    // Calculate average rating
    const avgResult = await (prisma as any).playbookRating.aggregate({
      where: { playbookId },
      _avg: { rating: true },
      _count: true,
    });

    return {
      ratings,
      total,
      pages: Math.ceil(total / l),
      currentPage: p,
      avgRating: Math.round((avgResult._avg.rating || 0) * 10) / 10,
      ratingCount: avgResult._count,
    };
  }

  /** Get current user's rating for a specific playbook */
  async getUserRating(userId: string, playbookId: string) {
    return (prisma as any).playbookRating.findUnique({
      where: { playbookId_userId: { playbookId, userId } },
    });
  }

  /** Delete a rating */
  async deleteRating(userId: string, playbookId: string) {
    return (prisma as any).playbookRating.delete({
      where: { playbookId_userId: { playbookId, userId } },
    });
  }
}

export const ratingService = new RatingService();
