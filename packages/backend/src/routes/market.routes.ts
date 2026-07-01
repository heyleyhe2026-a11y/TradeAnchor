import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { marketController } from '../controllers/market.controller';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const router: any = Router();
router.use(authenticate);

router.get('/symbols', marketController.getSymbols.bind(marketController));
router.get('/search', marketController.searchSymbols.bind(marketController));
router.get('/quote', marketController.getQuote.bind(marketController));
router.get('/candles', marketController.getCandles.bind(marketController));

export default router;
