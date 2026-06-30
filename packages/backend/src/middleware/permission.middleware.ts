import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';

export type SubscriptionTier = 'free' | 'pro' | 'prem';

/**
 * Require specific subscription tier
 */
export function requireTier(...allowedTiers: SubscriptionTier[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Unauthorized',
          message: 'Authentication required',
        });
        return;
      }

      const userTier = req.user.tier as SubscriptionTier;

      if (!allowedTiers.includes(userTier)) {
        const requiredTier = allowedTiers[allowedTiers.length - 1]; // Get highest tier
        res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: `This feature requires ${requiredTier.toUpperCase()} subscription`,
          upgradeRequired: true,
          currentTier: userTier,
          requiredTier,
        });
        return;
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Permission check failed',
      });
    }
  };
}

/**
 * Check trade limit for Free tier users
 */
export async function checkTradeLimit(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    // Only check for Free tier users
    if (req.user.tier !== 'free') {
      next();
      return;
    }

    // Count user's trades
    const tradeCount = await prisma.trade.count({
      where: { userId: req.user.id },
    });

    const FREE_TIER_TRADE_LIMIT = 500;

    if (tradeCount >= FREE_TIER_TRADE_LIMIT) {
      res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: `Free tier limit reached. You have ${tradeCount}/${FREE_TIER_TRADE_LIMIT} trades. Upgrade to Pro for unlimited trades.`,
        upgradeRequired: true,
        currentTier: 'free',
        requiredTier: 'pro',
        limit: FREE_TIER_TRADE_LIMIT,
        current: tradeCount,
      });
      return;
    }

    next();
  } catch (error) {
    console.error('Trade limit check error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Limit check failed',
    });
  }
}

/**
 * Check AI report limit — tier-based: free=5/month, pro=50/month, prem=100/month
 */
export async function checkAIReportLimit(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    const tier = req.user.tier as SubscriptionTier;

    // Tier-based limits
    const TIER_REPORT_LIMITS: Record<SubscriptionTier, number> = {
      free: 5,
      pro: 50,
      prem: 100,
    };
    const maxReports = TIER_REPORT_LIMITS[tier];

    // Count user's AI reports (from MongoDB)
    // TODO: Query MongoDB for current month report count
    const reportCount = 0; // TODO: Query MongoDB

    if (reportCount >= maxReports) {
      res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: `${tier === 'free' ? 'Free' : tier === 'pro' ? 'Pro' : 'Premium'} tier limit reached. You have ${reportCount}/${maxReports} AI reports this month.`,
        upgradeRequired: tier !== 'prem',
        currentTier: tier,
        requiredTier: 'prem',
        limit: maxReports,
        current: reportCount,
      });
      return;
    }

    next();
  } catch (error) {
    console.error('AI report limit check error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Limit check failed',
    });
  }
}

/**
 * Check AI follow-up question limit — tier-based: free=5/month, pro=50/month, prem=100/month
 */
export async function checkAIQuestionLimit(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    const tier = req.user.tier as SubscriptionTier;

    // Tier-based limits
    const TIER_QUESTION_LIMITS: Record<SubscriptionTier, number> = {
      free: 0,
      pro: 50,
      prem: 100,
    };
    const maxQuestions = TIER_QUESTION_LIMITS[tier];

    // This will be implemented when we add AI question functionality
    // For now, we'll use a placeholder
    const questionCount = 0; // TODO: Query MongoDB for current month

    if (questionCount >= maxQuestions) {
      res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: `Monthly limit reached. You have used ${questionCount}/${maxQuestions} AI questions this month.`,
        limit: maxQuestions,
        current: questionCount,
        resetDate: getNextMonthStart(),
      });
      return;
    }

    next();
  } catch (error) {
    console.error('AI question limit check error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Limit check failed',
    });
  }
}

/**
 * Check if user can publish playbooks (Prem only)
 */
export async function checkPlaybookPublishPermission(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Authentication required',
      });
      return;
    }

    if (req.user.tier !== 'prem') {
      res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Publishing playbooks requires Premium subscription',
        upgradeRequired: true,
        currentTier: req.user.tier,
        requiredTier: 'prem',
      });
      return;
    }

    next();
  } catch (error) {
    console.error('Playbook publish permission check error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal Server Error',
      message: 'Permission check failed',
    });
  }
}

/**
 * Helper function to get next month start date
 */
function getNextMonthStart(): string {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return nextMonth.toISOString();
}
