import { Router } from 'express';
import authRoutes from './auth.routes';
import tradeRoutes from './trade.routes';
import dashboardRoutes from './dashboard.routes';
import aiReportRoutes from './ai-report.routes';
import aiQuestionRoutes from './ai-question.routes';
import diaryRoutes from './diary.routes';
import playbookRoutes from './playbook.routes';
import subscriptionRoutes from './subscription.routes';
import paymentRoutes from './payment.routes';
import creditRoutes from './credit.routes';
import taskRoutes from './task.routes';
import badgeRoutes from './badge.routes';
import exportRoutes from './export.routes';
import preferencesRoutes from './preferences.routes';
import fxRoutes from './fx.routes';
import notificationRoutes from './notification.routes';
import webhookRoutes from './webhook.routes';
import publicRoutes from './public.routes';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const router: any = Router();

router.use('/auth', authRoutes);
router.use('/trades', tradeRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/ai', aiReportRoutes);
router.use('/ai', aiQuestionRoutes);
router.use('/diary', diaryRoutes);
router.use('/playbooks', playbookRoutes);
router.use('/subscriptions', subscriptionRoutes);
router.use('/payments', paymentRoutes);
router.use('/credits', creditRoutes);
router.use('/tasks', taskRoutes);
router.use('/badges', badgeRoutes);
router.use('/export', exportRoutes);
router.use('/preferences', preferencesRoutes);
router.use('/fx', fxRoutes);
router.use('/notifications', notificationRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/public', publicRoutes);

router.get('/', (req: any, res: any) => {
  res.json({
    message: 'TradeAnchor API v1',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      auth: '/api/v1/auth', trades: '/api/v1/trades',
      dashboard: '/api/v1/dashboard',
      ai: '/api/v1/ai', diary: '/api/v1/diary',
      playbooks: '/api/v1/playbooks', subscriptions: '/api/v1/subscriptions',
      payments: '/api/v1/payments', credits: '/api/v1/credits',
      export: '/api/v1/export', preferences: '/api/v1/preferences',
      health: '/health',
    },
  });
});

export default router;
