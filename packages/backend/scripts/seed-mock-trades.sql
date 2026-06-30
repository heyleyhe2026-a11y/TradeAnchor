-- ============================================================
-- TradeWise Mock Seed Data — US Stocks & Spot Gold
-- ============================================================
-- Direct PostgreSQL seed (no backend needed).
-- Run after: npx prisma migrate deploy
--
-- Usage:
--   psql "YOUR_DATABASE_URL" -f seed-mock-trades.sql
--
-- Replace {{USER_ID}} with your actual user UUID.
-- Get it via:  SELECT id FROM users LIMIT 1;
-- ============================================================

-- SET your user ID here (or replace via sed/editor):
-- :user_id   ← use psql variable:  \set user_id 'your-uuid-here'

-- ============================================================
-- STEP 1: Create Batches
-- ============================================================

INSERT INTO batches (id, user_id, name, description, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000101', :user_id, 'US Stocks Portfolio', 'Long/short positions in US equities — mega-cap tech, ETFs, high-volatility', NOW(), NOW())
ON CONFLICT (user_id, name) DO NOTHING;

INSERT INTO batches (id, user_id, name, description, created_at, updated_at)
VALUES
  ('00000000-0000-0000-0000-000000000102', :user_id, 'Spot Gold (XAU/USD)', 'Spot gold and mini gold futures (MGC) swing trades', NOW(), NOW())
ON CONFLICT (user_id, name) DO NOTHING;

-- ============================================================
-- STEP 2: Generate US Stock Trades
-- Config: AAPL, MSFT, NVDA, GOOGL, AMZN, META, TSLA, AMD, NFLX, SPY, QQQ
-- ============================================================

-- AAPL (Apple) — long bias, $165–$195, ~$165–$195 per share
DO $$
DECLARE
  i INT;
  entry NUMERIC(18,4);
  qty   NUMERIC(18,4);
  exitp NUMERIC(18,4);
  pnl   NUMERIC(18,8);
  et    TIMESTAMPTZ;
  xt    TIMESTAMPTZ;
  is_long BOOLEAN;
  is_open BOOLEAN;
BEGIN
  FOR i IN 1..12 LOOP
    entry   := (165 + (random() * 30))::NUMERIC(18,4);
    qty     := (50  + (random() * 250))::NUMERIC(18,2);
    is_long := (random() < 0.85);
    is_open := (random() < 0.25);
    et      := NOW() - (random() * 180 || ' days')::INTERVAL
               + ((random() * 7  || ' hours')::INTERVAL);

    -- ~55% win rate
    IF random() < 0.55 THEN
      exitp := CASE WHEN is_long THEN entry * (1 + 0.01 + random() * 0.04)
                    ELSE entry * (1 - 0.01 - random() * 0.04) END;
    ELSE
      exitp := CASE WHEN is_long THEN entry * (1 - 0.01 - random() * 0.03)
                    ELSE entry * (1 + 0.01 + random() * 0.03) END;
    END IF;

    pnl := CASE WHEN is_long THEN (exitp - entry) * qty
                ELSE (entry - exitp) * qty END;

    xt := CASE WHEN is_open THEN NULL
               ELSE et + ((random() * 8 + 0.5) || ' hours')::INTERVAL END;

    INSERT INTO trades (id, user_id, batch_id, trading_symbol, position_direction,
                        entry_price, exit_price, quantity, pnl, entry_timestamp, exit_timestamp,
                        created_at, updated_at)
    VALUES (
      gen_random_uuid(), :user_id, '00000000-0000-0000-0000-000000000101',
      'AAPL', CASE WHEN is_long THEN 'long' ELSE 'short' END,
      entry, CASE WHEN is_open THEN NULL ELSE exitp END, qty,
      CASE WHEN is_open THEN NULL ELSE pnl END,
      et, xt, NOW(), NOW()
    );
  END LOOP;
END $$;

-- MSFT (Microsoft)
DO $$
DECLARE i INT; entry NUMERIC(18,4); qty NUMERIC(18,4);
  exitp NUMERIC(18,4); pnl NUMERIC(18,8); et TIMESTAMPTZ; xt TIMESTAMPTZ;
  is_long BOOLEAN; is_open BOOLEAN;
BEGIN
  FOR i IN 1..12 LOOP
    entry := (330 + random() * 80)::NUMERIC(18,4);
    qty   := (20 + random() * 130)::NUMERIC(18,2);
    is_long := (random() < 0.8); is_open := (random() < 0.25);
    et    := NOW() - (random() * 180 || ' days')::INTERVAL;
    IF random() < 0.55 THEN exitp := entry * (1 + 0.01 + random()*0.04);
    ELSE exitp := entry * (1 - 0.01 - random()*0.03); END IF;
    pnl   := CASE WHEN is_long THEN (exitp - entry)*qty ELSE (entry - exitp)*qty END;
    xt    := CASE WHEN is_open THEN NULL ELSE et + ((random()*8+0.5)||' hours')::INTERVAL END;
    INSERT INTO trades (id, user_id, batch_id, trading_symbol, position_direction,
        entry_price, exit_price, quantity, pnl, entry_timestamp, exit_timestamp, created_at, updated_at)
    VALUES (gen_random_uuid(), :user_id, '00000000-0000-0000-0000-000000000101',
        'MSFT', CASE WHEN is_long THEN 'long' ELSE 'short' END,
        entry, CASE WHEN is_open THEN NULL ELSE exitp END, qty,
        CASE WHEN is_open THEN NULL ELSE pnl END, et, xt, NOW(), NOW());
  END LOOP;
END $$;

-- NVDA (NVIDIA) — high volatility, long bias
DO $$
DECLARE i INT; entry NUMERIC(18,4); qty NUMERIC(18,4);
  exitp NUMERIC(18,4); pnl NUMERIC(18,8); et TIMESTAMPTZ; xt TIMESTAMPTZ;
  is_long BOOLEAN; is_open BOOLEAN;
BEGIN
  FOR i IN 1..12 LOOP
    entry := (450 + random() * 430)::NUMERIC(18,4);
    qty   := (10 + random() * 90)::NUMERIC(18,2);
    is_long := (random() < 0.75); is_open := (random() < 0.3);
    et    := NOW() - (random() * 180 || ' days')::INTERVAL;
    IF random() < 0.58 THEN exitp := entry * (1 + 0.02 + random()*0.06);
    ELSE exitp := entry * (1 - 0.02 - random()*0.05); END IF;
    pnl   := CASE WHEN is_long THEN (exitp - entry)*qty ELSE (entry - exitp)*qty END;
    xt    := CASE WHEN is_open THEN NULL ELSE et + ((random()*6+1)||' hours')::INTERVAL END;
    INSERT INTO trades (id, user_id, batch_id, trading_symbol, position_direction,
        entry_price, exit_price, quantity, pnl, entry_timestamp, exit_timestamp, created_at, updated_at)
    VALUES (gen_random_uuid(), :user_id, '00000000-0000-0000-0000-000000000101',
        'NVDA', CASE WHEN is_long THEN 'long' ELSE 'short' END,
        entry, CASE WHEN is_open THEN NULL ELSE exitp END, qty,
        CASE WHEN is_open THEN NULL ELSE pnl END, et, xt, NOW(), NOW());
  END LOOP;
END $$;

-- GOOGL, AMZN, META, TSLA, AMD, NFLX, SPY, QQQ — same pattern
DO $$
DECLARE sym TEXT; entry_lo NUMERIC; entry_hi NUMERIC; qty_lo NUMERIC; qty_hi NUMERIC;
  rec RECORD;
BEGIN
  FOR rec IN VALUES
    ('GOOGL', 125, 175, 30, 200, 0.80, 0.20),
    ('AMZN',  145, 200, 20, 150, 0.80, 0.15),
    ('META',  340, 530, 10, 120, 0.78, 0.20),
    ('TSLA',  170, 310, 30, 200, 0.60, 0.30),
    ('AMD',   120, 185, 50, 300, 0.60, 0.30),
    ('NFLX',  380, 620,  5,  50, 0.72, 0.22),
    ('SPY',   440, 520, 20, 100, 0.55, 0.25),
    ('QQQ',   380, 460, 20,  80, 0.70, 0.20)
  LOOP
    FOR i IN 1..12 LOOP
      entry   := (rec.entry_lo + random() * (rec.entry_hi - rec.entry_lo))::NUMERIC(18,4);
      qty     := (rec.qty_lo   + random() * (rec.qty_hi   - rec.qty_lo))::NUMERIC(18,2);
      is_long := (random() < rec.long_rate);
      is_open := (random() < rec.open_rate);
      et      := NOW() - (random()*180||' days')::INTERVAL;
      IF random() < 0.55 THEN exitp := entry*(1+0.01+random()*0.04);
      ELSE exitp := entry*(1-0.01-random()*0.03); END IF;
      pnl := CASE WHEN is_long THEN (exitp-entry)*qty ELSE (entry-exitp)*qty END;
      xt  := CASE WHEN is_open THEN NULL ELSE et+((random()*8+0.5)||' hours')::INTERVAL END;
      INSERT INTO trades (id, user_id, batch_id, trading_symbol, position_direction,
          entry_price, exit_price, quantity, pnl, entry_timestamp, exit_timestamp, created_at, updated_at)
      VALUES (gen_random_uuid(), :user_id, '00000000-0000-0000-0000-000000000101',
          rec.sym, CASE WHEN is_long THEN 'long' ELSE 'short' END,
          entry, CASE WHEN is_open THEN NULL ELSE exitp END, qty,
          CASE WHEN is_open THEN NULL ELSE pnl END, et, xt, NOW(), NOW());
    END LOOP;
  END LOOP;
END $$;

-- ============================================================
-- STEP 3: Generate Spot Gold Trades
-- ============================================================

-- XAUUSD (Spot Gold) — price in USD/troy oz, $1,920–$2,680
DO $$
DECLARE i INT; entry NUMERIC(18,4); qty NUMERIC(18,4);
  exitp NUMERIC(18,4); pnl NUMERIC(18,8); et TIMESTAMPTZ; xt TIMESTAMPTZ;
  is_long BOOLEAN; is_open BOOLEAN;
BEGIN
  FOR i IN 1..12 LOOP
    entry   := (1920 + random() * 760)::NUMERIC(18,4);
    qty     := (0.5  + random() * 4.5)::NUMERIC(18,4);  -- troy oz, fractional allowed
    is_long := (random() < 0.65);   -- slight long bias for gold
    is_open := (random() < 0.3);
    et      := NOW() - (random()*180||' days')::INTERVAL;
    -- Gold spread ~0.3%, moves slower than stocks
    IF random() < 0.58 THEN exitp := entry*(1+0.003+random()*0.015);
    ELSE exitp := entry*(1-0.003-random()*0.012); END IF;
    pnl   := CASE WHEN is_long THEN (exitp-entry)*qty ELSE (entry-exitp)*qty END;
    -- Gold swings can last hours to days
    xt    := CASE WHEN is_open THEN NULL ELSE et+((random()*48+1)||' hours')::INTERVAL END;
    INSERT INTO trades (id, user_id, batch_id, trading_symbol, position_direction,
        entry_price, exit_price, quantity, pnl, entry_timestamp, exit_timestamp, created_at, updated_at)
    VALUES (gen_random_uuid(), :user_id, '00000000-0000-0000-0000-000000000102',
        'XAUUSD', CASE WHEN is_long THEN 'long' ELSE 'short' END,
        entry, CASE WHEN is_open THEN NULL ELSE exitp END, qty,
        CASE WHEN is_open THEN NULL ELSE pnl END, et, xt, NOW(), NOW());
  END LOOP;
END $$;

-- MGC (Gold Mini Futures) — same underlying, different contract size
DO $$
DECLARE i INT; entry NUMERIC(18,4); qty NUMERIC(18,4);
  exitp NUMERIC(18,4); pnl NUMERIC(18,8); et TIMESTAMPTZ; xt TIMESTAMPTZ;
  is_long BOOLEAN; is_open BOOLEAN;
BEGIN
  FOR i IN 1..12 LOOP
    entry   := (192 + random() * 76)::NUMERIC(18,4);  -- 1/10 of spot
    qty     := (5   + random() * 45)::NUMERIC(18,2);
    is_long := (random() < 0.6);
    is_open := (random() < 0.25);
    et      := NOW() - (random()*180||' days')::INTERVAL;
    IF random() < 0.58 THEN exitp := entry*(1+0.003+random()*0.015);
    ELSE exitp := entry*(1-0.003-random()*0.012); END IF;
    pnl := CASE WHEN is_long THEN (exitp-entry)*qty ELSE (entry-exitp)*qty END;
    xt  := CASE WHEN is_open THEN NULL ELSE et+((random()*36+2)||' hours')::INTERVAL END;
    INSERT INTO trades (id, user_id, batch_id, trading_symbol, position_direction,
        entry_price, exit_price, quantity, pnl, entry_timestamp, exit_timestamp, created_at, updated_at)
    VALUES (gen_random_uuid(), :user_id, '00000000-0000-0000-0000-000000000102',
        'MGC', CASE WHEN is_long THEN 'long' ELSE 'short' END,
        entry, CASE WHEN is_open THEN NULL ELSE exitp END, qty,
        CASE WHEN is_open THEN NULL ELSE pnl END, et, xt, NOW(), NOW());
  END LOOP;
END $$;

-- ============================================================
-- STEP 4: Summary
-- ============================================================

\echo ''
\echo '==============================================='
\echo '  ✅ Seed complete!'
\echo '==============================================='

SELECT
  b.name                                          AS "Batch",
  COUNT(t.id)::INT                                AS "Trades",
  COUNT(t.pnl) FILTER (WHERE t.pnl > 0)::INT      AS "Wins",
  COUNT(t.pnl) FILTER (WHERE t.pnl < 0)::INT      AS "Losses",
  ROUND(
    100.0 * COUNT(t.pnl) FILTER (WHERE t.pnl > 0) / NULLIF(COUNT(t.pnl),0), 1
  )                                               AS "Win Rate %",
  ROUND(SUM(t.pnl)::NUMERIC, 2)                   AS "Total P&L"
FROM batches b
LEFT JOIN trades t ON t.batch_id = b.id AND t.user_id = b.user_id
WHERE b.user_id = :user_id
GROUP BY b.id, b.name
ORDER BY b.name;

\echo ''
\echo 'Symbols created: AAPL, MSFT, NVDA, GOOGL, AMZN, META, TSLA, AMD, NFLX, SPY, QQQ, XAUUSD, MGC'
\echo 'Ready to test AI Reports!'
