import { PlaybookStatus } from '../generated/prisma';
import { AppError } from '../utils/app-error';
import { prisma } from '../lib/prisma';
import { TaskService } from './task.service';
import { CreditService } from './credit.service';
import { CommentService } from './comment.service';
import { LikeService } from './like.service';
import { notificationService } from './notification.service';
import {
  localizePlaybook,
  localizePlaybooks,
  warmPlaybookTranslationCache,
} from './translation.service';

export class PlaybookService {
  static async create(userId: string, data: {
    title: string; description?: string; content: string;
    paidContent?: string; price?: number | null;
    tags?: string[]; tradingSymbols?: string[];
  }, attachments?: Array<{
    originalName: string; filename: string; path: string;
    size: number; mimetype: string;
  }>) {
    const playbook = await prisma.playbook.create({
      data: {
        userId,
        title: data.title,
        description: data.description || null,
        content: data.content,
        paidContent: null,
        price: null,
        tags: data.tags || [],
        tradingSymbols: data.tradingSymbols || [],
        status: 'published' as PlaybookStatus,
        publishedAt: new Date(),
        ...(attachments && attachments.length > 0 ? { attachments } : {}),
      },
    });

    // Record task events for publishing strategies — capture credit awards for frontend toast
    let creditsAwarded = 0;
    try {
      console.log(`[PlaybookService] About to record task events for userId=${userId}`);
      const r1 = await TaskService.recordEvent(userId, 'first_playbook', 1);
      console.log(`[PlaybookService] first_playbook result:`, JSON.stringify(r1));
      const r2 = await TaskService.recordEvent(userId, 'publish_3_playbooks', 1);
      console.log(`[PlaybookService] publish_3_playbooks result:`, JSON.stringify(r2));
      creditsAwarded = (r1.creditsAwarded || 0) + (r2.creditsAwarded || 0);
    } catch (err) {
      console.error(`[PlaybookService] ERROR recording task events:`, err);
    }

    warmPlaybookTranslationCache({
      id: playbook.id,
      title: playbook.title,
      description: playbook.description,
      content: playbook.content,
      paidContent: playbook.paidContent,
      tradingSymbols: playbook.tradingSymbols,
    });

    return { ...playbook, creditsAwarded };
  }

  static async findById(id: string) {
    const playbook = await prisma.playbook.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true } },
        _count: { select: { purchases: true, postViews: true } },
      },
    });
    if (!playbook) return null;
    const [commentCounts, likeCounts] = await Promise.all([
      CommentService.getCommentCounts([id]),
      LikeService.getLikeCounts([id]),
    ]);
    return {
      ...playbook,
      viewCount: playbook._count?.postViews ?? 0,
      commentCount: commentCounts[id] ?? 0,
      likeCount: likeCounts[id] ?? 0,
    };
  }

  static async getWithBrowseCredit(id: string, viewerId: string, userTier: string = 'free', locale?: string) {
    const playbook = await prisma.playbook.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, email: true } },
        _count: { select: { purchases: true, postViews: true } },
      },
    });
    if (!playbook) return null;

    // Record view for all logged-in users viewing others' published posts (no credit deduction)
    if (viewerId && playbook.userId !== viewerId && playbook.status === 'published') {
      const existingView = await prisma.postView.findUnique({
        where: { userId_playbookId: { userId: viewerId, playbookId: id } },
      });

      if (!existingView) {
        // First-time view → record & award task credits (e.g. first_browse_post)
        await prisma.postView.create({ data: { userId: viewerId, playbookId: id } });
        try {
          await TaskService.recordEvent(viewerId, 'first_browse_post', 1);
        } catch {
          // Non-critical: task reward failure should not block post viewing
        }
      } else {
        await prisma.postView.upsert({
          where: { userId_playbookId: { userId: viewerId, playbookId: id } },
          create: { userId: viewerId, playbookId: id },
          update: {},
        });
      }
    }

    if (!playbook) return null;
    const [commentCounts, likeCounts] = await Promise.all([
      CommentService.getCommentCounts([id]),
      LikeService.getLikeCounts([id]),
    ]);
    const base = {
      ...playbook,
      viewCount: playbook._count?.postViews ?? 0,
      commentCount: commentCounts[id] ?? 0,
      likeCount: likeCounts[id] ?? 0,
    };

    if (!locale) return base;

    return localizePlaybook(base, locale, { includeContent: true, includePaidContent: true });
  }

  static async findAll(query: {
    userId?: string; status?: string; page?: number; limit?: number;
    search?: string; tag?: string; sortBy?: string; sortOrder?: string;
    locale?: string;
  }) {
    const { page = 1, limit = 20, search, tag, status, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const p = Number(page) || 1;
    const l = Number(limit) || 20;
    const skip = (p - 1) * l;

    const where: Record<string, any> = {};
    if (query.userId) where.userId = query.userId;
    if (status) where.status = status;
    if (search) {
      const tagLabelMap: Record<string, string> = {
        // 策略类型
        '动量': 'Momentum', '剥头皮': 'Scalping', '波段': 'Swing',
        '日内交易': 'DayTrading', '趋势交易': 'PositionTrading',
        '趋势跟踪': 'TrendFollowing', '均值回归': 'MeanReversion',
        '突破': 'Breakout', '消息面': 'NewsTrading', '套利': 'Arbitrage',
        '算法': 'Algorithmic', '量化': 'Algorithmic', '价值投资': 'ValueInvesting',
        // 资产类别
        '股票': 'Stocks', '期货': 'Futures', 'ETF': 'ETF', '指数': 'Indices',
        '债券': 'Bonds', '大宗商品': 'Commodities', '商品': 'Commodities',
        '期权': 'Options', '加密货币': 'Crypto', '外汇': 'Forex',
        // 分析方法
        '技术分析': 'Technical', '基本面分析': 'Fundamental',
        '价格行为': 'PriceAction', '成交量': 'VolumeAnalysis',
        '支撑阻力': 'SupportResistance', '形态识别': 'PatternRecognition',
      };
      const matchedTagKey =
        Object.entries(tagLabelMap).find(
          ([label]) => label === search || label.startsWith(search)
        )?.[1] ||
        Object.values(tagLabelMap).find(
          (key) => key.toLowerCase() === search.toLowerCase() || key.toLowerCase().startsWith(search.toLowerCase())
        ) || null;
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        ...(matchedTagKey ? [{ tags: { has: matchedTagKey } }] : []),
      ];
    }
    if (tag) where.tags = { has: tag };

    const [rawPlaybooks, total] = await Promise.all([
      prisma.playbook.findMany({
        where,
        include: {
          user: { select: { id: true, displayName: true, avatarUrl: true, email: true } },
          _count: { select: { purchases: true, postViews: true } },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: l,
      }),
      prisma.playbook.count({ where }),
    ]);

    // Attach computed viewCount from PostView aggregation + comment count
    const playbookIds = rawPlaybooks.map((pb) => pb.id);
    const [commentCounts, likeCounts] = await Promise.all([
      CommentService.getCommentCounts(playbookIds),
      LikeService.getLikeCounts(playbookIds),
    ]);

    const playbooks = rawPlaybooks.map((pb) => ({
      ...pb,
      viewCount: pb._count?.postViews ?? 0,
      commentCount: commentCounts[pb.id] ?? 0,
      likeCount: likeCounts[pb.id] ?? 0,
    }));

    const localized = query.locale
      ? await localizePlaybooks(playbooks, query.locale)
      : playbooks;

    return { playbooks: localized, total, pages: Math.ceil(total / l), currentPage: p };
  }

  static async findMarketplace(query: {
    search?: string; tag?: string; tradingSymbol?: string;
    sortBy?: string; page?: number; limit?: number; sortOrder?: string;
    locale?: string;
  }) {
    const { page = 1, limit = 20, search, tag, tradingSymbol, sortBy = 'viewCount', sortOrder: rawSortOrder = 'desc' } = query;
    // Normalize sort direction
    const sortOrder = rawSortOrder === 'asc' ? 'asc' : 'desc';
    const p = Number(page) || 1;
    const l = Number(limit) || 20;
    const skip = (p - 1) * l;

    const where: Record<string, any> = { status: 'published' as PlaybookStatus };
    if (search) {
      // Map display names to English tag keys: Chinese label → English tag key
      const tagLabelMap: Record<string, string> = {
        // 策略类型
        '动量': 'Momentum', '剥头皮': 'Scalping', '波段': 'Swing',
        '日内交易': 'DayTrading', '趋势交易': 'PositionTrading',
        '趋势跟踪': 'TrendFollowing', '均值回归': 'MeanReversion',
        '突破': 'Breakout', '消息面': 'NewsTrading', '套利': 'Arbitrage',
        '算法': 'Algorithmic', '量化': 'Algorithmic', '价值投资': 'ValueInvesting',
        // 资产类别
        '股票': 'Stocks', '期货': 'Futures', 'ETF': 'ETF', '指数': 'Indices',
        '债券': 'Bonds', '大宗商品': 'Commodities', '商品': 'Commodities',
        '期权': 'Options', '加密货币': 'Crypto', '外汇': 'Forex',
        // 分析方法
        '技术分析': 'Technical', '基本面分析': 'Fundamental',
        '价格行为': 'PriceAction', '成交量': 'VolumeAnalysis',
        '支撑阻力': 'SupportResistance', '形态识别': 'PatternRecognition',
      };
      // Match against Chinese labels OR English tag keys (exact or prefix)
      const matchedTagKey =
        Object.entries(tagLabelMap).find(
          ([label]) => label === search || label.startsWith(search)
        )?.[1] ||
        Object.values(tagLabelMap).find(
          (key) => key.toLowerCase() === search.toLowerCase() || key.toLowerCase().startsWith(search.toLowerCase())
        ) || null;
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        ...(matchedTagKey ? [{ tags: { has: matchedTagKey } }] : []),
      ];
    }
    if (tag) where.tags = { has: tag };
    if (tradingSymbol) where.tradingSymbols = { has: tradingSymbol };

    const [rawPlaybooks, total] = await Promise.all([
      prisma.playbook.findMany({
        where,
        select: {
          id: true, title: true, description: true, price: true,
          tags: true, tradingSymbols: true, purchaseCount: true,
          publishedAt: true,
          user: { select: { id: true, displayName: true, avatarUrl: true, email: true } },
          _count: { select: { postViews: true, likes: true } },
        },
        orderBy: {
          ...(sortBy === 'viewCount' ? { postViews: { _count: sortOrder as any } } :
            sortBy === 'likeCount' ? { likes: { _count: sortOrder as any } } :
            sortBy === 'purchaseCount' ? { purchaseCount: sortOrder as any } :
          sortBy === 'price' ? { price: sortOrder as any } :
          sortBy === 'publishedAt' ? { publishedAt: sortOrder as any } : { createdAt: sortOrder as any }),
        },
        skip, take: l,
      }),
      prisma.playbook.count({ where }),
    ]);

    // Attach computed viewCount from PostView aggregation + comment count
    const playbookIds = rawPlaybooks.map((pb) => pb.id);
    const commentCounts = await CommentService.getCommentCounts(playbookIds);

    const playbooks = rawPlaybooks.map((pb) => ({
      ...pb,
      viewCount: pb._count?.postViews ?? 0,
      commentCount: commentCounts[pb.id] ?? 0,
      likeCount: pb._count?.likes ?? 0,
    }));

    const localized = query.locale
      ? await localizePlaybooks(playbooks, query.locale)
      : playbooks;

    return { playbooks: localized, total, pages: Math.ceil(total / l), currentPage: p };
  }

  static async update(id: string, userId: string, data: Partial<{
    title: string; description: string; content: string;
    paidContent: string; price: number | null;
    status: PlaybookStatus; tags: string[]; tradingSymbols: string[];
  }>) {
    const playbook = await prisma.playbook.findUnique({ where: { id } });
    if (!playbook) throw new AppError(404, 'Playbook not found');
    if (playbook.userId !== userId) throw new AppError(403, 'Not authorized');

    const updateData: Record<string, any> = { ...data };
    if (data.status === 'published' && !playbook.publishedAt) {
      updateData.publishedAt = new Date();
    }
    // Force price to null — all posts are now free
    updateData.price = null;

    const updated = await prisma.playbook.update({ where: { id }, data: updateData });

    if (updated.status === 'published') {
      warmPlaybookTranslationCache({
        id: updated.id,
        title: updated.title,
        description: updated.description,
        content: updated.content,
        paidContent: updated.paidContent,
        tradingSymbols: updated.tradingSymbols,
      });
    }

    return updated;
  }

  static async delete(id: string, userId: string) {
    const playbook = await prisma.playbook.findUnique({ where: { id } });
    if (!playbook) throw new AppError(404, 'Playbook not found');
    if (playbook.userId !== userId) throw new AppError(403, 'Not authorized');
    return prisma.playbook.delete({ where: { id } });
  }

  static async purchase(playbookId: string, buyerId: string) {
    // Use transaction for atomic purchase
    return prisma.$transaction(async (tx) => {
      const playbook = await tx.playbook.findUnique({ where: { id: playbookId } });
      if (!playbook || playbook.status !== 'published') throw new AppError(404, 'Playbook not available');
      if (playbook.userId === buyerId) throw new AppError(400, 'Cannot buy your own playbook');

      const existing = await tx.playbookPurchase.findUnique({
        where: { playbookId_buyerId: { playbookId, buyerId } },
      });
      if (existing) throw new AppError(409, 'Already purchased');

      const amount = Number(playbook.price || 0);
      const commission = Math.round(amount * 0.1 * 100) / 100;
      const sellerRevenue = Math.round((amount - commission) * 100) / 100;

      const purchase = await tx.playbookPurchase.create({
        data: {
          playbookId, buyerId, sellerId: playbook.userId,
          amount: String(amount),
          platformCommission: String(commission),
          sellerRevenue: String(sellerRevenue),
        },
      });

      await tx.playbook.update({
        where: { id: playbookId },
        data: { purchaseCount: { increment: 1 } },
      });

      // Record task event for first purchase (fire-and-forget)
      try {
        await TaskService.recordEvent(buyerId, 'first_purchase', 1);
      } catch {
        // Non-critical
      }

      return { purchase, commission, sellerRevenue, amount };
    });
  }

  static async getUserPurchases(buyerId: string, query: { page?: number; limit?: number; locale?: string }) {
    const { page = 1, limit = 20 } = query;
    const p = Number(page) || 1;
    const l = Number(limit) || 20;
    const skip = (p - 1) * l;

    const [purchases, total] = await Promise.all([
      prisma.playbookPurchase.findMany({
        where: { buyerId },
        include: {
          playbook: { select: { id: true, title: true, tags: true, publishedAt: true } },
          seller: { select: { id: true } },
        },
        orderBy: { purchasedAt: 'desc' }, skip, take: l,
      }),
      prisma.playbookPurchase.count({ where: { buyerId } }),
    ]);

    if (query.locale) {
      const localizedPlaybooks = await localizePlaybooks(
        purchases.map((p) => p.playbook).filter(Boolean) as Array<{
          id: string; title: string; description?: string | null; tags?: string[];
        }>,
        query.locale,
      );
      const byId = new Map(localizedPlaybooks.map((pb) => [pb.id, pb]));
      const localizedPurchases = purchases.map((p) => ({
        ...p,
        playbook: p.playbook ? byId.get(p.playbook.id) ?? p.playbook : p.playbook,
      }));
      return { purchases: localizedPurchases, total, pages: Math.ceil(total / l), currentPage: p };
    }

    return { purchases, total, pages: Math.ceil(total / l), currentPage: p };
  }

  static async getAuthorStats(authorId: string) {
    const stats = await prisma.playbook.groupBy({
      by: ['status'],
      where: { userId: authorId },
      _count: true,
      _sum: { purchaseCount: true },
    });

    const result = { totalPlaybooks: 0, draft: 0, published: 0, totalPurchases: 0, totalRevenue: 0 };
    for (const s of stats) {
      result.totalPlaybooks += s._count;
      if (s.status === 'draft') result.draft = s._count;
      if (s.status === 'published') result.published = s._count;
      result.totalPurchases += s._sum.purchaseCount || 0;
    }

    const revenueAgg = await prisma.playbookPurchase.aggregate({
      where: { sellerId: authorId },
      _sum: { sellerRevenue: true },
    });
    result.totalRevenue = Number(revenueAgg._sum.sellerRevenue || 0);

    return result;
  }

  static async addAttachments(playbookId: string, userId: string, attachments: Array<{
    originalName: string; filename: string; path: string;
    size: number; mimetype: string;
  }>) {
    const playbook = await prisma.playbook.findUnique({ where: { id: playbookId } });
    if (!playbook) throw new AppError(404, 'Playbook not found');
    if (playbook.userId !== userId) throw new AppError(403, 'Not authorized');

    const existingAttachments = (playbook as any).attachments || [];
    const updatedAttachments = [...existingAttachments, ...attachments];

    return prisma.playbook.update({
      where: { id: playbookId },
      data: { attachments: updatedAttachments },
    });
  }

  /** Calculate the credit cost to download an attachment based on file extension */
  static getAttachmentCreditCost(filename: string): number {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    // Image files are always free
    const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico']);
    if (IMAGE_EXTENSIONS.has(ext)) return 0;
    // Document files cost 100 credits
    const DOC_EXTENSIONS = new Set(['pdf', 'docx', 'doc', 'xls', 'xlsx']);
    if (DOC_EXTENSIONS.has(ext)) return 100;
    // MT4/MT5 script files cost 200 credits
    const MT_EXTENSIONS = new Set(['mq4', 'ex4', 'mq5', 'ex5']);
    if (MT_EXTENSIONS.has(ext)) return 200;
    // Unknown types default to 100 credits
    return 100;
  }

  static async getAttachmentPath(playbookId: string, userId: string, filename: string, userTier: string = 'free'): Promise<string> {
    const playbook = await prisma.playbook.findUnique({
      where: { id: playbookId },
      select: { id: true, attachments: true, userId: true, title: true,
        user: { select: { id: true, email: true } } },
    });
    if (!playbook) throw new AppError(404, 'Playbook not found');

    // Verify attachment belongs to this playbook
    const attachment = (playbook.attachments as any[] || []).find((a: any) => a.filename === filename);
    if (!attachment) throw new AppError(404, 'Attachment not found');

    // Post owner downloads for free (no credit deduction)
    if (playbook.userId === userId) {
      return attachment.path;
    }

    // Pro/Premium users download all attachments for free
    if (userTier !== 'free') {
      return attachment.path;
    }

    // Free tier users: check if non-image attachment requires credits
    const creditCost = this.getAttachmentCreditCost(filename);

    if (creditCost > 0) {
      // Deduct credits before allowing download — include author, post title & attachment name
      const authorName = playbook.user?.email?.split('@')[0] || 'Unknown';
      const postTitle = playbook.title || 'Untitled';
      const attName = attachment.originalName || filename;
      const desc = `下载「${authorName}」的帖子《${postTitle}》中的附件「${attName}」消耗-${creditCost}积分|||Download attachment "${attName}" from "${authorName}"'s post "${postTitle}" -${creditCost} credits`;
      try {
        await CreditService.spendCredits(userId, creditCost, desc);
      } catch (err: any) {
        // Insufficient credits
        throw new AppError(402, err.message || 'Insufficient credits');
      }

      // ── 50% reward to post author (fire-and-forget) ──
      try {
        const rewardPoints = Math.floor(creditCost * 0.5);
        // Build bilingual description for author's earning record
        const earnDescZh = `用户下载了您的帖子《${postTitle}》中的附件「${attName}」，获得+${rewardPoints}积分奖励`;
        const earnDescEn = `User downloaded attachment "${attName}" from your post "${postTitle}", earned +${rewardPoints} points`;
        await CreditService.earnCredits(playbook.userId, rewardPoints, 'attachment_download_reward' as any, undefined, `${earnDescZh}|||${earnDescEn}`);

        // Send in-app notification to post author
        // Fetch downloader display name
        const downloader = await prisma.user.findUnique({
          where: { id: userId },
          select: { displayName: true, email: true },
        });
        const downloaderName = downloader?.displayName || downloader?.email?.split('@')[0] || 'Unknown';
        await notificationService.notifyAttachmentDownloadReward(
          playbook.userId,
          downloaderName,
          postTitle,
          attName,
          rewardPoints,
        );
      } catch (rewardErr) {
        // Reward failure must NOT block file delivery
        console.error('[PlaybookService] Failed to award download reward:', rewardErr);
      }
    }

    return attachment.path;
  }

  static async getMyBrowsed(userId: string, query: { page?: number; limit?: number; locale?: string }) {
    const { page = 1, limit = 20 } = query;
    const p = Number(page) || 1;
    const l = Number(limit) || 20;
    const skip = (p - 1) * l;

    const [views, total] = await Promise.all([
      prisma.postView.findMany({
        where: { userId },
        include: {
          playbook: {
            select: {
              id: true, title: true, description: true, tags: true,
              publishedAt: true, purchaseCount: true,
              user: { select: { id: true, displayName: true, email: true, avatarUrl: true } },
            }
          },
        },
        orderBy: { viewedAt: 'desc' },
        skip,
        take: l,
      }),
      prisma.postView.count({ where: { userId } }),
    ]);

    const playbookIds = views.map((v) => v.playbook?.id).filter(Boolean) as string[];
    const [commentCounts, likeCounts] = await Promise.all([
      CommentService.getCommentCounts(playbookIds),
      LikeService.getLikeCounts(playbookIds),
    ]);

    const enrichedViews = views.map((v) => {
      if (!v.playbook) return v;
      return {
        ...v,
        playbook: {
          ...v.playbook,
          commentCount: commentCounts[v.playbook.id] ?? 0,
          likeCount: likeCounts[v.playbook.id] ?? 0,
        },
      };
    });

    if (query.locale) {
      const playbooks = enrichedViews.map((v) => v.playbook).filter(Boolean) as Array<{
        id: string; title: string; description?: string | null;
      }>;
      const localized = await localizePlaybooks(playbooks, query.locale);
      const byId = new Map(localized.map((pb) => [pb.id, pb]));
      const localizedViews = enrichedViews.map((v) => ({
        ...v,
        playbook: v.playbook ? byId.get(v.playbook.id) ?? v.playbook : v.playbook,
      }));
      return { views: localizedViews, total, pages: Math.ceil(total / l), currentPage: p };
    }

    return { views: enrichedViews, total, pages: Math.ceil(total / l), currentPage: p };
  }

  // ===== Favorites (收藏) =====

  static async toggleFavorite(userId: string, playbookId: string) {
    // Verify playbook exists
    const playbook = await prisma.playbook.findUnique({ where: { id: playbookId }, select: { id: true } });
    if (!playbook) throw new AppError(404, 'Playbook not found');

    const existing = await prisma.playbookFavorite.findUnique({
      where: { userId_playbookId: { userId, playbookId } },
    });

    if (existing) {
      // Unfavorite
      await prisma.playbookFavorite.delete({ where: { id: existing.id } });
      return { favorited: false };
    } else {
      // Favorite
      await prisma.playbookFavorite.create({ data: { userId, playbookId } });
      return { favorited: true };
    }
  }

  static async getMyFavorites(userId: string, query: { page?: number; limit?: number; locale?: string }) {
    const { page = 1, limit = 20 } = query;
    const p = Number(page) || 1;
    const l = Number(limit) || 20;
    const skip = (p - 1) * l;

    const [favorites, total] = await Promise.all([
      prisma.playbookFavorite.findMany({
        where: { userId },
        include: {
          playbook: {
            select: {
              id: true, title: true, description: true, price: true,
              tags: true, tradingSymbols: true, purchaseCount: true,
              publishedAt: true,
              user: { select: { id: true, displayName: true, avatarUrl: true, email: true } },
              _count: { select: { postViews: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: l,
      }),
      prisma.playbookFavorite.count({ where: { userId } }),
    ]);

    const playbookIds = favorites.map((f) => f.playbook?.id).filter(Boolean) as string[];
    const [commentCounts, likeCounts] = await Promise.all([
      CommentService.getCommentCounts(playbookIds),
      LikeService.getLikeCounts(playbookIds),
    ]);

    const playbooks = favorites.map((f) => ({
      ...f.playbook,
      viewCount: f.playbook?._count?.postViews ?? 0,
      favoritedAt: f.createdAt,
      commentCount: f.playbook ? (commentCounts[f.playbook.id] ?? 0) : 0,
      likeCount: f.playbook ? (likeCounts[f.playbook.id] ?? 0) : 0,
    }));

    if (query.locale) {
      const localized = await localizePlaybooks(
        playbooks.filter(Boolean) as Array<{ id: string; title: string; description?: string | null }>,
        query.locale,
      );
      const metaById = new Map(playbooks.map((pb) => [pb.id, pb]));
      return {
        playbooks: localized.map((pb) => ({ ...metaById.get(pb.id), ...pb })),
        total,
        pages: Math.ceil(total / l),
        currentPage: p,
      };
    }

    return { playbooks, total, pages: Math.ceil(total / l), currentPage: p };
  }

  static async getUserFavoriteIds(userId: string): Promise<Set<string>> {
    const favs = await prisma.playbookFavorite.findMany({
      where: { userId },
      select: { playbookId: true },
    });
    return new Set(favs.map((f) => f.playbookId));
  }

  // ===== Likes (点赞) =====

  static async toggleLike(userId: string, playbookId: string) {
    return LikeService.toggleLike(userId, playbookId);
  }

  static async getMyLikeIds(userId: string): Promise<string[]> {
    const ids = await LikeService.getUserLikeIds(userId);
    return Array.from(ids);
  }
}
