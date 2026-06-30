import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { subscriptionController } from '../controllers/subscription.controller';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const router: any = Router();
router.use(authenticate);

router.get('/current', subscriptionController.getCurrent);
router.post('/upgrade', subscriptionController.upgrade);
router.post('/downgrade', subscriptionController.downgrade);
router.put('/auto-renew', subscriptionController.setAutoRenew);
router.get('/history', subscriptionController.getHistory);

export default router;
