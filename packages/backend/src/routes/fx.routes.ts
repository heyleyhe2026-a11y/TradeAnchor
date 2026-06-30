import { Router } from 'express';
import { FxService } from '../services/fx.service';
import { authenticate } from '../middleware/auth.middleware';

const router: Router = Router();

/**
 * GET /api/v1/fx/rate?from=EUR&to=USD&date=2024-01-15
 */
router.get('/rate', authenticate, async (req, res, next) => {
  try {
    const from = String(req.query.from ?? '').toUpperCase();
    const to = String(req.query.to ?? '').toUpperCase();
    const dateStr = String(req.query.date ?? new Date().toISOString().slice(0, 10));

    if (from.length !== 3 || to.length !== 3) {
      res.status(400).json({ success: false, message: 'from and to must be 3-letter currency codes' });
      return;
    }

    const rateDate = new Date(dateStr);
    const amount = await FxService.convert(1, from, to, rateDate);

    res.json({
      success: true,
      data: { from, to, date: dateStr, rate: amount },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
