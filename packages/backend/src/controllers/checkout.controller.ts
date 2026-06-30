import { Request, Response } from 'express';
import { fastspringController } from './fastspring.controller';
import { creemController } from './creem.controller';
import { getPaymentProvider } from '../lib/payment-provider';

export const checkoutController = {
  async getCheckoutUrl(req: Request, res: Response) {
    if (getPaymentProvider() === 'creem') {
      return creemController.getCheckoutUrl(req, res);
    }
    return fastspringController.getCheckoutUrl(req, res);
  },
};
