-- Phase 1: Trade currency/import fields, UserPreference calendar/leaderboard, FxRate table

-- CreateEnum
CREATE TYPE "PnlSource" AS ENUM ('calculated', 'broker');

-- AlterTable trades
ALTER TABLE "trades" ADD COLUMN IF NOT EXISTS "quote_currency" VARCHAR(3) NOT NULL DEFAULT 'USD';
ALTER TABLE "trades" ADD COLUMN IF NOT EXISTS "swap" DECIMAL(18,8);
ALTER TABLE "trades" ADD COLUMN IF NOT EXISTS "pnl_source" "PnlSource" NOT NULL DEFAULT 'calculated';
ALTER TABLE "trades" ADD COLUMN IF NOT EXISTS "import_source" TEXT;
ALTER TABLE "trades" ADD COLUMN IF NOT EXISTS "source_timezone" TEXT;
ALTER TABLE "trades" ADD COLUMN IF NOT EXISTS "external_ticket_id" TEXT;
ALTER TABLE "trades" ADD COLUMN IF NOT EXISTS "import_batch_id" TEXT;

-- Backfill existing trades
UPDATE "trades" SET "quote_currency" = 'USD' WHERE "quote_currency" IS NULL;
UPDATE "trades" SET "pnl_source" = 'calculated' WHERE "pnl_source" IS NULL;

-- AlterTable user_preferences
ALTER TABLE "user_preferences" ADD COLUMN IF NOT EXISTS "calendar_day_basis" TEXT NOT NULL DEFAULT 'exit';
ALTER TABLE "user_preferences" ADD COLUMN IF NOT EXISTS "leaderboard_opt_in" BOOLEAN NOT NULL DEFAULT true;

UPDATE "user_preferences" SET "calendar_day_basis" = 'exit' WHERE "calendar_day_basis" IS NULL;
UPDATE "user_preferences" SET "leaderboard_opt_in" = true WHERE "leaderboard_opt_in" IS NULL;

-- CreateTable fx_rates
CREATE TABLE IF NOT EXISTS "fx_rates" (
    "id" TEXT NOT NULL,
    "rate_date" DATE NOT NULL,
    "from_currency" VARCHAR(3) NOT NULL,
    "to_currency" VARCHAR(3) NOT NULL,
    "rate" DECIMAL(18,8) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'ecb',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fx_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "trades_user_id_exit_timestamp_idx" ON "trades"("user_id", "exit_timestamp");
CREATE INDEX IF NOT EXISTS "trades_user_id_quote_currency_idx" ON "trades"("user_id", "quote_currency");
CREATE INDEX IF NOT EXISTS "trades_import_batch_id_idx" ON "trades"("import_batch_id");

CREATE UNIQUE INDEX IF NOT EXISTS "trades_user_id_import_source_external_ticket_id_key"
  ON "trades"("user_id", "import_source", "external_ticket_id");

CREATE UNIQUE INDEX IF NOT EXISTS "fx_rates_rate_date_from_currency_to_currency_key"
  ON "fx_rates"("rate_date", "from_currency", "to_currency");
