-- Migration 0005: KenPom efficiency data table
-- Stores daily-refreshed KenPom ratings for all D1 teams.
-- Populated by the cron-kenpom worker. Read by analytics-engine.ts.

CREATE TABLE IF NOT EXISTS kenpom_data (
  -- KenPom uses team name as the natural key
  team_name        TEXT PRIMARY KEY,

  -- Core efficiency metrics (the ones we actually use in projections)
  adj_oe           REAL NOT NULL,   -- Adjusted Offensive Efficiency (pts per 100 poss)
  adj_de           REAL NOT NULL,   -- Adjusted Defensive Efficiency (pts allowed per 100 poss)
  adj_tempo        REAL NOT NULL,   -- Adjusted Tempo (possessions per 40 min)
  adj_em           REAL NOT NULL,   -- Adjusted Efficiency Margin (adj_oe - adj_de)

  -- Context fields
  conference       TEXT NOT NULL,
  kenpom_rank      INTEGER NOT NULL,
  win_pct          REAL NOT NULL,   -- Season win percentage (0.0–1.0)
  record           TEXT,            -- e.g. "24-8" for display only

  -- Luck & opponent strength (useful for situational analysis)
  luck             REAL,            -- Luck rating (-1 to +1 range typical)
  opp_adj_oe       REAL,            -- Avg AdjOE of opponents faced
  opp_adj_de       REAL,            -- Avg AdjDE of opponents faced

  -- Metadata
  season           TEXT NOT NULL,   -- e.g. "2025"
  last_updated     INTEGER NOT NULL -- Unix timestamp of last sync
);

-- Fast lookup by conference for same-conference detection
CREATE INDEX idx_kenpom_conference ON kenpom_data(conference);

-- Fast lookup by rank for top-N queries
CREATE INDEX idx_kenpom_rank ON kenpom_data(kenpom_rank);

-- Sync log: one row per cron run so we can monitor health
CREATE TABLE IF NOT EXISTS kenpom_sync_log (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  ran_at           INTEGER NOT NULL,  -- Unix timestamp
  teams_synced     INTEGER NOT NULL,
  status           TEXT NOT NULL CHECK(status IN ('success', 'partial', 'failed')),
  error_message    TEXT,              -- NULL on success
  duration_ms      INTEGER
);
