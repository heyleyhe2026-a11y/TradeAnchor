import { Router } from 'express';
import { getStats } from '../controllers/public-stats.controller';

const router: Router = Router();

router.get('/stats', getStats);

export default router;
