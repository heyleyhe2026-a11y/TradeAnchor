import { prisma } from '../lib/prisma';
import logger from '../lib/logger';
import { notificationService } from './notification.service';
import { localizeComments, warmCommentTranslationCache } from './translation.service';

export class CommentService {
  /**
   * Create a new comment (or reply) on a playbook
   */
  static async createComment(data: {
    playbookId: string;
    userId: string;
    content: string;
    parentId?: string;
  }) {
    const content = data.content.trim();
    if (!content) {
      throw new Error('Comment content is required');
    }
    if (content.length > 5000) {
      throw new Error('Comment is too long (max 5000 characters)');
    }

    // Validate parent exists if replying
    if (data.parentId) {
      const parent = await prisma.playbookComment.findUnique({
        where: { id: data.parentId },
      });
      if (!parent || parent.playbookId !== data.playbookId) {
        throw new Error('Invalid parent comment');
      }
    }

    const comment = await prisma.playbookComment.create({
      data: {
        playbookId: data.playbookId,
        userId: data.userId,
        content,
        parentId: data.parentId || null,
      },
      include: {
        user: { select: { id: true, displayName: true, avatarUrl: true, email: true } },
      },
    });

    // ─── Send notification to post author / parent comment author ───
    try {
      // Fetch playbook with author info (userId field on Playbook)
      const playbook = await prisma.playbook.findUnique({
        where: { id: data.playbookId },
        select: { userId: true, title: true },
      });

      if (!playbook) return comment;

      // Determine who should receive the notification:
      // - If replying: notify the parent comment's author (if different from commenter)
      // - If top-level comment: notify the post owner (if different from commenter)
      let notifyUserId: string | null = null;
      let notifType: 'new_comment' | 'comment_reply' = 'new_comment';

      if (data.parentId) {
        // Reply to a comment → notify parent comment's author
        const parent = await prisma.playbookComment.findUnique({
          where: { id: data.parentId },
          select: { userId: true },
        });
        if (parent && parent.userId !== data.userId) {
          notifyUserId = parent.userId;
          notifType = 'comment_reply';
        }
      } else {
        // New top-level comment → notify post author
        if (playbook.userId !== data.userId) {
          notifyUserId = playbook.userId;
          notifType = 'new_comment';
        }
      }

      if (notifyUserId) {
        const commenterName = comment.user?.displayName || comment.user?.email?.split('@')[0] || 'Anonymous';
        const titleZh = notifType === 'new_comment' ? '新评论通知' : '评论回复通知';
        const titleEn = notifType === 'new_comment' ? 'New Comment' : 'Comment Reply';
        const msgZh = notifType === 'new_comment'
          ? `${commenterName} 评论了你的帖子「${playbook.title}」`
          : `${commenterName} 回复了你的评论`;
        const msgEn = notifType === 'new_comment'
          ? `${commenterName} commented on your post "${playbook.title}"`
          : `${commenterName} replied to your comment`;
        notificationService.notify({
          type: notifType,
          userId: notifyUserId,
          title: `${titleZh}|||${titleEn}`,
          message: `${msgZh}|||${msgEn}`,
          metadata: {
            playbookId: data.playbookId,
            commentId: comment.id,
            commenterId: data.userId,
            commenterName,
          },
        });
      }
    } catch (notifErr) {
      // Notification is non-critical — never fail the comment creation
      logger.warn('Failed to send comment notification', {
        error: notifErr instanceof Error ? notifErr.message : notifErr,
      });
    }

    warmCommentTranslationCache({ id: comment.id, content: comment.content });

    return comment;
  }

  /**
   * Get all comments (top-level + nested replies) for a playbook
   * Returns flat list sorted by createdAt, with replyCount on top-level comments
   */
  static async getPlaybookComments(playbookId: string, page = 1, limit = 50, locale?: string) {
    const skip = (page - 1) * limit;

    const [comments, total] = await Promise.all([
      prisma.playbookComment.findMany({
        where: { playbookId },
        include: {
          user: { select: { id: true, displayName: true, avatarUrl: true, email: true } },
          _count: { select: { replies: true } },
        },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
      prisma.playbookComment.count({ where: { playbookId } }),
    ]);

    // Attach reply count and author name to each comment
    const enriched = comments.map((c) => ({
      ...c,
      authorName: c.user?.displayName || c.user?.email?.split('@')[0] || 'Anonymous',
      authorAvatar: c.user?.avatarUrl || '',
      replyCount: c._count?.replies ?? 0,
      isReply: !!c.parentId,
      parentId: c.parentId,
    }));

    const localizedComments = locale
      ? await localizeComments(enriched, locale)
      : enriched;

    return {
      comments: localizedComments,
      total,
      pages: Math.ceil(total / limit),
      currentPage: page,
    };
  }

  /**
   * Delete a comment (only by comment author). Cascades to all replies.
   */
  static async deleteComment(
    playbookId: string,
    commentId: string,
    userId: string,
  ): Promise<{ commentCount: number } | null> {
    const comment = await prisma.playbookComment.findUnique({
      where: { id: commentId },
      select: { userId: true, playbookId: true },
    });

    if (!comment || comment.playbookId !== playbookId) return null;
    if (comment.userId !== userId) throw new Error('Not authorized');

    await prisma.playbookComment.delete({ where: { id: commentId } });

    const commentCount = await prisma.playbookComment.count({ where: { playbookId } });
    return { commentCount };
  }

  /**
   * Get total comment count for a playbook
   */
  static async getCommentCount(playbookId: string): Promise<number> {
    return prisma.playbookComment.count({ where: { playbookId } });
  }

  /**
   * Get comment counts for multiple playbooks (for list view)
   */
  static async getCommentCounts(playbookIds: string[]): Promise<Record<string, number>> {
    if (!playbookIds.length) return {};

    const results = await prisma.playbookComment.groupBy({
      by: ['playbookId'],
      where: { playbookId: { in: playbookIds } },
      _count: true,
    });

    const map: Record<string, number> = {};
    for (const r of results) {
      map[r.playbookId] = r._count;
    }
    // Ensure all requested IDs are present (0 if no comments)
    for (const id of playbookIds) {
      if (!(id in map)) map[id] = 0;
    }
    return map;
  }
}
