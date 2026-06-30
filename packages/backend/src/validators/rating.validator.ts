import { z } from 'zod';

export const createRatingSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

export const updateRatingSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().max(1000).optional(),
}).refine(data => data.rating !== undefined || data.comment !== undefined, {
  message: 'At least one of rating or comment must be provided',
});

export type CreateRatingDto = z.infer<typeof createRatingSchema>;
export type UpdateRatingDto = z.infer<typeof updateRatingSchema>;
