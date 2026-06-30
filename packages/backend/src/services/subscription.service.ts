import { Subscription, SubscriptionTier, SubscriptionStatus } from '../generated/prisma';
import { AppError } from '../utils/app-error';
import { prisma } from '../lib/prisma';
import { getPaymentProvider } from '../lib/payment-provider';
import { CreemService } from './creem.service';

type DefaultFreeSubscription = {
  id: string;
  userId: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  startedAt: Date;
  expiresAt: Date | null;
  autoRenew: boolean;
};

export class SubscriptionService {
  /** Backfill missing expiresAt for paid Creem subscriptions. */
  private static async ensureExpiresAt(subscription: Subscription): Promise<Subscription> {
    if (subscription.tier === 'free' || subscription.expiresAt) return subscription;

    let expiresAt: Date | null = null;
    if (getPaymentProvider() === 'creem' && subscription.fsSubscriptionId) {
      try {
        expiresAt = await CreemService.fetchSubscriptionPeriodEnd(subscription.fsSubscriptionId);
      } catch (err) {
        console.warn('[Subscription] Creem period sync failed:', err);
      }
    }
    if (!expiresAt) {
      expiresAt = CreemService.fallbackPeriodEnd(subscription.startedAt);
    }

    return prisma.subscription.update({
      where: { id: subscription.id },
      data: { expiresAt, autoRenew: true },
    });
  }

  static async getCurrentSubscription(userId: string): Promise<Subscription | DefaultFreeSubscription> {
    const subscription = await prisma.subscription.findFirst({
      where: { userId, status: 'active' as SubscriptionStatus },
      orderBy: { createdAt: 'desc' },
    });
    if (!subscription) {
      return {
        id: '', userId, tier: 'free' as SubscriptionTier, status: 'active' as SubscriptionStatus,
        startedAt: new Date(), expiresAt: null, autoRenew: false,
      };
    }
    if (!subscription.expiresAt && subscription.tier !== 'free') {
      return this.ensureExpiresAt(subscription);
    }
    return subscription;
  }

  static async upgrade(userId: string, targetTier: SubscriptionTier) {
    const current = await this.getCurrentSubscription(userId);
    const tierOrder: SubscriptionTier[] = ['free', 'pro', 'prem'];
    const currentIndex = tierOrder.indexOf(current.tier);
    const targetIndex = tierOrder.indexOf(targetTier);

    if (targetIndex <= currentIndex) {
      throw new AppError(400, `Cannot upgrade to ${targetTier} from ${current.tier}`);
    }

    return prisma.$transaction(async (tx) => {
      // Deactivate old subscription
      if (current.id) {
        await tx.subscription.update({
          where: { id: current.id },
          data: { status: 'cancelled' as SubscriptionStatus, cancelledAt: new Date() },
        });
      }

      const now = new Date();
      const expiresAt = new Date(now.setMonth(now.getMonth() + 1));

      return tx.subscription.create({
        data: {
          userId,
          tier: targetTier,
          status: 'active',
          expiresAt,
          autoRenew: true,
        },
      });
    });
  }

  static async downgrade(userId: string) {
    const current = await this.getCurrentSubscription(userId);
    if (current.tier === 'free') throw new AppError(400, 'Already on Free plan');
    if (current.tier !== 'prem' && current.tier !== 'pro') throw new AppError(400, 'Invalid current plan');

    // Keep access until end of billing cycle
    return prisma.subscription.update({
      where: { id: current.id },
      data: { autoRenew: false },
    });
  }

  static async setAutoRenew(userId: string, autoRenew: boolean) {
    const sub = await prisma.subscription.findFirst({
      where: { userId, status: 'active' as SubscriptionStatus },
      orderBy: { createdAt: 'desc' },
    });
    if (!sub) throw new AppError(404, 'No active subscription found');
    if (sub.tier === 'free') throw new AppError(400, 'Free plan does not support auto-renew');

    if (getPaymentProvider() === 'creem' && sub.fsSubscriptionId) {
      if (!autoRenew) {
        await CreemService.scheduleCancelAtPeriodEnd(sub.fsSubscriptionId);
      } else if (!sub.autoRenew) {
        try {
          await CreemService.resumeSubscription(sub.fsSubscriptionId);
        } catch (err) {
          // Subscription may already be active in Creem (e.g. stale local flag)
          console.warn('[Creem] Resume subscription skipped:', err);
        }
      }
    }

    return prisma.subscription.update({ where: { id: sub.id }, data: { autoRenew } });
  }

  static async getHistory(userId: string) {
    return prisma.subscription.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
