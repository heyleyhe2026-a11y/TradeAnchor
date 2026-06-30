import crypto from 'crypto';
import { SubscriptionTier, SubscriptionStatus } from '../generated/prisma';
import { prisma } from '../lib/prisma';

// Map FastSpring product path -> TradeWise subscription tier
const PRODUCT_TIER_MAP: Record<string, SubscriptionTier> = {
  advanced: 'prem',       // Advanced Plan ($29) -> Premium tier
  professional: 'pro',     // Professional Plan ($19) -> Pro tier
};

// Map FS event types — must match FastSpring Dashboard event names exactly
type FsEventType =
  | 'subscriptionActivated'    // new subscription started
  | 'subscriptionResumed'     // auto-renewal / re-activation (FS uses "resumed")
  | 'subscriptionCancelled'   // user cancelled
  | 'subscriptionDeactivated' // payment failed / system cancelled
  | 'subscriptionUpdated'     // plan changed (upgrade/downgrade)
  | 'orderCompleted';         // one-time order

interface FsEvent {
  eventType: string;
  created: number;
  data?: Record<string, any>;
}

interface FsPayload {
  events?: FsEvent[];
}

interface FsEventData {
  subscriptionId?: string;
  productId?: string;          // e.g. "advanced", "professional"
  orderReference?: string;
  invoiceUrl?: string;
  customer?: { email?: string };
  /** ISO-8601 date strings */
  subscriptionBeginDate?: string;
  subscriptionEndDate?: string;
  nextPeriodDate?: string;
  // For one-time orders
  id?: string;
  total?: number;
  currency?: string;
}

export class FastSpringService {

  // ---------- Signature Verification ----------
  static verifySignature(
    rawBody: string,
    fsSignature: string,
    fsTimestamp: string,
    secret: string,
  ): boolean {
    const payload = `${rawBody}${fsTimestamp}`;
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const digest = hmac.digest('base64');
    return digest === fsSignature;
  }

  // ---------- Main Webhook Handler ----------
  static async handleWebhook(payload: FsPayload): Promise<{ processed: number; errors: string[] }> {
    const events = payload.events || [];
    const result = { processed: 0, errors: [] as string[] };

    for (const evt of events) {
      try {
        await this.processEvent(evt.eventType as FsEventType, (evt.data || {}) as FsEventData);
        result.processed++;
      } catch (e: any) {
        result.errors.push(`[${evt.eventType}] ${e.message}`);
      }
    }

    return result;
  }

  // ---------- Event Router ----------
  private static async processEvent(type: FsEventType, data: FsEventData): Promise<void> {
    switch (type) {
      case 'subscriptionActivated':
        return this.onSubscriptionActivated(data);
      case 'subscriptionResumed':
        return this.onSubscriptionResumed(data);
      case 'subscriptionCancelled':
        return this.onSubscriptionCancelled(data);
      case 'subscriptionDeactivated':
        return this.onSubscriptionDeactivated(data);
      case 'subscriptionUpdated':
        return this.onSubscriptionUpdated(data);
      case 'orderCompleted':
        return this.onOrderCompleted(data);
      default:
        console.log(`[FastSpring] Unhandled event type: ${type}`);
    }
  }

  // ---------- Individual Event Handlers ----------

  /**
   * New subscription created or re-activated after cancellation.
   * - Find user by email from FS customer data
   * - Create or update Subscription record
   * - Create Payment record
   */
  private static async onSubscriptionActivated(data: FsEventData) {
    if (!data.subscriptionId || !data.productId) {
      throw new Error('Missing subscriptionId or productId in subscriptionActivated');
    }
    const tier = PRODUCT_TIER_MAP[data.productId];
    if (!tier) throw new Error(`Unknown product path: ${data.productId}`);

    const user = await this.findUserByEmail(data.customer?.email);

    // Upsert subscription
    const beginDate = data.subscriptionBeginDate ? new Date(data.subscriptionBeginDate) : new Date();
    const endDate = data.subscriptionEndDate ? new Date(data.subscriptionEndDate) : null;

    let subscription = await prisma.subscription.findUnique({
      where: { fsSubscriptionId: data.subscriptionId },
    });

    if (subscription) {
      // Re-activation of previously cancelled subscription
      subscription = await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          tier,
          status: 'active' as SubscriptionStatus,
          expiresAt: endDate,
          autoRenew: true,
          fsProductId: data.productId,
          startedAt: beginDate,
          updatedAt: new Date(),
        },
      });
    } else {
      // Brand new subscription
      if (user) {
        // Deactivate existing active subscriptions for same user
        await prisma.subscription.updateMany({
          where: { userId: user.id, status: 'active' as SubscriptionStatus },
          data: { status: 'cancelled' as SubscriptionStatus, cancelledAt: new Date() },
        });
      }

      subscription = await prisma.subscription.create({
        data: {
          userId: user?.id || '',
          tier,
          status: 'active',
          startedAt: beginDate,
          expiresAt: endDate,
          autoRenew: true,
          fsSubscriptionId: data.subscriptionId,
          fsProductId: data.productId,
          fsOrderId: data.orderReference || null,
        },
      });
    }

    // Create payment record for activation
    await prisma.payment.create({
      data: {
        userId: user?.id || '',
        subscriptionId: subscription.id,
        amount: '0',
        currency: 'USD',
        paymentMethod: 'fastspring',
        status: 'completed',
        gatewayTransactionId: data.orderReference || null,
        fsOrderId: data.orderReference || null,
        fsInvoiceUrl: data.invoiceUrl || null,
        completedAt: new Date(),
      },
    });

    console.log(`[FastSpring] Subscription activated: ${data.subscriptionId} -> tier=${tier}, user=${user?.email || '?'}`);
  }

  /**
   * Subscription resumed — auto-renewal or re-activation after pause.
   */
  private static async onSubscriptionResumed(data: FsEventData) {
    if (!data.subscriptionId) throw new Error('Missing subscriptionId in subscriptionResumed');

    const subscription = await prisma.subscription.findUnique({
      where: { fsSubscriptionId: data.subscriptionId },
    });
    if (!subscription) throw new Error(`Subscription not found: ${data.subscriptionId}`);

    const endDate = data.subscriptionEndDate ? new Date(data.subscriptionEndDate) : null;

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'active' as SubscriptionStatus,
        expiresAt: endDate,
        autoRenew: true,
        fsOrderId: data.orderReference || null,
      },
    });

    // Create renewal payment record
    await prisma.payment.create({
      data: {
        userId: subscription.userId,
        subscriptionId: subscription.id,
        amount: '0',
        currency: data.currency || 'USD',
        paymentMethod: 'fastspring',
        status: 'completed',
        gatewayTransactionId: data.orderReference || null,
        fsOrderId: data.orderReference || null,
        fsInvoiceUrl: data.invoiceUrl || null,
        completedAt: new Date(),
      },
    });

    console.log(`[FastSpring] Subscription resumed: ${data.subscriptionId}, until=${endDate?.toISOString()}`);
  }

  /**
   * User-initiated cancellation (auto-renew off).
   */
  private static async onSubscriptionCancelled(data: FsEventData) {
    if (!data.subscriptionId) throw new Error('Missing subscriptionId in subscriptionCancelled');

    const subscription = await prisma.subscription.findUnique({
      where: { fsSubscriptionId: data.subscriptionId },
    });
    if (!subscription) throw new Error(`Subscription not found: ${data.subscriptionId}`);

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        autoRenew: false,
        status: 'cancelled' as SubscriptionStatus,
        cancelledAt: new Date(),
      },
    });

    console.log(`[FastSpring] Subscription cancelled: ${data.subscriptionId} (access continues until end of period)`);
  }

  /**
   * System deactivation (payment failure etc.)
   */
  private static async onSubscriptionDeactivated(data: FsEventData) {
    if (!data.subscriptionId) throw new Error('Missing subscriptionId in subscriptionDeactivated');

    const subscription = await prisma.subscription.findUnique({
      where: { fsSubscriptionId: data.subscriptionId },
    });
    if (!subscription) throw new Error(`Subscription not found: ${data.subscriptionId}`);

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        autoRenew: false,
        status: 'expired' as SubscriptionStatus,
      },
    });

    console.log(`[FastSpring] Subscription deactivated (expired/failed): ${data.subscriptionId}`);
  }

  /**
   * Plan change (upgrade/downgrade between advanced <-> professional)
   */
  private static async onSubscriptionUpdated(data: FsEventData) {
    if (!data.subscriptionId || !data.productId) {
      throw new Error('Missing subscriptionId or productId in subscriptionUpdated');
    }
    const tier = PRODUCT_TIER_MAP[data.productId];
    if (!tier) throw new Error(`Unknown product path: ${data.productId}`);

    const subscription = await prisma.subscription.findUnique({
      where: { fsSubscriptionId: data.subscriptionId },
    });
    if (!subscription) throw new Error(`Subscription not found: ${data.subscriptionId}`);

    const endDate = data.subscriptionEndDate ? new Date(data.subscriptionEndDate) : null;

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        tier,
        fsProductId: data.productId,
        expiresAt: endDate,
        fsOrderId: data.orderReference || null,
      },
    });

    console.log(`[FastSpring] Subscription updated: ${data.subscriptionId} -> tier=${tier}`);
  }

  /**
   * One-time order completed (if you ever sell one-time products via FS).
   * For now just logs and creates a payment record.
   */
  private static async onOrderCompleted(data: FsEventData) {
    if (!data.id) throw new Error('Missing order ID in orderCompleted');

    const user = await this.findUserByEmail(data.customer?.email);

    await prisma.payment.create({
      data: {
        userId: user?.id || '',
        amount: String((data.total ?? 0) / 100), // FS sends amounts in cents
        currency: data.currency || 'USD',
        paymentMethod: 'fastspring',
        status: 'completed',
        gatewayTransactionId: data.id,
        fsOrderId: data.id,
        fsInvoiceUrl: data.invoiceUrl || null,
        completedAt: new Date(),
      },
    });

    console.log(`[FastSpring] Order completed: ${data.id}, amount=${data.total}, user=${user?.email || '?'}`);
  }

  // ---------- Helpers ----------

  private static async findUserByEmail(email?: string) {
    if (!email) {
      // If no email in payload, log a warning and return null
      console.warn('[FastSpring] No customer email in webhook payload');
      return null;
    }
    return prisma.user.findUnique({ where: { email } });
  }

  /**
   * Generate a checkout URL for a given product path.
   * Used by frontend to redirect users to FastSpring storefront.
   */
  static generateCheckoutUrl(productId: string, userEmail: string, baseUrl?: string): string {
    // Use Web Checkout URL (custom subdomain) if configured, fallback to standard storefront
    const base = baseUrl ||
      process.env.FASTSPRING_WEB_CHECKOUT_URL ||
      `https://sites.fastspring.com/${process.env.FASTSPRING_STORE_ID || 'tradewise_store'}/product`;
    return `${base}/${productId}?contact[email]=${encodeURIComponent(userEmail)}&checkout=1`;
  }
}
