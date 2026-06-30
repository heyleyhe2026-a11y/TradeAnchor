import { Router } from 'express';
import { authenticate, requireEmailVerification } from '../middleware/auth.middleware';
import { creditController } from '../controllers/credit.controller';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const router: any = Router();
router.use(authenticate);

router.get('/balance', creditController.getBalance);
router.get('/history', creditController.getHistory);
router.post('/spend', requireEmailVerification, creditController.spend);

export default router;
