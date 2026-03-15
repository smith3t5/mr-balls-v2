import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextRequest, NextResponse } from 'next/server';
import { Database } from '@/lib/db';
import { AnalyticsEngine } from '@/lib/analytics-engine';
import { OddsAPIClient } from '@/lib/odds-api-client';
import { WeatherClient } from '@/lib/weather-client';
import type { GeneratorCriteria, GameData } from '@/types';

export const runtime = 'edge';

// ---------------------------------------------------------------------------
// Team name normalization
//
// The Odds API and KenPom use slightly different names for the same teams.
// This map translates Odds API names → KenPom names so D1 lookups hit.
// Add entries here as you discover mismatches in production.
// ---------------------------------------------------------------------------
const ODDS_TO_KENPOM: Record<string, string> = {
  // Big East
  'Connecticut':              'UConn',
  'UConn Huskies':            'UConn',

  // SEC
  'Mississippi':              'Ole Miss',
  'Mississippi State Bulldogs': 'Mississippi State',

  // ACC
  'Miami':                    'Miami FL',
  'Miami (FL)':               'Miami FL',
  'North Carolina State':     'NC State',

  // Big Ten
  'Minnesota Golden Gophers': 'Minnesota',
  'Penn State Nittany Lions': 'Penn State',

  // Big 12
  'Texas Christian':          'TCU',
  'Brigham Young':            'BYU',
  'West Virginia Mountaineers': 'West Virginia',

  // WCC
  "Saint Mary's (CA)":        "Saint Mary's",
  'Saint Marys':              "Saint Mary's",

  // Common suffixes the Odds API sometimes appends
  // (handled programmatically below, but explicit entries take priority)
};

// Suffixes the Odds API sometimes appends that KenPom doesn't use
const STRIP_SUFFIXES = [
  ' Wildcats', ' Bulldogs', ' Tigers', ' Bears', ' Wolverines',
  ' Spartans', ' Buckeyes', ' Hoosiers', ' Hawkeyes', ' Badgers',
  ' Huskers', ' Terrapins', ' Nittany Lions', ' Scarlet Knights',
  ' Boilermakers', ' Fighting Illini', ' Northwestern Wildcats',
  ' Golden Gophers', ' Cornhuskers',
  ' Longhorns', ' Sooners', ' Cowboys', ' Mountaineers', ' Jayhawks',
  ' Bearcats', ' Horned Frogs', ' Cougars', ' Cyclones', ' Blue Devils',
  ' Tar Heels', ' Cardinals', ' Orange', ' Eagles', ' Demon Deacons',
  ' Seminoles', ' Hurricanes', ' Panthers', ' Yellow Jackets', ' Hokies',
  ' Cavaliers', ' Fighting Irish',
  ' Huskies', ' Retrievers', ' Anteaters',
];

export function normalizeTeamName(oddsName: string): string {
  // Check explicit map first
  if (ODDS_TO_KENPOM[oddsName]) return ODDS_TO_KENPOM[oddsName];

  // Try stripping common suffixes
  for (const suffix of STRIP_SUFFIXES) {
    if (oddsName.endsWith(suffix)) {
      const stripped = oddsName.slice(0, oddsName.length - suffix.length).trim();
      if (ODDS_TO_KENPOM[stripped]) return ODDS_TO_KENPOM[stripped];
      return stripped;
    }
  }

  return oddsName;
}

/**
 * Apply name normalization to all games so analytics-engine D1 lookups work.
 */
function normalizeGameNames(games: GameData[]): GameData[] {
  return games.map(game => ({
    ...game,
    home_team: normalizeTeamName(game.home_team),
    away_team: normalizeTeamName(game.away_team),
  }));
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {

    const { env } = getRequestContext();
    const kellyMultiplier = 0.25;
    const bankroll        = 1000;
    const userStateCode   = undefined as string | undefined;

    // Parse and validate criteria
    const criteria: GeneratorCriteria = await request.json();

    if (!criteria.sports || criteria.sports.length === 0) {
      return NextResponse.json({ error: 'At least one sport required' }, { status: 400 });
    }

    if (criteria.legs < 1 || criteria.legs > 8) {
      return NextResponse.json(
        { error: 'Legs must be between 1 and 8 (1 = single bet, 2+ = parlay)' },
        { status: 400 }
      );
    }

    // Initialize clients
    // KEY FIX: pass env.DB as first arg so KenPom D1 queries work
    const oddsClient      = new OddsAPIClient((env as any).ODDS_API_KEY || '', db);
    const weatherClient   = new WeatherClient(db);
    const analyticsEngine = new AnalyticsEngine(env.DB as D1Database, kellyMultiplier, bankroll);

    oddsClient.resetRequestCounter();

    // Build market list
    const markets: string[] = [];
    if (criteria.bet_types.includes('moneyline'))   markets.push('h2h');
    if (criteria.bet_types.includes('spread'))      markets.push('spreads');
    if (criteria.bet_types.includes('over_under'))  markets.push('totals');
    if (criteria.extra_markets?.length > 0)         markets.push(...criteria.extra_markets);

    const propMarketCount  = criteria.extra_markets?.length || 0;
    const estimatedPropLegs = propMarketCount > 0 && markets.length > 0
      ? Math.ceil(criteria.legs * (propMarketCount / markets.length))
      : 0;

    // Fetch odds
    let games = await oddsClient.getOddsForSports(criteria.sports, markets, {
      sgpMode:          criteria.sgp_mode,
      requiredPropLegs: estimatedPropLegs,
    });

    // Fallback: retry without props if no games found
    if (games.length === 0 && criteria.extra_markets?.length > 0) {
      const basicMarkets = markets.filter(m => ['h2h', 'spreads', 'totals'].includes(m));
      if (basicMarkets.length > 0) {
        games = await oddsClient.getOddsForSports(criteria.sports, basicMarkets, {
          sgpMode:          criteria.sgp_mode,
          requiredPropLegs: 0,
        });
      }
    }

    // Date range filter
    if (criteria.date_from || criteria.date_to) {
      const fromDate = criteria.date_from ? new Date(criteria.date_from).getTime() : 0;
      const toDate   = criteria.date_to
        ? new Date(criteria.date_to).setHours(23, 59, 59, 999)
        : Infinity;
      games = games.filter(g => g.commence_time >= fromDate && g.commence_time <= toDate);
    }

    if (games.length === 0) {
      return NextResponse.json({
        success:  false,
        error:    'No games available for selected sports',
        warnings: [
          'Try selecting different sports or check back later',
          criteria.extra_markets?.length > 0
            ? 'Some player props may require a paid API tier'
            : null,
        ].filter(Boolean),
      });
    }

    // Normalize team names so KenPom D1 lookups match
    games = normalizeGameNames(games);

    // Enrich with weather (outdoor sports only)
    await Promise.all(
      games.map(async (game) => {
        if (
          game.sport === 'americanfootball_nfl' ||
          game.sport === 'americanfootball_ncaaf'
        ) {
          game.weather = await weatherClient.getWeatherForGame(
            game.home_team,
            game.commence_time
          );
        }
      })
    );

    // Generate parlay
    const result = await analyticsEngine.generateSmartParlay(criteria, games, userStateCode);

    const requestStats = oddsClient.getRequestStats();
    console.log(`API Requests: ${requestStats.used}/${requestStats.budget}`);

    return NextResponse.json({
      success: true,
      parlay:  result.legs.map((leg) => ({
        id:                leg.id,
        sport:             leg.sport,
        event_id:          leg.event_id,
        event_name:        leg.event_name,
        commence_time:     leg.commence_time,
        market:            leg.market,
        pick:              leg.pick,
        odds:              leg.odds,
        participant:       leg.participant,
        point:             leg.point,
        bet_kind:          leg.bet_kind,
        bet_tag:           leg.bet_tag,
        dk_link:           leg.dk_link,
        confidence:        leg.confidenceScore,
        edge:              leg.edgeScore,
        factors:           leg.factors,
        locked_by_user:    leg.locked_by_user,
        expected_value:    leg.analytics.expected_value,
        kelly_units:       leg.analytics.kelly_units,
        kelly_fraction:    leg.analytics.kelly_fraction,
        true_probability:  leg.analytics.true_probability,
        implied_probability: leg.analytics.implied_probability,
        bet_grade:         leg.analytics.bet_grade,
      })),
      meta: {
        total_confidence: result.confidence,
        avg_edge:         result.avgEdge,
        parlay_odds:      calculateParlayOdds(result.legs.map((l) => l.odds)),
      },
      warnings: [],
    });

  } catch (error: any) {
    console.error('Analytics generation error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate parlay', details: error.message },
      { status: 500 }
    );
  }
}

function calculateParlayOdds(americanOdds: number[]): number {
  const decimal = americanOdds.map(o => o > 0 ? 1 + o / 100 : 1 + 100 / Math.abs(o));
  const parlayDecimal = decimal.reduce((acc, o) => acc * o, 1);
  return parlayDecimal >= 2
    ? Math.round((parlayDecimal - 1) * 100)
    : -Math.round(100 / (parlayDecimal - 1));
}
