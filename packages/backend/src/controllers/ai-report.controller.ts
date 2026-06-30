import { Request, Response, NextFunction } from 'express';
import { aiReportService } from '../services/ai-report.service';
import { isModelAvailable, getAvailableModels, type AIModel } from '../services/ai-provider.service';
import { CreditService } from '../services/credit.service';

export class AiReportController {
  /**
   * GET /v1/ai/models - List available AI models
   */
  async listModels(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const models = getAvailableModels();
      res.status(200).json({
        success: true,
        data: models.map(m => ({
          id: m.id,
          displayName: m.displayName,
          provider: m.provider,
          available: isModelAvailable(m.id),
        })),
      });
    } catch (error) { next(error); }
  }

  /**
   * POST /v1/ai/reports - Generate report (8.2)
   * Two-phase credit payment: if subscription quota exhausted, requires user confirmation before deducting credits.
   */
  async generateReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { aiModel, locale, tradeIds, filters, confirmCreditPayment, reportType, assetCategory } = req.body;
      const model: AIModel = aiModel || 'gpt-4o';

      if (!isModelAvailable(model)) {
        const available = getAvailableModels()
          .filter(m => isModelAvailable(m.id))
          .map(m => m.displayName)
          .join(', ');

        res.status(400).json({
          success: false,
          message: `Model ${model} is not available or not configured. Available models: ${available || 'none'}`,
        });
        return;
      }

      // Check quota (8.4) — if no subscription quota left, require credit payment with confirmation
      const quota = await aiReportService.checkReportQuota(req.user!.id);
      let paidWithCredits = false;
      if (!quota.allowed) {
        if (!confirmCreditPayment) {
          // Phase 1: Tell frontend to show confirmation dialog (don't deduct yet)
          res.status(402).json({
            success: false,
            code: 'CREDIT_PAYMENT_REQUIRED',
            message: `Report limit reached (${quota.used}/${quota.limit}). Confirm to use 100 credits.`,
            creditCost: 100,
            quota,
          });
          return;
        }
        // Phase 2: User confirmed → actually deduct credits
        try {
          await CreditService.spendCredits(req.user!.id, 100, '生成AI报告消耗-100积分|||AI Report Generated -100 credits');
          paidWithCredits = true; // flag: user already paid, do NOT award task credits
        } catch {
          res.status(402).json({
            success: false,
            code: 'INSUFFICIENT_CREDITS',
            message: `Report limit reached (${quota.used}/${quota.limit}). Insufficient credits. Top up or upgrade your plan.`,
            creditCost: 100,
            quota,
          });
          return;
        }
      }

      const report = await aiReportService.generateReport(req.user!.id, {
        aiModel: aiModel as any,
        locale,
        tradeIds,
        filters,
        reportType,
        assetCategory,
      }, { skipCreditAward: paidWithCredits });
      res.status(202).json({ success:true, data: report, message:'Report generation started' });
    } catch (error) { next(error); }
  }

  /**
   * GET /v1/ai/reports/:id - Get report by ID (8.3)
   */
  async getReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const report = await aiReportService.getReportById(req.user!.id, req.params.id);
      res.status(200).json({ success:true, data: report });
    } catch (error) { next(error); }
  }

  /**
   * GET /v1/ai/reports - List reports (8.3)
   */
  async listReports(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(String(req.query.page)||'1', 10);
      const limit = parseInt(String(req.query.limit)||'10', 10);
      const result = await aiReportService.listReports(req.user!.id, page, Math.min(limit,50));
      res.status(200).json({ success:true, ...result });
    } catch (error) { next(error); }
  }
}

export const aiReportController = new AiReportController();
