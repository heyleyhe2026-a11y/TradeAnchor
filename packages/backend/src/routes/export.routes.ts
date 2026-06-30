import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { exportController } from '../controllers/export.controller';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const router: any = Router();
router.use(authenticate);
router.get('/trades', exportController.exportTrades);

export default router;
