-- Add Creem as a payment method option
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'creem';
