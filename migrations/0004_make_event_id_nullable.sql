-- Make event_id nullable to support manually entered bets
-- Manual bets don't have event IDs from the Odds API

-- SQLite doesn't support ALTER COLUMN, so we need to recreate the table
-- Step 1: Create new table with nullable event_id
CREATE TABLE IF NOT EXISTS bet_legs_new (
  id TEXT PRIMARY KEY,
  bet_id TEXT NOT NULL,
  sport TEXT NOT NULL,
  event_id TEXT, -- Now nullable for manual bets
  event_name TEXT NOT NULL,
  commence_time INTEGER NOT NULL,
  market TEXT NOT NULL,
  pick TEXT NOT NULL,
  odds INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',
  participant TEXT,
  point REAL,
  bet_kind TEXT,
  bet_tag TEXT,
  dk_link TEXT,
  edge REAL,
  sharp_money_pct REAL,
  public_money_pct REAL,
  line_movement REAL,
  locked_by_user INTEGER DEFAULT 0,
  FOREIGN KEY (bet_id) REFERENCES bets(id) ON DELETE CASCADE
);

-- Step 2: Copy data from old table
INSERT INTO bet_legs_new
SELECT * FROM bet_legs;

-- Step 3: Drop old table
DROP TABLE bet_legs;

-- Step 4: Rename new table
ALTER TABLE bet_legs_new RENAME TO bet_legs;

-- Step 5: Recreate indexes
CREATE INDEX idx_bet_legs_bet_id ON bet_legs(bet_id);
CREATE INDEX idx_bet_legs_event_id ON bet_legs(event_id);
CREATE INDEX idx_bet_legs_status ON bet_legs(status);
