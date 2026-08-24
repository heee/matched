-- Backs the Home screen's activity feed. Room-started/completed and
-- daily-completed activity are read live from the existing `rooms` and
-- `daily_results` tables — only milestones (streaks, personal bests) need
-- state of their own, since nothing tracked those before.

CREATE TABLE IF NOT EXISTS user_stats (
  user_name TEXT PRIMARY KEY,
  daily_streak INTEGER NOT NULL DEFAULT 0,   -- current running streak
  daily_streak_date TEXT,                    -- last date counted (YYYY-MM-DD)
  best_streak INTEGER NOT NULL DEFAULT 0,    -- personal record streak
  best_daily_ms INTEGER,                     -- personal record daily-puzzle time
  best_daily_layout_id TEXT,
  best_race_pairs INTEGER,                   -- personal record pairs cleared in a race room
  updated_at TEXT NOT NULL
);

-- One row per milestone the moment it's newly set (a value beating the
-- player's own prior record) — never a running log of every completion.
CREATE TABLE IF NOT EXISTS activity_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_name TEXT NOT NULL,
  kind TEXT NOT NULL,        -- 'daily_streak' | 'best_daily_time' | 'best_race_pairs'
  value INTEGER NOT NULL,    -- streak count / elapsed ms / pairs cleared
  layout_id TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_activity_events_created
  ON activity_events (created_at DESC);
