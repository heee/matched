CREATE TABLE IF NOT EXISTS users (
  name TEXT PRIMARY KEY,
  hue INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  settings_json TEXT NOT NULL CHECK (json_valid(settings_json)),
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'shared',      -- shared | race | solo
  layout_id TEXT NOT NULL,
  tile_count INTEGER NOT NULL DEFAULT 0,
  visibility TEXT NOT NULL DEFAULT 'open',  -- open | private
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'open',       -- open | completed
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  completed_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS room_players (
  room_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  pairs_cleared INTEGER NOT NULL DEFAULT 0,
  joined_at TEXT NOT NULL,
  PRIMARY KEY (room_id, user_name)
);

-- One shared board per calendar day. layout_id + seed are enough to
-- regenerate the exact same board deterministically (see worker's
-- generateBoard) — no need to store the tile array itself.
CREATE TABLE IF NOT EXISTS daily_boards (
  date TEXT PRIMARY KEY,   -- YYYY-MM-DD
  layout_id TEXT NOT NULL,
  seed INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rooms_discovery
  ON rooms (visibility, state, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rooms_created_by
  ON rooms (created_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_room_players_user
  ON room_players (user_name);
