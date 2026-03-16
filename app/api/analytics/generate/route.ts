import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextRequest, NextResponse } from 'next/server';
import { Database } from '@/lib/db';
import { AnalyticsEngine } from '@/lib/analytics-engine';
import { OddsAPIClient } from '@/lib/odds-api-client';
import { WeatherClient } from '@/lib/weather-client';
import { reasonLegs, type LegContext } from '@/lib/pick-reasoning';
import type { GeneratorCriteria, GameData } from '@/types';

export const runtime = 'edge';

// ---------------------------------------------------------------------------
// Team name normalization
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

  // Tournament teams (common Odds API vs KenPom mismatches)
  'Alabama State Hornets':    'Alabama State',
  'American University':      'American',
  'Arkansas Pine Bluff':      'Ark.-Pine Bluff',
  'Cal State Fullerton':      'CS Fullerton',
  'Central Connecticut':      'Central Conn.',
  'Coastal Carolina Chanticleers': 'Coastal Carolina',
  'Detroit Mercy':            'Detroit',
  'East Tennessee State':     'ETSU',
  'Florida International':    'FIU',
  'Gardner Webb':             'Gardner-Webb',
  'George Mason Patriots':    'George Mason',
  'Houston Baptist':          'HBU',
  'Illinois Chicago':         'UIC',
  'Indiana State Sycamores':  'Indiana State',
  'Kennesaw State Owls':      'Kennesaw State',
  'Long Island University':   'LIU',
  'Loyola Chicago':           'Loyola-Chicago',
  'Loyola Marymount':         'LMU (CA)',
  'Massachusetts Minutemen':  'Massachusetts',
  'McNeese State':            'McNeese',
  'Milwaukee Panthers':       'Milwaukee',
  'Mississippi Valley State': 'Miss. Valley St.',
  'Monmouth Hawks':           'Monmouth',
  'Montana State Bobcats':    'Montana St.',
  'Morehead State Eagles':    'Morehead St.',
  "Mount St. Mary\'s":        "Mount St. Mary's",
  'Nebraska Omaha':           'Nebraska-Omaha',
  'New Mexico State Aggies':  'New Mexico St.',
  'Norfolk State Spartans':   'Norfolk State',
  'North Dakota State':       'NDSU',
  'Northeastern Huskies':     'Northeastern',
  'Northern Iowa Panthers':   'Northern Iowa',
  'Oakland Golden Grizzlies': 'Oakland',
  'Prairie View A&M':         'Prairie View',
  'Robert Morris Colonials':  'Robert Morris',
  'Sacramento State Hornets': 'Sacramento St.',
  "Saint Peter\'s Peacocks":  "Saint Peter's",
  'Sam Houston State':        'Sam Houston',
  'San Jose State Spartans':  'San Jose St.',
  'Seton Hall Pirates':       'Seton Hall',
  'Southeast Missouri State': 'SE Missouri St.',
  'Southern Illinois Edwardsville': 'SIU Edwardsville',
  'Southern University':      'Southern',
  'St. Bonaventure Bonnies':  'St. Bonaventure',
  'St. Francis (PA)':         'St. Francis PA',
  'Stephen F. Austin':        'SFA',
  'Stony Brook Seawolves':    'Stony Brook',
  'Texas A&M Corpus Christi': 'Texas A&M-CC',
  'Texas Rio Grande Valley':  'UTRGV',
  'Texas Southern Tigers':    'Texas Southern',
  'UT Martin Skyhawks':       'UT Martin',
  'UTSA Roadrunners':         'UTSA',
  'Vanderbilt Commodores':    'Vanderbilt',
  'Vermont Catamounts':       'Vermont',
  'Virginia Military Institute': 'VMI',
  'Weber State Wildcats':     'Weber State',
  'Western Illinois Leathernecks': 'Western Illinois',
  'Western Kentucky Hilltoppers': 'Western Kentucky',
  'Wichita State Shockers':   'Wichita State',
  'William & Mary Tribe':     'William & Mary',
  'Winston-Salem State':      'Winston-Salem',
  'Youngstown State Penguins': 'Youngstown St.',
};

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
  ' Commodores', ' Catamounts', ' Bobcats',
];

export function normalizeTeamName(oddsName: string): string {
  if (ODDS_TO_KENPOM[oddsName]) return ODDS_TO_KENPOM[oddsName];
  for (const suffix of STRIP_SUFFIXES) {
    if (oddsName.endsWith(suffix)) {
      const stripped = oddsName.slice(0, oddsName.length - suffix.length).trim();
      if (ODDS_TO_KENPOM[stripped]) return ODDS_TO_KENPOM[stripped];
      return stripped;
    }
  }
  return oddsName;
}

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

// ---------------------------------------------------------------------------
// Tournament & venue helpers
// ---------------------------------------------------------------------------

/**
 * Derive tournament name from game sport + description metadata.
 * The Odds API doesn't always return tournament context, so we infer
 * from sport key and group/competition fields when available.
 */
function deriveTournament(game: GameData | undefined): string {
  if (!game) return '';
  if (game.sport === 'basketball_ncaab') {
    // March is tournament month — NCAA Tournament runs mid-March through April
    const date = new Date(game.commence_time);
    const month = date.getMonth(); // 0-indexed: 2 = March, 3 = April
    const day   = date.getDate();
    if (month === 2 && day >= 14) return 'NCAA Tournament';
    if (month === 3 && day <= 7)  return 'NCAA Tournament';
    if (month === 2 && day >= 12) return 'NIT / CBI / CIT';
    return 'NCAAB';
  }
  if (game.sport === 'americanfootball_nfl') return 'NFL';
  if (game.sport === 'basketball_nba')       return 'NBA';
  if (game.sport === 'icehockey_nhl')        return 'NHL';
  if (game.sport === 'baseball_mlb')         return 'MLB';
  return game.sport;
}

/**
 * Derive venue context using real 2026 bracket site assignments.
 * Falls back to generic "Neutral Site" for tournament games not in the map.
 */
const TEAM_VENUE_CITIES_2026: Record<string, string> = {
  // First Four
  'UMBC': 'Dayton, OH', 'Howard': 'Dayton, OH', 'Texas': 'Dayton, OH',
  'NC State': 'Dayton, OH', 'Prairie View': 'Dayton, OH', 'Lehigh': 'Dayton, OH',
  'Miami OH': 'Dayton, OH', 'SMU': 'Dayton, OH',
  // Buffalo
  'Ohio State': 'Buffalo, NY', 'TCU': 'Buffalo, NY', 'Wisconsin': 'Buffalo, NY',
  'High Point': 'Buffalo, NY', 'Duke': 'Buffalo, NY', 'Siena': 'Buffalo, NY',
  'Michigan': 'Buffalo, NY', 'BYU': 'Buffalo, NY',
  // Greenville
  'Louisville': 'Greenville, SC', 'South Florida': 'Greenville, SC',
  'Vanderbilt': 'Greenville, SC', 'McNeese': 'Greenville, SC',
  'North Carolina': 'Greenville, SC', 'VCU': 'Greenville, SC',
  'Georgia': 'Greenville, SC', 'Saint Louis': 'Greenville, SC',
  // Oklahoma City
  'Nebraska': 'Oklahoma City, OK', 'Troy': 'Oklahoma City, OK',
  'Arkansas': 'Oklahoma City, OK', "Hawai'i": 'Oklahoma City, OK',
  'Michigan State': 'Oklahoma City, OK', 'North Dakota State': 'Oklahoma City, OK',
  'Illinois': 'Oklahoma City, OK', 'Penn': 'Oklahoma City, OK',
  // Portland
  "Saint Mary's": 'Portland, OR', 'Texas A&M': 'Portland, OR',
  'Gonzaga': 'Portland, OR', 'Kennesaw State': 'Portland, OR',
  'Houston': 'Portland, OR', 'Idaho': 'Portland, OR',
  // Tampa
  'Kentucky': 'Tampa, FL', 'Santa Clara': 'Tampa, FL',
  'Iowa State': 'Tampa, FL', 'Tennessee State': 'Tampa, FL',
  'Clemson': 'Tampa, FL', 'Iowa': 'Tampa, FL',
  'Florida': 'Tampa, FL', 'Miami FL': 'Tampa, FL', 'Missouri': 'Tampa, FL',
  // Philadelphia
  'Texas Tech': 'Philadelphia, PA', 'Akron': 'Philadelphia, PA',
  'Alabama': 'Philadelphia, PA', 'Hofstra': 'Philadelphia, PA',
  'Villanova': 'Philadelphia, PA', 'Utah State': 'Philadelphia, PA',
  "St. John's": 'Philadelphia, PA', 'UNI': 'Philadelphia, PA',
  'Purdue': 'Philadelphia, PA', 'Queens': 'Philadelphia, PA',
  // San Diego
  'Arizona': 'San Diego, CA', 'Long Island University': 'San Diego, CA',
  'Tennessee': 'San Diego, CA', 'UCLA': 'San Diego, CA',
  'UCF': 'San Diego, CA', 'UConn': 'San Diego, CA', 'Furman': 'San Diego, CA',
  // St. Louis
  'Virginia': 'St. Louis, MO', 'Wright State': 'St. Louis, MO',
  'Kansas': 'St. Louis, MO', 'Cal Baptist': 'St. Louis, MO',
};

function deriveVenue(game: GameData | undefined): string {
  if (!game) return '';
  if (game.sport === 'basketball_ncaab') {
    const date  = new Date(game.commence_time);
    const month = date.getMonth();
    const day   = date.getDate();
    if ((month === 2 && day >= 14) || (month === 3 && day <= 7)) {
      // Look up actual venue city for this team
      const city = TEAM_VENUE_CITIES_2026[game.home_team]
                ?? TEAM_VENUE_CITIES_2026[game.away_team]
                ?? 'Neutral Site';
      return city;
    }
    return `${game.home_team} (Home)`;
  }
  return '';
}

export async function POST(request: NextRequest) {
  try {
    const { env } = getRequestContext();
    const kellyMultiplier = 0.25;
    const bankroll        = 100;  // $100 baseline, $5 unit (5% kelly max)
    const userStateCode   = undefined as string | undefined;

    const criteria: GeneratorCriteria = await request.json();

    if (!criteria.sports || criteria.sports.length === 0) {
      return NextResponse.json({ error: 'At least one sport required' }, { status: 400 });
    }

    if (criteria.legs < 1 || criteria.legs > 8) {
      return NextResponse.json(
        { error: 'Legs must be between 1 and 8' },
        { status: 400 }
      );
    }

    const db              = new Database(env.DB as D1Database);
    const oddsClient      = new OddsAPIClient((env as any).ODDS_API_KEY || '', db);
    const weatherClient   = new WeatherClient(db);
    const analyticsEngine = new AnalyticsEngine(env.DB as D1Database, kellyMultiplier, bankroll);

    oddsClient.resetRequestCounter();

    // Build market list
    const markets: string[] = [];
    if (criteria.bet_types.includes('moneyline'))  markets.push('h2h');
    if (criteria.bet_types.includes('spread'))     markets.push('spreads');
    if (criteria.bet_types.includes('over_under')) markets.push('totals');
    if (criteria.extra_markets?.length > 0)        markets.push(...criteria.extra_markets);

    const propMarketCount   = criteria.extra_markets?.length || 0;
    const estimatedPropLegs = propMarketCount > 0 && markets.length > 0
      ? Math.ceil(criteria.legs * (propMarketCount / markets.length))
      : 0;

    // Fetch odds
    let games = await oddsClient.getOddsForSports(criteria.sports, markets, {
      sgpMode:          criteria.sgp_mode,
      requiredPropLegs: estimatedPropLegs,
    });

    // Fallback without props
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

    games = normalizeGameNames(games);

    // Weather enrichment (outdoor sports only)
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

    // Generate parlay via analytics engine
    const result = await analyticsEngine.generateSmartParlay(criteria, games, userStateCode);

    const requestStats = oddsClient.getRequestStats();
    console.log(`API Requests: ${requestStats.used}/${requestStats.budget}`);

    // ---------------------------------------------------------------------------
    // Shape raw legs — strip partial data language before sending to Claude
    // ---------------------------------------------------------------------------
    const PARTIAL_DATA_RE = /\s*\((partial data|model estimate)\)/gi;

    const rawLegs = result.legs.map((leg) => ({
      id:                  leg.id,
      sport:               leg.sport,
      event_id:            leg.event_id,
      event_name:          leg.event_name,
      commence_time:       leg.commence_time,
      // Tournament/venue context derived from game data
      tournament:          deriveTournament(leg.rawData?.game),
      venue:               deriveVenue(leg.rawData?.game),
      market:              leg.market,
      pick:                leg.pick,
      odds:                leg.odds,
      participant:         leg.participant,
      point:               leg.point,
      bet_kind:            leg.bet_kind,
      bet_tag:             leg.bet_tag,
      dk_link:             leg.dk_link,
      confidence:          leg.confidenceScore,
      edge:                leg.edgeScore,
      factors:             (leg.factors ?? []).map((f: any) => ({
        ...f,
        description: (f.description ?? '').replace(PARTIAL_DATA_RE, '').trim(),
      })),
      locked_by_user:      leg.locked_by_user,
      expected_value:      leg.analytics.expected_value,
      kelly_units:         leg.analytics.kelly_units,
      kelly_fraction:      leg.analytics.kelly_fraction,
      true_probability:    leg.analytics.true_probability,
      implied_probability: leg.analytics.implied_probability,
      bet_grade:           leg.analytics.bet_grade,
    }));

    // ---------------------------------------------------------------------------
    // Claude reasoning layer — one defensible sentence per leg
    // ---------------------------------------------------------------------------
    let reasonings: Awaited<ReturnType<typeof reasonLegs>> = [];
    try {
      const legContexts: LegContext[] = rawLegs.map((leg) => ({
        pick:             leg.pick,
        eventName:        leg.event_name,
        odds:             leg.odds,
        market:           leg.market,
        factors:          leg.factors,
        edgeScore:        leg.edge,
        confidenceScore:  leg.confidence,
        trueProb:         leg.true_probability,
        impliedProb:      leg.implied_probability,
      }));

      reasonings = await reasonLegs(legContexts);
    } catch (err) {
      console.error('[generate] Claude reasoning failed — returning picks without reasoning:', err);
      // Graceful fallback: picks still returned, reasoning cards will show factor bullets
    }

    // Attach reasoning to each leg
    const parlayLegs = rawLegs.map((leg, i) => ({
      ...leg,
      reasoning: reasonings[i] ?? null,
    }));

    return NextResponse.json({
      success: true,
      parlay:  parlayLegs,
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
  const decimal       = americanOdds.map(o => o > 0 ? 1 + o / 100 : 1 + 100 / Math.abs(o));
  const parlayDecimal = decimal.reduce((acc, o) => acc * o, 1);
  return parlayDecimal >= 2
    ? Math.round((parlayDecimal - 1) * 100)
    : -Math.round(100 / (parlayDecimal - 1));
}
