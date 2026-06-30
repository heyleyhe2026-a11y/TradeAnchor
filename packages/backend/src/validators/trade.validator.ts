import { z } from 'zod';

/** Broker CSVs (MT4/MT5/cTrader) often show commission as negative debits — store as positive cost. */
const commissionField = z
  .number()
  .finite('Commission must be a finite number')
  .optional()
  .transform((v) => (v === undefined ? undefined : Math.abs(v)));

/**
 * Swap: broker exports usually show overnight cost as negative — store as positive fee.
 * netPnL = gross − commission − swap (same convention as commission).
 */
const swapField = z
  .number()
  .finite('Swap must be a finite number')
  .optional()
  .transform((v) => (v === undefined ? undefined : Math.abs(v)));

const tradeExtensionFields = {
  swap: swapField,
  quoteCurrency: z
    .string()
    .length(3, 'Currency must be a 3-letter ISO code')
    .toUpperCase()
    .optional(),
  pnlSource: z.enum(['calculated', 'broker']).optional(),
  importSource: z.string().max(32).optional(),
  sourceTimezone: z.string().max(64).optional(),
  externalTicketId: z.string().max(128).optional(),
  importBatchId: z.string().uuid().optional(),
};

/**
 * Trade creation validation schema
 */
export const createTradeSchema = z.object({
  tradingSymbol: z
    .string()
    .min(1, 'Trading symbol is required')
    .max(20, 'Trading symbol must not exceed 20 characters')
    .toUpperCase()
    .trim(),
  positionDirection: z.enum(['long', 'short'], {
    message: 'Position direction must be either "long" or "short"',
  }),
  entryPrice: z
    .number()
    .positive('Entry price must be positive')
    .finite('Entry price must be a finite number'),
  exitPrice: z
    .number()
    .positive('Exit price must be positive')
    .finite('Exit price must be a finite number')
    .optional(),
  quantity: z
    .number()
    .positive('Quantity must be positive')
    .finite('Quantity must be a finite number'),
  leverage: z
    .number()
    .int('Leverage must be an integer')
    .positive('Leverage must be positive')
    .default(1)
    .optional(),
  pnl: z
    .number()
    .finite('PnL must be a finite number')
    .optional(),
  commission: commissionField,
  ...tradeExtensionFields,
  entryTimestamp: z
    .string()
    .datetime('Invalid entry timestamp format')
    .refine((date) => {
      const d = new Date(date);
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      return d >= oneYearAgo;
    }, {
      message: 'Entry timestamp cannot be more than 1 year ago',
    }),
  exitTimestamp: z
    .string()
    .datetime('Invalid exit timestamp format')
    .refine((date) => {
      if (!date) return true;
      const d = new Date(date);
      const oneYearFromNow = new Date();
      oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
      return d <= oneYearFromNow;
    }, {
      message: 'Exit timestamp cannot be more than 1 year in the future',
    })
    .optional(),
}).refine(
  (data) => !data.exitTimestamp || new Date(data.exitTimestamp) > new Date(data.entryTimestamp),
  {
    message: 'Exit timestamp must be after entry timestamp',
    path: ['exitTimestamp'],
  }
);

/**
 * Trade update validation schema
 */
export const updateTradeSchema = z.object({
  tradingSymbol: z
    .string()
    .min(1, 'Trading symbol is required')
    .max(20, 'Trading symbol must not exceed 20 characters')
    .toUpperCase()
    .trim()
    .optional(),
  positionDirection: z
    .enum(['long', 'short'])
    .optional(),
  entryPrice: z
    .number()
    .positive('Entry price must be positive')
    .finite('Entry price must be a finite number')
    .optional(),
  exitPrice: z
    .number()
    .positive('Exit price must be positive')
    .finite('Exit price must be a finite number')
    .optional(),
  quantity: z
    .number()
    .positive('Quantity must be positive')
    .finite('Quantity must be a finite number')
    .optional(),
  leverage: z
    .number()
    .int('Leverage must be an integer')
    .positive('Leverage must be positive')
    .optional(),
  pnl: z
    .number()
    .finite('PnL must be a finite number')
    .optional(),
  commission: commissionField,
  ...tradeExtensionFields,
  forceRecalculatePnl: z.boolean().optional(),
  entryTimestamp: z
    .string()
    .datetime('Invalid entry timestamp format')
    .optional(),
  exitTimestamp: z
    .string()
    .datetime('Invalid exit timestamp format')
    .optional(),
});

/**
 * Trade query validation schema
 */
export const queryTradesSchema = z.object({
  symbol: z
    .string()
    .max(20)
    .toUpperCase()
    .optional(),
  direction: z
    .enum(['long', 'short'])
    .optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid start date format (YYYY-MM-DD)')
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid end date format (YYYY-MM-DD)')
    .optional(),
  minPnL: z
    .string()
    .transform((val) => parseFloat(val))
    .pipe(z.number().finite())
    .optional(),
  maxPnL: z
    .string()
    .transform((val) => parseFloat(val))
    .pipe(z.number().finite())
    .optional(),
  page: z
    .string()
    .default('1')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),
  limit: z
    .string()
    .default('20')
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive().max(500)),
  sort: z
    .enum(['date', 'pnl', 'symbol'])
    .default('date'),
  order: z
    .enum(['asc', 'desc'])
    .default('desc'),
});

export type CreateTradeInput = z.infer<typeof createTradeSchema>;
export type UpdateTradeInput = z.infer<typeof updateTradeSchema>;
export type QueryTradesInput = z.infer<typeof queryTradesSchema>;

// Export as DTOs for controller usage
export type CreateTradeDto = CreateTradeInput;
export type UpdateTradeDto = UpdateTradeInput;
export type TradeQueryDto = QueryTradesInput;

/**
 * Batch delete trades validation schema
 */
export const batchDeleteTradesSchema = z.object({
  ids: z
    .array(z.string().uuid())
    .min(1, 'At least one trade ID is required')
    .max(100, 'Cannot delete more than 100 trades at once'),
});

export type BatchDeleteTradesDto = z.infer<typeof batchDeleteTradesSchema>;

/**
 * Batch update leverage validation schema
 */
export const batchUpdateLeverageSchema = z.object({
  ids: z
    .array(z.string().uuid())
    .min(1, 'At least one trade ID is required')
    .max(100, 'Cannot update more than 100 trades at once'),
  leverage: z
    .number()
    .int('Leverage must be an integer')
    .positive('Leverage must be positive'),
});

export type BatchUpdateLeverageDto = z.infer<typeof batchUpdateLeverageSchema>;

/** Batch import body (Phase 1+) */
export const importTradesSchema = z.object({
  importSource: z.string().max(32).optional(),
  sourceTimezone: z.string().max(64).optional(),
  defaultQuoteCurrency: z.string().length(3).toUpperCase().optional(),
  trades: z.array(createTradeSchema).min(1).max(500),
});

export type ImportTradesDto = z.infer<typeof importTradesSchema>;
