/**
 * lib/team-news.ts
 *
 * Fetches recent news headlines from ESPN's unofficial API for tournament teams.
 * Used to inject injury/roster context into Claude's reasoning prompt so picks
 * can flag when a perceived KenPom edge may be undermined by a key absence.
 *
 * ESPN endpoint is free and requires no auth key.
 * Responses are cached per-request to avoid redundant calls.
 */

export interface TeamNewsItem {
  headline:    string;
  description: string;
  published:   string;  // ISO date string
  team:        string;
}

// ESPN team abbreviation map (KenPom name → ESPN abbrev)
// Only tournament teams included — expand as needed
const KENPOM_TO_ESPN_ABBREV: Record<string, string> = {
  'Duke':            'duke',
  'North Carolina':  'unc',
  'Kentucky':        'kentucky',
  'Kansas':          'kansas',
  'Houston':         'houston',
  'Arizona':         'arizona',
  'Michigan':        'michigan',
  'Gonzaga':         'gonzaga',
  'Iowa State':      'iowa-state',
  'Florida':         'florida',
  'UConn':           'connecticut',
  'Purdue':          'purdue',
  'Tennessee':       'tennessee',
  'Alabama':         'alabama',
  'Texas Tech':      'texas-tech',
  'Michigan State':  'michigan-state',
  'Illinois':        'illinois',
  'Villanova':       'villanova',
  'Virginia':        'virginia',
  'Arkansas':        'arkansas',
  'Wisconsin':       'wisconsin',
  'UCLA':            'ucla',
  'Clemson':         'clemson',
  'Iowa':            'iowa',
  'Nebraska':        'nebraska',
  'BYU':             'byu',
  "Saint Mary's":    'saint-marys',
  "St. John's":      'st-johns',
  'Vanderbilt':      'vanderbilt',
  'Georgia':         'georgia',
  'Ohio State':      'ohio-state',
  'TCU':             'tcu',
  'Louisville':      'louisville',
  'Texas A&M':       'texas-am',
  'Missouri':        'missouri',
  'South Florida':   'south-florida',
  'VCU':             'vcu',
  'McNeese':         'mcneese-state',
  'Siena':           'siena',
};

// Keywords that indicate injury/availability news worth flagging
const INJURY_KEYWORDS = [
  'injury', 'injured', 'out', 'doubtful', 'questionable', 'day-to-day',
  'sidelined', 'miss', 'fracture', 'sprain', 'torn', 'surgery', 'return',
  'limited', 'rest', 'knee', 'ankle', 'hand', 'foot', 'shoulder', 'back',
  'suspension', 'suspended', 'transfer', 'withdrawn',
];

function isInjuryRelated(headline: string, description: string): boolean {
  const text = (headline + ' ' + description).toLowerCase();
  return INJURY_KEYWORDS.some(kw => text.includes(kw));
}

/**
 * Fetch recent news for a team from ESPN.
 * Returns only injury/availability-related items from the last 14 days.
 * Returns empty array on any error — never throws.
 */
async function fetchTeamNews(teamAbbrev: string): Promise<TeamNewsItem[]> {
  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/${teamAbbrev}/news?limit=10`;
    const res  = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal:  AbortSignal.timeout(3000), // 3s timeout — don't slow down generation
    });

    if (!res.ok) return [];

    const data = await res.json() as any;
    const articles: any[] = data.articles ?? [];
    const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000; // 14 days ago

    return articles
      .filter(a => {
        const pub = new Date(a.published ?? 0).getTime();
        return pub >= cutoff && isInjuryRelated(a.headline ?? '', a.description ?? '');
      })
      .slice(0, 3)  // max 3 items per team
      .map(a => ({
        headline:    a.headline   ?? '',
        description: a.description ?? '',
        published:   a.published  ?? '',
        team:        teamAbbrev,
      }));
  } catch {
    return [];  // network error, timeout, or parse failure — degrade gracefully
  }
}

/**
 * Fetch injury-relevant news for all teams in a set of matchups.
 * Runs in parallel with a concurrency limit to avoid rate limiting.
 * Returns a map of KenPom team name → news items.
 */
export async function fetchMatchupNews(
  teams: string[]
): Promise<Record<string, TeamNewsItem[]>> {
  const result: Record<string, TeamNewsItem[]> = {};

  // Only fetch for teams we have ESPN abbrevs for
  const fetchable = teams.filter(t => KENPOM_TO_ESPN_ABBREV[t]);

  // Parallel fetch, max 6 concurrent
  const CHUNK = 6;
  for (let i = 0; i < fetchable.length; i += CHUNK) {
    const chunk = fetchable.slice(i, i + CHUNK);
    const results = await Promise.all(
      chunk.map(async team => ({
        team,
        news: await fetchTeamNews(KENPOM_TO_ESPN_ABBREV[team]),
      }))
    );
    for (const { team, news } of results) {
      if (news.length > 0) result[team] = news;
    }
  }

  return result;
}

/**
 * Format news items as a compact string for injection into the Claude prompt.
 */
export function formatNewsForPrompt(
  newsMap: Record<string, TeamNewsItem[]>,
  homeTeam: string,
  awayTeam: string
): string {
  const items: string[] = [];

  for (const team of [homeTeam, awayTeam]) {
    const teamNews = newsMap[team];
    if (!teamNews?.length) continue;
    for (const n of teamNews) {
      items.push(`[${team}] ${n.headline}`);
    }
  }

  if (items.length === 0) return '';
  return `Recent news:\n${items.join('\n')}`;
}
