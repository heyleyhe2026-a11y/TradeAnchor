import { Router } from 'express';
import { tradeController } from '../controllers/trade.controller';
import { importController } from '../controllers/import.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  createTradeSchema,
  updateTradeSchema,
  queryTradesSchema,
  batchDeleteTradesSchema,
  batchUpdateLeverageSchema,
} from '../validators/trade.validator';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const router: any = Router();

// All trade routes require authentication
router.use(authenticate);

/**
 * @route   POST /v1/trades/import
 * @desc    Batch import trades from CSV/Excel
 * @access  Private
 */
router.post('/import', importController.importTrades.bind(importController));

/**
 * @route   POST /v1/trades
 * @desc    Create a new trade
 * @access  Private
 */
router.post('/', validate(createTradeSchema), tradeController.createTrade.bind(tradeController));

/**
 * @route   GET /v1/trades
 * @desc    Get all trades with filtering and pagination
 * @access  Private
 */
router.get(
  '/',
  validate(queryTradesSchema, 'query'),
  tradeController.getTrades.bind(tradeController)
);

/**
 * @route   GET /v1/trades/:id
 * @desc    Get a single trade by ID
 * @access  Private
 */
router.get('/:id', tradeController.getTradeById.bind(tradeController));

/**
 * @route   PUT /v1/trades/:id
 * @desc    Update a trade
 * @access  Private
 */
router.put(
  '/:id',
  validate(updateTradeSchema),
  tradeController.updateTrade.bind(tradeController)
);

/**
 * @route   PATCH /v1/trades/batch-leverage
 * @desc    Batch update leverage for selected trades
 * @access  Private
 */
router.patch(
  '/batch-leverage',
  validate(batchUpdateLeverageSchema),
  tradeController.batchUpdateLeverage.bind(tradeController)
);

/**
 * @route   DELETE /v1/trades
 * @desc    Batch delete trades
 * @access  Private
 */
router.delete(
  '/',
  validate(batchDeleteTradesSchema),
  tradeController.batchDeleteTrades.bind(tradeController)
);

/**
 * @route   DELETE /v1/trades/:id
 * @desc    Delete a trade
 * @access  Private
 */
router.delete('/:id', tradeController.deleteTrade.bind(tradeController));

export default router;
