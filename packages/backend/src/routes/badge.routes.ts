import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { badgeController } from '../controllers/badge.controller';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const router: any = Router();

router.use(authenticate);

router.get('/', badgeController.getBadges);

export default router;
