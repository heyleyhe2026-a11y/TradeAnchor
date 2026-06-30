-- TradeWise signup attribution queries (run on production Postgres)

-- All users with signup source
SELECT
  email,
  provider,
  signup_channel,
  signup_utm_source,
  signup_utm_medium,
  signup_utm_campaign,
  signup_landing_page,
  signup_referrer,
  created_at
FROM users
ORDER BY created_at DESC;

-- Count by channel
SELECT signup_channel, COUNT(*) AS users
FROM users
GROUP BY signup_channel
ORDER BY users DESC;

-- Count by UTM source
SELECT signup_utm_source, COUNT(*) AS users
FROM users
WHERE signup_utm_source IS NOT NULL
GROUP BY signup_utm_source
ORDER BY users DESC;
