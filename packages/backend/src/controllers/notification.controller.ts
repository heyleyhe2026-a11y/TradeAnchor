import { Request, Response, NextFunction } from 'express';
import { notificationService } from '../services/notification.service';

export class NotificationController {
  /**
   * GET /v1/notifications - List notifications (paginated)
   */
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(String(req.query.page) || '1', 10);
      const limit = Math.min(parseInt(String(req.query.limit) || '20', 10), 50);
      const result = await notificationService.listNotifications(req.user!.id, page, limit);
      res.status(200).json({ success: true, ...result });
    } catch (error) { next(error); }
  }

  /**
   * GET /v1/notifications/unread-count - Count unread notifications
   */
  async countUnread(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const count = await notificationService.countUnread(req.user!.id);
      res.status(200).json({ success: true, count });
    } catch (error) { next(error); }
  }

  /**
   * PUT /v1/notifications/:id/read - Mark a notification as read
   */
  async markAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ok = await notificationService.markAsRead(req.user!.id, req.params.id);
      if (!ok) {
        res.status(404).json({ success: false, message: 'Notification not found' });
        return;
      }
      res.status(200).json({ success: true });
    } catch (error) { next(error); }
  }

  /**
   * PUT /v1/notifications/read-all - Mark all as read
   */
  async markAllAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const modified = await notificationService.markAllAsRead(req.user!.id);
      res.status(200).json({ success: true, modified });
    } catch (error) { next(error); }
  }
}

export const notificationController = new NotificationController();
