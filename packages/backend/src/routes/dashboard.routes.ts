import { Router } from 'express';
import { dashboardController } from '../controllers/dashboard.controller';
import { authenticate } from '../middleware/auth.middleware';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const router: any = Router();
router.use(authenticate);

router.get('/stats', dashboardController.getDashboardStats.bind(dashboardController));
router.get('/confidence', dashboardController.getConfidenceScore.bind(dashboardController));
router.get('/calendar', dashboardController.getCalendarData.bind(dashboardController));

export default router;
