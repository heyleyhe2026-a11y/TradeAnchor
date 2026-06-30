import { CreditSource } from '../generated/prisma';
import { AppError } from '../utils/app-error';
import { prisma } from '../lib/prisma';

const DAILY_CREDIT_CAP = 10;
const CREDIT_EXPIRY_DAYS = 30;

export class CreditService {
  static async earnCredits(userId: string, amount: number, source: CreditSource, taskKey?: string, description?: string) {
    // Check daily cap for trade-related earnings
    if (source === 'trade_creation') {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEarned = await prisma.credit.aggregate({
        _sum: { amount: true },
        where: { userId, source, earnedAt: { gte: todayStart }, consumed: false },
      });
      if ((todayEarned._sum.amount || 0) >= DAILY_CREDIT_CAP) {
        return { earned: 0, message: `Daily cap (${DAILY_CREDIT_CAP}) reached` };
      }
      const remaining = DAILY_CREDIT_CAP - (todayEarned._sum.amount || 0);
      amount = Math.min(amount, remaining);
    }

    const expiresAt = new Date(Date.now() + CREDIT_EXPIRY_DAYS * 86400000);

    return prisma.credit.create({
      data: { userId, amount, source, taskKey, description, expiresAt },
    });
  }

  static async spendCredits(userId: string, amount: number, description?: string) {
    const balance = await this.getBalance(userId);
    if (balance.available < amount) {
      throw new AppError(400, `Insufficient credits. Available: ${balance.available}, Required: ${amount}`);
    }

    const creditsToConsume = await prisma.credit.findMany({
      where: { userId, consumed: false, expiresAt: { gt: new Date() } },
      orderBy: { expiresAt: 'asc' },
    });

    let remaining = amount;
    const consumed: string[] = [];
    for (const credit of creditsToConsume) {
      if (remaining <= 0) break;

      if (credit.amount <= remaining) {
        // Consume entire record
        await prisma.credit.update({
          where: { id: credit.id },
          data: { consumed: true, consumedAt: new Date(), description },
        });
        consumed.push(credit.id);
        remaining -= credit.amount;
      } else {
        // Partially consume: split this record into consumed + remainder
        await prisma.credit.update({
          where: { id: credit.id },
          data: { amount: credit.amount - remaining },
        });
        await prisma.credit.create({
          data: {
            userId,
            amount: remaining,
            source: credit.source,
            earnedAt: credit.earnedAt,
            expiresAt: credit.expiresAt,
            consumed: true,
            consumedAt: new Date(),
            description,
          },
        });
        remaining = 0;
      }
    }

    return { spent: amount - remaining, remaining };
  }

  static async getBalance(userId: string) {
    const now = new Date();
    const [availableAgg, expiringSoonAgg, totalAgg] = await Promise.all([
      prisma.credit.aggregate({
        _sum: { amount: true },
        where: { userId, consumed: false, expiresAt: { gt: now } },
      }),
      prisma.credit.aggregate({
        _sum: { amount: true },
        where: {
          userId, consumed: false,
          expiresAt: { gt: now, lte: new Date(now.getTime() + 3 * 86400000) },
        },
      }),
      prisma.credit.aggregate({
        _sum: { amount: true },
        where: { userId, consumed: false, expiresAt: { gt: now } },
      }),
    ]);

    return {
      available: availableAgg._sum.amount || 0,
      expiringSoon: expiringSoonAgg._sum.amount || 0,
      total: totalAgg._sum.amount || 0,
    };
  }

  static async getHistory(userId: string, query: { page?: number | string; limit?: number | string }) {
    const page = Number(query.page || 1);
    const limit = Math.min(Number(query.limit || 20), 200);
    const skip = (page - 1) * limit;

    const [credits, total] = await Promise.all([
      prisma.credit.findMany({
        where: { userId },
        orderBy: { earnedAt: 'desc' },
        skip, take: limit,
      }),
      prisma.credit.count({ where: { userId } }),
    ]);
    return { credits, total, pages: Math.ceil(total / limit), currentPage: page };
  }

  static async cleanupExpired() {
    const result = await prisma.credit.deleteMany({
      where: { consumed: false, expiresAt: { lt: new Date() } },
    });
    return result.count;
  }
}
