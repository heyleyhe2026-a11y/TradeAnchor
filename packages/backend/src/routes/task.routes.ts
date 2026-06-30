import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { taskController } from '../controllers/task.controller';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const router: any = Router();

router.use(authenticate);

router.get('/', taskController.getTasks);
router.get('/stats', taskController.getStats);
router.post('/:taskId/claim', taskController.claimReward);

// Leaderboard endpoints
router.get('/leaderboard/publishers', taskController.getPublisherLeaderboard);
router.get('/leaderboard/sales', taskController.getSellerLeaderboard);
router.get('/leaderboard/return-rate', taskController.getReturnRateLeaderboard);
router.get('/leaderboard/views', taskController.getViewsLeaderboard);

export default router;
