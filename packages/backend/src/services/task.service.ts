import { prisma } from '../lib/prisma';
import { CreditService } from './credit.service';
import { TaskCategory, TaskStatus, CreditSource } from '../generated/prisma';
import { aggregateTradesInCurrency } from '../utils/roi-fx.helper';
import { PLATFORM_CURRENCY } from './fx.service';

export const LEADERBOARD_MIN_TRADES = 5;
export const LEADERBOARD_MIN_INVESTMENT_USD = 100;

/** Default task definitions seeded on first access */
const DEFAULT_TASKS = [
  // ===== Newbie Tasks (3) =====
  {
    key: 'first_trade',
    category: 'newbie' as TaskCategory,
    title: 'Create Your First Trade',
    titleZh: '创建第一笔交易',
    description: 'Record your first trade to get started on your trading journey.',
    descriptionZh: '新建第 1 笔交易记录，开启您的交易之旅。',
    targetCount: 1,
    creditReward: 300,
    energyReward: 0,
    badgeKey: 'first_trade_badge',
    icon: '↗️',
    sortOrder: 1,
  },
  {
    key: 'first_playbook',
    category: 'newbie' as TaskCategory,
    title: 'Publish Your First Post',
    titleZh: '发布第一个帖子',
    description: 'Create and publish your first post in Community Plaza.',
    descriptionZh: '新建并发布您的第 1 个帖子。',
    targetCount: 1,
    creditReward: 200,
    energyReward: 0,
    badgeKey: 'first_playbook_badge',
    icon: '💬',
    sortOrder: 2,
  },
  {
    key: 'first_ai_report',
    category: 'newbie' as TaskCategory,
    title: 'Generate Your First AI Report',
    titleZh: '生成第一份 AI 报告',
    description: 'Use AI to analyze your trades and get insights.',
    descriptionZh: '使用 AI 分析您的交易数据并获得洞察报告。',
    targetCount: 1,
    creditReward: 200,
    energyReward: 0,
    badgeKey: 'ai_explorer_badge',
    icon: '🧠',
    sortOrder: 3,
  },
  {
    key: 'first_diary_entry',
    category: 'newbie' as TaskCategory,
    title: 'Write Your First Diary Entry',
    titleZh: '写下第一篇交易日记',
    description: 'Start reflecting by writing your first trading diary entry.',
    descriptionZh: '开始复盘反思，撰写您的第一篇交易日记。',
    targetCount: 1,
    creditReward: 100,
    energyReward: 0,
    badgeKey: 'journal_starter_badge',
    icon: '📖',
    sortOrder: 4,
  },
  {
    key: 'verify_email',
    category: 'newbie' as TaskCategory,
    title: 'Verify Your Email',
    titleZh: '验证邮箱地址',
    description: 'Secure your account by verifying your email address.',
    descriptionZh: '验证您的邮箱以保障账户安全。',
    targetCount: 1,
    creditReward: 50,
    energyReward: 0,
    badgeKey: 'verified_user_badge',
    icon: '🛡️',
    sortOrder: 5,
  },
  {
    key: 'import_trades',
    category: 'newbie' as TaskCategory,
    title: 'Import Trading Data',
    titleZh: '导入交易数据',
    description: 'Bulk import your historical trade records via CSV file.',
    descriptionZh: '通过 CSV 文件批量导入历史交易记录。',
    targetCount: 1,
    creditReward: 100,
    energyReward: 0,
    badgeKey: 'data_importer_badge',
    icon: '📥',
    sortOrder: 6,
  },
  // ===== Advanced Tasks — Based on Actual TradeWise Features =====
  // AI Reports Module
  {
    key: 'ai_reports_5',
    category: 'advanced' as TaskCategory,
    title: 'Generate AI Reports',
    titleZh: '生成 AI 报告',
    description: 'Use AI models to generate analysis reports on your data. Earn 100 credits per report (max 2/day).',
    descriptionZh: '使用 AI 模型生成数据分析报告。每份报告获得 100 积分（每日上限 2 次）。',
    targetCount: 5,
    creditReward: 500,
    energyReward: 0,
    badgeKey: 'data_driven_badge',
    icon: '⚙️',
    sortOrder: 11,
    dailyCreditCap: 2,
    perActionCredits: 100,
  },
  // AI Follow-up (Questions)
  {
    key: 'ai_chat_10',
    category: 'advanced' as TaskCategory,
    title: 'AI Follow-up Questions',
    titleZh: 'AI 追问',
    description: 'Ask AI follow-up questions to dive deeper into insights. Earn 100 credits per conversation (max 2/day).',
    descriptionZh: '对 AI 报告进行追问对话，深入挖掘洞察。每次追问获得 100 积分（每日上限 2 次）。',
    targetCount: 10,
    creditReward: 1000,
    energyReward: 0,
    badgeKey: 'curious_mind_badge',
    icon: '📊',
    sortOrder: 12,
    dailyCreditCap: 2,
    perActionCredits: 100,
  },
  // Posts in Community Plaza
  {
    key: 'publish_3_playbooks',
    category: 'advanced' as TaskCategory,
    title: 'Publish Posts',
    titleZh: '发布帖子',
    description: 'Share your insights by publishing posts. Earn 100 credits per post (max 2/day).',
    descriptionZh: '分享您的见解，发布帖子。每个帖子获得 100 积分（每日上限 2 次）。',
    targetCount: 3,
    creditReward: 300,
    energyReward: 0,
    badgeKey: 'strategy_author_badge',
    icon: '📅',
    sortOrder: 13,
    dailyCreditCap: 2,
    perActionCredits: 100,
  },
  // Export Data (removed per user request)
  // Diary/Journal
  {
    key: 'diary_entries_7',
    category: 'advanced' as TaskCategory,
    title: 'Write Diary Entries',
    titleZh: '写交易日记',
    description: 'Build a consistent journaling habit. Earn 100 credits per entry (max 2/day).',
    descriptionZh: '养成复盘习惯，撰写交易日记。每篇获得 100 积分（每日上限 2 次）。',
    targetCount: 7,
    creditReward: 700,
    energyReward: 0,
    badgeKey: 'journal_habit_badge',
    icon: '📈',
    sortOrder: 17,
    dailyCreditCap: 2,
    perActionCredits: 100,
  },
  // First Post Browse (free post viewing)
  {
    key: 'first_browse_post',
    category: 'advanced' as TaskCategory,
    title: 'First Post Browse',
    titleZh: '首次浏览帖子',
    description: 'Browse your first post in Community Plaza.',
    descriptionZh: '在社区广场首次浏览帖子。',
    targetCount: 1,
    creditReward: 300,
    energyReward: 0,
    badgeKey: 'post_browser_badge',
    icon: '🏆',
    sortOrder: 18,
  },
];

/** Default badge definitions */
const DEFAULT_BADGES = [
  // Newbie Badges
  { key: 'first_trade_badge', name: 'First Trade', nameZh: '命中注定', description: 'Completed first trade', descriptionZh: '完成首笔交易', icon: '🎯', color: '#E5A23C', sortOrder: 1 },
  { key: 'first_playbook_badge', name: 'First Post', nameZh: '帖子新星', description: 'Published first post', descriptionZh: '发布首个帖子', icon: '📘', color: '#00d4aa', sortOrder: 2 },
  { key: 'ai_explorer_badge', name: 'AI Explorer', nameZh: 'AI 探索者', description: 'Generated first AI report', descriptionZh: '生成首份 AI 报告', icon: '🤖', color: '#9b59b6', sortOrder: 3 },
  // Advanced Badges — Feature-aligned
  { key: 'data_driven_badge', name: 'Data Driven', nameZh: '数据驱动', description: 'Generated AI reports', descriptionZh: '生成 AI 报告', icon: '🔬', color: '#e74c3c', sortOrder: 5 },
  { key: 'curious_mind_badge', name: 'Curious Mind', nameZh: '刨根问底', description: 'Had AI follow-up conversations', descriptionZh: 'AI 追问对话', icon: '💬', color: '#f39c12', sortOrder: 6 },
  { key: 'strategy_author_badge', name: 'Post Author', nameZh: '帖子作者', description: 'Published posts', descriptionZh: '发布帖子', icon: '📝', color: '#2ecc71', sortOrder: 7 },
  { key: 'data_importer_badge', name: 'Data Importer', nameZh: '数据导入者', description: 'Imported trade data via CSV', descriptionZh: '通过 CSV 导入交易数据', icon: '📥', color: '#1abc9c', sortOrder: 8 },
  { key: 'journal_starter_badge', name: 'Journal Starter', nameZh: '日记初学者', description: 'Wrote first diary entry', descriptionZh: '写下第一篇交易日记', icon: '📔', color: '#e67e22', sortOrder: 9 },
  { key: 'journal_habit_badge', name: 'Journal Keeper', nameZh: '复盘达人', description: 'Wrote diary entries', descriptionZh: '撰写交易日记', icon: '✍️', color: '#16a085', sortOrder: 11 },
  { key: 'marketplace_buyer_badge', name: 'Post Browser', nameZh: '帖子浏览者', description: 'Browsed your first post', descriptionZh: '首次浏览帖子', icon: '🔓', color: '#E5A23C', sortOrder: 12 },
  { key: 'verified_user_badge', name: 'Verified User', nameZh: '已认证用户', description: 'Verified email address', descriptionZh: '已验证邮箱地址', icon: '✅', color: '#27ae60', sortOrder: 13 },
  { key: 'marketplace_explorer_badge', name: 'Explorer', nameZh: '广场探索者', description: 'Browsed the plaza', descriptionZh: '浏览了社区广场', icon: '👀', color: '#2980b9', sortOrder: 14 },
];

export class TaskService {
  /** Ensure default tasks and badges exist in DB (upsert by key, deactivate orphans) */
  static async seedDefaults() {
    const defaultTaskKeys = new Set(DEFAULT_TASKS.map((t) => t.key));
    const defaultBadgeKeys = new Set(DEFAULT_BADGES.map((b) => b.key));

    // Upsert tasks: insert or update by unique key
    for (const task of DEFAULT_TASKS) {
      // Build a clean object with only Prisma schema fields (strip non-schema fields like dailyCreditCap/perActionCredits)
      const dbTask = {
        key: task.key,
        category: task.category,
        title: task.title,
        titleZh: task.titleZh,
        description: task.description,
        descriptionZh: task.descriptionZh,
        targetCount: task.targetCount,
        creditReward: task.creditReward,
        energyReward: task.energyReward,
        badgeKey: task.badgeKey,
        icon: task.icon,
        sortOrder: task.sortOrder,
      };
      await prisma.task.upsert({
        where: { key: task.key },
        update: {
          category: task.category,
          title: task.title,
          titleZh: task.titleZh,
          description: task.description,
          descriptionZh: task.descriptionZh,
          targetCount: task.targetCount,
          creditReward: task.creditReward,
          energyReward: task.energyReward,
          badgeKey: task.badgeKey,
          icon: task.icon,
          sortOrder: task.sortOrder,
        },
        create: dbTask,
      });
    }
    // Deactivate tasks that are no longer in defaults (e.g. old ai_chat_5, use_3_ai_models, etc.)
    await prisma.task.updateMany({
      where: { isActive: true, key: { notIn: [...defaultTaskKeys] } },
      data: { isActive: false },
    });

    // Upsert badges: insert or update by unique key
    for (const badge of DEFAULT_BADGES) {
      if (!badge || !badge.key) continue;
      await prisma.badge.upsert({
        where: { key: badge.key },
        update: {
          name: badge.name,
          nameZh: badge.nameZh,
          description: badge.description,
          descriptionZh: badge.descriptionZh,
          icon: badge.icon,
          color: badge.color,
          sortOrder: badge.sortOrder,
        },
        create: badge,
      });
    }
    // Deactivate badges that are no longer in defaults
    await prisma.badge.updateMany({
      where: { isActive: true, key: { notIn: [...defaultBadgeKeys] } },
      data: { isActive: false },
    });
  }

  /** Get all active tasks with user progress */
  static async getAllWithProgress(userId: string) {
    await this.seedDefaults();
    const tasks = await prisma.task.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    });

    const progresses = await prisma.userTaskProgress.findMany({
      where: { userId },
    });
    const progressMap = new Map(progresses.map((p) => [p.taskId, p]));

    // For daily-cap tasks, fetch today's grant count in batch
    const dailyCapTasks = tasks.filter((t) => this.DAILY_CAP_TASKS.has(t.key));
    const todayGrantMap = new Map<string, number>();
    for (const task of dailyCapTasks) {
      const config = this.getDailyCapConfig(task.key);
      if (config) {
        try {
          const count = await this.getTodayCreditGrants(userId, task.key, config.perActionCredits);
          todayGrantMap.set(task.key, count);
        } catch { /* ignore */ }
      }
    }

    return tasks.map((task) => ({
      ...task,
      progress: progressMap.get(task.id) || null,
      ...(this.DAILY_CAP_TASKS.has(task.key)
        ? (() => {
            const config = this.getDailyCapConfig(task.key);
            return config
              ? { todayCreditsGranted: todayGrantMap.get(task.key) || 0, dailyCap: config.dailyCap, perActionCredits: config.perActionCredits }
              : {};
          })()
        : {}),
    }));
  }

  /** Get tasks grouped by category */
  static async getGroupedByCategory(userId: string) {
    const all = await this.getAllWithProgress(userId);
    return {
      newbie: all.filter((t) => t.category === 'newbie'),
      advanced: all.filter((t) => t.category === 'advanced'),
    };
  }

  /** Tasks that have daily per-action credit caps (key → config) */
  private static readonly DAILY_CAP_TASKS = new Set([
    'ai_reports_5', 'ai_chat_10', 'publish_3_playbooks', 'diary_entries_7',
  ]);

  /** Look up daily cap config from DEFAULT_TASKS in-memory definition (not stored in DB) */
  private static getDailyCapConfig(taskKey: string): { dailyCap: number; perActionCredits: number } | null {
    const def = DEFAULT_TASKS.find(t => t.key === taskKey);
    if (def && def.dailyCreditCap && def.perActionCredits) {
      return { dailyCap: def.dailyCreditCap, perActionCredits: def.perActionCredits };
    }
    return null;
  }

  /** Check how many per-action credits have been awarded today for a specific capped task.
   *  Counts ALL grants (including already-consumed ones) to prevent re-earning after spending.
   */
  private static async getTodayCreditGrants(userId: string, taskKey: string, perAmount: number): Promise<number> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    // Count today's task_reward credits matching the specific taskKey and per-action amount.
    // Must include consumed credits too — otherwise spending credits would reset the daily counter.
    const result = await prisma.credit.aggregate({
      _sum: { amount: true },
      where: {
        userId,
        source: CreditSource.task_reward,
        taskKey,   // per-task isolation
        amount: perAmount,
        earnedAt: { gte: todayStart },
      },
    });
    // Return count of individual grants (total amount / per-action amount)
    return Math.floor((result._sum.amount || 0) / perAmount);
  }

  /** Get today's credit grant count for a specific task (exposed for API responses) */
  static async getTodayGrantCount(userId: string, taskKey: string, perAmount: number): Promise<number> {
    return this.getTodayCreditGrants(userId, taskKey, perAmount);
  }

  /** Increment task progress by event key. For daily-cap tasks, awards per-action credits up to the cap. */
  static async recordEvent(userId: string, taskKey: string, increment: number = 1): Promise<{ completed: boolean; creditsAwarded: number; badgeEarned?: string; dailyCapHit?: boolean }> {
    console.log(`[TaskEvent] recordEvent called: userId=${userId}, taskKey=${taskKey}, increment=${increment}`);
    await this.seedDefaults();
    const task = await prisma.task.findUnique({ where: { key: taskKey } });
    if (!task || !task.isActive) {
      console.log(`[TaskEvent] Task not found or inactive: ${taskKey}, task=`, task ? { id: task.id, isActive: task.isActive } : null);
      return { completed: false, creditsAwarded: 0 };
    }
    console.log(`[TaskEvent] Task found: ${taskKey}, titleZh=${task.titleZh}`);

    // ---- Always increment progress (no cap on total count) ----
    let progress = await prisma.userTaskProgress.findUnique({
      where: { userId_taskId: { userId, taskId: task.id } },
    });

    if (!progress) {
      progress = await prisma.userTaskProgress.create({
        data: {
          userId,
          taskId: task.id,
          status: 'in_progress' as TaskStatus,
          currentCount: increment,
          startedAt: new Date(),
        },
      });
    } else if (progress.status !== 'completed' && progress.status !== 'claimed') {
      const newCount = progress.currentCount + increment;
      // Daily-cap tasks never "complete" based on targetCount — they run indefinitely with daily credit caps
      const isDailyCapTask = this.DAILY_CAP_TASKS.has(taskKey);
      progress = await prisma.userTaskProgress.update({
        where: { id: progress.id },
        data: {
          currentCount: newCount,
          ...(isDailyCapTask ? {} : { status: newCount >= task.targetCount ? ('completed' as TaskStatus) : ('in_progress' as TaskStatus) }),
        },
      });
    }

    // ---- Per-action credit awarding for daily-cap tasks ----
    let creditsThisEvent = 0;
    let dailyCapHit = false;
    const isDailyCapTask = this.DAILY_CAP_TASKS.has(taskKey);
    const capConfig = isDailyCapTask ? this.getDailyCapConfig(taskKey) : null;

    if (capConfig) {
      // DEBUG: 确认新代码生效
      console.log(`[Credits] Daily-cap task "${taskKey}" → config:`, capConfig);
      // Check how many times we've already awarded credits today for this task
      const todayGrants = await this.getTodayCreditGrants(userId, taskKey, capConfig.perActionCredits);
      console.log(`[Credits] Today grants for "${taskKey}": ${todayGrants}/${capConfig.dailyCap}`);
      if (todayGrants < capConfig.dailyCap) {
        try {
          const desc = `${task.titleZh}获得+${capConfig.perActionCredits}积分|||${task.title || task.titleZh} +${capConfig.perActionCredits} credits`;
          console.log(`[Credits] Earning ${capConfig.perActionCredits} credits for task "${taskKey}", desc: "${desc}"`);
          await CreditService.earnCredits(userId, capConfig.perActionCredits, CreditSource.task_reward, taskKey, desc);
          creditsThisEvent = capConfig.perActionCredits;
          console.log(`[Credits] Successfully earned ${capConfig.perActionCredits} credits for "${taskKey}"`);
        } catch (err) {
          console.error(`[Credits] ERROR earning credits for task "${taskKey}":`, err);
        }
      } else {
        dailyCapHit = true;
      }
    }

    // ---- Check if task was just completed (for badge + remaining completion bonus) ----
    let badgeEarned: string | undefined;
    let completed = false;

    // Daily-cap tasks skip completion-based logic; they award badges on first credit-earning action instead
    if (isDailyCapTask && creditsThisEvent > 0) {
      // Award badge on first successful credit grant for daily-cap tasks
      const existingBadge = await prisma.userBadge.findFirst({
        where: { userId, badge: { key: task.badgeKey || '' } },
      });
      if (!existingBadge && task.badgeKey) {
        const badge = await prisma.badge.findUnique({ where: { key: task.badgeKey } });
        if (badge) {
          try {
            await prisma.userBadge.create({ data: { userId, badgeId: badge.id, sourceTaskId: task.id } });
            badgeEarned = badge.key;
          } catch { /* already has badge */ }
        }
      }
    } else if (!isDailyCapTask && progress.currentCount >= task.targetCount && !progress.completedAt) {
      await prisma.userTaskProgress.update({
        where: { id: progress.id },
        data: { status: 'completed' as TaskStatus, completedAt: new Date() },
      });
      completed = true;

      // Award completion bonus
      try {
        const desc = `完成「${task.titleZh}」获得+${task.creditReward}积分|||Completed "${task.title || task.titleZh}" +${task.creditReward} credits`;
        console.log(`[Credits] Earning completion bonus ${task.creditReward} credits for task "${taskKey}", desc: "${desc}"`);
        await CreditService.earnCredits(userId, task.creditReward, CreditSource.task_reward, undefined, desc);
        creditsThisEvent = task.creditReward;
        console.log(`[Credits] Successfully earned completion bonus ${task.creditReward} credits for "${taskKey}"`);
      } catch (err) {
        console.error(`[Credits] ERROR earning completion bonus for task "${taskKey}":`, err);
      }

      // Award badge
      if (task.badgeKey) {
        const badge = await prisma.badge.findUnique({ where: { key: task.badgeKey } });
        if (badge) {
          try {
            await prisma.userBadge.create({ data: { userId, badgeId: badge.id, sourceTaskId: task.id } });
            badgeEarned = badge.key;
          } catch { /* already has badge */ }
        }
      }
    }

    return { completed, creditsAwarded: creditsThisEvent, badgeEarned, dailyCapHit };
  }

  /** Claim rewards (mark as claimed) - for future manual claiming flow */
  static async claimRewards(userId: string, taskId: string) {
    const progress = await prisma.userTaskProgress.findUnique({
      where: { userId_taskId: { userId, taskId } },
    });
    if (!progress || progress.status !== 'completed') {
      throw new Error('Task not completed or already claimed');
    }
    return prisma.userTaskProgress.update({
      where: { id: progress.id },
      data: { status: 'claimed' as TaskStatus, claimedAt: new Date() },
    });
  }

  /** Get user's overall stats */
  static async getUserStats(userId: string) {
    await this.seedDefaults();
    const [totalTasks, completedTasks, totalBadges] = await Promise.all([
      prisma.task.count({ where: { isActive: true } }),
      prisma.userTaskProgress.count({ where: { userId, status: 'completed' } }),
      prisma.userBadge.count({ where: { userId } }),
    ]);
    const allBadges = await prisma.badge.count({ where: { isActive: true } });
    return {
      totalTasks,
      completedTasks,
      totalCreditsFromTasks: 0, // could aggregate from credits with source=task_reward
      totalBadges: allBadges,
      earnedBadges: totalBadges,
    };
  }

  // ===== Leaderboard Methods =====

  /** Top publishers by number of published strategies (Top 10) */
  static async getPublisherLeaderboard(limit = 10): Promise<Array<{
    rank: number; userId: string; displayName: string | null;
    avatarUrl: string | null; email: string; playbookCount: number;
  }>> {
    const result = await prisma.user.findMany({
      where: { playbooks: { some: { status: 'published' as any } } },
      select: {
        id: true, displayName: true, avatarUrl: true, email: true,
        playbooks: { select: { id: true }, where: { status: 'published' as any } },
      },
    });

    return result
      .map((u: any) => ({
        userId: u.id,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        email: u.email,
        playbookCount: u.playbooks.length,
      }))
      .sort((a: any, b: any) => b.playbookCount - a.playbookCount)
      .slice(0, limit)
      .map((u: any, i: number) => ({ ...u, rank: i + 1 }));
  }

  /** Top sellers by total sales volume/revenue (Top 10) */
  static async getSellerLeaderboard(limit = 10): Promise<Array<{
    rank: number; userId: string; displayName: string | null;
    avatarUrl: string | null; email: string;
    totalSales: number; revenueSum: number;
  }>> {
    const sellers = await prisma.playbookPurchase.groupBy({
      by: ['sellerId'],
      _count: { id: true },
      _sum: { sellerRevenue: true },
      orderBy: { _count: { id: 'desc' } },
      take: limit,
    });

    // Fetch user details for each seller
    const results = await Promise.all(
      sellers.map(async (s, i) => {
        const user = await prisma.user.findUnique({
          where: { id: s.sellerId },
          select: { id: true, displayName: true, avatarUrl: true, email: true },
        });
        return {
          rank: i + 1,
          userId: s.sellerId,
          displayName: user?.displayName || null,
          avatarUrl: user?.avatarUrl || null,
          email: user?.email || '',
          totalSales: s._count.id,
          revenueSum: Number(s._sum.sellerRevenue || 0),
        };
      })
    );

    return results.sort((a, b) => b.totalSales - a.totalSales).map((r, i) => ({ ...r, rank: i + 1 }));
  }

  /** Top users by return rate (ROI) — netPnL / investment in PLATFORM_CURRENCY */
  static async getReturnRateLeaderboard(limit = 10, period: '1m' | '3m' | '6m' | '12m' = '3m'): Promise<Array<{
    rank: number; userId: string; displayName: string | null;
    avatarUrl: string | null; email: string;
    returnRate: number; totalPnl: number; totalNetPnl: number;
    totalInvestment: number; tradeCount: number;
    platformCurrency: string;
  }>> {
    const now = new Date();
    const periodMap: Record<string, number> = { '1m': 30, '3m': 90, '6m': 180, '12m': 365 };
    const days = periodMap[period] || 90;
    const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const round2 = (n: number) => Math.round(n * 100) / 100;

    const optedInUsers = await prisma.userPreference.findMany({
      where: { leaderboardOptIn: true },
      select: { userId: true },
    });
    const optedInSet = new Set(optedInUsers.map((u) => u.userId));

    const allTrades = await prisma.trade.findMany({
      where: {
        exitTimestamp: { gte: since, not: null },
        pnl: { not: null },
        user: { emailVerified: true },
      },
      select: {
        userId: true,
        positionDirection: true,
        entryPrice: true,
        exitPrice: true,
        quantity: true,
        leverage: true,
        pnl: true,
        commission: true,
        swap: true,
        quoteCurrency: true,
        entryTimestamp: true,
        exitTimestamp: true,
      },
    });

    if (allTrades.length === 0) return [];

    const tradesByUser = new Map<string, typeof allTrades>();
    for (const trade of allTrades) {
      if (!optedInSet.has(trade.userId)) continue;
      const list = tradesByUser.get(trade.userId) ?? [];
      list.push(trade);
      tradesByUser.set(trade.userId, list);
    }

    const ranked: Array<{
      userId: string;
      returnRate: number;
      totalPnl: number;
      totalNetPnl: number;
      totalInvestment: number;
      tradeCount: number;
    }> = [];

    for (const [userId, trades] of tradesByUser.entries()) {
      if (trades.length < LEADERBOARD_MIN_TRADES) continue;

      const agg = await aggregateTradesInCurrency(trades, PLATFORM_CURRENCY);
      if (agg.convertedCount < LEADERBOARD_MIN_TRADES) continue;
      if (agg.totalInvestment < LEADERBOARD_MIN_INVESTMENT_USD) continue;

      ranked.push({
        userId,
        returnRate: agg.roi,
        totalPnl: agg.totalNetPnL,
        totalNetPnl: agg.totalNetPnL,
        totalInvestment: agg.totalInvestment,
        tradeCount: agg.tradeCount,
      });
    }

    ranked.sort((a, b) => {
      if (b.returnRate !== a.returnRate) return b.returnRate - a.returnRate;
      if (b.totalPnl !== a.totalPnl) return b.totalPnl - a.totalPnl;
      return b.tradeCount - a.tradeCount;
    });

    const top = ranked.slice(0, limit);

    const results = await Promise.all(
      top.map(async (r) => {
        const user = await prisma.user.findUnique({
          where: { id: r.userId },
          select: { id: true, displayName: true, avatarUrl: true, email: true },
        });
        return {
          userId: r.userId,
          displayName: user?.displayName || null,
          avatarUrl: user?.avatarUrl || null,
          email: user?.email || '',
          returnRate: round2(r.returnRate),
          totalPnl: round2(r.totalPnl),
          totalNetPnl: round2(r.totalNetPnl),
          totalInvestment: round2(r.totalInvestment),
          tradeCount: r.tradeCount,
          platformCurrency: PLATFORM_CURRENCY,
        };
      }),
    );

    return results.map((r, i) => ({ ...r, rank: i + 1 }));
  }

  /** Top users by total playbook views (sum of postViews across all their published posts) */
  static async getViewsLeaderboard(limit = 10): Promise<Array<{
    rank: number; userId: string; displayName: string | null;
    avatarUrl: string | null; email: string; totalViews: number;
  }>> {
    // Get users who have published playbooks, with their view counts aggregated
    const result = await prisma.user.findMany({
      where: { playbooks: { some: { status: 'published' as any } } },
      select: {
        id: true,
        displayName: true,
        avatarUrl: true,
        email: true,
        playbooks: {
          select: {
            id: true,
            _count: { select: { postViews: true } },
          },
          where: { status: 'published' as any },
        },
      },
    });

    // Aggregate total views per user
    const ranked = result
      .map((u: any) => ({
        userId: u.id,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        email: u.email,
        totalViews: u.playbooks.reduce(
          (sum: number, pb: any) => sum + (pb._count?.postViews || 0),
          0
        ),
      }))
      .filter((u: any) => u.totalViews > 0)
      .sort((a: any, b: any) => b.totalViews - a.totalViews)
      .slice(0, limit);

    return ranked.map((u: any, i: number) => ({ ...u, rank: i + 1 }));
  }
}
