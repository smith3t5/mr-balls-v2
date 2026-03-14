/**
 * lib/kenpom-sync.ts
 *
 * Authenticates with kenpom.com using your subscriber credentials,
 * scrapes the main ratings table (index.php — all D1 teams), and
 * upserts the results into the D1 kenpom_data table.
 *
 * Called by: functions/cron-kenpom.ts (daily cron)
 * Read by:   lib/analytics-engine.ts (per-request, via D1 cache)
 *
 * KenPom page structure (as of 2025):
 *   POST https://kenpom.com/handlers/login_handler.php
 *     email=...&password=...
 *   GET  https://kenpom.com/index.php
 *     Returns HTML with <table id="ratings-table"> containing all D1 teams.
 *
 * Column order in the ratings table (confirmed from BeautifulSoup scrapers):
 *   0  Rank
 *   1  Team (contains <a> and sometimes a seed number suffix)
 *   2  Conference
 *   3  W-L  (e.g. "24-8")
 *   4  AdjEM
 *   5  AdjO   ← we want this
 *   6  AdjO Rank
 *   7  AdjD   ← we want this
 *   8  AdjD Rank
 *   9  AdjT   ← we want this
 *   10 AdjT Rank
 *   11 Luck
 *   12 Luck Rank
 *   13 SOS AdjEM
 *   14 SOS AdjEM Rank
 *   15 OppO   ← opponent AdjO
 *   16 OppO Rank
 *   17 OppD   ← opponent AdjD
 *   18 OppD Rank
 *   19 NCSOS (non-conf SOS)
 *   20 NCSOS Rank
 *
 * KenPom occasionally reorders or adds columns. The parser below uses
 * header detection to find column indices dynamically rather than
 * relying on hardcoded positions — this makes it resilient to minor
 * layout changes.
 */

export interface KenPomRow {
  teamName:   string;
  conference: string;
  record:     string;
  rank:       number;
  adjEM:      number;
  adjOE:      number;
  adjDE:      number;
  adjTempo:   number;
  luck:       number | null;
  oppAdjOE:   number | null;
  oppAdjDE:   number | null;
  winPct:     number;
  season:     string;
}

export interface KenPomSyncResult {
  success:     boolean;
  teamsSynced: number;
  durationMs:  number;
  error?:      string;
}

// ---------------------------------------------------------------------------
// HTML parsing helpers (no external dependencies — runs in Cloudflare Workers)
// ---------------------------------------------------------------------------

/**
 * Extract all <td> text values from a single <tr> string.
 * Strips HTML tags and trims whitespace.
 */
function parseTdValues(row: string): string[] {
  const cells: string[] = [];
  // Match each <td ...>...</td> block (non-greedy, handles nested tags)
  const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  let match: RegExpExecArray | null;
  while ((match = tdRegex.exec(row)) !== null) {
    // Strip all HTML tags from the cell content
    const text = match[1].replace(/<[^>]+>/g, '').trim();
    cells.push(text);
  }
  return cells;
}

/**
 * Extract all <th> text values from the header row.
 * Used to dynamically detect column positions.
 */
function parseThValues(row: string): string[] {
  const headers: string[] = [];
  const thRegex = /<th[^>]*>([\s\S]*?)<\/th>/gi;
  let match: RegExpExecArray | null;
  while ((match = thRegex.exec(row)) !== null) {
    headers.push(match[1].replace(/<[^>]+>/g, '').trim().toLowerCase());
  }
  return headers;
}

/**
 * Parse "W-L" record string into a win percentage.
 * Returns 0 if unparseable.
 */
function recordToWinPct(record: string): number {
  const parts = record.split('-');
  if (parts.length !== 2) return 0;
  const wins   = parseInt(parts[0], 10);
  const losses = parseInt(parts[1], 10);
  if (isNaN(wins) || isNaN(losses) || wins + losses === 0) return 0;
  return wins / (wins + losses);
}

/**
 * Strip the tournament seed suffix KenPom appends to team names.
 * e.g. "Duke 1" → "Duke", "Kansas State 4" → "Kansas State"
 */
function cleanTeamName(raw: string): string {
  // KenPom appends a space + single/double digit seed at end of name
  return raw.replace(/\s+\d{1,2}$/, '').trim();
}

/**
 * Safely parse a float, returning null on failure.
 */
function safeFloat(val: string): number | null {
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

// ---------------------------------------------------------------------------
// Column index detection
// ---------------------------------------------------------------------------

interface ColMap {
  rank:    number;
  team:    number;
  conf:    number;
  record:  number;
  adjEM:   number;
  adjO:    number;
  adjD:    number;
  adjT:    number;
  luck:    number;
  oppO:    number;
  oppD:    number;
}

/**
 * Detect column positions from the header row.
 * Falls back to known-good defaults if detection fails.
 */
function detectColumns(headerRow: string): ColMap {
  const headers = parseThValues(headerRow);

  const find = (...candidates: string[]): number => {
    for (const c of candidates) {
      const idx = headers.findIndex((h) => h.includes(c));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  // The ratings table has duplicate "rank" columns (rank suffix after each
  // metric). We want the *first* occurrence of each metric column.
  const adjOIdx  = headers.findIndex((h) => h === 'adjo' || h === 'adjoe' || h.startsWith('adjo'));
  const adjDIdx  = headers.findIndex((h) => h === 'adjd' || h === 'adjde' || h.startsWith('adjd'));
  const adjTIdx  = headers.findIndex((h) => h === 'adjt' || h === 'adjte' || h.startsWith('adjt'));
  const adjEMIdx = headers.findIndex((h) => h === 'adjem' || h.includes('efficiency margin'));
  const luckIdx  = headers.findIndex((h) => h === 'luck');

  // Opponent columns appear after the luck column — find them after luckIdx
  const oppOIdx  = luckIdx >= 0
    ? headers.findIndex((h, i) => i > luckIdx && (h === 'oppo' || h === 'oppoe' || h.startsWith('oppo')))
    : -1;
  const oppDIdx  = luckIdx >= 0
    ? headers.findIndex((h, i) => i > luckIdx && (h === 'oppd' || h === 'oppde' || h.startsWith('oppd')))
    : -1;

  return {
    rank:   find('rank'),
    team:   find('team'),
    conf:   find('conf'),
    record: find('w-l', 'record', 'wl'),
    adjEM:  adjEMIdx  >= 0 ? adjEMIdx  : 4,
    adjO:   adjOIdx   >= 0 ? adjOIdx   : 5,
    adjD:   adjDIdx   >= 0 ? adjDIdx   : 7,
    adjT:   adjTIdx   >= 0 ? adjTIdx   : 9,
    luck:   luckIdx   >= 0 ? luckIdx   : 11,
    oppO:   oppOIdx   >= 0 ? oppOIdx   : 15,
    oppD:   oppDIdx   >= 0 ? oppDIdx   : 17,
  };
}

// ---------------------------------------------------------------------------
// HTML scraping
// ---------------------------------------------------------------------------

const KENPOM_BASE    = 'https://kenpom.com';
const LOGIN_ENDPOINT = `${KENPOM_BASE}/handlers/login_handler.php`;
const RATINGS_PAGE   = `${KENPOM_BASE}/index.php`;

// Simulate a real browser to avoid bot detection
const BROWSER_HEADERS = {
  'User-Agent':      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate, br',
  'DNT':             '1',
  'Connection':      'keep-alive',
  'Upgrade-Insecure-Requests': '1',
};

/**
 * Authenticate with KenPom and return a session cookie string.
 * KenPom uses a simple form POST that sets a PHP session cookie.
 */
async function loginToKenPom(email: string, password: string): Promise<string> {
  const body = new URLSearchParams({ email, password });

  const response = await fetch(LOGIN_ENDPOINT, {
    method:   'POST',
    headers:  {
      ...BROWSER_HEADERS,
      'Content-Type':  'application/x-www-form-urlencoded',
      'Referer':       `${KENPOM_BASE}/`,
      'Origin':        KENPOM_BASE,
    },
    body:     body.toString(),
    redirect: 'manual', // Don't follow redirects — we want the Set-Cookie header
  });

  // KenPom returns a 302 redirect on successful login
  // The session cookie is in the Set-Cookie header
  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) {
    // Try following the redirect and checking for auth cookie
    const responseFollowed = await fetch(LOGIN_ENDPOINT, {
      method:  'POST',
      headers: {
        ...BROWSER_HEADERS,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer':      `${KENPOM_BASE}/`,
        'Origin':       KENPOM_BASE,
      },
      body: body.toString(),
    });

    const followedCookie = responseFollowed.headers.get('set-cookie');
    if (!followedCookie) {
      throw new Error('KenPom login failed: no session cookie returned. Check credentials.');
    }
    return parseCookieHeader(followedCookie);
  }

  const cookieStr = parseCookieHeader(setCookie);
  if (!cookieStr) {
    throw new Error('KenPom login failed: could not parse session cookie.');
  }

  return cookieStr;
}

/**
 * Extract the cookie name=value pairs we need to send in subsequent requests.
 * Strips attributes like Path, Expires, HttpOnly, etc.
 */
function parseCookieHeader(setCookieHeader: string): string {
  // Set-Cookie can contain multiple cookies separated by commas,
  // but each cookie's attributes are separated by semicolons.
  // We want the first "name=value" part of each cookie.
  return setCookieHeader
    .split(',')
    .map((c) => c.split(';')[0].trim())
    .filter((c) => c.includes('='))
    .join('; ');
}

/**
 * Fetch the KenPom ratings page using the authenticated session cookie.
 */
async function fetchRatingsPage(sessionCookie: string): Promise<string> {
  const response = await fetch(RATINGS_PAGE, {
    headers: {
      ...BROWSER_HEADERS,
      'Cookie':  sessionCookie,
      'Referer': KENPOM_BASE,
    },
  });

  if (!response.ok) {
    throw new Error(`KenPom ratings page returned HTTP ${response.status}`);
  }

  const html = await response.text();

  // Sanity check: if we got the login form back, auth failed silently
  if (html.includes('id="login"') || html.includes('name="password"')) {
    throw new Error('KenPom auth failed: got login page instead of ratings. Check credentials.');
  }

  if (!html.includes('ratings-table') && !html.includes('id="dataTable"')) {
    throw new Error('KenPom ratings table not found on page. Page structure may have changed.');
  }

  return html;
}

/**
 * Parse the HTML ratings table into an array of KenPomRow objects.
 */
function parseRatingsTable(html: string, season: string): KenPomRow[] {
  // Extract the table content
  // KenPom uses id="ratings-table" or the main dataTable
  const tableMatch = html.match(/<table[^>]*id=["'](ratings-table|dataTable)["'][^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) {
    // Fallback: grab the first substantial table
    const fallback = html.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
    if (!fallback) throw new Error('Could not find ratings table in KenPom HTML');
  }

  const tableHtml = tableMatch ? tableMatch[0] : html;

  // Split into rows
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const rows: string[] = [];
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
    rows.push(rowMatch[0]);
  }

  if (rows.length < 3) {
    throw new Error(`KenPom table has only ${rows.length} rows — expected 360+`);
  }

  // Find header row (contains <th> elements)
  let colMap: ColMap | null = null;
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    if (rows[i].includes('<th')) {
      colMap = detectColumns(rows[i]);
      headerRowIdx = i;
      break;
    }
  }

  if (!colMap) {
    // Use defaults if no header found
    colMap = { rank: 0, team: 1, conf: 2, record: 3, adjEM: 4, adjO: 5, adjD: 7, adjT: 9, luck: 11, oppO: 15, oppD: 17 };
  }

  const teams: KenPomRow[] = [];

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i];

    // Skip header/subheader rows that don't contain actual team data
    if (!row.includes('<td')) continue;
    if (row.includes('class="thead"') || row.includes('class="subhead"')) continue;

    const cells = parseTdValues(row);
    if (cells.length < 10) continue; // not a data row

    // Team name cell — KenPom wraps it in an <a> tag; parseTdValues strips tags
    const rawTeamName = cells[colMap.team] ?? '';
    const teamName    = cleanTeamName(rawTeamName);
    if (!teamName || teamName.toLowerCase() === 'team') continue;

    const rankStr   = cells[colMap.rank]   ?? '0';
    const confStr   = cells[colMap.conf]   ?? '';
    const recordStr = cells[colMap.record] ?? '0-0';
    const adjEMStr  = cells[colMap.adjEM]  ?? '0';
    const adjOStr   = cells[colMap.adjO]   ?? '100';
    const adjDStr   = cells[colMap.adjD]   ?? '100';
    const adjTStr   = cells[colMap.adjT]   ?? '68';
    const luckStr   = cells[colMap.luck]   ?? '0';
    const oppOStr   = cells[colMap.oppO]   ?? null;
    const oppDStr   = cells[colMap.oppD]   ?? null;

    const adjOE = safeFloat(adjOStr);
    const adjDE = safeFloat(adjDStr);
    const adjT  = safeFloat(adjTStr);

    // Skip rows with unparseable core metrics
    if (adjOE === null || adjDE === null || adjT === null) continue;

    teams.push({
      teamName,
      conference: confStr,
      record:     recordStr,
      rank:       parseInt(rankStr, 10) || teams.length + 1,
      adjEM:      safeFloat(adjEMStr) ?? (adjOE - adjDE),
      adjOE,
      adjDE,
      adjTempo:   adjT,
      luck:       safeFloat(luckStr),
      oppAdjOE:   oppOStr ? safeFloat(oppOStr) : null,
      oppAdjDE:   oppDStr ? safeFloat(oppDStr) : null,
      winPct:     recordToWinPct(recordStr),
      season,
    });
  }

  return teams;
}

// ---------------------------------------------------------------------------
// D1 upsert
// ---------------------------------------------------------------------------

/**
 * Upsert all KenPom rows into the kenpom_data D1 table.
 * Uses batched statements to stay within D1's per-request limits.
 * Returns the number of rows successfully written.
 */
async function upsertToD1(
  db: D1Database,
  teams: KenPomRow[]
): Promise<number> {
  const now = Math.floor(Date.now() / 1000);

  // D1 batch limit is 100 statements per batch call
  const BATCH_SIZE = 100;
  let upserted = 0;

  for (let i = 0; i < teams.length; i += BATCH_SIZE) {
    const chunk = teams.slice(i, i + BATCH_SIZE);

    const statements = chunk.map((t) =>
      db.prepare(`
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
        t.teamName,
        t.adjOE,
        t.adjDE,
        t.adjTempo,
        t.adjEM,
        t.conference,
        t.rank,
        t.winPct,
        t.record,
        t.luck,
        t.oppAdjOE,
        t.oppAdjDE,
        t.season,
        now
      )
    );

    await db.batch(statements);
    upserted += chunk.length;
  }

  return upserted;
}

/**
 * Write a record to kenpom_sync_log so we can monitor cron health.
 */
async function logSyncRun(
  db: D1Database,
  result: { teamsSynced: number; status: 'success' | 'partial' | 'failed'; error?: string; durationMs: number }
): Promise<void> {
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
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Full sync: authenticate → scrape → parse → upsert → log.
 * Call this from your cron function.
 *
 * @param db         Cloudflare D1 database binding
 * @param email      KenPom subscriber email (from env)
 * @param password   KenPom subscriber password (from env)
 * @param season     Season string e.g. "2025" (defaults to current year)
 */
export async function syncKenPomData(
  db: D1Database,
  email: string,
  password: string,
  season?: string
): Promise<KenPomSyncResult> {
  const start      = Date.now();
  const seasonStr  = season ?? new Date().getFullYear().toString();

  try {
    // 1. Authenticate
    const sessionCookie = await loginToKenPom(email, password);

    // Small delay after login to avoid looking like a bot
    await new Promise((r) => setTimeout(r, 800));

    // 2. Fetch ratings page
    const html = await fetchRatingsPage(sessionCookie);

    // 3. Parse
    const teams = parseRatingsTable(html, seasonStr);

    if (teams.length < 300) {
      // KenPom has 362 D1 teams as of 2025. If we get far fewer, something went wrong.
      throw new Error(`Only parsed ${teams.length} teams — expected 350+. Parser may need updating.`);
    }

    // 4. Upsert to D1
    const upserted = await upsertToD1(db, teams);

    const durationMs = Date.now() - start;

    // 5. Log
    await logSyncRun(db, {
      teamsSynced: upserted,
      status:      'success',
      durationMs,
    });

    console.log(`[kenpom-sync] Success: ${upserted} teams synced in ${durationMs}ms`);

    return { success: true, teamsSynced: upserted, durationMs };

  } catch (err) {
    const durationMs = Date.now() - start;
    const errorMsg   = err instanceof Error ? err.message : String(err);

    console.error('[kenpom-sync] Failed:', errorMsg);

    // Best-effort log (don't throw if this fails too)
    try {
      await logSyncRun(db, {
        teamsSynced: 0,
        status:      'failed',
        error:       errorMsg,
        durationMs,
      });
    } catch (_) {}

    return { success: false, teamsSynced: 0, durationMs, error: errorMsg };
  }
}

// ---------------------------------------------------------------------------
// Query helpers (used by analytics-engine.ts)
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

/**
 * Fetch a single team's KenPom data from D1.
 * Returns null if the team isn't in the database yet.
 */
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

/**
 * Fetch both teams' data in a single round-trip.
 * More efficient than two separate getTeamData calls.
 */
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

  const homeRow = rows.results.find((r) => r.team_name === homeTeam);
  const awayRow = rows.results.find((r) => r.team_name === awayTeam);

  return {
    home: homeRow ? toEntry(homeRow) : null,
    away: awayRow ? toEntry(awayRow) : null,
  };
}

/**
 * Check when data was last successfully synced.
 * Returns null if no sync has ever run.
 */
export async function getLastSyncTime(db: D1Database): Promise<Date | null> {
  const row = await db.prepare(`
    SELECT ran_at FROM kenpom_sync_log
    WHERE  status = 'success'
    ORDER  BY ran_at DESC
    LIMIT  1
  `).first<{ ran_at: number }>();

  return row ? new Date(row.ran_at * 1000) : null;
}
