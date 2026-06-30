import { AppError } from '../utils/app-error';
import { prisma } from '../lib/prisma';

export class ExportService {
  static async exportTrades(userId: string, query: {
    format: 'csv' | 'json';
    startDate?: string; endDate?: string; fields?: string[];
  }) {
    if (!['csv', 'json'].includes(query.format)) throw new AppError(400, 'Format must be csv or json');

    const where: Record<string, any> = { userId };
    if (query.startDate || query.endDate) where.entryTimestamp = {
      ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
      ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
    };

    const trades = await prisma.trade.findMany({
      where,
      orderBy: { entryTimestamp: 'desc' },
      take: 1000,
    });

    if (query.format === 'csv') {
      const headers = ['ID', 'Symbol', 'Direction', 'Entry Price', 'Exit Price', 'Quantity', 'PnL', 'Entry Time', 'Exit Time'];
      const rows = trades.map((t: any) => [
        t.id, t.tradingSymbol, t.positionDirection, String(t.entryPrice), String(t.exitPrice || ''),
        String(t.quantity), String(t.pnl || ''), t.entryTimestamp.toISOString(), t.exitTimestamp?.toISOString() || '',
      ]);
      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      return { data: csv, filename: `trades-export-${Date.now()}.csv`, mimeType: 'text/csv' };
    }

    return { data: JSON.stringify(trades, null, 2), filename: `trades-export-${Date.now()}.json`, mimeType: 'application/json' };
  }
}
