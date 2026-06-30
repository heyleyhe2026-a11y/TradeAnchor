import prisma from '../lib/prisma';
import { getRedisClient, RedisKeys, RedisTTL } from '../lib/redis';

export interface PublicStats {
  userCount: number;
  tradeCount: number;
  communityPostCount: number;
  updatedAt: string;
}

export async function getPublicStats(): Promise<PublicStats> {
  const redis = getRedisClient();
  const cacheKey = RedisKeys.publicStats();

  const cached = await redis.get(cacheKey);
  if (cached) {
    const parsed = JSON.parse(cached) as Partial<PublicStats>;
    if (
      typeof parsed.userCount === 'number' &&
      typeof parsed.tradeCount === 'number' &&
      typeof parsed.communityPostCount === 'number'
    ) {
      return parsed as PublicStats;
    }
  }

  const [userCount, tradeCount, communityPostCount] = await Promise.all([
    prisma.user.count(),
    prisma.trade.count(),
    prisma.playbook.count({ where: { status: 'published' } }),
  ]);
  const stats: PublicStats = {
    userCount,
    tradeCount,
    communityPostCount,
    updatedAt: new Date().toISOString(),
  };

  await redis.setex(cacheKey, RedisTTL.PUBLIC_STATS, JSON.stringify(stats));
  return stats;
}
