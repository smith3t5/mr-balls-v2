-- Add advanced betting analytics tracking
-- Supports Kelly Criterion, EV tracking, CLV analysis, and model performance

-- Add new columns to bet_legs for advanced metrics
ALTER TABLE bet_legs ADD COLUMN expected_value REAL;
ALTER TABLE bet_legs ADD COLUMN kelly_fraction REAL;
ALTER TABLE bet_legs ADD COLUMN kelly_units REAL;
ALTER TABLE bet_legs ADD COLUMN true_probability REAL;
ALTER TABLE bet_legs ADD COLUMN implied_probability REAL;
ALTER TABLE bet_legs ADD COLUMN bet_grade TEXT CHECK(bet_grade IN ('S', 'A', 'B', 'C', 'D'));
ALTER TABLE bet_legs ADD COLUMN closing_odds REAL; -- For CLV tracking
ALTER TABLE bet_legs ADD COLUMN clv REAL; -- Closing Line Value

-- Model predictions table
-- Tracks what the model predicted for backtesting and calibration
CREATE TABLE IF NOT EXISTS model_predictions (
  id TEXT PRIMARY KEY,
  bet_leg_id TEXT,
  event_id TEXT NOT NULL,
  outcome_type TEXT NOT NULL, -- 'moneyline', 'spread', 'total', 'prop'
  predicted_probability REAL NOT NULL,
  confidence_score REAL NOT NULL,
  edge_score REAL NOT NULL,
  expected_value REAL NOT NULL,
  kelly_recommended_units REAL NOT NULL,
  bet_grade TEXT NOT NULL,
  model_version TEXT DEFAULT 'v1.0',
  created_at INTEGER NOT NULL,
  factors TEXT, -- JSON array of factors
  FOREIGN KEY (bet_leg_id) REFERENCES bet_legs(id)
);

CREATE INDEX idx_model_predictions_leg ON model_predictions(bet_leg_id);
CREATE INDEX idx_model_predictions_event ON model_predictions(event_id);
CREATE INDEX idx_model_predictions_created ON model_predictions(created_at DESC);
CREATE INDEX idx_model_predictions_grade ON model_predictions(bet_grade);

-- Bet performance tracking
-- Links predictions to outcomes for performance analysis
CREATE TABLE IF NOT EXISTS bet_performance (
  id TEXT PRIMARY KEY,
  bet_leg_id TEXT NOT NULL,
  prediction_id TEXT NOT NULL,
  user_id TEXT NOT NULL,

  -- Bet details
  sport TEXT NOT NULL,
  event_id TEXT NOT NULL,
  market TEXT NOT NULL,
  odds INTEGER NOT NULL,
  closing_odds INTEGER,
  stake REAL NOT NULL,

  -- Outcome
  result TEXT CHECK(result IN ('win', 'loss', 'push', 'pending')) DEFAULT 'pending',
  profit REAL,

  -- Performance metrics
  ev_actual REAL, -- Actual EV based on result
  clv REAL, -- Closing line value
  roi REAL, -- Return on investment

  -- Timestamps
  placed_at INTEGER NOT NULL,
  settled_at INTEGER,

  FOREIGN KEY (bet_leg_id) REFERENCES bet_legs(id),
  FOREIGN KEY (prediction_id) REFERENCES model_predictions(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_bet_performance_leg ON bet_performance(bet_leg_id);
CREATE INDEX idx_bet_performance_prediction ON bet_performance(prediction_id);
CREATE INDEX idx_bet_performance_user ON bet_performance(user_id);
CREATE INDEX idx_bet_performance_result ON bet_performance(result);
CREATE INDEX idx_bet_performance_sport ON bet_performance(sport);
CREATE INDEX idx_bet_performance_placed ON bet_performance(placed_at DESC);

-- User statistics extension
-- Add advanced metrics to users table
ALTER TABLE users ADD COLUMN total_ev REAL DEFAULT 0; -- Cumulative expected value
ALTER TABLE users ADD COLUMN avg_clv REAL DEFAULT 0; -- Average closing line value
ALTER TABLE users ADD COLUMN sharpe_ratio REAL DEFAULT 0; -- Risk-adjusted return
ALTER TABLE users ADD COLUMN kelly_multiplier REAL DEFAULT 0.25; -- User's Kelly fraction preference
ALTER TABLE users ADD COLUMN bankroll REAL DEFAULT 1000; -- User's bankroll for unit calculations

-- Performance summary cache
-- Aggregated stats for quick dashboard loading
CREATE TABLE IF NOT EXISTS performance_summary (
  user_id TEXT PRIMARY KEY,
  period TEXT NOT NULL, -- 'all', '30d', '7d', '24h'

  -- Basic stats
  total_bets INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  pushes INTEGER DEFAULT 0,

  -- Financial
  total_wagered REAL DEFAULT 0,
  total_profit REAL DEFAULT 0,
  roi REAL DEFAULT 0,

  -- Advanced metrics
  avg_ev REAL DEFAULT 0,
  avg_clv REAL DEFAULT 0,
  sharpe_ratio REAL DEFAULT 0,

  -- By grade
  s_grade_bets INTEGER DEFAULT 0,
  a_grade_bets INTEGER DEFAULT 0,
  b_grade_bets INTEGER DEFAULT 0,
  c_grade_bets INTEGER DEFAULT 0,
  d_grade_bets INTEGER DEFAULT 0,

  -- Calibration (actual win rate vs predicted for probability buckets)
  calibration_data TEXT, -- JSON object with buckets

  updated_at INTEGER NOT NULL,

  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX idx_performance_summary_user ON performance_summary(user_id);
CREATE INDEX idx_performance_summary_updated ON performance_summary(updated_at DESC);

-- Closing line tracking
-- Store closing lines for all games to calculate CLV
CREATE TABLE IF NOT EXISTS closing_lines (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  market TEXT NOT NULL,
  outcome_name TEXT NOT NULL,
  point REAL,
  odds INTEGER NOT NULL,
  book TEXT DEFAULT 'consensus', -- Which book or 'consensus'
  recorded_at INTEGER NOT NULL
);

CREATE INDEX idx_closing_lines_event ON closing_lines(event_id);
CREATE INDEX idx_closing_lines_market ON closing_lines(market);
CREATE INDEX idx_closing_lines_recorded ON closing_lines(recorded_at DESC);

-- Model performance tracking
-- Track how well different models/versions perform
CREATE TABLE IF NOT EXISTS model_performance (
  id TEXT PRIMARY KEY,
  model_version TEXT NOT NULL,
  sport TEXT NOT NULL,
  market_type TEXT NOT NULL,

  -- Performance metrics
  total_predictions INTEGER DEFAULT 0,
  correct_predictions INTEGER DEFAULT 0,
  accuracy REAL DEFAULT 0,
  avg_ev REAL DEFAULT 0,
  avg_clv REAL DEFAULT 0,
  sharpe_ratio REAL DEFAULT 0,

  -- Calibration score (how close predicted probabilities match actual)
  calibration_score REAL DEFAULT 0,

  -- Time period
  start_date INTEGER NOT NULL,
  end_date INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_model_performance_version ON model_performance(model_version);
CREATE INDEX idx_model_performance_sport ON model_performance(sport);
CREATE INDEX idx_model_performance_updated ON model_performance(updated_at DESC);
