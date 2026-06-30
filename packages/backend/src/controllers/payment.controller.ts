import { Request, Response, NextFunction } from 'express';
import { PaymentMethod } from '../generated/prisma';
import { PaymentService } from '../services/payment.service';

export const paymentController = {
  async initiate(req: Request, res: Response, next: NextFunction) {
    try {
      const { amount, method, subscriptionId, description } = req.body;
      const payment = await PaymentService.initiatePayment({
        userId: req.user!.id,
        amount: Number(amount),
        method: method as PaymentMethod,
        subscriptionId,
        description,
      });
      res.status(201).json({ success: true, data: payment });
    } catch (error) {
      next(error);
    }
  },

  async getPayments(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await PaymentService.getUserPayments({
        userId: req.user!.id,
        status: req.query.status as any,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        page: req.query.page ? Number(req.query.page) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async getSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const summary = await PaymentService.getSummary(req.user!.id);
      res.json({ success: true, data: summary });
    } catch (error) {
      next(error);
    }
  },

  async complete(req: Request, res: Response, next: NextFunction) {
    try {
      const { gatewayTxId, gatewayResponse } = req.body;
      const payment = await PaymentService.completePayment(
        req.params.id,
        gatewayTxId,
        gatewayResponse,
      );
      res.json({ success: true, data: payment });
    } catch (error) {
      next(error);
    }
  },

  async refund(req: Request, res: Response, next: NextFunction) {
    try {
      const payment = await PaymentService.refundPayment(req.params.id, req.body.reason);
      res.json({ success: true, data: payment });
    } catch (error) {
      next(error);
    }
  },
};
