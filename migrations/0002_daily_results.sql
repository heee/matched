CREATE TABLE IF NOT EXISTS daily_results (
  date TEXT NOT NULL,
  user_name TEXT NOT NULL,
  elapsed_ms INTEGER NOT NULL,
  pairs_matched INTEGER NOT NULL,
  completed_at TEXT NOT NULL,
  PRIMARY KEY (date, user_name),
  FOREIGN KEY (user_name) REFERENCES users(name)
);

CREATE INDEX IF NOT EXISTS idx_daily_results_date_time
  ON daily_results (date, elapsed_ms ASC);
