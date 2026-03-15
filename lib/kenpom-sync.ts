/**
 * lib/kenpom-sync.ts
 *
 * Syncs KenPom efficiency data into D1 using the official KenPom API.
 * API docs: https://kenpom.com/api-documentation.php
 *
 * Called by: app/api/cron-kenpom/route.ts (daily cron)
 * Read by:   lib/analytics-engine.ts (per-request via D1)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KenPomEntry {
  adjOE:      number;
  adjDE:      number;
  adjTempo:   number;
  adjEM:      number;
  winPct:     number;
  conference: string;
  rank:       number;
  luck:       number | null;
  oppAdjOE:   number | null;
  oppAdjDE:   number | null;
}

export interface KenPomSyncResult {
  success:     boolean;
  teamsSynced: number;
  durationMs:  number;
  error?:      string;
}

// Shape of a single record from GET /api.php?endpoint=ratings&y=YYYY
interface KenPomRatingsRecord {
  TeamName:     string;
  ConfShort:    string;
  Wins:         number;
  Losses:       number;
  AdjEM:        number;
  RankAdjEM:    number;
  AdjOE:        number;
  AdjDE:        number;
  AdjTempo:     number;
  Luck:         number;
  SOSO:         number | null; // opponent offensive SOS (proxy for OppAdjOE)
  SOSD:         number | null; // opponent defensive SOS (proxy for OppAdjDE)
  Season:       number;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------

const KENPOM_BASE = 'https://kenpom.com';

async function fetchRatings(
  apiKey: string,
  season: string
): Promise<KenPomRatingsRecord[]> {
  const url = `${KENPOM_BASE}/api.php?endpoint=ratings&y=${season}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept':        'application/json',
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `KenPom API returned HTTP ${response.status}: ${body.slice(0, 200)}`
    );
  }

  const data = await response.json() as { teams?: KenPomRatingsRecord[] } | KenPomRatingsRecord[];

  // API may return { teams: [...] } or directly an array
  const records = Array.isArray(data) ? data : (data as any).teams ?? [];

  if (!Array.isArray(records) || records.length === 0) {
    throw new Error(
      `KenPom API returned no records. Response: ${JSON.stringify(data).slice(0, 300)}`
    );
  }

  return records;
}

// ---------------------------------------------------------------------------
// D1 upsert
// ---------------------------------------------------------------------------

async function upsertToD1(
  db: D1Database,
  records: KenPomRatingsRecord[],
  season: string
): Promise<number> {
  const now        = Math.floor(Date.now() / 1000);
  const BATCH_SIZE = 100;
  let upserted     = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const chunk = records.slice(i, i + BATCH_SIZE);

    const statements = chunk.map((r) => {
      const wins   = Number(r.Wins)   || 0;
      const losses = Number(r.Losses) || 0;
      const winPct = wins + losses > 0 ? wins / (wins + losses) : 0;

      return db.prepare(`
        INSERT INTO kenpom_data (
          team_name, adj_oe, adj_de, adj_tempo, adj_em,
          conference, kenpom_rank, win_pct, record,
          luck, opp_adj_oe, opp_adj_de,
          season, last_updated
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(team_name) DO UPDATE SET
          adj_oe       = excluded.adj_oe,
          adj_de       = excluded.adj_de,
          adj_tempo    = excluded.adj_tempo,
          adj_em       = excluded.adj_em,
          conference   = excluded.conference,
          kenpom_rank  = excluded.kenpom_rank,
          win_pct      = excluded.win_pct,
          record       = excluded.record,
          luck         = excluded.luck,
          opp_adj_oe   = excluded.opp_adj_oe,
          opp_adj_de   = excluded.opp_adj_de,
          season       = excluded.season,
          last_updated = excluded.last_updated
      `).bind(
        r.TeamName,
        Number(r.AdjOE),
        Number(r.AdjDE),
        Number(r.AdjTempo),
        Number(r.AdjEM),
        r.ConfShort ?? '',
        Number(r.RankAdjEM) || 0,
        winPct,
        `${wins}-${losses}`,
        r.Luck != null ? Number(r.Luck) : null,
        r.SOSO != null ? Number(r.SOSO) : null,
        r.SOSD != null ? Number(r.SOSD) : null,
        season,
        now
      );
    });

    await db.batch(statements);
    upserted += chunk.length;
  }

  return upserted;
}

async function logSyncRun(
  db: D1Database,
  result: {
    teamsSynced: number;
    status:      'success' | 'partial' | 'failed';
    error?:      string;
    durationMs:  number;
  }
): Promise<void> {
  try {
    await db.prepare(`
      INSERT INTO kenpom_sync_log (ran_at, teams_synced, status, error_message, duration_ms)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      Math.floor(Date.now() / 1000),
      result.teamsSynced,
      result.status,
      result.error ?? null,
      result.durationMs
    ).run();
  } catch (_) {
    // Don't let logging failure mask the real result
  }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Fetch all D1 team ratings from the KenPom API and upsert into D1.
 *
 * @param db      Cloudflare D1 binding
 * @param apiKey  KenPom API key (from env.KENPOM_API_KEY)
 * @param season  e.g. "2025" — the ending year of the season
 */
export async function syncKenPomData(
  db: D1Database,
  apiKey: string,
  season?: string
): Promise<KenPomSyncResult> {
  const start     = Date.now();
  const seasonStr = season ?? new Date().getFullYear().toString();

  try {
    const records  = await fetchRatings(apiKey, seasonStr);
    const upserted = await upsertToD1(db, records, seasonStr);
    const durationMs = Date.now() - start;

    await logSyncRun(db, { teamsSynced: upserted, status: 'success', durationMs });
    console.log(`[kenpom-sync] Success: ${upserted} teams synced in ${durationMs}ms`);

    return { success: true, teamsSynced: upserted, durationMs };

  } catch (err) {
    const durationMs = Date.now() - start;
    const errorMsg   = err instanceof Error ? err.message : String(err);

    console.error('[kenpom-sync] Failed:', errorMsg);
    await logSyncRun(db, { teamsSynced: 0, status: 'failed', error: errorMsg, durationMs });

    return { success: false, teamsSynced: 0, durationMs, error: errorMsg };
  }
}

// ---------------------------------------------------------------------------
// Query helpers (used by analytics-engine.ts)
// ---------------------------------------------------------------------------

export async function getTeamData(
  db: D1Database,
  teamName: string
): Promise<KenPomEntry | null> {
  const row = await db.prepare(`
    SELECT adj_oe, adj_de, adj_tempo, adj_em, win_pct,
           conference, kenpom_rank, luck, opp_adj_oe, opp_adj_de
    FROM   kenpom_data
    WHERE  team_name = ?
    LIMIT  1
  `).bind(teamName).first<{
    adj_oe: number; adj_de: number; adj_tempo: number; adj_em: number;
    win_pct: number; conference: string; kenpom_rank: number;
    luck: number | null; opp_adj_oe: number | null; opp_adj_de: number | null;
  }>();

  if (!row) return null;

  return {
    adjOE:      row.adj_oe,
    adjDE:      row.adj_de,
    adjTempo:   row.adj_tempo,
    adjEM:      row.adj_em,
    winPct:     row.win_pct,
    conference: row.conference,
    rank:       row.kenpom_rank,
    luck:       row.luck,
    oppAdjOE:   row.opp_adj_oe,
    oppAdjDE:   row.opp_adj_de,
  };
}

export async function getMatchupData(
  db: D1Database,
  homeTeam: string,
  awayTeam: string
): Promise<{ home: KenPomEntry | null; away: KenPomEntry | null }> {
  const rows = await db.prepare(`
    SELECT team_name, adj_oe, adj_de, adj_tempo, adj_em, win_pct,
           conference, kenpom_rank, luck, opp_adj_oe, opp_adj_de
    FROM   kenpom_data
    WHERE  team_name IN (?, ?)
    LIMIT  2
  `).bind(homeTeam, awayTeam).all<{
    team_name: string; adj_oe: number; adj_de: number; adj_tempo: number;
    adj_em: number; win_pct: number; conference: string; kenpom_rank: number;
    luck: number | null; opp_adj_oe: number | null; opp_adj_de: number | null;
  }>();

  const toEntry = (r: typeof rows.results[0]): KenPomEntry => ({
    adjOE:      r.adj_oe,
    adjDE:      r.adj_de,
    adjTempo:   r.adj_tempo,
    adjEM:      r.adj_em,
    winPct:     r.win_pct,
    conference: r.conference,
    rank:       r.kenpom_rank,
    luck:       r.luck,
    oppAdjOE:   r.opp_adj_oe,
    oppAdjDE:   r.opp_adj_de,
  });

  const homeRow = rows.results.find(r => r.team_name === homeTeam);
  const awayRow = rows.results.find(r => r.team_name === awayTeam);

  return {
    home: homeRow ? toEntry(homeRow) : null,
    away: awayRow ? toEntry(awayRow) : null,
  };
}

export async function getLastSyncTime(db: D1Database): Promise<Date | null> {
  const row = await db.prepare(`
    SELECT ran_at FROM kenpom_sync_log
    WHERE  status = 'success'
    ORDER  BY ran_at DESC
    LIMIT  1
  `).first<{ ran_at: number }>();

  return row ? new Date(row.ran_at * 1000) : null;
}
