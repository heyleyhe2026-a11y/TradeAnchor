import { prisma } from '../lib/prisma';
import { CreateTradeDto, UpdateTradeDto, TradeQueryDto } from '../validators/trade.validator';
import { Prisma, PnlSource } from '../generated/prisma';
import { TaskService } from './task.service';
import { PreferencesService } from './preferences.service';
import { getTradeNetPnL, getTradeInvestment } from '@tradeanchor/shared';
import { toTradeRoiInput } from '../utils/trade-roi-mapper';
import { convertTradeForDisplay } from '../utils/roi-fx.helper';

export class TradeService {
  /**
   * Calculate P&L for a trade
   * @param direction - Position direction (long or short)
   * @param entryPrice - Entry price
   * @param exitPrice - Exit price
   * @param quantity - Quantity
   * @returns Calculated P&L
   */
  private calculatePnL(
    direction: 'long' | 'short',
    entryPrice: number,
    exitPrice: number,
    quantity: number
  ): number {
    if (direction === 'long') {
      // Long: PnL = (Exit Price - Entry Price) * Quantity
      return (exitPrice - entryPrice) * quantity;
    } else {
      // Short: PnL = (Entry Price - Exit Price) * Quantity
      return (entryPrice - exitPrice) * quantity;
    }
  }

  /**
   * Check subscription tier limits for trades
   * @param userId - User ID
   * @throws Error if user exceeds trade limit
   */
  private async checkTradeLimit(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        subscriptions: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Get active subscription
    const activeSubscription = user.subscriptions.find(
      (sub) => sub.status === 'active'
    );

    // Free tier: max 500 trades
    if (activeSubscription?.tier === 'free') {
      const tradeCount = await prisma.trade.count({
        where: { userId },
      });

      if (tradeCount >= 500) {
        throw new Error(
          'Trade limit reached. Upgrade to Pro or Premium for unlimited trades.'
        );
      }
    }
  }

  /**
   * Create a new trade
   * @param userId - User ID
   * @param data - Trade data
   * @param options - Optional settings (e.g., skipNotification for imports)
   * @returns Created trade
   */
  async createTrade(userId: string, data: CreateTradeDto, options?: { skipNotification?: boolean }) {
    // Check subscription limits
    await this.checkTradeLimit(userId);

    const prefs = await PreferencesService.get(userId);
    const quoteCurrency = (data.quoteCurrency ?? prefs.baseCurrency ?? 'USD').toUpperCase();

    let pnl: number | undefined = data.pnl !== undefined ? Number(data.pnl) : undefined;
    let pnlSource: PnlSource = data.pnlSource ?? 'calculated';

    if (pnl !== undefined && data.pnlSource === undefined) {
      pnlSource = 'broker';
    } else if (pnl === undefined && data.exitPrice) {
      pnl = this.calculatePnL(
        data.positionDirection,
        data.entryPrice,
        data.exitPrice,
        data.quantity,
      );
      pnlSource = 'calculated';
    }

    // Dedup imported trades when ticket id is provided
    if (data.externalTicketId && data.importSource) {
      const dup = await prisma.trade.findFirst({
        where: {
          userId,
          importSource: data.importSource,
          externalTicketId: data.externalTicketId,
        },
      });
      if (dup) {
        throw new Error(`Duplicate ticket ${data.externalTicketId}`);
      }
    }

    // Create trade
    const trade = await prisma.trade.create({
      data: {
        userId,
        tradingSymbol: data.tradingSymbol,
        positionDirection: data.positionDirection,
        entryPrice: data.entryPrice,
        ...(data.exitPrice !== undefined && { exitPrice: data.exitPrice }),
        quantity: data.quantity,
        leverage: Number(data.leverage ?? 1),
        quoteCurrency,
        ...(pnl !== undefined && { pnl }),
        ...(data.commission !== undefined && { commission: Number(data.commission) }),
        ...(data.swap !== undefined && { swap: Number(data.swap) }),
        pnlSource,
        ...(data.importSource && { importSource: data.importSource }),
        ...(data.sourceTimezone && { sourceTimezone: data.sourceTimezone }),
        ...(data.externalTicketId && { externalTicketId: data.externalTicketId }),
        ...(data.importBatchId && { importBatchId: data.importBatchId }),
        entryTimestamp: new Date(data.entryTimestamp),
        ...(data.exitTimestamp && { exitTimestamp: new Date(data.exitTimestamp) }),
      },
    });

    // Record task event for first_trade and trade_count tasks (fire-and-forget)
    try {
      await TaskService.recordEvent(userId, 'first_trade', 1);
      await TaskService.recordEvent(userId, 'trade_count_10', 1);
    } catch {
      // Non-critical: task recording should not block trade creation
    }

    if (pnl !== undefined && pnl > 0) {
      // No-op: profit notifications disabled
    }

    return this.serializeTrade(trade);
  }

  private serializeTrade(trade: Record<string, unknown>) {
    const plain = JSON.parse(JSON.stringify(trade));
    const input = toTradeRoiInput(plain);
    return {
      ...plain,
      netPnl: getTradeNetPnL(input),
      investment: getTradeInvestment(input),
    };
  }

  private async serializeTradeForDisplay(
    trade: Record<string, unknown>,
    displayCurrency: string,
  ) {
    const plain = JSON.parse(JSON.stringify(trade));
    const converted = await convertTradeForDisplay(
      plain as Parameters<typeof convertTradeForDisplay>[0],
      displayCurrency,
    );
    return {
      ...plain,
      entryPrice: converted.entryPrice,
      exitPrice: converted.exitPrice,
      pnl: converted.pnl,
      commission: converted.commission,
      swap: converted.swap,
      netPnl: converted.netPnl,
      investment: converted.investment,
      displayCurrency: converted.displayCurrency,
    };
  }

  /**
   * Get trades with filtering, sorting, and pagination
   * @param userId - User ID
   * @param query - Query parameters
   * @returns Paginated trades
   */
  async getTrades(userId: string, query: TradeQueryDto) {
    const {
      symbol,
      direction,
      startDate,
      endDate,
      minPnL,
      maxPnL,
      page,
      limit,
      sort,
      order,
    } = query;

    // Build where clause
    const where: Prisma.TradeWhereInput = {
      userId,
      ...(symbol && { tradingSymbol: { contains: symbol, mode: 'insensitive' } }),
      ...(direction && { positionDirection: direction }),
      ...(startDate && { entryTimestamp: { gte: new Date(startDate) } }),
      ...(endDate && { exitTimestamp: { lte: new Date(endDate) } }),
      ...(minPnL !== undefined && { pnl: { gte: minPnL } }),
      ...(maxPnL !== undefined && { pnl: { lte: maxPnL } }),
    };

    // Build orderBy clause
    let orderBy: Prisma.TradeOrderByWithRelationInput = {};
    switch (sort) {
      case 'date':
        orderBy = { entryTimestamp: order };
        break;
      case 'pnl':
        orderBy = { pnl: order };
        break;
      case 'symbol':
        orderBy = { tradingSymbol: order };
        break;
      default:
        orderBy = { entryTimestamp: 'desc' };
    }

    // Get total count
    const total = await prisma.trade.count({ where });

    // Get paginated trades
    const trades = await prisma.trade.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    });

    const prefs = await PreferencesService.get(userId);
    const displayCurrency = (prefs.baseCurrency ?? 'USD').toUpperCase();
    const serializedTrades = await Promise.all(
      trades.map((t) => this.serializeTradeForDisplay(t as Record<string, unknown>, displayCurrency)),
    );

    return {
      trades: serializedTrades,
      displayCurrency,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get a single trade by ID
   * @param userId - User ID
   * @param tradeId - Trade ID
   * @returns Trade
   */
  async getTradeById(userId: string, tradeId: string) {
    const trade = await prisma.trade.findFirst({
      where: {
        id: tradeId,
        userId,
      },
    });

    if (!trade) {
      throw new Error('Trade not found');
    }

    // Serialize Prisma Decimal fields to plain numbers
    return this.serializeTrade(trade as Record<string, unknown>);
  }

  /**
   * Update a trade
   * @param userId - User ID
   * @param tradeId - Trade ID
   * @param data - Update data
   * @returns Updated trade
   */
  async updateTrade(userId: string, tradeId: string, data: UpdateTradeDto) {
    const existingTrade = await this.getTradeById(userId, tradeId);

    const priceFieldsChanged =
      data.entryPrice !== undefined ||
      data.exitPrice !== undefined ||
      data.quantity !== undefined ||
      data.positionDirection !== undefined;

    let pnl: number | null | undefined = existingTrade.pnl;
    const currentSource = (existingTrade.pnlSource as string) ?? 'calculated';
    const forceRecalc = data.forceRecalculatePnl === true;

    if (data.pnl !== undefined) {
      pnl = data.pnl;
    } else if (priceFieldsChanged && (currentSource !== 'broker' || forceRecalc)) {
      const exitPrice = data.exitPrice ?? existingTrade.exitPrice;
      if (exitPrice != null) {
        pnl = this.calculatePnL(
          (data.positionDirection ?? existingTrade.positionDirection) as 'long' | 'short',
          Number(data.entryPrice ?? existingTrade.entryPrice),
          Number(exitPrice),
          Number(data.quantity ?? existingTrade.quantity),
        );
      }
    }

    let pnlSource: PnlSource | undefined;
    if (data.pnlSource !== undefined) {
      pnlSource = data.pnlSource;
    } else if (data.pnl !== undefined) {
      pnlSource = 'broker';
    } else if (priceFieldsChanged && forceRecalc) {
      pnlSource = 'calculated';
    }

    const trade = await prisma.trade.update({
      where: { id: tradeId },
      data: {
        ...(data.tradingSymbol && { tradingSymbol: data.tradingSymbol }),
        ...(data.positionDirection && { positionDirection: data.positionDirection }),
        ...(data.entryPrice !== undefined && { entryPrice: data.entryPrice }),
        ...(data.exitPrice !== undefined && { exitPrice: data.exitPrice }),
        ...(data.quantity !== undefined && { quantity: data.quantity }),
        ...(data.leverage !== undefined && { leverage: data.leverage }),
        ...(data.commission !== undefined && { commission: data.commission }),
        ...(data.swap !== undefined && { swap: data.swap }),
        ...(data.quoteCurrency !== undefined && { quoteCurrency: data.quoteCurrency.toUpperCase() }),
        ...(pnlSource !== undefined && { pnlSource }),
        ...(data.entryTimestamp && { entryTimestamp: new Date(data.entryTimestamp) }),
        ...(data.exitTimestamp && { exitTimestamp: new Date(data.exitTimestamp) }),
        ...(pnl !== undefined && { pnl }),
      },
    });

    if (pnl !== undefined && Number(pnl) > 0) {
      // No-op: profit notifications disabled
    }

    return this.serializeTrade(trade as Record<string, unknown>);
  }

  /**
   * Delete a trade
   * @param userId - User ID
   * @param tradeId - Trade ID
   */
  async deleteTrade(userId: string, tradeId: string): Promise<void> {
    // Check if trade exists and belongs to user
    await this.getTradeById(userId, tradeId);

    // Delete trade
    await prisma.trade.delete({
      where: { id: tradeId },
    });
  }

  /**
   * Batch update leverage for selected trades
   * @param userId - User ID
   * @param ids - Array of trade IDs
   * @param leverage - New leverage value
   */
  async batchUpdateLeverage(userId: string, ids: string[], leverage: number): Promise<{ updated: number }> {
    // Verify all trades belong to current user
    const trades = await prisma.trade.findMany({
      where: { id: { in: ids } },
      select: { id: true, userId: true },
    });

    const ownedIds = trades.filter((t) => t.userId === userId).map((t) => t.id);
    if (ownedIds.length !== ids.length) {
      throw new Error('One or more trades not found or do not belong to you');
    }

    // Batch update leverage
    const result = await prisma.trade.updateMany({
      where: { id: { in: ids }, userId },
      data: { leverage },
    });

    return { updated: result.count };
  }

  /**
   * Batch delete trades
   * @param userId - User ID
   * @param ids - Array of trade IDs
   */
  async batchDeleteTrades(userId: string, ids: string[]): Promise<{ deleted: number }> {
    // Verify all trades belong to current user
    const trades = await prisma.trade.findMany({
      where: { id: { in: ids } },
      select: { id: true, userId: true },
    });

    const ownedIds = trades.filter((t) => t.userId === userId).map((t) => t.id);
    if (ownedIds.length !== ids.length) {
      throw new Error('One or more trades not found or do not belong to you');
    }

    // Batch delete
    const result = await prisma.trade.deleteMany({
      where: { id: { in: ids }, userId },
    });

    return { deleted: result.count };
  }

  /**
   * Get trade statistics
   * @param userId - User ID
   * @returns Trade statistics
   */
  async getTradeStats(userId: string) {
    const where: Prisma.TradeWhereInput = {
      userId,
    };

    const trades = await prisma.trade.findMany({ where });

    const total = trades.length;
    const winning = trades.filter((t) => Number(t.pnl || 0) > 0).length;
    const losing = trades.filter((t) => Number(t.pnl || 0) < 0).length;
    const winRate = total > 0 ? (winning / total) * 100 : 0;
    const totalPnL = trades.reduce((sum, t) => sum + Number(t.pnl || 0), 0);
    const avgPnL = total > 0 ? totalPnL / total : 0;

    return {
      total,
      winning,
      losing,
      winRate,
      totalPnL,
      avgPnL,
    };
  }
}

export const tradeService = new TradeService();
