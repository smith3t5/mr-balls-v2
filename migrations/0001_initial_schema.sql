-- M.R. B.A.L.L.S. 2.0 Database Schema
-- Optimized for Cloudflare D1 (SQLite)

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  nfc_tag_id TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  created_at INTEGER NOT NULL,
  tier TEXT DEFAULT 'founding_member',
  -- Stats (cached for performance)
  total_bets INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  pushes INTEGER DEFAULT 0,
  units_wagered REAL DEFAULT 0.0,
  units_profit REAL DEFAULT 0.0,
  best_win_streak INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  sharp_score REAL DEFAULT 50.0,
  -- Preferences
  default_unit_size REAL DEFAULT 10.0,
  notifications_enabled INTEGER DEFAULT 1
);

-- Bets table
CREATE TABLE IF NOT EXISTS bets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, won, lost, push, cancelled
  stake REAL NOT NULL,
  odds INTEGER NOT NULL,
  potential_return REAL NOT NULL,
  actual_return REAL,
  confidence REAL, -- 0-10 engine confidence
  notes TEXT,
  settled_at INTEGER,
  -- Analytics
  avg_edge REAL,
  contrarian_score REAL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_bets_user_id ON bets(user_id);
CREATE INDEX idx_bets_status ON bets(status);
CREATE INDEX idx_bets_created_at ON bets(created_at);

-- Bet legs table
CREATE TABLE IF NOT EXISTS bet_legs (
  id TEXT PRIMARY KEY,
  bet_id TEXT NOT NULL,
  sport TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  commence_time INTEGER NOT NULL,
  market TEXT NOT NULL, -- h2h, spreads, totals, player_prop
  pick TEXT NOT NULL,
  odds INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',
  -- Props specific fields
  participant TEXT,
  point REAL,
  bet_kind TEXT, -- side, total, prop
  bet_tag TEXT, -- favorite, underdog, over, under
  -- DraftKings link
  dk_link TEXT,
  -- Analytics factors
  edge REAL,
  sharp_money_pct REAL,
  public_money_pct REAL,
  line_movement REAL,
  locked_by_user INTEGER DEFAULT 0,
  FOREIGN KEY (bet_id) REFERENCES bets(id) ON DELETE CASCADE
);

CREATE INDEX idx_bet_legs_bet_id ON bet_legs(bet_id);
CREATE INDEX idx_bet_legs_event_id ON bet_legs(event_id);
CREATE INDEX idx_bet_legs_status ON bet_legs(status);

-- Line history (track odds movements)
CREATE TABLE IF NOT EXISTS line_history (
  id TEXT PRIMARY KEY,
  sport TEXT NOT NULL,
  event_id TEXT NOT NULL,
  market TEXT NOT NULL,
  book TEXT NOT NULL,
  odds INTEGER NOT NULL,
  point REAL,
  participant TEXT,
  recorded_at INTEGER NOT NULL
);

CREATE INDEX idx_line_history_event ON line_history(event_id, market);
CREATE INDEX idx_line_history_time ON line_history(recorded_at);

-- Sharp plays (automated daily findings)
CREATE TABLE IF NOT EXISTS sharp_plays (
  id TEXT PRIMARY KEY,
  sport TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  commence_time INTEGER NOT NULL,
  market TEXT NOT NULL,
  pick TEXT NOT NULL,
  odds INTEGER NOT NULL,
  edge REAL NOT NULL,
  confidence REAL NOT NULL,
  -- Factors
  sharp_money_pct REAL,
  line_value REAL,
  situational_score REAL,
  weather_impact REAL,
  trend_score REAL,
  -- Explanation
  analysis_summary TEXT,
  found_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  shown_to_users INTEGER DEFAULT 0
);

CREATE INDEX idx_sharp_plays_sport ON sharp_plays(sport);
CREATE INDEX idx_sharp_plays_expires ON sharp_plays(expires_at);
CREATE INDEX idx_sharp_plays_confidence ON sharp_plays(confidence DESC);

-- Sessions table (for auth)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  nfc_tag_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  last_activity INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL, -- bet_starting, bet_won, bet_lost, line_moved, friend_activity
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data TEXT, -- JSON data
  read INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_notifications_user ON notifications(user_id, read);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

-- API cache table (for rate limiting on free tier)
CREATE TABLE IF NOT EXISTS api_cache (
  key TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX idx_api_cache_expires ON api_cache(expires_at);

-- Leaderboard cache (updated periodically)
CREATE TABLE IF NOT EXISTS leaderboard_cache (
  period TEXT PRIMARY KEY, -- daily, weekly, monthly, all_time
  data TEXT NOT NULL, -- JSON array of ranked users
  updated_at INTEGER NOT NULL
);
