import { Router } from 'express';
import { aiReportController } from '../controllers/ai-report.controller';
import { authenticate, requireEmailVerification } from '../middleware/auth.middleware';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const router: any = Router();
router.use(authenticate);

router.get('/models', aiReportController.listModels.bind(aiReportController));
router.post('/reports', requireEmailVerification, aiReportController.generateReport.bind(aiReportController));
router.get('/reports', aiReportController.listReports.bind(aiReportController));
router.get('/reports/:id', aiReportController.getReport.bind(aiReportController));

export default router;
