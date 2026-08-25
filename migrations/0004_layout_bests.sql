-- Extends the activity feed (see 0003_activity.sql) with:
--   - per-layout personal-best completion times, shared across daily play
--     and regular shared/solo rooms alike (race mode keeps its own
--     pairs-based best in user_stats.best_race_pairs — time isn't the score
--     there)
--   - a lifetime completed-games counter, so a player's very first
--     completed game can be called out as a "noteworthy" feed moment
--   - new activity_events kinds: 'best_layout_time' | 'first_game' | 'joined'

ALTER TABLE user_stats ADD COLUMN games_completed INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS layout_bests (
  user_name TEXT NOT NULL,
  layout_id TEXT NOT NULL,
  best_ms INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_name, layout_id)
);
