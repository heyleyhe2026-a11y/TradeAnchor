import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { fastspringController } from '../controllers/fastspring.controller';
import { checkoutController } from '../controllers/checkout.controller';

const router: any = Router();

// Webhook endpoints — NO auth (payment providers call these directly)
router.post('/fastspring', fastspringController.handleWebhook);
// Creem webhook is mounted in app.ts with raw body parser

// Checkout URL generation — requires user auth (Creem or FastSpring based on PAYMENT_PROVIDER)
router.get('/checkout', authenticate, checkoutController.getCheckoutUrl);

export default router;
