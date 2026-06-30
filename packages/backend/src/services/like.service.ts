import { prisma } from '../lib/prisma';
import { AppError } from '../utils/app-error';

export class LikeService {
  static async toggleLike(userId: string, playbookId: string) {
    const playbook = await prisma.playbook.findUnique({
      where: { id: playbookId },
      select: { id: true, status: true },
    });
    if (!playbook || playbook.status !== 'published') {
      throw new AppError(404, 'Playbook not found');
    }

    const existing = await prisma.playbookLike.findUnique({
      where: { userId_playbookId: { userId, playbookId } },
    });

    if (existing) {
      await prisma.playbookLike.delete({ where: { id: existing.id } });
    } else {
      await prisma.playbookLike.create({ data: { userId, playbookId } });
    }

    const likeCount = await prisma.playbookLike.count({ where: { playbookId } });
    return { liked: !existing, likeCount };
  }

  static async getLikeCounts(playbookIds: string[]): Promise<Record<string, number>> {
    if (!playbookIds.length) return {};

    const results = await prisma.playbookLike.groupBy({
      by: ['playbookId'],
      where: { playbookId: { in: playbookIds } },
      _count: true,
    });

    const map: Record<string, number> = {};
    for (const r of results) {
      map[r.playbookId] = r._count;
    }
    for (const id of playbookIds) {
      if (!(id in map)) map[id] = 0;
    }
    return map;
  }

  static async getUserLikeIds(userId: string): Promise<Set<string>> {
    const likes = await prisma.playbookLike.findMany({
      where: { userId },
      select: { playbookId: true },
    });
    return new Set(likes.map((l: { playbookId: string }) => l.playbookId));
  }
}
