import { z } from 'zod';

/** Parse JSON-stringified array fields from FormData (multipart/form-data sends all values as strings) */
const jsonArr = () => z.preprocess((val) => {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try { return JSON.parse(val); }
    catch { return [val]; }
  }
  return [];
}, z.array(z.string()));

export const createPlaybookValidator = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  description: z.string().optional(),
  paidContent: z.string().optional(),
  price: z.preprocess((val) => {
    if (val === '' || val === null || val === undefined) return null;
    const n = Number(val);
    return isNaN(n) ? null : n;
  }, z.number().nullable().optional()),
  tags: jsonArr().optional().default([]),
  tradingSymbols: jsonArr().optional().default([]),
});

export const updatePlaybookValidator = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  content: z.string().min(1).optional(),
  paidContent: z.string().optional(),
  price: z.coerce.number().optional(),
  status: z.enum(['draft', 'pending_review', 'published', 'rejected']).optional(),
  tags: jsonArr().optional(),
  tradingSymbols: jsonArr().optional(),
});
