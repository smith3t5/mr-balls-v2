-- M.R. B.A.L.L.S. v2.0 Database Schema
-- Initial migration

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  nfc_tag_id TEXT NOT NULL UNIQUE,
  avatar_url TEXT,
  created_at INTEGER NOT NULL,
  tier TEXT DEFAULT 'member' CHECK(tier IN ('founding_member', 'member')),

  -- Stats (denormalized for performance)
  total_bets INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  pushes INTEGER DEFAULT 0,
  units_wagered REAL DEFAULT 0,
  units_profit REAL DEFAULT 0,
  best_win_streak INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  sharp_score REAL DEFAULT 50,

  -- Preferences
  default_unit_size REAL DEFAULT 10,
  notifications_enabled INTEGER DEFAULT 1
);

CREATE INDEX idx_users_nfc_tag ON users(nfc_tag_id);
CREATE INDEX idx_users_username ON users(username);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  nfc_tag_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  last_activity INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- Bets table
CREATE TABLE IF NOT EXISTS bets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'won', 'lost', 'push', 'cancelled')),
  stake REAL NOT NULL,
  odds REAL NOT NULL,
  potential_return REAL NOT NULL,
  actual_return REAL,
  confidence REAL,
  notes TEXT,
  settled_at INTEGER,
  avg_edge REAL,
  contrarian_score REAL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_bets_user ON bets(user_id);
CREATE INDEX idx_bets_status ON bets(status);
CREATE INDEX idx_bets_created ON bets(created_at DESC);

-- Bet legs table
CREATE TABLE IF NOT EXISTS bet_legs (
  id TEXT PRIMARY KEY,
  bet_id TEXT NOT NULL,
  sport TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  commence_time INTEGER NOT NULL,
  market TEXT NOT NULL,
  pick TEXT NOT NULL,
  odds REAL NOT NULL,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'won', 'lost', 'push')),
  participant TEXT,
  point REAL,
  bet_kind TEXT NOT NULL CHECK(bet_kind IN ('side', 'total', 'prop')),
  bet_tag TEXT,
  dk_link TEXT,

  -- Analytics
  edge REAL,
  sharp_money_pct REAL,
  public_money_pct REAL,
  line_movement REAL,
  locked_by_user INTEGER DEFAULT 0,

  FOREIGN KEY (bet_id) REFERENCES bets(id)
);

CREATE INDEX idx_bet_legs_bet ON bet_legs(bet_id);
CREATE INDEX idx_bet_legs_event ON bet_legs(event_id);
CREATE INDEX idx_bet_legs_commence ON bet_legs(commence_time);

-- Sharp plays table (featured plays)
CREATE TABLE IF NOT EXISTS sharp_plays (
  id TEXT PRIMARY KEY,
  sport TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_name TEXT NOT NULL,
  commence_time INTEGER NOT NULL,
  market TEXT NOT NULL,
  pick TEXT NOT NULL,
  odds REAL NOT NULL,
  edge REAL NOT NULL,
  confidence REAL NOT NULL,
  sharp_money_pct REAL,
  line_value REAL,
  situational_score REAL,
  weather_impact REAL,
  trend_score REAL,
  analysis_summary TEXT,
  found_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX idx_sharp_plays_expires ON sharp_plays(expires_at);
CREATE INDEX idx_sharp_plays_sport ON sharp_plays(sport);

-- Line history table (for tracking line movements)
CREATE TABLE IF NOT EXISTS line_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL,
  market TEXT NOT NULL,
  book TEXT NOT NULL,
  odds REAL NOT NULL,
  point REAL,
  recorded_at INTEGER NOT NULL
);

CREATE INDEX idx_line_history_event ON line_history(event_id);
CREATE INDEX idx_line_history_recorded ON line_history(recorded_at DESC);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('bet_starting', 'bet_won', 'bet_lost', 'line_moved', 'friend_activity', 'sharp_play')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data TEXT,
  read INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

-- Leaderboard cache (updated periodically)
CREATE TABLE IF NOT EXISTS leaderboard_cache (
  period TEXT PRIMARY KEY CHECK(period IN ('daily', 'weekly', 'monthly', 'all_time')),
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- API cache table (for caching external API calls)
CREATE TABLE IF NOT EXISTS api_cache (
  key TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX idx_api_cache_expires ON api_cache(expires_at);
