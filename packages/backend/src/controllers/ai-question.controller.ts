import { Request, Response, NextFunction } from 'express';
import { aiQuestionService } from '../services/ai-question.service';
import { CreditService } from '../services/credit.service';

export class AiQuestionController {
  /**
   * POST /v1/ai/questions - Ask follow-up question (9.1)
   * Two-phase credit payment: if subscription quota exhausted, requires user confirmation before deducting credits.
   */
  async askQuestion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Check quota first — free tier has zero AI follow-up access
      const quota = await aiQuestionService.checkQuota(req.user!.id);

      // Free users: no AI follow-up at all → require upgrade
      if (quota.limit === 0) {
        res.status(403).json({
          success: false,
          code: 'UPGRADE_REQUIRED_FOR_CHAT',
          message: 'AI follow-up requires Pro or Premium plan. Free users can generate reports but cannot ask follow-up questions.',
          quota,
        });
        return;
      }

      // Pro/Prem: quota exhausted → require credit payment with confirmation
      const { confirmCreditPayment } = req.body;
      let paidWithCredits = false;
      if (!quota.allowed) {
        if (!confirmCreditPayment) {
          // Phase 1: Tell frontend to show confirmation dialog (don't deduct yet)
          res.status(402).json({
            success: false,
            code: 'CREDIT_PAYMENT_REQUIRED',
            message: `Follow-up limit reached (${quota.used}/${quota.limit}). Confirm to use 50 credits.`,
            creditCost: 50,
            quota,
          });
          return;
        }
        // Phase 2: User confirmed → actually deduct credits
        try {
          await CreditService.spendCredits(req.user!.id, 50, 'AI追问消耗-50积分|||AI Follow-up -50 credits');
          paidWithCredits = true; // flag: user already paid, do NOT award task credits
        } catch {
          res.status(402).json({
            success: false,
            code: 'INSUFFICIENT_CREDITS',
            message: `Follow-up limit reached (${quota.used}/${quota.limit}). Insufficient credits. Top up or upgrade your plan.`,
            creditCost: 50,
            quota,
          });
          return;
        }
      }
      const result = await aiQuestionService.askQuestion(req.user!.id, req.body, { skipCreditAward: paidWithCredits });
      res.status(200).json({ success: true, data: result });
    } catch (error) { next(error); }
  }

  async listQuestions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(String(req.query.page)||'1',10);
      const limit = parseInt(String(req.query.limit)||'20',10);
      const result = await aiQuestionService.listQuestions(req.user!.id, page, limit);
      res.status(200).json({ success: true, ...result });
    } catch (error) { next(error); }
  }

  async checkQuota(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const quota = await aiQuestionService.checkQuota(req.user!.id);
      res.status(200).json({ success: true, data: quota });
    } catch (error) { next(error); }
  }
}
export const aiQuestionController = new AiQuestionController();
