import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { tradeService } from '../services/trade.service';
import { TaskService } from '../services/task.service';
import { notificationService } from '../services/notification.service';
import { importTradesSchema } from '../validators/trade.validator';
import logger from '../lib/logger';

export class ImportController {
  /**
   * Batch import trades from CSV/Excel
   * POST /v1/trades/import
   */
  async importTrades(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const parsed = importTradesSchema.safeParse(req.body);

      if (!parsed.success) {
        res.status(400).json({
          success: false,
          message: parsed.error.issues[0]?.message ?? 'Invalid import payload',
        });
        return;
      }

      const { trades, importSource, sourceTimezone, defaultQuoteCurrency } = parsed.data;
      const importBatchId = randomUUID();
      let imported = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (let i = 0; i < trades.length; i++) {
        const item = trades[i];

        try {
          const payload = {
            ...item,
            quoteCurrency: item.quoteCurrency ?? defaultQuoteCurrency,
            pnlSource: item.pnlSource ?? (item.pnl !== undefined ? ('broker' as const) : undefined),
            importSource: item.importSource ?? importSource,
            sourceTimezone: item.sourceTimezone ?? sourceTimezone,
            importBatchId,
          };

          await tradeService.createTrade(userId, payload, { skipNotification: true });
          imported++;
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          if (message.startsWith('Duplicate ticket')) {
            skipped++;
            errors.push(`Row ${i + 1}: ${message}`);
          } else {
            errors.push(`Row ${i + 1}: ${message}`);
          }
        }
      }

      logger.info(`Trades imported`, { userId, imported, skipped, failed: errors.length - skipped, importBatchId });

      if (imported > 0) {
        try {
          await TaskService.recordEvent(userId, 'first_trade', imported);
          await TaskService.recordEvent(userId, 'trade_count_10', imported);
          await TaskService.recordEvent(userId, 'import_trades', 1);
        } catch {
          // Non-critical
        }

        try {
          await notificationService.notifyImportComplete(userId, imported, errors.length);
        } catch {
          // Non-critical
        }
      }

      res.status(200).json({
        success: true,
        data: {
          imported,
          skipped,
          failed: errors.length - skipped,
          importBatchId,
          errors,
        },
        message: `Imported ${imported} trades`,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const importController = new ImportController();
