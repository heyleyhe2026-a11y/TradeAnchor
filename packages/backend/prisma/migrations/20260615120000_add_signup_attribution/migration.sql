-- Signup attribution (UTM, referrer, landing page) for new user tracking
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "signup_channel" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "signup_utm_source" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "signup_utm_medium" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "signup_utm_campaign" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "signup_utm_term" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "signup_utm_content" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "signup_referrer" VARCHAR(500);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "signup_landing_page" VARCHAR(500);

CREATE INDEX IF NOT EXISTS "users_signup_channel_idx" ON "users" ("signup_channel");
CREATE INDEX IF NOT EXISTS "users_signup_utm_source_idx" ON "users" ("signup_utm_source");
