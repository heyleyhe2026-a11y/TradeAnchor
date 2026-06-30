import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { notificationController } from '../controllers/notification.controller';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const router: any = Router();
router.use(authenticate);

router.get('/', notificationController.list);
router.get('/unread-count', notificationController.countUnread);
router.put('/:id/read', notificationController.markAsRead);
router.put('/read-all', notificationController.markAllAsRead);

export default router;
