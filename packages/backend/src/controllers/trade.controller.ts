import { Request, Response, NextFunction } from 'express';
import { tradeService } from '../services/trade.service';
import { CreateTradeDto, UpdateTradeDto, TradeQueryDto, BatchDeleteTradesDto, BatchUpdateLeverageDto } from '../validators/trade.validator';

export class TradeController {
  /**
   * Create a new trade
   * POST /v1/trades
   */
  async createTrade(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const tradeData: CreateTradeDto = req.body;

      const trade = await tradeService.createTrade(userId, tradeData);

      res.status(201).json({
        success: true,
        data: trade,
        message: 'Trade created successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all trades for the authenticated user
   * GET /v1/trades
   */
  async getTrades(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      // Query is already validated by middleware
      const query = req.query as unknown as TradeQueryDto;

      const result = await tradeService.getTrades(userId, query);

      res.status(200).json({
        trades: result.trades,
        displayCurrency: result.displayCurrency,
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get a single trade by ID
   * GET /v1/trades/:id
   */
  async getTradeById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const tradeId = req.params.id;

      const trade = await tradeService.getTradeById(userId, tradeId);

      res.status(200).json({
        success: true,
        data: trade,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update a trade
   * PUT /v1/trades/:id
   */
  async updateTrade(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const tradeId = req.params.id;
      const updateData: UpdateTradeDto = req.body;

      const trade = await tradeService.updateTrade(userId, tradeId, updateData);

      res.status(200).json({
        success: true,
        data: trade,
        message: 'Trade updated successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a trade
   * DELETE /v1/trades/:id
   */
  async deleteTrade(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const tradeId = req.params.id;

      await tradeService.deleteTrade(userId, tradeId);

      res.status(200).json({
        success: true,
        message: 'Trade deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Batch update leverage
   * PATCH /v1/trades/batch-leverage (body: { ids: string[], leverage: number })
   */
  async batchUpdateLeverage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { ids, leverage }: BatchUpdateLeverageDto = req.body;

      const result = await tradeService.batchUpdateLeverage(userId, ids, leverage);

      res.status(200).json({
        success: true,
        message: `${result.updated} trades leverage updated to ${leverage}x`,
        data: { updated: result.updated },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Batch delete trades
   * DELETE /v1/trades (body: { ids: string[] })
   */
  async batchDeleteTrades(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { ids }: BatchDeleteTradesDto = req.body;

      const result = await tradeService.batchDeleteTrades(userId, ids);

      res.status(200).json({
        success: true,
        message: `${result.deleted} trades deleted successfully`,
        data: { deleted: result.deleted },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const tradeController = new TradeController();
