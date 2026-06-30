import crypto from 'crypto';
import { PaymentMethod, SubscriptionStatus, SubscriptionTier } from '../generated/prisma';
import { prisma } from '../lib/prisma';

type CreemTierKey = 'pro' | 'prem';

interface CreemWebhookEvent {
  id?: string;
  eventType: string;
  object?: Record<string, unknown>;
}

interface CreemCustomer {
  id?: string;
  email?: string;
  name?: string;
}

interface CreemProductRef {
  id?: string;
}

interface CreemSubscriptionObject {
  id?: string;
  status?: string;
  product?: string | CreemProductRef;
  customer?: string | CreemCustomer;
  current_period_end_date?: string;
  next_transaction_date?: string;
  canceled_at?: string | null;
  metadata?: Record<string, unknown>;
}

interface CreemCheckoutObject {
  id?: string;
  order?: {
    id?: string;
    amount?: number;
    currency?: string;
    product?: string;
  };
  product?: string | CreemProductRef;
  customer?: string | CreemCustomer;
  subscription?: string | CreemSubscriptionObject;
  metadata?: Record<string, unknown>;
}

const CHECKOUT_PRODUCT_KEYS = new Set(['pro', 'prem', 'professional', 'advanced']);

export class CreemService {
  static normalizeTierKey(product: string): CreemTierKey | null {
    const key = product.toLowerCase();
    if (key === 'pro' || key === 'professional') return 'pro';
    if (key === 'prem' || key === 'advanced' || key === 'premium') return 'prem';
    return null;
  }

  static isCheckoutProductKey(product: string): boolean {
    return CHECKOUT_PRODUCT_KEYS.has(product.toLowerCase());
  }

  static verifySignature(rawBody: string, signature: string, secret: string): boolean {
    const computed = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(signature, 'hex'));
    } catch {
      return false;
    }
  }

  private static async creemApiRequest(path: string, init: RequestInit): Promise<unknown> {
    const apiKey = process.env.CREEM_API_KEY;
    if (!apiKey) throw new Error('CREEM_API_KEY is not configured');

    const base = (process.env.CREEM_API_BASE || 'https://api.creem.io').replace(/\/$/, '');
    const response = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        ...(init.headers as Record<string, string> | undefined),
      },
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Creem API error (${response.status}): ${detail}`);
    }

    return response.json();
  }

  /** Schedule cancellation at end of current billing period (customer keeps access until then). */
  static async scheduleCancelAtPeriodEnd(subscriptionId: string): Promise<void> {
    await this.creemApiRequest(`/v1/subscriptions/${subscriptionId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ mode: 'scheduled', onExecute: 'cancel' }),
    });
  }

  /** Undo a scheduled cancellation and re-enable auto-renewal. */
  static async resumeSubscription(subscriptionId: string): Promise<void> {
    await this.creemApiRequest(`/v1/subscriptions/${subscriptionId}/resume`, {
      method: 'POST',
    });
  }

  static extractPeriodEnd(sub: CreemSubscriptionObject | undefined | null): Date | null {
    if (!sub) return null;
    const raw = sub.current_period_end_date || sub.next_transaction_date;
    return raw ? new Date(raw) : null;
  }

  static fallbackPeriodEnd(from: Date = new Date()): Date {
    const end = new Date(from);
    end.setMonth(end.getMonth() + 1);
    return end;
  }

  /** Fetch current period end from Creem for backfilling missing expiresAt. */
  static async fetchSubscriptionPeriodEnd(subscriptionId: string): Promise<Date | null> {
    const data = (await this.creemApiRequest(`/v1/subscriptions/${subscriptionId}`, {
      method: 'GET',
    })) as CreemSubscriptionObject;
    return this.extractPeriodEnd(data) ?? null;
  }

  static async createCheckout(tierKey: CreemTierKey, userId: string, email: string): Promise<string> {
    const productId = tierKey === 'pro' ? process.env.CREEM_PRODUCT_PRO : process.env.CREEM_PRODUCT_PREM;
    if (!productId) throw new Error(`Creem product ID not configured for tier: ${tierKey}`);

    const apiKey = process.env.CREEM_API_KEY;
    if (!apiKey) throw new Error('CREEM_API_KEY is not configured');

    const base = (process.env.CREEM_API_BASE || 'https://api.creem.io').replace(/\/$/, '');
    const successUrl =
      process.env.CREEM_SUCCESS_URL ||
      `${process.env.FRONTEND_URL || 'https://mytradewiseoc.com'}/subscription`;

    const response = await fetch(`${base}/v1/checkouts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        product_id: productId,
        success_url: successUrl,
        request_id: `${userId}-${tierKey}-${Date.now()}`,
        customer: { email },
        metadata: { userId, tier: tierKey },
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Creem checkout API error (${response.status}): ${detail}`);
    }

    const data = (await response.json()) as { checkout_url?: string; checkoutUrl?: string };
    const checkoutUrl = data.checkout_url || data.checkoutUrl;
    if (!checkoutUrl) throw new Error('Creem did not return checkout_url');
    return checkoutUrl;
  }

  static async handleWebhook(event: CreemWebhookEvent): Promise<{ processed: boolean; eventType: string }> {
    const type = event.eventType;
    const object = (event.object || {}) as Record<string, unknown>;

    switch (type) {
      case 'checkout.completed':
        await this.onCheckoutCompleted(object as CreemCheckoutObject);
        break;
      case 'subscription.active':
      case 'subscription.paid':
        await this.onSubscriptionPaid(object as CreemSubscriptionObject);
        break;
      case 'subscription.update':
        await this.onSubscriptionUpdated(object as CreemSubscriptionObject);
        break;
      case 'subscription.scheduled_cancel':
        await this.onSubscriptionScheduledCancel(object as CreemSubscriptionObject);
        break;
      case 'subscription.canceled':
        await this.onSubscriptionCanceled(object as CreemSubscriptionObject);
        break;
      case 'subscription.expired':
      case 'subscription.unpaid':
        await this.onSubscriptionExpired(object as CreemSubscriptionObject);
        break;
      case 'subscription.past_due':
        await this.onSubscriptionPastDue(object as CreemSubscriptionObject);
        break;
      case 'refund.created':
        await this.onRefundCreated(object);
        break;
      default:
        console.log(`[Creem] Unhandled event type: ${type}`);
    }

    return { processed: true, eventType: type };
  }

  private static resolveTier(productId: string): SubscriptionTier | null {
    const proId = process.env.CREEM_PRODUCT_PRO;
    const premId = process.env.CREEM_PRODUCT_PREM;
    if (proId && productId === proId) return 'pro';
    if (premId && productId === premId) return 'prem';
    return null;
  }

  private static extractId(value: string | { id?: string } | undefined): string | undefined {
    if (!value) return undefined;
    if (typeof value === 'string') return value;
    return value.id;
  }

  private static extractCustomer(value: string | CreemCustomer | undefined): CreemCustomer | undefined {
    if (!value || typeof value === 'string') return undefined;
    return value;
  }

  private static extractMetadata(...sources: Array<Record<string, unknown> | undefined>): Record<string, unknown> {
    return Object.assign({}, ...sources.filter(Boolean));
  }

  private static async findUser(email?: string, metadata?: Record<string, unknown>) {
    const userId = typeof metadata?.userId === 'string' ? metadata.userId : undefined;
    if (userId) {
      const byId = await prisma.user.findUnique({ where: { id: userId } });
      if (byId) return byId;
    }
    if (email) {
      return prisma.user.findUnique({ where: { email } });
    }
    return null;
  }

  private static async activateSubscription(params: {
    subscriptionId: string;
    productId: string;
    email?: string;
    metadata?: Record<string, unknown>;
    orderId?: string;
    amountCents?: number;
    currency?: string;
    periodEnd?: Date | null;
  }) {
    const tier = this.resolveTier(params.productId);
    if (!tier) throw new Error(`Unknown Creem product ID: ${params.productId}`);

    const user = await this.findUser(params.email, params.metadata);
    if (!user) {
      throw new Error(`User not found for Creem subscription (email=${params.email || 'n/a'})`);
    }

    await prisma.subscription.updateMany({
      where: { userId: user.id, status: 'active' as SubscriptionStatus },
      data: { status: 'cancelled' as SubscriptionStatus, cancelledAt: new Date() },
    });

    let subscription = await prisma.subscription.findUnique({
      where: { fsSubscriptionId: params.subscriptionId },
    });

    const expiresAt =
      params.periodEnd ??
      (subscription?.startedAt ? this.fallbackPeriodEnd(subscription.startedAt) : this.fallbackPeriodEnd());

    const subscriptionData = {
      userId: user.id,
      tier,
      status: 'active' as SubscriptionStatus,
      expiresAt,
      autoRenew: true,
      fsProductId: params.productId,
      fsOrderId: params.orderId ?? null,
    };

    if (subscription) {
      subscription = await prisma.subscription.update({
        where: { id: subscription.id },
        data: subscriptionData,
      });
    } else {
      subscription = await prisma.subscription.create({
        data: {
          ...subscriptionData,
          fsSubscriptionId: params.subscriptionId,
        },
      });
    }

    if (params.orderId) {
      const existingPayment = await prisma.payment.findFirst({
        where: { fsOrderId: params.orderId },
      });
      if (!existingPayment) {
        await prisma.payment.create({
          data: {
            userId: user.id,
            subscriptionId: subscription.id,
            amount: params.amountCents != null ? String(params.amountCents / 100) : '0',
            currency: params.currency || 'USD',
            paymentMethod: 'creem' as PaymentMethod,
            status: 'completed',
            gatewayTransactionId: params.orderId,
            fsOrderId: params.orderId,
            completedAt: new Date(),
          },
        });
      }
    }

    console.log(`[Creem] Subscription activated: ${params.subscriptionId} -> tier=${tier}, user=${user.email}`);
  }

  private static async onCheckoutCompleted(checkout: CreemCheckoutObject) {
    const subscriptionObj = checkout.subscription;
    const subscriptionId = this.extractId(subscriptionObj as string | CreemSubscriptionObject);
    const productId =
      this.extractId(checkout.product as string | CreemProductRef) ||
      checkout.order?.product ||
      this.extractId(
        typeof subscriptionObj === 'object'
          ? (subscriptionObj.product as string | CreemProductRef)
          : undefined,
      );

    if (!subscriptionId || !productId) {
      throw new Error('checkout.completed missing subscription or product ID');
    }

    const customer = this.extractCustomer(checkout.customer);
    const metadata = this.extractMetadata(
      checkout.metadata,
      typeof subscriptionObj === 'object' ? subscriptionObj.metadata : undefined,
    );

    const subObj = typeof subscriptionObj === 'object' ? subscriptionObj : undefined;
    const periodEnd = this.extractPeriodEnd(subObj);

    await this.activateSubscription({
      subscriptionId,
      productId,
      email: customer?.email,
      metadata,
      orderId: checkout.order?.id,
      amountCents: checkout.order?.amount,
      currency: checkout.order?.currency,
      periodEnd,
    });
  }

  private static async onSubscriptionPaid(subscription: CreemSubscriptionObject) {
    const subscriptionId = subscription.id;
    const productId = this.extractId(subscription.product);
    if (!subscriptionId || !productId) {
      throw new Error('subscription.paid missing subscription or product ID');
    }

    const customer = this.extractCustomer(subscription.customer);
    const periodEnd = this.extractPeriodEnd(subscription);

    await this.activateSubscription({
      subscriptionId,
      productId,
      email: customer?.email,
      metadata: subscription.metadata,
      periodEnd,
    });
  }

  private static async onSubscriptionUpdated(subscription: CreemSubscriptionObject) {
    const subscriptionId = subscription.id;
    const productId = this.extractId(subscription.product);
    if (!subscriptionId || !productId) {
      throw new Error('subscription.update missing subscription or product ID');
    }

    const tier = this.resolveTier(productId);
    if (!tier) throw new Error(`Unknown Creem product ID: ${productId}`);

    const existing = await prisma.subscription.findUnique({
      where: { fsSubscriptionId: subscriptionId },
    });
    if (!existing) {
      await this.onSubscriptionPaid(subscription);
      return;
    }

    const periodEnd = this.extractPeriodEnd(subscription) ?? existing.expiresAt;

    await prisma.subscription.update({
      where: { id: existing.id },
      data: {
        tier,
        fsProductId: productId,
        expiresAt: periodEnd ?? this.fallbackPeriodEnd(existing.startedAt),
        status: 'active' as SubscriptionStatus,
        autoRenew: true,
      },
    });

    console.log(`[Creem] Subscription updated: ${subscriptionId} -> tier=${tier}`);
  }

  private static async onSubscriptionScheduledCancel(subscription: CreemSubscriptionObject) {
    const subscriptionId = subscription.id;
    if (!subscriptionId) throw new Error('subscription.scheduled_cancel missing subscription ID');

    const existing = await prisma.subscription.findUnique({
      where: { fsSubscriptionId: subscriptionId },
    });
    if (!existing) return;

    const periodEnd = this.extractPeriodEnd(subscription) ?? existing.expiresAt;

    await prisma.subscription.update({
      where: { id: existing.id },
      data: {
        autoRenew: false,
        expiresAt: periodEnd,
      },
    });

    console.log(`[Creem] Subscription scheduled cancel: ${subscriptionId}`);
  }

  private static async onSubscriptionCanceled(subscription: CreemSubscriptionObject) {
    const subscriptionId = subscription.id;
    if (!subscriptionId) throw new Error('subscription.canceled missing subscription ID');

    const existing = await prisma.subscription.findUnique({
      where: { fsSubscriptionId: subscriptionId },
    });
    if (!existing) return;

    await prisma.subscription.update({
      where: { id: existing.id },
      data: {
        autoRenew: false,
        status: 'cancelled' as SubscriptionStatus,
        cancelledAt: subscription.canceled_at ? new Date(subscription.canceled_at) : new Date(),
      },
    });

    console.log(`[Creem] Subscription canceled: ${subscriptionId}`);
  }

  private static async onSubscriptionExpired(subscription: CreemSubscriptionObject) {
    const subscriptionId = subscription.id;
    if (!subscriptionId) return;

    const existing = await prisma.subscription.findUnique({
      where: { fsSubscriptionId: subscriptionId },
    });
    if (!existing) return;

    await prisma.subscription.update({
      where: { id: existing.id },
      data: {
        status: 'expired' as SubscriptionStatus,
        autoRenew: false,
      },
    });

    console.log(`[Creem] Subscription expired/unpaid: ${subscriptionId}`);
  }

  private static async onSubscriptionPastDue(subscription: CreemSubscriptionObject) {
    const subscriptionId = subscription.id;
    if (!subscriptionId) return;

    const existing = await prisma.subscription.findUnique({
      where: { fsSubscriptionId: subscriptionId },
    });
    if (!existing) return;

    await prisma.subscription.update({
      where: { id: existing.id },
      data: {
        status: 'grace_period' as SubscriptionStatus,
        autoRenew: false,
      },
    });

    console.log(`[Creem] Subscription past due: ${subscriptionId}`);
  }

  private static async onRefundCreated(refund: Record<string, unknown>) {
    const subscriptionRef = refund.subscription as { id?: string; status?: string } | undefined;
    const subscriptionId = subscriptionRef?.id;
    if (!subscriptionId) return;

    const existing = await prisma.subscription.findUnique({
      where: { fsSubscriptionId: subscriptionId },
    });
    if (!existing) return;

    await prisma.subscription.update({
      where: { id: existing.id },
      data: {
        status: 'cancelled' as SubscriptionStatus,
        autoRenew: false,
        cancelledAt: new Date(),
      },
    });

    const transaction = refund.transaction as { id?: string; amount?: number } | undefined;
    if (transaction?.id) {
      await prisma.payment.updateMany({
        where: { gatewayTransactionId: transaction.id },
        data: { status: 'refunded', refundedAt: new Date() },
      });
    }

    console.log(`[Creem] Refund processed for subscription: ${subscriptionId}`);
  }
}
