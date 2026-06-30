/**
 * Shared TypeScript types for TradeWise platform
 */

export type SubscriptionTier = 'free' | 'pro' | 'prem';

export type PositionDirection = 'long' | 'short';

export interface User {
  id: string;
  email: string;
  subscriptionTier: SubscriptionTier;
  locale: string;
  timezone: string;
}

export interface Trade {
  id: string;
  userId: string;
  batchId?: string;
  tradingSymbol: string;
  positionDirection: PositionDirection;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  entryTimestamp: Date;
  exitTimestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Batch {
  id: string;
  userId: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}
