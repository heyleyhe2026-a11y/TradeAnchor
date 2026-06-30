import { prisma } from '../lib/prisma';
import { getCollection, MongoCollections } from '../lib/mongodb';
import logger from '../lib/logger';
import { randomUUID } from 'crypto';
import { emailService } from './email.service';
import { PreferencesService } from './preferences.service';

export type NotificationType = 'ai_report_ready' | 'import_complete' | 'new_comment' | 'comment_reply' | 'attachment_download_reward';

export interface NotificationPayload {
  type: NotificationType;
  userId: string;
  title: string;
  message: string;
  metadata?: Record<string, any>;
}

/**
 * Notification document stored in MongoDB (mirrors AI report pattern)
 */
export interface NotificationDocument {
  _id?: any;
  notificationId: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Record<string, any>;
  isRead: boolean;
  emailSent: boolean;
  createdAt: Date;
}

class NotificationService {
  /**
   * Create a notification record and optionally send email.
   * Fire-and-forget: errors are logged but never thrown.
   */
  async notify(payload: NotificationPayload): Promise<void> {
    const { userId, type, title, message, metadata } = payload;

    try {
      // 1. Get user's notification preferences
      const prefs = await this.getUserPrefs(userId);
      const wantsEmail = prefs.notifications.email !== false;

      // 2. Get user email
      const userEmail = await this.getUserEmail(userId);
      if (!userEmail) {
        logger.warn(`Cannot send notification: no email found for user ${userId}`);
      }

      // 3. Determine locale for email template
      const locale = prefs.locale || 'en';
      const isZh = locale.startsWith('zh');

      // 4. Build email HTML based on type
      let emailHtml = '';
      let emailSubject = '';
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

      switch (type) {
        case 'ai_report_ready': {
          emailSubject = isZh ? '[TradeAnchor] 您的AI分析报告已就绪' : '[TradeAnchor] Your AI Analysis Report is Ready';
          const reportUrl = `${baseUrl}/ai-reports`;
          emailHtml = this.getAiReportEmailTemplate({ isZh, reportUrl, title, message });
          break;
        }
      }

      // 5. Send email if enabled
      let emailSent = false;
      if (wantsEmail && userEmail && emailHtml) {
        try {
          const result = await emailService.sendEmail(userEmail, emailSubject, emailHtml);
          emailSent = result.success;
          if (!result.success) {
            logger.warn(`Notification email failed for user ${userId}`, { error: result.error });
          }
        } catch (e) {
          logger.warn(`Failed to send notification email`, { userId, error: e instanceof Error ? e.message : e });
        }
      }

      // 6. Persist notification to MongoDB for in-app display
      const doc: Omit<NotificationDocument, '_id'> = {
        notificationId: randomUUID(),
        userId,
        type,
        title,
        message,
        metadata: metadata || undefined,
        isRead: false,
        emailSent,
        createdAt: new Date(),
      };

      const collection = await getCollection<NotificationDocument>(MongoCollections.NOTIFICATIONS);
      await collection.insertOne(doc);

      logger.info(`Notification created`, {
        notificationId: doc.notificationId,
        userId,
        type,
        emailSent,
      });
    } catch (error) {
      // Notifications are non-critical — never block the calling flow
      logger.error(`Failed to create notification`, {
        userId,
        type,
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  /**
   * Convenience method: notify AI report ready
   */
  async notifyAiReportReady(userId: string, reportId: string, model: string): Promise<void> {
    return this.notify({
      type: 'ai_report_ready',
      userId,
      title: 'AI Report Ready',
      message: `Your trading analysis report (${model}) has been generated and is ready to view.`,
      metadata: { reportId, model },
    });
  }

  /**
   * Convenience method: notify trade import completion (single summary instead of per-trade)
   */
  async notifyImportComplete(userId: string, importedCount: number, failedCount: number): Promise<void> {
    const title = failedCount > 0
      ? `Trades Imported: ${importedCount} succeeded, ${failedCount} failed`
      : `${importedCount} Trades Imported`;
    const message = failedCount > 0
      ? `Successfully imported ${importedCount} trade(s). ${failedCount} record(s) were skipped due to errors.`
      : `Successfully imported ${importedCount} trade(s).`;
    return this.notify({
      type: 'import_complete',
      userId,
      title,
      message,
      metadata: { importedCount, failedCount },
    });
  }

  /**
   * Convenience method: notify attachment download reward to post author
   */
  async notifyAttachmentDownloadReward(
    authorId: string,
    downloaderName: string,
    postTitle: string,
    filename: string,
    rewardPoints: number,
  ): Promise<void> {
    const titleZh = '🎉 附件下载奖励';
    const titleEn = '🎉 Attachment Download Reward';
    const msgZh = `用户 **${downloaderName}** 下载了您的帖子《**${postTitle}**》中的附件 **「${filename}」**，您获得了 **+${rewardPoints}** 积分奖励！`;
    const msgEn = `User **${downloaderName}** downloaded attachment **"${filename}"** from your post **"${postTitle}"**, and you earned **+${rewardPoints}** points!`;

    return this.notify({
      type: 'attachment_download_reward',
      userId: authorId,
      title: `${titleZh}|||${titleEn}`,
      message: `${msgZh}|||${msgEn}`,
      metadata: { type: 'attachment_download_reward', rewardPoints, downloaderName, postTitle, filename },
    });
  }

  /**
   * List notifications for a user (paginated, newest first)
   */
  async listNotifications(userId: string, page = 1, limit = 20) {
    const collection = await getCollection<NotificationDocument>(MongoCollections.NOTIFICATIONS);
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
      collection.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      collection.countDocuments({ userId }),
    ]);

    // Serialize ObjectId
    const serialized = notifications.map((n) => ({
      ...n,
      _id: n._id?.toString(),
    }));

    return { notifications: serialized, page, limit, total, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Count unread notifications for a user
   */
  async countUnread(userId: string): Promise<number> {
    const collection = await getCollection<NotificationDocument>(MongoCollections.NOTIFICATIONS);
    return collection.countDocuments({ userId, isRead: false });
  }

  /**
   * Mark a single notification as read
   */
  async markAsRead(userId: string, notificationId: string): Promise<boolean> {
    const collection = await getCollection<NotificationDocument>(MongoCollections.NOTIFICATIONS);
    const result = await collection.updateOne(
      { userId, notificationId },
      { $set: { isRead: true } }
    );
    return result.modifiedCount > 0;
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<number> {
    const collection = await getCollection<NotificationDocument>(MongoCollections.NOTIFICATIONS);
    const result = await collection.updateMany(
      { userId, isRead: false },
      { $set: { isRead: true } }
    );
    return result.modifiedCount;
  }

  // ─── Private helpers ───

  private async getUserPrefs(userId: string) {
    return PreferencesService.get(userId);
  }

  private async getUserEmail(userId: string): Promise<string | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    return user?.email || null;
  }

  private getAiReportEmailTemplate(data: { isZh: boolean; reportUrl: string; title: string; message: string }): string {
    const { isZh, reportUrl, title, message } = data;
    const btnText = isZh ? '查看报告' : 'View Report';

    return `
<!DOCTYPE html>
<html lang="${isZh ? 'zh' : 'en'}">
<head><meta charset="UTF-8"><title>${title}</title></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;padding:20px;">
<tr><td style="background:#1976d2;padding:30px;text-align:center;border-radius:8px 8px 0 0;">
<h1 style="color:#fff;margin:0;">TradeAnchor</h1>
<p style="color:#bbdefb;margin:8px 0 0;font-size:16px;">${isZh ? 'AI驱动的交易分析平台' : 'AI-Powered Trading Analytics'}</p>
</td></tr>
<tr><td style="background:#fff;padding:40px 30px;border:1px solid #e0e0e0;border-top:none;">
<h2 style="color:#333;margin:0 0 16px;">${title}</h2>
<p style="color:#555;font-size:16px;line-height:1.6;margin:0 0 24px;">${message}</p>
<div style="text-align:center;margin:24px 0;">
<a href="${reportUrl}" style="display:inline-block;background:#1976d2;color:#fff;padding:14px 36px;text-decoration:none;border-radius:6px;font-size:16px;font-weight:600;">${btnText}</a>
</div>
<hr style="border:none;border-top:1px solid #e0e0e0;margin:24px 0;" />
<p style="color:#999;font-size:13px;margin:0;">${isZh ? '此邮件为系统自动发送，请勿回复。' : 'This is an automated message. Please do not reply.'}</p>
</td></tr>
<tr><td style="background:#fafafa;padding:20px;text-align:center;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 8px 8px;">
<p style="color:#999;font-size:12px;margin:0;">&copy; ${new Date().getFullYear()} TradeAnchor.</p>
</td></tr>
</table>
</body></html>`;
  }
}

export const notificationService = new NotificationService();
