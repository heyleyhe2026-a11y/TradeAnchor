import { PaymentMethod, PaymentStatus } from '../generated/prisma';
import { AppError } from '../utils/app-error';
import { prisma } from '../lib/prisma';


export class PaymentService {
  static async initiatePayment(data: {
    userId: string; amount: number; method: PaymentMethod;
    subscriptionId?: string; description?: string;
  }) {
    return prisma.payment.create({
      data: {
        userId: data.userId,
        subscriptionId: data.subscriptionId || null,
        amount: String(data.amount),
        paymentMethod: data.method,
        status: 'pending' as PaymentStatus,
      },
    });
  }

  static async completePayment(paymentId: string, gatewayTxId: string, gatewayResponse?: object) {
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new AppError(404, 'Payment not found');
    if (payment.status === 'completed') throw new AppError(400, 'Payment already completed');

    const updated = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: 'completed' as PaymentStatus,
        gatewayTransactionId: gatewayTxId,
        gatewayResponse: gatewayResponse as any,
        completedAt: new Date(),
      },
    });

    // Activate subscription if linked
    if (updated.subscriptionId) {
      await prisma.subscription.update({
        where: { id: updated.subscriptionId },
        data: { status: 'active', expiresAt: new Date(Date.now() + 30 * 86400000) },
      });
    }

    return updated;
  }

  static async failPayment(paymentId: string, reason?: string) {
    return prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'failed' as PaymentStatus, gatewayResponse: { error: reason } as any },
    }).catch(() => null);
  }

  static async refundPayment(paymentId: string, reason?: string) {
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new AppError(404, 'Payment not found');
    if (payment.status !== 'completed') throw new AppError(400, 'Cannot refund non-completed payment');
    // Check within 24h
    if (payment.completedAt && Date.now() - payment.completedAt.getTime() > 24 * 3600000) {
      throw new AppError(400, 'Refund window expired (24 hours)');
    }

    return prisma.payment.update({
      where: { id: paymentId },
      data: {
        refundedAt: new Date(),
        refundReason: reason || 'User requested refund',
      },
    });
  }

  static async getUserPayments(query: {
    userId: string; status?: PaymentStatus; startDate?: string; endDate?: string;
    page?: number; limit?: number;
  }) {
    const { userId, status, startDate, endDate, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;
    const where: Record<string, any> = { userId };
    if (status) where.status = status;
    if (startDate || endDate) where.createdAt = {
      ...(startDate ? { gte: new Date(startDate) } : {}),
      ...(endDate ? { lte: new Date(endDate) } : {}),
    };

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      prisma.payment.count({ where }),
    ]);
    return { payments, total, pages: Math.ceil(total / limit), currentPage: page };
  }

  static async getSummary(userId: string) {
    const agg = await prisma.payment.groupBy({
      by: ['status'], where: { userId },
      _sum: { amount: true }, _count: true,
    });
    let totalSpent = 0;
    for (const a of agg) {
      if (a.status === 'completed') totalSpent += Number(a._sum.amount || 0);
    }
    return {
      totalSpent,
      completedPayments: agg.find(a => a.status === 'completed')?._count || 0,
      pendingPayments: agg.find(a => a.status === 'pending')?._count || 0,
      refundedPayments: agg.find(a => a.status === 'refunded')?._count || 0,
    };
  }
}
