import { Request, Response } from 'express';
import { ExportService } from '../services/export.service';

export const exportController = {
  async exportTrades(req: Request, res: Response) {
    const { format = 'csv' } = req.query;
    const result = await ExportService.exportTrades((req as any).user!.id, {
      format: format as any,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
    });
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('Content-Type', result.mimeType);
    res.send(result.data);
  },
};
