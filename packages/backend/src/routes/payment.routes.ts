import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { paymentController } from '../controllers/payment.controller';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const router: any = Router();
router.use(authenticate);

router.post('/initiate', paymentController.initiate);
router.get('/', paymentController.getPayments);
router.get('/summary', paymentController.getSummary);
router.post('/:id/complete', paymentController.complete);
router.post('/:id/refund', paymentController.refund);

export default router;
