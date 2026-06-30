import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { preferencesController } from '../controllers/preferences.controller';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const router: any = Router();
router.use(authenticate);
router.get('/', preferencesController.get);
router.put('/', preferencesController.update);
router.post('/reset', preferencesController.reset);

export default router;
